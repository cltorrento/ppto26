import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { repo } from '@/data'
import { countDate, monthRange } from '@/domain/calc'
import type { BudgetItem, Category, CryptoPosition, EtfConfig, Expense, MonthKey, MonthPlan, PlannedExpense, Property, Settings } from '@/domain/types'


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
/** Gastos que cuentan en el mes: por fecha de compra, salvo la tarjeta de crédito (desde nov. 2026), que cuenta cuando se cobra. */
async function expensesCountingIn(range: { from: string; to: string }): Promise<Expense[]> {
  const [bought, charged] = await Promise.all([repo.listExpenses(range), repo.listExpensesByChargeDate(range)])
  const all = new Map([...bought, ...charged].map((e) => [e.id, e]))
  const d = (e: Expense) => countDate(e)
  return [...all.values()].filter((e) => d(e) >= range.from && d(e) <= range.to).sort((a, b) => b.date.localeCompare(a.date))
}
export const useMonthExpenses = (m: MonthKey) =>
  useQuery({ queryKey: keys.expenses(m), queryFn: () => expensesCountingIn(monthRange(m)) })
/** Compras por fecha de compra, sin aplicar la regla de la tarjeta: para el resumen de tarjeta del Panel. */
export const useBoughtExpenses = (m: MonthKey) =>
  useQuery({ queryKey: ['expensesBought', m], queryFn: () => repo.listExpenses(monthRange(m)) })
export const useChargedExpenses = (m: MonthKey) =>
  useQuery({ queryKey: keys.expensesCharged(m), queryFn: () => repo.listExpensesByChargeDate(monthRange(m)) })
export const useYearExpenses = (y: number) =>
  useQuery({ queryKey: keys.yearExpenses(y), queryFn: () => expensesCountingIn({ from: `${y}-01-01`, to: `${y}-12-31` }) })
export const useProperties = () => useQuery({ queryKey: keys.properties, queryFn: () => repo.listProperties() })
export const usePropertyExpenses = (id: string | null) =>
  useQuery({ queryKey: keys.propertyExpenses(id ?? ''), queryFn: () => repo.listPropertyExpenses(id!), enabled: !!id })
export const useEtf = () => useQuery({ queryKey: ['etf'], queryFn: () => repo.getEtf() })
export const useSaveEtf = () => useWrite((c: EtfConfig | null) => repo.saveEtf(c))

export interface EtfQuotes {
  ticker: string
  isin: string
  name: string
  currency: string
  exchange: string
  price: number
  priceDate: string
  /** True si la bolsa está en su sesión regular ahora mismo. */
  marketOpen?: boolean
  /** Hora (ISO) de la última cotización. */
  priceTime?: string | null
  history: [string, number][]
}
/** Precios del ETF desde nuestra función `/api/etf` (Yahoo Finance). */
export async function fetchEtfQuotes(isin: string, from: string, ticker?: string, fresh?: number): Promise<EtfQuotes> {
  // `fresh` cambia la URL para saltarse la caché del servidor cuando pulsas Actualizar.
  const qs = new URLSearchParams({ isin, from, ...(ticker ? { ticker } : {}), ...(fresh ? { r: String(fresh) } : {}) })
  const r = await fetch(`/api/etf?${qs}`)
  const body = await r.json().catch(() => null)
  if (!r.ok || !body) throw new Error(body?.error ?? 'No pudimos traer los precios del ETF.')
  return body as EtfQuotes
}
export const useEtfQuotes = (c: EtfConfig | null | undefined, fresh = 0) =>
  useQuery({
    queryKey: ['etfQuotes', c?.isin, c?.ticker, c?.since, fresh],
    queryFn: () => fetchEtfQuotes(c!.isin, c!.since, c!.ticker, fresh),
    enabled: !!c,
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
/** Aportaciones: gastos de la categoría elegida (y sus subcategorías) desde la fecha de inicio, por fecha de compra. */
export const useEtfContributions = (c: EtfConfig | null | undefined) =>
  useQuery({
    queryKey: ['etfContributions', c?.categoryId, c?.since],
    enabled: !!c,
    queryFn: async () => {
      const [list, cats] = await Promise.all([repo.listExpenses({ from: c!.since, to: '9999-12-31' }), repo.listCategories()])
      const ids = new Set(cats.filter((x) => x.id === c!.categoryId || x.parentId === c!.categoryId).map((x) => x.id))
      return list.filter((e) => e.categoryId && ids.has(e.categoryId))
    },
  })
export const useCrypto = () => useQuery({ queryKey: ['crypto'], queryFn: () => repo.getCrypto() })
export const useSaveCrypto = () => useWrite((list: CryptoPosition[]) => repo.saveCrypto(list))

export interface CryptoData {
  prices: Record<string, { name: string; symbol: string; eur: number; change24h: number | null; change7d: number | null; change30d: number | null; high24h: number | null; low24h: number | null; updatedAt: string | null }>
  history: Record<string, [string, number][]>
  fng: { value: number; classification: string; date: string } | null
  fetchedAt: string
}
/** Precios en euros (CoinGecko) e índice Fear & Greed desde nuestra función `/api/crypto`. */
export async function fetchCryptoData(ids: string[], from: string, fresh?: number): Promise<CryptoData> {
  const qs = new URLSearchParams({ ids: ids.join(','), from, ...(fresh ? { r: String(fresh) } : {}) })
  const r = await fetch(`/api/crypto?${qs}`)
  const body = await r.json().catch(() => null)
  if (!r.ok || !body) throw new Error(body?.error ?? 'No pudimos traer los precios.')
  return body as CryptoData
}
/** Monedas del monitor de mercado (siempre visibles) y días de histórico que necesita. */
export const MONITOR_COINS = ['bitcoin', 'ethereum', 'solana']
export const useCryptoData = (list: CryptoPosition[], fresh = 0) => {
  const ids = [...new Set([...MONITOR_COINS, ...list.map((p) => p.coinId)])].sort()
  const hundredDaysAgo = new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10)
  const from = list.reduce((m, p) => (p.since < m ? p.since : m), hundredDaysAgo)
  return useQuery({
    queryKey: ['cryptoData', ids.join(','), from, fresh],
    queryFn: () => fetchCryptoData(ids, from, fresh),
    staleTime: 2 * 60 * 1000,
    retry: false,
  })
}
/** Aportaciones de cada criptomoneda: gastos de su categoría (y subcategorías) desde su fecha de inicio. */
export const useCryptoContributions = (list: CryptoPosition[]) =>
  useQuery({
    queryKey: ['cryptoContributions', list.map((p) => `${p.id}:${p.categoryId}:${p.since}`).join('|')],
    enabled: list.length > 0,
    queryFn: async () => {
      const from = list.reduce((m, p) => (p.since < m ? p.since : m), '9999-12-31')
      const [all, cats] = await Promise.all([repo.listExpenses({ from, to: '9999-12-31' }), repo.listCategories()])
      const out: Record<string, Expense[]> = {}
      for (const p of list) {
        const ids = new Set(cats.filter((x) => x.id === p.categoryId || x.parentId === p.categoryId).map((x) => x.id))
        out[p.id] = all.filter((e) => e.date >= p.since && e.categoryId && ids.has(e.categoryId))
      }
      return out
    },
  })
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
