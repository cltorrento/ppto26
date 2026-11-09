import type {
  BudgetItem,
  Category,
  EtfConfig,
  Expense,
  Group,
  MonthPlan,
  PaymentMethod,
  PlannedExpense,
  Property,
  PropertyKind,
  Settings,
} from '@/domain/types'
import { DEFAULT_SETTINGS } from '@/domain/types'
import type { Repository } from './repository'
import { supabase } from './supabaseClient'

function client() {
  if (!supabase) throw new Error('Supabase no está configurado.')
  return supabase
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

async function uid(): Promise<string> {
  const { data, error } = await client().auth.getSession()
  if (error) throw new Error(error.message)
  const id = data.session?.user.id
  if (!id) throw new Error('Debes iniciar sesión.')
  return id
}

// ---------- Mapeos fila <-> dominio ----------

type CategoryRow = { id: string; name: string; grp: Group; icon: string; sort_order: number; parent_id?: string | null }
type PlanRow = { month: string; income_cents: number; extra_income_cents: number; savings_goal_cents: number }
type ItemRow = { month: string; category_id: string; amount_cents: number }
type ExpenseRow = {
  id: string
  spent_on: string
  category_id: string | null
  amount_cents: number
  description: string
  method: PaymentMethod
  charge_on: string
  property_id?: string | null
  property_kind?: PropertyKind | null
  amount_usd_cents?: number | null
  outside_budget?: boolean | null
}
type PropertyRow = {
  id: string
  name: string
  acquired_on: string
  price_cents: number
  down_payment_cents: number
  interest_rate: number
  term_months: number
  monthly_payment_cents: number
  first_payment_on: string
  initial_paid_count: number
  cat_cuota: string | null
  cat_materiales: string | null
  cat_construccion: string | null
  cat_otros: string | null
  notes: string
  current_value_cents?: number | null
  building_value_cents?: number | null
  eur_rate?: number | null
  value_on?: string | null
}
type PlannedRow = {
  id: string
  name: string
  amount_cents: number
  year: number
  month: number
  category_id: string | null
  repeats_yearly: boolean
}

const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  group: r.grp,
  icon: r.icon,
  sortOrder: r.sort_order,
  parentId: r.parent_id ?? null,
})
const toPlan = (r: PlanRow): MonthPlan => ({
  month: r.month,
  income: r.income_cents,
  extraIncome: r.extra_income_cents,
  savingsGoal: r.savings_goal_cents,
})
const toItem = (r: ItemRow): BudgetItem => ({ month: r.month, categoryId: r.category_id, amount: r.amount_cents })
const toExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  date: r.spent_on,
  categoryId: r.category_id,
  amount: r.amount_cents,
  description: r.description,
  method: r.method,
  chargeDate: r.charge_on,
  propertyId: r.property_id ?? null,
  propertyKind: r.property_kind ?? null,
  amountUsd: r.amount_usd_cents ?? null,
  // Solo true cuando lo es; así editar un gasto normal no envía la columna (y funciona sin la migración).
  outsideBudget: r.outside_budget === true ? true : undefined,
})
const toProperty = (r: PropertyRow): Property => ({
  id: r.id,
  name: r.name,
  acquisitionDate: r.acquired_on,
  price: r.price_cents,
  downPayment: r.down_payment_cents,
  interestRate: Number(r.interest_rate),
  termMonths: r.term_months,
  monthlyPayment: r.monthly_payment_cents,
  firstPaymentDate: r.first_payment_on,
  initialPaidCount: r.initial_paid_count,
  categoryByKind: { cuota: r.cat_cuota, materiales: r.cat_materiales, construccion: r.cat_construccion, otros: r.cat_otros },
  notes: r.notes ?? '',
  currentValue: r.current_value_cents ?? 0,
  buildingValue: r.building_value_cents ?? 0,
  eurRate: r.eur_rate != null ? Number(r.eur_rate) : undefined,
  valueDate: r.value_on ?? null,
})
const toPlanned = (r: PlannedRow): PlannedExpense => ({
  id: r.id,
  name: r.name,
  amount: r.amount_cents,
  year: r.year,
  month: r.month,
  categoryId: r.category_id,
  repeatsYearly: r.repeats_yearly,
})

// ---------- Repositorio ----------

export const supabaseRepository: Repository = {
  async getSettings() {
    const rows = check(await client().from('settings').select('card_pay_day, reference_income_cents').limit(1))
    const r = rows?.[0] as { card_pay_day: number; reference_income_cents: number } | undefined
    return r ? { cardPayDay: r.card_pay_day, referenceIncome: r.reference_income_cents } : { ...DEFAULT_SETTINGS }
  },
  async getEtf() {
    const { data, error } = await client().from('settings').select('etf').limit(1)
    // Antes de ejecutar migracion-etf.sql la columna no existe: no es un error para el resto de la app.
    if (error) return null
    const r = (data as { etf?: EtfConfig | null }[] | null)?.[0]
    return r?.etf ?? null
  },
  async saveEtf(config) {
    const user_id = await uid()
    const { error } = await client().from('settings').upsert({ user_id, etf: config })
    if (error) throw new Error(/etf/i.test(error.message) ? 'Falta ejecutar supabase/migracion-etf.sql en Supabase.' : error.message)
  },
  async saveSettings(settings: Settings) {
    const user_id = await uid()
    check(
      await client()
        .from('settings')
        .upsert({ user_id, card_pay_day: settings.cardPayDay, reference_income_cents: settings.referenceIncome }),
    )
  },

  async listCategories() {
    const rows = check(await client().from('categories').select('*').order('sort_order'))
    return (rows as CategoryRow[]).map(toCategory)
  },
  async saveCategories(categories: Category[]) {
    const user_id = await uid()
    const sb = client()
    // `parent_id` solo se envía si hay subcategorías: así la app sigue funcionando antes de ejecutar la migración.
    const hasParents = categories.some((c) => c.parentId)
    const withParent = (c: Category) => (hasParents ? { parent_id: c.parentId ?? null } : {})
    const parents = categories.filter((c) => !c.parentId)
    const kids = categories.filter((c) => c.parentId)
    // Primero las categorías de primer nivel y luego las hijas, para respetar la clave foránea.
    for (const batch of [parents, kids]) {
      if (!batch.length) continue
      check(
        await sb.from('categories').upsert(
          batch.map((c) => ({ id: c.id, user_id, name: c.name, grp: c.group, icon: c.icon, sort_order: c.sortOrder, ...withParent(c) })),
        ),
      )
    }
    const existing = check(await sb.from('categories').select('*')) as CategoryRow[]
    const keep = new Set(categories.map((c) => c.id))
    const remove = existing.filter((r) => !keep.has(r.id))
    // Los gastos de una subcategoría eliminada pasan a su categoría padre si ésta se conserva.
    for (const r of remove) {
      if (r.parent_id && keep.has(r.parent_id)) {
        check(await sb.from('expenses').update({ category_id: r.parent_id }).eq('category_id', r.id))
      }
    }
    if (remove.length) check(await sb.from('categories').delete().in('id', remove.map((r) => r.id)))
  },
  async reassignBudgetItems(fromIds, toId) {
    const user_id = await uid()
    const sb = client()
    const from = fromIds.filter((id) => id !== toId)
    if (!from.length) return
    const moved = check(await sb.from('budget_items').select('*').in('category_id', from)) as ItemRow[]
    if (!moved.length) return
    const existing = check(await sb.from('budget_items').select('*').eq('category_id', toId)) as ItemRow[]
    const totals = new Map(existing.map((i) => [i.month, i.amount_cents]))
    for (const i of moved) totals.set(i.month, (totals.get(i.month) ?? 0) + i.amount_cents)
    check(
      await sb.from('budget_items').upsert(
        [...totals.entries()].map(([month, amount_cents]) => ({ user_id, month, category_id: toId, amount_cents })),
      ),
    )
    check(await sb.from('budget_items').delete().in('category_id', from))
  },

  async getMonthBudget(month) {
    const sb = client()
    const plans = check(await sb.from('month_plans').select('*').eq('month', month)) as PlanRow[]
    const items = check(await sb.from('budget_items').select('*').eq('month', month)) as ItemRow[]
    return { plan: plans[0] ? toPlan(plans[0]) : null, items: items.map(toItem) }
  },
  async saveMonthBudget(plan, items) {
    const user_id = await uid()
    const sb = client()
    check(
      await sb.from('month_plans').upsert({
        user_id,
        month: plan.month,
        income_cents: plan.income,
        extra_income_cents: plan.extraIncome,
        savings_goal_cents: plan.savingsGoal,
      }),
    )
    if (items.length) {
      check(
        await sb.from('budget_items').upsert(
          items.map((i) => ({ user_id, month: i.month, category_id: i.categoryId, amount_cents: i.amount })),
        ),
      )
    }
    // Elimina partidas que ya no están en el reparto (p. ej. categorías borradas en esta edición).
    const keep = new Set(items.map((i) => i.categoryId))
    const existing = check(await sb.from('budget_items').select('category_id').eq('month', plan.month)) as {
      category_id: string
    }[]
    const remove = existing.map((r) => r.category_id).filter((id) => !keep.has(id))
    if (remove.length) check(await sb.from('budget_items').delete().eq('month', plan.month).in('category_id', remove))
  },
  async deleteMonthBudget(month) {
    const sb = client()
    check(await sb.from('budget_items').delete().eq('month', month))
    check(await sb.from('month_plans').delete().eq('month', month))
  },
  async listYearBudgets(year) {
    const sb = client()
    const like = `${year}-%`
    const plans = check(await sb.from('month_plans').select('*').like('month', like)) as PlanRow[]
    const items = check(await sb.from('budget_items').select('*').like('month', like)) as ItemRow[]
    return { plans: plans.map(toPlan), items: items.map(toItem) }
  },
  async setBudgetItem(item) {
    const user_id = await uid()
    check(
      await client()
        .from('budget_items')
        .upsert({ user_id, month: item.month, category_id: item.categoryId, amount_cents: item.amount }),
    )
  },

  async listExpenses({ from, to }) {
    const rows = check(
      await client().from('expenses').select('*').gte('spent_on', from).lte('spent_on', to).order('spent_on', { ascending: false }),
    )
    // Los gastos «fuera del presupuesto» (histórico del terreno) no cuentan aquí. Se filtra en el cliente para no fallar sin la migración.
    return (rows as ExpenseRow[]).filter((r) => r.outside_budget !== true).map(toExpense)
  },
  async listExpensesByChargeDate({ from, to }) {
    const rows = check(
      await client().from('expenses').select('*').gte('charge_on', from).lte('charge_on', to).order('spent_on', { ascending: false }),
    )
    return (rows as ExpenseRow[]).filter((r) => r.outside_budget !== true).map(toExpense)
  },
  async addExpense(e) {
    const user_id = await uid()
    check(
      await client().from('expenses').insert({
        id: e.id,
        user_id,
        spent_on: e.date,
        category_id: e.categoryId,
        amount_cents: e.amount,
        description: e.description,
        method: e.method,
        charge_on: e.chargeDate,
        // Solo si el gasto es de un terreno: así la app sigue funcionando antes de ejecutar la migración.
        ...(e.propertyId ? { property_id: e.propertyId, property_kind: e.propertyKind ?? null } : {}),
        // El monto en dólares requiere migracion-terreno-dolares.sql.
        ...(e.propertyId && e.amountUsd != null ? { amount_usd_cents: e.amountUsd } : {}),
        // Requiere migracion-terreno-fuera-presupuesto.sql. Solo si es histórico: así el resto sigue funcionando sin ella.
        ...(e.outsideBudget ? { outside_budget: true } : {}),
      }),
    )
  },
  async deleteExpense(id) {
    check(await client().from('expenses').delete().eq('id', id))
  },
  async updateExpense(e) {
    check(
      await client()
        .from('expenses')
        .update({
          spent_on: e.date,
          category_id: e.categoryId,
          amount_cents: e.amount,
          description: e.description,
          method: e.method,
          charge_on: e.chargeDate,
          property_kind: e.propertyKind ?? null,
          // Solo si es un gasto del terreno con monto en dólares (requiere migracion-terreno-dolares.sql).
          ...(e.propertyId && e.amountUsd != null ? { amount_usd_cents: e.amountUsd } : {}),
          // Solo si cambia (true o false explícito): requiere migracion-terreno-fuera-presupuesto.sql.
          ...(e.outsideBudget !== undefined ? { outside_budget: e.outsideBudget } : {}),
        })
        .eq('id', e.id),
    )
  },
  async updateExpenseAmounts(updates) {
    const sb = client()
    for (const u of updates) check(await sb.from('expenses').update({ amount_cents: u.amount, amount_usd_cents: u.amountUsd }).eq('id', u.id))
  },
  async updateChargeDates(updates) {
    const sb = client()
    for (const u of updates) check(await sb.from('expenses').update({ charge_on: u.chargeDate }).eq('id', u.id))
  },

  async listProperties() {
    const rows = check(await client().from('properties').select('*').order('acquired_on'))
    return (rows as PropertyRow[]).map(toProperty)
  },
  async saveProperty(p) {
    const user_id = await uid()
    check(
      await client().from('properties').upsert({
        id: p.id,
        user_id,
        name: p.name,
        acquired_on: p.acquisitionDate,
        price_cents: p.price,
        down_payment_cents: p.downPayment,
        interest_rate: p.interestRate,
        term_months: p.termMonths,
        monthly_payment_cents: p.monthlyPayment,
        first_payment_on: p.firstPaymentDate,
        initial_paid_count: p.initialPaidCount,
        cat_cuota: p.categoryByKind.cuota ?? null,
        cat_materiales: p.categoryByKind.materiales ?? null,
        cat_construccion: p.categoryByKind.construccion ?? null,
        cat_otros: p.categoryByKind.otros ?? null,
        notes: p.notes,
        // Solo si hay un valor estimado: así guardar la ficha funciona antes de ejecutar la migración del valor.
        ...(p.currentValue ? { current_value_cents: p.currentValue, value_on: p.valueDate ?? null } : {}),
        // Solo si hay valor de lo construido (requiere migracion-terreno-construccion.sql).
        ...(p.buildingValue ? { building_value_cents: p.buildingValue } : {}),
        // El tipo de cambio requiere migracion-terreno-dolares.sql.
        ...(p.eurRate ? { eur_rate: p.eurRate } : {}),
      }),
    )
  },
  async deleteProperty(id) {
    // El gasto se conserva: la clave foránea (on delete set null) solo suelta el vínculo con la ficha.
    check(await client().from('properties').delete().eq('id', id))
  },
  async listPropertyExpenses(propertyId) {
    const rows = check(await client().from('expenses').select('*').eq('property_id', propertyId).order('spent_on', { ascending: false }))
    return (rows as ExpenseRow[]).map(toExpense)
  },

  async listPlannedExpenses() {
    const rows = check(await client().from('planned_expenses').select('*').order('month'))
    return (rows as PlannedRow[]).map(toPlanned)
  },
  async addPlannedExpense(p) {
    const user_id = await uid()
    check(
      await client().from('planned_expenses').insert({
        id: p.id,
        user_id,
        name: p.name,
        amount_cents: p.amount,
        year: p.year,
        month: p.month,
        category_id: p.categoryId,
        repeats_yearly: p.repeatsYearly,
      }),
    )
  },
  async deletePlannedExpense(id) {
    check(await client().from('planned_expenses').delete().eq('id', id))
  },
}
