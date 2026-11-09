import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bitcoin, BarChart3, CalendarDays, ChevronLeft, ChevronRight, LandPlot, LayoutDashboard, LogOut, Receipt, Settings, TrendingUp, Wallet } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { capitalize, monthName, useMonth } from './MonthContext'

const NAV = [
  { to: '/panel', label: 'Panel', icon: LayoutDashboard },
  { to: '/gastos', label: 'Gastos', icon: Receipt },
  { to: '/presupuesto', label: 'Presupuesto', short: 'Presup.', icon: Wallet },
  { to: '/plan-anual', label: 'Plan anual', short: 'Plan', icon: CalendarDays },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
  { to: '/terreno', label: 'Terreno', icon: LandPlot },
  { to: '/etf', label: 'ETF', icon: TrendingUp },
  { to: '/cripto', label: 'Cripto', icon: Bitcoin },
]

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
          <rect x="7" y="17" width="4" height="8" rx="1" fill="#fff" />
          <rect x="14" y="12" width="4" height="13" rx="1" fill="#fff" />
          <rect x="21" y="7" width="4" height="18" rx="1" fill="#fff" />
        </svg>
      </span>
      <span className={`whitespace-nowrap max-[430px]:sr-only ${compact ? 'md:sr-only lg:not-sr-only' : ''}`}>Mi presupuesto</span>
    </Link>
  )
}

export function Layout() {
  const { month, prev, next } = useMonth()
  const auth = useAuth()
  const { pathname } = useLocation()
  const showMonth = pathname !== '/plan-anual' && pathname !== '/reportes' && pathname !== '/terreno' && pathname !== '/etf' && pathname !== '/cripto' && pathname !== '/ajustes'

  const monthPicker = (
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
  )

  return (
    <div className="min-h-screen md:flex">
      {/* Menú lateral: iconos en pantallas medianas, iconos y texto en las grandes. */}
      <aside className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white md:flex md:w-[68px] lg:w-60" aria-label="Menú">
        <div className="flex h-16 items-center px-4 lg:px-5">
          <Logo compact />
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2" aria-label="Principal">
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </nav>
        <div className="space-y-1 border-t border-slate-100 px-3 py-3">
          <NavLink
            to="/ajustes"
            title="Ajustes"
            className={({ isActive }) => `flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm ${isActive ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Settings className="h-5 w-5 shrink-0" aria-hidden />
            <span className="hidden lg:inline">Ajustes</span>
          </NavLink>
          {auth.mode === 'supabase' && (
            <button onClick={() => auth.signOut()} title={auth.email ?? 'Cerrar sesión'} className="flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
              <LogOut className="h-5 w-5 shrink-0" aria-hidden />
              <span className="hidden lg:inline">Cerrar sesión</span>
            </button>
          )}
          <p className="hidden px-3 pt-1 text-xs text-slate-400 lg:block">v{__APP_VERSION__}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={`sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur ${showMonth ? '' : 'md:hidden'}`}>
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <div className="md:hidden">
              <Logo />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {showMonth && monthPicker}
              <NavLink to="/ajustes" aria-label="Ajustes" className="rounded-full p-3 text-slate-600 hover:bg-slate-100 md:hidden">
                <Settings className="h-5 w-5" />
              </NavLink>
              {auth.mode === 'supabase' && (
                <button onClick={() => auth.signOut()} aria-label="Cerrar sesión" title={auth.email ?? ''} className="rounded-full p-2 text-slate-600 hover:bg-slate-100 md:hidden">
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
        <p className="pb-4 text-center text-xs text-slate-400 md:hidden">v{__APP_VERSION__}</p>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Principal móvil">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] ${isActive ? 'font-semibold text-brand-600' : 'text-slate-500'}`}
          >
            <n.icon className="h-5 w-5" aria-hidden />
            {'short' in n ? n.short : n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Wallet }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) => `flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm ${isActive ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="hidden lg:inline">{label}</span>
    </NavLink>
  )
}
