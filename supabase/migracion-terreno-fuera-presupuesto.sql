-- MiPresupuesto: gastos del terreno «fuera del presupuesto» (histórico).
-- Ejecútalo una vez en el SQL Editor de Supabase, DESPUÉS de migracion-terreno-dolares.sql.
-- Añade una columna a `expenses`: no modifica ni borra tus datos.
-- Un gasto con outside_budget = true se ve en la ficha del terreno, pero no cuenta en Gastos, Panel, presupuesto ni Reportes.

alter table public.expenses add column if not exists outside_budget boolean not null default false;
notify pgrst, 'reload schema';
