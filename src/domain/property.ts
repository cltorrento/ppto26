import { addMonths, daysInMonth, monthOf, sum } from './calc'
import type { Cents, DateKey, Expense, Property, PropertyKind } from './types'

/** Monto financiado: precio menos entrada. */
export function financedAmount(p: Pick<Property, 'price' | 'downPayment'>): Cents {
  return Math.max(0, p.price - p.downPayment)
}

/** Cuota mensual constante (sistema francés). Con interés 0, el monto dividido en partes iguales. */
export function computePayment(financed: Cents, annualRatePct: number, months: number): Cents {
  if (financed <= 0 || months <= 0) return 0
  const r = annualRatePct / 100 / 12
  if (r <= 0) return Math.round(financed / months)
  return Math.round((financed * r) / (1 - Math.pow(1 + r, -months)))
}

/** Fecha de la cuota número `index` (1 = primera): mismo día cada mes, ajustado al último día si el mes es más corto. */
export function dueDate(firstPaymentDate: DateKey, index: number): DateKey {
  const day = Number(firstPaymentDate.slice(8, 10))
  const month = addMonths(monthOf(firstPaymentDate), index - 1)
  return `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`
}

export interface ScheduleRow {
  n: number
  dueDate: DateKey
  payment: Cents
  interest: Cents
  capital: Cents
  /** Saldo pendiente después de pagar esta cuota. */
  balance: Cents
}

/** Plan de cuotas completo. La última cuota se ajusta para dejar el saldo en cero. */
export function buildSchedule(p: Property): ScheduleRow[] {
  const n = Math.max(0, Math.floor(p.termMonths))
  const financed = financedAmount(p)
  if (n === 0 || financed === 0) return []
  const r = p.interestRate / 100 / 12
  const pay = p.monthlyPayment > 0 ? p.monthlyPayment : computePayment(financed, p.interestRate, n)
  let balance = financed
  const rows: ScheduleRow[] = []
  for (let i = 1; i <= n; i++) {
    const interest = Math.round(balance * r)
    const capital = i === n ? balance : Math.min(balance, Math.max(0, pay - interest))
    balance -= capital
    rows.push({ n: i, dueDate: dueDate(p.firstPaymentDate, i), payment: capital + interest, interest, capital, balance })
  }
  return rows
}

/** Dólares de un gasto del terreno. Los registrados antes de usar dólares guardaban el importe en `amount`. */
export function usdOf(e: Expense): Cents {
  return e.amountUsd ?? e.amount
}

/** Dólares → euros con un cambio de «dólares por 1 €». Null si no hay cambio. */
export function toEur(usd: Cents, rate: number): Cents | null {
  return rate > 0 ? Math.round(usd / rate) : null
}

/** Euros que salieron por un gasto: los reales si se guardaron, o una estimación con el cambio habitual. */
export function eurOf(e: Expense, rate: number): Cents | null {
  return e.amountUsd != null ? e.amount : toEur(e.amount, rate)
}

const sumOrNull = (vals: (Cents | null)[]): Cents | null => (vals.some((v) => v === null) ? null : sum(vals as Cents[]))

export interface PropertySummary {
  /** Cuotas pagadas: las de antes de usar la app más las registradas en la ficha. */
  paidCount: number
  remaining: number
  total: number
  progress: number
  nextDue: DateKey | null
  /** Fecha de la última cuota del plan. */
  endDate: DateKey | null
  /** Capital que aún debes. */
  balance: Cents
  capitalPaid: Cents
  interestPaid: Cents
  /** Invertido por tipo. «cuota» incluye la entrada y las cuotas anteriores a la app (estimadas con el plan). */
  invested: Record<PropertyKind, Cents>
  /** Lo mismo en euros: lo que salió de tu cuenta (y una estimación para entrada y cuotas previas). Null si falta el cambio. */
  investedEur: Record<PropertyKind, Cents | null>
  totalInvested: Cents
  totalInvestedEur: Cents | null
  /** Pagos registrados antes de guardar el monto en dólares. */
  legacyCount: number
  /** Estimación en euros de lo que falta pagar, con el cambio habitual. */
  toPayEur: Cents | null
  totalAmountEur: Cents | null
  /** Monto total del terreno: entrada más todas las cuotas del plan. */
  totalAmount: Cents
  /** Costo del terreno: monto (entrada y cuotas) más otros gastos de la compra (escrituras, impuestos…). */
  landCost: Cents
  /** Costo de lo construido: materiales y construcción. */
  buildCost: Cents
  /** Costo total: terreno más lo construido. */
  totalCost: Cents
  /** Valor del terreno que se usa: el que escribiste o, si lo dejaste vacío, lo que costó. */
  landValue: Cents
  /** Valor de lo construido que se usa: el que escribiste o, si lo dejaste vacío, lo que costó. */
  buildValue: Cents
  /** True si escribiste un valor propio (si no, se usa el costo y la ganancia sale 0). */
  landValueSet: boolean
  buildValueSet: boolean
  /** Plusvalía del terreno = valor del terreno − su costo. */
  landGain: Cents
  landGainPct: number | null
  /** Resultado de lo construido = valor de lo construido − su costo. */
  buildGain: Cents
  buildGainPct: number | null
  /** Total = plusvalía del terreno + resultado de lo construido. */
  gain: Cents
  gainPct: number | null
  /** Lo que falta pagar: la suma de las cuotas aún pendientes. */
  toPay: Cents
  schedule: ScheduleRow[]
}

export function summarizeProperty(p: Property, expenses: Expense[]): PropertySummary {
  const schedule = buildSchedule(p)
  const total = schedule.length
  const mine = expenses.filter((e) => e.propertyId === p.id)
  const registered = mine.filter((e) => e.propertyKind === 'cuota')
  const initial = Math.min(Math.max(0, Math.floor(p.initialPaidCount)), total)
  const paidCount = Math.min(total, initial + registered.length)
  const paidRows = schedule.slice(0, paidCount)

  const rate = p.eurRate ?? 0
  const ofKind = (k: PropertyKind) => mine.filter((e) => e.propertyKind === k)
  const kindTotal = (k: PropertyKind) => sum(ofKind(k).map(usdOf))
  const kindEur = (k: PropertyKind) => sumOrNull(ofKind(k).map((e) => eurOf(e, rate)))
  const initialUsd = p.downPayment + sum(schedule.slice(0, initial).map((r) => r.payment))
  const invested: Record<PropertyKind, Cents> = {
    // Entrada + cuotas previas (según el plan) + cuotas registradas (lo realmente pagado).
    cuota: initialUsd + kindTotal('cuota'),
    materiales: kindTotal('materiales'),
    construccion: kindTotal('construccion'),
    otros: kindTotal('otros'),
  }
  const investedEur: Record<PropertyKind, Cents | null> = {
    // La entrada y las cuotas previas a la app se estiman con el cambio habitual.
    cuota: sumOrNull([initialUsd > 0 ? toEur(initialUsd, rate) : 0, kindEur('cuota')]),
    materiales: kindEur('materiales'),
    construccion: kindEur('construccion'),
    otros: kindEur('otros'),
  }
  const totalAmount = p.downPayment + sum(schedule.map((r) => r.payment))
  const landCost = totalAmount + invested.otros
  const buildCost = invested.materiales + invested.construccion
  const totalCost = landCost + buildCost
  // Sin valor escrito se usa lo que costó: no hay que volver a teclear lo que ya está ingresado.
  const landValueSet = (p.currentValue ?? 0) > 0
  // Lo construido se valora por lo que costó (materiales + construcción): no se escribe aparte.
  const buildValueSet = false
  const landValue = landValueSet ? p.currentValue! : landCost
  const buildValue = buildCost
  const landGain = landValue - landCost
  const buildGain = buildValue - buildCost
  const gain = landGain + buildGain
  return {
    paidCount,
    remaining: Math.max(0, total - paidCount),
    total,
    progress: total > 0 ? paidCount / total : 0,
    nextDue: paidCount < total ? schedule[paidCount].dueDate : null,
    endDate: total > 0 ? schedule[total - 1].dueDate : null,
    balance: paidCount === 0 ? financedAmount(p) : schedule[paidCount - 1]?.balance ?? 0,
    capitalPaid: sum(paidRows.map((r) => r.capital)),
    interestPaid: sum(paidRows.map((r) => r.interest)),
    invested,
    investedEur,
    totalInvested: sum(Object.values(invested)),
    totalInvestedEur: sumOrNull(Object.values(investedEur)),
    legacyCount: mine.filter((e) => e.amountUsd == null).length,
    toPayEur: toEur(sum(schedule.slice(paidCount).map((r) => r.payment)), rate),
    totalAmountEur: toEur(totalAmount, rate),
    totalAmount,
    landCost,
    buildCost,
    totalCost,
    landValue,
    buildValue,
    landValueSet,
    buildValueSet,
    landGain,
    landGainPct: landCost > 0 ? landGain / landCost : null,
    buildGain,
    buildGainPct: buildCost > 0 ? buildGain / buildCost : null,
    gain,
    gainPct: totalCost > 0 ? gain / totalCost : null,
    toPay: sum(schedule.slice(paidCount).map((r) => r.payment)),
    schedule,
  }
}

/** Categoría donde registrar un gasto del terreno: la de su tipo, o la de las cuotas, o ninguna. */
export function categoryForKind(p: Property, kind: PropertyKind): string | null {
  return p.categoryByKind[kind] ?? p.categoryByKind.cuota ?? null
}

/**
 * Gastos del terreno que parecen repetidos: mismo tipo, fecha, dólares y descripción (los euros pueden diferir si se
 * calcularon con otro cambio). Devuelve los que sobran, dejando uno de cada grupo: el que tenga euros corregidos a mano
 * (distintos de la estimación con el cambio habitual) y, si no, el primero.
 * Pasa, por ejemplo, si las cuotas anteriores a la app se convirtieron en pagos dos veces. Ojo: dos pagos reales del mismo
 * día y monto también encajan, por eso el aviso se puede descartar.
 */
export function findDuplicateExpenses(expenses: Expense[], propertyId: string, rate = 0): Expense[] {
  const groups = new Map<string, Expense[]>()
  const mine = expenses.filter((e) => e.propertyId === propertyId).sort((a, b) => (a.id < b.id ? -1 : 1))
  for (const e of mine) {
    const key = [e.propertyKind, e.date, usdOf(e), e.description].join('|')
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  const extra: Expense[] = []
  for (const list of groups.values()) {
    if (list.length < 2) continue
    const edited = list.find((e) => e.amountUsd != null && rate > 0 && e.amount !== toEur(usdOf(e), rate))
    const keep = edited ?? list[0]
    extra.push(...list.filter((e) => e !== keep))
  }
  return extra
}

/** Cuota mensual que se usa: la escrita a mano o, si está vacía, la calculada. */
export function effectivePayment(p: Property): Cents {
  return p.monthlyPayment > 0 ? p.monthlyPayment : computePayment(financedAmount(p), p.interestRate, p.termMonths)
}

// ---------- Tablas por año (como una hoja de cálculo) ----------

export interface PaidInfo {
  /** Id del gasto registrado; null en las cuotas que dijiste haber pagado antes de usar la app. */
  expenseId: string | null
  date: DateKey | null
  /** Dólares pagados. */
  amount: Cents
  /** Euros que salieron por esta cuota (real o estimado). Null si no hay cambio. */
  amountEur: Cents | null
  /** «Pagado en»: banco, recibo… (la descripción del gasto). */
  where: string
}

export interface YearRow {
  n: number
  dueDate: DateKey
  /** Mes calendario (1-12) de la cuota. */
  month: number
  scheduled: Cents
  paid: PaidInfo | null
}

export interface YearTable {
  year: number
  rows: YearRow[]
  paidTotal: Cents
  /** Total pagado del año en euros. Null si alguna cuota no tiene conversión. */
  paidTotalEur: Cents | null
  paidCount: number
}

/**
 * Reparte las cuotas del plan por año. Las primeras `initialPaidCount` cuotas se dan por pagadas y
 * las cuotas registradas (por fecha de pago) ocupan las siguientes filas del plan.
 */
export function buildYearTables(p: Property, expenses: Expense[], kindLabel = 'Cuota del terreno'): YearTable[] {
  const schedule = buildSchedule(p)
  const initial = Math.min(Math.max(0, Math.floor(p.initialPaidCount)), schedule.length)
  const registered = expenses
    .filter((e) => e.propertyId === p.id && e.propertyKind === 'cuota')
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1))
  const tables = new Map<number, YearTable>()
  schedule.forEach((r, i) => {
    let paid: PaidInfo | null = null
    const rate = p.eurRate ?? 0
    if (i < initial) paid = { expenseId: null, date: null, amount: r.payment, amountEur: toEur(r.payment, rate), where: '' }
    else if (registered[i - initial]) {
      const e = registered[i - initial]
      paid = { expenseId: e.id, date: e.date, amount: usdOf(e), amountEur: eurOf(e, rate), where: e.description === kindLabel ? '' : e.description }
    }
    const year = Number(r.dueDate.slice(0, 4))
    const t = tables.get(year) ?? { year, rows: [], paidTotal: 0, paidTotalEur: 0 as Cents | null, paidCount: 0 }
    t.rows.push({ n: r.n, dueDate: r.dueDate, month: Number(r.dueDate.slice(5, 7)), scheduled: r.payment, paid })
    if (paid) {
      t.paidTotal += paid.amount
      t.paidTotalEur = t.paidTotalEur === null || paid.amountEur === null ? null : t.paidTotalEur + paid.amountEur
      t.paidCount += 1
    }
    tables.set(year, t)
  })
  return [...tables.values()].sort((a, b) => a.year - b.year)
}
