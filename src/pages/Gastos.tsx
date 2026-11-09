import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Filter, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { METHOD_LABELS, type Expense } from '@/domain/types'

export default function Gastos() {
  const { month } = useMonth()
  const { data, isLoading, error, refetch } = useMonthData(month, 'compra')
  const del = useDeleteExpense()
  const [editing, setEditing] = useState<Expense | null>(null)
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(false)
  /** Agrupar por categoría padre (por defecto) o lista cronológica. */
  const [grouped, setGrouped] = useState(true)
  /** Grupos desplegados. Por defecto todos están recogidos. */
  const [opened, setOpened] = useState<Set<string>>(new Set())

  if (isLoading) return <Spinner />
  if (error || !data) return <ErrorBox error={error} onRetry={refetch} />

  const { purchases, categories, summary, settings } = data
  const catById = new Map(categories.map((c) => [c.id, c]))
  // Filtrar por una categoría con subcategorías incluye también las de sus subcategorías.
  const matches = (id: string | null) => (filter === '__none' ? !id : !!id && (id === filter || (rootIdOf(categories, id) === filter)))
  const rows = filter ? purchases.filter((e) => matches(e.categoryId)) : purchases

  // Grupos por categoría de primer nivel (en el orden de Presupuesto); los gastos sin categoría o de una categoría borrada, al final.
  const groupKey = (id: string | null) => (id && catById.has(id) ? rootIdOf(categories, id) : '__none')
  const byGroup = new Map<string, Expense[]>()
  for (const e of rows) byGroup.set(groupKey(e.categoryId), [...(byGroup.get(groupKey(e.categoryId)) ?? []), e])
  const groups = [...topLevel(categories).map((c) => c.id), '__none']
    .filter((k) => byGroup.has(k))
    .map((k) => ({ key: k, root: catById.get(k), list: byGroup.get(k)!, total: sum(byGroup.get(k)!.map((e) => e.amount)) }))
  const toggle = (k: string) => setOpened((c) => { const n = new Set(c); n.has(k) ? n.delete(k) : n.add(k); return n })
  const isOpen = (k: string) => opened.has(k)
  /** Dentro de un grupo solo hace falta la subcategoría; «General» si el gasto está en la categoría padre. */
  const subLabel = (e: Expense, rootId: string) => {
    if (!e.categoryId || e.categoryId === rootId) return categories.some((c) => c.parentId === rootId) ? 'General' : ''
    return catById.get(e.categoryId)?.name ?? ''
  }

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
        subtitle="Lo que registres se descuenta de tu disponible y de su categoría. Las compras con tarjeta de crédito cuentan en el mes en que se cobran."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Registrar gasto
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Gastado este mes" value={formatMoney(summary.spent)} />
        <Stat highlight label="Disponible" value={formatMoney(summary.remaining)} hint={summary.reserved ? 'Ya descontadas las reservas del plan anual' : undefined} />
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
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs" role="group" aria-label="Cómo ordenar los gastos">
                <button onClick={() => setGrouped(true)} aria-pressed={grouped} className={`rounded-full px-3 py-1.5 font-medium transition ${grouped ? 'bg-brand-600 text-white' : 'text-slate-600'}`}>Por categoría</button>
                <button onClick={() => setGrouped(false)} aria-pressed={!grouped} className={`rounded-full px-3 py-1.5 font-medium transition ${!grouped ? 'bg-brand-600 text-white' : 'text-slate-600'}`}>Por fecha</button>
              </div>
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
                {(grouped ? groups : [{ key: '', root: undefined, list: rows, total: 0 }]).map((g) => (
                  <tbody key={g.key || 'todos'} className="divide-y divide-slate-50 border-b border-slate-100">
                    {grouped && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-4 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <button onClick={() => toggle(g.key)} aria-expanded={isOpen(g.key)} className="flex min-w-0 items-center gap-2 font-semibold">
                              <ChevronDown className={`h-4 w-4 shrink-0 transition ${isOpen(g.key) ? '' : '-rotate-90'}`} aria-hidden />
                              {g.root && <CategoryIcon icon={g.root.icon} group={g.root.group} className="!h-7 !w-7" />}
                              <span className="truncate">{g.root?.name ?? 'Sin categoría'}</span>
                              <span className="text-xs font-normal text-slate-500">{g.list.length} {g.list.length === 1 ? 'movimiento' : 'movimientos'}</span>
                            </button>
                            <span className="num shrink-0 font-semibold">{formatMoney(g.total)}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!(grouped && !isOpen(g.key)) &&
                      g.list.map((e) => {
                        const cat = e.categoryId ? catById.get(e.categoryId) : undefined
                        const sameDay = e.chargeDate === e.date
                        return (
                          <tr key={e.id} className="hover:bg-slate-50/60">
                            <td className={`num whitespace-nowrap py-3 pr-4 text-slate-500 ${grouped ? 'pl-10' : 'pl-4'}`}>{formatDateEs(e.date)}</td>
                            <td className="px-4 py-3 font-medium">{e.description || <span className="font-normal text-slate-400">Sin descripción</span>}</td>
                            <td className="px-4 py-3">
                              {grouped ? (
                                <span className="text-slate-600">{subLabel(e, g.key) || <span className="text-slate-300">—</span>}</span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  {cat && <CategoryIcon icon={(categories.find((c) => c.id === rootIdOf(categories, cat.id)) ?? cat).icon} group={(categories.find((c) => c.id === rootIdOf(categories, cat.id)) ?? cat).group} />}
                                  {categoryLabel(categories, e.categoryId)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {METHOD_LABELS[e.method]}
                              <span className="block text-xs text-slate-500">{sameDay ? 'Cobrado el mismo día' : `Se cobra el ${formatDateEs(e.chargeDate)}`}</span>
                            </td>
                            <td className="num px-4 py-3 text-right font-semibold">{formatMoney(e.amount)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <button onClick={() => setEditing(e)} aria-label={`Editar gasto ${e.description || formatMoney(e.amount)}`} title="Editar el gasto" className="rounded-full p-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:p-2">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => remove(e.id, e.description || formatMoney(e.amount))} aria-label={`Eliminar gasto ${e.description}`} className="rounded-full p-3 text-slate-400 hover:bg-red-50 hover:text-red-600 md:p-2">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                ))}
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
      {(open || editing) && (
        <ExpenseModal
          key={editing?.id ?? 'nuevo'}
          expense={editing ?? undefined}
          onClose={() => {
            setOpen(false)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
