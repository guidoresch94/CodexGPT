import { Check, Flame, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AppData } from '../../db/hooks'
import { monthPace } from '../../lib/calc'
import { monthKey, today, weekDays, weekdayInitial } from '../../lib/dates'
import { money0, num } from '../../lib/format'
import { dayTotal, moneyScore, quitSavings, streakDays, streakWeeks, UNIT_LABEL, weekProgress, weekScore } from '../../lib/habits'
import type { Habit, HabitLog } from '../../types'
import { Rings } from '../../components/Rings'
import { burst, CountUp, Ring } from '../../components/Fx'
import { Card, cx, Empty, PageHeader, SectionTitle, Sheet } from '../../components/ui'
import { HabitDetail } from './HabitDetail'
import { HabitEditor } from './HabitEditor'
import { useHabitTap } from './useHabitTap'

export function Habitos({ data }: { data: AppData }) {
  const [detail, setDetail] = useState<string | null>(null)
  const [edit, setEdit] = useState<Partial<Habit> | null>(null)
  const active = data.habits.filter((h) => h.active)
  const paused = data.habits.filter((h) => !h.active)
  const pace = useMemo(() => monthPace(data.transactions, data.categories, monthKey(today())), [data.transactions, data.categories])
  const score = weekScore(data.habits, data.byHabit, moneyScore(pace))
  const metCount = active.filter((h) => weekProgress(h, data.byHabit.get(h.id) ?? []).met).length
  const habit = detail ? data.habits.find((h) => h.id === detail) : undefined

  return (
    <div>
      <PageHeader
        title="Hábitos"
        right={
          <button onClick={() => setEdit({})} className="mb-1.5 grid h-9 w-9 place-items-center rounded-full bg-accent text-white" aria-label="Nuevo hábito">
            <Plus size={20} />
          </button>
        }
      />

      <div className="relative flex items-center gap-5 overflow-hidden rounded-[28px] p-5 text-white shadow-[0_18px_40px_-12px_rgba(255,45,85,0.55)]" style={{ background: 'linear-gradient(135deg,#ff2d55 0%,#ff6b3d 55%,#ffb340 100%)' }}>
        <span className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
        <div className="relative rounded-full bg-black/10 p-1.5">
          <Rings size={92} rings={[{ value: score.habitPct, color: '#ffffff', label: 'Hábitos' }, { value: score.money, color: '#ffe066', label: 'Gasto' }]} />
        </div>
        <div className="relative min-w-0 flex-1">
          <p className="text-[48px] font-bold leading-none tabular-nums">
            <CountUp value={score.score} format={(n) => String(Math.round(n))} />
          </p>
          <p className="mt-1 text-[15px] font-semibold">Puntos de la semana</p>
          <p className="text-[13px] text-white/85">
            {metCount} de {active.length} objetivos cumplidos
          </p>
          <p className="mt-1 text-[11px] text-white/70">Blanco: hábitos (70 pts) · Amarillo: gasto al ritmo (30 pts)</p>
        </div>
      </div>

      <SectionTitle>Esta semana</SectionTitle>
      {active.length === 0 ? (
        <Empty icon="🌱" text="Creá tu primer hábito: gimnasio, leer, guitarra…" />
      ) : (
        <div className="space-y-2.5">
          {active.map((h) => (
            <HabitCard key={h.id} habit={h} logs={data.byHabit.get(h.id) ?? []} data={data} onOpen={() => setDetail(h.id)} />
          ))}
        </div>
      )}

      {paused.length > 0 && (
        <>
          <SectionTitle>En pausa</SectionTitle>
          <div className="space-y-2.5 opacity-60">
            {paused.map((h) => (
              <HabitCard key={h.id} habit={h} logs={data.byHabit.get(h.id) ?? []} data={data} onOpen={() => setDetail(h.id)} />
            ))}
          </div>
        </>
      )}

      <Sheet open={!!habit} onClose={() => setDetail(null)} title={habit ? `${habit.icon} ${habit.name}` : ''}>
        {habit && <HabitDetail habit={habit} data={data} logs={data.byHabit.get(habit.id) ?? []} onEdit={() => setEdit(habit)} />}
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
  const now = today()
  const doneToday = dayTotal(h, logs, now) > 0
  const streak = h.unit === 'si_no' ? streakDays(h, logs) : streakWeeks(h, logs)
  const quit = h.auto ? quitSavings(h, streak, data) : undefined
  const linkedCat = h.linkedCategoryId ? data.catMap.get(h.linkedCategoryId) : undefined

  const subtitle = h.auto
    ? `${streak} ${streak === 1 ? 'día' : 'días'} seguidos${quit && quit.saved >= 1 ? ` · ${money0(quit.saved)} sin gastar` : ''}`
    : `${num(p.done, Number.isInteger(p.done) ? 0 : 1)} de ${num(p.target)} ${UNIT_LABEL[h.unit]} esta semana`

  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-3">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Ring value={h.auto ? Math.min(1, streak / 30) : p.pct} size={54} stroke={5} color={h.color}>
            <span className="grid h-[40px] w-[40px] place-items-center rounded-full text-[20px]" style={{ background: `${h.color}24` }}>
              {h.icon}
            </span>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[17px] font-semibold">{h.name}</p>
              {!h.auto && streak > 0 && (
                <span className="flex shrink-0 items-center gap-0.5 text-[12px] font-semibold text-amber-500">
                  <Flame size={12} /> {streak}
                </span>
              )}
            </div>
            <p className={cx('text-[13px]', p.met && !h.auto ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-slate-500')}>
              {subtitle}
              {!h.auto && p.met && ' ✓'}
            </p>
            {linkedCat && !h.auto && <p className="text-[12px] text-slate-400">Se suma solo con gastos en {linkedCat.icon} {linkedCat.name}</p>}
          </div>
        </button>
        <button
          onClick={(e) => {
            if (!(doneToday && (h.unit === 'si_no' || h.auto))) burst(e.clientX, e.clientY, h.color)
            tap(h)
          }}
          aria-label={h.auto ? (doneToday ? `Anotar recaída en ${h.name}` : `Quitar recaída de ${h.name}`) : `Registrar ${h.name}`}
          className={cx(
            'grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-90',
            doneToday && (h.unit === 'si_no' || h.auto) ? 'text-white' : 'bg-ios-fill text-accent',
          )}
          style={doneToday && (h.unit === 'si_no' || h.auto) ? { background: h.color } : undefined}
        >
          {h.unit === 'si_no' || h.auto ? <Check size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={2.5} />}
        </button>
      </div>
      <div className="mt-3 flex gap-1.5">
        {weekDays().map((d) => {
          const v = dayTotal(h, logs, d)
          const future = d > now
          return (
            <div key={d} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={cx('h-1.5 w-full rounded-full', v > 0 ? '' : future ? 'bg-ios-fill/50' : 'bg-ios-fill')}
                style={v > 0 ? { background: h.color } : undefined}
              />
              <span className={cx('text-[10px]', d === now ? 'font-bold text-slate-950 dark:text-white' : 'text-slate-400')}>{weekdayInitial(d)}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
