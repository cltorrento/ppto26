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
  grp text not null check (grp in ('necesidades', 'gustos', 'ahorro')),
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

-- Seguridad a nivel de fila: cada usuario solo ve y modifica sus filas.
do $$
declare t text;
begin
  foreach t in array array['settings', 'categories', 'month_plans', 'budget_items', 'expenses', 'planned_expenses']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;
