import { db } from './schema'
import type { Category, Fund, Recurring, Settings, Transaction } from '../types'
import { dayInMonth, monthKey, monthRange, shiftMonth, today } from '../lib/dates'
import { round2, uid } from '../lib/format'

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  currency: 'EUR',
  locale: 'es-ES',
  weekStartsOn: 1,
  monthlyIncome: 2717,
  weeklyAllowance: 165,
  housingTarget: 52,
  theme: 'oscuro',
  name: 'Guido',
  paymentMethods: ['Tarjeta', 'Bizum', 'Efectivo', 'Domiciliación'],
}

type CatSeed = Omit<Category, 'archived' | 'order' | 'weeklyPool'> & { weeklyPool?: boolean }

const CATS: CatSeed[] = [
  { id: 'alquiler', name: 'Alquiler', icon: '🏠', color: '#6366f1', monthlyBudget: 1250, type: 'fijo', housing: true },
  { id: 'suministros', name: 'Suministros', icon: '💡', color: '#f59e0b', monthlyBudget: 155, type: 'fijo', housing: true },
  { id: 'luz', name: 'Luz', icon: '⚡', color: '#fbbf24', monthlyBudget: 0, type: 'fijo', parentId: 'suministros' },
  { id: 'agua', name: 'Agua', icon: '💧', color: '#38bdf8', monthlyBudget: 0, type: 'fijo', parentId: 'suministros' },
  { id: 'internet', name: 'Internet', icon: '🌐', color: '#a78bfa', monthlyBudget: 0, type: 'fijo', parentId: 'suministros' },
  { id: 'super', name: 'Supermercado', icon: '🛒', color: '#22c55e', monthlyBudget: 300, type: 'variable', weeklyPool: true },
  { id: 'ocio', name: 'Restaurantes y ocio', icon: '🍻', color: '#f97316', monthlyBudget: 300, type: 'variable', weeklyPool: true },
  { id: 'bizum', name: 'Bizum amigos', icon: '🤝', color: '#fb923c', monthlyBudget: 0, type: 'variable', weeklyPool: true, parentId: 'ocio' },
  { id: 'delivery', name: 'Delivery y cafés', icon: '☕', color: '#d97706', monthlyBudget: 35, type: 'variable', weeklyPool: true },
  { id: 'transporte', name: 'Transporte', icon: '🚲', color: '#06b6d4', monthlyBudget: 30, type: 'variable', weeklyPool: true },
  { id: 'deporte', name: 'Deporte', icon: '🏋️', color: '#10b981', monthlyBudget: 75, type: 'fijo' },
  { id: 'compras', name: 'Compras', icon: '🛍️', color: '#ec4899', monthlyBudget: 60, type: 'variable' },
  { id: 'tabaco', name: 'Tabaco', icon: '🚬', color: '#94a3b8', monthlyBudget: 48, type: 'variable', reduce: true },
  { id: 'salud', name: 'Seguro, móvil y suscripciones', icon: '📱', color: '#14b8a6', monthlyBudget: 55, type: 'fijo' },
  { id: 'imprevistos', name: 'Imprevistos', icon: '🧯', color: '#ef4444', monthlyBudget: 50, type: 'variable' },
  { id: 'ahorro', name: 'Ahorro', icon: '🐷', color: '#34d399', monthlyBudget: 300, type: 'ahorro', fundId: 'f-emergencia' },
  { id: 'viajes', name: 'Viajes', icon: '✈️', color: '#60a5fa', monthlyBudget: 100, type: 'ahorro', fundId: 'f-viajes' },
  { id: 'nomina', name: 'Nómina', icon: '💼', color: '#34d399', monthlyBudget: 0, type: 'ingreso' },
  { id: 'bonus', name: 'Bonus', icon: '🎁', color: '#facc15', monthlyBudget: 0, type: 'ingreso' },
  { id: 'otros-ingresos', name: 'Otros ingresos', icon: '💶', color: '#a3e635', monthlyBudget: 0, type: 'ingreso' },
]

const FUNDS: Fund[] = [
  { id: 'f-emergencia', name: 'Fondo de emergencia', icon: '🛟', color: '#34d399', target: 8000, initialBalance: 4200, archived: false, order: 0, note: '3 meses de gastos' },
  { id: 'f-mudanza', name: 'Mudanza / Casa', icon: '📦', color: '#f59e0b', target: 3580, deadline: '2026-10-30', initialBalance: 3100, archived: false, order: 1, note: 'Fianza 1.250 · Prorrata oct ~80 · Noviembre 1.250 · Mudanza y casa 500–1.000' },
  { id: 'f-viajes', name: 'Viajes', icon: '✈️', color: '#60a5fa', target: 1500, deadline: '2027-06-30', initialBalance: 350, archived: false, order: 2 },
  { id: 'f-bonus', name: 'Bonus (100 % ahorro)', icon: '🎁', color: '#facc15', initialBalance: 0, archived: false, order: 3 },
]

const RECURRINGS: Recurring[] = [
  { id: 'r-nomina', name: 'Nómina', amount: 2717, kind: 'ingreso', categoryId: 'nomina', dayOfMonth: 1, active: true },
  { id: 'r-alquiler', name: 'Alquiler', amount: 1250, kind: 'gasto', categoryId: 'alquiler', dayOfMonth: 1, active: true },
  { id: 'r-ahorro', name: 'Págate primero: ahorro', amount: 300, kind: 'transferencia', categoryId: 'ahorro', fundId: 'f-emergencia', dayOfMonth: 1, active: true },
  { id: 'r-viajes', name: 'Hucha viajes', amount: 100, kind: 'transferencia', categoryId: 'viajes', fundId: 'f-viajes', dayOfMonth: 1, active: true },
  { id: 'r-gym', name: 'Gimnasio', amount: 40, kind: 'gasto', categoryId: 'deporte', dayOfMonth: 2, active: true },
  { id: 'r-movil', name: 'Móvil', amount: 15, kind: 'gasto', categoryId: 'salud', dayOfMonth: 3, active: true },
  { id: 'r-internet', name: 'Internet', amount: 35, kind: 'gasto', categoryId: 'internet', dayOfMonth: 5, active: true },
  { id: 'r-seguro', name: 'Seguro de salud', amount: 30, kind: 'gasto', categoryId: 'salud', dayOfMonth: 5, active: true },
  { id: 'r-luz', name: 'Luz', amount: 60, kind: 'gasto', categoryId: 'luz', dayOfMonth: 10, active: true },
  { id: 'r-spotify', name: 'Spotify', amount: 9.99, kind: 'gasto', categoryId: 'salud', dayOfMonth: 12, active: true },
  { id: 'r-agua', name: 'Agua', amount: 25, kind: 'gasto', categoryId: 'agua', dayOfMonth: 20, active: true },
]

// Plantillas de gasto variable: [categoría, nota, min, max, veces por semana]
const VARIABLES: [string, string, number, number, number][] = [
  ['super', 'Mercadona', 22, 55, 1],
  ['super', 'Lidl', 12, 30, 0.8],
  ['super', 'Bonpreu', 6, 18, 0.6],
  ['ocio', 'Cañas', 8, 22, 1.2],
  ['ocio', 'Cena', 18, 40, 0.7],
  ['bizum', 'Bizum amigos', 10, 25, 0.6],
  ['delivery', 'Café', 1.8, 3.5, 2],
  ['delivery', 'Glovo', 14, 22, 0.2],
  ['transporte', 'Bicing', 1, 3, 1],
  ['deporte', 'Pádel', 6, 9, 0.8],
  ['compras', 'Ropa / tech', 15, 45, 0.3],
  ['tabaco', 'Estanco', 5.5, 5.5, 1],
  ['imprevistos', 'Farmacia', 6, 20, 0.15],
]

/** Pseudoaleatorio determinista para que los datos de ejemplo sean estables */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function sampleTransactions(): Transaction[] {
  const rand = rng(42)
  const now = today()
  const current = monthKey(now)
  const months = [shiftMonth(current, -2), shiftMonth(current, -1), current]
  const txs: Transaction[] = []
  const base = { sample: true, createdAt: Date.now() }

  for (const m of months) {
    const { days } = monthRange(m)
    for (const r of RECURRINGS) {
      const date = dayInMonth(m, r.dayOfMonth)
      if (date > now) continue
      const amount = r.categoryId === 'luz' || r.categoryId === 'agua' ? round2(r.amount * (0.85 + rand() * 0.3)) : r.amount
      txs.push({ ...base, id: uid(), date, amount, kind: r.kind, categoryId: r.categoryId, fundId: r.fundId, recurringId: r.id, note: r.name, paymentMethod: 'Domiciliación' })
    }
    for (let d = 1; d <= days; d++) {
      const date = dayInMonth(m, d)
      if (date > now) break
      for (const [categoryId, note, min, max, perWeek] of VARIABLES) {
        if (rand() < perWeek / 7) {
          txs.push({ ...base, id: uid(), date, amount: round2(min + rand() * (max - min)), kind: 'gasto', categoryId, note, paymentMethod: categoryId === 'bizum' ? 'Bizum' : 'Tarjeta' })
        }
      }
    }
  }

  // Un gasto compartido y un gasto pagado desde la hucha de mudanza
  const d5 = dayInMonth(current, Math.min(5, Number(now.slice(8, 10))))
  txs.push({ ...base, id: uid(), date: d5, amount: 64, kind: 'gasto', categoryId: 'ocio', note: 'Cena cumple (pagué yo)', paymentMethod: 'Tarjeta', shared: { total: 64, myShare: 21.33 } })
  txs.push({ ...base, id: uid(), date: d5, amount: 320, kind: 'gasto', categoryId: 'compras', fundId: 'f-mudanza', note: 'IKEA colchón y somier', paymentMethod: 'Tarjeta' })
  return txs
}

export async function seedIfEmpty() {
  const exists = await db.settings.get('main')
  if (exists) return
  await seedAll(true)
}

export async function seedAll(withSamples: boolean) {
  await db.transaction('rw', [db.settings, db.categories, db.transactions, db.recurrings, db.funds], async () => {
    await Promise.all([db.settings.clear(), db.categories.clear(), db.transactions.clear(), db.recurrings.clear(), db.funds.clear()])
    await db.settings.put(DEFAULT_SETTINGS)
    await db.categories.bulkPut(CATS.map((c, i) => ({ weeklyPool: false, ...c, archived: false, order: i })))
    await db.funds.bulkPut(FUNDS)
    await db.recurrings.bulkPut(RECURRINGS)
    if (withSamples) await db.transactions.bulkPut(sampleTransactions())
  })
}

export async function clearSamples() {
  const ids = (await db.transactions.toArray()).filter((t) => t.sample).map((t) => t.id)
  await db.transactions.bulkDelete(ids)
  return ids.length
}
