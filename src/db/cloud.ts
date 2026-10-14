import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { allTables, db } from './schema'
import { capability, inArtifact } from '../lib/platform'
import type { Category, Fund, Goal, Habit, HabitLog, Idea, Recurring, Settings, Transaction, WeeklyReview } from '../types'

/**
 * Copia en la nube (base de datos privada del artefacto de Claude).
 * IndexedDB sigue siendo el almacén de trabajo; aquí se refleja en documentos:
 *   data/users/<id>/config      → ajustes, categorías, fijos, huchas, hábitos, objetivos, ideas, revisiones
 *   data/users/<id>/tx-AAAA-MM  → movimientos de ese mes
 *   data/users/<id>/hl-AAAA-MM  → registros de hábitos de ese mes
 */

interface DocRef {
  set(data: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
}
interface Snap {
  id: string
  exists: boolean
  data(): Record<string, unknown> | undefined
}
interface Coll {
  doc(id: string): DocRef
  get(): Promise<{ docs: Snap[] }>
}
interface CloudDB {
  collection(path: string): Coll
}
interface UserCap {
  id(): Promise<string | null>
}

export type SyncStatus = 'local' | 'conectando' | 'guardado' | 'guardando' | 'error'

let status: SyncStatus = inArtifact() ? 'conectando' : 'local'
const listeners = new Set<() => void>()
const setStatus = (s: SyncStatus) => {
  status = s
  listeners.forEach((l) => l())
}
export const useSyncStatus = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )

type Bodies = Map<string, Record<string, unknown>>

const byIdSort = <T extends { id: string }>(a: T[]) => [...a].sort((x, y) => x.id.localeCompare(y.id))

async function localBodies(): Promise<Bodies> {
  const [settings, categories, transactions, recurrings, funds, habits, habitLogs, goals, ideas, reviews] = await Promise.all([
    db.settings.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.recurrings.toArray(),
    db.funds.toArray(),
    db.habits.toArray(),
    db.habitLogs.toArray(),
    db.goals.toArray(),
    db.ideas.toArray(),
    db.reviews.toArray(),
  ])
  const out: Bodies = new Map()
  out.set('config', {
    v: 2,
    settings,
    categories: byIdSort(categories),
    recurrings: byIdSort(recurrings),
    funds: byIdSort(funds),
    habits: byIdSort(habits),
    goals: byIdSort(goals),
    ideas: byIdSort(ideas),
    reviews: byIdSort(reviews),
  })
  const group = <T extends { id: string; date: string }>(prefix: string, list: T[]) => {
    const months = new Map<string, T[]>()
    for (const t of list) {
      const m = t.date.slice(0, 7)
      months.set(m, [...(months.get(m) ?? []), t])
    }
    for (const [m, items] of months) out.set(`${prefix}-${m}`, { items: byIdSort(items) })
  }
  group('tx', transactions)
  group('hl', habitLogs)
  return out
}

let coll: Coll | null = null
const written = new Map<string, string>()

/** Conecta con la base de datos del artefacto. Devuelve true si hay nube. */
export async function connectCloud(): Promise<boolean> {
  if (!inArtifact()) return false
  const [cloud, user] = await Promise.all([capability<CloudDB>('db'), capability<UserCap>('user')])
  const uid = await user?.id().catch(() => null)
  if (!cloud || !uid) {
    setStatus('local')
    return false
  }
  coll = cloud.collection(`data/users/${uid}`)
  return true
}

/** Trae los datos de la nube a IndexedDB. Devuelve false si la nube está vacía. */
export async function pullFromCloud(): Promise<boolean> {
  if (!coll) return false
  let snap: { docs: Snap[] }
  try {
    snap = await coll.get()
  } catch {
    setStatus('error')
    return false
  }
  const docs = new Map(snap.docs.filter((d) => d.exists).map((d) => [d.id, d.data() ?? {}]))
  const config = docs.get('config') as
    | {
        settings?: Settings[]
        categories?: Category[]
        recurrings?: Recurring[]
        funds?: Fund[]
        habits?: Habit[]
        goals?: Goal[]
        ideas?: Idea[]
        reviews?: WeeklyReview[]
      }
    | undefined
  if (!config) return false
  const transactions: Transaction[] = []
  const habitLogs: HabitLog[] = []
  for (const [id, body] of docs) {
    if (id.startsWith('tx-')) transactions.push(...((body.items as Transaction[]) ?? []))
    if (id.startsWith('hl-')) habitLogs.push(...((body.items as HabitLog[]) ?? []))
  }
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()))
    await db.settings.bulkPut(config.settings ?? [])
    await db.categories.bulkPut(config.categories ?? [])
    await db.recurrings.bulkPut(config.recurrings ?? [])
    await db.funds.bulkPut(config.funds ?? [])
    await db.habits.bulkPut(config.habits ?? [])
    await db.goals.bulkPut(config.goals ?? [])
    await db.ideas.bulkPut(config.ideas ?? [])
    await db.reviews.bulkPut(config.reviews ?? [])
    await db.transactions.bulkPut(transactions)
    await db.habitLogs.bulkPut(habitLogs)
  })
  for (const [id, body] of await localBodies()) written.set(id, JSON.stringify(body))
  // Documentos de meses que ya no existen localmente se limpiarán en el próximo guardado
  for (const id of docs.keys()) if (!written.has(id)) written.set(id, '')
  return true
}

let pushing = false
let again = false

async function push() {
  if (!coll) return
  if (pushing) {
    again = true
    return
  }
  pushing = true
  try {
    const bodies = await localBodies()
    const changed = [...bodies].filter(([id, b]) => written.get(id) !== JSON.stringify(b))
    const removed = [...written.keys()].filter((id) => !bodies.has(id))
    if (changed.length || removed.length) {
      setStatus('guardando')
      // Una escritura cada vez, esperando a que termine
      for (const [id, b] of changed) {
        await coll.doc(id).set(b)
        written.set(id, JSON.stringify(b))
      }
      for (const id of removed) {
        await coll.doc(id).delete()
        written.delete(id)
      }
    }
    setStatus('guardado')
  } catch {
    setStatus('error')
  } finally {
    pushing = false
    if (again) {
      again = false
      void push()
    }
  }
}

/** Sube los cambios a la nube (agrupados, 1 s después del último cambio) */
export function startAutoSave() {
  if (!coll) return
  let timer: number | undefined
  let first = true
  liveQuery(() => Promise.all(allTables().map((t) => t.toArray()))).subscribe(() => {
    if (first) {
      first = false
      void push()
      return
    }
    window.clearTimeout(timer)
    timer = window.setTimeout(() => void push(), 1000)
  })
}
