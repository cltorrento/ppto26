import type {
  BudgetItem,
  Category,
  DateKey,
  Expense,
  MonthBudget,
  MonthKey,
  MonthPlan,
  PlannedExpense,
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
  /** Reemplaza el conjunto de categorías (crea, actualiza y elimina). */
  saveCategories(categories: Category[]): Promise<void>

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
  /** Recalcula la fecha de cobro de gastos con tarjeta de crédito desde `fromDate`. */
  updateChargeDates(updates: { id: string; chargeDate: DateKey }[]): Promise<void>

  listPlannedExpenses(): Promise<PlannedExpense[]>
  addPlannedExpense(expense: PlannedExpense): Promise<void>
  deletePlannedExpense(id: string): Promise<void>
}

export function newId(): string {
  return crypto.randomUUID()
}
