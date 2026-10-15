-- Fluxus · Eliminar mi cuenta
--
-- Google Play exige que la persona pueda borrar su perfil y todos sus datos desde la app.
-- Borrar el usuario de Supabase Auth elimina en cadena su perfil, cuentas, categorías,
-- movimientos y partes de gastos (todas las tablas lo referencian con "on delete cascade").
-- No se puede deshacer.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
