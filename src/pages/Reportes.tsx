import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, Empty, ErrorBox, PageHeader, Spinner, Stat } from '@/components/ui'
import { HBarChart, IncomeExpenseChart } from '@/components/charts'
import { capitalize, monthName } from '@/components/MonthContext'
import { useCategories, useYearBudgets, useYearExpenses } from '@/data/hooks'
import { monthOf, rootIdOf, todayKey, yearSummary } from '@/domain/calc'
import { formatInput, formatMoney } from '@/domain/money'
import { METHOD_LABELS, type Cents, type Category, type Expense } from '@/domain/types'

const short = (month: string) => capitalize(monthName(month).slice(0, 3))

export default function Reportes() {
  const [year, setYear] = useState(() => Number(monthOf(todayKey()).slice(0, 4)))
  const budgets = useYearBudgets(year)
  const expenses = useYearExpenses(year)
  const categories = useCategories()

  const summary = useMemo(
    () =>
      budgets.data && expenses.data && categories.data
        ? yearSummary({ year, plans: budgets.data.plans, expenses: expenses.data, categories: categories.data })
        : null,
    [year, budgets.data, expenses.data, categories.data],
  )

  const header = (
    <PageHeader
      eyebrow="Reportes y exportación"
      title={`Resumen de ${year}`}
      subtitle="Ingresos, gastos y ahorro neto mes a mes, con el gasto medio por categoría. Los promedios se calculan sobre los meses con datos."
      action={
        <div className="flex items-center rounded-full border border-slate-200 bg-white">
          <button onClick={() => setYear(year - 1)} aria-label="Año anterior" className="rounded-full p-3 hover:bg-slate-100 md:p-2"><ChevronLeft className="h-4 w-4" /></button>
          <span className="num min-w-16 text-center text-sm font-semibold">{year}</span>
          <button onClick={() => setYear(year + 1)} aria-label="Año siguiente" className="rounded-full p-3 hover:bg-slate-100 md:p-2"><ChevronRight className="h-4 w-4" /></button>
        </div>
      }
    />
  )

  const loading = budgets.isLoading || expenses.isLoading || categories.isLoading
  const error = budgets.error ?? expenses.error ?? categories.error
  if (loading) return (<>{header}<Spinner label="Calculando el resumen…" /></>)
  if (error || !summary || !expenses.data || !categories.data) {
    return (<>{header}<ErrorBox error={error} onRetry={() => [budgets, expenses, categories].forEach((q) => q.refetch())} /></>)
  }

  if (summary.monthsWithData === 0) {
    return (
      <>
        {header}
        <Empty title={`Todavía no hay datos en ${year}`}>
          <p className="max-w-md text-sm text-slate-500">Configura el presupuesto de un mes y registra gastos: el resumen y los gráficos aparecerán aquí.</p>
        </Empty>
      </>
    )
  }

  const { months, totals, averages, byCategory } = summary
  const lastBalance = [...months].reverse().find((m) => m.balance !== null)?.balance ?? 0

  return (
    <>
      {header}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Ahorro neto del año" value={<span className={totals.net < 0 ? 'text-red-300' : ''}>{formatMoney(totals.net)}</span>} hint={`${formatMoney(averages.net)} de media al mes`} highlight />
        <Stat label="Gasto medio mensual" value={formatMoney(averages.spent)} hint={`Sobre ${summary.monthsWithData} ${summary.monthsWithData === 1 ? 'mes' : 'meses'} con datos`} />
        <Stat label="Saldo acumulado" value={formatMoney(lastBalance)} hint="Suma del ahorro neto de cada mes" />
      </div>

      <Card className="mb-6 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div>
            <h2 className="font-semibold">Resumen</h2>
            <p className="text-xs text-slate-500">Ahorro neto = ingresos − gastos. Saldo final = ahorro neto acumulado.</p>
          </div>
          <Button variant="secondary" onClick={() => exportCsv(year, expenses.data, categories.data)}>
            <Download className="h-4 w-4" /> Exportar movimientos (CSV)
          </Button>
        </div>
        <p className="px-5 pb-2 text-xs text-slate-500 md:hidden">Desliza horizontalmente para ver los 12 meses. La primera columna queda fija.</p>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 text-xs text-slate-500">
                <th scope="col" className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium"><span className="sr-only">Concepto</span></th>
                {months.map((m) => (
                  <th key={m.month} scope="col" className="px-2 py-2 text-right font-medium">{short(m.month)} <span className="text-slate-400">&apos;{m.month.slice(2, 4)}</span></th>
                ))}
                <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">Total</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-700">Promedio</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Ingresos" cells={months.map((m) => (m.hasData ? m.income : null))} total={totals.income} avg={averages.income} tone="text-emerald-700" />
              <Row label="Gastos" cells={months.map((m) => (m.hasData ? m.spent : null))} total={totals.spent} avg={averages.spent} tone="text-brand-700" />
              <Row label="Ahorro neto" cells={months.map((m) => (m.hasData ? m.net : null))} total={totals.net} avg={averages.net} signed bold />
              <Row label="Saldo final" cells={months.map((m) => m.balance)} total={null} avg={null} signed bold highlight />
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Gasto promedio por categoría</h2>
          <p className="mb-4 text-xs text-slate-500">Media mensual sobre los meses con datos, de mayor a menor.</p>
          {byCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Aún no hay gastos registrados en {year}.</p>
          ) : (
            <HBarChart ariaLabel="Gasto promedio mensual por categoría" items={byCategory.map((c) => ({ label: c.name, value: c.average, children: c.children?.map((k) => ({ label: k.name, value: k.average })) }))} />
          )}
        </Card>
        <Card>
          <h2 className="font-semibold">Ingresos y gastos por mes</h2>
          <p className="mb-4 text-xs text-slate-500">Comparativa mes a mes de {year}.</p>
          <IncomeExpenseChart rows={months.map((m) => ({ label: short(m.month), income: m.income, spent: m.spent, hasData: m.hasData }))} />
        </Card>
      </div>
    </>
  )
}

function Row({ label, cells, total, avg, tone = '', signed = false, bold = false, highlight = false }: {
  label: string
  cells: (Cents | null)[]
  total: Cents | null
  avg: Cents | null
  tone?: string
  signed?: boolean
  bold?: boolean
  highlight?: boolean
}) {
  const color = (v: Cents) => (signed ? (v < 0 ? 'text-red-600' : 'text-slate-900') : tone)
  const cell = (v: Cents | null) => (v === null ? <span className="text-slate-300">–</span> : <span className={color(v)}>{formatMoney(v)}</span>)
  return (
    <tr className={`border-b border-slate-50 ${highlight ? 'bg-amber-50' : ''} ${bold ? 'font-semibold' : ''}`}>
      <th scope="row" className={`sticky left-0 z-10 whitespace-nowrap px-4 py-2.5 text-left font-medium ${highlight ? 'bg-amber-50' : 'bg-white'}`}>{label}</th>
      {cells.map((v, i) => (
        <td key={i} className="num whitespace-nowrap px-2 py-2.5 text-right">{cell(v)}</td>
      ))}
      <td className="num whitespace-nowrap px-3 py-2.5 text-right">{cell(total)}</td>
      <td className="num whitespace-nowrap px-3 py-2.5 text-right text-slate-500">{cell(avg)}</td>
    </tr>
  )
}

/** Descarga los gastos del año como CSV (separador «;» y coma decimal, para abrirlo directamente en Excel). */
function exportCsv(year: number, expenses: Expense[], categories: Category[]) {
  if (expenses.length === 0) return toast.error(`No hay gastos en ${year} que exportar.`)
  const name = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Sin categoría'
  // Categoría = la de primer nivel; subcategoría = la hija (vacío si el gasto está en la categoría).
  const root = (id: string | null) => (id ? name(rootIdOf(categories, id)) : 'Sin categoría')
  const sub = (id: string | null) => (id && rootIdOf(categories, id) !== id ? name(id) : '')
  const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const rows = [...expenses]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((e) => [e.date, e.description, root(e.categoryId), sub(e.categoryId), METHOD_LABELS[e.method], e.chargeDate, formatInput(e.amount)].map(esc).join(';'))
  const csv = ['Fecha;Descripción;Categoría;Subcategoría;Método;Fecha de cobro;Importe (EUR)', ...rows].join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `mipresupuesto-gastos-${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`${expenses.length} movimientos exportados`)
}
