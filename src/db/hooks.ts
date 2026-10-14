import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from './schema'
import { DEFAULT_SETTINGS } from './seed'
import { byId } from '../lib/calc'
import { habitLogsMap } from '../lib/habits'
import type { Category, Fund, Goal, Habit, HabitLog, ID, Idea, Recurring, Settings, Transaction, WeeklyReview } from '../types'

export interface AppData {
  settings: Settings
  categories: Category[]
  catMap: Map<ID, Category>
  transactions: Transaction[]
  recurrings: Recurring[]
  funds: Fund[]
  fundMap: Map<ID, Fund>
  habits: Habit[]
  habitLogs: HabitLog[]
  goals: Goal[]
  ideas: Idea[]
  reviews: WeeklyReview[]
  /** Registros efectivos por hábito (incluye días automáticos y gastos enlazados) */
  byHabit: Map<ID, HabitLog[]>
}

/** Todos los datos en vivo (el volumen es pequeño: cabe en memoria sin problema) */
export function useData(): AppData | undefined {
  const raw = useLiveQuery(async () => {
    const [settings, categories, transactions, recurrings, funds, habits, habitLogs, goals, ideas, reviews] = await Promise.all([
      db.settings.get('main'),
      db.categories.orderBy('order').toArray(),
      db.transactions.orderBy('date').reverse().toArray(),
      db.recurrings.toArray(),
      db.funds.orderBy('order').toArray(),
      db.habits.orderBy('order').toArray(),
      db.habitLogs.toArray(),
      db.goals.toArray(),
      db.ideas.orderBy('createdAt').reverse().toArray(),
      db.reviews.toArray(),
    ])
    return { settings: { ...DEFAULT_SETTINGS, ...settings }, categories, transactions, recurrings, funds, habits, habitLogs, goals, ideas, reviews }
  })
  return useMemo(
    () => {
      if (!raw) return undefined
      const catMap = byId(raw.categories)
      return { ...raw, catMap, fundMap: byId(raw.funds), byHabit: habitLogsMap({ ...raw, catMap }) }
    },
    [raw],
  )
}
