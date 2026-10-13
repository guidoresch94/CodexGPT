import type { Category, DateStr, Fund, ID, Recurring, Settings, Transaction } from '../types'
import { dayInMonth, daysBetween, daysLeftInWeek, monthKey, monthRange, today, weekDays, weekRange } from './dates'

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

export const isWeekly = (c: Category | undefined, cats: Map<ID, Category>) => {
  if (!c) return false
  if (c.weeklyPool) return true
  const r = rootId(c.id, cats)
  return r ? !!cats.get(r)?.weeklyPool : false
}

export function weekly(txs: Transaction[], cats: Map<ID, Category>, settings: Settings, ref = new Date()) {
  const { start, end } = weekRange(ref)
  const days = weekDays(ref)
  const perDay = new Map(days.map((d) => [d, 0]))
  let spent = 0
  for (const t of txs) {
    if (!isBudgetExpense(t) || !inRange(t, start, end)) continue
    if (!isWeekly(cats.get(t.categoryId ?? ''), cats)) continue
    spent += net(t)
    perDay.set(t.date, (perDay.get(t.date) ?? 0) + net(t))
  }
  const remaining = settings.weeklyAllowance - spent
  const daysLeft = daysLeftInWeek(ref)
  return {
    start,
    end,
    spent,
    remaining,
    daysLeft,
    perDayAllowed: Math.max(0, remaining) / daysLeft,
    days: days.map((d) => ({ date: d, amount: perDay.get(d) ?? 0 })),
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
  const catMap = byId(cats)
  for (const c of cats) {
    if (c.parentId || c.archived || (c.type !== 'variable' && c.type !== 'fijo')) continue
    const spent = s.byRoot.get(c.id) ?? 0
    if (c.monthlyBudget <= 0) continue
    const r = spent / c.monthlyBudget
    if (r > 1) out.push({ tone: 'over', text: `${c.icon} ${c.name}: te has pasado ${Math.round(spent - c.monthlyBudget)} € del presupuesto.` })
    else if (r >= 0.8 && c.type === 'variable')
      out.push({ tone: 'warn', text: `${c.icon} Llevas el ${Math.round(r * 100)} % de ${c.name} y quedan ${s.remaining} días.` })
  }
  const prev = monthSummary(txs, cats, recs, settings, monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)))
  for (const c of cats) {
    if (c.parentId || c.type !== 'variable') continue
    const now = s.byRoot.get(c.id) ?? 0
    const before = prev.byRoot.get(c.id) ?? 0
    // Comparamos al mismo día del mes anterior para ser justos
    const beforeSameDay = (before / prev.days) * s.elapsed
    if (before > 0 && now < beforeSameDay - 10)
      out.push({ tone: 'good', text: `${c.icon} Vas ${Math.round(beforeSameDay - now)} € por debajo en ${c.name} que el mes pasado a estas alturas. ¡Sigue así!` })
  }
  const w = weekly(txs, catMap, settings)
  if (w.remaining < 0) out.push({ tone: 'over', text: `💳 Te has pasado ${Math.round(-w.remaining)} € de la tarjeta semanal. Se reinicia el lunes.` })
  if (s.housingPct > settings.housingTarget)
    out.push({ tone: 'warn', text: `🏠 Vivienda = ${Math.round(s.housingPct)} % del sueldo (objetivo ≤ ${settings.housingTarget} %).` })
  const overdue = recurringStatus(recs, txs, key).filter((r) => r.overdue && r.recurring.kind === 'gasto')
  if (overdue.length) out.push({ tone: 'info', text: `📌 Tienes ${overdue.length} pago${overdue.length > 1 ? 's' : ''} fijo${overdue.length > 1 ? 's' : ''} sin marcar como pagado.` })
  return out
}
