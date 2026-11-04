import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { addMonths, monthOf, todayKey } from '@/domain/calc'
import type { MonthKey } from '@/domain/types'

interface MonthState {
  month: MonthKey
  setMonth(m: MonthKey): void
  next(): void
  prev(): void
}

const Ctx = createContext<MonthState | null>(null)

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<MonthKey>(() => monthOf(todayKey()))
  const value = useMemo<MonthState>(
    () => ({
      month,
      setMonth,
      next: () => setMonth((m) => addMonths(m, 1)),
      prev: () => setMonth((m) => addMonths(m, -1)),
    }),
    [month],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMonth(): MonthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useMonth debe usarse dentro de MonthProvider')
  return v
}

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function monthName(month: MonthKey): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1]
}

export function monthLabel(month: MonthKey): string {
  return `${monthName(month)} ${month.slice(0, 4)}`
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatDateEs(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d} ${monthName(`${y}-${m}`).slice(0, 3)} ${y}`
}
