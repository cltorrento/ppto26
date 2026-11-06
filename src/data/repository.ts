import type {
  BudgetItem,
  Category,
  Cents,
  DateKey,
  Expense,
  MonthBudget,
  MonthKey,
  MonthPlan,
  PlannedExpense,
  Property,
  Settings,
} from '@/domain/types'

/**
 * Contrato de acceso a datos. Hay dos implementaciones: `localRepository` (localStorage, sin cuenta)
 * y `supabaseRepository` (Postgres + RLS). La interfaz no sabe cuál se usa.
 */
export interface Repository {
  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>

  listCategories(): Promise<Category[]>
  /**
   * Reemplaza el conjunto de categorías (crea, actualiza y elimina). Los gastos de una categoría eliminada
   * pasan a su categoría padre si ésta se conserva; si no, quedan «sin categoría».
   */
  saveCategories(categories: Category[]): Promise<void>

  /**
   * Mueve las partidas de presupuesto de varias categorías a otra, sumando por mes. Se usa al crear la
   * primera subcategoría (padre → hija) y al borrar la última (hijas → padre), para que el total no cambie.
   */
  reassignBudgetItems(fromIds: string[], toId: string): Promise<void>

  getMonthBudget(month: MonthKey): Promise<MonthBudget>
  /** Guarda el plan del mes y reemplaza todas sus partidas. */
  saveMonthBudget(plan: MonthPlan, items: BudgetItem[]): Promise<void>
  listYearBudgets(year: number): Promise<{ plans: MonthPlan[]; items: BudgetItem[] }>
  /** Cambia el importe de una sola categoría en un mes (plan anual). */
  setBudgetItem(item: BudgetItem): Promise<void>

  /** Gastos cuya fecha de compra está entre `from` y `to` (ambas incluidas). */
  listExpenses(range: { from: DateKey; to: DateKey }): Promise<Expense[]>
  /** Gastos cuya fecha de cobro está entre `from` y `to` (ambas incluidas). */
  listExpensesByChargeDate(range: { from: DateKey; to: DateKey }): Promise<Expense[]>
  addExpense(expense: Expense): Promise<void>
  deleteExpense(id: string): Promise<void>
  /** Reemplaza los datos de un gasto existente (fecha, importes, descripción, método…). */
  updateExpense(expense: Expense): Promise<void>
  /** Corrige los importes de gastos del terreno: euros (`amount`) y dólares (`amountUsd`). */
  updateExpenseAmounts(updates: { id: string; amount: Cents; amountUsd: Cents }[]): Promise<void>
  /** Recalcula la fecha de cobro de gastos con tarjeta de crédito desde `fromDate`. */
  updateChargeDates(updates: { id: string; chargeDate: DateKey }[]): Promise<void>

  listProperties(): Promise<Property[]>
  saveProperty(property: Property): Promise<void>
  /** Borra la ficha; los gastos registrados se conservan, pero dejan de estar ligados a ella. */
  deleteProperty(id: string): Promise<void>
  /** Gastos (cuotas, materiales, construcción…) ligados a la ficha de un terreno. */
  listPropertyExpenses(propertyId: string): Promise<Expense[]>

  listPlannedExpenses(): Promise<PlannedExpense[]>
  addPlannedExpense(expense: PlannedExpense): Promise<void>
  deletePlannedExpense(id: string): Promise<void>
}

export function newId(): string {
  return crypto.randomUUID()
}
