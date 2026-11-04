import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, ErrorBox, Field, PageHeader, ProgressBar, Spinner } from '@/components/ui'
import { CategoryIcon } from '@/components/CategoryIcon'
import { capitalize, monthLabel, useMonth } from '@/components/MonthContext'
import { useCategories, useMonthBudget, useSaveBudget, useSaveCategories } from '@/data/hooks'
import { newId } from '@/data/repository'
import { suggest5030, sum } from '@/domain/calc'
import { formatInput, formatMoney, parseMoney } from '@/domain/money'
import { GROUP_LABELS, GROUP_TARGETS, type BudgetItem, type Category, type Group, type MonthBudget, type MonthKey } from '@/domain/types'

interface Row {
  id: string
  name: string
  group: Group
  icon: string
  amountText: string
}

const GROUPS: Group[] = ['necesidades', 'gustos', 'ahorro']

export default function Presupuesto() {
  const { month } = useMonth()
  const budget = useMonthBudget(month)
  const categories = useCategories()

  if (budget.isLoading || categories.isLoading) return <Spinner />
  const error = budget.error ?? categories.error
  if (error || !budget.data || !categories.data) {
    return <ErrorBox error={error} onRetry={() => (budget.refetch(), categories.refetch())} />
  }
  // `key` reinicia el formulario al cambiar de mes.
  return <Form key={month} month={month} budget={budget.data} categories={categories.data} />
}

function Form({ month, budget, categories }: { month: MonthKey; budget: MonthBudget; categories: Category[] }) {
  const navigate = useNavigate()
  const saveBudget = useSaveBudget()
  const saveCategories = useSaveCategories()

  const initialRows = (): Row[] =>
    [...categories]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        id: c.id,
        name: c.name,
        group: c.group,
        icon: c.icon,
        amountText: formatInput(budget.items.find((i) => i.categoryId === c.id)?.amount ?? 0),
      }))

  const [rows, setRows] = useState<Row[]>(initialRows)
  const [incomeText, setIncomeText] = useState(formatInput(budget.plan?.income ?? 0))
  const [extraText, setExtraText] = useState(budget.plan?.extraIncome ? formatInput(budget.plan.extraIncome) : '')
  const [goalText, setGoalText] = useState(budget.plan?.savingsGoal ? formatInput(budget.plan.savingsGoal) : '')
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState<Group>('gustos')
  const [submitted, setSubmitted] = useState(false)

  const income = incomeText.trim() ? parseMoney(incomeText) : 0
  const extra = extraText.trim() ? parseMoney(extraText) : 0
  const goal = goalText.trim() ? parseMoney(goalText) : 0
  const total = (income ?? 0) + (extra ?? 0)
  const parsed = rows.map((r) => (r.amountText.trim() ? parseMoney(r.amountText) : 0))
  const assigned = sum(parsed.map((p) => p ?? 0))
  const unassigned = total - assigned

  const names = rows.map((r) => r.name.trim().toLowerCase())
  const errors: string[] = []
  if (income === null || extra === null || goal === null) errors.push('Revisa los importes: hay valores que no son números válidos.')
  else if (total <= 0) errors.push('Escribe el monto del mes para continuar.')
  if (parsed.some((p) => p === null)) errors.push('Revisa los montos de las categorías.')
  if (rows.length === 0) errors.push('Agrega al menos una categoría con su monto.')
  if (rows.some((r) => !r.name.trim())) errors.push('Cada categoría necesita un nombre antes de guardar.')
  if (new Set(names).size !== names.length) errors.push('Hay categorías con el mismo nombre.')
  if (assigned > total && total > 0) errors.push('La suma asignada supera el total disponible. Ajusta los montos para continuar.')

  const groupTotals = useMemo(
    () =>
      GROUPS.map((g) => {
        const sumG = sum(rows.map((r, i) => (r.group === g ? (parsed[i] ?? 0) : 0)))
        return { group: g, amount: sumG, pct: total > 0 ? (sumG / total) * 100 : 0 }
      }),
    [rows, parsed, total],
  )

  const patch = (id: string, change: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)))

  function suggest() {
    if (!total) return toast.error('Escribe primero el monto del mes.')
    const asCats: Category[] = rows.map((r, i) => ({ id: r.id, name: r.name, group: r.group, icon: r.icon, sortOrder: i }))
    const amounts = suggest5030(total, asCats, goal ?? 0)
    setRows((rs) => rs.map((r) => ({ ...r, amountText: formatInput(amounts.get(r.id) ?? 0) })))
    toast.success('Propuesta 50/30/20 aplicada. Ajusta lo que quieras antes de guardar.')
  }

  function addCategory() {
    const name = newName.trim()
    if (!name) return
    if (names.includes(name.toLowerCase())) return toast.error('Ya existe una categoría con ese nombre.')
    setRows((rs) => [...rs, { id: newId(), name, group: newGroup, icon: newGroup === 'ahorro' ? 'piggy' : 'dots', amountText: '0,00' }])
    setNewName('')
  }

  async function save() {
    setSubmitted(true)
    if (errors.length) return toast.error(errors[0])
    try {
      const cats: Category[] = rows.map((r, i) => ({ id: r.id, name: r.name.trim(), group: r.group, icon: r.icon, sortOrder: i }))
      await saveCategories.mutateAsync(cats)
      const items: BudgetItem[] = rows.map((r, i) => ({ month, categoryId: r.id, amount: parsed[i] ?? 0 }))
      await saveBudget.mutateAsync({ plan: { month, income: income ?? 0, extraIncome: extra ?? 0, savingsGoal: goal ?? 0 }, items })
      toast.success('Presupuesto guardado')
      navigate('/panel')
    } catch (e) {
      toast.error(`No pudimos guardar el presupuesto. ${e instanceof Error ? e.message : ''}`)
    }
  }

  const pending = saveBudget.isPending || saveCategories.isPending

  return (
    <>
      <PageHeader eyebrow="Presupuesto" title={`Reparto de ${capitalize(monthLabel(month))}`} subtitle="Cambia el total o los montos por categoría. El panel se recalcula al guardar." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-4 font-semibold">Origen del dinero</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Monto del mes (neto)" hint="Tu sueldo neto, después de impuestos, o el total que decides gastar.">
                <input className="w-full" inputMode="decimal" value={incomeText} onChange={(e) => setIncomeText(e.target.value)} />
              </Field>
              <Field label="Ingresos extra" hint="Opcional. Se suman al total del mes.">
                <input className="w-full" inputMode="decimal" placeholder="0,00" value={extraText} onChange={(e) => setExtraText(e.target.value)} />
              </Field>
              <Field label="Meta de ahorro" hint="Opcional. La usa la propuesta 50/30/20 en lugar del 20 %.">
                <input className="w-full" inputMode="decimal" placeholder="0,00" value={goalText} onChange={(e) => setGoalText(e.target.value)} />
              </Field>
              <Field label="Moneda">
                <input className="w-full bg-slate-50" value="Euro (EUR)" readOnly />
              </Field>
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Categorías y montos</h2>
              <Button variant="secondary" onClick={suggest}>
                <Sparkles className="h-4 w-4" /> Sugerir 50/30/20
              </Button>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {groupTotals.map((g) => (
                <div key={g.group} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-medium">{GROUP_LABELS[g.group]}</p>
                  <p className="text-xs text-slate-500">
                    Objetivo {GROUP_TARGETS[g.group]} % · {Math.round(g.pct)} % de tu total
                  </p>
                  <p className="num mt-1 font-semibold">{formatMoney(g.amount)}</p>
                </div>
              ))}
            </div>

            <div className={`mb-4 flex items-center justify-between rounded-xl px-4 py-3 text-sm ${unassigned < 0 ? 'bg-red-50 text-red-800' : unassigned > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`} role="status">
              <span>
                Asignado <b className="num">{formatMoney(assigned)}</b>
              </span>
              <span>
                {unassigned < 0 ? 'Te pasas en ' : 'Sin asignar '}
                <b className="num">{formatMoney(Math.abs(unassigned))}</b>
              </span>
            </div>

            {rows.length === 0 && <p className="py-4 text-sm text-slate-500">Aún no hay categorías. Agrega la primera para repartir tu presupuesto.</p>}
            <ul className="space-y-2">
              {rows.map((r, i) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 p-2 sm:flex-nowrap">
                  <CategoryIcon icon={r.icon} />
                  <input aria-label={`Nombre de la categoría ${i + 1}`} className="min-w-0 flex-1" value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} />
                  <input aria-label={`Monto asignado a ${r.name}`} className={`num w-28 text-right ${submitted && parsed[i] === null ? 'border-red-400' : ''}`} inputMode="decimal" value={r.amountText} onChange={(e) => patch(r.id, { amountText: e.target.value })} onBlur={() => parsed[i] !== null && patch(r.id, { amountText: formatInput(parsed[i]!) })} />
                  <select aria-label={`Bloque de ${r.name}`} className="w-36" value={r.group} onChange={(e) => patch(r.id, { group: e.target.value as Group })}>
                    {GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {GROUP_LABELS[g]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => (rows.length > 1 ? setRows((rs) => rs.filter((x) => x.id !== r.id)) : toast.error('Debe quedar al menos una categoría.'))}
                    aria-label={`Eliminar categoría ${r.name}`}
                    className="rounded-full p-3 text-slate-400 hover:bg-red-50 hover:text-red-600 md:p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Al eliminar una categoría, sus gastos pasan a «Sin categoría». Los cambios se aplican al guardar.</p>

            <form
              className="mt-4 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                addCategory()
              }}
            >
              <input aria-label="Nombre de la nueva categoría" placeholder="Nueva categoría" className="min-w-0 flex-1" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <select aria-label="Bloque de la nueva categoría" className="w-40" value={newGroup} onChange={(e) => setNewGroup(e.target.value as Group)}>
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {GROUP_LABELS[g]}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary">
                <Plus className="h-4 w-4" /> Agregar categoría
              </Button>
            </form>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to="/panel" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" /> Volver al panel
            </Link>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setRows(initialRows()); setIncomeText(formatInput(budget.plan?.income ?? 0)); setExtraText(budget.plan?.extraIncome ? formatInput(budget.plan.extraIncome) : ''); setGoalText(budget.plan?.savingsGoal ? formatInput(budget.plan.savingsGoal) : ''); setSubmitted(false) }}>
                <RotateCcw className="h-4 w-4" /> Descartar cambios
              </Button>
              <Button onClick={save} disabled={pending}>
                <Save className="h-4 w-4" /> {pending ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
          {submitted && errors.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>

        <aside>
          <Card className="sticky top-24">
            <h2 className="mb-4 font-semibold">Resumen del reparto</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Total disponible</dt><dd className="num font-semibold">{formatMoney(total)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Asignado</dt><dd className="num font-semibold">{formatMoney(assigned)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Sin asignar</dt><dd className={`num font-semibold ${unassigned < 0 ? 'text-red-600' : ''}`}>{formatMoney(unassigned)}</dd></div>
            </dl>
            <div className="mt-3">
              <ProgressBar ratio={total > 0 ? assigned / total : 0} tone={unassigned < 0 ? 'danger' : 'brand'} />
            </div>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Guardar aquí no altera los gastos ya registrados: solo cambia los límites de cada categoría.</p>
          </Card>
        </aside>
      </div>
    </>
  )
}
