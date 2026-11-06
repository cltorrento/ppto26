# MiPresupuesto

App web de control de gastos personales: reparte tu sueldo o presupuesto entre categorías (con propuesta 50/30/20),
registra gastos, controla la tarjeta de crédito y planifica el año.

Sustituye a una primera versión generada en la plataforma Atoms: esta se reescribió desde cero, con código propio y
sin depender de ella. El análisis de aquella versión (qué hacía, tecnologías y fallos) está en
[`docs/ANALISIS_MiPresupuesto.md`](docs/ANALISIS_MiPresupuesto.md).

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS 3, lucide-react, sonner
- React Router, TanStack Query, Zod, date-fns
- Vitest para las pruebas de la lógica de dominio
- Datos: **modo local** (localStorage, sin cuenta) o **Supabase** (Postgres + Auth + RLS)

## Servicios utilizados

| Servicio | Para qué se usa |
|---|---|
| **[Supabase](https://supabase.com)** | Base de datos Postgres, autenticación (correo y contraseña) y seguridad por usuario con *Row Level Security*. El esquema está en [`supabase/schema.sql`](supabase/schema.sql). |
| **[Vercel](https://vercel.com)** | Alojamiento del frontend estático. Proyecto `mippto`, desplegado en <https://mippto.vercel.app> con la CLI (`npx vercel --prod`). |
| **[GitHub](https://github.com/cltorrento/ppto26)** | Repositorio del código. |

Supabase no aloja páginas web: solo base de datos y login. El frontend compilado (`dist/`) va en Vercel, que lee las
variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas en el proyecto.

### Cómo se conecta todo

```
Navegador ──► Vercel (HTML/JS/CSS estáticos) 
    │
    └──────► Supabase (API REST + Auth) ── RLS: cada usuario solo ve sus filas
```

La clave `anon`/`publishable` queda incluida en el JavaScript público. Es lo esperado: la protección de los datos la dan
las políticas RLS, no el secreto de la clave. Nunca se debe usar la clave `service_role` en el frontend.

### Desarrollo asistido por IA

El proyecto se construyó con ayuda de **Claude Code** (Anthropic): análisis de la app original, diseño de la
arquitectura, código, pruebas y despliegue.

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

Gastos recurrentes y metas de ahorro (estaban sin construir en la versión de Atoms).

Ya implementado: **Reportes** (`/reportes`) con el resumen anual (ingresos, gastos, ahorro neto y saldo acumulado por mes, con
total y promedio), el gráfico de gasto promedio por categoría, la comparativa de ingresos y gastos por mes y la
exportación de movimientos en CSV.

Ya implementado también: **copiar entre meses** (en Presupuesto): traer los montos de otro mes al formulario (sin guardar) o
copiar el mes guardado a otros meses del año, con confirmación si el destino ya tiene presupuesto.

Ya implementado también: **subcategorías** (un nivel). Una categoría con subcategorías no tiene monto propio: su presupuesto es
la suma de las suyas y su gasto incluye el de ellas. Sin subcategorías funciona como siempre. Al crear la primera, el monto
que tenía pasa a una subcategoría «Otros» (en todos los meses) para que el total no cambie; al borrar la última, la categoría
recupera la suma. Los gastos de una subcategoría borrada pasan a su categoría. En Supabase hay que ejecutar una vez
[`supabase/migracion-subcategorias.sql`](supabase/migracion-subcategorias.sql) (añade la columna `parent_id`).

Ya implementado también: **ficha de terreno** (`/terreno`) para una compra a plazos: precio, entrada, interés anual, número de
cuotas y fecha de la primera. Calcula el plan de cuotas (sistema francés; la cuota se puede escribir a mano), cuántas llevas
pagadas y cuántas faltan, la próxima cuota, la fecha en que terminas y el saldo pendiente. Los pagos, materiales, construcción
y otros gastos se registran dentro de la ficha y **también cuentan como gasto del mes** (son filas de `expenses` con
`property_id`, así no hay doble registro). Muestra lo invertido por tipo y el total. En Supabase hay que ejecutar una vez
[`supabase/migracion-terreno.sql`](supabase/migracion-terreno.sql) (crea la tabla `properties` y dos columnas en `expenses`).

El terreno se lleva **en dólares ($)**. Cada pago guarda los dólares pagados y los **euros que realmente salieron** de tu cuenta
(el gasto del mes, en Gastos y en el presupuesto, sigue siendo en euros). Los totales por año y «Lo invertido» muestran las dos
monedas. La entrada, las cuotas anteriores a la app y lo que falta por pagar se estiman con el tipo de cambio habitual de la
ficha. Requiere [`supabase/migracion-terreno-dolares.sql`](supabase/migracion-terreno-dolares.sql); también existen
`migracion-terreno-valor.sql` y `migracion-terreno-construccion.sql` para el valor del terreno.

## Desplegar

La app es estática (`npm run build` genera `dist/`). Supabase aloja la base de datos y el login, pero **no aloja páginas web**,
así que el frontend va en un hosting estático: Cloudflare Pages, Vercel o Netlify.

1. Sube el proyecto a un repositorio de Git.
2. Crea el proyecto en el hosting con: comando de build `npm run build`, carpeta de salida `dist`.
3. Añade las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (con la clave publishable).
4. En Supabase, *Authentication → URL Configuration*: pon la URL del sitio en *Site URL* y añádela a *Redirect URLs*.

`public/_redirects` (Cloudflare Pages y Netlify) y `vercel.json` hacen que rutas como `/panel` carguen la app al recargar.
