import { useMemo, useState } from 'react'
import { ChevronDown, Hammer, LandPlot, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, ErrorBox, Field, Modal, PageHeader, Spinner } from '@/components/ui'
import { CategoryOptions } from '@/components/CategoryOptions'
import { capitalize, formatDateEs, monthName } from '@/components/MonthContext'
import { useAddExpense, useCategories, useDeleteExpense, useDeleteProperty, useProperties, usePropertyExpenses, useSaveProperty, useSettings, useUpdateExpense, useAddExpenses, useDeleteExpenses, useUpdateExpenses, useYearBudgets } from '@/data/hooks'
import { newId } from '@/data/repository'
import { addMonths, categoryLabel, computeChargeDate, isValidDateKey, monthOf, todayKey } from '@/domain/calc'
import { formatInput, formatMoney, formatUsd, parseMoney } from '@/domain/money'
import { buildYearTables, categoryForKind, computePayment, effectivePayment, eurOf, findDuplicateExpenses, summarizeProperty, usdOf, type PropertySummary } from '@/domain/property'
import { METHOD_LABELS, PROPERTY_KINDS, PROPERTY_KIND_LABELS, type Category, type Expense, type PaymentMethod, type Property, type PropertyKind } from '@/domain/types'

const KIND_BAR: Record<PropertyKind, string> = {
  cuota: 'bg-indigo-500',
  materiales: 'bg-amber-500',
  construccion: 'bg-rose-500',
  otros: 'bg-slate-400',
}

const rateText = (r: number) => `${String(r).replace('.', ',')} %`

export default function Terreno() {
  const properties = useProperties()
  const categories = useCategories()
  const property = properties.data?.[0] ?? null
  const expenses = usePropertyExpenses(property?.id ?? null)
  const [editing, setEditing] = useState(false)

  const header = <PageHeader eyebrow="Terreno" title={property?.name ?? 'Tu terreno'} subtitle="Cuotas pagadas y pendientes, cuándo lo terminas de pagar y todo lo que inviertes en él: materiales y construcción." />

  if (properties.isLoading || categories.isLoading || expenses.isLoading) return (<>{header}<Spinner /></>)
  const error = properties.error ?? categories.error ?? expenses.error
  if (error) {
    const missing = error instanceof Error && /properties|property_id|schema cache/i.test(error.message)
    return (
      <>
        {header}
        {missing ? (
          <Card>
            <h2 className="font-semibold">Falta un paso en Supabase</h2>
            <p className="mt-1 text-sm text-slate-600">Para usar la ficha del terreno hay que ejecutar una vez el archivo <code>supabase/migracion-terreno.sql</code> en el SQL Editor de Supabase. No toca tus datos.</p>
          </Card>
        ) : (
          <ErrorBox error={error} onRetry={() => [properties, categories, expenses].forEach((q) => q.refetch())} />
        )}
      </>
    )
  }
  if (!categories.data) return null
  if (!property || editing) {
    return (
      <>
        {header}
        <PropertyForm key={property?.id ?? 'new'} property={property} categories={categories.data} onDone={() => setEditing(false)} onCancel={property ? () => setEditing(false) : undefined} />
      </>
    )
  }
  return <Detail property={property} expenses={expenses.data ?? []} categories={categories.data} onEdit={() => setEditing(true)} />
}

// ---------- Ficha (alta y edición) ----------

function guess(cats: Category[], re: RegExp): string | null {
  const hits = cats.filter((c) => re.test(c.name))
  return (hits.find((c) => c.parentId) ?? hits[0])?.id ?? null
}

function PropertyForm({ property, categories, onDone, onCancel }: { property: Property | null; categories: Category[]; onDone: () => void; onCancel?: () => void }) {
  const save = useSaveProperty()
  const today = todayKey()
  const [name, setName] = useState(property?.name ?? 'Terreno')
  const [acquisition, setAcquisition] = useState(property?.acquisitionDate ?? today)
  const [price, setPrice] = useState(property ? formatInput(property.price) : '')
  const [down, setDown] = useState(property && property.downPayment ? formatInput(property.downPayment) : '')
  const [rate, setRate] = useState(property ? String(property.interestRate).replace('.', ',') : '')
  const [term, setTerm] = useState(property ? String(property.termMonths) : '')
  const [first, setFirst] = useState(property?.firstPaymentDate ?? `${addMonths(monthOf(today), 1)}-${today.slice(8, 10)}`)
  const [initialPaid, setInitialPaid] = useState(property ? String(property.initialPaidCount) : '0')
  const [payment, setPayment] = useState(property && property.monthlyPayment ? formatInput(property.monthlyPayment) : '')
  const [cats, setCats] = useState<Record<PropertyKind, string>>({
    cuota: property?.categoryByKind.cuota ?? guess(categories, /terreno/i) ?? '',
    materiales: property?.categoryByKind.materiales ?? guess(categories, /material/i) ?? '',
    construccion: property?.categoryByKind.construccion ?? guess(categories, /construcc/i) ?? '',
    otros: property?.categoryByKind.otros ?? '',
  })
  const [notes, setNotes] = useState(property?.notes ?? '')
  const [eurRate, setEurRate] = useState(property?.eurRate ? String(property.eurRate).replace('.', ',') : '')
  const [submitted, setSubmitted] = useState(false)

  const rateEurN = eurRate.trim() ? Number(eurRate.trim().replace(',', '.')) : 0
  const priceC = parseMoney(price)
  const downC = down.trim() ? parseMoney(down) : 0
  const payC = payment.trim() ? parseMoney(payment) : 0
  const rateN = rate.trim() ? Number(rate.trim().replace(',', '.')) : 0
  const termN = /^\d+$/.test(term.trim()) ? Number(term.trim()) : null
  const paidN = /^\d+$/.test(initialPaid.trim()) ? Number(initialPaid.trim()) : null

  const errors: string[] = []
  if (!name.trim()) errors.push('Ponle un nombre al terreno.')
  if (!isValidDateKey(acquisition)) errors.push('La fecha de adquisición no es válida.')
  if (priceC === null || priceC <= 0) errors.push('Escribe el precio del terreno.')
  if (downC === null || (priceC !== null && downC > priceC)) errors.push('La entrada no puede superar el precio.')
  if (!Number.isFinite(rateN) || rateN < 0 || rateN > 100) errors.push('El interés debe ser un porcentaje entre 0 y 100.')
  if (termN === null || termN < 1 || termN > 600) errors.push('Escribe el número de cuotas (entre 1 y 600).')
  if (!isValidDateKey(first)) errors.push('La fecha de la primera cuota no es válida.')
  if (payC === null) errors.push('La cuota mensual no es un número válido.')
  if (paidN === null || (termN !== null && paidN > termN)) errors.push('Las cuotas ya pagadas no pueden superar el total.')
  if (!Number.isFinite(rateEurN) || rateEurN < 0 || rateEurN > 100) errors.push('El tipo de cambio no es un número válido (por ejemplo 1,16).')

  const preview = useMemo(() => {
    if (priceC === null || downC === null || termN === null || !Number.isFinite(rateN)) return null
    const financed = Math.max(0, priceC - downC)
    return { financed, payment: computePayment(financed, rateN, termN) }
  }, [priceC, downC, rateN, termN])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (errors.length || priceC === null || downC === null || payC === null || termN === null || paidN === null) return
    const p: Property = {
      id: property?.id ?? newId(),
      name: name.trim(),
      acquisitionDate: acquisition,
      price: priceC,
      downPayment: downC,
      interestRate: rateN,
      termMonths: termN,
      monthlyPayment: payC,
      firstPaymentDate: first,
      initialPaidCount: paidN,
      categoryByKind: { cuota: cats.cuota || null, materiales: cats.materiales || null, construccion: cats.construccion || null, otros: cats.otros || null },
      notes: notes.trim(),
      currentValue: property?.currentValue ?? 0,
      buildingValue: property?.buildingValue ?? 0,
      valueDate: property?.valueDate ?? null,
      eurRate: rateEurN > 0 ? rateEurN : undefined,
    }
    try {
      await save.mutateAsync(p)
      toast.success('Ficha guardada')
      onDone()
    } catch (err) {
      toast.error(`No pudimos guardar la ficha. ${err instanceof Error ? err.message : ''}`)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {!property && (
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><LandPlot className="h-5 w-5" aria-hidden /></span>
            <p className="text-sm text-slate-600">Crea la ficha de tu terreno con los datos de la compra. Con eso la app calcula el plan de cuotas y te dice cuántas llevas pagadas, cuántas faltan y cuándo terminas.</p>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 font-semibold">Datos de la compra</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre"><input className="w-full" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Fecha de adquisición"><input type="date" className="w-full" value={acquisition} onChange={(e) => setAcquisition(e.target.value)} /></Field>
          <Field label="Precio total ($)"><input className="w-full" inputMode="decimal" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
          <Field label="Entrada pagada ($)" hint="Opcional. Se resta del precio para calcular lo que financias."><input className="w-full" inputMode="decimal" placeholder="0,00" value={down} onChange={(e) => setDown(e.target.value)} /></Field>
          <Field label="Tipo de cambio habitual ($ por 1 €)" hint="Ej. 1,16. Sirve para estimar en euros lo que falta por pagar y lo anterior a la app. Cada pago nuevo guarda sus euros reales."><input className="w-full" inputMode="decimal" placeholder="1,16" value={eurRate} onChange={(e) => setEurRate(e.target.value)} /></Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">Financiación</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Interés anual (%)" hint="Pon 0 si no tiene interés."><input className="w-full" inputMode="decimal" placeholder="0" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
          <Field label="Número de cuotas" hint="Total de cuotas mensuales a pagar."><input className="w-full" inputMode="numeric" placeholder="120" value={term} onChange={(e) => setTerm(e.target.value)} /></Field>
          <Field label="Fecha de la primera cuota" hint="Su día es el día de pago de cada mes."><input type="date" className="w-full" value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
          <Field label="Cuotas que ya pagaste antes de usar la app" hint="Para que el conteo empiece bien. Las siguientes las registras aquí."><input className="w-full" inputMode="numeric" value={initialPaid} onChange={(e) => setInitialPaid(e.target.value)} /></Field>
          <Field label="Cuota mensual ($)" hint={preview && preview.payment > 0 ? `Si la dejas vacía usamos la calculada: ${formatUsd(preview.payment)}.` : 'Déjala vacía para calcularla con precio, interés y plazo.'}>
            <input className="w-full" inputMode="decimal" placeholder={preview && preview.payment > 0 ? formatInput(preview.payment) : '0,00'} value={payment} onChange={(e) => setPayment(e.target.value)} />
          </Field>
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Se financia</p>
            <p className="num mt-1 text-xl font-semibold">{preview ? formatUsd(preview.financed) : '—'}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">¿En qué categoría se registra cada gasto?</h2>
        <p className="mb-4 text-sm text-slate-500">Cada pago que registres aquí también cuenta como gasto del mes en la categoría que elijas. Ya elegimos una por ti si encontramos una parecida.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {PROPERTY_KINDS.map((k) => (
            <Field key={k} label={PROPERTY_KIND_LABELS[k]}>
              <select className="w-full" value={cats[k]} onChange={(e) => setCats((c) => ({ ...c, [k]: e.target.value }))}>
                <option value="">{k === 'cuota' ? 'Sin categoría' : 'La misma que las cuotas'}</option>
                <CategoryOptions categories={categories} />
              </select>
            </Field>
          ))}
        </div>
        <div className="mt-4">
          <Field label="Notas (opcional)"><textarea className="w-full" rows={2} placeholder="Ubicación, vendedor, número de escritura…" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
      </Card>

      {submitted && errors.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">
          {errors.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar ficha'}</Button>
      </div>
    </form>
  )
}

// ---------- Vista de la ficha (como una hoja de cálculo) ----------

const dmy = (d: string) => d.split('-').reverse().join('/')

function Detail({ property, expenses, categories, onEdit }: { property: Property; expenses: Expense[]; categories: Category[]; onEdit: () => void }) {
  const del = useDeleteExpense()
  const delProperty = useDeleteProperty()
  const [modal, setModal] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const addMany = useAddExpenses()
  const delMany = useDeleteExpenses()
  const updateMany = useUpdateExpenses()
  const saveProperty = useSaveProperty()
  // Primer mes con presupuesto: lo anterior a él no debería contar como gasto (ahí aún no usabas la app).
  const yNow = Number(todayKey().slice(0, 4))
  const plansNow = useYearBudgets(yNow)
  const plansPrev = useYearBudgets(yNow - 1)
  const firstPlanMonth = useMemo(() => {
    const months = [...(plansPrev.data?.plans ?? []), ...(plansNow.data?.plans ?? [])].map((p) => p.month).sort()
    return months[0] ?? null
  }, [plansNow.data, plansPrev.data])
  const beforeBudget = useMemo(
    () => (firstPlanMonth ? expenses.filter((e) => e.propertyId === property.id && !e.outsideBudget && e.date < `${firstPlanMonth}-01`) : []),
    [expenses, firstPlanMonth, property.id],
  )
  const allDupes = useMemo(() => findDuplicateExpenses(expenses, property.id, property.eurRate ?? 0), [expenses, property.id, property.eurRate])
  // «No son repetidos»: se recuerda cuántos había y el aviso solo vuelve si aparecen más.
  const dismissKey = `mipresupuesto:repetidos:${property.id}`
  const [dismissed, setDismissed] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(dismissKey) ?? 0)
    } catch {
      return 0
    }
  })
  const dupes = allDupes.length > dismissed ? allDupes : []
  function dismissDupes() {
    try {
      localStorage.setItem(dismissKey, String(allDupes.length))
    } catch {
      /* sin almacenamiento: el aviso vuelve al recargar */
    }
    setDismissed(allDupes.length)
  }
  const [allYears, setAllYears] = useState(false)
  const [showData, setShowData] = useState(false)
  const s = useMemo(() => summarizeProperty(property, expenses), [property, expenses])
  const years = useMemo(() => buildYearTables(property, expenses, PROPERTY_KIND_LABELS.cuota), [property, expenses])
  const thisYear = Number(todayKey().slice(0, 4))
  const shown = allYears ? years : years.filter((y) => y.paidCount > 0 || y.year === thisYear || y.year === thisYear + 1)
  const visible = shown.length > 0 ? shown : years.slice(0, 2)
  const hidden = years.length - visible.length
  const others = [...expenses].filter((e) => e.propertyKind !== 'cuota').sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  async function removeMovement(id: string, label: string) {
    if (!window.confirm(`¿Eliminar «${label}»? También se quita de tus gastos.`)) return
    try {
      await del.mutateAsync(id)
      toast.success('Eliminado')
    } catch (e) {
      toast.error(`No pudimos eliminarlo. ${e instanceof Error ? e.message : ''}`)
    }
  }
  async function takeOutOfBudget() {
    if (!firstPlanMonth) return
    try {
      await updateMany.mutateAsync(beforeBudget.map((e) => ({ ...e, outsideBudget: true })))
      toast.success(`${beforeBudget.length} pagos sacados de tu presupuesto. Siguen en la ficha.`)
    } catch (e) {
      toast.error(`No pudimos sacarlos. ${e instanceof Error ? e.message : ''}`)
    }
  }
  async function removeDupes() {
    if (!window.confirm(`Se eliminarán ${dupes.length} pagos repetidos (misma fecha, tipo y dólares), dejando uno de cada. También se quitan de tus gastos. ¿Continuar?`)) return
    try {
      await delMany.mutateAsync(dupes.map((e) => e.id))
      toast.success(`${dupes.length} pagos repetidos eliminados`)
    } catch (e) {
      toast.error(`No pudimos eliminarlos. ${e instanceof Error ? e.message : ''}`)
    }
  }
  async function removeProperty() {
    if (!window.confirm(`¿Eliminar la ficha «${property.name}»? Los gastos ya registrados se conservan en tus gastos, pero dejan de estar ligados a la ficha.`)) return
    try {
      await delProperty.mutateAsync(property.id)
      toast.success('Ficha eliminada')
    } catch (e) {
      toast.error(`No pudimos eliminar la ficha. ${e instanceof Error ? e.message : ''}`)
    }
  }

  const rows: { label: string; value: number; eur: number | null; dot: string }[] = [
    { label: 'Terrenos', value: s.invested.cuota, eur: s.investedEur.cuota, dot: KIND_BAR.cuota },
    { label: 'Materiales', value: s.invested.materiales, eur: s.investedEur.materiales, dot: KIND_BAR.materiales },
    { label: 'Construcción', value: s.invested.construccion, eur: s.investedEur.construccion, dot: KIND_BAR.construccion },
    { label: 'Otros (escrituras, impuestos…)', value: s.invested.otros, eur: s.investedEur.otros, dot: KIND_BAR.otros },
  ]
  const rate = property.eurRate ?? 0
  /**
   * Lápiz en una cuota «anterior a la app» (sin fecha ni euros propios): esas cuotas pasan a ser pagos individuales,
   * con su fecha de vencimiento y los euros al cambio habitual, y se abre la que elegiste para corregirla.
   */
  async function editInitial(cuotaNumber: number) {
    const n = Math.min(property.initialPaidCount, s.schedule.length)
    if (n <= 0) return
    if (rate <= 0) return toast.error('Primero escribe el tipo de cambio habitual en «Editar ficha». Con él se calculan los euros de las demás cuotas hasta que las corrijas una por una.')
    // Si ya hay cuotas registradas, convertir otras `n` las contaría dos veces: se avisa antes.
    const already = expenses.filter((e) => e.propertyKind === 'cuota').length
    const warning = already > 0 ? ` OJO: ya tienes ${already} cuotas registradas como pagos; si esas ya son las mismas ${n}, no sigas, porque se contarían dos veces (en tu presupuesto también).` : ''
    if (!window.confirm(`Para poner los euros de esta cuota, las ${n} cuotas anteriores pasan a ser pagos individuales, con su fecha de vencimiento y los euros al cambio ${String(rate).replace('.', ',')} $ por 1 €. NO cuentan como gasto de esos meses (son historia anterior a la app). Luego corriges cada una con su lápiz.${warning} ¿Continuar?`)) return
    try {
      const list: Expense[] = s.schedule.slice(0, n).map((r) => ({
        id: newId(),
        date: r.dueDate,
        categoryId: categoryForKind(property, 'cuota'),
        amount: Math.round(r.payment / rate),
        amountUsd: r.payment,
        description: PROPERTY_KIND_LABELS.cuota,
        method: 'transferencia' as PaymentMethod,
        chargeDate: r.dueDate,
        propertyId: property.id,
        propertyKind: 'cuota' as PropertyKind,
        // Son historia anterior a la app: se ven en la ficha pero no cuentan como gasto de esos meses.
        outsideBudget: true,
      }))
      await addMany.mutateAsync(list)
      await saveProperty.mutateAsync({ ...property, initialPaidCount: 0 })
      setEditExpense(list[cuotaNumber - 1] ?? null)
    } catch (e) {
      toast.error(`No pudimos preparar las cuotas. ${e instanceof Error ? e.message : ''}`)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Terreno"
        title={property.name}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onEdit}><Pencil className="h-4 w-4" /> Editar ficha</Button>
            <Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Registrar pago o gasto</Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Monto</p>
          <p className="num mt-2 text-2xl font-semibold text-indigo-600 sm:text-3xl">{formatUsd(s.totalAmount)}</p>
          {s.totalAmountEur !== null && <p className="num mt-1 text-xs text-slate-500">≈ {formatMoney(s.totalAmountEur)} al cambio habitual</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">A pagar</p>
          <p className="num mt-2 text-2xl font-semibold text-red-600 sm:text-3xl">{formatUsd(s.toPay)}</p>
          {s.toPayEur !== null && <p className="num mt-1 text-xs text-slate-500">≈ {formatMoney(s.toPayEur)} al cambio habitual</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Cuotas pagadas</p>
          <p className="num mt-2 text-2xl font-semibold sm:text-3xl">{s.paidCount} <span className="text-base font-normal text-slate-500">de {s.total}</span></p>
          <p className="mt-1 text-xs text-slate-500">Faltan {s.remaining}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Terminas de pagar</p>
          <p className="num mt-2 text-2xl font-semibold sm:text-3xl">{s.endDate ? dmy(s.endDate) : '—'}</p>
          {s.nextDue && <p className="mt-1 text-xs text-slate-500">Próxima cuota: {dmy(s.nextDue)}</p>}
        </div>
      </div>

      {beforeBudget.length > 0 && firstPlanMonth && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <p className="text-sm text-amber-900">
            <b>{beforeBudget.length} {beforeBudget.length === 1 ? 'pago del terreno cuenta' : 'pagos del terreno cuentan'} como gasto en meses anteriores a {capitalize(monthName(firstPlanMonth))} {firstPlanMonth.slice(0, 4)}</b>, cuando aún no usabas la app. Eso ensucia Gastos, el Panel y Reportes de esos meses. Sácalos del presupuesto: siguen en la ficha del terreno, pero dejan de contar como gasto.
          </p>
          <div className="mt-3"><Button onClick={takeOutOfBudget} disabled={updateMany.isPending}>{updateMany.isPending ? 'Sacando…' : `Sacar ${beforeBudget.length} del presupuesto`}</Button></div>
        </Card>
      )}

      {dupes.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm text-red-900">
            <b>Hay {dupes.length} {dupes.length === 1 ? 'pago que parece repetido' : 'pagos que parecen repetidos'}</b> (misma fecha, tipo y dólares). Si lo están, se cuentan dos veces aquí y también en tus gastos y presupuesto. Si pagaste dos cuotas el mismo día, no lo son.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" onClick={removeDupes} disabled={delMany.isPending}>{delMany.isPending ? 'Quitando…' : `Quitar los ${dupes.length} repetidos`}</Button>
            <Button variant="secondary" onClick={dismissDupes}>No son repetidos</Button>
          </div>
        </Card>
      )}

      <PlusvaliaCard property={property} s={s} />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Lo invertido</h2>
          <ul className="space-y-2 text-sm">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${r.dot}`} aria-hidden />{r.label}</span>
                <span className="num whitespace-nowrap text-right font-medium">
                  {formatUsd(r.value)} <span className="font-normal text-slate-500">({r.eur !== null ? formatMoney(r.eur) : '— €'})</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-slate-200 pt-3">
            <span className="font-semibold text-red-600">Total</span>
            <span className="num whitespace-nowrap text-right text-xl font-semibold">
              {formatUsd(s.totalInvested)} <span className="text-base font-medium text-slate-600">({s.totalInvestedEur !== null ? formatMoney(s.totalInvestedEur) : '— €'})</span>
            </span>
          </div>
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between gap-3 p-5 pb-3">
            <h2 className="font-semibold">Materiales y construcción</h2>
            <Button variant="secondary" onClick={() => setModal(true)}><Hammer className="h-4 w-4" /> Registrar</Button>
          </div>
          {others.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-slate-500">Todavía no hay gastos. Registra aquí lo que compres o pagues para el terreno.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {others.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${KIND_BAR[e.propertyKind ?? 'otros']}`} aria-hidden />
                  <span className="num shrink-0 text-slate-500">{dmy(e.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{PROPERTY_KIND_LABELS[e.propertyKind ?? 'otros']}{e.description && e.description !== PROPERTY_KIND_LABELS[e.propertyKind ?? 'otros'] ? ` · ${e.description}` : ''}</span>
                  <span className="num shrink-0 whitespace-nowrap text-right font-semibold">
                    {formatUsd(usdOf(e))}
                    {eurOf(e, rate) !== null && <span className="font-normal text-slate-500"> ({formatMoney(eurOf(e, rate)!)})</span>}
                  </span>
                  <button onClick={() => setEditExpense(e)} aria-label="Editar gasto" title="Editar fecha, dólares y euros" className="rounded-full p-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:p-2">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => removeMovement(e.id, `${PROPERTY_KIND_LABELS[e.propertyKind ?? 'otros']} ${formatUsd(usdOf(e))}`)} aria-label="Eliminar gasto" className="rounded-full p-3 text-slate-400 hover:bg-red-50 hover:text-red-600 md:p-2">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mb-3 font-semibold">Cuotas por año</h2>
      <div className="mb-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        {visible.map((y) => (
          <Card key={y.year} className="overflow-hidden p-0">
            <h3 className="py-2.5 text-center font-semibold">{y.year}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-indigo-50 text-xs text-slate-600">
                  <th className="px-3 py-1.5 text-left font-medium">Mes</th>
                  <th className="px-2 py-1.5 text-left font-medium">Fecha</th>
                  <th className="px-2 py-1.5 text-right font-medium">Cuota</th>
                  <th className="px-3 py-1.5 text-right font-medium">Pagado en €</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {y.rows.map((r) => (
                  <tr key={r.n} className="border-b border-slate-100">
                    <td className="px-3 py-1.5">{capitalize(monthName(`${y.year}-${String(r.month).padStart(2, '0')}`).slice(0, 3))}</td>
                    {r.paid ? (
                      <>
                        <td className="num whitespace-nowrap px-2 py-1.5">{r.paid.date ? dmy(r.paid.date) : <span className="text-slate-400">—</span>}</td>
                        <td className="num px-2 py-1.5 text-right font-medium" title={r.paid.amountEur !== null ? `Salieron ${formatMoney(r.paid.amountEur)} de tu cuenta` : undefined}>{formatUsd(r.paid.amount)}</td>
                        <td className="num whitespace-nowrap px-3 py-1.5 text-right">{r.paid.amountEur !== null ? formatMoney(r.paid.amountEur) : <span className="text-slate-400">— €</span>}</td>
                        <td className="whitespace-nowrap pr-2">
                          {r.paid.expenseId ? (
                            <>
                              <button onClick={() => setEditExpense(expenses.find((x) => x.id === r.paid!.expenseId) ?? null)} aria-label={`Editar cuota ${r.n}`} title="Editar fecha, dólares y euros" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => removeMovement(r.paid!.expenseId!, `Cuota ${r.n}`)} aria-label={`Eliminar cuota ${r.n}`} className="rounded-full p-2 text-slate-300 hover:bg-red-50 hover:text-red-600">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => editInitial(r.n)} disabled={addMany.isPending || saveProperty.isPending} aria-label={`Poner fecha y euros de la cuota ${r.n}`} title="Poner fecha, dólares y euros de esta cuota" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="num whitespace-nowrap px-2 py-1.5 text-slate-300">{dmy(r.dueDate)}</td>
                        <td className="num px-2 py-1.5 text-right text-slate-300">{formatUsd(r.scheduled)}</td>
                        <td className="px-3 py-1.5 text-right text-xs text-slate-300">Pendiente</td>
                        <td />
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-semibold">
                  <td className="px-3 py-1.5" colSpan={2}>Total</td>
                  <td className="num whitespace-nowrap px-2 py-1.5 text-right">{formatUsd(y.paidTotal)}</td>
                  <td className="num whitespace-nowrap px-3 py-1.5 text-right" title="Euros que salieron de tu cuenta en el año">{y.paidTotalEur !== null ? formatMoney(y.paidTotalEur) : '— €'}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </Card>
        ))}
      </div>
      {hidden > 0 && (
        <div className="mb-6 text-center">
          <Button variant="secondary" onClick={() => setAllYears(true)}>Mostrar los {hidden} años restantes</Button>
        </div>
      )}
      {allYears && years.length > 3 && (
        <div className="mb-6 text-center">
          <Button variant="ghost" onClick={() => setAllYears(false)}>Mostrar menos años</Button>
        </div>
      )}

      <Card className="p-0">
        <button type="button" onClick={() => setShowData((v) => !v)} aria-expanded={showData} className="flex w-full items-center justify-between gap-3 p-5 text-left">
          <h2 className="font-semibold">Datos de la ficha</h2>
          <ChevronDown className={`h-5 w-5 shrink-0 transition ${showData ? '' : '-rotate-90'}`} aria-hidden />
        </button>
        {showData && (
          <div className="px-5 pb-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <Item k="Adquirido el" v={formatDateEs(property.acquisitionDate)} />
              <Item k="Precio total" v={formatUsd(property.price)} />
              <Item k="Entrada" v={formatUsd(property.downPayment)} />
              <Item k="Interés anual" v={rateText(property.interestRate)} />
              <Item k="Cuota mensual" v={formatUsd(effectivePayment(property))} />
              <Item k="Cuotas" v={String(property.termMonths)} />
              <Item k="Primera cuota" v={formatDateEs(property.firstPaymentDate)} />
              <Item k="Día de pago" v={`El ${Number(property.firstPaymentDate.slice(8, 10))}`} />
              <Item k="Tipo de cambio" v={property.eurRate ? `${String(property.eurRate).replace('.', ',')} $ por 1 €` : 'Sin definir'} />
            </dl>
            {property.notes && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{property.notes}</p>}
            <div className="mt-4">
              <Button variant="ghost" onClick={removeProperty} className="!text-red-600 hover:!bg-red-50"><Trash2 className="h-4 w-4" /> Eliminar ficha</Button>
            </div>
          </div>
        )}
      </Card>

      {(modal || editExpense) && (
        <PropertyExpenseModal
          key={editExpense?.id ?? 'nuevo'}
          property={property}
          categories={categories}
          expense={editExpense ?? undefined}
          onClose={() => {
            setModal(false)
            setEditExpense(null)
          }}
        />
      )}
    </>
  )
}

function gainText(gain: number, pct: number | null, labelPos: string, labelNeg: string) {
  return { label: gain < 0 ? labelNeg : labelPos, value: formatUsd(gain), neg: gain < 0, pct: pct === null ? '' : `${pct >= 0 ? '+' : ''}${(pct * 100).toFixed(1).replace('.', ',')} %` }
}

function PlusvaliaCard({ property, s }: { property: Property; s: PropertySummary }) {
  const save = useSaveProperty()
  const [landText, setLandText] = useState(property.currentValue ? formatInput(property.currentValue) : '')
  const land = landText.trim() ? parseMoney(landText) : 0
  const changed = land !== null && land !== (property.currentValue ?? 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (land === null) return toast.error('Escribe un valor válido.')
    try {
      await save.mutateAsync({ ...property, currentValue: land, valueDate: land > 0 ? todayKey() : null })
      toast.success('Valor actualizado')
    } catch (err) {
      toast.error(`No pudimos guardar el valor. ${err instanceof Error ? err.message : ''}`)
    }
  }

  const landG = gainText(s.landGain, s.landGainPct, 'Plusvalía del terreno', 'Minusvalía del terreno')
  const totalG = gainText(s.gain, s.gainPct, 'Plusvalía total', 'Minusvalía total')
  const hasBuild = s.buildCost > 0
  const totalValue = s.landValue + s.buildValue

  return (
    <Card className="mb-6">
      <form onSubmit={submit} noValidate>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Plusvalía</h2>
          <Button type="submit" variant="secondary" disabled={!changed || save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar valor'}</Button>
        </div>
        <div className={`grid grid-cols-1 gap-4 ${hasBuild ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          <div className="rounded-xl border border-slate-200 p-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-800">Valor actual del terreno</span>
              <input className="num w-full" inputMode="decimal" placeholder={formatInput(s.landCost)} value={landText} onChange={(e) => setLandText(e.target.value)} />
            </label>
            <p className="mt-2 text-xs text-slate-500">Solo el terreno, sin lo construido. {s.landValueSet ? '' : 'Vacío = lo que costó.'}</p>
            <p className="num mt-2 text-sm text-slate-600">Costo: <b className="text-slate-900">{formatUsd(s.landCost)}</b></p>
            <p className={`num mt-1 text-sm font-semibold ${landG.neg ? 'text-red-600' : 'text-emerald-700'}`}>{landG.label}: {landG.value} <span className="font-normal">{landG.pct}</span></p>
          </div>

          {hasBuild && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-sm font-medium text-slate-800">Valor de lo construido</p>
              <p className="num mt-2 text-xl font-semibold">{formatUsd(s.buildValue)}</p>
              <p className="mt-2 text-xs text-slate-500">Se toma de lo que ya registraste: materiales + construcción. No se escribe aparte.</p>
              <p className="num mt-2 text-sm text-slate-600">Materiales: <b className="text-slate-900">{formatUsd(s.invested.materiales)}</b></p>
              <p className="num text-sm text-slate-600">Construcción: <b className="text-slate-900">{formatUsd(s.invested.construccion)}</b></p>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">Total</p>
            <p className="num mt-2 text-sm text-slate-600">Costo total: <b className="text-slate-900">{formatUsd(s.totalCost)}</b></p>
            <p className="num text-sm text-slate-600">Valor total: <b className="text-slate-900">{formatUsd(s.landValue + s.buildValue)}</b></p>
            <p className={`num mt-2 text-xl font-semibold ${totalG.neg ? 'text-red-600' : 'text-emerald-700'}`}>{totalG.value}</p>
            <p className="mt-1 text-xs text-slate-500">{totalG.label} {totalG.pct && `· ${totalG.pct}`}</p>
            {s.landValueSet ? <p className="mt-2 text-xs text-slate-500">Estimado el {dmy(property.valueDate ?? todayKey())}.</p> : <p className="mt-2 text-xs text-slate-500">Sin valor propio del terreno: se usa lo que costó.</p>}
          </div>
        </div>
      </form>
      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        El costo del terreno incluye todo lo que pagarás por él ({formatUsd(s.landCost)}), también lo que aún falta ({formatUsd(s.toPay)}). Si lo vendieras hoy por esos valores, después de pagar lo pendiente te quedarían {formatUsd(totalValue - s.toPay)} antes de impuestos y gastos de venta.
      </p>
    </Card>
  )
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="num font-medium">{v}</dd>
    </div>
  )
}

// ---------- Registrar un pago o gasto del terreno ----------

function PropertyExpenseModal({ property, categories, expense, onClose }: { property: Property; categories: Category[]; expense?: Expense; onClose: () => void }) {
  const add = useAddExpense()
  const update = useUpdateExpense()
  const settings = useSettings()
  const editing = !!expense
  const [kind, setKind] = useState<PropertyKind>(expense?.propertyKind ?? 'cuota')
  const [amountText, setAmountText] = useState(expense ? formatInput(usdOf(expense)) : formatInput(effectivePayment(property)))
  const [date, setDate] = useState(expense?.date ?? todayKey())
  const [method, setMethod] = useState<PaymentMethod>(expense?.method ?? 'transferencia')
  const [description, setDescription] = useState(expense && expense.description !== PROPERTY_KIND_LABELS[expense.propertyKind ?? 'otros'] ? expense.description : '')
  // Al editar, los euros ya guardados (o su estimación) se muestran y se pueden corregir.
  const initialEur = expense ? eurOf(expense, property.eurRate ?? 0) : null
  const [eurText, setEurText] = useState(initialEur !== null ? formatInput(initialEur) : '')
  const [eurEdited, setEurEdited] = useState(editing)
  // Los pagos históricos (de antes de usar la app) se ven en la ficha pero no cuentan en tu presupuesto.
  const [counts, setCounts] = useState(!expense?.outsideBudget)
  const [submitted, setSubmitted] = useState(false)

  // `amount` son los dólares pagados; `eur`, los euros que salieron de tu cuenta (lo que cuenta en tu presupuesto).
  const amount = parseMoney(amountText)
  const rate = property.eurRate ?? 0
  const eurAuto = amount !== null && amount > 0 && rate > 0 ? Math.round(amount / rate) : null
  const eur = eurEdited ? (eurText.trim() ? parseMoney(eurText) : null) : eurAuto
  const categoryId = categoryForKind(property, kind)
  const categoryName = categoryId ? categoryLabel(categories, categoryId) : null
  const errors = {
    amount: amount === null || amount <= 0 ? 'Escribe un monto mayor que cero.' : null,
    eur: eur === null || eur <= 0 ? 'Escribe cuántos euros salieron de tu cuenta.' : null,
    date: isValidDateKey(date) ? null : 'La fecha no es válida.',
  }

  function changeKind(k: PropertyKind) {
    setKind(k)
    // Para una cuota proponemos el monto de la cuota; para lo demás, el campo queda libre.
    setAmountText(k === 'cuota' ? formatInput(effectivePayment(property)) : '')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (errors.amount || errors.eur || errors.date || amount === null || eur === null) return
    try {
      const data: Expense = {
        id: expense?.id ?? newId(),
        date,
        categoryId: expense ? (expense.propertyKind === kind ? expense.categoryId : categoryId) : categoryId,
        amount: eur,
        amountUsd: amount,
        description: description.trim() || PROPERTY_KIND_LABELS[kind],
        method,
        chargeDate: computeChargeDate(date, method, settings.data?.cardPayDay ?? 15),
        propertyId: property.id,
        propertyKind: kind,
        // true = fuera del presupuesto; false solo al volver a incluir uno que estaba fuera; sin cambios no se envía.
        outsideBudget: counts ? (expense?.outsideBudget ? false : undefined) : true,
      }
      if (expense) await update.mutateAsync(data)
      else await add.mutateAsync(data)
      toast.success(expense ? 'Pago actualizado' : 'Guardado en la ficha y en tus gastos')
      onClose()
    } catch (err) {
      toast.error(`No pudimos guardarlo. ${err instanceof Error ? err.message : ''}`)
    }
  }

  return (
    <Modal title={editing ? 'Editar pago del terreno' : 'Registrar pago o gasto del terreno'} description="Se guarda en dólares en la ficha, y en euros como gasto del mes." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="¿Qué es?">
          <select className="w-full" value={kind} onChange={(e) => changeKind(e.target.value as PropertyKind)}>
            {PROPERTY_KINDS.map((k) => <option key={k} value={k}>{PROPERTY_KIND_LABELS[k]}</option>)}
          </select>
        </Field>
        <Field label="Monto pagado en dólares" error={submitted ? errors.amount : null}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <input className="w-full pl-8" inputMode="decimal" placeholder="0,00" value={amountText} onChange={(e) => setAmountText(e.target.value)} autoFocus />
          </div>
        </Field>
        <Field
          label="Euros que salieron de tu cuenta"
          error={submitted ? errors.eur : null}
          hint={rate > 0 && !eurEdited ? `Calculado con 1 € = ${String(rate).replace('.', ',')} $. Cámbialo si pagaste otra cantidad.` : 'Es lo que cuenta en tu presupuesto y en Gastos. Mira el cargo en tu banco.'}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
            <input
              className="w-full pl-8"
              inputMode="decimal"
              placeholder="0,00"
              value={eurEdited ? eurText : eurAuto !== null ? formatInput(eurAuto) : ''}
              onChange={(e) => {
                setEurEdited(true)
                setEurText(e.target.value)
              }}
            />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" error={submitted ? errors.date : null}><input type="date" className="w-full" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Método de pago">
            <select className="w-full" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
            </select>
          </Field>
        </div>
        {kind === 'cuota' ? null : (
          <Field label="Descripción (opcional)"><textarea className="w-full" rows={2} maxLength={120} placeholder="Ej. 20 bloques de cemento" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={counts} onChange={(e) => setCounts(e.target.checked)} />
          <span>
            Cuenta como gasto en mi presupuesto
            <span className="block text-xs text-slate-500">Desmárcalo si es un pago de antes de usar la app: se queda en la ficha pero no suma en Gastos, el Panel ni Reportes.</span>
          </span>
        </label>
        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          {categoryName ?<>Se registra como gasto en <b>{categoryName}</b>.</> : <>Se registra como gasto sin categoría. Puedes elegir una en «Editar ficha».</>}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={add.isPending || update.isPending}>{add.isPending || update.isPending ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
