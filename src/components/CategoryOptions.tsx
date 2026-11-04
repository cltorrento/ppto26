import { childrenOf, topLevel } from '@/domain/calc'
import type { Category } from '@/domain/types'

/**
 * Opciones de un <select> de categorías: las que tienen subcategorías forman un grupo
 * («General» = gasto en la categoría sin subcategoría).
 */
export function CategoryOptions({ categories }: { categories: Category[] }) {
  return (
    <>
      {topLevel(categories).map((top) => {
        const kids = childrenOf(categories, top.id)
        if (kids.length === 0) return <option key={top.id} value={top.id}>{top.name}</option>
        return (
          <optgroup key={top.id} label={top.name}>
            <option value={top.id}>{top.name} · general</option>
            {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </optgroup>
        )
      })}
    </>
  )
}
