import type { Group } from './types'

/** Estructura de categorías que tenías (nombres como los viste en la app). Sirve para recrearla tras un borrado. */
export const RESTORE_TREE: { name: string; group: Group; icon: string; children: string[] }[] = [
  { name: 'Vivienda', group: 'necesidades', icon: 'home', children: ['Apartamento', 'Impuestos a la Propiedad'] },
  { name: 'Alimentación', group: 'necesidades', icon: 'cart', children: ['Supermercados'] },
  { name: 'Transporte', group: 'necesidades', icon: 'car', children: ['Transporte Publico', 'Bollo Auto', 'Combustible'] },
  { name: 'Servicios', group: 'necesidades', icon: 'zap', children: ['Internet', 'Telefono', 'Electricidad'] },
  { name: 'Salud', group: 'necesidades', icon: 'heart', children: ['Seguros', 'Medicamentos'] },
  { name: 'Ocio', group: 'gustos', icon: 'party', children: ['Peluquero', 'Streaming', 'Otros'] },
  { name: 'Viajes', group: 'gustos', icon: 'dots', children: ['Comida', 'Transporte', 'Hospedaje'] },
  { name: 'Familia', group: 'gustos', icon: 'dots', children: ['Mama / Papa'] },
  { name: 'Mas Gastos', group: 'deuda', icon: 'dots', children: ['CC', 'Tarjeta Credito', 'Agos', 'Otros'] },
  { name: 'Ahorro', group: 'ahorro', icon: 'piggy', children: ['Terreno', 'Materiales', 'Etf - PAC'] },
]

/** Compara nombres sin distinguir mayúsculas ni acentos. */
export const normName = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export interface RestorableRow {
  id: string
  name: string
  group: Group
  icon: string
  amountText: string
  parentId: string | null
}

/**
 * Añade a las filas del formulario las categorías y subcategorías de RESTORE_TREE que falten, sin duplicar las que ya
 * existen (por nombre). Si una categoría existente sin subcategorías recibe la primera, su monto pasa a ella (como al
 * crear una subcategoría a mano) y se devuelve en `carry`. No guarda nada.
 */
export function restoreRows<T extends RestorableRow>(
  rows: T[],
  newId: () => string,
): { rows: T[]; added: number; carry: Record<string, string> } {
  let next = [...rows]
  let added = 0
  const carry: Record<string, string> = {}
  const make = (r: RestorableRow) => r as T

  for (const t of RESTORE_TREE) {
    let top = next.find((r) => !r.parentId && normName(r.name) === normName(t.name))
    if (!top) {
      top = make({ id: newId(), name: t.name, group: t.group, icon: t.icon, amountText: '0,00', parentId: null })
      next.push(top)
      added++
    }
    const topId = top.id
    for (const c of t.children) {
      const kids = next.filter((r) => r.parentId === topId)
      if (kids.some((k) => normName(k.name) === normName(c))) continue
      const current = next.find((r) => r.id === topId)!
      const firstChild = kids.length === 0
      const child = make({ id: newId(), name: c, group: current.group, icon: 'dots', amountText: firstChild ? current.amountText : '0,00', parentId: topId })
      if (firstChild) {
        carry[topId] = child.id
        next = next.map((r) => (r.id === topId ? { ...r, amountText: '0,00' } : r))
      }
      const lastIdx = next.reduce((last, r, i) => (r.id === topId || r.parentId === topId ? i : last), -1)
      next = [...next.slice(0, lastIdx + 1), child, ...next.slice(lastIdx + 1)]
      added++
    }
  }
  return { rows: next, added, carry }
}
