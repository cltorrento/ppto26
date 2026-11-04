import { DEFAULT_CATEGORIES } from '@/domain/types'
import { localRepository } from './localRepository'
import { newId, type Repository } from './repository'
import { isSupabaseConfigured } from './supabaseClient'
import { supabaseRepository } from './supabaseRepository'

const base: Repository = isSupabaseConfigured ? supabaseRepository : localRepository

/** Repositorio activo. Siembra las categorías por defecto la primera vez que se piden. */
export const repo: Repository = {
  ...base,
  async listCategories() {
    let categories = await base.listCategories()
    if (categories.length === 0) {
      categories = DEFAULT_CATEGORIES.map((c) => ({ ...c, id: newId() }))
      await base.saveCategories(categories)
    }
    return categories
  },
}

export const storageMode: 'local' | 'supabase' = isSupabaseConfigured ? 'supabase' : 'local'
