import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/data/supabaseClient'
import { storageMode } from '@/data'

interface AuthState {
  mode: 'local' | 'supabase'
  /** True mientras se comprueba la sesión inicial. */
  loading: boolean
  /** En modo local siempre es true: no hay cuentas. */
  signedIn: boolean
  email: string | null
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>
  signOut(): Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(storageMode === 'supabase')
  const [email, setEmail] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(storageMode === 'local')

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSignedIn(!!data.session)
      setEmail(data.session?.user.email ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session)
      setEmail(session?.user.email ?? null)
      // Al cambiar de usuario no debe quedar nada en caché del anterior.
      qc.clear()
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [qc])

  const signIn = useCallback(async (e: string, password: string) => {
    if (!supabase) return
    const { error } = await supabase.auth.signInWithPassword({ email: e, password })
    if (error) throw new Error(translateAuthError(error.message))
  }, [])

  const signUp = useCallback(async (e: string, password: string) => {
    if (!supabase) return { needsConfirmation: false }
    const { data, error } = await supabase.auth.signUp({ email: e, password })
    if (error) throw new Error(translateAuthError(error.message))
    return { needsConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthState>(
    () => ({ mode: storageMode, loading, signedIn, email, signIn, signUp, signOut }),
    [loading, signedIn, email, signIn, signUp, signOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return v
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.'
  if (m.includes('already registered')) return 'Ya existe una cuenta con ese correo.'
  if (m.includes('password should be')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de iniciar sesión.'
  if (m.includes('rate limit')) return 'Demasiados intentos. Inténtalo en unos minutos.'
  return message
}
