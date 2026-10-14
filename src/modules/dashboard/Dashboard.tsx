import { Check, ChevronRight, Settings as Gear } from 'lucide-react'
import { useMemo } from 'react'
import { Area, AreaChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { go } from '../../app/router'
import { useActions } from '../../app/actions'
import { db } from '../../db/schema'
import type { AppData } from '../../db/hooks'
import { alerts, fundBalance, monthPace, monthSummary, recurringStatus, savingsPlan, type Alert } from '../../lib/calc'
import { fmtDayLong, monthKey, today } from '../../lib/dates'
import { money, money0, pct, uid } from '../../lib/format'
import { dayTotal, moneyScore, quitSavings, streakDays, streakWeeks, UNIT_LABEL, weekProgress, weekScore } from '../../lib/habits'
import { RING_COLORS, Rings } from '../../components/Rings'
import { useToast } from '../../components/Toast'
import { Card, CatIcon, cx, List, PageHeader, ProgressBar, SectionTitle } from '../../components/ui'
import { useHabitTap } from '../habitos/useHabitTap'
import { goalProgress } from '../objetivos/Objetivos'
import { currentFocus, reviewDue } from './Review'

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


  return (
    <div>
      <PageHeader
        subtitle={fmtDayLong(today())}
        title={`Hola, ${settings.name}`}
        right={
          <button onClick={() => go('ajustes')} className="mb-1.5 grid h-9 w-9 place-items-center rounded-full bg-ios-card text-slate-500" aria-label="Ajustes">
            <Gear size={19} />
          </button>
        }
      />

      <Card onClick={() => go('habitos')} className="flex items-center gap-5">
        <Rings
          size={112}
          rings={[
            { value: score.habitPct, color: RING_COLORS.habitos, label: 'Hábitos' },
            { value: score.money, color: RING_COLORS.gasto, label: 'Gasto' },
            { value: savingGoal > 0 ? m.saved / savingGoal : 0, color: RING_COLORS.ahorro, label: 'Ahorro' },
          ]}
        />
        <div className="min-w-0 flex-1 space-y-2.5">
          <RingRow color={RING_COLORS.habitos} label="Hábitos" value={pct(score.habitPct * 100)} hint="de lo esperado a hoy" />
          <RingRow color={RING_COLORS.gasto} label="Gasto" value={pct(score.money * 100)} hint="al ritmo del presupuesto" />
          <RingRow color={RING_COLORS.ahorro} label="Ahorro" value={money0(m.saved)} hint={savingGoal > 0 ? `de ${money0(savingGoal)} este mes` : 'este mes'} />
        </div>
      </Card>

      <FocusCard data={data} />

      <SectionTitle action={<button onClick={() => go('presupuesto')} className="text-[15px] text-accent">Presupuesto</button>}>Para el día a día</SectionTitle>
      <SpendCard pace={pace} />

      <SectionTitle action={<button onClick={() => go('habitos')} className="text-[15px] text-accent">Ver todos</button>}>Hábitos de hoy</SectionTitle>
      <TodayHabits data={data} />

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
  const { openTx } = useActions()
  const over = pace.remaining < 0
  const ahead = pace.vsPace >= 0
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cx('text-[34px] font-bold leading-none tracking-tight tabular-nums', over && 'text-red-500')}>{money(pace.remaining)}</p>
          <p className="mt-1.5 text-[15px] text-slate-500">
            {over ? 'Te pasaste del presupuesto variable' : (
              <>
                Podés gastar <b className="font-semibold text-slate-950 tabular-nums dark:text-white">{money(pace.perDayAllowed)}</b> por día · {pace.daysLeft} {pace.daysLeft === 1 ? 'día' : 'días'}
              </>
            )}
          </p>
        </div>
        <button onClick={() => openTx()} className="shrink-0 rounded-full bg-accent px-4 py-2 text-[15px] font-semibold text-white active:opacity-70">
          Gasto
        </button>
      </div>
      <span className={cx('mt-3 inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold', ahead ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>
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
  if (due)
    return (
      <button onClick={openReview} className="mt-3 flex w-full items-center gap-3 rounded-[22px] bg-ios-card p-4 text-left active:opacity-80">
        <span className="grid h-10 w-10 place-items-center rounded-[11px] bg-violet-500 text-xl text-white">🧭</span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold">Revisión semanal</span>
          <span className="block text-[13px] text-slate-500">5 minutos para repasar la semana y elegir tu foco.</span>
        </span>
        <ChevronRight size={18} className="text-slate-400" />
      </button>
    )
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

function TodayHabits({ data }: { data: AppData }) {
  const tap = useHabitTap(data)
  const now = today()
  const active = data.habits.filter((h) => h.active)
  if (!active.length)
    return (
      <Card onClick={() => go('habitos')}>
        <p className="text-[15px] text-slate-500">Creá tu primer hábito para registrarlo desde acá.</p>
      </Card>
    )
  return (
    <Card className="grid grid-cols-4 gap-x-1 gap-y-3 px-2 py-3">
      {active.map((h) => {
        const logs = data.byHabit.get(h.id) ?? []
        const done = dayTotal(h, logs, now) > 0
        const p = weekProgress(h, logs)
        return (
          <button key={h.id} onClick={() => tap(h)} className="flex flex-col items-center gap-1 rounded-2xl p-1 active:scale-95">
            <span className="relative grid h-[52px] w-[52px] place-items-center rounded-full text-[22px] transition" style={{ background: done ? h.color : `${h.color}24` }}>
              {h.icon}
              {done && (
                <span className="absolute -bottom-0.5 -right-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-white text-emerald-500 shadow ring-2 ring-white dark:bg-slate-900 dark:ring-slate-900">
                  <Check size={11} strokeWidth={3.5} />
                </span>
              )}
            </span>
            <span className="line-clamp-1 max-w-full text-[11px] font-medium">{h.name}</span>
            <span className={cx('text-[11px] tabular-nums', p.met ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-slate-500')}>
              {h.auto ? `${streakDays(h, logs)} d` : `${Math.round(p.done * 10) / 10}/${p.target}${h.unit !== 'veces' && h.unit !== 'si_no' ? ` ${UNIT_LABEL[h.unit]}` : ''}`}
            </span>
          </button>
        )
      })}
    </Card>
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
