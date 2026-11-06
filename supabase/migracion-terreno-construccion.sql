-- MiPresupuesto: valor actual de lo construido (para separar la plusvalía del terreno y de la obra).
-- Ejecútalo una vez en el SQL Editor de Supabase, DESPUÉS de migracion-terreno-valor.sql.
-- Solo añade una columna a `properties`: no modifica ni borra tus datos.

alter table public.properties add column if not exists building_value_cents bigint not null default 0 check (building_value_cents >= 0);
notify pgrst, 'reload schema';
