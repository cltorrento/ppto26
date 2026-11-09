// Precios de un ETF para la sección «ETF». El navegador no puede llamar a Yahoo Finance (CORS),
// así que esta función lo hace desde el servidor. No usa claves ni guarda datos del usuario.
// Entrada: ?isin=IE0003XJA0J9[&ticker=WEBN.DE]&from=2026-10-01
const UA = 'Mozilla/5.0 (compatible; MiPresupuesto)'
const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/
const TICKER = /^[A-Z0-9.\-]{1,15}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

function send(res, status, body, cache) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (cache) res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600')
  res.end(JSON.stringify(body))
}

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!r.ok) throw new Error(`Yahoo Finance respondió ${r.status}`)
  return r.json()
}

export default async function handler(req, res) {
  try {
    const q = new URL(req.url, 'http://localhost').searchParams
    const isin = (q.get('isin') ?? '').trim().toUpperCase()
    let ticker = (q.get('ticker') ?? '').trim().toUpperCase()
    const from = q.get('from') ?? ''
    if (!ISIN.test(isin)) return send(res, 400, { error: 'El ISIN no es válido (12 caracteres, por ejemplo IE0003XJA0J9).' })
    if (ticker && !TICKER.test(ticker)) return send(res, 400, { error: 'El ticker no es válido.' })
    if (!DATE.test(from)) return send(res, 400, { error: 'La fecha de inicio no es válida.' })

    let name = ''
    if (!ticker) {
      const found = await getJson(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(isin)}&quotesCount=8&newsCount=0`)
      const etf = (found.quotes ?? []).find((x) => x.quoteType === 'ETF' && TICKER.test(x.symbol ?? ''))
      if (!etf) return send(res, 404, { error: 'No encontré ese ETF. Prueba escribiendo el ticker a mano (por ejemplo WEBN.DE).' })
      ticker = etf.symbol
      name = etf.longname ?? etf.shortname ?? ''
    }

    const start = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000) - 7 * 86400
    const end = Math.floor(Date.now() / 1000) + 86400
    const data = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${start}&period2=${end}&interval=1d`)
    const result = data?.chart?.result?.[0]
    if (!result) return send(res, 404, { error: 'No hay precios para ese ticker.' })

    const meta = result.meta
    const offset = meta.gmtoffset ?? 0
    const closes = result.indicators?.quote?.[0]?.close ?? []
    const history = []
    ;(result.timestamp ?? []).forEach((t, i) => {
      if (typeof closes[i] === 'number') history.push([new Date((t + offset) * 1000).toISOString().slice(0, 10), closes[i]])
    })
    if (history.length === 0 || typeof meta.regularMarketPrice !== 'number') return send(res, 404, { error: 'No hay precios para esas fechas.' })

    return send(
      res,
      200,
      {
        ticker,
        isin,
        name: name || meta.longName || meta.shortName || ticker,
        currency: meta.currency,
        exchange: meta.fullExchangeName ?? meta.exchangeName ?? '',
        price: meta.regularMarketPrice,
        // Mercado abierto si ahora cae dentro de la sesión regular de hoy.
        marketOpen: (() => {
          const reg = meta.currentTradingPeriod?.regular
          const now = Math.floor(Date.now() / 1000)
          return !!reg && now >= reg.start && now <= reg.end
        })(),
        priceTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
        priceDate: new Date(((meta.regularMarketTime ?? 0) + offset) * 1000).toISOString().slice(0, 10),
        history,
      },
      true,
    )
  } catch (e) {
    return send(res, 502, { error: `No pudimos traer los precios ahora. ${e instanceof Error ? e.message : ''}` })
  }
}
