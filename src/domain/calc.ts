import type {
  BudgetItem,
  Category,
  Cents,
  DateKey,
  Expense,
  Group,
  MonthBudget,
  MonthKey,
  MonthPlan,
  PaymentMethod,
  PlannedExpense,
} from './types'
import { GROUP_ORDER, GROUP_TARGETS } from './types'

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

/**
 * Desde esta fecha de compra, un gasto con tarjeta de crédito cuenta en el mes en que se cobra (no en el de la compra).
 * Lo anterior (octubre y antes, ya cerrado) sigue contando por fecha de compra.
 */
export const CARD_BY_CHARGE_FROM: DateKey = '2026-11-01'

/** Fecha con la que un gasto cuenta en los meses: la de cobro para la tarjeta de crédito (desde noviembre de 2026), la de compra en el resto. */
export function countDate(e: Pick<Expense, 'date' | 'chargeDate' | 'method'>): DateKey {
  return e.method === 'credito' && e.date >= CARD_BY_CHARGE_FROM ? e.chargeDate : e.date
}

/** Gastos que cuentan en `month` (ver `countDate`). */
export function expensesByPurchaseMonth(expenses: Expense[], month: MonthKey): Expense[] {
  return expenses.filter((e) => monthOf(countDate(e)) === month)
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

 // ---------- Categorías y subcategorías ----------

/** Un solo nivel: una categoría es subcategoría si su padre existe en la lista. */
function parentIdOf(categories: Category[], c: Category): string | null {
  return c.parentId && categories.some((x) => x.id === c.parentId && x.id !== c.id) ? c.parentId : null
}

const bySort = (a: Category, b: Category) => a.sortOrder - b.sortOrder

/** Categorías de primer nivel: primero por bloque (Necesidades, Deuda, Gustos, Ahorro) y, dentro del bloque, por su orden. */
export function topLevel(categories: Category[]): Category[] {
  const rank = (c: Category) => GROUP_ORDER.indexOf(c.group)
  return categories.filter((c) => parentIdOf(categories, c) === null).sort((a, b) => rank(a) - rank(b) || bySort(a, b))
}

export function childrenOf(categories: Category[], parentId: string): Category[] {
  return categories.filter((c) => c.id !== parentId && parentIdOf(categories, c) === parentId).sort(bySort)
}

/** Categorías que llevan presupuesto propio: las que no tienen subcategorías. */
export function budgetLeaves(categories: Category[]): Category[] {
  const parents = new Set(categories.map((c) => parentIdOf(categories, c)).filter((x): x is string => !!x))
  return categories.filter((c) => !parents.has(c.id)).sort(bySort)
}

/** Id de la categoría de primer nivel a la que pertenece `id`. */
export function rootIdOf(categories: Category[], id: string): string {
  const c = categories.find((x) => x.id === id)
  return (c && parentIdOf(categories, c)) ?? id
}

/** Nombre para mostrar: «Vivienda › Alquiler» para subcategorías. */
export function categoryLabel(categories: Category[], id: string | null): string {
  const c = categories.find((x) => x.id === id)
  if (!c) return 'Sin categoría'
  const parent = parentIdOf(categories, c)
  const p = parent ? categories.find((x) => x.id === parent) : null
  return p ? `${p.name} › ${c.name}` : c.name
}

export type CategoryStatus = 'ok' | 'near' | 'exceeded'

export interface CategoryProgress {
  category: Category
  budget: Cents
  spent: Cents
  available: Cents
  ratio: number
  status: CategoryStatus
  /** Subcategorías (vacío si no tiene). Presupuesto y gasto de la categoría ya las incluyen. */
  children: CategoryProgress[]
  /** Gasto registrado directamente en la categoría padre, sin subcategoría. */
  ownSpent: Cents
}

export function categoryStatus(budget: Cents, spent: Cents): CategoryStatus {
  if (spent > budget) return 'exceeded'
  if (budget > 0 && spent / budget >= 0.85) return 'near'
  return 'ok'
}

function leafProgress(category: Category, items: BudgetItem[], expenses: Expense[]): CategoryProgress {
  const budget = items.find((i) => i.categoryId === category.id)?.amount ?? 0
  const spent = sum(expenses.filter((e) => e.categoryId === category.id).map((e) => e.amount))
  return {
    category,
    budget,
    spent,
    available: budget - spent,
    ratio: budget > 0 ? spent / budget : spent > 0 ? Infinity : 0,
    status: categoryStatus(budget, spent),
    children: [],
    ownSpent: spent,
  }
}

/**
 * Progreso por categoría de primer nivel. Si tiene subcategorías, su presupuesto es la suma de las
 * suyas y su gasto incluye el de ellas; las subcategorías cuelgan en `children`.
 */
export function categoryProgress(
  categories: Category[],
  items: BudgetItem[],
  monthExpenses: Expense[],
): CategoryProgress[] {
  return topLevel(categories).map((top) => {
    const kids = childrenOf(categories, top.id).map((k) => leafProgress(k, items, monthExpenses))
    if (kids.length === 0) return leafProgress(top, items, monthExpenses)
    const ownSpent = sum(monthExpenses.filter((e) => e.categoryId === top.id).map((e) => e.amount))
    const budget = sum(kids.map((k) => k.budget))
    const spent = ownSpent + sum(kids.map((k) => k.spent))
    return {
      category: top,
      budget,
      spent,
      available: budget - spent,
      ratio: budget > 0 ? spent / budget : spent > 0 ? Infinity : 0,
      status: categoryStatus(budget, spent),
      children: kids,
      ownSpent,
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
  /** % que representa lo gastado sobre el ingreso. */
  actualPct: number
  /** Objetivo del bloque (regla 50/30/10/10) en % y en dinero sobre el ingreso. */
  targetPct: number
  target: Cents
}

/**
 * Planeado frente a real por bloque 50/30/20. Para "ahorro" lo real son las aportaciones registradas
 * (gastos en categorías de ese grupo).
 */
export function groupProgress(progress: CategoryProgress[], income: Cents): GroupProgress[] {
  return GROUP_ORDER.map((group) => {
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
      actualPct: income > 0 ? (actual / income) * 100 : 0,
      targetPct: GROUP_TARGETS[group],
      target: Math.round((income * GROUP_TARGETS[group]) / 100),
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
  categories.forEach((c) => result.set(c.id, 0))
  const sorted = topLevel(categories)
  if (income <= 0 || sorted.length === 0) return result

  // Sin categorías de Deuda no se aparta su parte: queda para necesidades y gustos.
  const hasDeuda = sorted.some((c) => c.group === 'deuda')
  const ahorro = savingsGoal > 0 ? Math.min(savingsGoal, income) : Math.round((income * GROUP_TARGETS.ahorro) / 100)
  const deuda = hasDeuda ? Math.min(Math.round((income * GROUP_TARGETS.deuda) / 100), income - ahorro) : 0
  const rest = income - ahorro - deuda
  const necesidades = Math.round((rest * GROUP_TARGETS.necesidades) / (GROUP_TARGETS.necesidades + GROUP_TARGETS.gustos))
  const totals: Record<Group, Cents> = { necesidades, gustos: rest - necesidades, ahorro, deuda }

  // Primero se reparte entre categorías de primer nivel; luego cada una divide su parte entre sus subcategorías.
  const share = new Map<string, Cents>()
  let leftover = 0
  for (const group of GROUP_ORDER) {
    const members = sorted.filter((c) => c.group === group)
    if (members.length === 0) {
      leftover += totals[group]
      continue
    }
    const base = Math.floor(totals[group] / members.length)
    members.forEach((c) => share.set(c.id, base))
    share.set(members[0].id, base + (totals[group] - base * members.length))
  }
  if (leftover > 0) share.set(sorted[0].id, (share.get(sorted[0].id) ?? 0) + leftover)

  for (const top of sorted) {
    const amount = share.get(top.id) ?? 0
    const kids = childrenOf(categories, top.id)
    result.set(top.id, amount)
    if (kids.length === 0) continue
    const base = Math.floor(amount / kids.length)
    kids.forEach((k) => result.set(k.id, base))
    result.set(kids[0].id, base + (amount - base * kids.length))
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

// ---------- Resumen anual ----------

export interface YearMonthRow {
  month: MonthKey
  /** True si el mes tiene un plan de ingreso o al menos un gasto. */
  hasData: boolean
  income: Cents
  /** Presupuestado del mes (suma de todas las categorías). */
  budgeted: Cents
  /** Gastado de verdad en el mes (siempre real). */
  spent: Cents
  /** True si `net` es una previsión: mes en curso o futuro, donde se usa el mayor entre presupuestado y gastado. */
  projected: boolean
  /** Ingreso − gastado (real) o, si `projected`, ingreso − el mayor entre presupuestado y gastado. */
  net: Cents
  /** Ahorro neto acumulado desde el primer mes con datos. Null en meses sin datos. */
  balance: Cents | null
}

export interface CategoryAverage {
  categoryId: string | null
  name: string
  total: Cents
  /** Promedio por mes con datos. */
  average: Cents
  /** Desglose por subcategoría (solo si la categoría tiene subcategorías con gasto). */
  children?: CategoryAverage[]
}

export interface YearSummary {
  months: YearMonthRow[]
  monthsWithData: number
  totals: { income: Cents; budgeted: Cents; spent: Cents; net: Cents }
  /** Promedio por mes con datos (no por 12), como en una hoja de cálculo con meses vacíos. */
  averages: { income: Cents; budgeted: Cents; spent: Cents; net: Cents }
  /** Categorías con gasto en el año, de mayor a menor. */
  byCategory: CategoryAverage[]
}

const groupRank = (categories: Category[], id: string | null) => {
  const g = categories.find((c) => c.id === id)?.group
  return g ? GROUP_ORDER.indexOf(g) : GROUP_ORDER.length
}

/** Resumen de un año: ingresos, gastos y ahorro neto por mes, más el gasto medio por categoría. */
export function yearSummary(args: {
  year: number
  plans: MonthPlan[]
  expenses: Expense[]
  categories: Category[]
  /** Partidas de presupuesto del año: un mes con presupuesto cuenta como mes con datos. */
  items?: BudgetItem[]
  /** Desde este mes (incluido) el ahorro neto es una previsión (ver `YearMonthRow.projected`). */
  currentMonth?: MonthKey
}): YearSummary {
  const { year, plans, categories } = args
  const items = args.items ?? []
  const prefix = `${year}-`
  const expenses = args.expenses.filter((e) => countDate(e).startsWith(prefix))

  let running = 0
  const months: YearMonthRow[] = Array.from({ length: 12 }, (_, i) => {
    const key = makeMonth(year, i + 1)
    const plan = plans.find((p) => p.month === key) ?? null
    const monthExpenses = expenses.filter((e) => monthOf(countDate(e)) === key)
    const income = planIncome(plan)
    const spent = sum(monthExpenses.map((e) => e.amount))
    const budgeted = sum(items.filter((i) => i.month === key && i.amount > 0).map((i) => i.amount))
    const hasData = income > 0 || budgeted > 0 || monthExpenses.length > 0
    // Mes en curso o futuro con presupuesto: el ahorro se prevé con el mayor entre lo presupuestado y lo gastado.
    const projected = !!args.currentMonth && key >= args.currentMonth && budgeted > 0
    const net = income - (projected ? Math.max(budgeted, spent) : spent)
    if (hasData) running += net
    return { month: key, hasData, income, budgeted, spent, projected, net, balance: hasData ? running : null }
  })

  const active = months.filter((m) => m.hasData)
  const n = active.length
  const totals = {
    income: sum(active.map((m) => m.income)),
    budgeted: sum(active.map((m) => m.budgeted)),
    spent: sum(active.map((m) => m.spent)),
    net: sum(active.map((m) => m.net)),
  }
  const avg = (v: number) => (n > 0 ? Math.round(v / n) : 0)

  const byId = new Map<string | null, Cents>()
  for (const e of expenses) byId.set(e.categoryId, (byId.get(e.categoryId) ?? 0) + e.amount)
  const nameOf = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Sin categoría'
  const roots = new Map<string | null, Cents>()
  const kids = new Map<string, CategoryAverage[]>()
  for (const [id, total] of byId) {
    const root = id === null ? null : rootIdOf(categories, id)
    roots.set(root, (roots.get(root) ?? 0) + total)
    if (id !== null && root !== null && total > 0) {
      const label = id === root ? 'General' : nameOf(id)
      kids.set(root, [...(kids.get(root) ?? []), { categoryId: id, name: label, total, average: avg(total) }])
    }
  }
  const byCategory: CategoryAverage[] = [...roots.entries()]
    .map(([categoryId, total]) => {
      const parts = categoryId === null ? [] : (kids.get(categoryId) ?? [])
      const entry: CategoryAverage = { categoryId, name: nameOf(categoryId), total, average: avg(total) }
      // Solo hay desglose si el gasto viene de alguna subcategoría (no si todo está en la categoría padre).
      if (parts.some((p) => p.categoryId !== categoryId)) entry.children = parts.sort((a, b) => b.total - a.total)
      return entry
    })
    .filter((c) => c.total > 0)
    // Por bloque (Necesidades, Deuda, Gustos, Ahorro) y, dentro del bloque, de mayor a menor.
    .sort((a, b) => groupRank(categories, a.categoryId) - groupRank(categories, b.categoryId) || b.total - a.total)

  return {
    months,
    monthsWithData: n,
    totals,
    averages: { income: avg(totals.income), budgeted: avg(totals.budgeted), spent: avg(totals.spent), net: avg(totals.net) },
    byCategory,
  }
}

/**
 * Copia el presupuesto de un mes a otro: mismos ingresos, meta y montos por categoría.
 * Solo se copian categorías que existen (`categoryIds`); una partida sin plan origen devuelve null.
 */
export function copyBudget(
  source: MonthBudget,
  target: MonthKey,
  categoryIds: string[],
): { plan: MonthPlan; items: BudgetItem[] } | null {
  if (!source.plan) return null
  const valid = new Set(categoryIds)
  return {
    plan: { ...source.plan, month: target },
    items: source.items.filter((i) => valid.has(i.categoryId)).map((i) => ({ ...i, month: target })),
  }
}
