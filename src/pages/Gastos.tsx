import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Filter, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, Empty, ErrorBox, PageHeader, Spinner, Stat } from '@/components/ui'
import { CategoryIcon } from '@/components/CategoryIcon'
import { CategoryOptions } from '@/components/CategoryOptions'
import { ExpenseModal } from '@/components/ExpenseModal'
import { capitalize, formatDateEs, monthLabel, useMonth } from '@/components/MonthContext'
import { useDeleteExpense } from '@/data/hooks'
import { useMonthData } from '@/data/useMonthData'
import { formatMoney } from '@/domain/money'
import { categoryLabel, rootIdOf, sum, topLevel } from '@/domain/calc'
import { METHOD_LABELS } from '@/domain/types'

export default function Gastos() {
  const { month } = useMonth()
  const { data, isLoading, error, refetch } = useMonthData(month, 'compra')
  const del = useDeleteExpense()
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(false)

  if (isLoading) return <Spinner />
  if (error || !data) return <ErrorBox error={error} onRetry={refetch} />

  const { purchases, categories, summary, settings } = data
  const catById = new Map(categories.map((c) => [c.id, c]))
  // Filtrar por una categoría con subcategorías incluye también las de sus subcategorías.
  const matches = (id: string | null) => (filter === '__none' ? !id : !!id && (id === filter || (rootIdOf(categories, id) === filter)))
  const rows = filter ? purchases.filter((e) => matches(e.categoryId)) : purchases

  async function remove(id: string, label: string) {
    if (!window.confirm(`¿Eliminar el gasto «${label}»?`)) return
    try {
      await del.mutateAsync(id)
      toast.success('Gasto eliminado')
    } catch (e) {
      toast.error(`No pudimos eliminar el gasto. ${e instanceof Error ? e.message : ''}`)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Gastos"
        title={`Movimientos de ${monthLabel(month)}`}
        subtitle="Todo lo que registres se descuenta de tu disponible y de la categoría correspondiente."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Registrar gasto
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Gastado este mes" value={formatMoney(summary.spent)} />
        <Stat highlight label="Te queda disponible" value={formatMoney(summary.remaining)} hint={summary.reserved ? 'Ya descontadas las reservas del plan anual' : undefined} />
        <Stat label="Movimientos" value={purchases.length} hint={`${topLevel(categories).length} categorías activas`} />
      </div>

      {purchases.length === 0 ? (
        <Empty title={`Aún no hay gastos en ${capitalize(monthLabel(month))}`}>
          <Button onClick={() => setOpen(true)}>Registrar el primero</Button>
        </Empty>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
            <h2 className="font-semibold">Listado del mes</h2>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" aria-hidden />
              <select aria-label="Filtrar por categoría" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="">Todas las categorías</option>
                <CategoryOptions categories={categories} />
                <option value="__none">Sin categoría</option>
              </select>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No hay gastos en esa categoría. Prueba con otra o cambia el filtro.</p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Descripción</th>
                    <th className="px-4 py-3 font-medium">Categoría</th>
                    <th className="px-4 py-3 font-medium">Método y cobro</th>
                    <th className="px-4 py-3 text-right font-medium">Monto</th>
                    <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((e) => {
                    const cat = e.categoryId ? catById.get(e.categoryId) : undefined
                    const sameDay = e.chargeDate === e.date
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/60">
                        <td className="num whitespace-nowrap px-4 py-3 text-slate-500">{formatDateEs(e.date)}</td>
                        <td className="px-4 py-3 font-medium">{e.description || <span className="font-normal text-slate-400">Sin descripción</span>}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            {cat && <CategoryIcon icon={(categories.find((c) => c.id === rootIdOf(categories, cat.id)) ?? cat).icon} group={(categories.find((c) => c.id === rootIdOf(categories, cat.id)) ?? cat).group} />}
                            {categoryLabel(categories, e.categoryId)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {METHOD_LABELS[e.method]}
                          <span className="block text-xs text-slate-500">{sameDay ? 'Cobrado el mismo día' : `Se cobra el ${formatDateEs(e.chargeDate)}`}</span>
                        </td>
                        <td className="num px-4 py-3 text-right font-semibold">{formatMoney(e.amount)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => remove(e.id, e.description || formatMoney(e.amount))} aria-label={`Eliminar gasto ${e.description}`} className="rounded-full p-3 text-slate-400 hover:bg-red-50 hover:text-red-600 md:p-2">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 text-sm font-semibold">
                    <td className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500" colSpan={4}>
                      {filter ? 'Total filtrado' : 'Total del mes'}
                    </td>
                    <td className="num px-4 py-3 text-right">{formatMoney(sum(rows.map((e) => e.amount)))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}
      <p className="mt-4 text-sm text-slate-500">
        ¿Buscas algo más? Revisa tu{' '}
        <Link to="/presupuesto" className="font-medium text-brand-600 hover:underline">
          presupuesto por categoría
        </Link>
        . Las compras con tarjeta de crédito se cobran el día {settings.cardPayDay} del mes siguiente.
      </p>
      {open && <ExpenseModal onClose={() => setOpen(false)} />}
    </>
  )
}
