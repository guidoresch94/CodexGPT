import { ArrowLeft, Camera, Check, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { go } from '../../app/router'
import type { AppData } from '../../db/hooks'
import { db } from '../../db/schema'
import { saveDrafts } from '../../db/importTx'
import { aiErrorText, aiParseMovements, getAI, type Draft, type SampleFn } from '../../lib/ai'
import { daysBetween, fmtDayShort } from '../../lib/dates'
import { money, parseAmount } from '../../lib/format'
import { XP } from '../../lib/game'
import { habitsForCategory, linkModeOf } from '../../lib/habits'
import { useToast } from '../../components/Toast'
import { Button, Card, cx, PageHeader, SectionTitle } from '../../components/ui'

const EXAMPLES = ['ayer 12 € pádel con Tomás y 25 de súper en el Lidl', 'me pasaron 8 € por Bizum de las birras del viernes', 'café 2,30 y croissant 1,80 hoy en Granier', 'cobré 65,80 de una devolución de Iglesias Farré']

interface Row extends Draft {
  include: boolean
  dup?: string
}

export function Asistente({ data }: { data: AppData }) {
  const toast = useToast()
  const [ai, setAi] = useState<SampleFn | null | undefined>(undefined)
  const [canImages, setCanImages] = useState(false)
  const [text, setText] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pickFor, setPickFor] = useState<number | null>(null)
  const ctl = useRef<AbortController | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    getAI().then(async (s) => {
      if (!alive) return
      // La IA es una función: hay que envolverla para que React no la ejecute como actualizador
      setAi(() => s)
      const lim = await s?.limits().catch(() => null)
      if (alive) setCanImages(!!lim?.images)
    })
    return () => {
      alive = false
    }
  }, [])

  const manual = useMemo(() => data.transactions.filter((t) => !t.sample), [data.transactions])

  const run = async () => {
    if (!ai || (!text.trim() && !images.length)) return
    setBusy(true)
    setError('')
    ctl.current = new AbortController()
    try {
      const drafts = await aiParseMovements(ai, text, images, data, ctl.current.signal)
      if (!drafts.length) setError('No encontré ningún importe. Probá escribiendo «12 € pádel ayer».')
      setRows(
        drafts.map((d) => {
          const dup = manual.find((t) => Math.abs(t.amount - d.amount) <= Math.max(0.05, d.amount * 0.01) && Math.abs(daysBetween(t.date, d.date)) <= 2)
          return { ...d, include: !dup, dup: dup ? (dup.note ?? data.catMap.get(dup.categoryId ?? '')?.name ?? 'un gasto') : undefined }
        }),
      )
    } catch (e) {
      console.warn('IA: no se pudo entender el texto', e)
      setError(aiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r && r.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  const save = async () => {
    if (!rows) return
    const chosen = rows.filter((r) => r.include)
    const res = await saveDrafts(chosen, data)
    toast({
      text: `${res.created} guardados${res.sessions ? ` · ${res.sessions} sesiones de hábito` : ''} · +${res.created * XP.manualTx} pts`,
      action: {
        label: 'Deshacer',
        run: async () => {
          await db.transactions.bulkDelete(res.ids)
          const logs = await db.habitLogs.filter((l) => !!l.txId && res.ids.includes(l.txId)).toArray()
          await db.habitLogs.bulkDelete(logs.map((l) => l.id))
        },
      },
    })
    setRows(null)
    setText('')
    setImages([])
  }

  const included = rows?.filter((r) => r.include) ?? []
  const total = included.reduce((s, r) => s + (r.kind === 'ingreso' || r.refund ? -r.amount : r.amount), 0)

  return (
    <div>
      <button onClick={() => go('movimientos')} className="flex items-center gap-1 pt-2 text-[17px] text-accent">
        <ArrowLeft size={20} /> Gastos
      </button>
      <PageHeader title="Cargar con IA" />

      {ai === null && (
        <Card className="text-[15px] text-slate-500">La IA funciona cuando abrís la app desde Claude (el enlace del artefacto). Acá podés seguir cargando a mano o importando el Excel.</Card>
      )}

      {ai !== null && !rows && (
        <>
          <Card className="p-0">
            <textarea
              id="ai-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={(e) => {
                // Una captura o foto copiada: se pega como imagen para la IA
                const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
                if (imgs.length && canImages) {
                  e.preventDefault()
                  setImages((prev) => [...prev, ...imgs].slice(0, 4))
                }
              }}
              rows={6}
              placeholder="Escribí o pegá lo que quieras: notas, mensajes, filas de un Excel… Ej.: «ayer 12 € pádel con Tomás, 25 súper Lidl, me devolvieron 8 de las birras»"
              className="w-full resize-none rounded-t-[22px] bg-transparent p-4 text-[17px] leading-snug outline-none placeholder:text-slate-400"
            />
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {images.map((f, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-full bg-ios-fill py-1 pl-3 pr-1.5 text-[13px]">
                    📷 {(f.name || 'captura').slice(0, 18)}
                    <button onClick={() => setImages(images.filter((_, j) => j !== i))} aria-label="Quitar foto" className="rounded-full p-0.5">
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-ios-sep p-3">
              {canImages && (
                <>
                  <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-full bg-ios-fill px-3.5 py-2 text-[15px] font-medium text-accent">
                    <Camera size={17} /> Foto
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => setImages([...images, ...Array.from(e.target.files ?? [])].slice(0, 4))} />
                </>
              )}
              {canImages && <span className="text-[12px] leading-tight text-slate-400">o pegá una captura</span>}
              <div className="flex-1" />
              {busy ? (
                <Button variant="soft" onClick={() => ctl.current?.abort()}>
                  Parar
                </Button>
              ) : (
                <Button className="flex items-center gap-1.5" disabled={!text.trim() && !images.length} onClick={run}>
                  <Sparkles size={17} /> Entender
                </Button>
              )}
            </div>
          </Card>
          {busy && (
            <p className="mt-3 flex items-center justify-center gap-2 text-[15px] text-slate-500">
              <Sparkles size={16} className="animate-pulse text-violet-500" /> Leyendo y clasificando…
            </p>
          )}
          {error && <p className="mt-3 px-2 text-center text-[15px] text-red-500">{error}</p>}

          <SectionTitle>Probá con algo así</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => setText(e)} className="rounded-full bg-ios-card px-3.5 py-2 text-left text-[13px] active:opacity-70">
                {e}
              </button>
            ))}
          </div>
          <p className="mt-4 px-2 text-[13px] text-slate-500">
            Usa Claude con tu cuenta. Siempre te muestro lo que entendí para que lo revises antes de guardar. ¿Tenés el Excel del banco?{' '}
            <button onClick={() => go('importar')} className="text-accent">
              Importalo acá
            </button>
            .
          </p>
        </>
      )}

      {rows && (
        <>
          <Card>
            <p className="text-[13px] text-slate-500">Esto es lo que entendí</p>
            <p className="text-[22px] font-bold">
              {included.length} {included.length === 1 ? 'movimiento' : 'movimientos'} · {money(Math.abs(total))}
            </p>
            <p className="text-[13px] text-slate-500">Tocá la categoría para cambiarla. Lo que no quieras, desmarcalo.</p>
          </Card>
          <div className="mt-3 space-y-2.5">
            {rows.map((r, i) => {
              const c = data.catMap.get(r.categoryId ?? '')
              const habits = r.kind === 'gasto' && !r.refund ? habitsForCategory(r.categoryId, data.habits, data.catMap).filter((h) => linkModeOf(h) === 'suma' && !h.auto) : []
              const breaks = r.kind === 'gasto' && !r.refund ? habitsForCategory(r.categoryId, data.habits, data.catMap).filter((h) => linkModeOf(h) === 'rompe') : []
              return (
                <Card key={i} className={cx('p-3.5', !r.include && 'opacity-50')}>
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => update(i, { include: !r.include })}
                      aria-label={r.include ? 'No guardar' : 'Guardar'}
                      className={cx('mt-1 grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full', r.include ? 'bg-accent text-white' : 'border-[1.5px] border-slate-300')}
                    >
                      {r.include && <Check size={14} strokeWidth={3.5} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <input
                        value={r.note}
                        onChange={(e) => update(i, { note: e.target.value })}
                        placeholder="Nota"
                        className="w-full bg-transparent text-[17px] font-semibold outline-none"
                        aria-label="Nota"
                      />
                      <p className="text-[13px] text-slate-500 first-letter:uppercase">
                        {fmtDayShort(r.date)}
                        {r.refund ? ' · te devolvieron' : r.kind === 'ingreso' ? ' · ingreso' : ''}
                      </p>
                    </div>
                    <input
                      inputMode="decimal"
                      value={String(r.amount).replace('.', ',')}
                      onChange={(e) => update(i, { amount: parseAmount(e.target.value) })}
                      className={cx('w-24 rounded-[10px] bg-ios-fill px-2 py-1.5 text-right text-[17px] font-semibold tabular-nums outline-none', (r.kind === 'ingreso' || r.refund) && 'text-emerald-600')}
                      aria-label="Importe"
                    />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-9">
                    <button
                      onClick={() => setPickFor(pickFor === i ? null : i)}
                      className={cx('rounded-full px-3 py-1.5 text-[13px] font-medium', c ? 'bg-ios-fill' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}
                    >
                      {c ? `${c.icon} ${c.name}` : '🏷️ Elegí categoría'}
                    </button>
                    {r.confidence > 0 && r.confidence < 0.6 && c && <span className="text-[12px] text-amber-600">¿Seguro?</span>}
                    {habits.map((h) => (
                      <span key={h.id} className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[12px] text-emerald-700 dark:text-emerald-300">
                        {h.icon} +1 {h.name}
                      </span>
                    ))}
                    {breaks.map((h) => (
                      <span key={h.id} className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[12px] text-amber-700 dark:text-amber-300">
                        {h.icon} corta tu racha
                      </span>
                    ))}
                    {r.dup && <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[12px] text-sky-700 dark:text-sky-300">¿Ya cargado? ({r.dup})</span>}
                  </div>
                  {pickFor === i && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 pl-9">
                      {data.categories
                        .filter((x) => !x.archived && (r.kind === 'ingreso' ? x.type === 'ingreso' : x.type === 'fijo' || x.type === 'variable'))
                        .map((x) => (
                          <button
                            key={x.id}
                            onClick={() => {
                              update(i, { categoryId: x.id, confidence: 1 })
                              setPickFor(null)
                            }}
                            className={cx('rounded-full px-3 py-1.5 text-[13px]', x.id === r.categoryId ? 'bg-accent text-white' : 'bg-ios-fill')}
                          >
                            {x.icon} {x.name}
                          </button>
                        ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
          <div className="sticky bottom-24 z-10 mt-5 flex gap-2">
            <Button variant="soft" className="flex items-center gap-1" onClick={() => setRows(null)}>
              <Trash2 size={16} /> Descartar
            </Button>
            <Button className="flex-1 py-4 text-[17px] shadow-[0_8px_24px_rgba(0,122,255,0.3)]" disabled={!included.length} onClick={save}>
              Guardar {included.length}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
