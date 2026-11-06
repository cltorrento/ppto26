-- MiPresupuesto: el terreno en dólares, con su equivalente en euros.
-- Ejecútalo una vez en el SQL Editor de Supabase, DESPUÉS de migracion-terreno.sql.
-- Solo añade dos columnas: no modifica ni borra tus datos.
--   expenses.amount_usd_cents : lo pagado en dólares en un gasto del terreno (amount_cents son los euros que salieron).
--   properties.eur_rate       : tipo de cambio habitual, dólares por 1 euro (por ejemplo 1.16).

alter table public.expenses add column if not exists amount_usd_cents bigint check (amount_usd_cents is null or amount_usd_cents >= 0);
alter table public.properties add column if not exists eur_rate numeric check (eur_rate is null or eur_rate > 0);
notify pgrst, 'reload schema';
