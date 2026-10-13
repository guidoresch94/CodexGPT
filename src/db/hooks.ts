import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from './schema'
import { DEFAULT_SETTINGS } from './seed'
import { byId } from '../lib/calc'
import type { Category, Fund, ID, Recurring, Settings, Transaction } from '../types'

export interface AppData {
  settings: Settings
  categories: Category[]
  catMap: Map<ID, Category>
  transactions: Transaction[]
  recurrings: Recurring[]
  funds: Fund[]
  fundMap: Map<ID, Fund>
}

/** Todos los datos en vivo (el volumen es pequeño: cabe en memoria sin problema) */
export function useData(): AppData | undefined {
  const raw = useLiveQuery(async () => {
    const [settings, categories, transactions, recurrings, funds] = await Promise.all([
      db.settings.get('main'),
      db.categories.orderBy('order').toArray(),
      db.transactions.orderBy('date').reverse().toArray(),
      db.recurrings.toArray(),
      db.funds.orderBy('order').toArray(),
    ])
    return { settings: { ...DEFAULT_SETTINGS, ...settings }, categories, transactions, recurrings, funds }
  })
  return useMemo(
    () => (raw ? { ...raw, catMap: byId(raw.categories), fundMap: byId(raw.funds) } : undefined),
    [raw],
  )
}
