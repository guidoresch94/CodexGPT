import { allTables, db } from './schema'
import type { Category, Fund, Goal, Habit, HabitLog, Idea, Recurring, Settings, Transaction } from '../types'
import { dayInMonth, monthKey, monthRange, shiftMonth, toISO, today } from '../lib/dates'
import { round2, uid } from '../lib/format'

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  currency: 'EUR',
  locale: 'es-ES',
  weekStartsOn: 1,
  monthlyIncome: 2717,
  weeklyAllowance: 165,
  housingTarget: 52,
  theme: 'claro',
  name: 'Guido',
  paymentMethods: ['Tarjeta', 'Bizum', 'Efectivo', 'Domiciliación'],
  dataVersion: 4,
}

type CatSeed = Omit<Category, 'archived' | 'order'>

const CATS: CatSeed[] = [
  { id: 'alquiler', name: 'Alquiler', icon: '🏠', color: '#6366f1', monthlyBudget: 1250, type: 'fijo', housing: true },
  { id: 'suministros', name: 'Suministros', icon: '💡', color: '#f59e0b', monthlyBudget: 155, type: 'fijo', housing: true },
  { id: 'luz', name: 'Luz', icon: '⚡', color: '#fbbf24', monthlyBudget: 0, type: 'fijo', parentId: 'suministros' },
  { id: 'agua', name: 'Agua', icon: '💧', color: '#38bdf8', monthlyBudget: 0, type: 'fijo', parentId: 'suministros' },
  { id: 'internet', name: 'Internet', icon: '🌐', color: '#a78bfa', monthlyBudget: 0, type: 'fijo', parentId: 'suministros' },
  { id: 'super', name: 'Supermercado', icon: '🛒', color: '#22c55e', monthlyBudget: 300, type: 'variable' },
  { id: 'ocio', name: 'Restaurantes y ocio', icon: '🍻', color: '#f97316', monthlyBudget: 300, type: 'variable' },
  { id: 'bizum', name: 'Bizum amigos', icon: '🤝', color: '#fb923c', monthlyBudget: 0, type: 'variable', parentId: 'ocio' },
  { id: 'delivery', name: 'Delivery y cafés', icon: '☕', color: '#d97706', monthlyBudget: 35, type: 'variable' },
  { id: 'transporte', name: 'Transporte', icon: '🚲', color: '#06b6d4', monthlyBudget: 30, type: 'variable' },
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
  { id: 'r-viajes', name: 'Ahorro viajes', amount: 100, kind: 'transferencia', categoryId: 'viajes', fundId: 'f-viajes', dayOfMonth: 1, active: true },
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

// ── Hábitos, objetivos e ideas ──────────────────────────────────────────

const HABITS: Habit[] = [
  { id: 'h-gym', name: 'Gimnasio', icon: '🏋️', color: '#10b981', area: 'Deporte', unit: 'veces', weeklyTarget: 3, linkedCategoryId: 'deporte', linkMode: 'suma', active: true, order: 0 },
  { id: 'h-basket', name: 'Basket con amigos', icon: '🏀', color: '#f97316', area: 'Deporte', unit: 'veces', weeklyTarget: 1, active: true, order: 1 },
  { id: 'h-padel', name: 'Pádel', icon: '🎾', color: '#a3e635', area: 'Deporte', unit: 'veces', weeklyTarget: 1, active: true, order: 2 },
  { id: 'h-run', name: 'Running', icon: '🏃', color: '#38bdf8', area: 'Deporte', unit: 'km', weeklyTarget: 15, active: true, order: 3 },
  { id: 'h-guitar', name: 'Guitarra', icon: '🎸', color: '#a78bfa', area: 'Música', unit: 'min', weeklyTarget: 120, active: true, order: 4 },
  { id: 'h-read', name: 'Lectura', icon: '📚', color: '#f59e0b', area: 'Cultura', unit: 'paginas', weeklyTarget: 50, active: true, order: 5 },
  { id: 'h-nosmoke', name: 'Sin tabaco', icon: '🚭', color: '#34c759', area: 'Salud', unit: 'si_no', weeklyTarget: 7, linkedCategoryId: 'tabaco', linkMode: 'rompe', auto: true, active: true, order: 6 },
]

const MOTO_STEPS = () =>
  ['Examen teórico', 'Clases de pista', 'Examen de pista', 'Clases de circulación', 'Examen de circulación'].map((text, i) => ({ id: `s${i}`, text, done: false }))

const GOALS: Goal[] = [
  { id: 'g-tabaco', title: 'Dejar el tabaco', icon: '🚭', area: 'Salud', target: 30, current: 0, unit: 'días seguidos', status: 'activo', linkedHabitId: 'h-nosmoke', createdAt: 0 },
  { id: 'g-moto', title: 'Carnet de moto A2', icon: '🏍️', area: 'Aprendizaje', deadline: '2027-06-30', status: 'activo', steps: MOTO_STEPS(), createdAt: 0 },
  { id: 'g-guitarra', title: 'Tocar 3 canciones con la guitarra', icon: '🎸', area: 'Música', target: 3, current: 0, unit: 'canciones', status: 'activo', linkedHabitId: 'h-guitar', createdAt: 0 },
  { id: 'g-libros', title: 'Leer 12 libros en 2027', icon: '📚', area: 'Cultura', target: 12, current: 0, unit: 'libros', deadline: '2027-12-31', status: 'activo', createdAt: 0 },
  { id: 'g-emergencia', title: 'Fondo de emergencia completo', icon: '🛟', area: 'Casa', status: 'activo', linkedFundId: 'f-emergencia', createdAt: 0 },
]

const IDEAS: Idea[] = [
  { id: 'i-plantas', text: 'Plantas para el balcón del piso nuevo', tag: 'casa', status: 'nueva', cost: 60, createdAt: 0 },
  { id: 'i-japon', text: 'Viaje a Japón en primavera', tag: 'viaje', status: 'evaluando', cost: 2500, createdAt: 0 },
  { id: 'i-batch', text: 'Domingos de batch cooking para la semana', tag: 'casa', status: 'nueva', createdAt: 0 },
]

/** Registros de ejemplo de las últimas 10 semanas, con algo de variación realista */
function sampleHabitLogs(): HabitLog[] {
  const rand = rng(7)
  const logs: HabitLog[] = []
  const now = new Date()
  for (let back = 70; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)
    if (back === 0 && now.getHours() < 12) continue
    const date = toISO(d)
    const dow = (d.getDay() + 6) % 7 // 0 = lunes
    const push = (habitId: string, value: number) => logs.push({ id: uid(), habitId, date, value, sample: true })
    if ([0, 2, 4].includes(dow) && rand() < 0.75) push('h-gym', 1)
    if (dow === 3 && rand() < 0.8) push('h-basket', 1)
    if (dow === 5 && rand() < 0.6) push('h-padel', 1)
    if ([1, 6].includes(dow) && rand() < 0.65) push('h-run', Math.round(5 + rand() * 4))
    if (rand() < 0.35) push('h-guitar', [15, 20, 30, 45][Math.floor(rand() * 4)])
    if (rand() < 0.5) push('h-read', Math.round(8 + rand() * 20))
    if (back < 20 ? rand() < 0.75 : rand() < 0.4) push('h-nosmoke', 1)
  }
  return logs
}

export async function seedIfEmpty() {
  const exists = await db.settings.get('main')
  if (exists) return ensureUpgrades()
  await seedAll(true)
}

/** Para quien ya usaba la app: añade hábitos, objetivos e ideas por defecto una sola vez */
export async function ensureUpgrades() {
  await ensureV2()
  await ensureV3()
  await ensureV4()
}

async function ensureV2() {
  const s = await db.settings.get('main')
  if (!s || (s.dataVersion ?? 1) >= 2) return
  await db.transaction('rw', [db.settings, db.habits, db.goals, db.ideas], async () => {
    if (!(await db.habits.count())) await db.habits.bulkPut(HABITS)
    if (!(await db.goals.count())) await db.goals.bulkPut(GOALS.map((g) => ({ ...g, createdAt: Date.now() })))
    if (!(await db.ideas.count())) await db.ideas.bulkPut(IDEAS.map((i) => ({ ...i, createdAt: Date.now() })))
    await db.settings.update('main', { dataVersion: 2 })
  })
}

export async function seedAll(withSamples: boolean) {
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()))
    await db.settings.put(DEFAULT_SETTINGS)
    await db.categories.bulkPut(CATS.map((c, i) => ({ ...c, archived: false, order: i })))
    await db.funds.bulkPut(FUNDS)
    await db.recurrings.bulkPut(RECURRINGS)
    await db.habits.bulkPut(HABITS)
    await db.goals.bulkPut(GOALS.map((g) => ({ ...g, createdAt: Date.now() })))
    await db.ideas.bulkPut(IDEAS.map((i) => ({ ...i, createdAt: Date.now() })))
    if (withSamples) {
      await db.transactions.bulkPut(sampleTransactions())
      await db.habitLogs.bulkPut(sampleHabitLogs())
    }
  })
}

export async function clearSamples() {
  const ids = (await db.transactions.toArray()).filter((t) => t.sample).map((t) => t.id)
  const logIds = (await db.habitLogs.toArray()).filter((l) => l.sample).map((l) => l.id)
  await db.transactions.bulkDelete(ids)
  await db.habitLogs.bulkDelete(logIds)
  return ids.length + logIds.length
}

/**
 * v3: une gastos y hábitos. Limpia enlaces a categorías borradas, marca los
 * hábitos "sin" (tabaco) como automáticos y añade pasos al carnet de moto.
 */
async function ensureV3() {
  const s = await db.settings.get('main')
  if (!s || (s.dataVersion ?? 1) >= 3) return
  await db.transaction('rw', [db.settings, db.habits, db.habitLogs, db.goals, db.categories], async () => {
    const cats = new Set((await db.categories.toArray()).map((c) => c.id))
    const logs = await db.habitLogs.toArray()
    for (const h of await db.habits.toArray()) {
      const patch: Partial<Habit> = {}
      if (h.linkedCategoryId && !cats.has(h.linkedCategoryId)) patch.linkedCategoryId = undefined
      const linked = patch.linkedCategoryId === undefined && 'linkedCategoryId' in patch ? undefined : h.linkedCategoryId
      if (linked && !h.linkMode) patch.linkMode = h.unit === 'si_no' ? 'rompe' : 'suma'
      if (h.unit === 'si_no' && (patch.linkMode ?? h.linkMode) === 'rompe' && !h.auto) {
        const dates = logs.filter((l) => l.habitId === h.id).map((l) => l.date).sort()
        patch.auto = true
        patch.since = dates[0] ?? today()
      }
      if (/crypto|cripto|invers|bolsa/i.test(h.name) && h.area === 'Deporte') patch.area = 'Finanzas'
      if (Object.keys(patch).length) await db.habits.update(h.id, patch)
    }
    for (const g of await db.goals.toArray()) {
      if (/moto/i.test(g.title) && !g.steps?.length && g.status === 'activo') await db.goals.update(g.id, { steps: MOTO_STEPS() })
    }
    await db.settings.update('main', { dataVersion: 3 })
  })
}

/**
 * v4: un hábito "sin X" (tabaco, fumar…) enlazado en modo "suma" contaba cada compra
 * como un día cumplido. Se corrige a "dejarlo": cada día cuenta solo y la compra lo corta.
 */
async function ensureV4() {
  const s = await db.settings.get('main')
  if (!s || (s.dataVersion ?? 1) >= 4) return
  for (const h of await db.habits.toArray()) {
    const quitting = /\bsin\b|dejar|no fumar|tabaco|fumar|cigarr/i.test(h.name)
    if (h.unit === 'si_no' && h.linkedCategoryId && quitting && (h.linkMode !== 'rompe' || !h.auto))
      await db.habits.update(h.id, { linkMode: 'rompe', auto: true, since: h.since ?? today() })
  }
  await db.settings.update('main', { dataVersion: 4 })
}
