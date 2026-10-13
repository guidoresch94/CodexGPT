import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from './schema'
import { DEFAULT_SETTINGS } from './seed'
import { byId } from '../lib/calc'
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
    () => (raw ? { ...raw, catMap: byId(raw.categories), fundMap: byId(raw.funds) } : undefined),
    [raw],
  )
}
