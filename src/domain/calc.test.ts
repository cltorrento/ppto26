import { describe, expect, it } from 'vitest'
import {
  countDate,
  expensesByPurchaseMonth,
  addMonths,
  budgetLeaves,
  childrenOf,
  rootIdOf,
  topLevel,
  copyBudget,
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
  sum,
  yearSummary,
} from './calc'
import { formatInput, formatUsd, parseMoney } from './money'
import { priceOnOrAfter, summarizeEtf } from './etf'
import { RESTORE_TREE, normName, restoreRows } from './restore'
import { buildSchedule, buildYearTables, categoryForKind, computePayment, dueDate, eurOf, findDuplicateExpenses, summarizeProperty, toEur, usdOf } from './property'
import { DEFAULT_CATEGORIES } from './types'
import type { Category, Expense, MonthPlan, PlannedExpense, Property } from './types'

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
  it('la suma es exactamente el ingreso y respeta los objetivos sin Deuda', () => {
    const r = suggest5030(240000, categories)
    const total = [...r.values()].reduce((a, b) => a + b, 0)
    expect(total).toBe(240000)
    const need = categories.filter((c) => c.group === 'necesidades').reduce((a, c) => a + r.get(c.id)!, 0)
    const fun = categories.filter((c) => c.group === 'gustos').reduce((a, c) => a + r.get(c.id)!, 0)
    const save = categories.filter((c) => c.group === 'ahorro').reduce((a, c) => a + r.get(c.id)!, 0)
    expect([need, fun, save]).toEqual([137143, 54857, 48000])
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
    expect(s.totals).toEqual({ income: 1204932, budgeted: 0, spent: 898849, net: 306083 })
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
    expect(r.averages).toEqual({ income: 0, budgeted: 0, spent: 0, net: 0 })
    expect(r.byCategory).toEqual([])
  })
})

describe('copyBudget', () => {
  const source = {
    plan: { month: '2026-01', income: 200000, extraIncome: 5000, savingsGoal: 40000 },
    items: [
      { month: '2026-01', categoryId: 'a', amount: 100000 },
      { month: '2026-01', categoryId: 'gone', amount: 1 },
    ],
  }
  it('copia plan y partidas al mes destino', () => {
    const r = copyBudget(source, '2026-02', ['a'])!
    expect(r.plan).toEqual({ month: '2026-02', income: 200000, extraIncome: 5000, savingsGoal: 40000 })
    expect(r.items).toEqual([{ month: '2026-02', categoryId: 'a', amount: 100000 }])
  })
  it('sin plan de origen no hay nada que copiar', () => {
    expect(copyBudget({ plan: null, items: [] }, '2026-02', ['a'])).toBeNull()
  })
})

describe('subcategorías', () => {
  const cats = [
    { id: 'viv', name: 'Vivienda', group: 'necesidades' as const, icon: 'home', sortOrder: 0 },
    { id: 'alq', name: 'Alquiler', group: 'necesidades' as const, icon: 'dots', sortOrder: 1, parentId: 'viv' },
    { id: 'seg', name: 'Seguro', group: 'necesidades' as const, icon: 'dots', sortOrder: 2, parentId: 'viv' },
    { id: 'ocio', name: 'Ocio', group: 'gustos' as const, icon: 'dots', sortOrder: 3 },
  ]
  const items = [
    { month: '2026-11', categoryId: 'alq', amount: 70000 },
    { month: '2026-11', categoryId: 'seg', amount: 5000 },
    { month: '2026-11', categoryId: 'ocio', amount: 10000 },
  ]
  const e = (categoryId: string, amount: number) => ({
    id: Math.random().toString(), date: '2026-11-02', categoryId, amount, description: '', method: 'debito' as const, chargeDate: '2026-11-02',
  })

  it('distingue primer nivel, hijas y partidas con presupuesto', () => {
    expect(topLevel(cats).map((c) => c.id)).toEqual(['viv', 'ocio'])
    expect(childrenOf(cats, 'viv').map((c) => c.id)).toEqual(['alq', 'seg'])
    expect(budgetLeaves(cats).map((c) => c.id)).toEqual(['alq', 'seg', 'ocio'])
    expect(rootIdOf(cats, 'seg')).toBe('viv')
    expect(rootIdOf(cats, 'ocio')).toBe('ocio')
  })
  it('el presupuesto del padre suma el de las hijas y el gasto incluye hijas y gasto general', () => {
    const p = categoryProgress(cats, items, [e('alq', 72000), e('seg', 1000), e('viv', 500), e('ocio', 2000)])
    expect(p.map((x) => x.category.id)).toEqual(['viv', 'ocio'])
    expect(p[0].budget).toBe(75000)
    expect(p[0].spent).toBe(73500)
    expect(p[0].ownSpent).toBe(500)
    expect(p[0].children.map((c) => [c.category.id, c.budget, c.spent])).toEqual([['alq', 70000, 72000], ['seg', 5000, 1000]])
    expect(p[0].children[0].status).toBe('exceeded')
    expect(p[1].children).toEqual([])
  })
  it('ignora una partida huérfana en el padre (no duplica)', () => {
    const p = categoryProgress(cats, [...items, { month: '2026-11', categoryId: 'viv', amount: 99999 }], [])
    expect(p[0].budget).toBe(75000)
  })
  it('suggest5030 reparte entre categorías y luego entre subcategorías, sumando el ingreso', () => {
    const r = suggest5030(100000, cats)
    expect(r.get('viv')).toBe(r.get('alq')! + r.get('seg')!)
    expect(r.get('viv')! + r.get('ocio')!).toBe(100000)
    const leafSum = budgetLeaves(cats).reduce((a, c) => a + r.get(c.id)!, 0)
    expect(leafSum).toBe(100000)
  })
  it('yearSummary agrupa por categoría padre con desglose', () => {
    const r = yearSummary({ year: 2026, plans: [], expenses: [e('alq', 700), e('seg', 300), e('ocio', 100)], categories: cats })
    expect(r.byCategory[0]).toMatchObject({ categoryId: 'viv', name: 'Vivienda', total: 1000 })
    expect(r.byCategory[0].children?.map((c) => [c.name, c.total])).toEqual([['Alquiler', 700], ['Seguro', 300]])
    expect(r.byCategory[1].children).toBeUndefined()
  })
})

describe('terreno: plan de cuotas', () => {
  const base: Property = {
    id: 'p1', name: 'Terreno', acquisitionDate: '2026-01-15', price: 1200000, downPayment: 200000,
    interestRate: 12, termMonths: 12, monthlyPayment: 0, firstPaymentDate: '2026-01-31',
    initialPaidCount: 0, categoryByKind: {}, notes: '',
  }
  const pay = (kind: 'cuota' | 'materiales' | 'construccion' | 'otros', amount: number, propertyId = 'p1') => ({
    id: Math.random().toString(), date: '2026-02-01', categoryId: null, amount, description: '', method: 'transferencia' as const,
    chargeDate: '2026-02-01', propertyId, propertyKind: kind,
  })

  it('calcula la cuota con interés (10.000 € al 12 % en 12 meses = 888,49 €) y sin interés', () => {
    expect(computePayment(1000000, 12, 12)).toBe(88849)
    expect(computePayment(120000, 0, 12)).toBe(10000)
    expect(computePayment(0, 12, 12)).toBe(0)
    expect(computePayment(1000000, 12, 0)).toBe(0)
  })
  it('las fechas mantienen el día y se ajustan a meses cortos', () => {
    expect(dueDate('2026-01-31', 1)).toBe('2026-01-31')
    expect(dueDate('2026-01-31', 2)).toBe('2026-02-28')
    expect(dueDate('2026-01-31', 3)).toBe('2026-03-31')
    expect(dueDate('2026-11-15', 3)).toBe('2027-01-15')
  })
  it('el plan amortiza todo el capital y la última fecha es la de la cuota 12', () => {
    const s = buildSchedule(base)
    expect(s).toHaveLength(12)
    expect(s[11].balance).toBe(0)
    expect(sum(s.map((r) => r.capital))).toBe(1000000)
    expect(s[0].interest).toBe(10000)
    expect(s[0].payment).toBe(88849)
    expect(s[11].dueDate).toBe('2026-12-31')
    expect(sum(s.map((r) => r.payment))).toBe(sum(s.map((r) => r.capital + r.interest)))
  })
  it('respeta una cuota escrita a mano y cierra el saldo en la última', () => {
    const s = buildSchedule({ ...base, monthlyPayment: 90000 })
    expect(s[0].payment).toBe(90000)
    expect(s[11].balance).toBe(0)
  })
  it('sin precio financiado no hay plan', () => {
    expect(buildSchedule({ ...base, downPayment: base.price })).toEqual([])
  })
  it('resume cuotas pagadas, pendientes, saldo y lo invertido por tipo', () => {
    const exps = [pay('cuota', 88849), pay('cuota', 88849), pay('materiales', 30000), pay('construccion', 50000), pay('otros', 5000), pay('cuota', 1, 'otro-terreno')]
    const r = summarizeProperty({ ...base, initialPaidCount: 1 }, exps)
    expect(r.paidCount).toBe(3)
    expect(r.remaining).toBe(9)
    expect(r.nextDue).toBe(dueDate('2026-01-31', 4))
    expect(r.endDate).toBe('2026-12-31')
    expect(r.balance).toBe(r.schedule[2].balance)
    expect(r.capitalPaid + r.balance).toBe(1000000)
    expect(r.invested.materiales).toBe(30000)
    expect(r.invested.construccion).toBe(50000)
    expect(r.invested.otros).toBe(5000)
    // entrada + 1 cuota previa (plan) + 2 registradas
    expect(r.invested.cuota).toBe(200000 + 88849 + 88849 * 2)
    expect(r.totalInvested).toBe(r.invested.cuota + 30000 + 50000 + 5000)
  })
  it('sin pagos: saldo = lo financiado y progreso 0', () => {
    const r = summarizeProperty(base, [])
    expect(r.paidCount).toBe(0)
    expect(r.balance).toBe(1000000)
    expect(r.progress).toBe(0)
    expect(r.invested.cuota).toBe(200000)
  })
  it('todas pagadas: sin próxima cuota', () => {
    const exps = Array.from({ length: 12 }, () => pay('cuota', 88849))
    const r = summarizeProperty(base, exps)
    expect(r.remaining).toBe(0)
    expect(r.nextDue).toBeNull()
    expect(r.balance).toBe(0)
  })
  it('categoría por tipo: la suya, o la de las cuotas, o ninguna', () => {
    const p = { ...base, categoryByKind: { cuota: 'c1', materiales: 'c2' } }
    expect(categoryForKind(p, 'materiales')).toBe('c2')
    expect(categoryForKind(p, 'construccion')).toBe('c1')
    expect(categoryForKind(base, 'otros')).toBeNull()
  })
})

describe('terreno: como la hoja de cálculo (298 € × 181 cuotas, sin interés)', () => {
  const sheet: Property = {
    id: 'p1', name: 'Terreno', acquisitionDate: '2025-09-01', price: 5393800, downPayment: 0,
    interestRate: 0, termMonths: 181, monthlyPayment: 0, firstPaymentDate: '2025-10-20',
    initialPaidCount: 0, categoryByKind: {}, notes: '',
  }
  const cuota = (date: string, description = '', propertyId = 'p1') => ({
    id: date + description, date, categoryId: null, amount: 29800, description, method: 'transferencia' as const,
    chargeDate: date, propertyId, propertyKind: 'cuota' as const,
  })
  it('Monto 53.938 y A pagar 50.064 tras 13 cuotas', () => {
    const exps = [
      cuota('2025-10-20', 'Recibo - 19459'), cuota('2025-10-20', 'Recibo - 19459'), cuota('2025-12-17', 'Banco Cuscatlan'),
      ...['2026-01-13', '2026-02-19', '2026-03-18', '2026-04-14', '2026-05-13', '2026-06-27', '2026-07-27', '2026-08-28', '2026-09-29', '2026-10-26'].map((d) => cuota(d, 'Banco Cuscatlan')),
    ]
    const r = summarizeProperty(sheet, exps)
    expect(computePayment(5393800, 0, 181)).toBe(29800)
    expect(r.totalAmount).toBe(5393800)
    expect(r.paidCount).toBe(13)
    expect(r.toPay).toBe(5006400)
    expect(r.invested.cuota).toBe(387400)
  })
  it('tablas por año: 2025 con 3 cuotas (894 €) y 2026 con 10 pagadas (2.980 €)', () => {
    const exps = [cuota('2025-10-20', 'Recibo - 19459'), cuota('2025-11-20', 'Recibo - 19459'), cuota('2025-12-17', 'Banco Cuscatlan'), cuota('2026-01-13', 'Banco Cuscatlan')]
    const t = buildYearTables(sheet, exps)
    expect(t[0].year).toBe(2025)
    expect(t[0].rows.map((r) => r.month)).toEqual([10, 11, 12])
    expect(t[0].paidTotal).toBe(89400)
    expect(t[0].paidCount).toBe(3)
    expect(t[0].rows[2].paid?.where).toBe('Banco Cuscatlan')
    expect(t[1].year).toBe(2026)
    expect(t[1].rows).toHaveLength(12)
    expect(t[1].rows[0].paid?.date).toBe('2026-01-13')
    expect(t[1].rows[1].paid).toBeNull()
    expect(t.reduce((a, y) => a + y.rows.length, 0)).toBe(181)
  })
  it('las cuotas previas a la app cuentan como pagadas sin fecha, y la descripción por defecto no se muestra', () => {
    const t = buildYearTables({ ...sheet, initialPaidCount: 2 }, [cuota('2025-12-17', 'Cuota del terreno')])
    expect(t[0].rows[0].paid).toEqual({ expenseId: null, date: null, amount: 29800, amountEur: null, where: '' })
    expect(t[0].rows[2].paid?.where).toBe('')
    expect(t[0].paidCount).toBe(3)
  })
})

describe('terreno: plusvalía (terreno y construcción por separado)', () => {
  const sheet: Property = {
    id: 'p1', name: 'Terreno', acquisitionDate: '2025-09-01', price: 5393800, downPayment: 0,
    interestRate: 0, termMonths: 181, monthlyPayment: 0, firstPaymentDate: '2025-10-20',
    initialPaidCount: 13, categoryByKind: {}, notes: '',
  }
  const gasto = (kind: 'construccion' | 'materiales' | 'otros', amount: number) => ({
    id: kind + amount, date: '2026-03-02', categoryId: null, amount, description: '', method: 'transferencia' as const,
    chargeDate: '2026-03-02', propertyId: 'p1', propertyKind: kind,
  })
  it('sin valores escritos se usa lo que costó: ganancia 0 y sin pedir datos de nuevo', () => {
    const r = summarizeProperty(sheet, [gasto('construccion', 714575)])
    expect(r.landCost).toBe(5393800)
    expect(r.buildCost).toBe(714575)
    expect(r.totalCost).toBe(6108375)
    expect(r.landValueSet).toBe(false)
    expect(r.buildValueSet).toBe(false)
    expect(r.landValue).toBe(5393800)
    expect(r.buildValue).toBe(714575)
    expect(r.landGain).toBe(0)
    expect(r.buildGain).toBe(0)
    expect(r.gain).toBe(0)
  })
  it('solo el terreno con valor propio: la obra se toma por lo que costó', () => {
    const r = summarizeProperty({ ...sheet, currentValue: 6000000 }, [gasto('construccion', 714575)])
    expect(r.landValueSet).toBe(true)
    expect(r.buildValueSet).toBe(false)
    expect(r.landGain).toBe(606200)
    expect(r.buildGain).toBe(0)
    expect(r.gain).toBe(606200)
  })
  it('lo construido se toma por lo que costó (materiales + construcción) y no se puede cambiar', () => {
    const r = summarizeProperty({ ...sheet, currentValue: 6000000, buildingValue: 900000 }, [gasto('materiales', 200000), gasto('construccion', 514575)])
    expect(r.buildCost).toBe(714575)
    expect(r.buildValue).toBe(714575)
    expect(r.buildValueSet).toBe(false)
    expect(r.buildGain).toBe(0)
  })
  it('la plusvalía total es la del terreno', () => {
    const r = summarizeProperty({ ...sheet, currentValue: 6000000 }, [gasto('construccion', 714575)])
    expect(r.landGain).toBe(606200)
    expect(r.gain).toBe(606200)
    expect(r.landGainPct).toBeCloseTo(606200 / 5393800, 6)
    expect(r.gainPct).toBeCloseTo(606200 / 6108375, 6)
  })
  it('«otros» cuenta como costo del terreno y no de la obra', () => {
    const r = summarizeProperty({ ...sheet, currentValue: 5500000 }, [gasto('otros', 100000)])
    expect(r.landCost).toBe(5493800)
    expect(r.buildCost).toBe(0)
    expect(r.gain).toBe(6200)
  })
})

describe('restaurar categorías', () => {
  let n = 0
  const id = () => `n${++n}`
  const fila = (i: string, name: string, parentId: string | null = null, amountText = '0,00') => ({
    i, id: i, name, group: 'necesidades' as 'necesidades' | 'gustos' | 'ahorro', icon: 'dots', amountText, parentId,
  })
  type Fila = ReturnType<typeof fila>
  it('desde cero crea las 10 categorías y todas sus subcategorías', () => {
    const r = restoreRows<Fila>([], id)
    const tops = r.rows.filter((x) => !x.parentId)
    expect(tops.map((x) => x.name)).toEqual(RESTORE_TREE.map((t) => t.name))
    expect(r.added).toBe(RESTORE_TREE.length + RESTORE_TREE.reduce((a, t) => a + t.children.length, 0))
    // cada hija cuelga de su padre y hereda su bloque
    const viajes = tops.find((x) => x.name === 'Viajes')!
    const hijas = r.rows.filter((x) => x.parentId === viajes.id)
    expect(hijas.map((x) => x.name)).toEqual(['Comida', 'Transporte', 'Hospedaje'])
    expect(hijas.every((x) => x.group === 'gustos')).toBe(true)
  })
  it('no duplica lo que ya existe, sin importar acentos ni mayúsculas', () => {
    const base = [fila('a', 'alimentacion'), fila('b', 'SUPERMERCADOS', 'a')]
    const r = restoreRows(base, id)
    expect(r.rows.filter((x) => normName(x.name) === 'alimentacion')).toHaveLength(1)
    expect(r.rows.filter((x) => normName(x.name) === 'supermercados')).toHaveLength(1)
  })
  it('si una categoría existente sin subcategorías recibe la primera, su monto pasa a ella', () => {
    const base = [fila('s', 'Salud', null, '50,00')]
    const r = restoreRows(base, id)
    const hijas = r.rows.filter((x) => x.parentId === 's')
    expect(hijas.map((x) => x.name)).toEqual(['Seguros', 'Medicamentos'])
    expect(hijas[0].amountText).toBe('50,00')
    expect(hijas[1].amountText).toBe('0,00')
    expect(r.rows.find((x) => x.id === 's')!.amountText).toBe('0,00')
    expect(r.carry.s).toBe(hijas[0].id)
  })
  it('si ya está todo, no añade nada', () => {
    const completo = restoreRows<Fila>([], id).rows
    expect(restoreRows(completo, id).added).toBe(0)
  })
})

describe('terreno: pagos repetidos', () => {
  const pago = (id: string, date: string, usd: number, eur: number, propertyId = 'p1', kind: 'cuota' | 'materiales' = 'cuota') => ({
    id, date, categoryId: null, amount: eur, amountUsd: usd, description: '', method: 'transferencia' as const,
    chargeDate: date, propertyId, propertyKind: kind,
  })
  it('detecta los gastos idénticos y deja uno de cada grupo', () => {
    const exps = [pago('a', '2025-10-15', 29800, 25913), pago('b', '2025-10-15', 29800, 25913), pago('c', '2025-11-15', 29800, 25913), pago('d', '2025-11-15', 29800, 25913)]
    const extra = findDuplicateExpenses(exps, 'p1')
    expect(extra.map((e) => e.id)).toEqual(['b', 'd'])
  })
  it('también los detecta si los euros difieren por haberse calculado con otro cambio', () => {
    const exps = [pago('a', '2025-10-15', 29800, 25690), pago('b', '2025-10-15', 29800, 25913)]
    expect(findDuplicateExpenses(exps, 'p1')).toHaveLength(1)
  })
  it('entre dos copias deja la que tiene los euros corregidos a mano', () => {
    // Cambio habitual 1,16: la estimación es 25.690; la 'a' es la estimada y la 'b' fue corregida a 255 €.
    const exps = [pago('a', '2025-10-15', 29800, 25690), pago('b', '2025-10-15', 29800, 25500)]
    expect(findDuplicateExpenses(exps, 'p1', 1.16).map((e) => e.id)).toEqual(['a'])
  })
  it('no toca pagos distintos: otra fecha, otros dólares, otra descripción, otro tipo u otro terreno', () => {
    const exps = [
      pago('a', '2025-10-15', 29800, 25913),
      pago('b', '2025-10-16', 29800, 25913),
      pago('c', '2025-10-15', 30000, 25913),
      { ...pago('f', '2025-10-15', 29800, 25913), description: 'Banco Cuscatlan' },
      pago('d', '2025-10-15', 29800, 25913, 'p1', 'materiales'),
      pago('e', '2025-10-15', 29800, 25913, 'otro'),
    ]
    expect(findDuplicateExpenses(exps, 'p1')).toEqual([])
  })
  it('sin repetidos devuelve una lista vacía', () => {
    expect(findDuplicateExpenses([], 'p1')).toEqual([])
  })
})

describe('terreno: dólares y euros (lo que salió de tu cuenta)', () => {
  const base: Property = {
    id: 'p1', name: 'Terreno', acquisitionDate: '2025-09-01', price: 5393800, downPayment: 0,
    interestRate: 0, termMonths: 181, monthlyPayment: 0, firstPaymentDate: '2025-10-20',
    initialPaidCount: 0, categoryByKind: {}, notes: '',
  }
  // Cada pago guarda los dólares (amountUsd) y los euros que realmente salieron (amount).
  const pago = (kind: 'cuota' | 'construccion', usd: number, eur: number | null, date = '2026-01-13') => ({
    id: `${kind}${usd}${date}`, date, categoryId: null, amount: eur ?? usd, amountUsd: eur === null ? null : usd,
    description: '', method: 'transferencia' as const, chargeDate: date, propertyId: 'p1', propertyKind: kind,
  })

  it('formatea dólares con el signo $', () => {
    expect(formatUsd(29800)).toBe('$298,00')
    expect(formatUsd(5393800)).toBe('$53.938,00')
    expect(formatUsd(-714575)).toBe('-$7145,75') // como el resto de la app: sin punto en miles de 4 cifras
  })
  it('toEur convierte con «dólares por 1 €» y devuelve null sin cambio', () => {
    expect(toEur(29800, 1.16)).toBe(25690)
    expect(toEur(29800, 0)).toBeNull()
  })
  it('suma los euros reales de cada pago aunque el cambio fuera distinto cada vez', () => {
    // 298 $ a 1,10 = 270,91 € ; 298 $ a 1,20 = 248,33 € (euros reales guardados)
    const exps = [pago('cuota', 29800, 27091, '2026-01-13'), pago('cuota', 29800, 24833, '2026-02-19'), pago('construccion', 100000, 85000)]
    const r = summarizeProperty(base, exps)
    expect(r.invested.cuota).toBe(59600)
    expect(r.investedEur.cuota).toBe(27091 + 24833)
    expect(r.invested.construccion).toBe(100000)
    expect(r.investedEur.construccion).toBe(85000)
    expect(r.totalInvested).toBe(159600)
    expect(r.totalInvestedEur).toBe(27091 + 24833 + 85000)
    expect(r.legacyCount).toBe(0)
  })
  it('total del año en dólares y en euros', () => {
    // Las cuotas registradas ocupan las primeras filas del plan (oct y nov de 2025).
    const exps = [pago('cuota', 29800, 27091, '2025-10-20'), pago('cuota', 29800, 24833, '2025-11-19')]
    const t = buildYearTables(base, exps)
    const y = t.find((x) => x.year === 2025)!
    expect(y.paidTotal).toBe(59600)
    expect(y.paidTotalEur).toBe(51924)
    expect(y.rows[0].paid?.amountEur).toBe(27091)
  })
  it('entrada y cuotas previas se estiman con el cambio habitual', () => {
    const r = summarizeProperty({ ...base, downPayment: 100000, initialPaidCount: 2, eurRate: 1.25 }, [])
    // La entrada baja lo financiado y con ello la cuota calculada.
    const cuota = computePayment(5393800 - 100000, 0, 181)
    expect(r.invested.cuota).toBe(100000 + cuota * 2)
    expect(r.investedEur.cuota).toBe(Math.round((100000 + cuota * 2) / 1.25))
  })
  it('sin tipo de cambio las estimaciones son null, pero los pagos con euros reales sí suman', () => {
    const exps = [pago('cuota', 29800, 27091)]
    expect(summarizeProperty(base, exps).investedEur.cuota).toBe(27091)
    expect(summarizeProperty({ ...base, initialPaidCount: 1 }, exps).investedEur.cuota).toBeNull()
    expect(summarizeProperty({ ...base, initialPaidCount: 1 }, exps).totalInvestedEur).toBeNull()
  })
  it('los pagos antiguos (sin monto en $) se leen como dólares y se estiman en euros', () => {
    const legacy = pago('cuota', 29800, null)
    expect(legacy.amountUsd).toBeNull()
    expect(usdOf(legacy)).toBe(29800)
    expect(eurOf(legacy, 1.16)).toBe(25690)
    expect(eurOf(legacy, 0)).toBeNull()
    const r = summarizeProperty({ ...base, eurRate: 1.16 }, [legacy])
    expect(r.legacyCount).toBe(1)
    expect(r.invested.cuota).toBe(29800)
    expect(r.investedEur.cuota).toBe(25690)
  })
  it('lo que falta pagar, estimado en euros con el cambio habitual', () => {
    const r = summarizeProperty({ ...base, eurRate: 1.16 }, [])
    expect(r.toPayEur).toBe(Math.round(5393800 / 1.16))
    expect(summarizeProperty(base, []).toPayEur).toBeNull()
  })
})

describe('yearSummary datos', () => {
  const cats = [{ id: 'a', name: 'A', group: 'necesidades', icon: 'x', sortOrder: 0 }] as unknown as Category[]
  const plan = (month: string, income: number) => ({ month, income, extraIncome: 0, savingsGoal: 0 }) as unknown as MonthPlan
  const run = (extra: Partial<Parameters<typeof yearSummary>[0]> = {}) =>
    yearSummary({ year: 2026, plans: [plan('2026-10', 0), plan('2026-12', 5000)], expenses: [], categories: cats, currentMonth: '2026-11', items: [{ month: '2026-12', categoryId: 'a', amount: 3000 }], ...extra })
  it('mes sin ingreso, presupuesto ni gastos no cuenta como dato', () => {
    expect(run().months[9].hasData).toBe(false)
  })
  it('mes futuro: gastado real 0, presupuestado visible y ahorro previsto con el presupuesto', () => {
    const d = run().months[11]
    expect(d.spent).toBe(0)
    expect(d.budgeted).toBe(3000)
    expect(d.projected).toBe(true)
    expect(d.net).toBe(2000)
  })
  it('si lo gastado supera lo presupuestado, el ahorro previsto usa lo gastado', () => {
    const e = [{ id: 'e', date: '2026-12-02', categoryId: 'a', amount: 3500, description: '', method: 'debito', chargeDate: '2026-12-02' }] as unknown as Expense[]
    const d = run({ expenses: e }).months[11]
    expect(d.spent).toBe(3500)
    expect(d.net).toBe(1500)
  })
  it('mes pasado: ahorro neto real', () => {
    const d = run({ currentMonth: '2027-01' }).months[11]
    expect(d.projected).toBe(false)
    expect(d.net).toBe(5000)
  })
})

describe('tarjeta de crédito cuenta al cobrarse', () => {
  const ex = (date: string, chargeDate: string, method: string) => ({ id: date + method, date, chargeDate, method, amount: 100, categoryId: 'a', description: '' }) as unknown as Expense
  it('desde noviembre 2026 la tarjeta cuenta en el mes de cobro', () => {
    expect(countDate(ex('2026-11-10', '2026-12-15', 'credito'))).toBe('2026-12-15')
  })
  it('octubre y antes siguen por fecha de compra', () => {
    expect(countDate(ex('2026-10-20', '2026-11-15', 'credito'))).toBe('2026-10-20')
  })
  it('débito siempre cuenta el día de la compra', () => {
    expect(countDate(ex('2026-11-10', '2026-11-10', 'debito'))).toBe('2026-11-10')
  })
  it('expensesByPurchaseMonth usa la fecha que cuenta', () => {
    const list = [ex('2026-11-10', '2026-12-15', 'credito'), ex('2026-11-11', '2026-11-11', 'debito')]
    expect(expensesByPurchaseMonth(list, '2026-11').length).toBe(1)
    expect(expensesByPurchaseMonth(list, '2026-12').length).toBe(1)
  })
})

describe('bloques con Deuda', () => {
  const g = (id: string, group: string) => ({ id, name: id, group, icon: 'x', sortOrder: 0 }) as unknown as Category
  it('groupProgress devuelve cuatro bloques con objetivo en dinero', () => {
    const r = groupProgress([], 300000)
    expect(r.map((x) => x.group)).toEqual(['necesidades', 'deuda', 'gustos', 'ahorro'])
    expect(r[2].target).toBe(60000)
    expect(r[1].target).toBe(30000)
  })
  it('topLevel ordena por bloque: Necesidades, Deuda, Gustos, Ahorro', () => {
    const cats = [g('a', 'ahorro'), g('o', 'gustos'), g('d', 'deuda'), g('n', 'necesidades')]
    expect(topLevel(cats).map((c) => c.id)).toEqual(['n', 'd', 'o', 'a'])
  })
  it('suggest5030 reparte todo el ingreso incluyendo Deuda', () => {
    const cats = [g('n', 'necesidades'), g('o', 'gustos'), g('a', 'ahorro'), g('d', 'deuda')]
    const m = suggest5030(100000, cats)
    expect([...m.values()].reduce((a, b) => a + b, 0)).toBe(100000)
    expect(m.get('d')).toBe(10000)
  })
})

describe('rentabilidad de ETF (PAC)', () => {
  const hist: [string, number][] = [['2026-10-01', 10], ['2026-10-02', 11], ['2026-10-05', 12], ['2026-11-02', 20]]
  it('compra al primer cierre desde la fecha de la aportación', () => {
    expect(priceOnOrAfter(hist, '2026-10-03')).toEqual(['2026-10-05', 12])
    expect(priceOnOrAfter(hist, '2026-10-01')).toEqual(['2026-10-01', 10])
  })
  it('una aportación posterior al último cierre usa el último precio', () => {
    expect(priceOnOrAfter(hist, '2026-12-01')).toEqual(['2026-11-02', 20])
  })
  it('calcula participaciones, valor y ganancia', () => {
    const s = summarizeEtf(
      [{ id: 'a', date: '2026-10-01', amount: 20000 }, { id: 'b', date: '2026-10-03', amount: 24000 }],
      hist,
      20,
    )
    // 200 €/10 = 20 part.; 240 €/12 = 20 part.; 40 part. × 20 € = 800 €
    expect(s.units).toBeCloseTo(40)
    expect(s.invested).toBe(44000)
    expect(s.value).toBe(80000)
    expect(s.gain).toBe(36000)
    expect(s.gainPct).toBeCloseTo(81.818, 2)
  })
  it('sin aportaciones no divide por cero', () => {
    const s = summarizeEtf([], hist, 20)
    expect(s.invested).toBe(0)
    expect(s.gainPct).toBeNull()
  })
})

describe('ETF ajustado con el broker', () => {
  const hist: [string, number][] = [['2026-10-30', 13], ['2026-11-09', 12.9], ['2026-11-10', 13]]
  const base = { asOf: '2026-11-09', shares: 16.5, invested: 22225 }
  it('parte de la posición del broker e ignora lo anterior a su fecha', () => {
    const s = summarizeEtf([{ id: 'a', date: '2026-10-30', amount: 2225 }, { id: 'b', date: '2026-11-01', amount: 20000 }], hist, 13, base)
    expect(s.rows.length).toBe(1)
    expect(s.invested).toBe(22225)
    expect(s.units).toBeCloseTo(16.5)
    expect(s.value).toBe(21450)
    expect(s.gain).toBe(-775)
  })
  it('suma las aportaciones posteriores, estimadas con su precio', () => {
    const s = summarizeEtf([{ id: 'c', date: '2026-11-10', amount: 20000 }], hist, 13, base)
    expect(s.rows.length).toBe(2)
    expect(s.invested).toBe(42225)
    expect(s.units).toBeCloseTo(16.5 + 200 / 13)
  })
  it('sin ajuste se comporta como antes', () => {
    expect(summarizeEtf([{ id: 'a', date: '2026-10-30', amount: 13000 }], hist, 13).units).toBeCloseTo(10)
  })
})
