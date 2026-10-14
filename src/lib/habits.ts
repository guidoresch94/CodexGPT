import type { Category, DateStr, Habit, HabitLog, ID, Transaction } from '../types'
import { addDaysISO, monthRange, today, weekRange } from './dates'
import { isBudgetExpense, monthTxs, net, rootId } from './calc'

export const UNIT_LABEL: Record<Habit['unit'], string> = { veces: 'veces', min: 'min', km: 'km', paginas: 'págs.', si_no: 'días' }

/** Cuánto suma un registro hacia el objetivo semanal */
const amount = (h: Habit, l: HabitLog) => (h.unit === 'veces' || h.unit === 'si_no' ? Math.max(1, l.value || 1) : l.value)

export function logsByHabit(logs: HabitLog[]) {
  const m = new Map<ID, HabitLog[]>()
  for (const l of logs) m.set(l.habitId, [...(m.get(l.habitId) ?? []), l])
  return m
}

export function sumBetween(h: Habit, logs: HabitLog[], start: DateStr, end: DateStr) {
  return logs.filter((l) => l.date >= start && l.date <= end).reduce((s, l) => s + amount(h, l), 0)
}

/** Total de un día (para el mapa de calor y el check-in) */
export function dayTotal(h: Habit, logs: HabitLog[], date: DateStr) {
  return sumBetween(h, logs, date, date)
}

export function weekProgress(h: Habit, logs: HabitLog[], ref = new Date()) {
  const { start, end } = weekRange(ref)
  const done = sumBetween(h, logs, start, end)
  return { done, target: h.weeklyTarget, pct: h.weeklyTarget > 0 ? Math.min(1, done / h.weeklyTarget) : 0, met: done >= h.weeklyTarget }
}

/**
 * Racha: semanas seguidas cumpliendo el objetivo. La semana en curso
 * suma si ya está cumplida, pero no rompe la racha si aún no.
 */
export function streakWeeks(h: Habit, logs: HabitLog[]) {
  let streak = 0
  let ref = new Date()
  const current = weekProgress(h, logs, ref)
  if (current.met) streak++
  for (let i = 0; i < 104; i++) {
    ref = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 7)
    if (weekProgress(h, logs, ref).met) streak++
    else break
  }
  return streak
}

/** Racha diaria (para hábitos sí/no, p. ej. días sin fumar) */
export function streakDays(h: Habit, logs: HabitLog[]) {
  const days = new Set(logs.filter((l) => l.habitId === h.id).map((l) => l.date))
  let d = today()
  if (!days.has(d)) d = addDaysISO(d, -1)
  let n = 0
  while (days.has(d)) {
    n++
    d = addDaysISO(d, -1)
  }
  return n
}

/** % de semanas cumplidas en las últimas N semanas completas */
export function hitRate(h: Habit, logs: HabitLog[], weeks = 4) {
  let met = 0
  const now = new Date()
  for (let i = 1; i <= weeks; i++) {
    const ref = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7 * i)
    if (weekProgress(h, logs, ref).met) met++
  }
  return met / weeks
}

/** Celdas del mapa de calor: 7 filas (L–D) × N semanas, terminando esta semana */
export function heatmap(h: Habit, logs: HabitLog[], weeks = 15) {
  const { start } = weekRange()
  const first = addDaysISO(start, -7 * (weeks - 1))
  const perDay = new Map<string, number>()
  for (const l of logs) if (l.date >= first) perDay.set(l.date, (perDay.get(l.date) ?? 0) + amount(h, l))
  const dailyGoal = h.unit === 'veces' || h.unit === 'si_no' ? 1 : Math.max(1, h.weeklyTarget / 4)
  const now = today()
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDaysISO(first, w * 7 + d)
      const v = perDay.get(date) ?? 0
      return { date, value: v, level: date > now ? -1 : v <= 0 ? 0 : Math.min(4, Math.ceil((v / dailyGoal) * 2)) }
    }),
  )
}

/** € por sesión este mes: gasto de la categoría enlazada / sesiones del mes */
export function costPerUse(h: Habit, logs: HabitLog[], txs: Transaction[], key: string) {
  if (!h.linkedCategoryId) return undefined
  const { start, end } = monthRange(key)
  const sessions = logs.filter((l) => l.date >= start && l.date <= end).length
  const spent = monthTxs(txs, key)
    .filter((t) => isBudgetExpense(t) && t.categoryId === h.linkedCategoryId)
    .reduce((s, t) => s + net(t), 0)
  return { sessions, spent, perUse: sessions ? spent / sessions : undefined }
}

/**
 * Puntuación semanal 0–100, explicable:
 * 70 % hábitos (media de progreso de cada hábito, prorrateado al día de la semana)
 * 30 % dinero (gasto variable dentro del ritmo del mes)
 */
export function weekScore(habits: Habit[], byH: Map<ID, HabitLog[]>, paceOk: number, ref = new Date(), prorate = true) {
  const active = habits.filter((h) => h.active)
  const pctOf = (h: Habit) => (prorate ? proratedPct(h, byH.get(h.id) ?? [], ref) : weekProgress(h, byH.get(h.id) ?? [], ref).pct)
  const habitPct = active.length ? active.reduce((s, h) => s + pctOf(h), 0) / active.length : 0
  const money = Math.max(0, Math.min(1, paceOk))
  return { score: Math.round(habitPct * 70 + money * 30), habitPct, money }
}

/** 0–1: 1 si el gasto variable va al ritmo del presupuesto; baja hasta 0 si vas un 20 % por encima */
export const moneyScore = (pace: { budget: number; vsPace: number }) =>
  pace.budget <= 0 || pace.vsPace >= 0 ? 1 : Math.max(0, 1 - -pace.vsPace / (pace.budget * 0.2))

// ── Unión gastos ↔ hábitos ──────────────────────────────────────────────

interface Ctx {
  transactions: Transaction[]
  catMap: Map<ID, Category>
  habitLogs: HabitLog[]
  habits: Habit[]
}

/** ¿Este gasto es de la categoría enlazada al hábito (o de una subcategoría suya)? */
export const txMatchesHabit = (h: Habit, t: Transaction, catMap: Map<ID, Category>) =>
  !!h.linkedCategoryId && t.kind === 'gasto' && (t.categoryId === h.linkedCategoryId || rootId(t.categoryId, catMap) === h.linkedCategoryId)

/** Hábitos enlazados a una categoría (para el alta de gastos) */
export function habitsForCategory(categoryId: ID | undefined, habits: Habit[], catMap: Map<ID, Category>) {
  if (!categoryId) return []
  const root = rootId(categoryId, catMap)
  return habits.filter((h) => h.active && h.linkedCategoryId && (h.linkedCategoryId === categoryId || h.linkedCategoryId === root))
}

export const linkModeOf = (h: Habit) => h.linkMode ?? (h.unit === 'si_no' ? 'rompe' : 'suma')

/** Días en que el hábito "sin" se rompió: recaída marcada o gasto en la categoría enlazada */
export function brokenDates(h: Habit, logs: HabitLog[], ctx: Pick<Ctx, 'transactions' | 'catMap'>) {
  const out = new Set(logs.filter((l) => l.value < 0).map((l) => l.date))
  if (linkModeOf(h) === 'rompe') for (const t of ctx.transactions) if (txMatchesHabit(h, t, ctx.catMap)) out.add(t.date)
  return out
}

/**
 * Registros efectivos: para hábitos automáticos ("sin tabaco") cada día
 * desde `since` cuenta solo, salvo los días rotos. Así no hay que marcarlo a diario.
 */
export function effectiveLogs(h: Habit, logs: HabitLog[], ctx: Pick<Ctx, 'transactions' | 'catMap'>): HabitLog[] {
  if (!h.auto) return logs.filter((l) => l.value > 0)
  const broken = brokenDates(h, logs, ctx)
  const out: HabitLog[] = []
  const end = today()
  let d = h.since ?? end
  // Límite de seguridad: 3 años
  for (let i = 0; d <= end && i < 1100; i++, d = addDaysISO(d, 1)) if (!broken.has(d)) out.push({ id: `auto-${d}`, habitId: h.id, date: d, value: 1 })
  return out
}

export function habitLogsMap(ctx: Ctx) {
  const raw = logsByHabit(ctx.habitLogs)
  const m = new Map<ID, HabitLog[]>()
  for (const h of ctx.habits) m.set(h.id, effectiveLogs(h, raw.get(h.id) ?? [], ctx))
  return m
}

/** Lo que te ahorrás por no gastar en un hábito que estás dejando (ej. tabaco) */
export function quitSavings(h: Habit, streak: number, ctx: Pick<Ctx, 'transactions' | 'catMap'>) {
  if (linkModeOf(h) !== 'rompe' || !h.linkedCategoryId) return undefined
  const since = addDaysISO(today(), -120)
  const spent = ctx.transactions.filter((t) => t.date >= since && txMatchesHabit(h, t, ctx.catMap)).reduce((s, t) => s + net(t), 0)
  const cat = ctx.catMap.get(h.linkedCategoryId)
  // Gasto diario de referencia: lo que gastabas, o tu presupuesto si aún no hay historial
  const daily = spent > 0 ? spent / 120 : (cat?.monthlyBudget ?? 0) / 30
  return { daily, saved: daily * streak, yearly: daily * 365 }
}

/** Progreso semanal prorrateado: a mitad de semana basta con ir a mitad del objetivo */
export function proratedPct(h: Habit, logs: HabitLog[], ref = new Date()) {
  const p = weekProgress(h, logs, ref)
  const dow = (ref.getDay() + 6) % 7
  const expected = (h.weeklyTarget * (dow + 1)) / 7
  return expected > 0 ? Math.min(1, p.done / expected) : 0
}
