import { useMemo } from 'react'
import { Area, AreaChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { go } from '../../app/router'
import { useActions } from '../../app/actions'
import { db } from '../../db/schema'
import type { AppData } from '../../db/hooks'
import { alerts, fundBalance, monthPace, monthSummary, recurringStatus, savingsPlan, type Alert } from '../../lib/calc'
import { monthKey, today } from '../../lib/dates'
import { money, money0, pct, uid } from '../../lib/format'
import { moneyScore, quitSavings, streakDays, streakWeeks, weekScore } from '../../lib/habits'
import { RING_COLORS, Rings } from '../../components/Rings'
import { useToast } from '../../components/Toast'
import { Card, CatIcon, cx, List, ProgressBar, SectionTitle } from '../../components/ui'
import { goalProgress } from '../objetivos/Objetivos'
import { currentFocus, reviewDue } from './Review'
import { ChallengeCard, TodayTasks, useGame } from './Game'
import { HabitBubbles, Hero, MonthColors } from './Visual'

export function Dashboard({ data }: { data: AppData }) {
  const { settings, transactions, categories, recurrings, funds } = data
  const key = monthKey(today())
  const m = useMemo(() => monthSummary(transactions, categories, recurrings, settings, key), [transactions, categories, recurrings, settings, key])
  const pace = useMemo(() => monthPace(transactions, categories, key), [transactions, categories, key])
  const plan = useMemo(() => savingsPlan(categories, funds, transactions, settings.monthlyIncome), [categories, funds, transactions, settings.monthlyIncome])
  const pending = useMemo(() => recurringStatus(recurrings, transactions, key).filter((r) => !r.paid), [recurrings, transactions, key])
  const score = weekScore(data.habits, data.byHabit, moneyScore(pace))
  const notes = useMemo(() => [...achievements(data, pace.noSpendDays), ...alerts(transactions, categories, recurrings, settings)], [data, pace.noSpendDays, transactions, categories, recurrings, settings])
  const savingGoal = plan.free > 0 ? plan.free : plan.needed
  const game = useGame(data)


  return (
    <div>
      <Hero data={data} pace={pace} g={game} />

      <SectionTitle action={<button onClick={() => go('habitos')} className="text-[15px] text-accent">Ver todos</button>}>Hoy</SectionTitle>
      <HabitBubbles data={data} />

      <Card onClick={() => go('habitos')} className="mt-2 flex items-center gap-5">
        <Rings
          size={104}
          rings={[
            { value: score.habitPct, color: RING_COLORS.habitos, label: 'Hábitos' },
            { value: score.money, color: RING_COLORS.gasto, label: 'Gasto' },
            { value: savingGoal > 0 ? m.saved / savingGoal : 0, color: RING_COLORS.ahorro, label: 'Ahorro' },
          ]}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <RingRow color={RING_COLORS.habitos} label="Hábitos" value={pct(score.habitPct * 100)} hint="de lo esperado a hoy" />
          <RingRow color={RING_COLORS.gasto} label="Gasto" value={pct(score.money * 100)} hint="al ritmo" />
          <RingRow color={RING_COLORS.ahorro} label="Ahorro" value={money0(m.saved)} hint={savingGoal > 0 ? `de ${money0(savingGoal)}` : 'este mes'} />
        </div>
      </Card>

      <ChallengeCard g={game} />
      <FocusCard data={data} />
      <TodayTasks data={data} />

      <SectionTitle action={<button onClick={() => go('presupuesto')} className="text-[15px] text-accent">Presupuesto</button>}>Tu mes</SectionTitle>
      <MonthColors data={data} />
      <div className="mt-3">
        <SpendCard pace={pace} />
      </div>

      {pending.length > 0 && <PendingList data={data} items={pending} />}

      <SectionTitle>Este mes</SectionTitle>
      <Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Ingresos" value={money0(m.income)} />
          <Stat label="Gastos" value={money0(m.spent)} />
          <Stat label="Ahorrado" value={money0(m.saved)} tone="text-sky-500" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Tile label="Ahorro previsto" value={money0(m.projectedSaving)} hint={`${pct(m.savingRate)} del sueldo`} tone={m.projectedSaving >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'} />
          <Tile label="Sueldo en vivienda" value={pct(m.housingPct)} hint={`Objetivo ≤ ${settings.housingTarget} %`} tone={m.housingPct <= settings.housingTarget ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'} />
        </div>
      </Card>

      {notes.length > 0 && (
        <>
          <SectionTitle>Para tener en cuenta</SectionTitle>
          <List>
            {notes.slice(0, 4).map((n, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 text-[15px] leading-snug">
                <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.tone === 'over' ? 'bg-red-500' : n.tone === 'warn' ? 'bg-amber-500' : n.tone === 'good' ? 'bg-emerald-500' : 'bg-sky-500')} />
                <span>{n.text}</span>
              </div>
            ))}
          </List>
        </>
      )}

      <SectionTitle action={<button onClick={() => go('metas')} className="text-[15px] text-accent">Ver metas</button>}>Metas</SectionTitle>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {data.goals
          .filter((g) => g.status === 'activo')
          .slice(0, 4)
          .map((g) => {
            const p = goalProgress(g, data)
            return (
              <Card key={g.id} className="w-[150px] shrink-0 snap-start" onClick={() => go('metas')}>
                <div className="text-2xl">{g.icon}</div>
                <p className="mt-1.5 line-clamp-2 min-h-[2.6em] text-[13px] font-semibold leading-tight">{g.title}</p>
                {p ? (
                  <div className="mt-2">
                    <ProgressBar value={p.value} max={p.target} color="#ff9500" thin />
                    <p className="mt-1 text-[11px] text-slate-500">{p.short}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-500">Pendiente</p>
                )}
              </Card>
            )
          })}
        {funds
          .filter((f) => !f.archived)
          .map((f) => {
            const b = fundBalance(f, transactions)
            return (
              <Card key={f.id} className="w-[150px] shrink-0 snap-start" onClick={() => go('metas', 'ahorros')}>
                <div className="text-2xl">{f.icon}</div>
                <p className="mt-1.5 truncate text-[13px] text-slate-500">{f.name}</p>
                <p className="text-[17px] font-semibold tabular-nums">{money0(b)}</p>
                {f.target ? (
                  <div className="mt-2">
                    <ProgressBar value={b} max={f.target} color={RING_COLORS.ahorro} thin />
                    <p className="mt-1 text-[11px] text-slate-500">de {money0(f.target)}</p>
                  </div>
                ) : null}
              </Card>
            )
          })}
      </div>
    </div>
  )
}

function RingRow({ color, label, value, hint }: { color: string; label: string; value: string; hint: string }) {
  return (
    <div>
      <p className="text-[13px] font-semibold" style={{ color }}>
        {label}
      </p>
      <p className="text-[17px] font-semibold leading-tight tabular-nums">
        {value} <span className="text-[12px] font-normal text-slate-500">{hint}</span>
      </p>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[12px] text-slate-500">{label}</p>
      <p className={cx('text-[17px] font-semibold tabular-nums', tone)}>{value}</p>
    </div>
  )
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="rounded-[14px] bg-ios-fill/60 p-3">
      <p className="text-[12px] text-slate-500">{label}</p>
      <p className={cx('text-[20px] font-semibold tabular-nums', tone)}>{value}</p>
      <p className="text-[11px] text-slate-500">{hint}</p>
    </div>
  )
}

/** Lo que te queda para el día a día y la curva del mes frente al ritmo ideal */
function SpendCard({ pace }: { pace: ReturnType<typeof monthPace> }) {
  const ahead = pace.vsPace >= 0
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <p className="text-[17px] font-semibold">Ritmo del mes</p>
        <p className="text-[13px] text-slate-500">
          {money0(pace.spent)} de {money0(pace.budget)}
        </p>
      </div>
      <span className={cx('mt-2 inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold', ahead ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>
        {ahead ? `${money0(pace.vsPace)} por debajo del ritmo` : `${money0(-pace.vsPace)} por encima del ritmo`}
      </span>
      <div className="mt-2 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pace.series} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34c759" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#34c759" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} stroke="#8e8e93" ticks={[1, 10, 20, pace.series.length]} />
            <Tooltip
              contentStyle={{ borderRadius: 12, fontSize: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}
              labelFormatter={(d) => `Día ${d}`}
              formatter={(v, n) => [money0(Number(v)), n === 'actual' ? 'Este mes' : n === 'ideal' ? 'Ritmo ideal' : 'Mes pasado']}
            />
            <Line type="monotone" dataKey="prev" stroke="#8e8e93" strokeOpacity={0.4} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="ideal" stroke="#8e8e93" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="actual" stroke="#34c759" strokeWidth={2.5} fill="url(#spendFill)" connectNulls={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 rounded bg-emerald-500" /> Este mes</span>
        <span className="flex items-center gap-1"><span className="h-0 w-3 border-t border-dashed border-slate-500" /> Ritmo ideal ({money0(pace.budget)})</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 rounded bg-slate-400/60" /> Mes pasado</span>
      </div>
    </Card>
  )
}

function FocusCard({ data }: { data: AppData }) {
  const { openReview } = useActions()
  const { due } = reviewDue(data)
  const focus = currentFocus(data)
  // La revisión pendiente aparece en «Para hoy»; acá solo se muestra el foco elegido
  if (due) return null
  if (!focus?.focus) return null
  return (
    <button onClick={openReview} className="mt-3 flex w-full items-center gap-3 rounded-[22px] bg-ios-card p-4 text-left active:opacity-80">
      <span className="grid h-10 w-10 place-items-center rounded-[11px] bg-violet-500 text-xl text-white">🎯</span>
      <span className="flex-1">
        <span className="block text-[12px] font-semibold uppercase tracking-wide text-violet-500">Foco de la semana</span>
        <span className="block text-[15px] font-medium">{focus.focus}</span>
      </span>
    </button>
  )
}


/** Logros: rachas, plata ahorrada por dejar algo y días sin gastos variables */
function achievements(data: AppData, noSpendDays: number): Alert[] {
  const out: Alert[] = []
  for (const h of data.habits.filter((x) => x.active)) {
    const logs = data.byHabit.get(h.id) ?? []
    if (h.unit === 'si_no') {
      const d = streakDays(h, logs)
      const q = quitSavings(h, d, data)
      const days = `${d} ${d === 1 ? 'día' : 'días'} seguidos`
      if (q && d >= 1 && q.saved >= 1) out.push({ tone: 'good', text: `${h.icon} ${h.name}: ${days}, llevás ${money0(q.saved)} sin gastar.` })
      else if (d >= 3) out.push({ tone: 'good', text: `${h.icon} ${h.name}: ${days}.` })
    } else {
      const w = streakWeeks(h, logs)
      if (w >= 2) out.push({ tone: 'good', text: `${h.icon} ${w} semanas seguidas cumpliendo ${h.name.toLowerCase()}.` })
    }
  }
  if (noSpendDays >= 3) out.push({ tone: 'good', text: `${noSpendDays} días sin gastos variables este mes.` })
  return out.slice(0, 2)
}

function PendingList({ data, items }: { data: AppData; items: ReturnType<typeof recurringStatus> }) {
  const toast = useToast()
  const now = today()
  const visible = items.filter((i) => i.due <= now).concat(items.filter((i) => i.due > now).slice(0, 3))

  const pay = async (r: (typeof items)[number]['recurring'], due: string) => {
    const id = uid()
    await db.transactions.put({
      id,
      date: due > now ? now : due,
      amount: r.amount,
      kind: r.kind,
      categoryId: r.categoryId,
      fundId: r.fundId,
      recurringId: r.id,
      note: r.name,
      paymentMethod: 'Domiciliación',
      createdAt: Date.now(),
    })
    toast({ text: `${r.name}: listo ✓`, action: { label: 'Deshacer', run: () => db.transactions.delete(id) } })
  }

  if (!visible.length) return null
  return (
    <>
      <SectionTitle action={<button onClick={() => go('fijos')} className="text-[15px] text-accent">Editar</button>}>Fijos del mes</SectionTitle>
      <List>
        {visible.map(({ recurring: r, due, overdue }) => {
          const c = data.catMap.get(r.categoryId ?? '')
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <CatIcon icon={c?.icon ?? '📌'} color={c?.color ?? '#8e8e93'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px]">{r.name}</p>
                <p className={cx('text-[12px]', overdue ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500')}>
                  {overdue ? 'Pendiente desde' : 'Vence'} el {Number(due.slice(8, 10))} · {money(r.amount)}
                </p>
              </div>
              <button onClick={() => pay(r, due)} className="rounded-full bg-ios-fill px-3.5 py-1.5 text-[13px] font-semibold text-accent active:opacity-60">
                {r.kind === 'ingreso' ? 'Cobrado' : r.kind === 'transferencia' ? 'Hecho' : 'Pagado'}
              </button>
            </div>
          )
        })}
      </List>
    </>
  )
}
