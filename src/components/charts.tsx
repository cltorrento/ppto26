import { formatMoney } from '@/domain/money'
import type { Cents } from '@/domain/types'

/** Barras horizontales ordenadas: las etiquetas largas caben en móvil y se leen bien en escritorio. */
export function HBarChart({ items, ariaLabel }: { items: { label: string; value: Cents }[]; ariaLabel: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-3" aria-label={ariaLabel}>
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{i.label}</span>
            <span className="num shrink-0 text-slate-600">{formatMoney(i.value)}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Ingresos y gastos por mes, en columnas pareadas. Los meses sin datos quedan vacíos. */
export function IncomeExpenseChart({ rows }: { rows: { label: string; income: Cents; spent: Cents; hasData: boolean }[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.spent]))
  const height = 140
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-slate-600" aria-hidden>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Ingresos</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> Gastos</span>
      </div>
      <div role="img" aria-label="Ingresos y gastos por mes. Los mismos datos están en la tabla resumen." className="grid grid-cols-12 gap-1 sm:gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col items-center">
            <div className="flex items-end gap-0.5" style={{ height }}>
              <div className="w-2 rounded-t bg-emerald-500 sm:w-3" style={{ height: r.hasData ? Math.max(2, (r.income / max) * height) : 0 }} title={`${r.label}: ingresos ${formatMoney(r.income)}`} />
              <div className="w-2 rounded-t bg-brand-500 sm:w-3" style={{ height: r.hasData ? Math.max(2, (r.spent / max) * height) : 0 }} title={`${r.label}: gastos ${formatMoney(r.spent)}`} />
            </div>
            <span className={`mt-1.5 text-[10px] sm:text-xs ${r.hasData ? 'font-medium text-slate-700' : 'text-slate-400'}`}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
