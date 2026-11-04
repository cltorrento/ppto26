import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, ErrorBox, Field, PageHeader, ProgressBar, Spinner } from '@/components/ui'
import { CategoryOptions } from '@/components/CategoryOptions'
import { GROUP_STYLE } from '@/components/groupStyle'
import { capitalize, monthName } from '@/components/MonthContext'
import { useAddPlanned, useCategories, useDeletePlanned, usePlannedExpenses, useSetBudgetItem, useSettings, useYearBudgets, useYearExpenses } from '@/data/hooks'
import { newId } from '@/data/repository'
import { categoryLabel, childrenOf, expensesByPurchaseMonth, makeMonth, monthCapacity, monthOf, plannedReservesForMonth, sum, todayKey, topLevel } from '@/domain/calc'
import { formatInput, formatMoney, parseMoney } from '@/domain/money'
import type { Category, MonthKey } from '@/domain/types'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function PlanAnual() {
  const [year, setYear] = useState(() => Number(monthOf(todayKey()).slice(0, 4)))
  /** Categorías con las subcategorías desplegadas. Por defecto todas están plegadas. */
  const [opened, setOpened] = useState<Set<string>>(new Set())
  const budgets = useYearBudgets(year)
  const yearExpenses = useYearExpenses(year)
  const categories = useCategories()
  const planned = usePlannedExpenses()
  const settings = useSettings()
  const setItem = useSetBudgetItem()
  const addPlanned = useAddPlanned()
  const delPlanned = useDeletePlanned()

  const loading = budgets.isLoading || yearExpenses.isLoading || categories.isLoading || planned.isLoading || settings.isLoading
  const error = budgets.error ?? yearExpenses.error ?? categories.error ?? planned.error ?? settings.error
  const retry = () => [budgets, yearExpenses, categories, planned, settings].forEach((q) => q.refetch())

  const header = (
    <PageHeader
      eyebrow="Plan anual"
      title="Tu año, mes a mes"
      subtitle="Ajusta cuánto planeas gastar en cada categoría y añade los gastos puntuales del año para ver en qué meses te quedas sin margen."
      action={
        <div className="flex items-center rounded-full border border-slate-200 bg-white">
          <button onClick={() => setYear(year - 1)} aria-label="Año anterior" className="rounded-full p-3 hover:bg-slate-100 md:p-2"><ChevronLeft className="h-4 w-4" /></button>
          <span className="num min-w-16 text-center text-sm font-semibold">{year}</span>
          <button onClick={() => setYear(year + 1)} aria-label="Año siguiente" className="rounded-full p-3 hover:bg-slate-100 md:p-2"><ChevronRight className="h-4 w-4" /></button>
        </div>
      }
    />
  )

  if (loading) return (<>{header}<Spinner label="Cargando el plan anual…" /></>)
  if (error || !budgets.data || !yearExpenses.data || !categories.data || !planned.data || !settings.data) return (<>{header}<ErrorBox error={error} onRetry={retry} /></>)

  const cats = [...categories.data].sort((a, b) => a.sortOrder - b.sortOrder)
  const tops = topLevel(cats)
  const toggle = (id: string) => setOpened((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const parents = tops.filter((t) => childrenOf(cats, t.id).length > 0)
  const amountOf = (month: MonthKey, id: string) => items.find((i) => i.month === month && i.categoryId === id)?.amount ?? 0
  const { plans, items } = budgets.data
  const referenceIncome = settings.data.referenceIncome

  const capacities = MONTHS.map((m) => {
    const key = makeMonth(year, m)
    return monthCapacity({
      month: key,
      plan: plans.find((p) => p.month === key) ?? null,
      items: items.filter((i) => i.month === key),
      planned: planned.data,
      referenceIncome,
    })
  })
  const yearTotal = sum(items.map((i) => i.amount))
  const yearIncome = sum(capacities.map((c) => c.income ?? 0))
  const yearPlanned = planned.data.filter((p) => p.year === year || (p.repeatsYearly && p.year < year))

  async function commit(month: MonthKey, categoryId: string, amount: number) {
    try {
      await setItem.mutateAsync({ month, categoryId, amount })
    } catch (e) {
      toast.error(`No pudimos guardar el cambio del plan anual. ${e instanceof Error ? e.message : ''}`)
    }
  }

  return (
    <>
      {header}

      <p className="mb-6 rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
        <b>Cómo se guardan estas celdas:</b> cada celda es el presupuesto de esa categoría en ese mes. Editarla cambia el mismo dato que en Presupuesto: el presupuesto mensual siempre manda y el plan anual no guarda una segunda copia.
      </p>

      <Card className="mb-6 p-0">
        <div className="flex items-baseline justify-between p-5 pb-3">
          <div>
            <h2 className="font-semibold">Presupuesto por categoría y mes</h2>
            <p className="text-xs text-slate-500">{tops.length} categorías · escribe un importe y sal de la celda para guardarlo.</p>
          </div>
          <div className="text-right">
            <p className="num text-sm">Total del año <b>{formatMoney(yearTotal)}</b></p>
            {parents.length > 0 && (
              <button type="button" className="py-1 text-xs font-medium text-brand-600 hover:underline" onClick={() => setOpened(opened.size ? new Set() : new Set(parents.map((t) => t.id)))}>
                {opened.size ? 'Plegar todo' : 'Desplegar todo'}
              </button>
            )}
          </div>
        </div>
        {tops.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Todavía no hay categorías. Crea tu presupuesto y aparecerán aquí para todo el año.</p>
        ) : (
          <>
            <p className="px-5 pb-2 text-xs text-slate-500 md:hidden">Desliza horizontalmente para ver los 12 meses. La primera columna queda fija.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-y border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                    <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium">Categoría</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="px-1 py-2 text-center font-medium">{capitalize(monthName(makeMonth(year, m)).slice(0, 3))}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tops.flatMap((c) => {
                    const kids = childrenOf(cats, c.id)
                    const open = opened.has(c.id)
                    const rows = [
                      <tr key={c.id} className={`border-b border-slate-50 ${kids.length ? 'bg-slate-50/70' : ''}`}>
                        <th scope="row" className={`sticky left-0 z-10 px-4 py-1.5 text-left font-medium ${kids.length ? 'bg-slate-50' : 'bg-white'}`}>
                          {kids.length ? (
                            <button type="button" onClick={() => toggle(c.id)} aria-expanded={open} className="flex items-center gap-1.5 font-semibold">
                              <ChevronDown className={`h-4 w-4 transition ${open ? '' : '-rotate-90'}`} aria-hidden />
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${GROUP_STYLE[c.group].dot}`} aria-hidden />
                              {c.name}
                            </button>
                          ) : (
                            <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${GROUP_STYLE[c.group].dot}`} aria-hidden />{c.name}</span>
                          )}
                        </th>
                        {MONTHS.map((m) => {
                          const key = makeMonth(year, m)
                          if (kids.length) {
                            return (
                              <td key={m} className="num px-1 py-1 text-right text-xs font-semibold">
                                <span className="inline-block w-[84px] px-2" title="Suma de sus subcategorías">{formatMoney(sum(kids.map((k) => amountOf(key, k.id))))}</span>
                              </td>
                            )
                          }
                          return (
                            <td key={m} className="px-1 py-1">
                              <Cell label={`${c.name}, ${capitalize(monthName(key))}`} amount={amountOf(key, c.id)} onCommit={(v) => commit(key, c.id, v)} />
                            </td>
                          )
                        })}
                      </tr>,
                    ]
                    if (open) {
                      for (const k of kids) {
                        rows.push(
                          <tr key={k.id} className="border-b border-slate-50">
                            <th scope="row" className="sticky left-0 z-10 bg-white py-1.5 pl-9 pr-4 text-left font-normal text-slate-700"><span className="flex items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${GROUP_STYLE[c.group].dot} opacity-60`} aria-hidden />{k.name}</span></th>
                            {MONTHS.map((m) => {
                              const key = makeMonth(year, m)
                              return (
                                <td key={m} className="px-1 py-1">
                                  <Cell label={`${c.name} › ${k.name}, ${capitalize(monthName(key))}`} amount={amountOf(key, k.id)} onCommit={(v) => commit(key, k.id, v)} />
                                </td>
                              )
                            })}
                          </tr>,
                        )
                      }
                    }
                    return rows
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="font-semibold">Presupuesto, gastos e ingreso, mes a mes</h2>
        <p className="mb-1 text-xs text-slate-500">
          Por cada mes: lo que <b>presupuestaste</b>, lo que <b>ingresas</b>, lo que <b>gastaste</b> y lo que te queda <b>disponible</b> (ingreso − gastado). Así ves si gastaste más o menos de lo presupuestado.
        </p>
        <p className="mb-3 text-xs text-slate-500">
          En los meses que aún no llegan no hay gastos: ahí el disponible es el ingreso menos lo presupuestado. Ingreso anual previsto: <b>{formatMoney(yearIncome)}</b>.
        </p>
        <ul className="divide-y divide-slate-100">
          {capacities.map((c) => {
            const budgeted = c.budgeted + c.planned
            const monthExp = expensesByPurchaseMonth(yearExpenses.data, c.month)
            const spent = sum(monthExp.map((e) => e.amount))
            // Mes actual o pasado: se mide con lo realmente gastado (igual que el Panel). Mes futuro: con el presupuesto.
            const real = c.month <= monthOf(todayKey())
            const reserved = real ? sum(plannedReservesForMonth(planned.data, c.month, monthExp).map((p) => p.amount)) : 0
            const committed = real ? spent + reserved : budgeted
            const available = c.income === null ? null : c.income - committed
            const diff = spent - budgeted
            const tone = c.income === null ? 'brand' : committed > c.income ? 'danger' : committed > c.income * 0.9 ? 'warn' : 'brand'
            return (
              <li key={c.month} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium">
                    {capitalize(monthName(c.month))} {year}
                  </span>
                  {c.income === null ? (
                    <span className="text-slate-400">Sin ingreso definido</span>
                  ) : (
                    <span className="num flex flex-wrap justify-end gap-x-4 text-slate-600">
                      <span>Presupuestado <b className="text-slate-900">{formatMoney(budgeted)}</b></span>
                      <span>Ingreso <b className="text-slate-900">{formatMoney(c.income)}</b></span>
                      {real && <span>Gastado <b className="text-slate-900">{formatMoney(spent)}</b></span>}
                      <span className={`font-semibold ${available! < 0 ? 'text-red-600' : 'text-slate-700'}`} title={real ? 'Ingreso menos lo gastado (y lo programado que aún no registraste). Es el mismo número que «Te queda disponible» en el Panel.' : 'Mes sin gastos todavía: ingreso menos lo presupuestado.'}>
                        {available! < 0 ? 'Monto excedido' : 'Monto disponible'}: {formatMoney(available!)}
                      </span>
                    </span>
                  )}
                </div>
                {c.income !== null ? (
                  <div className="mt-2"><ProgressBar ratio={c.income > 0 ? committed / c.income : 1} tone={tone} /></div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">Este mes aún no tiene ingreso. Escríbelo en Presupuesto, o pon un ingreso de referencia en Ajustes.</p>
                )}
                {real && c.income !== null && (budgeted > 0 || spent > 0) && (
                  <p className={`mt-1 text-xs ${diff > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                    {diff > 0 ? `Gastaste ${formatMoney(diff)} más de lo presupuestado.` : diff < 0 ? `Gastaste ${formatMoney(-diff)} menos de lo presupuestado.` : 'Gastaste justo lo presupuestado.'}
                  </p>
                )}
                {c.planned > 0 && <p className="mt-1 text-xs text-slate-500">Incluye {formatMoney(c.planned)} en gastos programados.</p>}
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold">Gastos puntuales programados</h2>
        <p className="mb-4 text-xs text-slate-500">Ej. seguro del coche en agosto. Se suman a la capacidad del mes sin tocar tu presupuesto hasta que registres el gasto real.</p>
        <PlannedForm cats={cats} year={year} onAdd={(p) => addPlanned.mutateAsync(p).then(() => toast.success('Gasto programado guardado'))} pending={addPlanned.isPending} />
        {yearPlanned.length === 0 ? (
          <p className="mt-6 text-center text-sm text-slate-500">Aún no programaste gastos para {year}.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {yearPlanned.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {capitalize(monthName(makeMonth(year, p.month)))} · {categoryLabel(cats, p.categoryId)}
                    {p.repeatsYearly && ' · se repite cada año'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="num font-semibold">{formatMoney(p.amount)}</span>
                  <button
                    onClick={() => window.confirm(`¿Eliminar «${p.name}»?`) && delPlanned.mutateAsync(p.id).then(() => toast.success('Gasto programado eliminado'), () => toast.error('No pudimos eliminar el gasto programado.'))}
                    aria-label={`Eliminar ${p.name}`}
                    className="rounded-full p-3 text-slate-400 hover:bg-red-50 hover:text-red-600 md:p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-slate-500">Los gastos programados también aparecen en el panel del mes correspondiente. Si ya registraste el gasto con el mismo nombre, no se cuenta dos veces.</p>
      </Card>
    </>
  )
}

function Cell({ label, amount, onCommit }: { label: string; amount: number; onCommit: (cents: number) => void }) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? (amount ? formatInput(amount) : '')
  return (
    <input
      aria-label={label}
      className="num w-[84px] px-2 py-2 text-right text-base md:py-1.5 md:text-xs"
      inputMode="decimal"
      placeholder="0,00"
      value={shown}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text === null) return
        const v = text.trim() ? parseMoney(text) : 0
        setText(null)
        if (v === null) return toast.error('Escribe un importe válido.')
        if (v !== amount) onCommit(v)
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

function PlannedForm({ cats, year, onAdd, pending }: { cats: Category[]; year: number; onAdd: (p: import('@/domain/types').PlannedExpense) => Promise<unknown>; pending: boolean }) {
  const [name, setName] = useState('')
  const [amountText, setAmountText] = useState('')
  const [month, setMonth] = useState(8)
  const [categoryId, setCategoryId] = useState('')
  const [repeats, setRepeats] = useState(true)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseMoney(amountText)
    if (!name.trim()) return toast.error('Escribe un nombre para el gasto programado.')
    if (amount === null || amount <= 0) return toast.error('Escribe un monto mayor que cero.')
    try {
      await onAdd({ id: newId(), name: name.trim(), amount, year, month, categoryId: categoryId || null, repeatsYearly: repeats })
      setName('')
      setAmountText('')
    } catch (err) {
      toast.error(`No pudimos guardar el gasto programado. ${err instanceof Error ? err.message : ''}`)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1.2fr_auto]" noValidate>
      <Field label="Nombre"><input className="w-full" placeholder="Seguro del coche" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Importe"><input className="w-full" inputMode="decimal" placeholder="0,00" value={amountText} onChange={(e) => setAmountText(e.target.value)} /></Field>
      <Field label="Mes">
        <select className="w-full" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m) => <option key={m} value={m}>{capitalize(monthName(makeMonth(year, m)))}</option>)}
        </select>
      </Field>
      <Field label="Categoría">
        <select className="w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Sin categoría</option>
          <CategoryOptions categories={cats} />
        </select>
      </Field>
      <div className="flex items-end gap-3">
        <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} /> Se repite cada año</label>
      </div>
      <div className="md:col-span-5">
        <Button type="submit" disabled={pending}><Plus className="h-4 w-4" /> Añadir gasto programado</Button>
      </div>
    </form>
  )
}
