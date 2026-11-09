import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CreditCard, CalendarClock, ChevronDown, Plus, ArrowRight } from 'lucide-react'
import { Button, Card, Empty, ErrorBox, PageHeader, ProgressBar, Spinner, Stat } from '@/components/ui'
import { CategoryIcon } from '@/components/CategoryIcon'
import { GROUP_STYLE } from '@/components/groupStyle'
import { ExpenseModal } from '@/components/ExpenseModal'
import { capitalize, formatDateEs, monthLabel, useMonth } from '@/components/MonthContext'
import { loadDemoData } from '@/data/demo'
import { useMonthData } from '@/data/useMonthData'
import { formatMoney } from '@/domain/money'
import { GROUP_LABELS } from '@/domain/types'
import { categoryLabel, sum, type CategoryStatus, type CategoryProgress } from '@/domain/calc'

const STATUS_LABEL: Record<CategoryStatus, string> = { ok: 'Dentro del presupuesto', near: 'Cerca del límite', exceeded: 'Excedido' }
const STATUS_DOT: Record<CategoryStatus, string> = { ok: 'bg-emerald-500', near: 'bg-amber-500', exceeded: 'bg-red-500' }

export default function Panel() {
  const { month } = useMonth()
  const [modal, setModal] = useState<{ categoryId?: string } | null>(null)
  /** Categorías con las subcategorías desplegadas. Por defecto todas están plegadas. */
  const [opened, setOpened] = useState<Set<string>>(new Set())
  const { data, isLoading, error, refetch } = useMonthData(month)
  const qc = useQueryClient()

  if (isLoading) return <Spinner label="Cargando tu panel…" />
  if (error || !data) return <ErrorBox error={error} onRetry={refetch} />

  const { plan, summary, progress, groups, card, reserves, purchases, settings } = data

  if (!plan) {
    return (
      <>
        <PageHeader eyebrow="Panel del mes" title={capitalize(monthLabel(month))} />
        <Empty title="Aún no has configurado este mes">
          <p className="max-w-md text-sm text-slate-500">Escribe tu ingreso y reparte el total entre tus categorías. Con eso el panel calcula cuánto te queda y avisa cuando te acercas al límite.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/presupuesto">
              <Button>Configurar mi presupuesto</Button>
            </Link>
            <Button
              variant="secondary"
              onClick={async () => {
                await loadDemoData()
                await qc.invalidateQueries()
                toast.success('Datos de ejemplo cargados')
              }}
            >
              Cargar datos de ejemplo
            </Button>
          </div>
        </Empty>
      </>
    )
  }

  const exceeded = progress.filter((p) => p.status === 'exceeded').length
  const overAssigned = sum(progress.map((p) => p.budget))
  const unassigned = summary.income - overAssigned
  const subtitle =
    `${purchases.length} gasto${purchases.length === 1 ? '' : 's'} registrado${purchases.length === 1 ? '' : 's'}` +
    (summary.dailyAverage !== null ? ` · promedio diario ${formatMoney(summary.dailyAverage)}` : '')

  return (
    <>
      <PageHeader
        eyebrow="Panel del mes"
        title={capitalize(monthLabel(month))}
        subtitle={subtitle}
        action={
          <Button onClick={() => setModal({})}>
            <Plus className="h-4 w-4" /> Registrar gasto
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ingreso del mes" value={formatMoney(summary.income)} hint={`${formatMoney(plan.income)} de ingreso${plan.extraIncome ? ` + ${formatMoney(plan.extraIncome)} extra` : ''}`} />
        <Stat label="Gastado" value={formatMoney(summary.spent)} hint={summary.dailyAverage !== null ? `Promedio diario ${formatMoney(summary.dailyAverage)}` : undefined} />
        <Stat
          highlight
          label="Disponible"
          value={formatMoney(summary.remaining)}
          hint={
            summary.daysLeft !== null
              ? `${summary.daysLeft} días restantes${summary.dailyAllowance !== null ? ` · ${formatMoney(summary.dailyAllowance)} al día` : ''}${summary.reserved ? ' · ya descontadas las reservas' : ''}`
              : summary.reserved
                ? 'Ya descontadas las reservas'
                : undefined
          }
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Consumo del mes</p>
          <p className="num mt-2 text-3xl font-semibold">{Math.round(summary.spentRatio * 100)} %</p>
          <div className="mt-2">
            <ProgressBar ratio={summary.spentRatio} tone={summary.committedRatio > 1 ? 'danger' : summary.committedRatio > 0.85 ? 'warn' : 'brand'} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {formatMoney(summary.spent)} de {formatMoney(summary.income)}
            {summary.reserved > 0 && ` · +${formatMoney(summary.reserved)} reservados`}
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <CreditCard className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold">Tarjeta de crédito</h2>
              <p className="text-xs text-slate-500">Las compras con tarjeta cuentan en el mes en que se cobran: el día {settings.cardPayDay} del mes siguiente, o la fecha que elijas al registrarlas.</p>
            </div>
          </div>
          <Link to="/ajustes" className="whitespace-nowrap py-2 text-sm font-medium text-brand-600 hover:underline">
            Cambiar día de pago
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Compras con tarjeta de este mes</p>
            <p className="num mt-1 text-2xl font-semibold">{formatMoney(card.purchasedThisMonth)}</p>
            <p className="mt-1 text-xs text-slate-500">Se cobrarán el {formatDateEs(card.nextChargeDate)}.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Cargo de tarjeta de este mes</p>
            <p className="num mt-1 text-2xl font-semibold">{formatMoney(card.chargedThisMonth)}</p>
            <p className="mt-1 text-xs text-slate-500">Por compras con tarjeta del mes anterior.</p>
          </div>
        </div>
      </Card>

      {reserves.length > 0 && (
        <Card className="mb-6">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <CalendarClock className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold">Compromisos programados de {monthLabel(month)}</h2>
                <p className="text-xs text-slate-500">Gastos puntuales de tu plan anual. Cuentan como reserva hasta que registres el gasto real.</p>
              </div>
            </div>
            <Link to="/plan-anual" className="inline-flex items-center gap-1 whitespace-nowrap py-2 text-sm font-medium text-brand-600 hover:underline">
              Ver plan anual <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {reserves.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  {p.name}
                  {p.repeatsYearly && <span className="ml-2 text-xs text-slate-500">se repite cada año</span>}
                </span>
                <span className="num font-medium">{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Progreso por categoría</h2>
              <p className="text-xs text-slate-500">{exceeded ? `${exceeded} categoría${exceeded === 1 ? '' : 's'} excedida${exceeded === 1 ? '' : 's'} este mes` : 'Todas las categorías dentro de su límite'}</p>
            </div>
            <div className="flex items-center gap-3">
              {progress.some((p) => p.children.length > 0) && (
                <button type="button" className="-my-2 py-2 text-sm font-medium text-brand-600 hover:underline" onClick={() => setOpened(opened.size ? new Set() : new Set(progress.filter((p) => p.children.length > 0).map((p) => p.category.id)))}>
                  {opened.size ? 'Plegar todo' : 'Desplegar todo'}
                </button>
              )}
              <Link to="/presupuesto" className="-my-2 inline-block py-2 text-sm font-medium text-brand-600 hover:underline">
                Editar montos
              </Link>
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {progress.map((p) => (
              <li key={p.category.id} className="py-3">
                <ProgressLine
                  p={p}
                  onAdd={() => setModal({ categoryId: p.category.id })}
                  toggle={p.children.length > 0 ? { open: opened.has(p.category.id), count: p.children.length, onToggle: () => setOpened((o) => { const n = new Set(o); n.has(p.category.id) ? n.delete(p.category.id) : n.add(p.category.id); return n }) } : undefined}
                />
                {p.children.length > 0 && opened.has(p.category.id) && (
                  <ul className="ml-6 mt-2 space-y-2 border-l border-slate-100 pl-4 sm:ml-12">
                    {p.children.map((k) => (
                      <li key={k.category.id}>
                        <ProgressLine p={k} small onAdd={() => setModal({ categoryId: k.category.id })} />
                      </li>
                    ))}
                    {p.ownSpent > 0 && (
                      <li className="num text-xs text-slate-500">
                        General (sin subcategoría): {formatMoney(p.ownSpent)}
                      </li>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold">Tu reparto</h2>
            <p className="mb-4 text-xs text-slate-500">
              {formatMoney(overAssigned)} presupuestados de {formatMoney(summary.income)} de ingreso
            </p>
            <ul className="space-y-6">
              {groups.map((g) => {
                const left = g.planned - g.actual
                const gap = g.planned - g.target
                const goal = g.targetPct / 100
                const label = `Objetivo ${g.targetPct} %`
                return (
                  <li key={g.group}>
                    <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-medium"><span className={`h-2.5 w-2.5 rounded-full ${GROUP_STYLE[g.group].dot}`} aria-hidden />{GROUP_LABELS[g.group]}</span>
                      <span className="num text-xs text-slate-600">Objetivo {g.targetPct} % · <b>{formatMoney(g.target)}</b></span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Presupuestado</span><span className="num">{formatMoney(g.planned)} · {Math.round(g.plannedPct)} %</span></div>
                        <ProgressBar ratio={g.plannedPct / 100} barClass={`${GROUP_STYLE[g.group].bar} opacity-40`} marker={goal} markerLabel={label} />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-slate-700"><span>Gastado</span><span className="num font-medium">{formatMoney(g.actual)} · {Math.round(g.actualPct)} %</span></div>
                        <ProgressBar ratio={g.actualPct / 100} barClass={GROUP_STYLE[g.group].bar} marker={goal} markerLabel={label} />
                      </div>
                    </div>
                    <div className="num mt-1.5 flex flex-wrap items-center justify-between gap-x-3 text-xs">
                      <span className="text-slate-500">{gap === 0 ? 'Presupuestado igual al objetivo' : `Presupuestado ${formatMoney(Math.abs(gap))} ${gap > 0 ? 'sobre' : 'bajo'} el objetivo`}</span>
                      <span className={`font-semibold ${left < 0 ? 'text-red-600' : 'text-slate-700'}`}>{left < 0 ? `Excedido ${formatMoney(-left)}` : `Disponible ${formatMoney(left)}`}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
            {unassigned < 0 && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800">
                <span>Presupuestado de más</span>
                <span className="num font-semibold">{formatMoney(unassigned)}</span>
              </div>
            )}
            <Link to="/presupuesto" className="mt-3 block">
              <Button variant="secondary" className="w-full">
                Revisar presupuesto <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Últimos gastos</h2>
              <Link to="/gastos" className="text-sm font-medium text-brand-600 hover:underline">
                Ver todos
              </Link>
            </div>
            {purchases.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">Registra tu primer gasto para ver el avance de tu presupuesto.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {purchases.slice(0, 5).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.description || 'Sin descripción'}</p>
                      <p className="truncate text-xs text-slate-500">{categoryLabel(data.categories, e.categoryId)}</p>
                    </div>
                    <span className="num shrink-0 font-medium">{formatMoney(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {modal && <ExpenseModal defaultCategoryId={modal.categoryId} onClose={() => setModal(null)} />}
    </>
  )
}

function ProgressLine({ p, small = false, onAdd, toggle }: { p: CategoryProgress; small?: boolean; onAdd: () => void; toggle?: { open: boolean; count: number; onToggle: () => void } }) {
  return (
    <div className="flex items-center gap-3">
      {toggle && (
        <button
          type="button"
          onClick={toggle.onToggle}
          aria-expanded={toggle.open}
          aria-label={`${toggle.open ? 'Ocultar' : 'Mostrar'} las ${toggle.count} subcategorías de ${p.category.name}`}
          className="-mr-2 rounded-full p-2 text-slate-500 hover:bg-slate-100"
        >
          <ChevronDown className={`h-4 w-4 transition ${toggle.open ? '' : '-rotate-90'}`} aria-hidden />
        </button>
      )}
      {!small && <CategoryIcon icon={p.category.icon} group={p.category.group} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`flex flex-wrap items-center gap-x-2 font-medium ${small ? 'text-xs' : 'text-sm'}`}>
            {p.category.name}
            <span className="flex items-center gap-1 text-xs font-normal text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[p.status]}`} aria-hidden />
              {STATUS_LABEL[p.status]}
            </span>
          </p>
          <p className={`num font-semibold ${small ? 'text-xs' : 'text-sm'} ${p.available < 0 ? 'text-red-600' : ''}`}>
            {p.available < 0 ? '+' : ''}
            {formatMoney(Math.abs(p.available))} <span className="text-xs font-normal text-slate-500">{p.available < 0 ? 'excedido' : 'disponible'}</span>
          </p>
        </div>
        <div className="my-1.5">
          <ProgressBar ratio={p.ratio} barClass={GROUP_STYLE[p.category.group].bar} />
        </div>
        <p className="num text-xs text-slate-500">
          {formatMoney(p.spent)} de {formatMoney(p.budget)}
          {p.budget > 0 && ` · ${Math.round(p.ratio * 100)} % usado`}
        </p>
      </div>
      <button onClick={onAdd} aria-label={`Registrar gasto en ${p.category.name}`} className="rounded-full p-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:p-2">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
