import { db } from '../../db/schema'
import { today } from '../../lib/dates'
import { uid } from '../../lib/format'
import type { DateStr, Habit, HabitLog } from '../../types'

/** Hábitos de un toque: veces y sí/no. El resto (min, km, páginas) pide cantidad. */
export const isOneTap = (h: Habit) => h.unit === 'veces' || h.unit === 'si_no'

export async function addLog(h: Habit, value: number, date: DateStr = today()) {
  const log: HabitLog = { id: uid(), habitId: h.id, date, value }
  await db.habitLogs.put(log)
  return log
}

/** Para sí/no: marca o desmarca el día. Devuelve true si queda marcado. */
export async function toggleDay(h: Habit, logs: HabitLog[], date: DateStr = today()) {
  const existing = logs.filter((l) => l.habitId === h.id && l.date === date)
  if (existing.length) {
    await db.habitLogs.bulkDelete(existing.map((l) => l.id))
    return false
  }
  await addLog(h, 1, date)
  return true
}
