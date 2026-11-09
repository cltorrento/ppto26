# Versiones desplegadas

Cada despliegue a producción lleva un número (se ve abajo en la app, «v1.1.0»). Para volver atrás, dime la versión
y la restauro con `npx vercel promote <URL del despliegue>` (los datos de Supabase no cambian al volver atrás).
Si una versión necesitó SQL, se indica: volver atrás no deshace el SQL (las columnas nuevas no estorban a versiones viejas).

| Versión | Fecha | Despliegue (URL) | Qué incluye |
|---|---|---|---|
| v1.0.0 | 2026-11-06 | https://mippto-16gcfhvui-carlos-projects-26ce378d.vercel.app | Línea base: la que estaba publicada al empezar la numeración (Reportes sin proyección, ceros como «–», monto del mes en 0, editar gastos, gastos agrupados por categoría). Sin número visible en la app. |
| v1.1.0 | 2026-11-06 | https://mippto-14hye5e2v-carlos-projects-26ce378d.vercel.app | Número de versión visible. Reportes: desde el mes en curso, las categorías sin gastos cuentan lo presupuestado como gasto supuesto; con gastos, lo real. |
| v1.2.0 | 2026-11-09 | https://mippto-qbu2kx45f-carlos-projects-26ce378d.vercel.app | Panel, «Tu reparto»: raya con el objetivo 50/30/20 en cada barra; el relleno muestra dónde estás. |
| v1.3.0 | 2026-11-09 | https://mippto-5806o0gwp-carlos-projects-26ce378d.vercel.app | Tarjeta de crédito: campo «Se cobra el» en el formulario; desde 2026-11-01 esas compras cuentan en el mes de cobro (octubre intacto). Quitado el interruptor Compra/Pago del Panel. |
| v1.4.0 | 2026-11-09 | https://mippto-gk0d4764x-carlos-projects-26ce378d.vercel.app | Panel, «Tu reparto»: por grupo, barra de presupuestado y barra de gastado, con raya del objetivo y «te quedan / te pasaste». |
| v2.0.0 | 2026-11-09 | https://mippto-epack24vf-carlos-projects-26ce378d.vercel.app | Cuarto bloque Deuda (necesita supabase/migracion-grupo-deuda.sql); vocabulario unificado (Objetivo, Presupuestado, Gastado, Disponible/Excedido); Panel «Tu reparto» con objetivo en euros; Reportes con filas Presupuestado, Gastado y Disponible y ahorro previsto en cursiva. |
| v2.1.0 | 2026-11-09 | https://mippto-fy3jdv1wx-carlos-projects-26ce378d.vercel.app | Objetivos 50/20/20/10 (Necesidades, Gustos, Ahorro, Deuda). |
| v2.1.1 | 2026-11-09 | https://mippto-7anby15ko-carlos-projects-26ce378d.vercel.app | Gastos: las categorías salen recogidas por defecto. |
| v2.2.0 | 2026-11-09 | https://mippto-rbpffzgfb-carlos-projects-26ce378d.vercel.app | Orden de bloques en toda la app: Necesidades, Deuda, Gustos, Ahorro. |
| v2.2.1 | 2026-11-09 | https://mippto-8ng1hrrnt-carlos-projects-26ce378d.vercel.app | Reportes: fila Disponible = ingresos − gastado (igual que el Panel), sin texto entre paréntesis. |
| v2.3.0 | 2026-11-09 | https://mippto-2jqfny8bx-carlos-projects-26ce378d.vercel.app | Sección ETF: rentabilidad con tus aportaciones y precios de Yahoo Finance (función api/etf.js). Necesita supabase/migracion-etf.sql. |
| v2.4.0 | 2026-11-09 | https://mippto-8ur6il3up-carlos-projects-26ce378d.vercel.app | Menú lateral (iconos y texto en escritorio, iconos en tablet); cabecera solo con el selector de mes. |
| v2.4.1 | 2026-11-09 | https://mippto-fncnh2vff-carlos-projects-26ce378d.vercel.app | ETF: el botón Actualizar vuelve a leer las aportaciones y los precios (sin caché) y avisa. |
| v2.5.0 | 2026-11-09 | https://mippto-41l250win-carlos-projects-26ce378d.vercel.app | ETF: «Ajustar con mi broker» (participaciones y aportado reales a una fecha; solo se estima lo posterior). |
| v2.5.1 | 2026-11-09 | https://mippto-e0vq1hmrk-carlos-projects-26ce378d.vercel.app | ETF: aviso de mercado abierto/cerrado y participaciones con 5 decimales. |
| v2.5.2 | 2026-11-09 | https://mippto-e13xlp4y4-carlos-projects-26ce378d.vercel.app | ETF: «mercado cerrado» solo en Precio actual; % de la ganancia más grande. |
| v2.6.0 | 2026-11-10 | https://mippto-hf4huf4o5-carlos-projects-26ce378d.vercel.app | Sección Cripto: aportaciones por categoría, precios en euros de CoinGecko (api/crypto.js), miedo y codicia, ajuste con la plataforma. Necesita supabase/migracion-cripto.sql. |
| v2.7.0 | 2026-11-10 | https://mippto-8r141kssp-carlos-projects-26ce378d.vercel.app | Cripto: monitor de mercado BTC/ETH/SOL (variaciones 24h/7d/30d/90d, tendencia, rango 90 d, volatilidad, miedo y codicia) y niveles propios (objetivo de ganancia, nivel de compra) con semáforo. |
