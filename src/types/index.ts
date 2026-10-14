export type ID = string

/** Fecha en formato ISO corto: AAAA-MM-DD */
export type DateStr = string

export type CategoryType = 'fijo' | 'variable' | 'ahorro' | 'ingreso'

export interface Category {
  id: ID
  name: string
  icon: string // emoji
  color: string // hex
  parentId?: ID
  monthlyBudget: number
  type: CategoryType
  /** Obsoleto (antigua tarjeta semanal). Se conserva por compatibilidad. */
  weeklyPool?: boolean
  /** Cuenta para el % del sueldo en vivienda */
  housing?: boolean
  /** Hábito a reducir (ej. tabaco): objetivo ideal = 0 */
  reduce?: boolean
  /** Para categorías de ahorro: hucha a la que van las transferencias */
  fundId?: ID
  archived: boolean
  order: number
}

export type TxKind = 'gasto' | 'ingreso' | 'transferencia'

export interface SharedInfo {
  total: number
  myShare: number
}

export interface Transaction {
  id: ID
  date: DateStr
  /** Importe positivo. Para gastos compartidos es lo que pagué en total. */
  amount: number
  kind: TxKind
  categoryId?: ID
  /** transferencia → hucha destino; gasto → pagado desde esta hucha (no cuenta en el presupuesto) */
  fundId?: ID
  note?: string
  paymentMethod?: string
  shared?: SharedInfo
  recurringId?: ID
  sample?: boolean
  createdAt: number
}

export interface Recurring {
  id: ID
  name: string
  amount: number
  kind: TxKind
  categoryId?: ID
  fundId?: ID
  dayOfMonth: number
  active: boolean
}

export interface Fund {
  id: ID
  name: string
  icon: string
  color: string
  target?: number
  deadline?: DateStr
  initialBalance: number
  note?: string
  archived: boolean
  order: number
}

export type Theme = 'oscuro' | 'claro' | 'sistema'

export interface Settings {
  id: 'main'
  currency: 'EUR'
  locale: 'es-ES'
  weekStartsOn: 1
  monthlyIncome: number
  weeklyAllowance: number
  housingTarget: number // % máximo del sueldo en vivienda
  theme: Theme
  name: string
  paymentMethods: string[]
  /** Versión de datos por defecto ya añadidos (2 = hábitos y objetivos) */
  dataVersion?: number
}

export interface Backup {
  app: 'mi-vida'
  version: number
  exportedAt: string
  settings: Settings[]
  categories: Category[]
  transactions: Transaction[]
  recurrings: Recurring[]
  funds: Fund[]
  habits?: Habit[]
  habitLogs?: HabitLog[]
  goals?: Goal[]
  ideas?: Idea[]
  reviews?: WeeklyReview[]
}

// ── Crecimiento personal ────────────────────────────────────────────────

export type Area = 'Deporte' | 'Cultura' | 'Música' | 'Aprendizaje' | 'Salud' | 'Social' | 'Casa' | 'Finanzas'
export const AREAS: Area[] = ['Deporte', 'Salud', 'Cultura', 'Música', 'Aprendizaje', 'Finanzas', 'Social', 'Casa']

export type HabitUnit = 'veces' | 'min' | 'km' | 'paginas' | 'si_no'

export interface Habit {
  id: ID
  name: string
  icon: string
  color: string
  area: Area
  unit: HabitUnit
  /** Objetivo semanal en la unidad (para si_no: días por semana) */
  weeklyTarget: number
  /** Categoría de gasto enlazada (ej. pádel → Deporte, tabaco → Tabaco) */
  linkedCategoryId?: ID
  /**
   * Cómo se relaciona con los gastos de esa categoría:
   * - 'suma': un gasto ahí cuenta como sesión del hábito (sin cargarlo dos veces)
   * - 'rompe': un gasto ahí corta la racha (hábitos a dejar, ej. tabaco)
   */
  linkMode?: 'suma' | 'rompe'
  /**
   * Hábito "sin": cada día cuenta como cumplido automáticamente desde `since`,
   * salvo que haya una recaída (registro con valor -1) o un gasto que lo rompa.
   */
  auto?: boolean
  since?: DateStr
  active: boolean
  order: number
}

export interface HabitLog {
  id: ID
  habitId: ID
  date: DateStr
  /** Para auto: -1 = recaída */
  value: number
  /** Gasto que originó o acompaña este registro (para no duplicar) */
  txId?: ID
  sample?: boolean
}

export type GoalStatus = 'activo' | 'hecho' | 'pausado'

export interface Goal {
  id: ID
  title: string
  icon: string
  area: Area
  /** Con objetivo numérico (ej. 12 libros) o hito sí/no */
  target?: number
  current?: number
  unit?: string
  deadline?: DateStr
  status: GoalStatus
  note?: string
  linkedFundId?: ID
  linkedHabitId?: ID
  /** Pasos (checklist); si hay, el progreso es pasos hechos / total */
  steps?: { id: ID; text: string; done: boolean }[]
  createdAt: number
}

export type IdeaTag = 'casa' | 'viaje' | 'proyecto' | 'compra' | 'aprendizaje' | 'otro'
export type IdeaStatus = 'nueva' | 'evaluando' | 'convertida' | 'descartada'

export interface Idea {
  id: ID
  text: string
  tag: IdeaTag
  status: IdeaStatus
  cost?: number
  createdAt: number
}

export interface WeeklyReview {
  /** id = lunes de la semana (AAAA-MM-DD) */
  id: ID
  wins: string
  improve: string
  focus: string
  mood: number // 1–5
  score: number
  createdAt: number
}
