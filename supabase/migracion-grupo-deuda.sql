-- Cuarto bloque «Deuda» (además de Necesidades, Gustos y Ahorro).
-- Ejecútalo en Supabase > SQL Editor ANTES de asignar el bloque Deuda a una categoría.
alter table public.categories drop constraint if exists categories_grp_check;
alter table public.categories add constraint categories_grp_check
  check (grp in ('necesidades', 'gustos', 'ahorro', 'deuda'));

-- Opcional: pasa «Mas Gastos» y sus subcategorías (CC, Tarjeta Credito, Agos, Otros) al bloque Deuda.
update public.categories set grp = 'deuda'
where lower(name) = 'mas gastos'
   or parent_id in (select id from public.categories where lower(name) = 'mas gastos');

notify pgrst, 'reload schema';
