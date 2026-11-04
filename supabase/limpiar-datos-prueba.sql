-- Borra TODOS los datos de la app (de todos los usuarios) y deja las tablas vacías.
-- Úsalo solo mientras el proyecto tenga únicamente datos de prueba.
-- Las cuentas de usuario no se tocan: se eliminan en Authentication → Users.
truncate table
  public.expenses,
  public.planned_expenses,
  public.budget_items,
  public.month_plans,
  public.categories,
  public.settings;
