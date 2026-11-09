import { useMemo, useState } from 'react'
import { Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Card, Empty, ErrorBox, Field, PageHeader, Spinner, Stat } from '@/components/ui'
import { CategoryOptions } from '@/components/CategoryOptions'
import { formatDateEs } from '@/components/MonthContext'
import { fetchEtfQuotes, useCategories, useEtf, useEtfContributions, useEtfQuotes, useSaveEtf } from '@/data/hooks'
import { categoryLabel, todayKey } from '@/domain/calc'
import { summarizeEtf } from '@/domain/etf'
import { formatInput, formatMoney, parseMoney } from '@/domain/money'
import type { EtfConfig } from '@/domain/types'

const num = (v: number, d: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v)
const pct = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${num(v, 2)} %`)
const tone = (v: number) => (v < 0 ? 'text-red-600' : 'text-emerald-700')

export default function Etf() {
  const etf = useEtf()
  const categories = useCategories()
  const [editing, setEditing] = useState(false)
  if (etf.isLoading || categories.isLoading) return <Spinner />
  if (etf.error || categories.error || !categories.data) return <ErrorBox error={etf.error ?? categories.error} onRetry={() => { etf.refetch(); categories.refetch() }} />
  if (!etf.data || editing) return <EtfForm current={etf.data ?? null} onDone={() => setEditing(false)} />
  return <EtfDetail config={etf.data} onEdit={() => setEditing(true)} />
}

function EtfForm({ current, onDone }: { current: EtfConfig | null; onDone: () => void }) {
  const categories = useCategories().data ?? []
  const save = useSaveEtf()
  const guess = categories.find((c) => /etf|pac/i.test(c.name))?.id ?? ''
  const [isin, setIsin] = useState(current?.isin ?? '')
  const [ticker, setTicker] = useState(current?.ticker ?? '')
  const [categoryId, setCategoryId] = useState(current?.categoryId ?? guess)
  const [since, setSince] = useState(current?.since ?? todayKey())
  const [sharesText, setSharesText] = useState(current?.base ? String(current.base.shares).replace('.', ',') : '')
  const [investedText, setInvestedText] = useState(current?.base ? formatInput(current.base.invested) : '')
  const [asOf, setAsOf] = useState(current?.base?.asOf ?? todayKey())
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryId) return toast.error('Elige la categoría donde registras tus aportaciones.')
    // Ajuste con el broker: participaciones y aportado van juntos (o ninguno).
    let base: EtfConfig['base'] = null
    if (sharesText.trim() || investedText.trim()) {
      const shares = Number(sharesText.trim().replace(/\./g, '').replace(',', '.'))
      const invested = parseMoney(investedText)
      if (!Number.isFinite(shares) || shares <= 0 || invested === null || invested <= 0) {
        return toast.error('Para ajustar con tu broker escribe las participaciones y lo aportado (los dos, mayores que cero).')
      }
      base = { asOf, shares, invested }
    }
    setBusy(true)
    try {
      // Comprueba que el ISIN existe y trae el ticker y el nombre.
      const q = await fetchEtfQuotes(isin.trim().toUpperCase(), since, ticker.trim().toUpperCase() || undefined)
      await save.mutateAsync({ isin: q.isin, ticker: q.ticker, name: q.name, categoryId, since, base })
      toast.success('ETF guardado')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pudimos guardar el ETF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="ETF" title="Rentabilidad de tu ETF" subtitle="Con tu ISIN y las aportaciones que registras en una categoría, calculo cuánto llevas aportado, cuánto vale hoy y tu rentabilidad." />
      <Card className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <Field label="ISIN">
            <input className="w-full uppercase" value={isin} onChange={(e) => setIsin(e.target.value)} placeholder="IE0003XJA0J9" maxLength={12} required />
          </Field>
          <Field label="Categoría de tus aportaciones" hint="Se cuentan los gastos de esa categoría (y sus subcategorías) como compras del ETF.">
            <select className="w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="">Elige una categoría</option>
              <CategoryOptions categories={categories} />
            </select>
          </Field>
          <Field label="Contar aportaciones desde">
            <input type="date" className="w-full" value={since} onChange={(e) => setSince(e.target.value)} required />
          </Field>
          <Field label="Ticker (opcional)" hint="Si lo dejas vacío lo busco con el ISIN. Escríbelo si quieres otra bolsa, por ejemplo WEBN.MI.">
            <input className="w-full uppercase" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="WEBN.DE" maxLength={15} />
          </Field>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="mb-1 text-sm font-medium text-slate-800">Ajustar con mi broker (opcional)</p>
            <p className="mb-3 text-xs text-slate-500">Copia de tu broker las participaciones y lo aportado. La app parte de esa posición real y solo estima las aportaciones posteriores a esa fecha.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Participaciones">
                <input className="w-full" inputMode="decimal" value={sharesText} onChange={(e) => setSharesText(e.target.value)} placeholder="16,56634" />
              </Field>
              <Field label="Aportado (€)">
                <input className="w-full" inputMode="decimal" value={investedText} onChange={(e) => setInvestedText(e.target.value)} placeholder="222,25" />
              </Field>
              <Field label="A fecha de">
                <input type="date" className="w-full" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {current && <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>}
            <Button type="submit" disabled={busy}>{busy ? 'Comprobando…' : 'Guardar y calcular'}</Button>
          </div>
        </form>
      </Card>
    </>
  )
}

function EtfDetail({ config, onEdit }: { config: EtfConfig; onEdit: () => void }) {
  const categories = useCategories().data ?? []
  const [fresh, setFresh] = useState(0)
  const quotes = useEtfQuotes(config, fresh)
  const contributions = useEtfContributions(config)
  const save = useSaveEtf()
  const qc = useQueryClient()

  const summary = useMemo(() => {
    if (!quotes.data || !contributions.data) return null
    return summarizeEtf(contributions.data.map((e) => ({ id: e.id, date: e.date, amount: e.amount })), quotes.data.history, quotes.data.price, config.base)
  }, [quotes.data, contributions.data, config.base])

  /** Vuelve a pedir los precios (saltando la caché) y a leer tus aportaciones. */
  function refresh() {
    setFresh(Date.now())
    qc.invalidateQueries({ queryKey: ['etfContributions'] })
    toast.success('Actualizando precios y aportaciones…')
  }

  async function remove() {
    if (!window.confirm('¿Dejar de seguir este ETF? Tus gastos no se tocan.')) return
    try {
      await save.mutateAsync(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No pudimos quitar el ETF.')
    }
  }

  const header = (
    <PageHeader
      eyebrow="ETF"
      title={quotes.data?.name ?? config.name}
      subtitle={`${config.isin} · ${config.ticker}${quotes.data ? ` · ${quotes.data.exchange}` : ''} · aportaciones de ${categoryLabel(categories, config.categoryId)} desde ${formatDateEs(config.since)}`}
      action={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={refresh} disabled={quotes.isFetching}><RefreshCw className={`h-4 w-4 ${quotes.isFetching ? 'animate-spin' : ''}`} /> {quotes.isFetching ? 'Actualizando…' : 'Actualizar'}</Button>
          <Button variant="secondary" onClick={onEdit}><Pencil className="h-4 w-4" /> {config.base ? 'Editar' : 'Ajustar con mi broker'}</Button>
          <Button variant="secondary" onClick={remove} aria-label="Dejar de seguir este ETF"><Trash2 className="h-4 w-4" /></Button>
        </div>
      }
    />
  )

  if (quotes.isLoading || contributions.isLoading) return (<>{header}<Spinner label="Trayendo los precios…" /></>)
  if (quotes.error || contributions.error || !quotes.data) {
    return (<>{header}<ErrorBox error={quotes.error ?? contributions.error} onRetry={() => { quotes.refetch(); contributions.refetch() }} /></>)
  }
  if (!summary || summary.rows.length === 0) {
    return (
      <>
        {header}
        <Empty title="Aún no hay aportaciones">
          <p className="max-w-md text-sm text-slate-500">Registra tus compras del ETF como gastos en la categoría elegida y aparecerán aquí.</p>
        </Empty>
      </>
    )
  }

  const q = quotes.data
  return (
    <>
      {header}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Aportado" value={formatMoney(summary.invested)} hint={config.base ? 'Tu broker y lo posterior' : `${summary.rows.length} aportaciones`} />
        <Stat label="Valor hoy" value={formatMoney(summary.value)} hint={`${num(summary.units, 5)} participaciones`} />
        <Stat highlight label="Ganancia" value={<span className={summary.gain < 0 ? 'text-red-300' : ''}>{formatMoney(summary.gain)}</span>} hint={<span className="text-lg font-semibold">{pct(summary.gainPct)}</span>} />
        <Stat
          label="Precio actual"
          value={`${num(q.price, 3)} ${q.currency === 'EUR' ? '€' : q.currency}`}
          hint={
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${q.marketOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden />
              {q.marketOpen ? `Mercado abierto · ${q.priceTime ? new Date(q.priceTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : q.exchange}` : `Mercado cerrado · cierre del ${formatDateEs(q.priceDate)}`}
            </span>
          }
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 text-right font-medium">Aportado</th>
                <th className="px-4 py-3 text-right font-medium">Precio</th>
                <th className="px-4 py-3 text-right font-medium">Participaciones</th>
                <th className="px-4 py-3 text-right font-medium">Valor hoy</th>
                <th className="px-4 py-3 text-right font-medium">Ganancia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {summary.rows.map((r) => (
                <tr key={r.id}>
                  <td className="num whitespace-nowrap px-4 py-3 text-slate-600">{r.isBase ? `Tu broker, ${formatDateEs(r.date)}` : formatDateEs(r.date)}</td>
                  <td className="num px-4 py-3 text-right">{formatMoney(r.amount)}</td>
                  <td className="num px-4 py-3 text-right text-slate-600" title={r.isBase ? 'Precio medio de compra' : `Cierre del ${formatDateEs(r.priceDate)}`}>{num(r.price, 3)}</td>
                  <td className="num px-4 py-3 text-right text-slate-600">{num(r.units, 5)}</td>
                  <td className="num px-4 py-3 text-right">{formatMoney(r.value)}</td>
                  <td className={`num px-4 py-3 text-right font-medium ${tone(r.gain)}`}>{formatMoney(r.gain)} <span className="text-xs">({pct(r.gainPct)})</span></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                <td className="px-4 py-3 text-xs uppercase tracking-wider text-slate-500">Total</td>
                <td className="num px-4 py-3 text-right">{formatMoney(summary.invested)}</td>
                <td />
                <td className="num px-4 py-3 text-right">{num(summary.units, 5)}</td>
                <td className="num px-4 py-3 text-right">{formatMoney(summary.value)}</td>
                <td className={`num px-4 py-3 text-right ${tone(summary.gain)}`}>{formatMoney(summary.gain)} <span className="text-xs">({pct(summary.gainPct)})</span></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <p className="mt-4 text-xs text-slate-500">Estimación con el cierre diario de Yahoo Finance: no incluye comisiones ni impuestos y puede diferir de tu broker.</p>
    </>
  )
}
