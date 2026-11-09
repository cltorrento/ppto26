import { useMemo } from 'react'
import {
  cardSummary,
  categoryProgress,
  expensesByPurchaseMonth,
  groupProgress,
  plannedReservesForMonth,
  summarizeMonth,
} from '@/domain/calc'
import type { MonthKey } from '@/domain/types'
import { useBoughtExpenses, useCategories, useChargedExpenses, useMonthBudget, useMonthExpenses, usePlannedExpenses, useSettings } from './hooks'

export type MonthView = 'compra' | 'pago'

/**
 * Reúne y calcula todo lo que necesitan Panel y Gastos para un mes, con una única fórmula,
 * de modo que los mismos números salen iguales en todas las pantallas.
 */
export function useMonthData(month: MonthKey, view: MonthView = 'compra') {
  const budget = useMonthBudget(month)
  const categories = useCategories()
  const purchases = useMonthExpenses(month)
  const charged = useChargedExpenses(month)
  const bought = useBoughtExpenses(month)
  const planned = usePlannedExpenses()
  const settings = useSettings()

  const queries = [budget, categories, purchases, charged, bought, planned, settings]
  const isLoading = queries.some((q) => q.isLoading)
  const error = queries.find((q) => q.error)?.error ?? null

  const data = useMemo(() => {
    if (isLoading || error) return null
    const plan = budget.data!.plan
    const items = budget.data!.items
    const cats = categories.data!
    const purchaseList = purchases.data!
    const chargedList = charged.data!
    // En la vista "fecha de pago" los gastos del mes son los que se cobran ese mes.
    const monthExpenses = view === 'compra' ? expensesByPurchaseMonth(purchaseList, month) : chargedList
    const reserves = plannedReservesForMonth(planned.data!, month, purchaseList)
    const summary = summarizeMonth({ plan, monthExpenses, reserves, month })
    const progress = categoryProgress(cats, items, monthExpenses)
    // El comparativo 50/30/20 siempre usa fecha de compra: reparte lo que decidiste gastar.
    const groups = groupProgress(categoryProgress(cats, items, purchaseList), summary.income)
    const allCards = new Map([...bought.data!, ...chargedList].map((e) => [e.id, e]))
    const card = cardSummary([...allCards.values()], month, settings.data!.cardPayDay)
    return { plan, items, categories: cats, purchases: purchaseList, monthExpenses, reserves, summary, progress, groups, card, settings: settings.data! }
  }, [isLoading, error, budget.data, categories.data, purchases.data, charged.data, bought.data, planned.data, settings.data, month, view])

  const refetch = () => queries.forEach((q) => q.refetch())
  return { data, isLoading, error, refetch }
}
