-- Sección «ETF»: guarda qué ETF sigues (ISIN, ticker, categoría de tus aportaciones y fecha de inicio).
-- Ejecútalo en Supabase > SQL Editor.
alter table public.settings add column if not exists etf jsonb;
notify pgrst, 'reload schema';
