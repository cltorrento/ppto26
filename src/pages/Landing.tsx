import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, CalendarDays, Layers, PiggyBank, ShieldCheck, Wallet } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/Layout'
import { Button, ProgressBar } from '@/components/ui'

const STEPS = [
  { title: 'Define tu mes', text: 'Monto de partida y meta de ahorro opcional.' },
  { title: 'Reparte el total', text: 'Acepta la propuesta 50/30/20 o edita cada categoría.' },
  { title: 'Registra y ajusta', text: 'Anota cada gasto y revisa el remanente del mes en el panel.' },
]

const TOOLS = [
  { icon: Wallet, title: 'Parte de tu ingreso o de un presupuesto', text: 'Escribe tu sueldo neto o define un total propio. El resto del mes se calcula sobre esa cifra.' },
  { icon: Layers, title: 'Reparto sugerido 50/30/20', text: 'Necesidades, gustos y ahorro con una propuesta editable. Ajusta cada monto antes de guardar.' },
  { icon: BarChart3, title: 'Progreso por categoría', text: 'Cada gasto actualiza la barra de su categoría y te avisa cuando estás cerca del límite.' },
  { icon: CalendarDays, title: 'Plan anual', text: 'Ve en qué meses te quedas sin margen y programa gastos puntuales como el seguro del coche.' },
  { icon: PiggyBank, title: 'Ahorro a la vista', text: 'Reserva un monto de ahorro dentro del reparto y compáralo con lo que realmente apartaste.' },
  { icon: ShieldCheck, title: 'Tus datos, tuyos', text: 'Sin cuenta, todo queda en tu navegador. Con cuenta, solo tú puedes consultar tus datos.' },
]

export default function Landing() {
  const auth = useAuth()
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4">
          <Logo />
          <nav className="hidden gap-5 text-sm text-slate-600 sm:flex" aria-label="Secciones">
            <a href="#como-funciona" className="hover:text-slate-900">Cómo funciona</a>
            <a href="#herramientas" className="hover:text-slate-900">Herramientas</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {auth.mode === 'supabase' && !auth.signedIn && (
              <Link to="/login" className="px-3 text-sm font-medium text-slate-700 hover:text-slate-900">
                Iniciar sesión
              </Link>
            )}
            <Link to="/panel">
              <Button>
                Abrir mi panel <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Control de gastos personales</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight md:text-5xl">Lleva tus gastos a partir de tu sueldo o de un presupuesto</h1>
          <p className="mt-4 max-w-lg text-slate-600">Escribe cuánto dinero tienes este mes, repártelo entre tus categorías y registra cada gasto. Verás en todo momento cuánto te queda y qué categoría se está saliendo del límite.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/panel"><Button>Abrir mi panel <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link to="/presupuesto"><Button variant="secondary">Configurar mi presupuesto</Button></Link>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg" aria-hidden>
          <p className="text-xs uppercase tracking-wider text-slate-500">Disponible del mes</p>
          <p className="num mt-1 text-3xl font-semibold">2.400,00 €</p>
          <div className="mt-4 space-y-3">
            {[['Vivienda', 1.07, 'danger'], ['Alimentación', 0.34, 'brand'], ['Transporte', 0.4, 'brand'], ['Servicios', 0.52, 'brand']].map(([name, r, tone]) => (
              <div key={name as string}>
                <div className="mb-1 flex justify-between text-xs"><span className="font-medium">{name}</span><span className="num text-slate-500">{Math.round((r as number) * 100)} %</span></div>
                <ProgressBar ratio={r as number} tone={tone as 'brand' | 'danger'} />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">Ejemplo con datos de demostración</p>
        </div>
      </section>

      <section id="como-funciona" className="border-y border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Cómo funciona</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Tres pasos y ya sabes cuánto puedes gastar</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">{i + 1}</span>
                <p className="mt-3 font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-slate-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="herramientas" className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Herramientas</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">Lo esencial para no perder de vista el mes</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {TOOLS.map((t) => (
            <article key={t.title} className="rounded-2xl border border-slate-200 p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><t.icon className="h-5 w-5" aria-hidden /></span>
              <h3 className="mt-3 font-semibold">{t.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{t.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-brand-50 py-16 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-3xl font-bold tracking-tight">Empieza con el monto que tienes hoy y ajusta el resto cuando quieras</h2>
          <p className="mt-3 text-slate-600">Puedes cambiar el monto y las categorías más adelante desde Presupuesto.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/panel"><Button>Abrir mi panel <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-6 text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4">
          <nav className="flex gap-4" aria-label="Pie">
            <Link to="/panel">Panel</Link>
            <Link to="/gastos">Gastos</Link>
            <Link to="/presupuesto">Presupuesto</Link>
            <Link to="/plan-anual">Plan anual</Link>
          </nav>
          <span>© {new Date().getFullYear()} Control de gastos personales</span>
        </div>
      </footer>
    </div>
  )
}
