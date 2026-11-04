import type {
  BudgetItem,
  Category,
  Cents,
  DateKey,
  Expense,
  Group,
  MonthKey,
  MonthPlan,
  PaymentMethod,
  PlannedExpense,
} from './types'
import { GROUP_TARGETS } from './types'

// ---------- Fechas (todo con strings para evitar problemas de zona horaria) ----------

export function monthOf(date: DateKey): MonthKey {
  return date.slice(0, 7)
}

export function parseMonth(month: MonthKey): { year: number; month: number } {
  const [y, m] = month.split('-').map(Number)
  return { year: y, month: m }
}

export function makeMonth(year: number, month: number): MonthKey {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const { year, month: m } = parseMonth(month)
  const idx = year * 12 + (m - 1) + delta
  return makeMonth(Math.floor(idx / 12), (idx % 12) + 1)
}

export function daysInMonth(month: MonthKey): number {
  const { year, month: m } = parseMonth(month)
  return new Date(year, m, 0).getDate()
}

/** Primer y último día reales del mes (Postgres rechaza fechas como 2026-11-31). */
export function monthRange(month: MonthKey): { from: DateKey; to: DateKey } {
  return { from: `${month}-01`, to: `${month}-${String(daysInMonth(month)).padStart(2, '0')}` }
}

export function todayKey(now: Date = new Date()): DateKey {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

/**
 * Día en que sale el dinero de la cuenta.
 * Tarjeta de crédito: el día `payDay` del mes siguiente a la compra. El resto: el mismo día.
 */
export function computeChargeDate(date: DateKey, method: PaymentMethod, payDay: number): DateKey {
  if (method !== 'credito') return date
  const day = Math.min(Math.max(payDay, 1), 28)
  return `${addMonths(monthOf(date), 1)}-${String(day).padStart(2, '0')}`
}

// ---------- Selección de movimientos ----------

export function expensesByPurchaseMonth(expenses: Expense[], month: MonthKey): Expense[] {
  return expenses.filter((e) => monthOf(e.date) === month)
}

export function expensesByChargeMonth(expenses: Expense[], month: MonthKey): Expense[] {
  return expenses.filter((e) => monthOf(e.chargeDate) === month)
}

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Gastos programados que cuentan como reserva en un mes: los de ese año/mes, más los anuales de años
 * anteriores. Si ya hay un gasto real con el mismo nombre ese mes, no se cuenta dos veces.
 */
export function plannedReservesForMonth(
  planned: PlannedExpense[],
  month: MonthKey,
  monthExpenses: Expense[],
): PlannedExpense[] {
  const { year, month: m } = parseMonth(month)
  const registered = new Set(monthExpenses.map((e) => norm(e.description)))
  return planned.filter((p) => {
    const applies = p.month === m && (p.year === year || (p.repeatsYearly && p.year < year))
    return applies && !registered.has(norm(p.name))
  })
}

// ---------- Resumen del mes ----------

export interface MonthSummary {
  income: Cents
  spent: Cents
  reserved: Cents
  /** Ingreso - gastado - reservado. Es el mismo número en todas las pantallas. */
  remaining: Cents
  /** Gastado / ingreso (0..n). */
  spentRatio: number
  /** (Gastado + reservado) / ingreso. */
  committedRatio: number
  /** Cuánto puedes gastar al día lo que queda de mes. Null si el mes no es el actual o no queda nada. */
  dailyAllowance: Cents | null
  daysLeft: number | null
  /** Promedio diario de lo gastado hasta hoy. Null si el mes no es el actual. */
  dailyAverage: Cents | null
}

export function planIncome(plan: MonthPlan | null): Cents {
  return plan ? plan.income + plan.extraIncome : 0
}

export function summarizeMonth(args: {
  plan: MonthPlan | null
  monthExpenses: Expense[]
  reserves: PlannedExpense[]
  month: MonthKey
  today?: DateKey
}): MonthSummary {
  const { plan, monthExpenses, reserves, month } = args
  const today = args.today ?? todayKey()
  const income = planIncome(plan)
  const spent = sum(monthExpenses.map((e) => e.amount))
  const reserved = sum(reserves.map((p) => p.amount))
  const remaining = income - spent - reserved
  const isCurrent = monthOf(today) === month
  const total = daysInMonth(month)
  const dayOfMonth = isCurrent ? Number(today.slice(8, 10)) : null
  const daysLeft = dayOfMonth ? total - dayOfMonth + 1 : null
  return {
    income,
    spent,
    reserved,
    remaining,
    spentRatio: income > 0 ? spent / income : 0,
    committedRatio: income > 0 ? (spent + reserved) / income : 0,
    dailyAllowance: daysLeft && remaining > 0 ? Math.floor(remaining / daysLeft) : null,
    daysLeft,
    dailyAverage: dayOfMonth ? Math.round(spent / dayOfMonth) : null,
  }
}

export type CategoryStatus = 'ok' | 'near' | 'exceeded'

export interface CategoryProgress {
  category: Category
  budget: Cents
  spent: Cents
  available: Cents
  ratio: number
  status: CategoryStatus
}

export function categoryStatus(budget: Cents, spent: Cents): CategoryStatus {
  if (spent > budget) return 'exceeded'
  if (budget > 0 && spent / budget >= 0.85) return 'near'
  return 'ok'
}

export function categoryProgress(
  categories: Category[],
  items: BudgetItem[],
  monthExpenses: Expense[],
): CategoryProgress[] {
  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((category) => {
      const budget = items.find((i) => i.categoryId === category.id)?.amount ?? 0
      const spent = sum(monthExpenses.filter((e) => e.categoryId === category.id).map((e) => e.amount))
      return {
        category,
        budget,
        spent,
        available: budget - spent,
        ratio: budget > 0 ? spent / budget : spent > 0 ? Infinity : 0,
        status: categoryStatus(budget, spent),
      }
    })
}

export interface GroupProgress {
  group: Group
  planned: Cents
  actual: Cents
  available: Cents
  ratio: number
  /** % que representa el reparto planeado sobre el ingreso. */
  plannedPct: number
}

/**
 * Planeado frente a real por bloque 50/30/20. Para "ahorro" lo real son las aportaciones registradas
 * (gastos en categorías de ese grupo).
 */
export function groupProgress(progress: CategoryProgress[], income: Cents): GroupProgress[] {
  return (['necesidades', 'gustos', 'ahorro'] as Group[]).map((group) => {
    const rows = progress.filter((p) => p.category.group === group)
    const planned = sum(rows.map((r) => r.budget))
    const actual = sum(rows.map((r) => r.spent))
    return {
      group,
      planned,
      actual,
      available: planned - actual,
      ratio: planned > 0 ? actual / planned : 0,
      plannedPct: income > 0 ? (planned / income) * 100 : 0,
    }
  })
}

// ---------- Tarjeta de crédito ----------

export interface CardSummary {
  /** Compras con tarjeta hechas este mes (se cobrarán el mes siguiente). */
  purchasedThisMonth: Cents
  /** Fecha en que se cobrarán. */
  nextChargeDate: DateKey
  /** Importe que sale este mes por compras del mes pasado. */
  chargedThisMonth: Cents
}

export function cardSummary(expenses: Expense[], month: MonthKey, payDay: number): CardSummary {
  const credit = expenses.filter((e) => e.method === 'credito')
  return {
    purchasedThisMonth: sum(credit.filter((e) => monthOf(e.date) === month).map((e) => e.amount)),
    nextChargeDate: computeChargeDate(`${month}-01`, 'credito', payDay),
    chargedThisMonth: sum(credit.filter((e) => monthOf(e.chargeDate) === month).map((e) => e.amount)),
  }
}

// ---------- Presupuesto ----------

export function allocated(items: { amount: Cents }[]): Cents {
  return sum(items.map((i) => i.amount))
}

/**
 * Propuesta 50/30/20. Si hay meta de ahorro, el bloque de ahorro es esa meta y el resto se reparte
 * 50:30 entre necesidades y gustos. Dentro de cada bloque se reparte a partes iguales y el sobrante
 * de redondeo va a la primera categoría, de modo que la suma es exactamente el ingreso.
 */
export function suggest5030(income: Cents, categories: Category[], savingsGoal: Cents = 0): Map<string, Cents> {
  const result = new Map<string, Cents>()
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
  sorted.forEach((c) => result.set(c.id, 0))
  if (income <= 0 || sorted.length === 0) return result

  const ahorro = savingsGoal > 0 ? Math.min(savingsGoal, income) : Math.round((income * GROUP_TARGETS.ahorro) / 100)
  const rest = income - ahorro
  const necesidades = Math.round((rest * GROUP_TARGETS.necesidades) / (GROUP_TARGETS.necesidades + GROUP_TARGETS.gustos))
  const totals: Record<Group, Cents> = { necesidades, gustos: rest - necesidades, ahorro }

  let leftover = 0
  for (const group of ['necesidades', 'gustos', 'ahorro'] as Group[]) {
    const members = sorted.filter((c) => c.group === group)
    if (members.length === 0) {
      leftover += totals[group]
      continue
    }
    const base = Math.floor(totals[group] / members.length)
    members.forEach((c) => result.set(c.id, base))
    result.set(members[0].id, base + (totals[group] - base * members.length))
  }
  if (leftover > 0) {
    const first = sorted[0]
    result.set(first.id, (result.get(first.id) ?? 0) + leftover)
  }
  return result
}

// ---------- Plan anual ----------

export interface MonthCapacity {
  month: MonthKey
  /** Presupuesto del mes si existe; si no, 0. */
  budgeted: Cents
  planned: Cents
  income: Cents | null
  margin: Cents | null
  hasBudget: boolean
}

export function monthCapacity(args: {
  month: MonthKey
  plan: MonthPlan | null
  items: BudgetItem[]
  planned: PlannedExpense[]
  referenceIncome: Cents
}): MonthCapacity {
  const { month, plan, items, planned, referenceIncome } = args
  const budgeted = allocated(items)
  const plannedTotal = sum(plannedReservesForMonth(planned, month, []).map((p) => p.amount))
  const income = plan ? planIncome(plan) : referenceIncome > 0 ? referenceIncome : null
  return {
    month,
    budgeted,
    planned: plannedTotal,
    income,
    margin: income === null ? null : income - budgeted - plannedTotal,
    hasBudget: !!plan,
  }
}

// ---------- Utilidades ----------

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}
