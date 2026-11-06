import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { repo } from '@/data'
import { monthRange } from '@/domain/calc'
import type { BudgetItem, Category, Expense, MonthKey, MonthPlan, PlannedExpense, Property, Settings } from '@/domain/types'


export const keys = {
  settings: ['settings'] as const,
  categories: ['categories'] as const,
  budget: (m: MonthKey) => ['budget', m] as const,
  yearBudgets: (y: number) => ['yearBudgets', y] as const,
  expenses: (m: MonthKey) => ['expenses', m] as const,
  expensesCharged: (m: MonthKey) => ['expensesCharged', m] as const,
  yearExpenses: (y: number) => ['yearExpenses', y] as const,
  planned: ['planned'] as const,
  properties: ['properties'] as const,
  propertyExpenses: (id: string) => ['propertyExpenses', id] as const,
}

export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: () => repo.getSettings() })
export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: () => repo.listCategories() })
export const useMonthBudget = (m: MonthKey) => useQuery({ queryKey: keys.budget(m), queryFn: () => repo.getMonthBudget(m) })
export const useYearBudgets = (y: number) => useQuery({ queryKey: keys.yearBudgets(y), queryFn: () => repo.listYearBudgets(y) })
export const useMonthExpenses = (m: MonthKey) =>
  useQuery({ queryKey: keys.expenses(m), queryFn: () => repo.listExpenses(monthRange(m)) })
export const useChargedExpenses = (m: MonthKey) =>
  useQuery({ queryKey: keys.expensesCharged(m), queryFn: () => repo.listExpensesByChargeDate(monthRange(m)) })
export const useYearExpenses = (y: number) =>
  useQuery({ queryKey: keys.yearExpenses(y), queryFn: () => repo.listExpenses({ from: `${y}-01-01`, to: `${y}-12-31` }) })
export const useProperties = () => useQuery({ queryKey: keys.properties, queryFn: () => repo.listProperties() })
export const usePropertyExpenses = (id: string | null) =>
  useQuery({ queryKey: keys.propertyExpenses(id ?? ''), queryFn: () => repo.listPropertyExpenses(id!), enabled: !!id })
export const usePlannedExpenses = () => useQuery({ queryKey: keys.planned, queryFn: () => repo.listPlannedExpenses() })

/** Mutación que invalida todo tras guardar: la app es pequeña y así nada queda desincronizado. */
function useWrite<TArgs>(fn: (args: TArgs) => Promise<void>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries(),
  })
}

export const useAddExpense = () => useWrite((e: Expense) => repo.addExpense(e))
export const useDeleteExpense = () => useWrite((id: string) => repo.deleteExpense(id))
export const useSaveBudget = () =>
  useWrite((a: { plan: MonthPlan; items: BudgetItem[] }) => repo.saveMonthBudget(a.plan, a.items))
export const useSetBudgetItem = () => useWrite((i: BudgetItem) => repo.setBudgetItem(i))
export const useSaveCategories = () => useWrite((c: Category[]) => repo.saveCategories(c))
export const useReassignBudget = () => useWrite((a: { from: string[]; to: string }) => repo.reassignBudgetItems(a.from, a.to))
export const useDeleteBudget = () => useWrite((month: MonthKey) => repo.deleteMonthBudget(month))
export const useUpdateExpenses = () => useWrite(async (list: Expense[]) => { for (const e of list) await repo.updateExpense(e) })
export const useDeleteExpenses = () => useWrite(async (ids: string[]) => { for (const id of ids) await repo.deleteExpense(id) })
export const useUpdateExpense = () => useWrite((e: Expense) => repo.updateExpense(e))
export const useAddExpenses = () => useWrite(async (list: Expense[]) => { for (const e of list) await repo.addExpense(e) })
export const useUpdateExpenseAmounts = () => useWrite((u: { id: string; amount: number; amountUsd: number }[]) => repo.updateExpenseAmounts(u))
export const useSaveProperty = () => useWrite((p: Property) => repo.saveProperty(p))
export const useDeleteProperty = () => useWrite((id: string) => repo.deleteProperty(id))
export const useAddPlanned = () => useWrite((p: PlannedExpense) => repo.addPlannedExpense(p))
export const useDeletePlanned = () => useWrite((id: string) => repo.deletePlannedExpense(id))

/**
 * Guarda ajustes. Si cambia el día de pago de la tarjeta, recalcula solo los cargos de compras de hoy
 * en adelante y conserva los de meses ya cerrados.
 */
export const useSaveSettings = () =>
  useWrite(async (a: { settings: Settings; recalc?: { id: string; chargeDate: string }[] }) => {
    await repo.saveSettings(a.settings)
    if (a.recalc?.length) await repo.updateChargeDates(a.recalc)
  })

/** Compras con tarjeta de crédito desde `fromDate` (para recalcular su cobro). */
export async function listCreditExpensesFrom(fromDate: string): Promise<Expense[]> {
  const all = await repo.listExpenses({ from: fromDate, to: '9999-12-31' })
  return all.filter((e) => e.method === 'credito')
}
