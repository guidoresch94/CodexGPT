import Dexie, { type EntityTable } from 'dexie'
import type { Category, Fund, Recurring, Settings, Transaction } from '../types'

export class MiVidaDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>
  categories!: EntityTable<Category, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  recurrings!: EntityTable<Recurring, 'id'>
  funds!: EntityTable<Fund, 'id'>

  constructor() {
    super('mi-vida')
    this.version(1).stores({
      settings: 'id',
      categories: 'id, parentId, order',
      transactions: 'id, date, kind, categoryId, fundId, recurringId',
      recurrings: 'id',
      funds: 'id, order',
    })
  }
}

export const db = new MiVidaDB()
