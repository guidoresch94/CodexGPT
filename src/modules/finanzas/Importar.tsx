import { ArrowLeft, Check, ChevronDown, FileSpreadsheet, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { go } from '../../app/router'
import type { AppData } from '../../db/hooks'
import { commitImport } from '../../db/importTx'
import { fmtDate } from '../../lib/dates'
import { money, money0, num } from '../../lib/format'
import { classifyRows, isAlreadyImported, parseBankRows, type Classified } from '../../lib/importer'
import { readSpreadsheet } from '../../lib/xlsx'
import type { Category } from '../../types'
import { Button, Card, cx, List, PageHeader, SectionTitle } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { XP } from '../../lib/game'
import { aiClassifyGroups, aiErrorText, getAI, type GroupHint, type SampleFn } from '../../lib/ai'

interface Group {
  key: string
  label: string
  items: Classified[]
  total: number
  suggested?: string
  confidence: Classified['confidence']
  income: boolean
}

type Stage = 'pick' | 'review' | 'done'

export function Importar({ data }: { data: AppData }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>('pick')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [items, setItems] = useState<Classified[]>([])
  const [byKey, setByKey] = useState<Record<string, string | undefined>>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [forceImport, setForceImport] = useState<Set<string>>(new Set())
  const [showAuto, setShowAuto] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [hints, setHints] = useState<Record<string, GroupHint>>({})
  const [ai, setAi] = useState<SampleFn | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  useEffect(() => {
    getAI().then((s) => setAi(() => s))
  }, [])
  const [result, setResult] = useState<Awaited<ReturnType<typeof commitImport>> | null>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (file?: File) => {
    if (!file) return
    setError('')
    try {
      const rows = readSpreadsheet(await file.arrayBuffer())
      const bank = parseBankRows(rows)
      if (!bank.length) throw new Error('El archivo no tiene movimientos.')
      const classified = classifyRows(bank, data.categories, data.settings.merchantRules ?? {}, data.transactions)
      setItems(classified)
      setFileName(file.name)
      setByKey({})
      setTouched(new Set())
      setStage('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pude leer el archivo.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const fresh = items.filter((i) => !isAlreadyImported(i))
  const already = items.length - fresh.length
  const dups = fresh.filter((i) => i.duplicateOf)

  const groups = useMemo(() => {
    const m = new Map<string, Group>()
    for (const it of fresh) {
      if (it.duplicateOf) continue
      const g = m.get(it.key) ?? { key: it.key, label: it.label, items: [], total: 0, suggested: it.categoryId, confidence: it.confidence, income: it.kind === 'ingreso' }
      g.items.push(it)
      g.total += it.refund ? -Math.abs(it.row.amount) : Math.abs(it.row.amount)
      if (it.ignore) g.suggested = 'ignorar'
      m.set(it.key, g)
    }
    return [...m.values()].sort((a, b) => b.items.length - a.items.length || b.total - a.total)
  }, [fresh])

  const chosen = (g: Group) => (g.key in byKey ? byKey[g.key] : g.suggested)
  const needsReview = groups.filter((g) => g.confidence === 'pista' || g.confidence === 'nada')
  const auto = groups.filter((g) => g.confidence === 'conocido' || g.confidence === 'regla')
  const pending = needsReview.filter((g) => !touched.has(g.key))
  const unclassified = groups.filter((g) => !chosen(g)).reduce((s, g) => s + g.items.length, 0)
  const toImport = groups.filter((g) => chosen(g) !== 'ignorar').reduce((s, g) => s + g.items.length, 0) + dups.filter((d) => forceImport.has(d.hash)).length
  const reviewedPct = needsReview.length ? (needsReview.length - pending.length) / needsReview.length : 1

  const pick = (g: Group, catId: string) => {
    setByKey((b) => ({ ...b, [g.key]: catId }))
    if (!touched.has(g.key)) toast({ text: `+${XP.teach} pts · Aprendí «${g.label}»` })
    setTouched((t) => new Set(t).add(g.key))
    if (navigator.vibrate) navigator.vibrate(8)
  }

  const askAI = async () => {
    if (!ai) return
    setAiBusy(true)
    setAiError('')
    try {
      const res = await aiClassifyGroups(
        ai,
        pending.map((g) => ({ key: g.key, label: g.label, examples: g.items.slice(0, 3).map((i) => `${i.row.detail || i.row.concept} (${Math.abs(i.row.amount)} €)`), count: g.items.length, total: g.total, income: g.income })),
        data,
      )
      setHints((h) => ({ ...h, ...res }))
      setByKey((b) => {
        const n = { ...b }
        for (const [k, v] of Object.entries(res)) if (v.categoryId && !touched.has(k)) n[k] = v.categoryId
        return n
      })
      setNotes((x) => {
        const n = { ...x }
        for (const [k, v] of Object.entries(res)) if (v.note && !n[k]) n[k] = v.note
        return n
      })
      const n = Object.values(res).filter((v) => v.categoryId).length
      toast({ text: `✨ La IA sugirió ${n} de ${pending.length}. Revisalos y aceptá.` })
    } catch (e) {
      setAiError(aiErrorText(e))
    } finally {
      setAiBusy(false)
    }
  }

  const run = async () => {
    setBusy(true)
    try {
      const r = await commitImport(items, { byKey, forceImport, notes }, data)
      setResult(r)
      setStage('done')
    } finally {
      setBusy(false)
    }
  }

  const period = useMemo(() => {
    if (!items.length) return ''
    const dates = items.map((i) => i.row.date).sort()
    return `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`
  }, [items])

  return (
    <div>
      <button onClick={() => go('movimientos')} className="flex items-center gap-1 pt-2 text-[17px] text-accent">
        <ArrowLeft size={20} /> Gastos
      </button>
      <PageHeader title="Importar extracto" />

      {stage === 'pick' && (
        <>
          <Card className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-[16px] bg-emerald-500 text-white">
              <FileSpreadsheet size={28} />
            </span>
            <p className="mt-3 text-[17px] font-semibold">Subí el Excel de tu banco</p>
            <p className="mt-1 text-[15px] text-slate-500">Lo leo, lo clasifico y vos solo revisás lo que no tengo claro. Lo que me enseñes, lo recuerdo para la próxima.</p>
            <Button className="mt-4 w-full" onClick={() => fileRef.current?.click()}>
              Elegir archivo
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {error && <p className="mt-3 text-[13px] text-red-500">{error}</p>}
          </Card>
          <SectionTitle>Cómo bajarlo de BBVA</SectionTitle>
          <List>
            {['Entrá en bbva.es desde el ordenador (o la app)', 'Cuentas → tu cuenta → Movimientos', 'Elegí las fechas (por ejemplo, el último mes)', 'Tocá Descargar → Excel', 'Subilo acá. Si repetís fechas, no se duplica nada'].map((t, i) => (
              <div key={t} className="flex items-center gap-3 px-4 py-3 text-[15px]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ios-fill text-[13px] font-semibold">{i + 1}</span>
                {t}
              </div>
            ))}
          </List>
          {data.settings.lastImport && <p className="mt-3 px-4 text-[13px] text-slate-500">Última importación: {fmtDate(data.settings.lastImport)}</p>}
          <button onClick={() => go('asistente')} className="mt-4 flex w-full items-center gap-3 rounded-[22px] bg-ios-card p-4 text-left active:opacity-80">
            <span className="grid h-10 w-10 place-items-center rounded-[11px] bg-violet-500 text-white">
              <Sparkles size={20} />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">¿Notas, mensajes o un ticket?</span>
              <span className="block text-[13px] text-slate-500">Pegalos o sacales una foto y la IA los convierte en gastos clasificados</span>
            </span>
          </button>
        </>
      )}

      {stage === 'review' && (
        <>
          <Card>
            <p className="text-[13px] text-slate-500">
              {fileName} · {period}
            </p>
            <p className="mt-1 text-[22px] font-bold">{fresh.length} movimientos nuevos</p>
            <p className="text-[13px] text-slate-500">
              {auto.reduce((s, g) => s + g.items.length, 0)} clasificados solos · {needsReview.reduce((s, g) => s + g.items.length, 0)} para revisar
              {dups.length > 0 && ` · ${dups.length} ya cargados a mano`}
              {already > 0 && ` · ${already} ya importados antes`}
            </p>
            {needsReview.length > 0 && (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-ios-fill">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${reviewedPct * 100}%` }} />
                </div>
                <p className="mt-1.5 text-[13px] text-slate-500">
                  {pending.length ? `Te faltan ${pending.length} comercios · +${XP.teach} pts cada uno` : '¡Todo revisado! 🎉'}
                </p>
              </div>
            )}
          </Card>

          {needsReview.length > 0 && (
            <>
              <SectionTitle
                action={
                  pending.some((g) => chosen(g)) ? (
                    <button
                      onClick={() => {
                        const ok = pending.filter((g) => chosen(g))
                        setTouched((t) => new Set([...t, ...ok.map((g) => g.key)]))
                        toast({ text: `+${ok.length * XP.teach} pts · ${ok.length} comercios aprendidos` })
                      }}
                      className="text-[15px] text-accent"
                    >
                      Aceptar sugerencias
                    </button>
                  ) : undefined
                }
              >
                Enseñame estos
              </SectionTitle>
              {ai && pending.length > 0 && (
                <button
                  onClick={askAI}
                  disabled={aiBusy}
                  className="mb-2.5 flex w-full items-center gap-3 rounded-[22px] bg-gradient-to-r from-violet-500 to-sky-500 p-4 text-left text-white active:opacity-90 disabled:opacity-70"
                >
                  <Sparkles size={22} className={cx(aiBusy && 'animate-pulse')} />
                  <span className="flex-1">
                    <span className="block text-[17px] font-semibold">{aiBusy ? 'Pensando…' : 'Clasificar con IA'}</span>
                    <span className="block text-[13px] text-white/85">
                      {aiBusy ? 'Mirando nombres, importes y conceptos' : `Que Claude sugiera los ${pending.length} comercios y te explique por qué`}
                    </span>
                  </span>
                </button>
              )}
              {aiError && <p className="mb-2.5 px-2 text-[13px] text-red-500">{aiError}</p>}
              <div className="space-y-2.5">
                {needsReview.map((g) => (
                  <GroupCard
                    key={g.key}
                    g={g}
                    data={data}
                    value={chosen(g)}
                    done={touched.has(g.key)}
                    onPick={(c) => pick(g, c)}
                    hint={hints[g.key]}
                    note={notes[g.key] ?? ''}
                    onNote={(n) => setNotes((x) => ({ ...x, [g.key]: n }))}
                  />
                ))}
              </div>
            </>
          )}

          {dups.length > 0 && (
            <>
              <SectionTitle>Ya los habías cargado</SectionTitle>
              <List>
                {dups.map((d) => {
                  const force = forceImport.has(d.hash)
                  return (
                    <div key={d.hash} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px]">{d.label}</p>
                        <p className="text-[12px] text-slate-500">
                          {fmtDate(d.row.date)} · {money(Math.abs(d.row.amount))} ≈ tu gasto del {fmtDate(d.duplicateOf!.date)}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setForceImport((s) => {
                            const n = new Set(s)
                            if (force) n.delete(d.hash)
                            else n.add(d.hash)
                            return n
                          })
                        }
                        className={cx('rounded-full px-3 py-1.5 text-[13px] font-semibold', force ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300')}
                      >
                        {force ? 'Importar igual' : 'Es el mismo'}
                      </button>
                    </div>
                  )
                })}
              </List>
            </>
          )}

          {auto.length > 0 && (
            <>
              <SectionTitle
                action={
                  <button onClick={() => setShowAuto(!showAuto)} className="flex items-center gap-1 text-[15px] text-accent">
                    {showAuto ? 'Ocultar' : 'Ver'} <ChevronDown size={16} className={cx('transition', showAuto && 'rotate-180')} />
                  </button>
                }
              >
                Clasificados solos ({auto.length})
              </SectionTitle>
              {showAuto ? (
                <div className="space-y-2.5">
                  {auto.map((g) => (
                    <GroupCard key={g.key} g={g} data={data} value={chosen(g)} done onPick={(c) => pick(g, c)} compact />
                  ))}
                </div>
              ) : (
                <Card className="text-[15px] text-slate-500">Tocá «Ver» si querés corregir alguno. Si cambiás uno, lo aprendo.</Card>
              )}
            </>
          )}

          <div className="sticky bottom-24 z-10 mt-5">
            <Button className="w-full py-4 text-[17px] shadow-[0_8px_24px_rgba(0,122,255,0.3)]" disabled={busy || toImport === 0} onClick={run}>
              {busy ? 'Importando…' : `Importar ${toImport} movimientos`}
            </Button>
            {unclassified > 0 && <p className="mt-2 text-center text-[13px] text-slate-500">{unclassified} quedan sin categoría (podés clasificarlos después)</p>}
          </div>
        </>
      )}

      {stage === 'done' && result && (
        <Card className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white animate-pop">
            <Check size={34} strokeWidth={3} />
          </span>
          <p className="mt-3 text-[22px] font-bold">¡Listo!</p>
          <p className="mt-1 text-[15px] text-slate-500">
            {result.created} movimientos importados
            {result.merged > 0 && ` · ${result.merged} unidos con los tuyos`}
            {result.ignored > 0 && ` · ${result.ignored} ignorados`}
          </p>
          {result.sessions > 0 && <p className="text-[15px] text-slate-500">{result.sessions} sesiones de hábito sumadas desde tus gastos</p>}
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-[15px] font-semibold text-amber-700 dark:text-amber-300">
            <Sparkles size={16} /> +{num(result.created * XP.importTx + result.learned * XP.teach + XP.importDone)} pts
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="soft" onClick={() => setStage('pick')}>
              Importar otro
            </Button>
            <Button onClick={() => go('movimientos')}>Ver gastos</Button>
          </div>
        </Card>
      )}
    </div>
  )
}

function GroupCard({
  g,
  data,
  value,
  done,
  onPick,
  compact,
  hint,
  note,
  onNote,
}: {
  g: Group
  data: AppData
  value?: string
  done: boolean
  onPick: (c: string) => void
  compact?: boolean
  hint?: GroupHint
  note?: string
  onNote?: (n: string) => void
}) {
  const [open, setOpen] = useState(!compact && !done && !value)
  // Cuando llega la sugerencia de la IA, se muestra el «✓ Aceptar» en vez de la lista
  useEffect(() => {
    if (hint?.categoryId && !done) setOpen(false)
  }, [hint, done])
  const cats = data.categories.filter((c) => !c.archived && (g.income ? c.type === 'ingreso' : c.type === 'fijo' || c.type === 'variable'))
  const current = value && value !== 'ignorar' ? data.catMap.get(value) : undefined
  const refund = g.items.some((i) => i.refund)
  const sorted = useMemo(() => sortByUse(cats, data), [cats, data])
  return (
    <Card className={cx('p-3.5 transition', done && !compact && 'ring-2 ring-emerald-500/40')}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] text-lg" style={{ background: current ? `${current.color}2e` : 'var(--ios-fill)' }}>
          {value === 'ignorar' ? '🚫' : (current?.icon ?? '❓')}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{g.label}</p>
          <p className="text-[12px] text-slate-500">
            {g.items.length} {g.items.length === 1 ? 'vez' : 'veces'} · {refund ? 'te devolvieron ' : ''}
            {money0(Math.abs(g.total))}
            {current ? ` · ${current.name}` : value === 'ignorar' ? ' · ignorado' : ' · sin categoría'}
          </p>
          {hint?.reason && <p className="mt-0.5 text-[12px] text-violet-600 dark:text-violet-300">✨ {hint.reason}</p>}
        </div>
        {done && !compact && <Check size={20} className="text-emerald-500" strokeWidth={3} />}
      </button>
      {!done && !open && value && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => onPick(value)} className="flex-1 rounded-[12px] bg-accent py-2 text-[15px] font-semibold text-white active:opacity-70">
            ✓ {value === 'ignorar' ? 'Ignorar' : current?.name}
          </button>
          <button onClick={() => setOpen(true)} className="rounded-[12px] bg-ios-fill px-4 py-2 text-[15px] font-medium text-accent">
            Cambiar
          </button>
        </div>
      )}
      {onNote && (open || note) && (
        <input
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Nota para estos movimientos (opcional)"
          className="mt-3 w-full rounded-[10px] bg-ios-fill px-3 py-2 text-[15px] outline-none"
          aria-label={`Nota para ${g.label}`}
        />
      )}
      {open && (
        <div className="-mx-1 mt-3 flex flex-wrap gap-1.5">
          {sorted.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onPick(c.id)
                setOpen(false)
              }}
              className={cx('flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] transition active:scale-95', value === c.id ? 'bg-accent text-white' : 'bg-ios-fill')}
            >
              {c.icon} {c.name}
            </button>
          ))}
          <button
            onClick={() => {
              onPick('ignorar')
              setOpen(false)
            }}
            className={cx('rounded-full px-3 py-1.5 text-[13px]', value === 'ignorar' ? 'bg-slate-600 text-white' : 'bg-ios-fill text-slate-500')}
          >
            🚫 Ignorar
          </button>
        </div>
      )}
    </Card>
  )
}

/** Categorías más usadas primero */
function sortByUse(cats: Category[], data: AppData) {
  const n = new Map<string, number>()
  for (const t of data.transactions) if (t.categoryId) n.set(t.categoryId, (n.get(t.categoryId) ?? 0) + 1)
  return [...cats].sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0) || a.order - b.order)
}
