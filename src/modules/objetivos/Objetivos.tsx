import { Check, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import type { AppData } from '../../db/hooks'
import { db } from '../../db/schema'
import { fundBalance } from '../../lib/calc'
import { daysBetween, fmtDate, today } from '../../lib/dates'
import { money0, parseAmount, uid } from '../../lib/format'
import { logsByHabit, streakDays, streakWeeks } from '../../lib/habits'
import { AREAS, type Area, type Goal, type GoalStatus } from '../../types'
import { EmojiPicker } from '../../components/Pickers'
import { useToast } from '../../components/Toast'
import { Button, Card, cx, Empty, Field, Input, ProgressBar, SectionTitle, Segmented, Sheet } from '../../components/ui'

/** Progreso de un objetivo según su tipo: hucha enlazada, hábito enlazado o contador manual */
export function goalProgress(g: Goal, data: AppData) {
  if (g.linkedFundId) {
    const f = data.fundMap.get(g.linkedFundId)
    if (f?.target) return { value: fundBalance(f, data.transactions), target: f.target, label: (v: number, t: number) => `${money0(v)} de ${money0(t)}` }
  }
  if (g.linkedHabitId && g.target) {
    const h = data.habits.find((x) => x.id === g.linkedHabitId)
    if (h && g.unit?.includes('seguid')) {
      const logs = logsByHabit(data.habitLogs).get(h.id) ?? []
      const v = h.unit === 'si_no' ? streakDays(h, logs) : streakWeeks(h, logs)
      return { value: v, target: g.target, label: (v: number, t: number) => `${v} de ${t} ${g.unit}` }
    }
  }
  if (g.target) return { value: g.current ?? 0, target: g.target, label: (v: number, t: number) => `${v} de ${t} ${g.unit ?? ''}` }
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
        <Empty icon="🎯" text="Ponte un objetivo: un carnet, un idioma, una cifra ahorrada…" />
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
  const manual = !!g.target && !g.linkedFundId && !(g.linkedHabitId && g.unit?.includes('seguid'))
  const daysLeft = g.deadline ? daysBetween(today(), g.deadline) : undefined
  const isDone = g.status === 'hecho'

  const bump = async (d: number) => {
    const current = Math.max(0, (g.current ?? 0) + d)
    const reached = g.target && current >= g.target
    await db.goals.update(g.id, { current, ...(reached ? { status: 'hecho' as GoalStatus } : {}) })
    if (reached) toast({ text: `🏆 ¡Objetivo conseguido: ${g.title}!` })
  }
  const complete = async () => {
    await db.goals.update(g.id, { status: isDone ? 'activo' : 'hecho' })
    if (!isDone) toast({ text: `🏆 ¡Objetivo conseguido: ${g.title}!` })
  }

  return (
    <Card className="p-3.5">
      <div className="flex items-start gap-3">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-xl dark:bg-white/5">{g.icon}</span>
          <div className="min-w-0 flex-1">
            <p className={cx('text-sm font-medium', isDone && 'line-through opacity-70')}>{g.title}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {g.area}
              {g.deadline && ` · ${daysLeft! >= 0 ? `quedan ${daysLeft} días` : `fecha pasada (${fmtDate(g.deadline)})`}`}
            </p>
          </div>
        </button>
        {!manual || isDone ? (
          <button
            onClick={complete}
            aria-label={isDone ? 'Reabrir' : 'Marcar como conseguido'}
            className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', isDone ? 'bg-emerald-500 text-white' : 'border-2 border-dashed border-slate-300 text-slate-400 dark:border-white/15')}
          >
            <Check size={18} />
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => bump(-1)} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 dark:bg-white/5" aria-label="Restar">
              <Minus size={14} />
            </button>
            <button onClick={() => bump(1)} className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" aria-label="Sumar">
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>
      {p && (
        <div className="mt-3">
          <ProgressBar value={p.value} max={p.target} color={isDone || p.value >= p.target ? '#10b981' : '#38bdf8'} />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{p.label(Math.round(p.value * 10) / 10, p.target)}</p>
        </div>
      )}
    </Card>
  )
}

type Kind = 'hito' | 'numero' | 'hucha' | 'habito'

function GoalEditor({ data, initial, onDone }: { data: AppData; initial: Partial<Goal>; onDone: () => void }) {
  const toast = useToast()
  const initialKind: Kind = initial.linkedFundId ? 'hucha' : initial.linkedHabitId && initial.unit?.includes('seguid') ? 'habito' : initial.target ? 'numero' : 'hito'
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

  const valid = title.trim() && (kind === 'hito' || (kind === 'numero' && parseAmount(target) > 0) || (kind === 'hucha' && fundId) || (kind === 'habito' && habitId && parseAmount(target) > 0))

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
      note: initial.note,
      createdAt: initial.createdAt ?? Date.now(),
    })
    toast({ text: 'Objetivo guardado' })
    onDone()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-2xl dark:bg-white/5">{icon}</span>
        <Input placeholder="Ej. Aprobar el carnet A2" value={title} onChange={(e) => setTitle(e.target.value)} className="text-base" />
      </div>
      <Field label="Cómo se mide">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'hito', label: 'Hito' },
            { value: 'numero', label: 'Número' },
            { value: 'habito', label: 'Racha' },
            { value: 'hucha', label: 'Hucha' },
          ]}
        />
      </Field>
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
            <select value={habitId} onChange={(e) => setHabitId(e.target.value)} className="w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm dark:bg-white/5">
              <option value="">Elige…</option>
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
        <Field label="Hucha" hint="El progreso es el saldo de la hucha frente a su meta.">
          <select value={fundId} onChange={(e) => setFundId(e.target.value)} className="w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm dark:bg-white/5">
            <option value="">Elige…</option>
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
            <button key={a} type="button" onClick={() => setArea(a)} className={cx('rounded-full px-3 py-1.5 text-xs', area === a ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 dark:bg-white/10')}>
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
