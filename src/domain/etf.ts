import type { Cents, DateKey } from './types'

/** Un cierre diario del ETF: [fecha, precio]. */
export type PricePoint = [DateKey, number]

export interface Contribution {
  id: string
  date: DateKey
  amount: Cents
}

export interface EtfRow {
  id: string
  /** Día de la aportación (el del gasto registrado). */
  date: DateKey
  amount: Cents
  /** Día de cotización cuyo cierre se usa: el primero con precio desde la fecha de la aportación. */
  priceDate: DateKey
  price: number
  units: number
  /** Valor de esas participaciones al precio de hoy. */
  value: Cents
  gain: Cents
  gainPct: number | null
  /** True en la fila de la posición real de tu broker (precio = precio medio de compra). */
  isBase?: boolean
}

export interface EtfSummary {
  rows: EtfRow[]
  invested: Cents
  units: number
  value: Cents
  gain: Cents
  gainPct: number | null
}

/** Primer cierre con fecha ≥ `date`; si no hay (aportación posterior al último cierre), el último conocido. */
export function priceOnOrAfter(history: PricePoint[], date: DateKey): PricePoint | null {
  if (history.length === 0) return null
  const sorted = [...history].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  return sorted.find((p) => p[0] >= date) ?? sorted[sorted.length - 1]
}

/**
 * Rentabilidad de aportaciones periódicas (PAC): cada aportación compra importe ÷ precio participaciones
 * y todas se valoran al precio actual. Es una estimación con cierres diarios: no incluye comisiones ni impuestos.
 */
export function summarizeEtf(
  contributions: Contribution[],
  history: PricePoint[],
  currentPrice: number,
  base?: { asOf: DateKey; shares: number; invested: Cents } | null,
): EtfSummary {
  const rows: EtfRow[] = []
  if (base && base.shares > 0) {
    const value = Math.round(base.shares * currentPrice * 100)
    rows.push({
      id: 'base',
      date: base.asOf,
      amount: base.invested,
      priceDate: base.asOf,
      price: base.invested / 100 / base.shares,
      units: base.shares,
      value,
      gain: value - base.invested,
      gainPct: base.invested > 0 ? ((value - base.invested) / base.invested) * 100 : null,
      isBase: true,
    })
  }
  // Con posición del broker, lo anterior o igual a su fecha ya está incluido.
  const counted = base && base.shares > 0 ? contributions.filter((c) => c.date > base.asOf) : contributions
  for (const c of [...counted].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    const p = priceOnOrAfter(history, c.date)
    if (!p || p[1] <= 0) continue
    const units = c.amount / 100 / p[1]
    const value = Math.round(units * currentPrice * 100)
    rows.push({
      id: c.id,
      date: c.date,
      amount: c.amount,
      priceDate: p[0],
      price: p[1],
      units,
      value,
      gain: value - c.amount,
      gainPct: c.amount > 0 ? ((value - c.amount) / c.amount) * 100 : null,
    })
  }
  const invested = rows.reduce((a, r) => a + r.amount, 0)
  const value = rows.reduce((a, r) => a + r.value, 0)
  return {
    rows,
    invested,
    units: rows.reduce((a, r) => a + r.units, 0),
    value,
    gain: value - invested,
    gainPct: invested > 0 ? ((value - invested) / invested) * 100 : null,
  }
}
