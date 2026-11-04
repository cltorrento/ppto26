# MiPresupuesto

App web de control de gastos personales: reparte tu sueldo o presupuesto entre categorías (con propuesta 50/30/20),
registra gastos, controla la tarjeta de crédito y planifica el año. Sin dependencia de plataformas de terceros.

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS 3, lucide-react, sonner
- React Router, TanStack Query, Zod
- Datos: **modo local** (localStorage, sin cuenta) o **Supabase** (Postgres + Auth + RLS)

## Arrancar

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas de la lógica de dominio
npm run build      # compila a dist/
```

Sin configuración, la app funciona en **modo local**: los datos se guardan en tu navegador. En Ajustes puedes exportar
una copia en JSON y cargar datos de ejemplo.

## Usar Supabase (cuentas y datos en la nube)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el *SQL Editor*, ejecuta [`supabase/schema.sql`](supabase/schema.sql). Crea las tablas y las políticas RLS.
3. En *Authentication → Providers*, deja activo *Email*. Si no quieres confirmar el correo, desactiva *Confirm email*.
4. Copia `.env.example` a `.env.local` y rellena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
   (*Project Settings → API*; usa la clave `anon`, nunca la `service_role`).
5. `npm run dev`. Verás la pantalla de inicio de sesión; crea tu cuenta.

La clave `anon` (o `publishable`, el nombre nuevo) es pública por diseño: la seguridad la dan las políticas RLS del esquema.

Verificado con un proyecto real: registro, carga de datos, alta de gastos, persistencia tras recargar, recálculo del día
de pago de la tarjeta, plan anual, guardado desde Presupuesto, cierre de sesión, bloqueo del acceso anónimo por RLS y
aislamiento entre dos usuarios (la segunda cuenta no ve datos, ajustes ni gastos de la primera). Sin verificar: volver a
iniciar sesión con la primera cuenta y borrar gastos o categorías en Supabase.

## Estructura

```
src/
  domain/       Lógica pura y probada: dinero en céntimos, fechas, cobro de tarjeta, resúmenes, 50/30/20
  data/         Repositorio (interfaz), implementación local y Supabase, hooks de TanStack Query
  auth/         Contexto de sesión (no-op en modo local)
  components/   UI compartida, layout, modal de gasto
  pages/        Landing, Login, Panel, Gastos, Presupuesto, PlanAnual, Ajustes
supabase/schema.sql
```

## Decisiones de diseño

- **Dinero en céntimos enteros**: sin errores de redondeo. `parseMoney` acepta `1.234,56` y `1234.56`.
- **Una sola fórmula por dato**: `useMonthData` calcula "gastado", "reservado" y "te queda" una vez, y Panel y Gastos
  muestran el mismo número. Te queda = ingreso − gastado − reservado (gastos programados aún no registrados).
- **Presupuesto mensual como única fuente de verdad**: las celdas del plan anual leen y escriben las mismas partidas
  que la pantalla de Presupuesto.
- **Tarjeta de crédito**: cada gasto guarda su fecha de cobro. Cambiar el día de pago solo recalcula compras de hoy en
  adelante, así los meses cerrados no cambian.

## Pendiente

Gastos recurrentes, metas de ahorro y reportes con exportación de movimientos (estaban sin construir en la versión de Atoms).

## Desplegar

La app es estática (`npm run build` genera `dist/`). Supabase aloja la base de datos y el login, pero **no aloja páginas web**,
así que el frontend va en un hosting estático: Cloudflare Pages, Vercel o Netlify.

1. Sube el proyecto a un repositorio de Git.
2. Crea el proyecto en el hosting con: comando de build `npm run build`, carpeta de salida `dist`.
3. Añade las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (con la clave publishable).
4. En Supabase, *Authentication → URL Configuration*: pon la URL del sitio en *Site URL* y añádela a *Redirect URLs*.

`public/_redirects` (Cloudflare Pages y Netlify) y `vercel.json` hacen que rutas como `/panel` carguen la app al recargar.
