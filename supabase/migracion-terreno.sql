-- MiPresupuesto: ficha de terreno.
-- Ejecútalo una vez en el SQL Editor de Supabase si tu proyecto ya tenía las tablas.
-- Crea la tabla `properties` y añade dos columnas a `expenses`. No modifica ni borra tus datos.

create table if not exists public.properties (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  acquired_on date not null,
  price_cents bigint not null default 0 check (price_cents >= 0),
  down_payment_cents bigint not null default 0 check (down_payment_cents >= 0),
  interest_rate numeric not null default 0 check (interest_rate >= 0),
  term_months int not null default 0 check (term_months >= 0),
  monthly_payment_cents bigint not null default 0 check (monthly_payment_cents >= 0),
  first_payment_on date not null,
  initial_paid_count int not null default 0 check (initial_paid_count >= 0),
  cat_cuota uuid references public.categories(id) on delete set null,
  cat_materiales uuid references public.categories(id) on delete set null,
  cat_construccion uuid references public.categories(id) on delete set null,
  cat_otros uuid references public.categories(id) on delete set null,
  notes text not null default ''
);

alter table public.expenses add column if not exists property_id uuid references public.properties(id) on delete set null;
alter table public.expenses add column if not exists property_kind text check (property_kind in ('cuota', 'materiales', 'construccion', 'otros'));
create index if not exists expenses_property_idx on public.expenses (property_id);

-- Seguridad por usuario (RLS), igual que el resto de tablas.
alter table public.properties enable row level security;
drop policy if exists "own rows" on public.properties;
create policy "own rows" on public.properties for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
