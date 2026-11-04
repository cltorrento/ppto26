import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/Layout'
import { Button, Field, Spinner } from '@/components/ui'

export default function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/panel'

  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (auth.loading) return <Spinner label="Comprobando tu sesión…" />
  // En modo local no hay cuentas; si ya hay sesión tampoco tiene sentido ver el formulario.
  if (auth.signedIn) return <Navigate to={from} replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Escribe un correo válido.')
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    setBusy(true)
    try {
      if (mode === 'in') {
        await auth.signIn(email, password)
        navigate(from, { replace: true })
      } else {
        const { needsConfirmation } = await auth.signUp(email, password)
        if (needsConfirmation) {
          setInfo('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.')
          setMode('in')
        } else {
          toast.success('Cuenta creada')
          navigate(from, { replace: true })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos completar la operación.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-4">
      <Logo />
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" noValidate>
        <div>
          <h1 className="text-xl font-semibold">{mode === 'in' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
          <p className="mt-1 text-sm text-slate-500">Tu presupuesto y tus gastos quedan asociados a tu cuenta; solo tú puedes verlos.</p>
        </div>
        <Field label="Correo electrónico">
          <input type="email" autoComplete="email" className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Contraseña" hint={mode === 'up' ? 'Mínimo 6 caracteres.' : undefined}>
          <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} className="w-full" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        {info && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}
        </Button>
        <p className="text-center text-sm text-slate-600">
          {mode === 'in' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null) }}>
            {mode === 'in' ? 'Crear una' : 'Iniciar sesión'}
          </button>
        </p>
      </form>
      <Link to="/" className="text-sm text-slate-500 hover:underline">
        Volver a la portada
      </Link>
    </div>
  )
}
