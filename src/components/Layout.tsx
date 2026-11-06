import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, LandPlot, LayoutDashboard, LogOut, Receipt, Settings, Wallet } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { capitalize, monthName, useMonth } from './MonthContext'

const NAV = [
  { to: '/panel', label: 'Panel', icon: LayoutDashboard },
  { to: '/gastos', label: 'Gastos', icon: Receipt },
  { to: '/presupuesto', label: 'Presupuesto', icon: Wallet },
  { to: '/plan-anual', label: 'Plan anual', icon: CalendarDays },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
  { to: '/terreno', label: 'Terreno', icon: LandPlot },
]

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
          <rect x="7" y="17" width="4" height="8" rx="1" fill="#fff" />
          <rect x="14" y="12" width="4" height="13" rx="1" fill="#fff" />
          <rect x="21" y="7" width="4" height="18" rx="1" fill="#fff" />
        </svg>
      </span>
      <span className="whitespace-nowrap max-[430px]:sr-only">Mi presupuesto</span>
    </Link>
  )
}

export function Layout() {
  const { month, prev, next } = useMonth()
  const auth = useAuth()
  const { pathname } = useLocation()
  const showMonth = pathname !== '/plan-anual' && pathname !== '/reportes' && pathname !== '/terreno' && pathname !== '/ajustes'

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
            {NAV.map((n) => (
              <NavItem key={n.to} {...n} />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {showMonth && (
              <div className="flex items-center rounded-full border border-slate-200 bg-white">
                <button onClick={prev} aria-label="Mes anterior" className="rounded-full p-3 hover:bg-slate-100 md:p-2">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-24 whitespace-nowrap text-center text-sm font-medium sm:min-w-28">
                  {capitalize(monthName(month))} <span className="text-slate-400">{month.slice(0, 4)}</span>
                </span>
                <button onClick={next} aria-label="Mes siguiente" className="rounded-full p-3 hover:bg-slate-100 md:p-2">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            <NavLink to="/ajustes" aria-label="Ajustes" className="rounded-full p-3 text-slate-600 hover:bg-slate-100 md:p-2">
              <Settings className="h-5 w-5" />
            </NavLink>
            {auth.mode === 'supabase' && (
              <button onClick={() => auth.signOut()} aria-label="Cerrar sesión" title={auth.email ?? ''} className="rounded-full p-2 text-slate-600 hover:bg-slate-100">
                <LogOut className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-28 md:pb-10">
        <Outlet />
      </main>

      <footer className="hidden border-t border-slate-200 bg-white py-4 text-xs text-slate-500 md:block">
        <div className="mx-auto flex max-w-6xl justify-between px-4">
          <span>Control de gastos personales · modo ingreso salarial</span>
          <span>{auth.mode === 'local' ? 'Tus datos se guardan solo en este navegador.' : 'Tus datos están asociados a tu cuenta y solo tú puedes verlos.'}</span>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Principal móvil">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] ${isActive ? 'font-semibold text-brand-600' : 'text-slate-500'}`}
          >
            <n.icon className="h-5 w-5" aria-hidden />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Wallet }) {
  return (
    <NavLink to={to} className={({ isActive }) => `flex items-center gap-2 rounded-full px-3 py-2 text-sm ${isActive ? 'bg-slate-100 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </NavLink>
  )
}
