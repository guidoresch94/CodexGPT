import { Check, Flame, Plus, Settings as Gear } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useActions } from '../../app/actions'
import { go } from '../../app/router'
import type { AppData } from '../../db/hooks'
import { isBudgetExpense, monthPace, monthTxs, net, rootId } from '../../lib/calc'
import { fmtDayLong, monthKey, monthRange, today } from '../../lib/dates'
import { money, money0, num } from '../../lib/format'
import type { GameState } from '../../lib/game'
import { dayTotal, streakDays, UNIT_LABEL, weekProgress } from '../../lib/habits'
import { burst, CountUp, Ring, skyGradient } from '../../components/Fx'
import { Card, cx, Sheet } from '../../components/ui'
import { TxRow } from '../finanzas/Movimientos'
import { useHabitTap } from '../habitos/useHabitTap'
import { Logros } from './Game'

/** Tarjeta principal: saludo, lo que te queda para el día a día y tu nivel */
export function Hero({ data, pace, g }: { data: AppData; pace: ReturnType<typeof monthPace>; g: GameState }) {
  const { openTx } = useActions()
  const [logros, setLogros] = useState(false)
  const over = pace.remaining < 0
  const lvlPct = (g.xp - g.from) / Math.max(1, g.to - g.from)
  const hour = new Date().getHours()
  const hello = hour < 13 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  return (
    <>
      <div className="relative mt-2 overflow-hidden rounded-[28px] p-5 text-white shadow-[0_18px_40px_-12px_rgba(88,86,214,0.55)]" style={{ background: skyGradient() }}>
        {/* Brillos decorativos */}
        <span className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
        <span className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wide text-white/75 first-letter:uppercase">{fmtDayLong(today())}</p>
            <p className="text-[26px] font-bold leading-tight">
              {hello}, {data.settings.name}
            </p>
          </div>
          <button onClick={() => go('ajustes')} className="press grid h-9 w-9 place-items-center rounded-full bg-white/20 backdrop-blur" aria-label="Ajustes">
            <Gear size={18} />
          </button>
        </div>

        <button onClick={() => go('presupuesto')} className="relative mt-5 block text-left">
          <p className="text-[13px] font-medium text-white/80">Te quedan para el día a día</p>
          <p className={cx('text-[46px] font-bold leading-none tracking-tight tabular-nums', over && 'text-red-100')}>
            <CountUp value={pace.remaining} format={money} />
          </p>
          <p className="mt-1.5 text-[15px] text-white/85">
            {over ? 'Te pasaste del presupuesto variable' : `${money(pace.perDayAllowed)} por día · ${pace.daysLeft} ${pace.daysLeft === 1 ? 'día' : 'días'}`}
          </p>
        </button>

        <div className="relative mt-4 flex items-center gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-semibold backdrop-blur">
            {pace.vsPace >= 0 ? `▼ ${money0(pace.vsPace)} bajo el ritmo` : `▲ ${money0(-pace.vsPace)} sobre el ritmo`}
          </span>
          <div className="flex-1" />
          <button onClick={() => openTx()} className="press flex items-center gap-1 rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-slate-950 shadow-lg">
            <Plus size={17} strokeWidth={3} /> Gasto
          </button>
        </div>

        <button onClick={() => setLogros(true)} className="press relative mt-4 flex w-full items-center gap-3 rounded-[18px] bg-black/15 p-3 text-left backdrop-blur">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-amber-300 to-amber-500 text-[17px] font-bold text-white shadow">{g.level}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between">
              <span className="truncate text-[15px] font-semibold">Nivel {g.level} · {g.name}</span>
              <span className="flex items-center gap-0.5 text-[15px] font-semibold">
                <Flame size={15} className={g.streak ? 'text-amber-300' : 'text-white/50'} /> {g.streak}
              </span>
            </span>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/25">
              <span className="block h-full rounded-full bg-white transition-all duration-700" style={{ width: `${lvlPct * 100}%` }} />
            </span>
            <span className="mt-1 block text-[12px] text-white/75">
              {num(g.xp)} pts · {num(g.to - g.xp)} para el nivel {g.level + 1}
            </span>
          </span>
        </button>
      </div>
      <Sheet open={logros} onClose={() => setLogros(false)} title="Tus logros">
        <Logros g={g} />
      </Sheet>
    </>
  )
}

/** Hábitos de hoy como burbujas con anillo semanal (estilo Apple Watch) */
export function HabitBubbles({ data }: { data: AppData }) {
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
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 pt-1">
      {active.map((h) => {
        const logs = data.byHabit.get(h.id) ?? []
        const done = dayTotal(h, logs, now) > 0
        const p = weekProgress(h, logs)
        const label = h.auto ? `${streakDays(h, logs)} días` : `${Math.round(p.done * 10) / 10}/${p.target}${h.unit !== 'veces' && h.unit !== 'si_no' ? ` ${UNIT_LABEL[h.unit]}` : ''}`
        return (
          <button
            key={h.id}
            onClick={(e) => {
              if (!done || h.unit === 'veces' || h.unit === 'min' || h.unit === 'km' || h.unit === 'paginas') burst(e.clientX, e.clientY, h.color)
              tap(h)
            }}
            className="press flex w-[78px] shrink-0 snap-start flex-col items-center gap-1.5"
          >
            <Ring value={h.auto ? Math.min(1, streakDays(h, logs) / 30) : p.pct} size={70} stroke={6} color={h.color}>
              <span
                className={cx('grid h-[50px] w-[50px] place-items-center rounded-full text-[24px] transition-all duration-300', done && 'scale-105')}
                style={{ background: done ? h.color : `${h.color}22` }}
              >
                {h.icon}
              </span>
            </Ring>
            {done && (
              <span className="-mt-6 ml-11 grid h-5 w-5 place-items-center rounded-full bg-white text-emerald-500 shadow ring-2 ring-white animate-pop dark:bg-slate-900 dark:ring-slate-900">
                <Check size={12} strokeWidth={3.5} />
              </span>
            )}
            <span className={cx('line-clamp-1 max-w-full text-[12px] font-medium', done && 'mt-1')}>{h.name}</span>
            <span className={cx('-mt-1 text-[11px] tabular-nums', p.met ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-slate-500')}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** En qué se va la plata este mes: barra de colores por categoría + calendario de gasto diario */
export function MonthColors({ data }: { data: AppData }) {
  const key = monthKey(today())
  const [day, setDay] = useState<string | null>(null)
  const [focusCat, setFocusCat] = useState<string | null>(null)
  const { byRoot, total, perDay, maxDay } = useMemo(() => {
    const byRoot = new Map<string, number>()
    const perDay = new Map<string, number>()
    for (const t of monthTxs(data.transactions, key)) {
      if (!isBudgetExpense(t)) continue
      const r = rootId(t.categoryId, data.catMap) ?? '—'
      const v = net(t)
      byRoot.set(r, (byRoot.get(r) ?? 0) + v)
      if (data.catMap.get(r)?.type === 'variable') perDay.set(t.date, (perDay.get(t.date) ?? 0) + v)
    }
    const total = [...byRoot.values()].reduce((s, v) => s + Math.max(0, v), 0)
    return { byRoot, total, perDay, maxDay: Math.max(1, ...perDay.values()) }
  }, [data.transactions, data.catMap, key])

  const segs = [...byRoot].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const { start, days } = monthRange(key)
  const firstDow = (new Date(start).getDay() + 6) % 7
  const now = today()
  // Antes de tu primer movimiento no hay datos: se muestran neutros, no como «sin gastos»
  const firstTx = data.transactions.reduce((m, t) => (t.date < m ? t.date : m), '9999')
  const dayTxs = day ? data.transactions.filter((t) => t.date === day) : []
  const focus = focusCat ? data.catMap.get(focusCat) : undefined

  if (!total) return null
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <p className="text-[17px] font-semibold">Tu mes en colores</p>
        <p className="text-[15px] font-semibold tabular-nums">{money0(total)}</p>
      </div>
      <div className="mt-3 flex h-4 gap-[3px] overflow-hidden rounded-full">
        {segs.map(([id, v]) => {
          const c = data.catMap.get(id)
          return (
            <button
              key={id}
              onClick={() => setFocusCat(focusCat === id ? null : id)}
              className={cx('h-full rounded-[3px] transition-all duration-300', focusCat && focusCat !== id && 'opacity-30')}
              style={{ width: `${(v / total) * 100}%`, background: c?.color ?? '#8e8e93', minWidth: 6 }}
              aria-label={`${c?.name ?? 'Sin categoría'} ${money0(v)}`}
            />
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {segs.slice(0, 6).map(([id, v]) => {
          const c = data.catMap.get(id)
          return (
            <button
              key={id}
              onClick={() => setFocusCat(focusCat === id ? null : id)}
              className={cx('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] transition', focusCat === id ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'bg-ios-fill')}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: c?.color ?? '#8e8e93' }} />
              {c?.icon} {Math.round((v / total) * 100)} %
            </button>
          )
        })}
      </div>
      {focus && (
        <button onClick={() => go('movimientos', focus.id)} className="mt-2 w-full rounded-[12px] bg-ios-fill/70 px-3 py-2 text-left text-[13px]">
          {focus.icon} <b>{focus.name}</b>: {money(byRoot.get(focus.id) ?? 0)}
          {focus.monthlyBudget > 0 && ` de ${money0(focus.monthlyBudget)}`} · ver movimientos ›
        </button>
      )}

      <p className="mb-2 mt-5 text-[13px] text-slate-500">Gasto del día a día por día · tocá un día</p>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <span key={d} className="text-[10px] font-semibold text-slate-400">
            {d}
          </span>
        ))}
        {Array.from({ length: firstDow }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = `${key}-${String(i + 1).padStart(2, '0')}`
          const v = perDay.get(d) ?? 0
          const future = d > now || d < firstTx
          const alpha = v ? 0.25 + 0.75 * Math.min(1, v / maxDay) : 0
          return (
            <button
              key={d}
              disabled={future}
              onClick={() => setDay(d)}
              className={cx('press relative grid aspect-square place-items-center rounded-[10px] text-[12px] font-medium tabular-nums', future ? 'text-slate-300 dark:text-slate-700' : v ? 'text-white' : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300', d === now && 'ring-2 ring-accent')}
              style={v ? { background: `rgba(255,59,48,${alpha})` } : undefined}
              aria-label={`Día ${i + 1}: ${money(v)}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <p className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-emerald-500/30" /> sin gastos
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-red-500/40" /> poco
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-red-500" /> mucho
        </span>
      </p>

      <Sheet open={!!day} onClose={() => setDay(null)} title={day ? fmtDayLong(day).replace(/^./, (c) => c.toUpperCase()) : ''}>
        {dayTxs.length ? (
          <div className="overflow-hidden rounded-[18px] bg-ios-card">
            {dayTxs.map((t) => (
              <TxRow key={t.id} t={t} data={data} onClick={() => setDay(null)} />
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-[15px] text-slate-500">Día sin gastos 🧘</p>
        )}
      </Sheet>
    </Card>
  )
}
