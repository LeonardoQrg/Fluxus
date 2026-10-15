-- Fluxus · Etapa 3 · Configuración inicial
--
-- Durante la configuración inicial la persona carga el saldo de sus cuentas de dinero.
-- Ese saldo es el punto de partida, no un ingreso: se guarda directo en la cuenta.
-- Mientras no termine la configuración puede volver atrás y corregir nombre o monto.

-- Decimales de cada moneda (CLP y COP no usan centavos)
create function private.currency_decimals(p_currency text)
returns integer
language sql
immutable
as $$
  select case when p_currency in ('CLP', 'COP') then 0 else 2 end;
$$;

-- Crea (p_id null) o corrige una cuenta de dinero con su saldo inicial.
-- Solo se puede durante la configuración inicial y en cuentas sin movimientos.
create function public.save_initial_account(p_id uuid, p_name text, p_amount bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_name text;
  v_id   uuid := p_id;
  a      public.accounts;
begin
  perform private.lock_accounts(v_uid);

  if (select onboarding_step from public.profiles where user_id = v_uid) = 'done' then
    perform private.fail('configuracion_terminada', 'La configuración inicial ya terminó.');
  end if;
  if p_amount is null or p_amount < 0 then
    perform private.fail('monto_negativo', 'El monto no puede ser negativo.');
  end if;

  v_name := private.clean_account_name(v_uid, p_name, p_id);

  if v_id is null then
    insert into public.accounts (user_id, name, kind, amount)
    values (v_uid, v_name, 'dinero', p_amount)
    returning id into v_id;
  else
    a := private.get_account(v_uid, p_id, 'dinero');
    if exists (
      select 1 from public.movements m
      where m.user_id = v_uid and a.id in (m.account_id, m.from_account_id, m.to_account_id)
    ) or exists (select 1 from public.movement_parts where account_id = a.id) then
      perform private.fail('cuenta_con_movimientos', format('%s ya tiene movimientos: ajustá el saldo desde Cuentas.', a.name), a.id);
    end if;
    update public.accounts set name = v_name, amount = p_amount where id = a.id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.save_initial_account(uuid, text, bigint) from public, anon;
grant execute on function public.save_initial_account(uuid, text, bigint) to authenticated;

-- La moneda solo se puede cambiar durante la configuración inicial. Si cambia la
-- cantidad de decimales (por ejemplo, de ARS a CLP), los saldos iniciales ya cargados
-- se pasan a la nueva unidad para que sigan mostrando el mismo número.
create or replace function private.lock_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old integer;
  v_new integer;
begin
  if new.currency is distinct from old.currency then
    if old.onboarding_step = 'done' then
      raise exception 'La moneda ya no se puede cambiar.'
        using detail = 'moneda_fija';
    end if;

    v_old := private.currency_decimals(old.currency);
    v_new := private.currency_decimals(new.currency);
    if v_old <> v_new then
      if exists (select 1 from public.movements where user_id = new.user_id) then
        raise exception 'La moneda ya no se puede cambiar porque hay movimientos registrados.'
          using detail = 'moneda_fija';
      end if;
      update public.accounts
      set amount = round(amount * power(10::numeric, v_new - v_old))::bigint
      where user_id = new.user_id;
    end if;
  end if;

  new.name := btrim(new.name);
  return new;
end;
$$;
