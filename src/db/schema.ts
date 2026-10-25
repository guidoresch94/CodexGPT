import Dexie, { type EntityTable } from 'dexie'
import type { Category, Fund, Goal, Habit, HabitLog, Idea, Recurring, Settings, Transaction, WeeklyReview } from '../types'

export class MiVidaDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>
  categories!: EntityTable<Category, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  recurrings!: EntityTable<Recurring, 'id'>
  funds!: EntityTable<Fund, 'id'>
  habits!: EntityTable<Habit, 'id'>
  habitLogs!: EntityTable<HabitLog, 'id'>
  goals!: EntityTable<Goal, 'id'>
  ideas!: EntityTable<Idea, 'id'>
  reviews!: EntityTable<WeeklyReview, 'id'>

  constructor() {
    super('mi-vida')
    this.version(1).stores({
      settings: 'id',
      categories: 'id, parentId, order',
      transactions: 'id, date, kind, categoryId, fundId, recurringId',
      recurrings: 'id',
      funds: 'id, order',
    })
    this.version(2).stores({
      habits: 'id, order',
      habitLogs: 'id, habitId, date',
      goals: 'id, status',
      ideas: 'id, status, createdAt',
      reviews: 'id',
    })
  }
}

export const db = new MiVidaDB()

/** Todas las tablas (para transacciones que tocan todo) */
export const allTables = () => [db.settings, db.categories, db.transactions, db.recurrings, db.funds, db.habits, db.habitLogs, db.goals, db.ideas, db.reviews]
