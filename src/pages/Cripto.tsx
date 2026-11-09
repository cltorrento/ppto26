import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Minus, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, ErrorBox, Field, PageHeader, Spinner, Stat } from '@/components/ui'
import { CategoryOptions } from '@/components/CategoryOptions'
import { formatDateEs } from '@/components/MonthContext'
import { fetchCryptoData, type CryptoData, useCategories, useCrypto, useCryptoContributions, useCryptoData, useSaveCrypto, MONITOR_COINS } from '@/data/hooks'
import { categoryLabel, todayKey } from '@/domain/calc'
import { summarizeEtf, type EtfSummary } from '@/domain/etf'
import { changePct, rangeStats, rangeZone, trendOf, volatilityLevel, volatilityPct } from '@/domain/cryptoStats'
import { formatInput, formatMoney, parseMoney } from '@/domain/money'
import { newId } from '@/data/repository'
import type { CryptoPosition } from '@/domain/types'

const num = (v: number, d: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v)
const pct = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${num(v, 2)} %`)
const tone = (v: number) => (v < 0 ? 'text-red-600' : 'text-emerald-700')
const eur = (v: number) => `${num(v, v < 10 ? 4 : 2)} €`

const COINS = [
  { id: 'bitcoin', label: 'Bitcoin (BTC)' },
  { id: 'ethereum', label: 'Ethereum (ETH)' },
  { id: 'solana', label: 'Solana (SOL)' },
  { id: 'binancecoin', label: 'BNB' },
  { id: 'ripple', label: 'XRP' },
  { id: 'cardano', label: 'Cardano (ADA)' },
]
const FNG_LABEL: Record<string, string> = { 'Extreme Fear': 'Miedo extremo', Fear: 'Miedo', Neutral: 'Neutral', Greed: 'Codicia', 'Extreme Greed': 'Codicia extrema' }

export default function Cripto() {
  const crypto = useCrypto()
  const categories = useCategories()
  const [editing, setEditing] = useState<CryptoPosition | 'new' | null>(null)
  if (crypto.isLoading || categories.isLoading) return <Spinner />
  if (crypto.error || categories.error || !categories.data) return <ErrorBox error={crypto.error ?? categories.error} onRetry={() => { crypto.refetch(); categories.refetch() }} />
  const list = crypto.data ?? []
  if (editing) return <PositionForm list={list} current={editing && editing !== 'new' ? editing : null} onDone={() => setEditing(null)} />
  return <Overview list={list} onAdd={() => setEditing('new')} onEdit={(p) => setEditing(p)} />
}

function PositionForm({ list, current, onDone }: { list: CryptoPosition[]; current: CryptoPosition | null; onDone: () => void }) {
  const categories = useCategories().data ?? []
  const save = useSaveCrypto()
  const known = COINS.some((c) => c.id === current?.coinId)
  const [coin, setCoin] = useState(current ? (known ? current.coinId : 'otra') : 'bitcoin')
  const [custom, setCustom] = useState(current && !known ? current.coinId : '')
  const [categoryId, setCategoryId] = useState(current?.categoryId ?? categories.find((c) => /btc|bitcoin|cripto/i.test(c.name))?.id ?? '')
  const [since, setSince] = useState(current?.since ?? todayKey())
  const [sharesText, setSharesText] = useState(current?.base ? String(current.base.shares).replace('.', ',') : '')
  const [investedText, setInvestedText] = useState(current?.base ? formatInput(current.base.invested) : '')
  const [asOf, setAsOf] = useState(current?.base?.asOf ?? todayKey())
  const [targetText, setTargetText] = useState(current?.targetPct != null ? String(current.targetPct).replace('.', ',') : '')
  const [buyText, setBuyText] = useState(current?.buyLevel != null ? String(current.buyLevel).replace('.', ',') : '')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryId) return toast.error('Elige la categoría donde registras tus aportaciones.')
    const coinId = (coin === 'otra' ? custom : coin).trim().toLowerCase()
    if (!coinId) return toast.error('Escribe el identificador de CoinGecko de la criptomoneda.')
    let base: CryptoPosition['base'] = null
    if (sharesText.trim() || investedText.trim()) {
      const shares = Number(sharesText.trim().replace(/\./g, '').replace(',', '.'))
      const invested = parseMoney(investedText)
      if (!Number.isFinite(shares) || shares <= 0 || invested === null || invested <= 0) {
        return toast.error('Para ajustar escribe la cantidad y lo aportado (los dos, mayores que cero).')
      }
      base = { asOf, shares, invested }
    }
    const toNum = (t: string) => (t.trim() ? Number(t.trim().replace(/\./g, '').replace(',', '.')) : null)
    const targetPct = toNum(targetText)
    const buyLevel = toNum(buyText)
    if ((targetPct !== null && (!Number.isFinite(targetPct) || targetPct <= 0)) || (buyLevel !== null && (!Number.isFinite(buyLevel) || buyLevel <= 0))) {
      return toast.error('Tu objetivo y tu nivel de compra deben ser números mayores que cero.')
    }
    setBusy(true)
    try {
      const d = await fetchCryptoData([coinId], since)
      const p = d.prices[coinId]
      const next: CryptoPosition = { id: current?.id ?? newId(), coinId, symbol: p.symbol, name: p.name, categoryId, since, base, targetPct, buyLevel }
      await save.mutateAsync(current ? list.map((x) => (x.id === current.id ? next : x)) : [...list, next])
      toast.success('Criptomoneda guardada')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No pudimos guardar la criptomoneda.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Cripto" title={current ? `Editar ${current.name}` : 'Sigue tus criptomonedas'} subtitle="Con las aportaciones que registras en una categoría calculo cuánto llevas aportado, cuánto vale hoy en euros y tu rentabilidad." />
      <Card className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Criptomoneda">
            <select className="w-full" value={coin} onChange={(e) => setCoin(e.target.value)}>
              {COINS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              <option value="otra">Otra…</option>
            </select>
          </Field>
          {coin === 'otra' && (
            <Field label="Identificador en CoinGecko" hint="Lo ves en la dirección de la moneda en coingecko.com, por ejemplo «chainlink».">
              <input className="w-full" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="chainlink" />
            </Field>
          )}
          <Field label="Categoría de tus aportaciones" hint="Se cuentan los gastos de esa categoría como compras.">
            <select className="w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="">Elige una categoría</option>
              <CategoryOptions categories={categories} />
            </select>
          </Field>
          <Field label="Contar aportaciones desde">
            <input type="date" className="w-full" value={since} onChange={(e) => setSince(e.target.value)} required />
          </Field>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="mb-1 text-sm font-medium text-slate-800">Ajustar con mi broker (opcional)</p>
            <p className="mb-3 text-xs text-slate-500">Copia de tu plataforma la cantidad y lo aportado. Parto de esa posición real y solo estimo las aportaciones posteriores a esa fecha.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Cantidad"><input className="w-full" inputMode="decimal" value={sharesText} onChange={(e) => setSharesText(e.target.value)} placeholder="0,00224" /></Field>
              <Field label="Aportado (€)"><input className="w-full" inputMode="decimal" value={investedText} onChange={(e) => setInvestedText(e.target.value)} placeholder="150,00" /></Field>
              <Field label="A fecha de"><input type="date" className="w-full" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="mb-1 text-sm font-medium text-slate-800">Tus niveles (opcional)</p>
            <p className="mb-3 text-xs text-slate-500">Reglas tuyas para el semáforo: te muestro a qué precio llegaría tu objetivo y cuándo el precio cae por debajo de tu nivel de compra.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mi objetivo de ganancia (%)"><input className="w-full" inputMode="decimal" value={targetText} onChange={(e) => setTargetText(e.target.value)} placeholder="20" /></Field>
              <Field label="Mi nivel de compra (€)"><input className="w-full" inputMode="decimal" value={buyText} onChange={(e) => setBuyText(e.target.value)} placeholder="60000" /></Field>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {(current || list.length > 0) && <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>}
            <Button type="submit" disabled={busy}>{busy ? 'Comprobando…' : 'Guardar y calcular'}</Button>
          </div>
        </form>
      </Card>
    </>
  )
}

const Badge = ({ label, v }: { label: string; v: number | null }) => {
  if (v === null) return null
  const up = v >= 0
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`} title={label}>
      {up ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}
      {label} {num(Math.abs(v), 2)} %
    </span>
  )
}

const TREND_STYLE = {
  subiendo: { chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Subiendo' },
  bajando: { chip: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'Bajando' },
  lateral: { chip: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'Lateral' },
} as const
const ZONE_LABEL = { baja: 'zona baja', media: 'zona media', alta: 'zona alta' } as const

/** Tarjeta del monitor de mercado: precio, variaciones y dónde está el precio dentro de su rango de 90 días. */
function MonitorCard({ id, data }: { id: string; data: CryptoData }) {
  const px = data.prices[id]
  const hist = data.history[id]
  if (!px || !hist) return null
  const today = todayKey()
  const r30 = rangeStats(hist, today, 30, px.eur)
  const r90 = rangeStats(hist, today, 90, px.eur)
  const vol = volatilityPct(hist, today, 30, px.eur)
  const trend = trendOf(px.change7d ?? changePct(hist, today, 7, px.eur), px.eur, r30?.avg ?? null)
  const t = TREND_STYLE[trend]
  const ch7 = px.change7d ?? changePct(hist, today, 7, px.eur)
  const ch30 = px.change30d ?? changePct(hist, today, 30, px.eur)
  const ch90 = changePct(hist, today, 90, px.eur)
  const color = (px.change24h ?? 0) < 0 ? 'bg-red-500' : 'bg-emerald-500'
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">{px.symbol}</p>
          <p className="text-xs text-slate-500">{px.name}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${t.chip}`}>
          {trend === 'subiendo' ? <ArrowUp className="h-3 w-3" aria-hidden /> : trend === 'bajando' ? <ArrowDown className="h-3 w-3" aria-hidden /> : <Minus className="h-3 w-3" aria-hidden />}
          {t.label}
        </span>
      </div>
      <p className="num mt-3 text-2xl font-semibold">{eur(px.eur)}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge label="24 h" v={px.change24h} />
        <Badge label="7 d" v={ch7} />
        <Badge label="30 d" v={ch30} />
        <Badge label="90 d" v={ch90} />
      </div>
      {r90 && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Rango de 90 días</span><span>{ZONE_LABEL[rangeZone(r90.position)]}</span></div>
          <div className="relative h-2 w-full rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${color} opacity-60`} style={{ width: `${Math.round(r90.position * 100)}%` }} />
            <span className="absolute -top-1 h-4 w-1 rounded bg-slate-800" style={{ left: `calc(${Math.round(r90.position * 100)}% - 2px)` }} title="Precio actual" aria-hidden />
          </div>
          <div className="num mt-1 flex justify-between text-xs"><span className="text-slate-500">Mín {eur(r90.min)}</span><span className="text-slate-500">Máx {eur(r90.max)}</span></div>
        </div>
      )}
      <dl className="num mt-3 space-y-1 text-xs">
        {r30 && (
          <>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Media 30 d</dt><dd className="text-right font-medium">{eur(r30.avg)} <span className={px.eur >= r30.avg ? 'text-emerald-700' : 'text-red-600'}>({pct(((px.eur - r30.avg) / r30.avg) * 100)})</span></dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Mín / Máx 30 d</dt><dd className="text-right font-medium">{eur(r30.min)} / {eur(r30.max)}</dd></div>
          </>
        )}
        {vol !== null && <div className="flex justify-between gap-2"><dt className="text-slate-500">Volatilidad 30 d</dt><dd className="text-right font-medium">{volatilityLevel(vol)} ({num(vol, 1)} % al día)</dd></div>}
        {px.high24h !== null && px.low24h !== null && <div className="flex justify-between gap-2"><dt className="text-slate-500">Hoy mín / máx</dt><dd className="text-right font-medium">{eur(px.low24h)} / {eur(px.high24h)}</dd></div>}
      </dl>
    </Card>
  )
}

function Overview({ list, onAdd, onEdit }: { list: CryptoPosition[]; onAdd: () => void; onEdit: (p: CryptoPosition) => void }) {
  const [fresh, setFresh] = useState(0)
  const data = useCryptoData(list, fresh)
  const contributions = useCryptoContributions(list)
  const save = useSaveCrypto()
  const categories = useCategories().data ?? []

  const summaries = useMemo(() => {
    if (!data.data) return null
    if (list.length === 0) return []
    if (!contributions.data) return null
    const out: { p: CryptoPosition; s: EtfSummary; price: number }[] = []
    for (const p of list) {
      const price = data.data.prices[p.coinId]?.eur
      const hist = data.data.history[p.coinId]
      if (price === undefined || !hist) continue
      out.push({ p, price, s: summarizeEtf((contributions.data[p.id] ?? []).map((e) => ({ id: e.id, date: e.date, amount: e.amount })), hist, price, p.base) })
    }
    return out
  }, [data.data, contributions.data, list])

  function refresh() {
    setFresh(Date.now())
    toast.success('Actualizando precios y aportaciones…')
  }
  async function remove(p: CryptoPosition) {
    if (!window.confirm(`¿Dejar de seguir ${p.name}? Tus gastos no se tocan.`)) return
    try {
      await save.mutateAsync(list.filter((x) => x.id !== p.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No pudimos quitarla.')
    }
  }

  const header = (
    <PageHeader
      eyebrow="Cripto"
      title="Tus criptomonedas"
      subtitle="Mercado en euros con precios de CoinGecko y tus aportaciones de cada categoría."
      action={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={refresh} disabled={data.isFetching}><RefreshCw className={`h-4 w-4 ${data.isFetching ? 'animate-spin' : ''}`} /> {data.isFetching ? 'Actualizando…' : 'Actualizar'}</Button>
          <Button onClick={onAdd}><Plus className="h-4 w-4" /> Añadir</Button>
        </div>
      }
    />
  )
  if (data.isLoading || contributions.isLoading) return (<>{header}<Spinner label="Trayendo los precios…" /></>)
  if (data.error || contributions.error || !data.data || !summaries) {
    return (<>{header}<ErrorBox error={data.error ?? contributions.error} onRetry={() => { data.refetch(); contributions.refetch() }} /></>)
  }

  const total = summaries.reduce((a, x) => ({ invested: a.invested + x.s.invested, value: a.value + x.s.value }), { invested: 0, value: 0 })
  const gain = total.value - total.invested
  const gainPct = total.invested > 0 ? (gain / total.invested) * 100 : null
  const fng = data.data.fng
  const updated = new Date(data.data.fetchedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      {header}
      <section aria-label="Mercado" className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Mercado</h2>
          <p className="text-xs text-slate-500">Actualizado a las {updated}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {MONITOR_COINS.map((id) => <MonitorCard key={id} id={id} data={data.data!} />)}
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Miedo y codicia</p>
            {fng && <span className="text-sm font-semibold">{FNG_LABEL[fng.classification] ?? fng.classification} · {fng.value}/100</span>}
          </div>
          {fng ? (
            <>
              <div className="relative mt-3 h-2 w-full rounded-full bg-gradient-to-r from-red-400 via-amber-300 to-emerald-400">
                <span className="absolute -top-1 h-4 w-1 rounded bg-slate-800" style={{ left: `calc(${fng.value}% - 2px)` }} aria-hidden />
              </div>
              <div className="mt-1 flex justify-between text-xs text-slate-500"><span>Miedo extremo</span><span>Codicia extrema</span></div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No disponible ahora.</p>
          )}
        </div>
      </section>

      <h2 className="mb-3 font-semibold">Mis posiciones</h2>
      {summaries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-medium">Aún no sigues ninguna criptomoneda</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Añade la tuya con la categoría donde registras tus aportaciones y calculo tu valor y tu ganancia.</p>
          <div className="mt-4"><Button onClick={onAdd}><Plus className="h-4 w-4" /> Añadir criptomoneda</Button></div>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Aportado" value={formatMoney(total.invested)} hint={`${summaries.length} ${summaries.length === 1 ? 'criptomoneda' : 'criptomonedas'}`} />
            <Stat label="Valor hoy" value={formatMoney(total.value)} />
            <Stat highlight label="Ganancia" value={<span className={gain < 0 ? 'text-red-300' : ''}>{formatMoney(gain)}</span>} hint={<span className="text-lg font-semibold">{pct(gainPct)}</span>} />
          </div>
          <div className="space-y-6">
            {summaries.map(({ p, s, price }) => {
              const px = data.data!.prices[p.coinId]
              const avgCost = s.units > 0 ? s.invested / 100 / s.units : null
              const targetPrice = avgCost !== null && p.targetPct ? avgCost * (1 + p.targetPct / 100) : null
              const reached = p.targetPct != null && s.gainPct !== null && s.gainPct >= p.targetPct
              const belowBuy = p.buyLevel != null && price <= p.buyLevel
              return (
                <Card key={p.id} className="overflow-hidden p-0">
                  <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
                    <div>
                      <h2 className="text-lg font-semibold">{px.name} <span className="text-sm font-normal text-slate-500">{px.symbol}</span></h2>
                      <p className="text-xs text-slate-500">Aportaciones de {categoryLabel(categories, p.categoryId)} desde {formatDateEs(p.since)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="num text-xl font-semibold">{eur(price)}</p>
                        <p className={`num text-xs font-medium ${(px.change24h ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{px.change24h === null ? '' : `${pct(px.change24h)} en 24 h`}</p>
                      </div>
                      <Button variant="secondary" onClick={() => onEdit(p)} aria-label={`Editar ${px.name}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="secondary" onClick={() => remove(p)} aria-label={`Dejar de seguir ${px.name}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-4">
                    <Mini label="Aportado" value={formatMoney(s.invested)} />
                    <Mini label="Cantidad" value={num(s.units, 8)} />
                    <Mini label="Valor hoy" value={formatMoney(s.value)} />
                    <Mini label="Ganancia" value={<span className={tone(s.gain)}>{formatMoney(s.gain)} <span className="text-sm font-semibold">({pct(s.gainPct)})</span></span>} />
                  </div>
                  {avgCost !== null && (
                    <div className="mx-5 mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-100 p-3 text-sm">
                      <span className="text-slate-500">Precio medio de compra <b className="num text-slate-900">{eur(avgCost)}</b></span>
                      {targetPrice !== null && <span className="text-slate-500">Para ganar {num(p.targetPct!, 0)} % <b className="num text-slate-900">{eur(targetPrice)}</b></span>}
                      {p.buyLevel != null && <span className="text-slate-500">Mi nivel de compra <b className="num text-slate-900">{eur(p.buyLevel)}</b></span>}
                      <span className="ml-auto flex flex-wrap gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.gain < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{s.gain < 0 ? 'En pérdida' : 'En ganancia'} {pct(s.gainPct)}</span>
                        {reached && <span className="inline-flex rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">Objetivo de ganancia alcanzado</span>}
                        {belowBuy && <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">Por debajo de tu nivel de compra</span>}
                      </span>
                    </div>
                  )}
                  {s.rows.length > 0 ? (
                    <div className="overflow-x-auto border-t border-slate-100">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                            <th className="px-4 py-3 font-medium">Fecha</th>
                            <th className="px-4 py-3 text-right font-medium">Aportado</th>
                            <th className="px-4 py-3 text-right font-medium">Precio</th>
                            <th className="px-4 py-3 text-right font-medium">Cantidad</th>
                            <th className="px-4 py-3 text-right font-medium">Valor hoy</th>
                            <th className="px-4 py-3 text-right font-medium">Ganancia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {s.rows.map((r) => (
                            <tr key={r.id}>
                              <td className="num whitespace-nowrap px-4 py-3 text-slate-600">{r.isBase ? `Tu plataforma, ${formatDateEs(r.date)}` : formatDateEs(r.date)}</td>
                              <td className="num px-4 py-3 text-right">{formatMoney(r.amount)}</td>
                              <td className="num whitespace-nowrap px-4 py-3 text-right text-slate-600" title={r.isBase ? 'Precio medio de compra' : `Precio del ${formatDateEs(r.priceDate)}`}>{eur(r.price)}</td>
                              <td className="num px-4 py-3 text-right text-slate-600">{num(r.units, 8)}</td>
                              <td className="num px-4 py-3 text-right">{formatMoney(r.value)}</td>
                              <td className={`num whitespace-nowrap px-4 py-3 text-right font-medium ${tone(r.gain)}`}>{formatMoney(r.gain)} <span className="text-xs">({pct(r.gainPct)})</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">Aún no hay aportaciones: registra tus compras como gastos en esa categoría.</p>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}
      <p className="mt-6 text-xs text-slate-500">Precios en euros de CoinGecko, con el cierre diario (UTC): estimación sin comisiones que puede diferir de tu plataforma. La tendencia, los rangos y el índice de miedo y codicia describen el pasado y no son recomendaciones de compra ni de venta.</p>
    </>
  )
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="num mt-0.5 font-semibold">{value}</p>
    </div>
  )
}

