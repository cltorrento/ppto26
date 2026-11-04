import { describe, expect, it } from 'vitest'
import {
  addMonths,
  cardSummary,
  categoryProgress,
  categoryStatus,
  computeChargeDate,
  daysInMonth,
  groupProgress,
  isValidDateKey,
  monthCapacity,
  monthRange,
  plannedReservesForMonth,
  suggest5030,
  summarizeMonth,
  yearSummary,
} from './calc'
import { formatInput, parseMoney } from './money'
import { DEFAULT_CATEGORIES } from './types'
import type { Category, Expense, MonthPlan, PlannedExpense } from './types'

const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: `c${i}` }))
const plan: MonthPlan = { month: '2026-11', income: 240000, extraIncome: 0, savingsGoal: 0 }

const exp = (over: Partial<Expense>): Expense => ({
  id: Math.random().toString(),
  date: '2026-11-02',
  categoryId: 'c0',
  amount: 1000,
  description: 'x',
  method: 'efectivo',
  chargeDate: '2026-11-02',
  ...over,
})

describe('parseMoney', () => {
  it('acepta formatos habituales', () => {
    expect(parseMoney('1234,56')).toBe(123456)
    expect(parseMoney('1.234,56')).toBe(123456)
    expect(parseMoney('1234.56')).toBe(123456)
    expect(parseMoney('1,234.56')).toBe(123456)
    expect(parseMoney('720')).toBe(72000)
    expect(parseMoney('0,5')).toBe(50)
    expect(parseMoney('12 €')).toBe(1200)
  })
  it('trata "1.234" como miles y "1,5" como decimal', () => {
    expect(parseMoney('1.234')).toBe(123400)
    expect(parseMoney('1,5')).toBe(150)
  })
  it('rechaza valores inválidos', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('-5')).toBeNull()
    expect(parseMoney('1,234567')).toBeNull()
  })
  it('formatInput es inverso de parseMoney', () => {
    expect(parseMoney(formatInput(123456))).toBe(123456)
    expect(formatInput(5)).toBe('0,05')
  })
})

describe('fechas', () => {
  it('addMonths cruza años', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
  it('daysInMonth', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2026-11')).toBe(30)
  })
  it('monthRange usa el último día real del mes', () => {
    expect(monthRange('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(monthRange('2026-02').to).toBe('2026-02-28')
    expect(monthRange('2028-02').to).toBe('2028-02-29')
    expect(monthRange('2026-12').to).toBe('2026-12-31')
  })
  it('isValidDateKey', () => {
    expect(isValidDateKey('2026-02-30')).toBe(false)
    expect(isValidDateKey('2026-11-04')).toBe(true)
    expect(isValidDateKey('04/11/2026')).toBe(false)
  })
})

describe('computeChargeDate', () => {
  it('crédito: día de pago del mes siguiente', () => {
    expect(computeChargeDate('2026-11-02', 'credito', 15)).toBe('2026-12-15')
    expect(computeChargeDate('2026-12-20', 'credito', 15)).toBe('2027-01-15')
  })
  it('limita el día a 1-28', () => {
    expect(computeChargeDate('2026-01-10', 'credito', 31)).toBe('2026-02-28')
  })
  it('otros métodos: mismo día', () => {
    expect(computeChargeDate('2026-11-02', 'debito', 15)).toBe('2026-11-02')
    expect(computeChargeDate('2026-11-02', 'efectivo', 15)).toBe('2026-11-02')
  })
})

describe('summarizeMonth', () => {
  const expenses = [exp({ amount: 72000 }), exp({ amount: 8435 }), exp({ amount: 1800 })]
  it('remaining = ingreso - gastado - reservado y es coherente', () => {
    const reserves: PlannedExpense[] = [
      { id: 'p', name: 'Seguro', amount: 40000, year: 2026, month: 11, categoryId: null, repeatsYearly: true },
    ]
    const s = summarizeMonth({ plan, monthExpenses: expenses, reserves, month: '2026-11', today: '2026-11-05' })
    expect(s.spent).toBe(82235)
    expect(s.reserved).toBe(40000)
    expect(s.remaining).toBe(240000 - 82235 - 40000)
    expect(s.spentRatio).toBeCloseTo(82235 / 240000)
    expect(s.committedRatio).toBeCloseTo(122235 / 240000)
    expect(s.daysLeft).toBe(26)
    expect(s.dailyAllowance).toBe(Math.floor(s.remaining / 26))
    expect(s.dailyAverage).toBe(Math.round(82235 / 5))
  })
  it('meses que no son el actual no tienen ritmo diario', () => {
    const s = summarizeMonth({ plan, monthExpenses: [], reserves: [], month: '2026-10', today: '2026-11-05' })
    expect(s.dailyAllowance).toBeNull()
    expect(s.dailyAverage).toBeNull()
  })
  it('sin plan no divide por cero', () => {
    const s = summarizeMonth({ plan: null, monthExpenses: expenses, reserves: [], month: '2026-11', today: '2026-11-05' })
    expect(s.spentRatio).toBe(0)
    expect(s.remaining).toBe(-82235)
  })
})

describe('plannedReservesForMonth', () => {
  const planned: PlannedExpense[] = [
    { id: '1', name: 'Seguro del coche', amount: 40000, year: 2025, month: 11, categoryId: null, repeatsYearly: true },
    { id: '2', name: 'Viaje', amount: 90000, year: 2026, month: 11, categoryId: null, repeatsYearly: false },
    { id: '3', name: 'Viaje 2025', amount: 90000, year: 2025, month: 11, categoryId: null, repeatsYearly: false },
  ]
  it('incluye anuales de años anteriores y excluye puntuales de otros años', () => {
    const r = plannedReservesForMonth(planned, '2026-11', [])
    expect(r.map((p) => p.id).sort()).toEqual(['1', '2'])
  })
  it('no cuenta dos veces si ya hay un gasto con el mismo nombre', () => {
    const r = plannedReservesForMonth(planned, '2026-11', [exp({ description: ' seguro del COCHE ' })])
    expect(r.map((p) => p.id)).toEqual(['2'])
  })
})

describe('categoryProgress y grupos', () => {
  const items = categories.map((c, i) => ({ month: '2026-11', categoryId: c.id, amount: i === 0 ? 67000 : 10000 }))
  it('detecta categoría excedida', () => {
    const p = categoryProgress(categories, items, [exp({ categoryId: 'c0', amount: 72000 })])
    expect(p[0].status).toBe('exceeded')
    expect(p[0].available).toBe(-5000)
    expect(p[1].status).toBe('ok')
  })
  it('categoryStatus: sin presupuesto pero con gasto = excedida', () => {
    expect(categoryStatus(0, 100)).toBe('exceeded')
    expect(categoryStatus(0, 0)).toBe('ok')
    expect(categoryStatus(10000, 9000)).toBe('near')
  })
  it('groupProgress agrega por bloque', () => {
    const p = categoryProgress(categories, items, [exp({ categoryId: 'c7', amount: 5000 })])
    const g = groupProgress(p, 240000)
    const ahorro = g.find((x) => x.group === 'ahorro')!
    expect(ahorro.planned).toBe(10000)
    expect(ahorro.actual).toBe(5000)
    expect(g.find((x) => x.group === 'necesidades')!.planned).toBe(67000 + 4 * 10000)
  })
})

describe('cardSummary', () => {
  it('separa lo que se compra este mes de lo que se cobra este mes', () => {
    const e = [
      exp({ date: '2026-11-02', amount: 4800, method: 'credito', chargeDate: '2026-12-15' }),
      exp({ date: '2026-10-20', amount: 9640, method: 'credito', chargeDate: '2026-11-15' }),
      exp({ date: '2026-11-03', amount: 1000, method: 'debito' }),
    ]
    const c = cardSummary(e, '2026-11', 15)
    expect(c.purchasedThisMonth).toBe(4800)
    expect(c.chargedThisMonth).toBe(9640)
    expect(c.nextChargeDate).toBe('2026-12-15')
  })
})

describe('suggest5030', () => {
  it('la suma es exactamente el ingreso y respeta 50/30/20', () => {
    const r = suggest5030(240000, categories)
    const total = [...r.values()].reduce((a, b) => a + b, 0)
    expect(total).toBe(240000)
    const need = categories.filter((c) => c.group === 'necesidades').reduce((a, c) => a + r.get(c.id)!, 0)
    const fun = categories.filter((c) => c.group === 'gustos').reduce((a, c) => a + r.get(c.id)!, 0)
    const save = categories.filter((c) => c.group === 'ahorro').reduce((a, c) => a + r.get(c.id)!, 0)
    expect([need, fun, save]).toEqual([120000, 72000, 48000])
  })
  it('suma exacta con importes que no dividen bien', () => {
    const r = suggest5030(100001, categories)
    expect([...r.values()].reduce((a, b) => a + b, 0)).toBe(100001)
  })
  it('usa la meta de ahorro si existe', () => {
    const r = suggest5030(240000, categories, 60000)
    const save = categories.filter((c) => c.group === 'ahorro').reduce((a, c) => a + r.get(c.id)!, 0)
    expect(save).toBe(60000)
    expect([...r.values()].reduce((a, b) => a + b, 0)).toBe(240000)
  })
  it('un bloque sin categorías no pierde dinero', () => {
    const r = suggest5030(10000, categories.filter((c) => c.group !== 'ahorro'))
    expect([...r.values()].reduce((a, b) => a + b, 0)).toBe(10000)
  })
  it('sin ingreso devuelve ceros', () => {
    expect([...suggest5030(0, categories).values()].every((v) => v === 0)).toBe(true)
  })
})

describe('monthCapacity', () => {
  it('usa el ingreso de referencia si el mes no tiene presupuesto', () => {
    const c = monthCapacity({ month: '2026-03', plan: null, items: [], planned: [], referenceIncome: 200000 })
    expect(c.income).toBe(200000)
    expect(c.margin).toBe(200000)
    expect(c.hasBudget).toBe(false)
  })
  it('sin ingreso ni referencia no hay margen', () => {
    const c = monthCapacity({ month: '2026-03', plan: null, items: [], planned: [], referenceIncome: 0 })
    expect(c.margin).toBeNull()
  })
  it('resta presupuesto y gastos programados', () => {
    const c = monthCapacity({
      month: '2026-11',
      plan,
      items: [{ month: '2026-11', categoryId: 'c0', amount: 100000 }],
      planned: [{ id: 'p', name: 'Seguro', amount: 40000, year: 2026, month: 11, categoryId: null, repeatsYearly: false }],
      referenceIncome: 0,
    })
    expect(c.margin).toBe(240000 - 100000 - 40000)
  })
})

describe('yearSummary', () => {
  // Reproduce una hoja real: ingresos y gastos de oct-dic, con meses anteriores vacíos.
  const plans: MonthPlan[] = [
    { month: '2026-10', income: 346932, extraIncome: 0, savingsGoal: 0 },
    { month: '2026-11', income: 304000, extraIncome: 0, savingsGoal: 0 },
    { month: '2026-12', income: 554000, extraIncome: 0, savingsGoal: 0 },
  ]
  const expenses = [
    exp({ date: '2026-10-05', amount: 343124, categoryId: 'c0' }),
    exp({ date: '2026-11-05', amount: 259128, categoryId: 'c1' }),
    exp({ date: '2026-12-05', amount: 296597, categoryId: 'c0' }),
  ]
  const s = yearSummary({ year: 2026, plans, expenses, categories })

  it('calcula ahorro neto y saldo acumulado por mes', () => {
    const [oct, nov, dic] = s.months.slice(9)
    expect([oct.net, nov.net, dic.net]).toEqual([3808, 44872, 257403])
    expect([oct.balance, nov.balance, dic.balance]).toEqual([3808, 48680, 306083])
  })
  it('los meses sin datos no tienen saldo ni cuentan en promedios', () => {
    expect(s.months[0].hasData).toBe(false)
    expect(s.months[0].balance).toBeNull()
    expect(s.monthsWithData).toBe(3)
  })
  it('totales y promedios por mes con datos', () => {
    expect(s.totals).toEqual({ income: 1204932, spent: 898849, net: 306083 })
    expect(s.averages.income).toBe(401644)
    expect(s.averages.spent).toBe(299616)
    expect(s.averages.net).toBe(102028)
  })
  it('gasto medio por categoría, de mayor a menor, sin categorías vacías', () => {
    expect(s.byCategory.map((c) => c.name)).toEqual(['Vivienda', 'Alimentación'])
    expect(s.byCategory[0].total).toBe(343124 + 296597)
    expect(s.byCategory[0].average).toBe(Math.round((343124 + 296597) / 3))
  })
  it('ignora gastos de otros años y agrupa los sin categoría', () => {
    const r = yearSummary({
      year: 2026,
      plans: [],
      expenses: [exp({ date: '2025-12-31', amount: 999 }), exp({ date: '2026-01-10', amount: 500, categoryId: null })],
      categories,
    })
    expect(r.totals.spent).toBe(500)
    expect(r.byCategory).toEqual([{ categoryId: null, name: 'Sin categoría', total: 500, average: 500 }])
  })
  it('año vacío no divide por cero', () => {
    const r = yearSummary({ year: 2030, plans: [], expenses: [], categories })
    expect(r.monthsWithData).toBe(0)
    expect(r.averages).toEqual({ income: 0, spent: 0, net: 0 })
    expect(r.byCategory).toEqual([])
  })
})
