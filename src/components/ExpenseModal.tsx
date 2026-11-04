import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Modal, Field, Button } from '@/components/ui'
import { CategoryIcon } from '@/components/CategoryIcon'
import { CategoryOptions } from '@/components/CategoryOptions'
import { formatDateEs } from '@/components/MonthContext'
import { useAddExpense, useCategories, useSettings } from '@/data/hooks'
import { newId } from '@/data/repository'
import { computeChargeDate, isValidDateKey, rootIdOf, todayKey, topLevel } from '@/domain/calc'
import { parseMoney } from '@/domain/money'
import { METHOD_LABELS, type PaymentMethod } from '@/domain/types'

export function ExpenseModal({ defaultDate, defaultCategoryId, onClose }: { defaultDate?: string; defaultCategoryId?: string; onClose: () => void }) {
  const categories = useCategories()
  const settings = useSettings()
  const add = useAddExpense()

  const [amountText, setAmountText] = useState('')
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? '')
  const [date, setDate] = useState(defaultDate ?? todayKey())
  const [method, setMethod] = useState<PaymentMethod>('debito')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const cats = categories.data ?? []
  const effectiveCategory = categoryId || topLevel(cats)[0]?.id || ''
  const amount = parseMoney(amountText)
  const payDay = settings.data?.cardPayDay ?? 15

  const errors = {
    amount: amount === null || amount <= 0 ? 'Escribe un monto mayor que cero.' : null,
    category: effectiveCategory ? null : 'Elige una categoría.',
    date: isValidDateKey(date) ? null : 'La fecha no es válida.',
  }
  const hasErrors = Object.values(errors).some(Boolean)

  const chargeInfo = useMemo(() => {
    if (!isValidDateKey(date)) return null
    const charge = computeChargeDate(date, method, payDay)
    return charge === date
      ? `Con ${METHOD_LABELS[method].toLowerCase()} el cargo sale el ${formatDateEs(charge)}, el mismo día de la compra.`
      : `Con tarjeta de crédito el cargo sale el ${formatDateEs(charge)}, el día ${payDay} del mes siguiente.`
  }, [date, method, payDay])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (hasErrors || amount === null) return
    try {
      await add.mutateAsync({
        id: newId(),
        date,
        categoryId: effectiveCategory,
        amount,
        description: description.trim(),
        method,
        chargeDate: computeChargeDate(date, method, payDay),
      })
      toast.success('Gasto guardado')
      onClose()
    } catch (err) {
      toast.error(`No pudimos guardar el gasto. ${err instanceof Error ? err.message : ''}`)
    }
  }

  const selected = cats.find((c) => c.id === rootIdOf(cats, effectiveCategory))

  return (
    <Modal title="Registrar gasto" description="Se guarda en tu mes y actualiza el progreso de la categoría al instante." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Monto" error={submitted ? errors.amount : null}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
            <input className="w-full pl-8" inputMode="decimal" placeholder="0,00" value={amountText} onChange={(e) => setAmountText(e.target.value)} autoFocus />
          </div>
        </Field>
        <Field label="Categoría" error={submitted ? errors.category : null}>
          <div className="flex items-center gap-2">
            {selected && <CategoryIcon icon={selected.icon} group={selected.group} />}
            <select className="w-full" value={effectiveCategory} onChange={(e) => setCategoryId(e.target.value)}>
              <CategoryOptions categories={cats} />
            </select>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" error={submitted ? errors.date : null}>
            <input type="date" className="w-full" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Método de pago">
            <select className="w-full" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {chargeInfo && <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">{chargeInfo}</p>}
        <Field label="Descripción (opcional)">
          <textarea className="w-full" rows={2} placeholder="Ej. Compra semanal en el supermercado" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={add.isPending}>
            {add.isPending ? 'Guardando…' : 'Guardar gasto'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
