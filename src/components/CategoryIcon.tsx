import { Car, Ellipsis, HeartPulse, House, PartyPopper, PiggyBank, ShoppingCart, Tag, Zap, type LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  home: House,
  cart: ShoppingCart,
  car: Car,
  zap: Zap,
  heart: HeartPulse,
  party: PartyPopper,
  dots: Ellipsis,
  piggy: PiggyBank,
}

export const ICON_KEYS = Object.keys(ICONS)

export function CategoryIcon({ icon, className = '' }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? Tag
  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ${className}`}>
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  )
}
