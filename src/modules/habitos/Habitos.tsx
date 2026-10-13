import { Check, Flame, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AppData } from '../../db/hooks'
import { monthPace } from '../../lib/calc'
import { monthKey, today, weekDays, weekdayInitial } from '../../lib/dates'
import { dayTotal, logsByHabit, moneyScore, streakDays, streakWeeks, UNIT_LABEL, weekProgress, weekScore } from '../../lib/habits'
import type { Habit, HabitLog } from '../../types'
import { Button, Card, cx, Empty, PageHeader, SectionTitle, Sheet } from '../../components/ui'
import { HabitDetail } from './HabitDetail'
import { HabitEditor } from './HabitEditor'
import { ScoreRing } from './ScoreRing'
import { useHabitTap } from './useHabitTap'

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))

export function Habitos({ data }: { data: AppData }) {
  const [detail, setDetail] = useState<string | null>(null)
  const [edit, setEdit] = useState<Partial<Habit> | null>(null)
  const byH = useMemo(() => logsByHabit(data.habitLogs), [data.habitLogs])
  const active = data.habits.filter((h) => h.active)
  const paused = data.habits.filter((h) => !h.active)
  const pace = useMemo(() => monthPace(data.transactions, data.categories, monthKey(today())), [data.transactions, data.categories])
  const score = weekScore(data.habits, data.habitLogs, moneyScore(pace))
  const habit = detail ? data.habits.find((h) => h.id === detail) : undefined

  return (
    <div>
      <PageHeader title="Hábitos" right={<Button className="flex items-center gap-1 py-2" onClick={() => setEdit({})}><Plus size={16} /> Nuevo</Button>} />

      <Card className="flex items-center gap-4">
        <ScoreRing value={score.score} />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">Puntuación de la semana</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Hábitos {Math.round(score.habitPct * 100)} % <span className="opacity-60">(70 pts)</span> · Dinero {Math.round(score.money * 100)} %{' '}
            <span className="opacity-60">(30 pts)</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Se reinicia cada lunes. Cumple tus objetivos semanales y gasta al ritmo del presupuesto.</p>
        </div>
      </Card>

      <SectionTitle>Esta semana</SectionTitle>
      {active.length === 0 ? (
        <Empty icon="🌱" text="Crea tu primer hábito: gimnasio, leer, guitarra…" />
      ) : (
        <div className="space-y-3">
          {active.map((h) => (
            <HabitCard key={h.id} habit={h} logs={byH.get(h.id) ?? []} data={data} onOpen={() => setDetail(h.id)} />
          ))}
        </div>
      )}

      {paused.length > 0 && (
        <>
          <SectionTitle>En pausa</SectionTitle>
          <div className="space-y-3 opacity-60">
            {paused.map((h) => (
              <HabitCard key={h.id} habit={h} logs={byH.get(h.id) ?? []} data={data} onOpen={() => setDetail(h.id)} />
            ))}
          </div>
        </>
      )}

      <Sheet open={!!habit} onClose={() => setDetail(null)} title={habit ? `${habit.icon} ${habit.name}` : ''}>
        {habit && <HabitDetail habit={habit} data={data} logs={byH.get(habit.id) ?? []} onEdit={() => setEdit(habit)} />}
      </Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar hábito' : 'Nuevo hábito'}>
        {edit && (
          <HabitEditor
            key={edit.id ?? 'new'}
            data={data}
            initial={edit}
            onDone={(deleted) => {
              setEdit(null)
              if (deleted) setDetail(null)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

export function HabitCard({ habit: h, logs, data, onOpen }: { habit: Habit; logs: HabitLog[]; data: AppData; onOpen: () => void }) {
  const tap = useHabitTap(data)
  const p = weekProgress(h, logs)
  const streak = h.unit === 'si_no' ? streakDays(h, logs) : streakWeeks(h, logs)
  const now = today()
  const doneToday = dayTotal(h, logs, now) > 0
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-3">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl" style={{ background: `${h.color}26` }}>
            {h.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">{h.name}</p>
              {streak > 0 && (
                <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-orange-500">
                  <Flame size={12} /> {streak} {h.unit === 'si_no' ? 'd' : 'sem'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              <b className={cx('tabular-nums', p.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200')}>{fmtNum(p.done)}</b> /{' '}
              {fmtNum(p.target)} {UNIT_LABEL[h.unit]} esta semana {p.met && '· ¡cumplido!'}
            </p>
            <div className="mt-1.5 flex gap-1">
              {weekDays().map((d) => {
                const v = dayTotal(h, logs, d)
                return (
                  <span
                    key={d}
                    title={d}
                    className={cx('grid h-5 flex-1 place-items-center rounded-md text-[9px] font-medium', v > 0 ? 'text-white' : d > now ? 'bg-slate-100 text-slate-300 dark:bg-white/[0.03] dark:text-slate-600' : 'bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-slate-500', d === now && 'ring-1 ring-slate-400 dark:ring-slate-400')}
                    style={v > 0 ? { background: h.color } : undefined}
                  >
                    {weekdayInitial(d)}
                  </span>
                )
              })}
            </div>
          </div>
        </button>
        <button
          onClick={() => tap(h)}
          aria-label={`Registrar ${h.name}`}
          className={cx(
            'grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-bold transition active:scale-90',
            doneToday && h.unit === 'si_no' ? 'text-white' : 'border-2 border-dashed border-slate-300 text-slate-400 dark:border-white/15',
          )}
          style={doneToday && h.unit === 'si_no' ? { background: h.color } : undefined}
        >
          {h.unit === 'si_no' ? <Check size={20} strokeWidth={3} /> : <Plus size={20} />}
        </button>
      </div>
    </Card>
  )
}
