import type { Category, DateStr, Fund, ID, Recurring, Settings, Transaction } from '../types'
import { dayInMonth, daysBetween, monthKey, monthRange, shiftMonth, today } from './dates'
import { money0 } from './format'

/** Lo que de verdad me cuesta un gasto (si es compartido, solo mi parte) */
export const net = (t: Transaction) => (t.shared ? t.shared.myShare : t.amount)

/** Gasto que cuenta para el presupuesto mensual (no los pagados desde una hucha) */
export const isBudgetExpense = (t: Transaction) => t.kind === 'gasto' && !t.fundId

export const inRange = (t: Transaction, start: DateStr, end: DateStr) => t.date >= start && t.date <= end

export const byId = <T extends { id: ID }>(list: T[]) => new Map(list.map((x) => [x.id, x]))

/** Id de la categoría raíz (las subcategorías suman en su padre) */
export function rootId(id: ID | undefined, cats: Map<ID, Category>): ID | undefined {
  let c = id ? cats.get(id) : undefined
  let guard = 0
  while (c?.parentId && cats.has(c.parentId) && guard++ < 10) c = cats.get(c.parentId)
  return c?.id ?? id
}

export const monthTxs = (txs: Transaction[], key: string) => {
  const { start, end } = monthRange(key)
  return txs.filter((t) => inRange(t, start, end))
}

/** Gasto neto por categoría raíz */
export function spentByRoot(txs: Transaction[], cats: Map<ID, Category>) {
  const out = new Map<ID, number>()
  for (const t of txs) {
    if (!isBudgetExpense(t)) continue
    const r = rootId(t.categoryId, cats) ?? 'sin-categoria'
    out.set(r, (out.get(r) ?? 0) + net(t))
  }
  return out
}

/** Gasto neto por categoría exacta (para subcategorías) */
export function spentByCategory(txs: Transaction[]) {
  const out = new Map<ID, number>()
  for (const t of txs) {
    if (!isBudgetExpense(t) || !t.categoryId) continue
    out.set(t.categoryId, (out.get(t.categoryId) ?? 0) + net(t))
  }
  return out
}

/** Aportado a cada categoría de ahorro (transferencias) */
export function savedByCategory(txs: Transaction[]) {
  const out = new Map<ID, number>()
  for (const t of txs) {
    if (t.kind !== 'transferencia' || !t.categoryId) continue
    out.set(t.categoryId, (out.get(t.categoryId) ?? 0) + t.amount)
  }
  return out
}

export type Level = 'ok' | 'warn' | 'over'
export const level = (spent: number, budget: number): Level => {
  if (budget <= 0) return spent > 0 ? 'over' : 'ok'
  const r = spent / budget
  return r > 1 ? 'over' : r >= 0.8 ? 'warn' : 'ok'
}

/**
 * Ritmo del mes para lo variable (súper, ocio, cafés…): cuánto queda,
 * cuánto podés gastar al día y la curva acumulada frente al ritmo ideal.
 */
export function monthPace(txs: Transaction[], cats: Category[], key: string) {
  const catMap = byId(cats)
  const variableRoots = cats.filter((c) => !c.parentId && !c.archived && c.type === 'variable')
  const isVariable = new Set(variableRoots.map((c) => c.id))
  const budget = variableRoots.reduce((s, c) => s + c.monthlyBudget, 0)
  const { start, end, days } = monthRange(key)
  const prevKey = shiftMonth(key, -1)
  const prev = monthRange(prevKey)
  const now = today()
  const isCurrent = now >= start && now <= end
  const todayDay = isCurrent ? Number(now.slice(8, 10)) : now > end ? days : 0

  const perDay = new Array(days + 1).fill(0)
  const prevPerDay = new Array(32).fill(0)
  for (const t of txs) {
    if (!isBudgetExpense(t)) continue
    const r = rootId(t.categoryId, catMap)
    if (!r || !isVariable.has(r)) continue
    if (inRange(t, start, end)) perDay[Number(t.date.slice(8, 10))] += net(t)
    else if (inRange(t, prev.start, prev.end)) prevPerDay[Number(t.date.slice(8, 10))] += net(t)
  }
  let acc = 0
  let prevAcc = 0
  const series = []
  for (let d = 1; d <= days; d++) {
    acc += perDay[d]
    prevAcc += d <= prev.days ? prevPerDay[d] : 0
    series.push({ day: d, actual: d <= todayDay ? Math.round(acc * 100) / 100 : null, ideal: Math.round((budget * d) / days), prev: Math.round(prevAcc) })
  }
  const spent = perDay.reduce((s, v) => s + v, 0)
  const daysLeft = isCurrent ? days - todayDay + 1 : 0
  const remaining = budget - spent
  const idealToday = (budget * todayDay) / days
  // Días sin gasto variable (hasta ayer, si el mes está en curso)
  const countedDays = isCurrent ? todayDay - 1 : todayDay
  // Solo cuentan los días desde que empezaste a registrar gastos
  const first = txs.reduce((m, t) => (t.date < m ? t.date : m), '9999')
  const firstDay = first < start ? 1 : first <= end ? Number(first.slice(8, 10)) : days + 1
  let noSpendDays = 0
  for (let d = firstDay; d <= countedDays; d++) if (perDay[d] === 0) noSpendDays++
  return {
    budget,
    spent,
    remaining,
    daysLeft,
    perDayAllowed: daysLeft > 0 ? Math.max(0, remaining) / daysLeft : 0,
    /** Positivo = vas por debajo del ritmo ideal */
    vsPace: idealToday - spent,
    noSpendDays,
    series,
    isCurrent,
  }
}

export interface RecurringStatus {
  recurring: Recurring
  due: DateStr
  paid?: Transaction
  overdue: boolean
}

export function recurringStatus(recs: Recurring[], txs: Transaction[], key: string): RecurringStatus[] {
  const mtx = monthTxs(txs, key)
  const now = today()
  return recs
    .filter((r) => r.active)
    .map((r) => {
      const due = dayInMonth(key, r.dayOfMonth)
      const paid = mtx.find((t) => t.recurringId === r.id)
      return { recurring: r, due, paid, overdue: !paid && due < now }
    })
    .sort((a, b) => a.due.localeCompare(b.due) || a.recurring.name.localeCompare(b.recurring.name))
}

export function monthSummary(txs: Transaction[], cats: Category[], recs: Recurring[], settings: Settings, key: string) {
  const catMap = byId(cats)
  const mtx = monthTxs(txs, key)
  const income = mtx.filter((t) => t.kind === 'ingreso').reduce((s, t) => s + t.amount, 0)
  const spent = mtx.filter(isBudgetExpense).reduce((s, t) => s + net(t), 0)
  const saved = mtx.filter((t) => t.kind === 'transferencia').reduce((s, t) => s + t.amount, 0)
  const fromFunds = mtx.filter((t) => t.kind === 'gasto' && t.fundId).reduce((s, t) => s + net(t), 0)

  const roots = cats.filter((c) => !c.parentId && !c.archived)
  const expenseRoots = roots.filter((c) => c.type === 'fijo' || c.type === 'variable')
  const budget = expenseRoots.reduce((s, c) => s + c.monthlyBudget, 0)
  const savingsBudget = roots.filter((c) => c.type === 'ahorro').reduce((s, c) => s + c.monthlyBudget, 0)
  const byRoot = spentByRoot(mtx, catMap)

  // Proyección: lo variable se extrapola al ritmo actual; lo fijo pendiente se suma tal cual
  const now = today()
  const { start, end, days } = monthRange(key)
  const isCurrent = now >= start && now <= end
  const isFuture = now < start
  const elapsed = isCurrent ? Number(now.slice(8, 10)) : days
  let variableSpent = 0
  for (const [id, v] of byRoot) if (catMap.get(id)?.type === 'variable') variableSpent += v
  const pending = recurringStatus(recs, txs, key).filter((r) => !r.paid)
  const pendingExpenses = pending.filter((r) => r.recurring.kind === 'gasto').reduce((s, r) => s + r.recurring.amount, 0)
  const pendingSavings = pending.filter((r) => r.recurring.kind === 'transferencia').reduce((s, r) => s + r.recurring.amount, 0)
  const pendingIncome = pending.filter((r) => r.recurring.kind === 'ingreso').reduce((s, r) => s + r.recurring.amount, 0)

  const variableProjected = isCurrent && elapsed > 0 ? (variableSpent / elapsed) * days : variableSpent
  const projectedSpent = isCurrent || isFuture ? spent - variableSpent + variableProjected + pendingExpenses : spent
  const projectedIncome = isCurrent || isFuture ? Math.max(income + pendingIncome, settings.monthlyIncome) : income
  /** Lo que queda libre + lo que mando a huchas = ahorro total del mes */
  const projectedSaving = projectedIncome - projectedSpent
  const savingRate = projectedIncome > 0 ? (projectedSaving / projectedIncome) * 100 : 0

  let housingSpent = 0
  let housingBudget = 0
  for (const c of roots) {
    if (!c.housing) continue
    housingSpent += byRoot.get(c.id) ?? 0
    housingBudget += c.monthlyBudget
  }
  const housingBase = isCurrent || isFuture ? Math.max(housingSpent, housingBudget) : housingSpent
  const housingPct = projectedIncome > 0 ? (housingBase / projectedIncome) * 100 : 0

  return {
    income,
    spent,
    saved,
    fromFunds,
    budget,
    savingsBudget,
    byRoot,
    isCurrent,
    elapsed,
    days,
    projectedSpent,
    projectedIncome,
    projectedSaving,
    pendingSavings,
    savingRate,
    housingPct,
    remaining: days - elapsed,
  }
}

export function fundBalance(fund: Fund, txs: Transaction[]) {
  let b = fund.initialBalance
  for (const t of txs) {
    if (t.fundId !== fund.id) continue
    if (t.kind === 'transferencia') b += t.amount
    else if (t.kind === 'gasto') b -= net(t)
  }
  return b
}

/** Aportación mensual necesaria para llegar a la meta en la fecha */
export function monthlyNeeded(fund: Fund, balance: number) {
  if (!fund.target || !fund.deadline) return undefined
  const left = fund.target - balance
  if (left <= 0) return 0
  const days = daysBetween(today(), fund.deadline)
  const months = Math.max(1, Math.ceil(days / 30.44))
  return left / months
}

/** Categorías ordenadas por uso en los últimos 60 días */
export function usageRank(txs: Transaction[]) {
  const since = new Date()
  since.setDate(since.getDate() - 60)
  const from = since.toISOString().slice(0, 10)
  const out = new Map<ID, number>()
  for (const t of txs) {
    if (t.date < from || !t.categoryId || t.recurringId) continue
    out.set(t.categoryId, (out.get(t.categoryId) ?? 0) + 1)
  }
  return out
}

export interface Alert {
  tone: 'warn' | 'over' | 'good' | 'info'
  text: string
}

/** Avisos sencillos basados en reglas */
export function alerts(txs: Transaction[], cats: Category[], recs: Recurring[], settings: Settings): Alert[] {
  const key = monthKey(today())
  const s = monthSummary(txs, cats, recs, settings, key)
  const out: Alert[] = []
  for (const c of cats) {
    if (c.parentId || c.archived || (c.type !== 'variable' && c.type !== 'fijo')) continue
    const spent = s.byRoot.get(c.id) ?? 0
    if (c.monthlyBudget <= 0) continue
    const r = spent / c.monthlyBudget
    if (r > 1) out.push({ tone: 'over', text: `${c.icon} ${c.name}: te pasaste ${money0(spent - c.monthlyBudget)} del presupuesto.` })
    else if (r >= 0.8 && c.type === 'variable')
      out.push({ tone: 'warn', text: `${c.icon} Llevás el ${Math.round(r * 100)} % de ${c.name} y quedan ${s.remaining} días.` })
  }
  const prev = monthSummary(txs, cats, recs, settings, monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)))
  for (const c of cats) {
    if (c.parentId || c.type !== 'variable') continue
    const now = s.byRoot.get(c.id) ?? 0
    const before = prev.byRoot.get(c.id) ?? 0
    // Comparamos al mismo día del mes anterior para ser justos
    const beforeSameDay = (before / prev.days) * s.elapsed
    if (before > 0 && now < beforeSameDay - 10)
      out.push({ tone: 'good', text: `${c.icon} Vas ${money0(beforeSameDay - now)} por debajo del mes pasado en ${c.name}. ¡Seguí así!` })
  }
  if (s.housingPct > settings.housingTarget)
    out.push({ tone: 'warn', text: `🏠 La vivienda se lleva el ${Math.round(s.housingPct)} % de tu sueldo (tu objetivo es ≤ ${settings.housingTarget} %).` })
  const overdue = recurringStatus(recs, txs, key).filter((r) => r.overdue && r.recurring.kind === 'gasto')
  if (overdue.length) out.push({ tone: 'info', text: `📌 Tenés ${overdue.length} pago${overdue.length > 1 ? 's' : ''} fijo${overdue.length > 1 ? 's' : ''} sin marcar como pagado.` })
  return out
}

/**
 * Plan de ahorro: lo que tu presupuesto deja libre cada mes frente a lo que
 * necesitás aportar para llegar a tiempo a cada meta.
 */
export function savingsPlan(cats: Category[], funds: Fund[], txs: Transaction[], income: number) {
  const roots = cats.filter((c) => !c.parentId && !c.archived)
  const expenses = roots.filter((c) => c.type === 'fijo' || c.type === 'variable').reduce((s, c) => s + c.monthlyBudget, 0)
  const free = income - expenses
  const items = funds
    .filter((f) => !f.archived)
    .map((f) => {
      const balance = fundBalance(f, txs)
      return { fund: f, balance, needed: monthlyNeeded(f, balance) ?? 0, eta: fundEta(f, balance, txs) }
    })
  const needed = items.reduce((s, i) => s + i.needed, 0)
  return { free, needed, items }
}

/** Ritmo real de aportes (media de los últimos 3 meses) y fecha estimada para llegar a la meta */
export function fundEta(f: Fund, balance: number, txs: Transaction[]) {
  if (!f.target || balance >= f.target) return undefined
  const from = shiftMonth(monthKey(today()), -3) + '-01'
  const contributed = txs.filter((t) => t.fundId === f.id && t.date >= from).reduce((s, t) => s + (t.kind === 'transferencia' ? t.amount : t.kind === 'gasto' ? -net(t) : 0), 0)
  const perMonth = contributed / 3
  if (perMonth <= 0) return { perMonth: 0, months: undefined }
  return { perMonth, months: Math.ceil((f.target - balance) / perMonth) }
}
