import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Copy, CornerDownRight, Plus, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, ErrorBox, Field, PageHeader, ProgressBar, Spinner } from '@/components/ui'
import { CategoryIcon } from '@/components/CategoryIcon'
import { GROUP_STYLE } from '@/components/groupStyle'
import { capitalize, monthLabel, useMonth } from '@/components/MonthContext'
import { useCategories, useMonthBudget, useReassignBudget, useSaveBudget, useSaveCategories, useYearBudgets } from '@/data/hooks'
import { repo } from '@/data'
import { newId } from '@/data/repository'
import { addMonths, budgetLeaves, childrenOf, copyBudget, makeMonth, parseMonth, suggest5030, sum, topLevel } from '@/domain/calc'
import { formatInput, formatMoney, parseMoney } from '@/domain/money'
import { GROUP_LABELS, GROUP_TARGETS, type BudgetItem, type Category, type Group, type MonthBudget, type MonthKey } from '@/domain/types'

interface Row {
  id: string
  name: string
  group: Group
  icon: string
  amountText: string
  /** Id de la categoría padre; null en las de primer nivel. */
  parentId: string | null
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

const kidsOf = (rows: Row[], id: string) => rows.filter((r) => r.parentId === id)

function Form({ month, budget, categories }: { month: MonthKey; budget: MonthBudget; categories: Category[] }) {
  const navigate = useNavigate()
  const saveBudget = useSaveBudget()
  const saveCategories = useSaveCategories()
  const reassign = useReassignBudget()

  /** Filas en orden de visualización: cada categoría seguida de sus subcategorías. */
  const initialRows = (): Row[] =>
    topLevel(categories).flatMap((top) =>
      [top, ...childrenOf(categories, top.id)].map((c) => ({
        id: c.id,
        name: c.name,
        group: top.group,
        icon: c.icon,
        parentId: c.id === top.id ? null : top.id,
        amountText: c.id === top.id && childrenOf(categories, top.id).length > 0 ? '0,00' : formatInput(budget.items.find((i) => i.categoryId === c.id)?.amount ?? 0),
      })),
    )

  const [rows, setRows] = useState<Row[]>(initialRows)
  const [incomeText, setIncomeText] = useState(formatInput(budget.plan?.income ?? 0))
  const [extraText, setExtraText] = useState(budget.plan?.extraIncome ? formatInput(budget.plan.extraIncome) : '')
  const [goalText, setGoalText] = useState(budget.plan?.savingsGoal ? formatInput(budget.plan.savingsGoal) : '')
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState<Group>('gustos')
  const [addingFor, setAddingFor] = useState<string | null>(null)
  /** Categorías plegadas (acordeón): sus subcategorías no se muestran. Al abrir la página todas están plegadas. */
  const [closed, setClosed] = useState<Set<string>>(() => new Set(topLevel(categories).filter((t) => childrenOf(categories, t.id).length > 0).map((t) => t.id)))
  const [subName, setSubName] = useState('')
  /** Para cada categoría que recibe su primera subcategoría: la que hereda su presupuesto. */
  const [carry, setCarry] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const income = incomeText.trim() ? parseMoney(incomeText) : 0
  const extra = extraText.trim() ? parseMoney(extraText) : 0
  const goal = goalText.trim() ? parseMoney(goalText) : 0
  const total = (income ?? 0) + (extra ?? 0)

  const isParent = (r: Row) => kidsOf(rows, r.id).length > 0
  const parsed = rows.map((r) => (r.amountText.trim() ? parseMoney(r.amountText) : 0))
  /** Importe efectivo de cada fila: las categorías con subcategorías suman las suyas. */
  const effective = rows.map((r, i) => (isParent(r) ? sum(kidsOf(rows, r.id).map((k) => parsed[rows.indexOf(k)] ?? 0)) : (parsed[i] ?? 0)))
  const assigned = sum(rows.map((r, i) => (isParent(r) ? 0 : effective[i])))
  const unassigned = total - assigned

  const nameKey = (r: Row) => `${r.parentId ?? ''}|${r.name.trim().toLowerCase()}`
  const keys = rows.map(nameKey)
  const errors: string[] = []
  if (income === null || extra === null || goal === null) errors.push('Revisa los importes: hay valores que no son números válidos.')
  else if (total <= 0) errors.push('Escribe el monto del mes para continuar.')
  if (rows.some((r, i) => !isParent(r) && parsed[i] === null)) errors.push('Revisa los montos de las categorías.')
  if (rows.length === 0) errors.push('Agrega al menos una categoría con su monto.')
  if (rows.some((r) => !r.name.trim())) errors.push('Cada categoría necesita un nombre antes de guardar.')
  if (new Set(keys).size !== keys.length) errors.push('Hay categorías con el mismo nombre.')
  if (assigned > total && total > 0) errors.push('La suma asignada supera el total disponible. Ajusta los montos para continuar.')

  const groupTotals = useMemo(
    () =>
      GROUPS.map((g) => {
        const sumG = sum(rows.map((r, i) => (r.group === g && !rows.some((k) => k.parentId === r.id) ? effective[i] : 0)))
        return { group: g, amount: sumG, pct: total > 0 ? (sumG / total) * 100 : 0 }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, total],
  )

  const patch = (id: string, change: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)))
  /** Cambiar el bloque de una categoría lo cambia también en sus subcategorías. */
  const setGroup = (id: string, group: Group) => setRows((rs) => rs.map((r) => (r.id === id || r.parentId === id ? { ...r, group } : r)))

  function suggest() {
    if (!total) return toast.error('Escribe primero el monto del mes.')
    const asCats: Category[] = rows.map((r, i) => ({ id: r.id, name: r.name, group: r.group, icon: r.icon, sortOrder: i, parentId: r.parentId }))
    const amounts = suggest5030(total, asCats, goal ?? 0)
    setRows((rs) => rs.map((r) => ({ ...r, amountText: formatInput(amounts.get(r.id) ?? 0) })))
    toast.success('Propuesta 50/30/20 aplicada. Ajusta lo que quieras antes de guardar.')
  }

  /** Trae el presupuesto de otro mes al formulario. No guarda: se puede ajustar antes de «Guardar». */
  async function pullFrom(source: MonthKey) {
    try {
      const src = await repo.getMonthBudget(source)
      if (!src.plan) return toast.error(`${capitalize(monthLabel(source))} no tiene presupuesto guardado.`)
      setIncomeText(formatInput(src.plan.income))
      setExtraText(src.plan.extraIncome ? formatInput(src.plan.extraIncome) : '')
      setGoalText(src.plan.savingsGoal ? formatInput(src.plan.savingsGoal) : '')
      setRows((rs) => rs.map((r) => ({ ...r, amountText: formatInput(src.items.find((i) => i.categoryId === r.id)?.amount ?? 0) })))
      toast.success(`Montos de ${monthLabel(source)} cargados. Revisa y pulsa «Guardar cambios».`)
    } catch (e) {
      toast.error(`No pudimos leer ese mes. ${e instanceof Error ? e.message : ''}`)
    }
  }

  function addCategory() {
    const name = newName.trim()
    if (!name) return
    if (rows.some((r) => !r.parentId && r.name.trim().toLowerCase() === name.toLowerCase())) return toast.error('Ya existe una categoría con ese nombre.')
    setRows((rs) => [...rs, { id: newId(), name, group: newGroup, icon: newGroup === 'ahorro' ? 'piggy' : 'dots', amountText: '0,00', parentId: null }])
    setNewName('')
  }

  function addSub(parent: Row) {
    const name = subName.trim()
    if (!name) return
    const siblings = kidsOf(rows, parent.id)
    if (siblings.some((k) => k.name.trim().toLowerCase() === name.toLowerCase())) return toast.error('Ya existe una subcategoría con ese nombre.')
    const child = (n: string, amountText: string): Row => ({ id: newId(), name: n, group: parent.group, icon: 'dots', amountText, parentId: parent.id })
    const added: Row[] = []
    if (siblings.length === 0) {
      // Primera subcategoría: el monto que tenía la categoría pasa a una subcategoría, así el total no cambia.
      if (name.toLowerCase() === 'otros') {
        const c = child(name, parent.amountText)
        added.push(c)
        setCarry((m) => ({ ...m, [parent.id]: c.id }))
      } else {
        const otros = child('Otros', parent.amountText)
        added.push(otros, child(name, '0,00'))
        setCarry((m) => ({ ...m, [parent.id]: otros.id }))
      }
    } else {
      added.push(child(name, '0,00'))
    }
    setRows((rs) => {
      const at = rs.reduce((last, r, i) => (r.id === parent.id || r.parentId === parent.id ? i : last), -1)
      const next = siblings.length === 0 ? rs.map((x) => (x.id === parent.id ? { ...x, amountText: '0,00' } : x)) : rs
      return [...next.slice(0, at + 1), ...added, ...next.slice(at + 1)]
    })
    setSubName('')
    setAddingFor(null)
    setClosed((c) => { const n = new Set(c); n.delete(parent.id); return n })
  }

  function removeRow(r: Row) {
    const leaves = rows.filter((x) => !isParent(x))
    if (!r.parentId && leaves.length - (isParent(r) ? kidsOf(rows, r.id).length : 1) < 1) return toast.error('Debe quedar al menos una categoría.')
    if (r.parentId) {
      // El monto de la subcategoría borrada se acumula en la categoría (oculto mientras conserve otras
      // subcategorías): al borrar la última, la categoría recupera la suma de todas.
      const amount = parseMoney(r.amountText) ?? 0
      setRows((rs) =>
        rs.filter((x) => x.id !== r.id).map((x) => (x.id === r.parentId ? { ...x, amountText: formatInput((parseMoney(x.amountText) ?? 0) + amount) } : x)),
      )
      return
    }
    setRows((rs) => rs.filter((x) => x.id !== r.id && x.parentId !== r.id))
  }

  async function save() {
    setSubmitted(true)
    if (errors.length) return toast.error(errors[0])
    try {
      const cats: Category[] = rows.map((r, i) => ({ id: r.id, name: r.name.trim(), group: r.group, icon: r.icon, sortOrder: i, parentId: r.parentId }))
      const rowParents = new Set(rows.filter((r) => isParent(r)).map((r) => r.id))
      const origParents = new Set(topLevel(categories).filter((t) => childrenOf(categories, t.id).length > 0).map((t) => t.id))
      const exists = new Set(categories.map((c) => c.id))
      const keptTop = new Set(rows.filter((r) => !r.parentId).map((r) => r.id))

      // Categorías que se quedan sin subcategorías: sus partidas vuelven al padre antes de borrar las hijas.
      for (const id of origParents) {
        if (keptTop.has(id) && !rowParents.has(id)) {
          await reassign.mutateAsync({ from: childrenOf(categories, id).map((c) => c.id), to: id })
        }
      }
      await saveCategories.mutateAsync(cats)
      // Categorías que reciben su primera subcategoría: su presupuesto de todos los meses pasa a una hija.
      for (const id of rowParents) {
        if (exists.has(id) && !origParents.has(id)) {
          const kids = kidsOf(rows, id)
          const target = kids.find((k) => k.id === carry[id]) ?? kids[0]
          await reassign.mutateAsync({ from: [id], to: target.id })
        }
      }
      const items: BudgetItem[] = rows.flatMap((r, i) => (isParent(r) ? [] : [{ month, categoryId: r.id, amount: parsed[i] ?? 0 }]))
      await saveBudget.mutateAsync({ plan: { month, income: income ?? 0, extraIncome: extra ?? 0, savingsGoal: goal ?? 0 }, items })
      toast.success('Presupuesto guardado')
      navigate('/panel')
    } catch (e) {
      toast.error(`No pudimos guardar el presupuesto. ${e instanceof Error ? e.message : ''}`)
    }
  }

  const pending = saveBudget.isPending || saveCategories.isPending || reassign.isPending

  return (
    <>
      <PageHeader eyebrow="Presupuesto" title={`Reparto de ${capitalize(monthLabel(month))}`} subtitle="Cambia el total o los montos por categoría. El panel se recalcula al guardar." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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

          <CopyCard month={month} budget={budget} categories={categories} onPull={pullFrom} />

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Categorías y montos</h2>
              <Button variant="secondary" onClick={suggest}>
                <Sparkles className="h-4 w-4" /> Sugerir 50/30/20
              </Button>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {groupTotals.map((g) => (
                <div key={g.group} className={`rounded-xl border-l-4 p-3 ${GROUP_STYLE[g.group].soft} ${GROUP_STYLE[g.group].border}`}>
                  <p className={`text-sm font-semibold ${GROUP_STYLE[g.group].text}`}>{GROUP_LABELS[g.group]}</p>
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

            {rows.some((r) => isParent(r)) && (
              <div className="mb-2 flex justify-end gap-3 text-xs font-medium text-brand-600">
                <button type="button" className="py-1 hover:underline" onClick={() => setClosed(new Set())}>Desplegar todo</button>
                <button type="button" className="py-1 hover:underline" onClick={() => setClosed(new Set(rows.filter((r) => isParent(r)).map((r) => r.id)))}>Plegar todo</button>
              </div>
            )}
            {rows.length === 0 && <p className="py-4 text-sm text-slate-500">Aún no hay categorías. Agrega la primera para repartir tu presupuesto.</p>}
            <ul className="space-y-2">
              {rows.map((r, i) => {
                const parent = isParent(r)
                const child = !!r.parentId
                const idx = i
                if (child && closed.has(r.parentId!)) return null
                const kidCount = kidsOf(rows, r.id).length
                const isClosed = closed.has(r.id)
                return (
                  <li key={r.id} className={child ? 'ml-6 sm:ml-8' : undefined}>
                    <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-l-4 p-2 sm:flex-nowrap ${GROUP_STYLE[r.group].border} ${child ? 'border-slate-100 bg-slate-50/60' : 'border-slate-100'}`}>
                      {parent && (
                        <button
                          type="button"
                          onClick={() => setClosed((c) => { const n = new Set(c); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })}
                          aria-expanded={!isClosed}
                          aria-label={`${isClosed ? 'Mostrar' : 'Ocultar'} las ${kidCount} subcategorías de ${r.name}`}
                          title={isClosed ? `Mostrar ${kidCount} subcategorías` : 'Ocultar subcategorías'}
                          className="-mr-1 rounded-full p-2 text-slate-500 hover:bg-slate-100"
                        >
                          <ChevronDown className={`h-4 w-4 transition ${isClosed ? '-rotate-90' : ''}`} aria-hidden />
                        </button>
                      )}
                      {child ? <CornerDownRight className={`h-4 w-4 shrink-0 ${GROUP_STYLE[r.group].text}`} aria-hidden /> : <CategoryIcon icon={r.icon} group={r.group} />}
                      <input aria-label={`Nombre de ${child ? 'la subcategoría' : 'la categoría'} ${r.name || idx + 1}`} className={`flex-1 ${child ? 'min-w-[9rem]' : 'min-w-0'}`} value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} />
                      {parent ? (
                        <span aria-label={`Total de ${r.name}`} title="Suma de sus subcategorías" className="num w-28 shrink-0 rounded-xl bg-slate-100 px-3 py-2.5 text-right text-sm font-semibold">
                          {formatInput(effective[idx])}
                        </span>
                      ) : (
                        <input aria-label={`Monto asignado a ${r.name}`} className={`num w-28 text-right ${submitted && parsed[idx] === null ? 'border-red-400' : ''}`} inputMode="decimal" value={r.amountText} onChange={(e) => patch(r.id, { amountText: e.target.value })} onBlur={() => parsed[idx] !== null && patch(r.id, { amountText: formatInput(parsed[idx]!) })} />
                      )}
                      {!child && (
                        <select aria-label={`Bloque de ${r.name}`} className="w-36" value={r.group} onChange={(e) => setGroup(r.id, e.target.value as Group)}>
                          {GROUPS.map((g) => (
                            <option key={g} value={g}>
                              {GROUP_LABELS[g]}
                            </option>
                          ))}
                        </select>
                      )}
                      {!child && (
                        <button
                          type="button"
                          onClick={() => (setAddingFor(addingFor === r.id ? null : r.id), setSubName(''))}
                          aria-label={`Añadir subcategoría a ${r.name}`}
                          aria-expanded={addingFor === r.id}
                          title="Añadir subcategoría"
                          className="rounded-full p-3 text-slate-400 hover:bg-brand-50 hover:text-brand-600 md:p-2"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => removeRow(r)} aria-label={`Eliminar ${child ? 'subcategoría' : 'categoría'} ${r.name}`} className="rounded-full p-3 text-slate-400 hover:bg-red-50 hover:text-red-600 md:p-2">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {addingFor === r.id && (
                      <form
                        className="ml-6 mt-2 flex flex-wrap gap-2 sm:ml-8"
                        onSubmit={(e) => {
                          e.preventDefault()
                          addSub(r)
                        }}
                      >
                        <input aria-label={`Nombre de la nueva subcategoría de ${r.name}`} placeholder={`Subcategoría de ${r.name}`} className="min-w-0 flex-1" value={subName} onChange={(e) => setSubName(e.target.value)} autoFocus />
                        <Button type="submit" variant="secondary">
                          Añadir
                        </Button>
                        {!parent && <p className="w-full text-xs text-slate-500">El monto actual de {r.name || 'esta categoría'} pasará a una subcategoría «Otros» para que el total no cambie.</p>}
                      </form>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Al eliminar una categoría, sus gastos pasan a «Sin categoría». Al eliminar una subcategoría, sus gastos pasan a su categoría. Los cambios se aplican al guardar.</p>

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
              <Button variant="secondary" onClick={() => { setRows(initialRows()); setCarry({}); setAddingFor(null); setIncomeText(formatInput(budget.plan?.income ?? 0)); setExtraText(budget.plan?.extraIncome ? formatInput(budget.plan.extraIncome) : ''); setGoalText(budget.plan?.savingsGoal ? formatInput(budget.plan.savingsGoal) : ''); setSubmitted(false) }}>
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

function CopyCard({ month, budget, categories, onPull }: { month: MonthKey; budget: MonthBudget; categories: Category[]; onPull: (source: MonthKey) => void }) {
  const saveBudget = useSaveBudget()
  const { year } = parseMonth(month)
  const year$ = useYearBudgets(year)
  const [source, setSource] = useState<MonthKey>(addMonths(month, -1))
  const [targets, setTargets] = useState<Set<MonthKey>>(new Set())
  const [busy, setBusy] = useState(false)

  const withPlan = new Set((year$.data?.plans ?? []).filter((p) => p.income + p.extraIncome > 0).map((p) => p.month))
  const sourceOptions = Array.from({ length: 25 }, (_, i) => addMonths(month, i - 12)).filter((m) => m !== month)
  const yearMonths = Array.from({ length: 12 }, (_, i) => makeMonth(year, i + 1)).filter((m) => m !== month)
  const toggle = (m: MonthKey) =>
    setTargets((t) => {
      const n = new Set(t)
      n.has(m) ? n.delete(m) : n.add(m)
      return n
    })

  async function pushToTargets() {
    const list = [...targets].sort()
    const overwrite = list.filter((m) => withPlan.has(m))
    if (overwrite.length && !window.confirm(`Esto reemplaza el presupuesto de: ${overwrite.map((m) => capitalize(monthLabel(m))).join(', ')}. ¿Continuar?`)) return
    setBusy(true)
    try {
      for (const m of list) {
        const copy = copyBudget(budget, m, budgetLeaves(categories).map((c) => c.id))
        if (copy) await saveBudget.mutateAsync(copy)
      }
      toast.success(`Presupuesto copiado a ${list.length} ${list.length === 1 ? 'mes' : 'meses'}.`)
      setTargets(new Set())
    } catch (e) {
      toast.error(`No pudimos copiar. ${e instanceof Error ? e.message : ''}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Copy className="h-4 w-4" /> Copiar entre meses
      </h2>
      <p className="mb-4 text-sm text-slate-500">Si tus meses se parecen, no hace falta repartir de cero cada vez.</p>

      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium">Traer los montos de otro mes a este</p>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Mes de origen" className="min-w-0 flex-1" value={source} onChange={(e) => setSource(e.target.value as MonthKey)}>
              {sourceOptions.map((m) => (
                <option key={m} value={m}>
                  {capitalize(monthLabel(m))}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={() => onPull(source)}>
              Traer montos
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Rellena el formulario sin guardar: puedes ajustar y luego guardar.</p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Copiar este mes (ya guardado) a otros meses de {year}</p>
          <div className="flex flex-wrap gap-2">
            {yearMonths.map((m) => {
              const on = targets.has(m)
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(m)}
                  className={`rounded-full border px-3 py-2 text-sm ${on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {capitalize(monthLabel(m)).split(' ')[0].slice(0, 3)}
                  {withPlan.has(m) && <span className="ml-1 text-xs text-slate-400" title="Ya tiene presupuesto">●</span>}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setTargets(new Set(yearMonths.filter((m) => m > month)))}>
              Meses siguientes
            </Button>
            <Button onClick={pushToTargets} disabled={busy || targets.size === 0 || !budget.plan}>
              {busy ? 'Copiando…' : `Copiar a ${targets.size} ${targets.size === 1 ? 'mes' : 'meses'}`}
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            ● = ya tiene presupuesto (se reemplaza, previa confirmación). Copia lo guardado, no los cambios sin guardar. Los gastos registrados no se tocan.
            {!budget.plan && ' Este mes aún no tiene presupuesto guardado.'}
          </p>
        </div>
      </div>
    </Card>
  )
}
