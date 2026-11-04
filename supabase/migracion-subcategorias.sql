-- MiPresupuesto: subcategorías.
-- Ejecútalo una vez en el SQL Editor de Supabase si tu proyecto ya tenía las tablas.
-- Solo añade una columna: no modifica ni borra tus datos.
-- parent_id apunta a la categoría padre (un solo nivel). Si se borra el padre, se borran sus subcategorías.

alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete cascade;

create index if not exists categories_parent_idx on public.categories (parent_id);
