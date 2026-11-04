import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="text-2xl font-semibold">Esta página no existe</h1>
      <p className="text-sm text-slate-500">Revisa la dirección o vuelve a la portada.</p>
      <Link to="/">
        <Button>Ir a la portada</Button>
      </Link>
    </div>
  )
}
