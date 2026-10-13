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
  /** Cuenta para la "tarjeta de gasto semanal" */
  weeklyPool: boolean
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
}
