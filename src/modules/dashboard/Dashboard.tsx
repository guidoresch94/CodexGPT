import { Check, ChevronRight, Settings as Gear } from 'lucide-react'
import { useMemo } from 'react'
import { Area, AreaChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { go } from '../../app/router'
import { useActions } from '../../app/actions'
import { db } from '../../db/schema'
import type { AppData } from '../../db/hooks'
import { alerts, fundBalance, level, monthPace, monthSummary, recurringStatus, type Alert } from '../../lib/calc'
import { fmtDayLong, monthKey, today } from '../../lib/dates'
import { money, money0, pct, uid } from '../../lib/format'
import { dayTotal, logsByHabit, moneyScore, streakDays, streakWeeks, UNIT_LABEL, weekProgress, weekScore } from '../../lib/habits'
import { useToast } from '../../components/Toast'
import { Card, CatIcon, cx, levelText, PageHeader, ProgressBar, SectionTitle } from '../../components/ui'
import { ScoreRing } from '../habitos/ScoreRing'
import { useHabitTap } from '../habitos/useHabitTap'
import { goalProgress } from '../objetivos/Objetivos'
import { currentFocus, reviewDue } from './Review'

export function Dashboard({ data }: { data: AppData }) {
  const { settings, transactions, categories, recurrings, catMap, funds } = data
  const key = monthKey(today())
  const m = useMemo(() => monthSummary(transactions, categories, recurrings, settings, key), [transactions, categories, recurrings, settings, key])
  const pace = useMemo(() => monthPace(transactions, categories, key), [transactions, categories, key])
  const pending = useMemo(() => recurringStatus(recurrings, transactions, key).filter((r) => !r.paid), [recurrings, transactions, key])
  const byH = useMemo(() => logsByHabit(data.habitLogs), [data.habitLogs])
  const score = weekScore(data.habits, data.habitLogs, moneyScore(pace))
  const notes = useMemo(() => [...achievements(data, byH, pace.noSpendDays), ...alerts(transactions, categories, recurrings, settings)], [data, byH, pace.noSpendDays, transactions, categories, recurrings, settings])

  const top = [...m.byRoot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const hour = new Date().getHours()
  const hello = hour < 14 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div>
      <PageHeader
        subtitle={fmtDayLong(today())}
        title={`${hello}, ${settings.name}`}
        right={
          <button onClick={() => go('ajustes')} className="rounded-full p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10" aria-label="Ajustes">
            <Gear size={22} />
          </button>
        }
      />

      <SpendCard pace={pace} />
      <FocusCard data={data} />

      <SectionTitle action={<button onClick={() => go('habitos')} className="text-xs text-emerald-600 dark:text-emerald-400">Ver hábitos</button>}>Hábitos de hoy</SectionTitle>
      <TodayHabits data={data} byH={byH} score={score.score} />

      {pending.length > 0 && <PendingList data={data} items={pending} />}

      <SectionTitle action={<button onClick={() => go('presupuesto')} className="text-xs text-emerald-600 dark:text-emerald-400">Ver presupuesto</button>}>
        Este mes
      </SectionTitle>
      <Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Ingresos" value={money0(m.income)} tone="text-emerald-600 dark:text-emerald-400" />
          <Stat label="Gastos" value={money0(m.spent)} />
          <Stat label="A huchas" value={money0(m.saved)} tone="text-sky-600 dark:text-sky-400" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.03]">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Ahorro previsto a fin de mes</p>
            <p className={cx('text-lg font-bold tabular-nums', m.projectedSaving >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{money0(m.projectedSaving)}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Tasa de ahorro {pct(m.savingRate)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.03]">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Sueldo en vivienda</p>
            <p className={cx('text-lg font-bold tabular-nums', m.housingPct <= settings.housingTarget ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500')}>{pct(m.housingPct)}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Objetivo ≤ {settings.housingTarget} %</p>
          </div>
        </div>
      </Card>

      {notes.length > 0 && (
        <>
          <SectionTitle>Avisos y logros</SectionTitle>
          <div className="space-y-2">
            {notes.slice(0, 6).map((n, i) => (
              <div
                key={i}
                className={cx(
                  'rounded-2xl px-4 py-3 text-sm',
                  n.tone === 'over' && 'bg-red-500/10 text-red-700 dark:text-red-300',
                  n.tone === 'warn' && 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
                  n.tone === 'good' && 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
                  n.tone === 'info' && 'bg-sky-500/10 text-sky-800 dark:text-sky-300',
                )}
              >
                {n.text}
              </div>
            ))}
          </div>
        </>
      )}

      {top.length > 0 && (
        <>
          <SectionTitle>Donde más gastas este mes</SectionTitle>
          <Card className="space-y-3">
            {top.map(([id, spent]) => {
              const c = catMap.get(id)
              if (!c) return null
              return (
                <button key={id} onClick={() => go('movimientos', id)} className="flex w-full items-center gap-3 text-left">
                  <CatIcon icon={c.icon} color={c.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate">{c.name}</span>
                      <span className={cx('tabular-nums font-medium', levelText[c.type === 'fijo' && spent <= c.monthlyBudget ? 'ok' : level(spent, c.monthlyBudget)])}>{money0(spent)}</span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar value={spent} max={c.monthlyBudget} thin fixed={c.type === 'fijo'} />
                    </div>
                  </div>
                </button>
              )
            })}
          </Card>
        </>
      )}

      <SectionTitle action={<button onClick={() => go('metas')} className="text-xs text-emerald-600 dark:text-emerald-400">Ver metas</button>}>Metas</SectionTitle>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {data.goals
          .filter((g) => g.status === 'activo')
          .slice(0, 4)
          .map((g) => {
            const p = goalProgress(g, data)
            return (
              <Card key={g.id} className="w-40 shrink-0" onClick={() => go('metas')}>
                <div className="text-2xl">{g.icon}</div>
                <p className="mt-1 line-clamp-2 min-h-[2.5em] text-xs font-medium">{g.title}</p>
                {p ? (
                  <div className="mt-2">
                    <ProgressBar value={p.value} max={p.target} color="#38bdf8" thin />
                    <p className="mt-1 text-[10px] text-slate-500">{Math.round((p.value / p.target) * 100)} %</p>
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] text-slate-500">Hito pendiente</p>
                )}
              </Card>
            )
          })}
        {funds
          .filter((f) => !f.archived)
          .map((f) => {
            const b = fundBalance(f, transactions)
            return (
              <Card key={f.id} className="w-40 shrink-0" onClick={() => go('metas', 'huchas')}>
                <div className="text-2xl">{f.icon}</div>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{f.name}</p>
                <p className="text-lg font-bold tabular-nums">{money0(b)}</p>
                {f.target ? (
                  <div className="mt-2">
                    <ProgressBar value={b} max={f.target} color={f.color} thin />
                    <p className="mt-1 text-[10px] text-slate-500">de {money0(f.target)}</p>
                  </div>
                ) : null}
              </Card>
            )
          })}
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cx('text-base font-bold tabular-nums', tone)}>{value}</p>
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
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Te quedan para el día a día</p>
          <p className={cx('text-4xl font-bold tabular-nums tracking-tight', over ? 'text-red-500' : 'text-slate-900 dark:text-white')}>{money(pace.remaining)}</p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            {over ? 'Te has pasado del presupuesto variable' : (
              <>
                ≈ <b className="tabular-nums">{money(pace.perDayAllowed)}</b>/día · {pace.daysLeft} {pace.daysLeft === 1 ? 'día' : 'días'}
              </>
            )}
          </p>
        </div>
        <button onClick={() => openTx()} className="shrink-0 rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 active:scale-95">
          + Gasto
        </button>
      </div>
      <span className={cx('mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-medium', ahead ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>
        {ahead ? `▼ ${money0(pace.vsPace)} por debajo del ritmo` : `▲ ${money0(-pace.vsPace)} por encima del ritmo`}
      </span>
      <div className="mt-2 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pace.series} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} stroke="#94a3b8" ticks={[1, 10, 20, pace.series.length]} />
            <Tooltip
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
              labelFormatter={(d) => `Día ${d}`}
              formatter={(v, n) => [money0(Number(v)), n === 'actual' ? 'Este mes' : n === 'ideal' ? 'Ritmo ideal' : 'Mes pasado']}
            />
            <Line type="monotone" dataKey="prev" stroke="#94a3b8" strokeOpacity={0.45} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="ideal" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} fill="url(#spendFill)" connectNulls={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-emerald-500" /> Este mes</span>
        <span className="flex items-center gap-1"><span className="h-0 w-3 border-t border-dashed border-slate-400" /> Ritmo ideal ({money0(pace.budget)})</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-slate-400/50" /> Mes pasado</span>
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
      <button onClick={openReview} className="mt-3 flex w-full items-center gap-3 rounded-3xl bg-gradient-to-r from-violet-500/20 to-sky-500/10 p-4 text-left ring-1 ring-violet-500/20">
        <span className="text-2xl">🧭</span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">Revisión semanal · 5 min</span>
          <span className="block text-xs text-slate-600 dark:text-slate-300">Repasa gastos y hábitos y elige tu foco para la semana.</span>
        </span>
        <ChevronRight size={18} className="text-slate-400" />
      </button>
    )
  if (!focus?.focus) return null
  return (
    <button onClick={openReview} className="mt-3 flex w-full items-center gap-3 rounded-3xl bg-violet-500/10 p-4 text-left">
      <span className="text-2xl">🎯</span>
      <span className="flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-wider text-violet-600 dark:text-violet-300">Foco de la semana</span>
        <span className="block text-sm font-medium">{focus.focus}</span>
      </span>
    </button>
  )
}

function TodayHabits({ data, byH, score }: { data: AppData; byH: ReturnType<typeof logsByHabit>; score: number }) {
  const tap = useHabitTap(data)
  const now = today()
  const active = data.habits.filter((h) => h.active)
  if (!active.length)
    return (
      <Card onClick={() => go('habitos')}>
        <p className="text-sm text-slate-500">Crea tu primer hábito para hacer check-in desde aquí.</p>
      </Card>
    )
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center gap-3 px-1">
        <ScoreRing value={score} size={44} />
        <p className="text-xs text-slate-500 dark:text-slate-400">Puntuación de la semana. Toca un hábito para registrarlo.</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {active.map((h) => {
          const logs = byH.get(h.id) ?? []
          const todayV = dayTotal(h, logs, now)
          const p = weekProgress(h, logs)
          const done = todayV > 0
          return (
            <button key={h.id} onClick={() => tap(h)} className="flex flex-col items-center gap-1 rounded-2xl p-1.5 active:scale-95">
              <span className="relative grid h-12 w-12 place-items-center rounded-2xl text-xl transition" style={{ background: done ? h.color : `${h.color}22` }}>
                {h.icon}
                {done && (
                  <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white text-emerald-600 shadow dark:bg-slate-900">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="line-clamp-1 text-[10px] text-slate-600 dark:text-slate-300">{h.name}</span>
              <span className={cx('text-[10px] tabular-nums', p.met ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-slate-400')}>
                {Math.round(p.done * 10) / 10}/{p.target}
                {h.unit !== 'veces' && h.unit !== 'si_no' ? ` ${UNIT_LABEL[h.unit]}` : ''}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/** Logros positivos: rachas y días sin gastar */
function achievements(data: AppData, byH: ReturnType<typeof logsByHabit>, noSpendDays: number): Alert[] {
  const out: Alert[] = []
  for (const h of data.habits.filter((x) => x.active)) {
    const logs = byH.get(h.id) ?? []
    if (h.unit === 'si_no') {
      const d = streakDays(h, logs)
      if (d >= 3) out.push({ tone: 'good', text: `${h.icon} ${d} días seguidos: ${h.name.toLowerCase()} 🔥` })
    } else {
      const w = streakWeeks(h, logs)
      if (w >= 2) out.push({ tone: 'good', text: `${h.icon} ${w} semanas seguidas cumpliendo ${h.name.toLowerCase()} 🔥` })
    }
  }
  if (noSpendDays >= 3) out.push({ tone: 'good', text: `🧘 ${noSpendDays} días sin gastos variables este mes.` })
  return out.slice(0, 3)
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
    toast({ text: `${r.name}: marcado ✓`, action: { label: 'Deshacer', run: () => db.transactions.delete(id) } })
  }

  if (!visible.length) return null
  return (
    <>
      <SectionTitle action={<button onClick={() => go('fijos')} className="text-xs text-emerald-600 dark:text-emerald-400">Gestionar</button>}>
        Fijos del mes
      </SectionTitle>
      <Card className="divide-y divide-slate-100 p-0 dark:divide-white/5">
        {visible.map(({ recurring: r, due, overdue }) => {
          const c = data.catMap.get(r.categoryId ?? '')
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <CatIcon icon={c?.icon ?? '📌'} color={c?.color ?? '#94a3b8'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{r.name}</p>
                <p className={cx('text-[11px]', overdue ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500')}>
                  {overdue ? 'Pendiente desde' : 'Vence'} el {Number(due.slice(8, 10))} · {money(r.amount)}
                </p>
              </div>
              <button
                onClick={() => pay(r, due)}
                className="flex items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-700 active:scale-95 dark:text-emerald-300"
              >
                <Check size={14} /> {r.kind === 'ingreso' ? 'Cobrado' : r.kind === 'transferencia' ? 'Hecho' : 'Pagado'}
              </button>
            </div>
          )
        })}
      </Card>
    </>
  )
}
