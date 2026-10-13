import type { DateStr, Habit, HabitLog, ID, Transaction } from '../types'
import { addDaysISO, monthRange, today, weekRange } from './dates'
import { isBudgetExpense, monthTxs, net } from './calc'

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
 * 70 % hábitos (media de progreso de cada hábito, máx. 100 % cada uno)
 * 30 % dinero (gasto variable dentro del ritmo del mes)
 */
export function weekScore(habits: Habit[], logs: HabitLog[], paceOk: number, ref = new Date()) {
  const active = habits.filter((h) => h.active)
  const byH = logsByHabit(logs)
  const habitPct = active.length ? active.reduce((s, h) => s + weekProgress(h, byH.get(h.id) ?? [], ref).pct, 0) / active.length : 0
  const money = Math.max(0, Math.min(1, paceOk))
  return { score: Math.round(habitPct * 70 + money * 30), habitPct, money }
}

/** 0–1: 1 si el gasto variable va al ritmo del presupuesto; baja hasta 0 si vas un 20 % por encima */
export const moneyScore = (pace: { budget: number; vsPace: number }) =>
  pace.budget <= 0 || pace.vsPace >= 0 ? 1 : Math.max(0, 1 - -pace.vsPace / (pace.budget * 0.2))
