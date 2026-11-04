/** Todos los importes se guardan en céntimos (enteros) para evitar errores de redondeo. */
export type Cents = number

/** Mes en formato 'YYYY-MM'. */
export type MonthKey = string
/** Fecha en formato 'YYYY-MM-DD'. */
export type DateKey = string

export type Group = 'necesidades' | 'gustos' | 'ahorro'
export type PaymentMethod = 'efectivo' | 'debito' | 'credito' | 'transferencia'

export interface Settings {
  /** Día del mes (1-28) en que se cobra la tarjeta de crédito. */
  cardPayDay: number
  /** Ingreso mensual usado como referencia en el plan anual. */
  referenceIncome: Cents
}

export interface Category {
  id: string
  name: string
  group: Group
  icon: string
  sortOrder: number
  /** Categoría padre (un solo nivel). Las subcategorías heredan el bloque 50/30/20 del padre. */
  parentId?: string | null
}

export interface MonthPlan {
  month: MonthKey
  income: Cents
  extraIncome: Cents
  savingsGoal: Cents
}

export interface BudgetItem {
  month: MonthKey
  categoryId: string
  amount: Cents
}

export interface MonthBudget {
  plan: MonthPlan | null
  items: BudgetItem[]
}

export interface Expense {
  id: string
  date: DateKey
  categoryId: string | null
  amount: Cents
  description: string
  method: PaymentMethod
  /** Fecha en que sale el dinero de la cuenta. */
  chargeDate: DateKey
}

export interface PlannedExpense {
  id: string
  name: string
  amount: Cents
  year: number
  /** 1-12 */
  month: number
  categoryId: string | null
  repeatsYearly: boolean
}

export const GROUP_LABELS: Record<Group, string> = {
  necesidades: 'Necesidades',
  gustos: 'Gustos',
  ahorro: 'Ahorro y deuda',
}

export const GROUP_TARGETS: Record<Group, number> = {
  necesidades: 50,
  gustos: 30,
  ahorro: 20,
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  debito: 'Tarjeta de débito',
  credito: 'Tarjeta de crédito',
  transferencia: 'Transferencia',
}

export const DEFAULT_SETTINGS: Settings = { cardPayDay: 15, referenceIncome: 0 }

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Vivienda', group: 'necesidades', icon: 'home', sortOrder: 0 },
  { name: 'Alimentación', group: 'necesidades', icon: 'cart', sortOrder: 1 },
  { name: 'Transporte', group: 'necesidades', icon: 'car', sortOrder: 2 },
  { name: 'Servicios', group: 'necesidades', icon: 'zap', sortOrder: 3 },
  { name: 'Salud', group: 'necesidades', icon: 'heart', sortOrder: 4 },
  { name: 'Ocio', group: 'gustos', icon: 'party', sortOrder: 5 },
  { name: 'Otros', group: 'gustos', icon: 'dots', sortOrder: 6 },
  { name: 'Ahorro', group: 'ahorro', icon: 'piggy', sortOrder: 7 },
]
