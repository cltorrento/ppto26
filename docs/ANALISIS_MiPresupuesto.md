> **Documento histórico.** Análisis de la primera versión de la app, generada en Atoms, hecho antes de reescribirla.
> Describe esa versión y sus fallos, no el código de este repositorio. La reescritura corrige los fallos de cálculo
> (sección 4) y construye lo que allí estaba pendiente, salvo Recurrentes, Metas y Reportes.

# Análisis de MiPresupuesto

- **URL:** https://4s7lg8.pub.atoms.world/
- **Fecha de análisis:** 2026-11-04
- **Método:** inspección del HTML, cabeceras HTTP y bundles JS/CSS públicos (la web es una SPA y no muestra contenido sin ejecutar JavaScript). No se ha accedido a código fuente ni al backend.

## 1. ¿Qué hace?

**MiPresupuesto** es una aplicación web de **control de gastos personales**. Según su meta descripción: *"Controla tus gastos personales según tu presupuesto o salario de forma sencilla."* Está en español.

El usuario parte de su sueldo neto o de un presupuesto propio, lo reparte en categorías y va registrando gastos. La app muestra el avance por categoría y avisa cuando se acerca al límite.

### Secciones (rutas de la SPA)

| Ruta | Función |
|---|---|
| `/` | Portada / bienvenida, con opción de explorar con datos de ejemplo |
| `/panel` | Panel mensual: resumen del mes, remanente, progreso por categoría |
| `/presupuesto` | Definir el total del mes, la moneda y el reparto por categorías; propuesta editable **50/30/20** (necesidades / gustos / ahorro) |
| `/gastos` | Registro de gastos (monto, fecha, categoría, método de pago, descripción) con filtro por categoría |
| `/recurrentes` | **No construida aún.** Prevista: suscripciones y servicios que se descuentan cada mes |
| `/metas` | **No construida aún.** Prevista: metas de ahorro (fondo de emergencia, viaje…) con monto y fecha |
| `/plan-anual` | Vista de 12 meses por categoría, capacidad mensual y gastos puntuales programados |
| `/reportes` | **No construida aún.** Prevista: comparativa entre meses, tendencias y exportación de movimientos |
| `/ajustes` | Día de pago de la tarjeta e ingreso de referencia; moneda fija en EUR |
| `/auth/callback`, `/auth/error` | Retorno del inicio de sesión y gestión de errores |

### Funcionalidades destacadas

- **Dos modos de presupuesto:** ingreso salarial (sueldo neto) o presupuesto propio.
- **Regla 50/30/20** con propuesta automática y comparación con lo gastado realmente.
- **Barras de progreso** por categoría, con aviso en texto al acercarse al límite.
- **Categorías** como Alimentación, Transporte, Vivienda, Salud y Ocio, editables.
- **Tarjeta de crédito:** las compras se contabilizan en el mes de compra, pero el cargo se registra el día de pago elegido (1–28) del mes siguiente.
- **Historial por mes:** cada mes conserva su presupuesto.
- **Modo demo:** se puede explorar con datos de ejemplo sin cuenta. Para guardar, borrar o editar hay que **iniciar sesión**.
- **Validaciones** con mensajes claros: la suma asignada no puede superar el total, el monto debe ser mayor que cero, las fechas deben tener formato día/mes/año, etc.

## 2. Tecnologías

### Frontend

| Tecnología | Evidencia |
|---|---|
| **React 18.3.1** | Constante de versión en `ui-vendor` |
| **Vite** | Estructura de build: `index-[hash].js`, `modulepreload` y chunks `ui-vendor`, `utils-vendor`, `query-vendor`, `router-vendor` |
| **React Router** | Chunk `router-vendor` y definición de rutas |
| **TanStack Query (React Query)** | Chunk `query-vendor` |
| **Tailwind CSS** | Variables `--tw-*` en el CSS |
| **Lucide** (iconos) | Referencias a `lucide` en `utils-vendor` |
| **Sonner** (notificaciones toast) | Más de 100 referencias en el bundle principal |
| **GSAP + ScrollTrigger** | Animaciones, con licencia estándar de GSAP referenciada en el bundle |
| **Axios** | Cliente HTTP |
| **localStorage** | Persistencia de preferencias en el navegador |
| **Google Fonts** | Roboto, Roboto Mono y Libre Caslon Text |

### Backend / plataforma

La app está generada y alojada en **Atoms** (`*.pub.atoms.world`, también llamado MGX).

- **Cloudflare** delante, y gateway **Kong 3.9.1** con rate limit de 30 peticiones por segundo.
- Cookie `mgx_vid` para identificar al visitante.
- API REST propia de la plataforma:
  - `/api/v1/auth/*`: login, logout, `me` e intercambio de token (OAuth con `/auth/callback`).
  - `/api/v1/entities/`: CRUD genérico de entidades. Aquí se guardan presupuestos, gastos, metas, etc.
  - `/api/v1/storage/*`: almacenamiento de objetos (buckets, subida y descarga con URL firmada).
  - `/api/v1/aihub/*`: endpoints de IA (texto, imagen, audio, vídeo, transcripción). Están en el SDK, pero no hay evidencia de que la app los use.
  - `/api/config` e `/api/integrations/*`.
- Un script externo de la plataforma (`appPlugins-prod-*.js`) se carga desde `metadl.com`.
- Los activos de imagen (logo y portada) están en el CDN de la plataforma.

## 3. Análisis de las páginas renderizadas (modo demo, sin sesión)

Revisadas en un navegador real: `/panel`, `/gastos`, `/presupuesto` y `/plan-anual`. Sin sesión, la app muestra un mes de ejemplo (noviembre 2026, ingreso de 2.400 €, 8 gastos y 8 categorías).

### / (portada)
Landing de una sola página, con capturas aportadas por el usuario:
- **Cabecera:** enlaces de ancla Cómo funciona, Herramientas y Tus datos, más "Iniciar sesión" y "Abrir mi panel".
- **Hero:** "Lleva tus gastos a partir de tu sueldo o de un presupuesto", con una tarjeta de ejemplo (2.400 € disponibles, 972,65 € gastados, 57 %, Vivienda al 107 %) y los botones "Abrir mi panel" y "Configurar mi presupuesto". Aclara que se puede explorar con datos de ejemplo antes de crear cuenta.
- **Cómo funciona:** tres pasos (define tu mes, reparte el total, registra y ajusta), una foto de stock y el botón "Probarlo ahora".
- **Herramientas:** seis tarjetas: ingreso o presupuesto propio, reparto 50/30/20, progreso por categoría, historial por mes, ahorro a la vista y datos en tu cuenta.
- **Cierre:** llamada a la acción con "Abrir mi panel" e "Iniciar sesión".
- **Pie:** enlaces a Panel, Gastos, Presupuesto y **Metas de ahorro**, además del distintivo "Made by Atoms".

### /panel
- Disponible 2.400 €, gastado 972,65 €, "te queda" 1.027,35 €, consumo 57 %.
- Tarjeta de crédito: consumo del mes 48 €. Cargo del 15 de diciembre: 144,40 € (48 + 96,40 arrastrados del mes anterior).
- Compromisos programados: "Seguro del coche", 400 €, se repite cada año.
- Progreso por categoría: Vivienda excedida (720 de 670 €). El resto está dentro del presupuesto.
- Comparativo 50/30/20: necesidades 927,15 de 1.200 €, gustos 45,50 de 720 € y ahorro 0 de 480 €.

### /gastos
Tabla con fecha, descripción, categoría, método y estado de cobro, monto y acciones. Incluye filtro por categoría y total mensual. Los datos son coherentes con el panel.

### Modal "Registrar gasto" (botón del panel y de /gastos)
Según la captura aportada por el usuario:
- **Campos:** monto en euros, categoría (desplegable con icono; por defecto aparece Ocio), fecha (selector nativo, con formato dd/mm/aaaa), método de pago (por defecto, tarjeta de débito) y descripción opcional.
- **Aviso dinámico de cobro:** "Con tarjeta de débito el cargo sale el 04 nov 2026, el mismo día de la compra". Con tarjeta de crédito se calcula el día de pago del mes siguiente.
- **Botones:** "Cancelar" y "Iniciar sesión para guardar". En modo demo el botón principal no guarda: lleva al login, y toda la creación de gastos depende de que ese login funcione.
- La fecha por defecto es la de hoy (4 nov 2026).

### /presupuesto
Formulario con origen del dinero (ingreso salarial), moneda (EUR, formato español), monto del mes, ingresos extra, meta de ahorro y botón "Sugerir 50/30/20". Hay una fila por categoría, agrupada en Necesidades, Gustos y Ahorro y deuda.

### /plan-anual
Cuadrícula de 12 meses por categoría, capacidad mensual frente al ingreso y formulario de gastos puntuales programados.

### /recurrentes, /metas y /reportes: aún no construidas
Las tres páginas muestran la etiqueta **"Aún no construido"**, un texto de lo que incluirán y los botones "Volver al panel" y "Revisar mi presupuesto". Las funciones descritas en la sección 1 para estas rutas **todavía no existen**:

| Ruta | Lo que promete | Estado |
|---|---|---|
| `/recurrentes` | Renta, internet, streaming y seguros; recordatorio de la fecha de cobro; reserva del monto en el presupuesto | Pendiente |
| `/metas` | Objetivo con monto y fecha; aportes mensuales desde el presupuesto; cuánto falta para llegar | Pendiente |
| `/reportes` | Comparativa mes a mes; tendencias por categoría; **exportación de movimientos** | Pendiente |

Por tanto, la exportación de movimientos no existe todavía. Como los gastos recurrentes tampoco, solo los gastos puntuales del plan anual aportan una reserva.

### /ajustes
- **Tarjeta de crédito:** día de pago de 1 a 28. Las compras se cobran ese día del mes siguiente. Al cambiarlo solo se recalculan los cargos de compras desde hoy, y los meses cerrados se conservan.
- **Ingreso de referencia:** se usa en el plan anual para meses sin presupuesto definido.
- Texto fijo al pie: "Modo de presupuesto: ingreso salarial · moneda fija en euros (EUR)". El botón de guardar dice "Iniciar sesión para guardar".
- No hay ajuste de moneda ni de modo de presupuesto, aunque la sección 1 los daba por existentes. En ajustes la moneda está fija en EUR, y en /presupuesto el selector de moneda existe.

## 4. Problemas detectados

### 4.1 Login (confirmado, parcialmente)
- **El botón "Iniciar sesión" sí funciona hasta cierto punto.** Redirige a `atoms.dev/login`, que ofrece "Continue with Google" o correo electrónico. Es un flujo **OIDC** de la plataforma Atoms: el login no es propio de la app.
- **No he completado el login**: no he introducido credenciales ni creado cuenta. Por tanto no puedo confirmar si falla al volver a la app (`/auth/callback`), si el token se intercambia bien o si la sesión se mantiene.
- Pistas de que algo falla después del login:
  - `GET /api/config` devuelve **403** en todas las páginas.
  - `GET /api/v1/auth/me` devuelve 401 (esperable sin sesión).
  - Hay dos rutas, `/auth/callback` y `/auth/error`, que manejan el retorno. Conviene probarlas con una cuenta real y mirar la consola.

### 4.2 Modo demo incoherente entre páginas
- **/plan-anual** muestra el error *"Authentication credentials were not provided"* con botón "Reintentar". Además queda vacío (0 categorías, 0 € de total, "Sin ingreso definido" en todos los meses). Lanza peticiones reales a:
  - `/api/v1/entities/monthly_plans`
  - `/api/v1/entities/expense_categories`
  - `/api/v1/entities/planned_expenses`

  y todas dan **401**. En cambio, el panel sí muestra datos de ejemplo y el compromiso "Seguro del coche". La demo del plan anual no usa esos datos.
- **/presupuesto**: los montos por categoría están en **0,00 €**, con "Asignado 0,00 €" y "Sin asignar 2.400 €". El panel, en cambio, dice "2.400 € asignados de 2.400 €" y límites por categoría (por ejemplo, Vivienda 670 €). Comprobado en los inputs del DOM: los campos de monto valen "0,00" y el origen del dinero tiene 2.400 € y 480 € de ahorro.
  Un usuario que entre en Presupuesto desde el panel ve el reparto vacío.
- **Tres rutas (Recurrentes, Metas, Reportes) están sin construir.** No salen en el menú de la app (Panel, Gastos, Presupuesto, Plan anual; en móvil, además, "Ajustes de cuenta"). Pero la portada sí enlaza una en el pie de página: **"Metas de ahorro"** (según las capturas), que lleva a una pantalla "Aún no construido". Las otras dos se alcanzan escribiendo la URL.
- **La portada contradice al panel:** la tarjeta de ejemplo muestra la etiqueta "En control" con Vivienda al 107 %, es decir, excedida.
- **/plan-anual se queda cargando:** en la captura aparece un bloque gris vacío donde debería ir la cuadrícula, el texto "Actualizando el año…" junto al botón y el botón "Añadir gasto programado" desactivado. Coincide con los 401 de la API.
- Los textos dicen *"Inicia sesión para…"* en muchas acciones, pero no hay un aviso claro en todas las páginas de que son datos de ejemplo.

### 4.3 Cálculos del panel que no cuadran
- **Consumo 57 % frente a 972,65 € de 2.400 €** (que es el 40,5 %). El 57 % solo sale si se suman los 400 € de reserva del "Seguro del coche": (972,65 + 400) / 2.400 = 57,2 %. Sin embargo, el texto de debajo, "Te queda disponible" (1.027,35 €) y /gastos ignoran esa reserva.
- **"652,65 € por encima del ritmo esperado"** y **"promedio diario 243,16 €"**: el promedio sale de dividir 972,65 € entre 4 días. Con tantos gastos concentrados al inicio del mes, el indicador exagera. Conviene revisar la fórmula.
- El panel dice "1 categoría excedida" mientras el mismo panel afirma "Sin asignar 0,00 €". El reparto está al 100 %, así que cualquier exceso se financia con otras categorías. No es un error, pero el mensaje podría explicarlo.

### 4.4 Otros
- `<html lang="en">` con contenido en español.
- Las rutas sin sesión no redirigen: cargan la SPA y fallan en las llamadas a la API.
- Las llamadas fallidas no tienen estado de error uniforme: unas páginas muestran demo y otras un error crudo del backend.

## 5. Observaciones

- **Es un proyecto generado con una herramienta de IA/no-code** (Atoms). Las meta etiquetas llevan `data-mgx-overview`, y el autor figura como "Atoms".
- **Cabeceras y SEO:** el `<html lang>` es `en`, pero el contenido está en español. Hay un `sitemap.xml` enlazado.
- **Privacidad:** los datos viven en el backend de Atoms, no en el dispositivo. Conviene revisarlo antes de usar la app con datos financieros reales.
- **Limitaciones del análisis:** no se ha iniciado sesión, así que no se han verificado los flujos autenticados ni la lógica de guardado.

## 6. Qué haría falta para un análisis completo

1. Probar el login completo con una cuenta de prueba (hecho por quien administra la app) y capturar la consola y la red en `/auth/callback`.
2. Acceso al proyecto en Atoms (código fuente o exportación) para confirmar el esquema de entidades y la lógica de cálculo.
