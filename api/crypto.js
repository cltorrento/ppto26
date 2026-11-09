// Precios de criptomonedas en euros para la sección «Cripto» (CoinGecko, sin clave) y el índice Fear & Greed.
// Entrada: ?ids=bitcoin,ethereum&from=2026-10-01
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

function send(res, status, body, cache) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (cache) res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600')
  res.end(JSON.stringify(body))
}

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MiPresupuesto)', Accept: 'application/json' } })
  if (r.status === 429) throw new Error('CoinGecko recibió demasiadas peticiones; prueba en un minuto')
  if (!r.ok) throw new Error(`El proveedor de precios respondió ${r.status}`)
  return r.json()
}

export default async function handler(req, res) {
  try {
    const q = new URL(req.url, 'http://localhost').searchParams
    const ids = (q.get('ids') ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    const from = q.get('from') ?? ''
    if (ids.length === 0 || ids.length > 6 || !ids.every((i) => ID.test(i))) return send(res, 400, { error: 'Las criptomonedas no son válidas.' })
    if (!DATE.test(from)) return send(res, 400, { error: 'La fecha de inicio no es válida.' })

    const days = Math.min(1100, Math.max(2, Math.ceil((Date.now() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000) + 8))
    const markets = await getJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&ids=${ids.join(',')}&price_change_percentage=24h,7d,30d`)
    const found = new Map(markets.map((m) => [m.id, m]))
    const missing = ids.filter((i) => !found.has(i))
    if (missing.length) return send(res, 404, { error: `No encontré esta criptomoneda en CoinGecko: ${missing.join(', ')}.` })

    const prices = {}
    const history = {}
    await Promise.all(
      ids.map(async (id) => {
        const m = found.get(id)
        prices[id] = {
          name: m.name,
          symbol: String(m.symbol).toUpperCase(),
          eur: m.current_price,
          change24h: m.price_change_percentage_24h_in_currency ?? m.price_change_percentage_24h ?? null,
          change7d: m.price_change_percentage_7d_in_currency ?? null,
          change30d: m.price_change_percentage_30d_in_currency ?? null,
          high24h: m.high_24h ?? null,
          low24h: m.low_24h ?? null,
          updatedAt: m.last_updated ?? null,
        }
        const chart = await getJson(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=eur&days=${days}&interval=daily`)
        history[id] = (chart.prices ?? []).filter((p) => typeof p[1] === 'number').map((p) => [new Date(p[0]).toISOString().slice(0, 10), p[1]])
      }),
    )

    let fng = null
    try {
      const f = await getJson('https://api.alternative.me/fng/')
      const d = f?.data?.[0]
      if (d) fng = { value: Number(d.value), classification: d.value_classification, date: new Date(Number(d.timestamp) * 1000).toISOString().slice(0, 10) }
    } catch {
      fng = null
    }

    return send(res, 200, { prices, history, fng, fetchedAt: new Date().toISOString() }, true)
  } catch (e) {
    return send(res, 502, { error: `No pudimos traer los precios ahora. ${e instanceof Error ? e.message : ''}` })
  }
}
