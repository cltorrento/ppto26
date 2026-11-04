import { repo } from '@/data'
import { newId } from '@/data/repository'
import { computeChargeDate, monthOf, parseMonth, suggest5030, todayKey } from '@/domain/calc'
import type { Expense, PaymentMethod } from '@/domain/types'

/** Carga un mes de ejemplo (ingreso, reparto 50/30/20, gastos y un gasto programado) en el mes actual. */
export async function loadDemoData(): Promise<void> {
  const month = monthOf(todayKey())
  const { year, month: m } = parseMonth(month)
  const categories = await repo.listCategories()
  const settings = await repo.getSettings()
  const income = 240000
  // Reparto realista (50/30/20 sobre 2.400 €). Las categorías que no estén aquí usan la propuesta automática.
  const preset: Record<string, number> = {
    Vivienda: 67000, Alimentación: 26000, Transporte: 12000, Servicios: 10000, Salud: 5000,
    Ocio: 43000, Otros: 29000, Ahorro: 48000,
  }
  const fallback = suggest5030(income, categories)

  await repo.saveMonthBudget(
    { month, income, extraIncome: 0, savingsGoal: 48000 },
    categories.map((c) => ({ month, categoryId: c.id, amount: preset[c.name] ?? fallback.get(c.id) ?? 0 })),
  )

  const id = (name: string) => categories.find((c) => c.name === name)?.id ?? null
  const day = (d: number) => `${month}-${String(d).padStart(2, '0')}`
  const rows: [number, string, string, number, PaymentMethod][] = [
    [1, 'Alquiler del mes', 'Vivienda', 72000, 'transferencia'],
    [1, 'Compra grande en el supermercado', 'Alimentación', 8435, 'debito'],
    [1, 'Farmacia', 'Salud', 1800, 'efectivo'],
    [2, 'Café y pan del desayuno', 'Alimentación', 480, 'efectivo'],
    [2, 'Combustible', 'Transporte', 4800, 'credito'],
    [2, 'Internet y teléfono', 'Servicios', 5200, 'debito'],
    [2, 'Cine con la familia', 'Ocio', 2450, 'debito'],
    [2, 'Regalo de cumpleaños', 'Otros', 2100, 'efectivo'],
  ]
  for (const [d, description, cat, amount, method] of rows) {
    const date = day(d)
    const e: Expense = {
      id: newId(),
      date,
      categoryId: id(cat),
      amount,
      description,
      method,
      chargeDate: computeChargeDate(date, method, settings.cardPayDay),
    }
    await repo.addExpense(e)
  }
  await repo.addPlannedExpense({
    id: newId(),
    name: 'Seguro del coche',
    amount: 40000,
    year,
    month: m,
    categoryId: id('Transporte'),
    repeatsYearly: true,
  })
}
