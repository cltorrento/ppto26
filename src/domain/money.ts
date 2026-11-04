import type { Cents } from './types'

const fmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(cents: Cents): string {
  return fmt.format(cents / 100)
}

/** Formato para inputs: "1234,56" (sin separador de miles ni símbolo). */
export function formatInput(cents: Cents): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

/**
 * Convierte texto escrito por el usuario a céntimos.
 * Acepta "1.234,56", "1234,56", "1234.56" y "1,234.56". Devuelve null si no es válido.
 */
export function parseMoney(text: string): Cents | null {
  let s = text.trim().replace(/[€\s]/g, '')
  if (!s) return null
  if (!/^[0-9.,]+$/.test(s)) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  const decimalSep = lastComma > lastDot ? ',' : lastDot > lastComma ? '.' : null
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep)
    const decimals = s.length - idx - 1
    // Un único separador seguido de 3 dígitos es un separador de miles ("1.234"), no decimal.
    const sepCount = s.split(decimalSep).length - 1
    if (decimals === 3 && sepCount === 1 && !(lastComma !== -1 && lastDot !== -1)) {
      s = s.replace(/[.,]/g, '')
    } else {
      if (decimals > 2) return null
      const intPart = s.slice(0, idx).replace(/[.,]/g, '')
      s = `${intPart || '0'}.${s.slice(idx + 1)}`
    }
  }
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}
