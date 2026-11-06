import { z } from 'zod'
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  type BudgetItem,
  type Category,
  type Expense,
  type MonthPlan,
  type PlannedExpense,
  type Property,
  type Settings,
} from '@/domain/types'
import { newId, type Repository } from './repository'

const STORAGE_KEY = 'mipresupuesto:v1'

const cents = z.number().int()
const store = z.object({
  settings: z.object({ cardPayDay: z.number().int().min(1).max(28), referenceIncome: cents.min(0) }),
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      group: z.enum(['necesidades', 'gustos', 'ahorro']),
      icon: z.string(),
      sortOrder: z.number(),
      parentId: z.string().nullable().optional(),
    }),
  ),
  plans: z.array(z.object({ month: z.string(), income: cents, extraIncome: cents, savingsGoal: cents })),
  items: z.array(z.object({ month: z.string(), categoryId: z.string(), amount: cents })),
  expenses: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      categoryId: z.string().nullable(),
      amount: cents,
      description: z.string(),
      method: z.enum(['efectivo', 'debito', 'credito', 'transferencia']),
      chargeDate: z.string(),
      propertyId: z.string().nullable().optional(),
      propertyKind: z.enum(['cuota', 'materiales', 'construccion', 'otros']).nullable().optional(),
      amountUsd: cents.nullable().optional(),
      outsideBudget: z.boolean().optional(),
    }),
  ),
  planned: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      amount: cents,
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
      categoryId: z.string().nullable(),
      repeatsYearly: z.boolean(),
    }),
  ),
  properties: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        acquisitionDate: z.string(),
        price: cents,
        downPayment: cents,
        interestRate: z.number(),
        termMonths: z.number().int(),
        monthlyPayment: cents,
        firstPaymentDate: z.string(),
        initialPaidCount: z.number().int(),
        categoryByKind: z.record(z.string(), z.string().nullable()),
        notes: z.string(),
        currentValue: cents.optional(),
        buildingValue: cents.optional(),
        valueDate: z.string().nullable().optional(),
        eurRate: z.number().optional(),
      }),
    )
    .default([]),
})

type Store = z.infer<typeof store>

function emptyStore(): Store {
  return {
    settings: { ...DEFAULT_SETTINGS },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, id: newId() })),
    plans: [],
    items: [],
    expenses: [],
    planned: [],
    properties: [],
  }
}

function read(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = store.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
    console.warn('Datos locales con formato inesperado; se ignoran.', parsed.error)
  } catch (e) {
    console.warn('No se pudieron leer los datos locales.', e)
  }
  return emptyStore()
}

function write(data: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/** Lee, aplica un cambio y guarda. Devuelve el resultado de `fn`. */
function mutate<T>(fn: (s: Store) => T): T {
  const s = read()
  const result = fn(s)
  write(s)
  return result
}

const inRange = (value: string, r: { from: string; to: string }) => value >= r.from && value <= r.to
const byDate = (a: Expense, b: Expense) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)

export const localRepository: Repository = {
  async getSettings() {
    return read().settings
  },
  async saveSettings(settings: Settings) {
    mutate((s) => {
      s.settings = settings
    })
  },

  async listCategories() {
    const s = read()
    // Primera lectura: persiste las categorías por defecto para que los ids sean estables.
    if (!localStorage.getItem(STORAGE_KEY)) write(s)
    return [...s.categories].sort((a, b) => a.sortOrder - b.sortOrder)
  },
  async saveCategories(categories: Category[]) {
    mutate((s) => {
      const parentOf = new Map(s.categories.map((c) => [c.id, c.parentId ?? null]))
      s.categories = categories
      const ids = new Set(categories.map((c) => c.id))
      s.items = s.items.filter((i) => ids.has(i.categoryId))
      s.expenses = s.expenses.map((e) => {
        if (!e.categoryId || ids.has(e.categoryId)) return e
        const parent = parentOf.get(e.categoryId)
        return { ...e, categoryId: parent && ids.has(parent) ? parent : null }
      })
    })
  },
  async reassignBudgetItems(fromIds, toId) {
    mutate((s) => {
      const from = new Set(fromIds.filter((id) => id !== toId))
      const moved = s.items.filter((i) => from.has(i.categoryId))
      if (moved.length === 0) return
      const kept = s.items.filter((i) => !from.has(i.categoryId))
      const target = new Map(kept.filter((i) => i.categoryId === toId).map((i) => [i.month, i.amount]))
      for (const i of moved) target.set(i.month, (target.get(i.month) ?? 0) + i.amount)
      s.items = [
        ...kept.filter((i) => i.categoryId !== toId),
        ...[...target.entries()].map(([month, amount]) => ({ month, categoryId: toId, amount })),
      ]
    })
  },

  async getMonthBudget(month) {
    const s = read()
    return {
      plan: s.plans.find((p) => p.month === month) ?? null,
      items: s.items.filter((i) => i.month === month),
    }
  },
  async saveMonthBudget(plan: MonthPlan, items: BudgetItem[]) {
    mutate((s) => {
      s.plans = [...s.plans.filter((p) => p.month !== plan.month), plan]
      s.items = [...s.items.filter((i) => i.month !== plan.month), ...items]
    })
  },
  async listYearBudgets(year) {
    const prefix = `${year}-`
    const s = read()
    return {
      plans: s.plans.filter((p) => p.month.startsWith(prefix)),
      items: s.items.filter((i) => i.month.startsWith(prefix)),
    }
  },
  async setBudgetItem(item) {
    mutate((s) => {
      s.items = [...s.items.filter((i) => !(i.month === item.month && i.categoryId === item.categoryId)), item]
    })
  },

  async listExpenses(range) {
    return read().expenses.filter((e) => !e.outsideBudget && inRange(e.date, range)).sort(byDate)
  },
  async listExpensesByChargeDate(range) {
    return read().expenses.filter((e) => !e.outsideBudget && inRange(e.chargeDate, range)).sort(byDate)
  },
  async addExpense(expense: Expense) {
    mutate((s) => {
      s.expenses.push(expense)
    })
  },
  async deleteExpense(id) {
    mutate((s) => {
      s.expenses = s.expenses.filter((e) => e.id !== id)
    })
  },
  async updateExpense(expense) {
    mutate((s) => {
      s.expenses = s.expenses.map((e) => (e.id === expense.id ? expense : e))
    })
  },
  async updateExpenseAmounts(updates) {
    mutate((s) => {
      const map = new Map(updates.map((u) => [u.id, u]))
      s.expenses = s.expenses.map((e) => (map.has(e.id) ? { ...e, amount: map.get(e.id)!.amount, amountUsd: map.get(e.id)!.amountUsd } : e))
    })
  },
  async updateChargeDates(updates) {
    mutate((s) => {
      const map = new Map(updates.map((u) => [u.id, u.chargeDate]))
      s.expenses = s.expenses.map((e) => (map.has(e.id) ? { ...e, chargeDate: map.get(e.id)! } : e))
    })
  },

  async listProperties() {
    return read().properties as Property[]
  },
  async saveProperty(property: Property) {
    mutate((s) => {
      s.properties = [...s.properties.filter((p) => p.id !== property.id), property]
    })
  },
  async deleteProperty(id) {
    mutate((s) => {
      s.properties = s.properties.filter((p) => p.id !== id)
      s.expenses = s.expenses.map((e) => (e.propertyId === id ? { ...e, propertyId: null, propertyKind: null } : e))
    })
  },
  async listPropertyExpenses(propertyId) {
    return read().expenses.filter((e) => e.propertyId === propertyId).sort(byDate) as Expense[]
  },

  async listPlannedExpenses() {
    return read().planned
  },
  async addPlannedExpense(expense: PlannedExpense) {
    mutate((s) => {
      s.planned.push(expense)
    })
  },
  async deletePlannedExpense(id) {
    mutate((s) => {
      s.planned = s.planned.filter((p) => p.id !== id)
    })
  },
}

/** Borra todos los datos locales. */
export function clearLocalData() {
  localStorage.removeItem(STORAGE_KEY)
}
