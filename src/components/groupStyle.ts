import type { Group } from '@/domain/types'

/** Un color por bloque 50/30/20 para reconocerlo de un vistazo en todas las pantallas. */
export const GROUP_STYLE: Record<Group, { chip: string; bar: string; dot: string; soft: string; border: string; text: string }> = {
  necesidades: { chip: 'bg-sky-100 text-sky-700', bar: 'bg-sky-500', dot: 'bg-sky-500', soft: 'bg-sky-50', border: 'border-l-sky-500', text: 'text-sky-700' },
  gustos: { chip: 'bg-fuchsia-100 text-fuchsia-700', bar: 'bg-fuchsia-500', dot: 'bg-fuchsia-500', soft: 'bg-fuchsia-50', border: 'border-l-fuchsia-500', text: 'text-fuchsia-700' },
  deuda: { chip: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500', dot: 'bg-orange-500', soft: 'bg-orange-50', border: 'border-l-orange-500', text: 'text-orange-700' },
  ahorro: { chip: 'bg-teal-100 text-teal-700', bar: 'bg-teal-500', dot: 'bg-teal-500', soft: 'bg-teal-50', border: 'border-l-teal-500', text: 'text-teal-700' },
}
