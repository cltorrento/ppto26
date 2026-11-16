import { useMemo } from 'react'
import {
  cardSummary,
  cashExpenses,
  categoryProgress,
  groupProgress,
  isDeferredCard,
  plannedReservesForMonth,
  sum,
  summarizeMonth,
} from '@/domain/calc'
import type { MonthKey } from '@/domain/types'
import { useBoughtExpenses, useCategories, useChargedExpenses, useMonthBudget, useMonthExpenses, usePlannedExpenses, useSettings } from './hooks'

/**
 * Reúne y calcula todo lo que necesitan Panel y Gastos para un mes, con una única fórmula,
 * de modo que los mismos números salen iguales en todas las pantallas.
 */
export function useMonthData(month: MonthKey) {
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
    // Por categoría cuenta lo comprado en el mes (una compra con tarjeta, en su categoría) más el cargo de la tarjeta.
    const monthExpenses = purchaseList
    // El disponible solo descuenta lo que sale de tu cuenta: lo comprado con tarjeta se descuenta cuando se cobra.
    const cash = cashExpenses(bought.data!, chargedList)
    const deferred = sum(bought.data!.filter(isDeferredCard).map((e) => e.amount))
    const reserves = plannedReservesForMonth(planned.data!, month, purchaseList)
    const summary = summarizeMonth({ plan, monthExpenses: cash, reserves, month })
    const progress = categoryProgress(cats, items, monthExpenses)
    const groups = groupProgress(progress, summary.income)
    const allCards = new Map([...bought.data!, ...chargedList].map((e) => [e.id, e]))
    const card = cardSummary([...allCards.values()], month, settings.data!.cardPayDay)
    return { plan, items, categories: cats, purchases: purchaseList, monthExpenses, deferred, reserves, summary, progress, groups, card, settings: settings.data! }
  }, [isLoading, error, budget.data, categories.data, purchases.data, charged.data, bought.data, planned.data, settings.data, month])

  const refetch = () => queries.forEach((q) => q.refetch())
  return { data, isLoading, error, refetch }
}
