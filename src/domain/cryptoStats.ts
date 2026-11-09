import type { DateKey } from './types'

/** Cierres diarios: [fecha, precio]. */
export type Closes = [DateKey, number][]

const addDays = (date: DateKey, days: number): DateKey => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Cierres de los últimos `days` días (incluida hoy), más el precio actual como último punto. */
export function windowCloses(history: Closes, today: DateKey, days: number, current: number): number[] {
  const from = addDays(today, -days)
  const vals = history.filter(([d]) => d >= from && d < today).map(([, p]) => p)
  return [...vals, current]
}

/** Variación (%) entre el cierre de hace `days` días y el precio actual. */
export function changePct(history: Closes, today: DateKey, days: number, current: number): number | null {
  const target = addDays(today, -days)
  const past = [...history].filter(([d]) => d <= target).pop() ?? history[0]
  if (!past || past[1] <= 0) return null
  return ((current - past[1]) / past[1]) * 100
}

export interface RangeStats {
  min: number
  max: number
  avg: number
  /** Dónde está el precio actual dentro del rango: 0 = mínimo, 1 = máximo. */
  position: number
}

export function rangeStats(history: Closes, today: DateKey, days: number, current: number): RangeStats | null {
  const v = windowCloses(history, today, days, current)
  if (v.length < 2) return null
  const min = Math.min(...v)
  const max = Math.max(...v)
  return { min, max, avg: v.reduce((a, b) => a + b, 0) / v.length, position: max > min ? (current - min) / (max - min) : 0.5 }
}

/** Desviación típica de los cambios diarios (%) en los últimos `days` días. */
export function volatilityPct(history: Closes, today: DateKey, days: number, current: number): number | null {
  const v = windowCloses(history, today, days, current)
  if (v.length < 4) return null
  const r = v.slice(1).map((p, i) => ((p - v[i]) / v[i]) * 100)
  const mean = r.reduce((a, b) => a + b, 0) / r.length
  return Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / r.length)
}

export type Trend = 'subiendo' | 'bajando' | 'lateral'

/** Tendencia descriptiva: sube si en 7 días ganó más de un 1 % y el precio está sobre su media de 30 días; baja en el caso contrario. */
export function trendOf(change7d: number | null, price: number, avg30: number | null): Trend {
  if (change7d === null || avg30 === null) return 'lateral'
  if (change7d > 1 && price >= avg30) return 'subiendo'
  if (change7d < -1 && price < avg30) return 'bajando'
  return 'lateral'
}

export type VolatilityLevel = 'baja' | 'media' | 'alta'
export const volatilityLevel = (v: number): VolatilityLevel => (v < 2 ? 'baja' : v < 4 ? 'media' : 'alta')

export type RangeZone = 'baja' | 'media' | 'alta'
export const rangeZone = (position: number): RangeZone => (position < 1 / 3 ? 'baja' : position < 2 / 3 ? 'media' : 'alta')
