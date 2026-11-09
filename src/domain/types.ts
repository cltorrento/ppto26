/** Todos los importes se guardan en céntimos (enteros) para evitar errores de redondeo. */
export type Cents = number

/** Mes en formato 'YYYY-MM'. */
export type MonthKey = string
/** Fecha en formato 'YYYY-MM-DD'. */
export type DateKey = string

export type Group = 'necesidades' | 'gustos' | 'ahorro' | 'deuda'
export type PaymentMethod = 'efectivo' | 'debito' | 'credito' | 'transferencia'

/** ETF cuya rentabilidad se sigue en la sección «ETF», con las aportaciones registradas en una categoría. */
export interface EtfConfig {
  isin: string
  ticker: string
  name: string
  /** Categoría (con sus subcategorías) donde registras tus aportaciones. */
  categoryId: string
  /** Primera fecha a contar. */
  since: DateKey
  /**
   * Posición real que muestra tu broker en `asOf`. Si existe, sustituye a lo estimado hasta esa fecha
   * (las aportaciones hasta `asOf` ya están incluidas) y solo se estiman las posteriores.
   */
  base?: { asOf: DateKey; shares: number; invested: Cents } | null
}

/** Una criptomoneda seguida en la sección «Cripto». Misma lógica que el ETF: aportaciones en una categoría. */
export interface CryptoPosition {
  id: string
  /** Identificador en CoinGecko (bitcoin, ethereum…). */
  coinId: string
  symbol: string
  name: string
  categoryId: string
  since: DateKey
  base?: { asOf: DateKey; shares: number; invested: Cents } | null
  /** Tu objetivo de ganancia (%) y tu nivel de compra (€ por unidad): reglas tuyas para el semáforo, no recomendaciones. */
  targetPct?: number | null
  buyLevel?: number | null
}

export interface Settings {
  /** Día del mes (1-28) en que se cobra la tarjeta de crédito. */
  cardPayDay: number
  /** Ingreso mensual usado como referencia en el plan anual. */
  referenceIncome: Cents
}

export interface Category {
  id: string
  name: string
  group: Group
  icon: string
  sortOrder: number
  /** Categoría padre (un solo nivel). Las subcategorías heredan el bloque 50/30/20 del padre. */
  parentId?: string | null
}

export interface MonthPlan {
  month: MonthKey
  income: Cents
  extraIncome: Cents
  savingsGoal: Cents
}

export interface BudgetItem {
  month: MonthKey
  categoryId: string
  amount: Cents
}

export interface MonthBudget {
  plan: MonthPlan | null
  items: BudgetItem[]
}

export interface Expense {
  id: string
  date: DateKey
  categoryId: string | null
  amount: Cents
  description: string
  method: PaymentMethod
  /** Fecha en que sale el dinero de la cuenta. */
  chargeDate: DateKey
  /** Si el gasto pertenece a la ficha de un terreno: su id y de qué tipo es. */
  propertyId?: string | null
  propertyKind?: PropertyKind | null
  /** En un gasto del terreno: lo pagado en dólares (céntimos). `amount` son los euros que salieron. */
  amountUsd?: Cents | null
  /** True si el gasto es solo histórico: se ve en la ficha del terreno pero no cuenta en Gastos, Panel, presupuesto ni Reportes. */
  outsideBudget?: boolean
}

export interface PlannedExpense {
  id: string
  name: string
  amount: Cents
  year: number
  /** 1-12 */
  month: number
  categoryId: string | null
  repeatsYearly: boolean
}

export const GROUP_LABELS: Record<Group, string> = {
  necesidades: 'Necesidades',
  gustos: 'Gustos',
  ahorro: 'Ahorro',
  deuda: 'Deuda',
}

/** Orden en que se muestran los bloques en toda la app. */
export const GROUP_ORDER: Group[] = ['necesidades', 'deuda', 'gustos', 'ahorro']

export const GROUP_TARGETS: Record<Group, number> = {
  necesidades: 50,
  gustos: 20,
  ahorro: 20,
  deuda: 10,
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  debito: 'Tarjeta de débito',
  credito: 'Tarjeta de crédito',
  transferencia: 'Transferencia',
}

export const DEFAULT_SETTINGS: Settings = { cardPayDay: 15, referenceIncome: 0 }

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Vivienda', group: 'necesidades', icon: 'home', sortOrder: 0 },
  { name: 'Alimentación', group: 'necesidades', icon: 'cart', sortOrder: 1 },
  { name: 'Transporte', group: 'necesidades', icon: 'car', sortOrder: 2 },
  { name: 'Servicios', group: 'necesidades', icon: 'zap', sortOrder: 3 },
  { name: 'Salud', group: 'necesidades', icon: 'heart', sortOrder: 4 },
  { name: 'Ocio', group: 'gustos', icon: 'party', sortOrder: 5 },
  { name: 'Otros', group: 'gustos', icon: 'dots', sortOrder: 6 },
  { name: 'Ahorro', group: 'ahorro', icon: 'piggy', sortOrder: 7 },
]

// ---------- Terreno (ficha de propiedad) ----------

export type PropertyKind = 'cuota' | 'materiales' | 'construccion' | 'otros'

export const PROPERTY_KINDS: PropertyKind[] = ['cuota', 'materiales', 'construccion', 'otros']

export const PROPERTY_KIND_LABELS: Record<PropertyKind, string> = {
  cuota: 'Cuota del terreno',
  materiales: 'Materiales',
  construccion: 'Construcción',
  otros: 'Otros (escrituras, impuestos…)',
}

export interface Property {
  id: string
  name: string
  acquisitionDate: DateKey
  /** Precio total del terreno. */
  price: Cents
  /** Entrada pagada al comprar (se resta del precio para calcular lo financiado). */
  downPayment: Cents
  /** Interés anual en %, por ejemplo 6.5. */
  interestRate: number
  /** Número total de cuotas mensuales. */
  termMonths: number
  /** Cuota mensual. Si es 0 se calcula con precio, interés y plazo. */
  monthlyPayment: Cents
  /** Fecha de la primera cuota; su día es el día de pago de cada mes. */
  firstPaymentDate: DateKey
  /** Cuotas que ya pagaste antes de empezar a registrarlas en la app. */
  initialPaidCount: number
  /** Categoría en la que se registra el gasto de cada tipo (opcional). */
  categoryByKind: Partial<Record<PropertyKind, string | null>>
  notes: string
  /** Cuánto vale hoy el terreno solo, sin lo construido (tu estimación o una tasación). 0 = sin estimar. */
  currentValue?: Cents
  /** Cuánto vale hoy lo construido (materiales y obra). 0 = sin estimar. */
  buildingValue?: Cents
  /** Fecha de esa estimación. */
  valueDate?: DateKey | null
  /** Tipo de cambio habitual: dólares por 1 €, por ejemplo 1.16. Sirve para estimar euros. */
  eurRate?: number
}
