import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatMoney } from '@/domain/money'
import type { Cents } from '@/domain/types'

/** Barras horizontales ordenadas: las etiquetas largas caben en móvil y se leen bien en escritorio. */
export interface BarItem {
  label: string
  value: Cents
  /** Clase de color de la barra (por defecto, el color de marca). */
  barClass?: string
  /** Desglose (subcategorías), se dibuja debajo con barras más pequeñas. */
  children?: BarItem[]
}

export function HBarChart({ items, ariaLabel }: { items: BarItem[]; ariaLabel: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  // Acordeón: las subcategorías están plegadas por defecto para que la lista no crezca.
  const [opened, setOpened] = useState<Set<string>>(new Set())
  const expandable = items.filter((i) => i.children && i.children.length > 0).map((i) => i.label)
  const toggle = (label: string) => setOpened((o) => { const n = new Set(o); n.has(label) ? n.delete(label) : n.add(label); return n })
  return (
    <>
    {expandable.length > 0 && (
      <div className="mb-3 flex justify-end">
        <button type="button" className="py-1 text-xs font-medium text-brand-600 hover:underline" onClick={() => setOpened(opened.size ? new Set() : new Set(expandable))}>
          {opened.size ? 'Plegar todo' : 'Desplegar todo'}
        </button>
      </div>
    )}
    <ul className="space-y-3" aria-label={ariaLabel}>
      {items.map((i) => {
        const hasKids = !!i.children && i.children.length > 0
        const open = opened.has(i.label)
        return (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            {hasKids ? (
              <button type="button" onClick={() => toggle(i.label)} aria-expanded={open} aria-label={`${open ? 'Ocultar' : 'Mostrar'} el desglose de ${i.label}`} className="flex min-w-0 items-center gap-1.5 font-medium">
                <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? '' : '-rotate-90'}`} aria-hidden />
                <span className="truncate">{i.label}</span>
              </button>
            ) : (
              <span className="truncate font-medium">{i.label}</span>
            )}
            <span className="num shrink-0 text-slate-600">{formatMoney(i.value)}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div className={`h-full rounded-full ${i.barClass ?? 'bg-brand-500'}`} style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          {hasKids && open && (
            <ul className="ml-4 mt-2 space-y-1.5 border-l border-slate-100 pl-3">
              {(i.children ?? []).map((k) => (
                <li key={k.label}>
                  <div className="flex items-baseline justify-between gap-3 text-xs text-slate-600">
                    <span className="truncate">{k.label}</span>
                    <span className="num shrink-0">{formatMoney(k.value)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <div className={`h-full rounded-full opacity-60 ${k.barClass ?? i.barClass ?? 'bg-brand-500'}`} style={{ width: `${(k.value / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </li>
        )
      })}
    </ul>
    </>
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
