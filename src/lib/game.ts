import type { AppData } from '../db/hooks'
import { isBudgetExpense, monthSummary, net, rootId } from './calc'
import { addDaysISO, monthKey, shiftMonth, today, toISO, weekRange } from './dates'
import { money0 } from './format'
import { streakDays, streakWeeks, weekProgress } from './habits'

/**
 * Puntos derivados de tus datos (no se guardan aparte): así siempre cuadran
 * en el móvil y en el ordenador, y no se pueden "perder".
 */
export const XP = {
  manualTx: 5,
  importTx: 1,
  teach: 5,
  importDone: 25,
  habitDay: 10,
  autoDay: 3,
  weekMet: 40,
  review: 50,
  step: 30,
  goalDone: 200,
  monthUnder: 150,
  challenge: 100,
}

const LEVEL_NAMES = ['Principiante', 'En marcha', 'Constante', 'Enfocado', 'Disciplinado', 'Imparable', 'Maestro', 'Leyenda']

/** XP total necesario para llegar al nivel n (1 = 0 XP) */
const xpForLevel = (n: number) => (150 * (n - 1) * n) / 2

export function levelOf(xp: number) {
  let n = 1
  while (xp >= xpForLevel(n + 1)) n++
  return {
    level: n,
    name: LEVEL_NAMES[Math.min(n - 1, LEVEL_NAMES.length - 1)] + (n > LEVEL_NAMES.length ? ` ${n - LEVEL_NAMES.length + 1}` : ''),
    from: xpForLevel(n),
    to: xpForLevel(n + 1),
  }
}

const dayOf = (ms: number) => toISO(new Date(ms))

// ── Desafío semanal ─────────────────────────────────────────────────────

export interface Challenge {
  id: string
  icon: string
  title: string
  detail: string
  /** 0–1 */
  progress: number
  done: boolean
  /** ¿Se puede perder todavía? (para gastar menos de X: sí hasta el domingo) */
  failed: boolean
}

function challengeFor(data: AppData, ref: Date): Challenge | undefined {
  const { start, end } = weekRange(ref)
  const now = today()
  const closed = end < now
  const catMap = data.catMap
  const weekIdx = Math.floor(new Date(start).getTime() / (7 * 864e5))
  const candidates: (() => Challenge | undefined)[] = [
    // Gastar menos en tu categoría variable más alta de las últimas 4 semanas
    () => {
      const from = addDaysISO(start, -28)
      const per = new Map<string, number>()
      for (const t of data.transactions) {
        if (!isBudgetExpense(t) || t.date < from || t.date >= start) continue
        const r = rootId(t.categoryId, catMap)
        if (r && catMap.get(r)?.type === 'variable') per.set(r, (per.get(r) ?? 0) + net(t))
      }
      const top = [...per].sort((a, b) => b[1] - a[1])[0]
      if (!top || top[1] < 40) return undefined
      const cat = catMap.get(top[0])!
      const limit = Math.round(((top[1] / 4) * 0.8) / 5) * 5
      const spent = data.transactions.filter((t) => isBudgetExpense(t) && t.date >= start && t.date <= end && rootId(t.categoryId, catMap) === cat.id).reduce((s, t) => s + net(t), 0)
      return {
        id: `cat-${cat.id}-${start}`,
        icon: cat.icon,
        title: `Menos de ${money0(limit)} en ${cat.name}`,
        detail: `Llevás ${money0(spent)} esta semana (tu media: ${money0(top[1] / 4)})`,
        progress: Math.min(1, spent / Math.max(1, limit)),
        done: closed && spent <= limit,
        failed: spent > limit,
      }
    },
    // Completar el hábito que más te cuesta
    () => {
      const hs = data.habits.filter((h) => h.active && !h.auto)
      if (!hs.length) return undefined
      const pick = hs[weekIdx % hs.length]
      const p = weekProgress(pick, data.byHabit.get(pick.id) ?? [], ref)
      return { id: `hab-${pick.id}-${start}`, icon: pick.icon, title: `Cumplí ${pick.name} esta semana`, detail: `${Math.round(p.done * 10) / 10} de ${p.target}`, progress: p.pct, done: p.met, failed: closed && !p.met }
    },
    // Días sin gastos variables
    () => {
      const target = 2
      let count = 0
      for (let d = start; d <= end && d < now; d = addDaysISO(d, 1))
        if (!data.transactions.some((t) => t.date === d && isBudgetExpense(t) && catMap.get(rootId(t.categoryId, catMap) ?? '')?.type === 'variable')) count++
      return { id: `nospend-${start}`, icon: '🧘', title: `${target} días sin gastos del día a día`, detail: `${count} de ${target} esta semana`, progress: Math.min(1, count / target), done: count >= target, failed: false }
    },
  ]
  const list = candidates.map((f) => f()).filter(Boolean) as Challenge[]
  if (!list.length) return undefined
  return list[weekIdx % list.length]
}

// ── Logros ──────────────────────────────────────────────────────────────

export interface Badge {
  id: string
  icon: string
  title: string
  detail: string
  earned: boolean
}

// ── Estado del juego ────────────────────────────────────────────────────

export function gameState(data: AppData) {
  const real = data.transactions.filter((t) => !t.sample)
  const manual = real.filter((t) => !t.importHash && !t.recurringId)
  const imported = real.filter((t) => t.importHash)
  const importDays = new Set(imported.map((t) => dayOf(t.createdAt)))
  const rules = Object.keys(data.settings.merchantRules ?? {}).length
  const rawLogs = data.habitLogs.filter((l) => !l.sample && l.value > 0)
  const habitDays = new Set(rawLogs.map((l) => `${l.habitId}|${l.date}`)).size
  const autoDays = data.habits.filter((h) => h.auto).reduce((s, h) => s + (data.byHabit.get(h.id)?.length ?? 0), 0)

  let weeksMet = 0
  let perfectWeek = false
  for (let i = 0; i < 26; i++) {
    const ref = new Date(Date.now() - i * 7 * 864e5)
    const active = data.habits.filter((h) => h.active && !h.auto)
    const met = active.filter((h) => weekProgress(h, data.byHabit.get(h.id) ?? [], ref).met)
    weeksMet += met.length
    if (i > 0 && active.length >= 2 && met.length === active.length) perfectWeek = true
  }

  const steps = data.goals.reduce((s, g) => s + (g.steps?.filter((x) => x.done).length ?? 0), 0)
  const goalsDone = data.goals.filter((g) => g.status === 'hecho').length

  // Meses cerrados dentro del presupuesto (solo si tenían movimientos)
  let monthsUnder = 0
  const cur = monthKey(today())
  for (let i = 1; i <= 12; i++) {
    const k = shiftMonth(cur, -i)
    if (!real.some((t) => t.date.startsWith(k) && t.kind === 'gasto')) continue
    const m = monthSummary(real, data.categories, data.recurrings, data.settings, k)
    if (m.budget > 0 && m.spent <= m.budget) monthsUnder++
  }

  // Desafíos de las últimas 8 semanas + la actual
  let challengesDone = 0
  for (let i = 0; i <= 8; i++) {
    const c = challengeFor(data, new Date(Date.now() - i * 7 * 864e5))
    if (c?.done) challengesDone++
  }
  const challenge = challengeFor(data, new Date())

  const breakdown = [
    { label: 'Gastos cargados a mano', count: manual.length, xp: manual.length * XP.manualTx },
    { label: 'Movimientos importados', count: imported.length, xp: imported.length * XP.importTx + importDays.size * XP.importDone },
    { label: 'Comercios que me enseñaste', count: rules, xp: rules * XP.teach },
    { label: 'Días de hábitos registrados', count: habitDays, xp: habitDays * XP.habitDay },
    { label: 'Días "sin" (tabaco…)', count: autoDays, xp: autoDays * XP.autoDay },
    { label: 'Objetivos semanales cumplidos', count: weeksMet, xp: weeksMet * XP.weekMet },
    { label: 'Revisiones semanales', count: data.reviews.length, xp: data.reviews.length * XP.review },
    { label: 'Pasos de metas', count: steps, xp: steps * XP.step },
    { label: 'Metas logradas', count: goalsDone, xp: goalsDone * XP.goalDone },
    { label: 'Meses dentro del presupuesto', count: monthsUnder, xp: monthsUnder * XP.monthUnder },
    { label: 'Desafíos semanales', count: challengesDone, xp: challengesDone * XP.challenge },
  ]
  const xp = breakdown.reduce((s, b) => s + b.xp, 0)

  // Racha de días activos: cualquier día en que cargaste algo
  const active = new Set<string>([...manual.map((t) => dayOf(t.createdAt)), ...rawLogs.map((l) => l.date), ...[...importDays], ...data.reviews.map((r) => dayOf(r.createdAt))])
  let d = today()
  if (!active.has(d)) d = addDaysISO(d, -1)
  let streak = 0
  while (active.has(d)) {
    streak++
    d = addDaysISO(d, -1)
  }
  const activeToday = active.has(today())

  const nosmoke = data.habits.find((h) => h.auto)
  const smokeDays = nosmoke ? streakDays(nosmoke, data.byHabit.get(nosmoke.id) ?? []) : 0
  const bestWeeks = Math.max(0, ...data.habits.filter((h) => !h.auto).map((h) => streakWeeks(h, data.byHabit.get(h.id) ?? [])))
  const savedMonth = Math.max(0, ...[0, 1, 2].map((i) => real.filter((t) => t.kind === 'transferencia' && t.date.startsWith(shiftMonth(cur, -i))).reduce((s, t) => s + t.amount, 0)))

  const badges: Badge[] = [
    { id: 'import', icon: '📥', title: 'Primer extracto', detail: 'Importaste movimientos del banco', earned: imported.length > 0 },
    { id: 'teacher', icon: '🧠', title: 'Buen maestro', detail: 'Me enseñaste 10 comercios', earned: rules >= 10 },
    { id: 'streak7', icon: '🔥', title: 'Una semana seguida', detail: '7 días seguidos usando la app', earned: streak >= 7 },
    { id: 'perfect', icon: '⭐', title: 'Semana perfecta', detail: 'Cumpliste todos tus hábitos una semana', earned: perfectWeek },
    { id: 'weeks4', icon: '💪', title: 'Un mes constante', detail: '4 semanas seguidas cumpliendo un hábito', earned: bestWeeks >= 4 },
    { id: 'smoke7', icon: '🚭', title: '7 días sin tabaco', detail: 'Una semana entera', earned: smokeDays >= 7 },
    { id: 'smoke30', icon: '🫁', title: '30 días sin tabaco', detail: 'Un mes. Tus pulmones lo notan', earned: smokeDays >= 30 },
    { id: 'green', icon: '💚', title: 'Mes en verde', detail: 'Cerraste un mes dentro del presupuesto', earned: monthsUnder > 0 },
    { id: 'saver', icon: '🏦', title: 'Ahorrador', detail: 'Ahorraste € 500 o más en un mes', earned: savedMonth >= 500 },
    { id: 'review4', icon: '🧭', title: 'Reflexivo', detail: '4 revisiones semanales', earned: data.reviews.length >= 4 },
    { id: 'goal', icon: '🏆', title: 'Meta cumplida', detail: 'Lograste un objetivo', earned: goalsDone > 0 },
    { id: 'challenge', icon: '🎯', title: 'Retador', detail: 'Completaste 3 desafíos semanales', earned: challengesDone >= 3 },
  ]

  return { xp, ...levelOf(xp), breakdown, streak, activeToday, challenge, badges }
}

export type GameState = ReturnType<typeof gameState>
