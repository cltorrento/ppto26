import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, LogOut, Sparkles, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Button, Card, ErrorBox, Field, PageHeader, Spinner } from '@/components/ui'
import { formatDateEs, useMonth } from '@/components/MonthContext'
import { listCreditExpensesFrom, useSaveSettings, useSettings } from '@/data/hooks'
import { loadDemoData } from '@/data/demo'
import { clearLocalData } from '@/data/localRepository'
import { computeChargeDate, todayKey } from '@/domain/calc'
import { formatInput, parseMoney } from '@/domain/money'
import type { Settings } from '@/domain/types'

export default function Ajustes() {
  const settings = useSettings()
  if (settings.isLoading) return <Spinner />
  if (settings.error || !settings.data) return <ErrorBox error={settings.error} onRetry={() => settings.refetch()} />
  return <Form settings={settings.data} />
}

function Form({ settings }: { settings: Settings }) {
  const auth = useAuth()
  const { month } = useMonth()
  const qc = useQueryClient()
  const save = useSaveSettings()
  const [dayText, setDayText] = useState(String(settings.cardPayDay))
  const [incomeText, setIncomeText] = useState(settings.referenceIncome ? formatInput(settings.referenceIncome) : '')

  const day = Number(dayText)
  const dayValid = Number.isInteger(day) && day >= 1 && day <= 28
  const income = incomeText.trim() ? parseMoney(incomeText) : 0
  const incomeValid = income !== null
  const example = dayValid ? formatDateEs(computeChargeDate(`${month}-01`, 'credito', day)) : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!dayValid) return toast.error('Elige un día entre 1 y 28 para el pago de la tarjeta.')
    if (!incomeValid) return toast.error('El ingreso de referencia no es un importe válido.')
    try {
      // Al cambiar el día solo se recalculan las compras de hoy en adelante; los meses cerrados se conservan.
      let recalc: { id: string; chargeDate: string }[] | undefined
      if (day !== settings.cardPayDay) {
        const credit = await listCreditExpensesFrom(todayKey())
        recalc = credit.map((x) => ({ id: x.id, chargeDate: computeChargeDate(x.date, 'credito', day) }))
      }
      await save.mutateAsync({ settings: { cardPayDay: day, referenceIncome: income! }, recalc })
      toast.success('Ajustes guardados')
    } catch (err) {
      toast.error(`No pudimos guardar tus ajustes. ${err instanceof Error ? err.message : ''}`)
    }
  }

  function exportData() {
    const raw = localStorage.getItem('mipresupuesto:v1')
    if (!raw) return toast.error('Todavía no hay datos que exportar.')
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `mipresupuesto-${todayKey()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader eyebrow="Ajustes" title="Tarjeta y planificación" subtitle="Define cuándo se cobra tu tarjeta de crédito y el ingreso que usamos como referencia para el plan anual." />
      <form onSubmit={submit} className="max-w-2xl space-y-6" noValidate>
        <Card>
          <h2 className="font-semibold">Tarjeta de crédito</h2>
          <p className="mb-4 text-xs text-slate-500">Las compras con tarjeta se cobran el día indicado del mes siguiente al de la compra.</p>
          <Field label="Día de pago de la tarjeta" hint={example ? `Entre 1 y 28 para que exista en todos los meses. Ahora mismo, una compra de principios de este mes se cobraría el ${example}.` : 'Entre 1 y 28.'} error={dayValid ? null : 'Elige un día entre 1 y 28.'}>
            <input type="number" min={1} max={28} className="w-28" value={dayText} onChange={(e) => setDayText(e.target.value)} />
          </Field>
          <p className="mt-3 text-xs text-slate-500">Al cambiar el día solo recalculamos los cargos de compras hechas desde hoy. Los cargos de compras anteriores se conservan para no alterar meses ya cerrados.</p>
        </Card>

        <Card>
          <h2 className="font-semibold">Ingreso de referencia</h2>
          <p className="mb-4 text-xs text-slate-500">Se usa en el plan anual para los meses que todavía no tienen presupuesto definido.</p>
          <Field label="Ingreso mensual de referencia" hint="Sin ingreso de referencia, el plan anual solo calculará el margen de los meses con presupuesto." error={incomeValid ? null : 'Escribe un importe válido.'}>
            <div className="relative w-48">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
              <input className="w-full pl-8" inputMode="decimal" placeholder="0,00" value={incomeText} onChange={(e) => setIncomeText(e.target.value)} />
            </div>
          </Field>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar ajustes'}</Button>
          <Link to="/plan-anual" className="text-sm font-medium text-brand-600 hover:underline">Ver plan anual</Link>
        </div>
      </form>

      <h2 className="mb-3 mt-10 text-lg font-semibold">Tus datos</h2>
      <Card className="max-w-2xl">
        {auth.mode === 'local' ? (
          <div className="space-y-4 text-sm">
            <p className="text-slate-600">Estás en <b>modo local</b>: tus datos se guardan solo en este navegador y no salen de tu equipo. Si borras los datos del navegador, se pierden: exporta una copia de vez en cuando.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={exportData}><Download className="h-4 w-4" /> Exportar copia (JSON)</Button>
              <Button type="button" variant="secondary" onClick={async () => { await loadDemoData(); await qc.invalidateQueries(); toast.success('Datos de ejemplo cargados en el mes actual') }}><Sparkles className="h-4 w-4" /> Cargar datos de ejemplo</Button>
              <Button type="button" variant="danger" onClick={() => { if (window.confirm('¿Borrar todos tus datos de este navegador? No se puede deshacer.')) { clearLocalData(); qc.clear(); window.location.assign('/panel') } }}><Trash2 className="h-4 w-4" /> Borrar todos mis datos</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <p className="text-slate-600">Sesión iniciada como <b>{auth.email}</b>. Tus datos están asociados a tu cuenta y solo tú puedes consultarlos.</p>
            <Button type="button" variant="secondary" onClick={() => auth.signOut()}><LogOut className="h-4 w-4" /> Cerrar sesión</Button>
          </div>
        )}
      </Card>
    </>
  )
}
