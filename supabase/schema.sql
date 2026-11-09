-- MiPresupuesto: esquema para Supabase (Postgres).
-- Ejecútalo una vez en el SQL Editor de tu proyecto de Supabase.
-- Todos los importes son céntimos enteros. Cada fila pertenece a un usuario (user_id) y la
-- seguridad a nivel de fila (RLS) impide que nadie lea o escriba datos de otro usuario.

create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  card_pay_day int not null default 15 check (card_pay_day between 1 and 28),
  reference_income_cents bigint not null default 0 check (reference_income_cents >= 0)
);

create table if not exists public.categories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  grp text not null check (grp in ('necesidades', 'gustos', 'ahorro', 'deuda')),
  icon text not null default 'dots',
  sort_order int not null default 0,
  parent_id uuid references public.categories(id) on delete cascade
);
create index if not exists categories_user_idx on public.categories (user_id, sort_order);

create table if not exists public.month_plans (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  income_cents bigint not null default 0 check (income_cents >= 0),
  extra_income_cents bigint not null default 0 check (extra_income_cents >= 0),
  savings_goal_cents bigint not null default 0 check (savings_goal_cents >= 0),
  primary key (user_id, month)
);

create table if not exists public.budget_items (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  category_id uuid not null references public.categories(id) on delete cascade,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  primary key (user_id, month, category_id)
);

create table if not exists public.expenses (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  spent_on date not null,
  category_id uuid references public.categories(id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0),
  description text not null default '',
  method text not null check (method in ('efectivo', 'debito', 'credito', 'transferencia')),
  charge_on date not null
);
create index if not exists expenses_user_spent_idx on public.expenses (user_id, spent_on);
create index if not exists expenses_user_charge_idx on public.expenses (user_id, charge_on);

create table if not exists public.planned_expenses (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  amount_cents bigint not null check (amount_cents > 0),
  year int not null,
  month int not null check (month between 1 and 12),
  category_id uuid references public.categories(id) on delete set null,
  repeats_yearly boolean not null default false
);
create index if not exists planned_user_idx on public.planned_expenses (user_id, year, month);

-- Ficha de terreno (compra a plazos). Los gastos del terreno son filas de `expenses` con property_id.
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
  notes text not null default '',
  current_value_cents bigint not null default 0 check (current_value_cents >= 0),
  value_on date,
  building_value_cents bigint not null default 0 check (building_value_cents >= 0)
);
alter table public.expenses add column if not exists property_id uuid references public.properties(id) on delete set null;
alter table public.expenses add column if not exists property_kind text check (property_kind in ('cuota', 'materiales', 'construccion', 'otros'));
alter table public.expenses add column if not exists amount_usd_cents bigint check (amount_usd_cents is null or amount_usd_cents >= 0);
alter table public.properties add column if not exists eur_rate numeric check (eur_rate is null or eur_rate > 0);
alter table public.expenses add column if not exists outside_budget boolean not null default false;
create index if not exists expenses_property_idx on public.expenses (property_id);

-- Seguridad a nivel de fila: cada usuario solo ve y modifica sus filas.
do $$
declare t text;
begin
  foreach t in array array['settings', 'categories', 'month_plans', 'budget_items', 'expenses', 'planned_expenses', 'properties']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;
