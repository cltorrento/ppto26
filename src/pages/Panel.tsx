import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CreditCard, CalendarClock, Plus, ArrowRight } from 'lucide-react'
import { Button, Card, Empty, ErrorBox, PageHeader, ProgressBar, Spinner, Stat } from '@/components/ui'
import { CategoryIcon } from '@/components/CategoryIcon'
import { ExpenseModal } from '@/components/ExpenseModal'
import { capitalize, formatDateEs, monthLabel, useMonth } from '@/components/MonthContext'
import { loadDemoData } from '@/data/demo'
import { useMonthData, type MonthView } from '@/data/useMonthData'
import { formatMoney } from '@/domain/money'
import { GROUP_LABELS, GROUP_TARGETS, type Group } from '@/domain/types'
import type { CategoryStatus } from '@/domain/calc'

const STATUS_LABEL: Record<CategoryStatus, string> = { ok: 'Dentro del presupuesto', near: 'Cerca del límite', exceeded: 'Excedido' }
const STATUS_TONE: Record<CategoryStatus, 'brand' | 'warn' | 'danger'> = { ok: 'brand', near: 'warn', exceeded: 'danger' }
const STATUS_DOT: Record<CategoryStatus, string> = { ok: 'bg-emerald-500', near: 'bg-amber-500', exceeded: 'bg-red-500' }

export default function Panel() {
  const { month } = useMonth()
  const [view, setView] = useState<MonthView>('compra')
  const [modal, setModal] = useState<{ categoryId?: string } | null>(null)
  const { data, isLoading, error, refetch } = useMonthData(month, view)
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
  const overAssigned = data.items.reduce((a, i) => a + i.amount, 0)
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

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-600">Ver el mes:</span>
          <div className="inline-flex rounded-full bg-slate-100 p-1" role="group" aria-label="Criterio para agrupar los gastos del mes">
            {(['compra', 'pago'] as MonthView[]).map((v) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-full px-4 py-1.5 font-medium transition ${view === v ? 'bg-brand-600 text-white' : 'text-slate-600'}`}>
                Según fecha de {v}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {view === 'compra' ? 'Cuenta las compras hechas en el mes, aunque la tarjeta te las cobre más adelante.' : 'Cuenta lo que sale de tu cuenta este mes, incluidas las compras con tarjeta del mes pasado.'}
        </p>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Disponible del mes" value={formatMoney(summary.income)} hint={`${formatMoney(plan.income)} de ingreso${plan.extraIncome ? ` + ${formatMoney(plan.extraIncome)} extra` : ''}`} />
        <Stat label="Gastado" value={formatMoney(summary.spent)} hint={summary.dailyAverage !== null ? `Promedio diario ${formatMoney(summary.dailyAverage)}` : undefined} />
        <Stat
          highlight
          label="Te queda disponible"
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
              <p className="text-xs text-slate-500">El consumo se registra al comprar; el dinero sale el día {settings.cardPayDay} del mes siguiente.</p>
            </div>
          </div>
          <Link to="/ajustes" className="whitespace-nowrap py-2 text-sm font-medium text-brand-600 hover:underline">
            Cambiar día de pago
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Compras con tarjeta este mes</p>
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
            <Link to="/presupuesto" className="-my-2 inline-block py-2 text-sm font-medium text-brand-600 hover:underline">
              Editar montos
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {progress.map((p) => (
              <li key={p.category.id} className="flex items-center gap-3 py-3">
                <CategoryIcon icon={p.category.icon} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {p.category.name}
                      <span className="flex items-center gap-1 text-xs font-normal text-slate-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[p.status]}`} aria-hidden />
                        {STATUS_LABEL[p.status]}
                      </span>
                    </p>
                    <p className={`num text-sm font-semibold ${p.available < 0 ? 'text-red-600' : ''}`}>
                      {p.available < 0 ? '+' : ''}
                      {formatMoney(Math.abs(p.available))} <span className="text-xs font-normal text-slate-500">{p.available < 0 ? 'excedido' : 'disponible'}</span>
                    </p>
                  </div>
                  <div className="my-1.5">
                    <ProgressBar ratio={p.ratio} tone={STATUS_TONE[p.status]} />
                  </div>
                  <p className="num text-xs text-slate-500">
                    {formatMoney(p.spent)} de {formatMoney(p.budget)}
                    {p.budget > 0 && ` · ${Math.round(p.ratio * 100)} % usado`}
                  </p>
                </div>
                <button onClick={() => setModal({ categoryId: p.category.id })} aria-label={`Registrar gasto en ${p.category.name}`} className="rounded-full p-3 text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:p-2">
                  <Plus className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold">Tu reparto</h2>
            <p className="mb-4 text-xs text-slate-500">
              {formatMoney(overAssigned)} asignados de {formatMoney(summary.income)}
            </p>
            <ul className="space-y-3">
              {groups.map((g) => (
                <li key={g.group}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{GROUP_LABELS[g.group]}</span>
                    <span className="num text-slate-500">
                      {Math.round(g.plannedPct)} % <span className="text-xs">(objetivo {GROUP_TARGETS[g.group]} %)</span>
                    </span>
                  </div>
                  <ProgressBar ratio={g.plannedPct / 100} />
                </li>
              ))}
            </ul>
            <div className={`mt-4 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${unassigned !== 0 ? 'bg-amber-50 text-amber-800' : 'bg-slate-50'}`}>
              <span>{unassigned < 0 ? 'Asignado de más' : 'Sin asignar'}</span>
              <span className="num font-semibold">{formatMoney(Math.abs(unassigned))}</span>
            </div>
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
                      <p className="truncate text-xs text-slate-500">{data.categories.find((c) => c.id === e.categoryId)?.name ?? 'Sin categoría'}</p>
                    </div>
                    <span className="num shrink-0 font-medium">{formatMoney(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <h2 className="font-semibold">Planeado frente a real</h2>
        <p className="mb-1 text-xs text-slate-500">Regla 50/30/20 sobre tu ingreso neto, agrupada en tres bloques. Siempre se calcula sobre la fecha de compra.</p>
        <div className="divide-y divide-slate-100">
          {groups.map((g) => (
            <GroupRow key={g.group} group={g.group} planned={g.planned} actual={g.actual} available={g.available} ratio={g.ratio} />
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">El bloque «Ahorro y deuda» se compara con las aportaciones registradas: habla de lo apartado frente a lo planeado, no de consumo.</p>
      </Card>

      {modal && <ExpenseModal defaultCategoryId={modal.categoryId} onClose={() => setModal(null)} />}
    </>
  )
}

function GroupRow({ group, planned, actual, available, ratio }: { group: Group; planned: number; actual: number; available: number; ratio: number }) {
  const saving = group === 'ahorro'
  const tone = !saving && ratio > 1 ? 'danger' : !saving && ratio > 0.85 ? 'warn' : 'brand'
  return (
    <div className="py-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{GROUP_LABELS[group]}</h3>
        <p className="num text-sm">
          <span className="font-semibold">{formatMoney(actual)}</span> <span className="text-slate-500">de {formatMoney(planned)} planeado</span>
        </p>
      </div>
      <ProgressBar ratio={ratio} tone={tone} />
      <p className="num mt-2 flex flex-wrap gap-x-4 text-xs text-slate-500">
        <span>Planeado: <b className="text-slate-700">{formatMoney(planned)}</b></span>
        <span>{saving ? 'Aportado' : 'Gastado'}: <b className="text-slate-700">{formatMoney(actual)}</b></span>
        <span>{saving ? 'Pendiente de apartar' : 'Disponible'}: <b className="text-slate-700">{formatMoney(Math.max(available, 0))}</b></span>
      </p>
    </div>
  )
}
