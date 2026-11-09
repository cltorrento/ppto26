-- Sección «Cripto»: guarda las criptomonedas que sigues (moneda, categoría de tus aportaciones, fecha de inicio y ajuste).
-- Ejecútalo en Supabase > SQL Editor.
alter table public.settings add column if not exists crypto jsonb;
notify pgrst, 'reload schema';
