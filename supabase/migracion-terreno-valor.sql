-- MiPresupuesto: valor actual del terreno (para calcular la plusvalía).
-- Ejecútalo una vez en el SQL Editor de Supabase, DESPUÉS de migracion-terreno.sql.
-- Solo añade dos columnas a `properties`: no modifica ni borra tus datos.

alter table public.properties add column if not exists current_value_cents bigint not null default 0 check (current_value_cents >= 0);
alter table public.properties add column if not exists value_on date;
