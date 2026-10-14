import { Check, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import type { AppData } from '../../db/hooks'
import { db } from '../../db/schema'
import { fundBalance } from '../../lib/calc'
import { daysBetween, fmtDate, today } from '../../lib/dates'
import { money0, parseAmount, uid } from '../../lib/format'
import { quitSavings, streakDays, streakWeeks } from '../../lib/habits'
import { AREAS, type Area, type Goal, type GoalStatus } from '../../types'
import { EmojiPicker } from '../../components/Pickers'
import { useToast } from '../../components/Toast'
import { Button, Card, cx, Empty, Field, Input, ProgressBar, SectionTitle, Segmented, Sheet } from '../../components/ui'

/** Progreso de un objetivo según su tipo: pasos, ahorro enlazado, racha de hábito o contador manual */
export function goalProgress(g: Goal, data: AppData) {
  type P = { value: number; target: number; label: string; short: string; extra?: string }
  if (g.steps?.length) {
    const done = g.steps.filter((s) => s.done).length
    const next = g.steps.find((s) => !s.done)
    return { value: done, target: g.steps.length, label: next ? `Siguiente: ${next.text}` : 'Todos los pasos hechos', short: `${done} de ${g.steps.length} pasos` } as P
  }
  if (g.linkedFundId) {
    const f = data.fundMap.get(g.linkedFundId)
    if (f?.target) {
      const v = fundBalance(f, data.transactions)
      return { value: v, target: f.target, label: `${money0(v)} de ${money0(f.target)}`, short: `${Math.round((v / f.target) * 100)} %` } as P
    }
  }
  if (g.linkedHabitId && g.target) {
    const h = data.habits.find((x) => x.id === g.linkedHabitId)
    if (h && g.unit?.includes('seguid')) {
      const logs = data.byHabit.get(h.id) ?? []
      const v = h.unit === 'si_no' ? streakDays(h, logs) : streakWeeks(h, logs)
      const q = quitSavings(h, v, data)
      return {
        value: v,
        target: g.target,
        label: `${v} de ${g.target} ${g.unit}`,
        short: `${v}/${g.target} ${h.unit === 'si_no' ? 'días' : 'sem.'}`,
        extra: q && q.saved >= 1 ? `${money0(q.saved)} sin gastar · ${money0(q.yearly)} al año` : undefined,
      } as P
    }
  }
  if (g.target) {
    const v = g.current ?? 0
    return { value: v, target: g.target, label: `${v} de ${g.target} ${g.unit ?? ''}`, short: `${v}/${g.target} ${g.unit ?? ''}` } as P
  }
  return undefined
}

export function Objetivos({ data }: { data: AppData }) {
  const [edit, setEdit] = useState<Partial<Goal> | null>(null)
  const active = data.goals.filter((g) => g.status === 'activo')
  const done = data.goals.filter((g) => g.status === 'hecho')
  const paused = data.goals.filter((g) => g.status === 'pausado')

  return (
    <div>
      <div className="flex justify-end">
        <Button className="flex items-center gap-1 py-2" onClick={() => setEdit({})}>
          <Plus size={16} /> Objetivo
        </Button>
      </div>
      {active.length === 0 ? (
        <Empty icon="🎯" text="Ponete un objetivo: un carnet, un idioma, una cifra ahorrada…" />
      ) : (
        <div className="mt-3 space-y-3">
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} data={data} onOpen={() => setEdit(g)} />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <>
          <SectionTitle>Conseguidos 🏆</SectionTitle>
          <div className="space-y-3">
            {done.map((g) => (
              <GoalCard key={g.id} goal={g} data={data} onOpen={() => setEdit(g)} />
            ))}
          </div>
        </>
      )}
      {paused.length > 0 && (
        <>
          <SectionTitle>En pausa</SectionTitle>
          <div className="space-y-3 opacity-60">
            {paused.map((g) => (
              <GoalCard key={g.id} goal={g} data={data} onOpen={() => setEdit(g)} />
            ))}
          </div>
        </>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar objetivo' : 'Nuevo objetivo'}>
        {edit && <GoalEditor key={edit.id ?? 'new'} data={data} initial={edit} onDone={() => setEdit(null)} />}
      </Sheet>
    </div>
  )
}

function GoalCard({ goal: g, data, onOpen }: { goal: Goal; data: AppData; onOpen: () => void }) {
  const toast = useToast()
  const p = goalProgress(g, data)
  const hasSteps = !!g.steps?.length
  const manual = !hasSteps && !!g.target && !g.linkedFundId && !(g.linkedHabitId && g.unit?.includes('seguid'))
  const daysLeft = g.deadline ? daysBetween(today(), g.deadline) : undefined
  const isDone = g.status === 'hecho'

  const celebrate = () => toast({ text: `🏆 ¡Lo lograste: ${g.title}!` })
  const bump = async (d: number) => {
    const current = Math.max(0, (g.current ?? 0) + d)
    const reached = g.target && current >= g.target
    await db.goals.update(g.id, { current, ...(reached ? { status: 'hecho' as GoalStatus } : {}) })
    if (reached) celebrate()
  }
  const complete = async () => {
    await db.goals.update(g.id, { status: isDone ? 'activo' : 'hecho' })
    if (!isDone) celebrate()
  }
  const toggleStep = async (id: string) => {
    const steps = (g.steps ?? []).map((s) => (s.id === id ? { ...s, done: !s.done } : s))
    const all = steps.every((s) => s.done)
    await db.goals.update(g.id, { steps, ...(all ? { status: 'hecho' as GoalStatus } : {}) })
    if (all) celebrate()
  }

  return (
    <Card className="p-0">
      <div className="flex items-start gap-3 p-4 pb-3">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-ios-fill text-[22px]">{g.icon}</span>
          <div className="min-w-0 flex-1">
            <p className={cx('text-[17px] font-semibold leading-snug', isDone && 'text-slate-500 line-through')}>{g.title}</p>
            <p className="text-[13px] text-slate-500">
              {g.area}
              {g.deadline && ` · ${daysLeft! >= 0 ? `faltan ${daysLeft} días` : `venció el ${fmtDate(g.deadline)}`}`}
            </p>
          </div>
        </button>
        {manual && !isDone ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={() => bump(-1)} className="grid h-8 w-8 place-items-center rounded-full bg-ios-fill" aria-label="Restar">
              <Minus size={15} />
            </button>
            <button onClick={() => bump(1)} className="grid h-8 w-8 place-items-center rounded-full bg-accent text-white" aria-label="Sumar">
              <Plus size={15} />
            </button>
          </div>
        ) : !hasSteps ? (
          <button
            onClick={complete}
            aria-label={isDone ? 'Reabrir' : 'Marcar como logrado'}
            className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full transition', isDone ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 text-transparent dark:border-slate-600')}
          >
            <Check size={16} strokeWidth={3} />
          </button>
        ) : null}
      </div>
      {p && (
        <div className="px-4 pb-4">
          <ProgressBar value={p.value} max={p.target} color={isDone || p.value >= p.target ? '#34c759' : '#ff9500'} />
          <p className="mt-1.5 text-[13px] text-slate-500">{p.label}</p>
          {p.extra && <p className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400">{p.extra}</p>}
        </div>
      )}
      {hasSteps && (
        <div className="border-t border-ios-sep">
          {g.steps!.map((st) => (
            <button key={st.id} onClick={() => toggleStep(st.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-ios-fill">
              <span className={cx('grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full transition', st.done ? 'bg-emerald-500 text-white' : 'border-[1.5px] border-slate-300 dark:border-slate-600')}>
                {st.done && <Check size={13} strokeWidth={3.5} />}
              </span>
              <span className={cx('text-[15px]', st.done && 'text-slate-500 line-through')}>{st.text}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

type Kind = 'hito' | 'pasos' | 'numero' | 'hucha' | 'habito'

function GoalEditor({ data, initial, onDone }: { data: AppData; initial: Partial<Goal>; onDone: () => void }) {
  const toast = useToast()
  const initialKind: Kind = initial.steps?.length ? 'pasos' : initial.linkedFundId ? 'hucha' : initial.linkedHabitId && initial.unit?.includes('seguid') ? 'habito' : initial.target ? 'numero' : 'hito'
  const [kind, setKind] = useState<Kind>(initialKind)
  const [title, setTitle] = useState(initial.title ?? '')
  const [icon, setIcon] = useState(initial.icon ?? '🎯')
  const [area, setArea] = useState<Area>(initial.area ?? 'Aprendizaje')
  const [target, setTarget] = useState(initial.target ? String(initial.target) : '')
  const [current, setCurrent] = useState(initial.current ? String(initial.current) : '')
  const [unit, setUnit] = useState(initial.unit ?? '')
  const [deadline, setDeadline] = useState(initial.deadline ?? '')
  const [fundId, setFundId] = useState(initial.linkedFundId ?? '')
  const [habitId, setHabitId] = useState(initial.linkedHabitId ?? '')
  const [status, setStatus] = useState<GoalStatus>(initial.status ?? 'activo')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [steps, setSteps] = useState(initial.steps ?? [])
  const [newStep, setNewStep] = useState('')
  const addStep = () => {
    if (!newStep.trim()) return
    setSteps([...steps, { id: uid(), text: newStep.trim(), done: false }])
    setNewStep('')
  }

  const valid = title.trim() && (kind === 'hito' || (kind === 'pasos' && steps.length > 0) || (kind === 'numero' && parseAmount(target) > 0) || (kind === 'hucha' && fundId) || (kind === 'habito' && habitId && parseAmount(target) > 0))

  const save = async () => {
    if (!valid) return
    const h = data.habits.find((x) => x.id === habitId)
    await db.goals.put({
      id: initial.id ?? uid(),
      title: title.trim(),
      icon,
      area,
      status,
      deadline: deadline || undefined,
      target: kind === 'numero' || kind === 'habito' ? parseAmount(target) : undefined,
      current: kind === 'numero' ? parseAmount(current) : undefined,
      unit: kind === 'numero' ? unit.trim() || undefined : kind === 'habito' ? (h?.unit === 'si_no' ? 'días seguidos' : 'semanas seguidas') : undefined,
      linkedFundId: kind === 'hucha' ? fundId : undefined,
      linkedHabitId: kind === 'habito' ? habitId : undefined,
      steps: kind === 'pasos' ? steps : undefined,
      note: initial.note,
      createdAt: initial.createdAt ?? Date.now(),
    })
    toast({ text: 'Objetivo guardado' })
    onDone()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ios-fill text-2xl">{icon}</span>
        <Input placeholder="Ej. Aprobar el carnet A2" value={title} onChange={(e) => setTitle(e.target.value)} className="text-base" />
      </div>
      <Field label="Cómo se mide">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'hito', label: 'Hito' },
            { value: 'pasos', label: 'Pasos' },
            { value: 'numero', label: 'Número' },
            { value: 'habito', label: 'Racha' },
            { value: 'hucha', label: 'Ahorro' },
          ]}
        />
      </Field>
      {kind === 'pasos' && (
        <div className="overflow-hidden rounded-[14px] bg-ios-card">
          {steps.map((st, i) => (
            <div key={st.id} className="flex items-center gap-2 border-b border-ios-sep px-3 py-2.5 text-[15px]">
              <span className="w-5 text-[13px] text-slate-400">{i + 1}</span>
              <span className={cx('flex-1', st.done && 'text-slate-500 line-through')}>{st.text}</span>
              <button onClick={() => setSteps(steps.filter((x) => x.id !== st.id))} className="text-[13px] text-red-500" aria-label={`Quitar ${st.text}`}>
                Quitar
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 px-3 py-2">
            <input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addStep()}
              placeholder="Agregar paso…"
              className="flex-1 bg-transparent py-1 text-[15px] outline-none"
            />
            <button onClick={addStep} className="text-[15px] font-semibold text-accent" disabled={!newStep.trim()}>
              Agregar
            </button>
          </div>
        </div>
      )}
      {kind === 'numero' && (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Llevo">
            <Input inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Meta">
            <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="12" />
          </Field>
          <Field label="Unidad">
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="libros" />
          </Field>
        </div>
      )}
      {kind === 'habito' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Hábito">
            <select value={habitId} onChange={(e) => setHabitId(e.target.value)} className="w-full rounded-xl bg-ios-fill px-3 py-2.5 text-sm">
              <option value="">Elegí…</option>
              {data.habits.map((h) => (
                <option key={h.id} value={h.id}>{h.icon} {h.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Racha objetivo">
            <Input inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="30" />
          </Field>
        </div>
      )}
      {kind === 'hucha' && (
        <Field label="Ahorro" hint="El progreso es el saldo de ese ahorro frente a su meta.">
          <select value={fundId} onChange={(e) => setFundId(e.target.value)} className="w-full rounded-xl bg-ios-fill px-3 py-2.5 text-sm">
            <option value="">Elegí…</option>
            {data.funds.filter((f) => f.target).map((f) => (
              <option key={f.id} value={f.id}>{f.icon} {f.name}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Fecha límite (opcional)">
        <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="dark:[color-scheme:dark]" />
      </Field>
      <Field label="Área">
        <div className="flex flex-wrap gap-2">
          {AREAS.map((a) => (
            <button key={a} type="button" onClick={() => setArea(a)} className={cx('rounded-full px-3 py-1.5 text-xs', area === a ? 'bg-accent text-white' : 'bg-ios-fill')}>
              {a}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Icono">
        <EmojiPicker value={icon} onChange={setIcon} />
      </Field>
      {initial.id && (
        <Field label="Estado">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'activo', label: 'Activo' },
              { value: 'hecho', label: 'Conseguido' },
              { value: 'pausado', label: 'En pausa' },
            ]}
          />
        </Field>
      )}
      <Button className="w-full" disabled={!valid} onClick={save}>Guardar</Button>
      {initial.id &&
        (confirmDelete ? (
          <div className="flex gap-2">
            <Button variant="soft" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button
              variant="danger"
              className="flex-1 font-semibold"
              onClick={async () => {
                await db.goals.delete(initial.id!)
                onDone()
              }}
            >
              Sí, borrar
            </Button>
          </div>
        ) : (
          <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>Borrar objetivo</Button>
        ))}
    </div>
  )
}
