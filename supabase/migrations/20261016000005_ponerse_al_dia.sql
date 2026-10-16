-- Fluxus · Ponerme al día y Empezar de cero
--
-- Cuando pasan semanas sin anotar nada, no hace falta acordarse de cada gasto:
--   * catch_up: la persona corrige de una vez lo que hay hoy en cada cuenta y lo que debe.
--     La diferencia se registra como ajustes (el historial se conserva):
--       dinero que bajó   → gasto en la categoría "Sin detallar"
--       dinero que subió  → ingreso
--       lo que se debe    → "monto por pagar actualizado"
--   * reset_my_data: borra movimientos, cuentas y categorías propias y vuelve a la configuración
--     inicial. El perfil (nombre y correo) se mantiene.

-- Categoría donde queda lo que se gastó sin saber en qué
create function private.ensure_category(p_uid uuid, p_name text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.categories where user_id = p_uid and lower(btrim(name)) = lower(p_name);
  if v_id is null then
    insert into public.categories (user_id, name) values (p_uid, p_name) returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- p_items: [{"account_id": "...", "amount": 123400}, ...] con el monto REAL de hoy (unidad mínima)
-- Devuelve cuántas cuentas se ajustaron.
create function public.catch_up(p_items jsonb, p_date date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := private.require_user();
  v_date    date := coalesce(p_date, (now() at time zone 'utc')::date);
  v_item    jsonb;
  v_acc     public.accounts;
  v_amount  numeric;
  v_cat     uuid;
  v_seen    uuid[] := '{}';
  v_count   integer := 0;
begin
  perform private.lock_accounts(v_uid);

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform private.fail('sin_cambios', 'No hay nada para actualizar.');
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item ->> 'account_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(v_item -> 'amount') is distinct from 'number' then
      perform private.fail('dato_invalido', 'Revisá los montos: alguno no es válido.');
    end if;

    v_amount := (v_item ->> 'amount')::numeric;
    if v_amount < 0 or v_amount <> trunc(v_amount) then
      perform private.fail('monto_negativo', 'El monto no puede ser negativo.');
    end if;

    v_acc := private.get_account(v_uid, (v_item ->> 'account_id')::uuid);
    if v_acc.id = any (v_seen) then
      perform private.fail('cuenta_repetida', format('%s aparece dos veces.', v_acc.name), v_acc.id);
    end if;
    v_seen := v_seen || v_acc.id;

    if v_amount::bigint = v_acc.amount then
      continue;
    end if;

    -- Lo que bajó en una cuenta de dinero es un gasto sin detallar
    if v_acc.kind = 'dinero' and v_amount::bigint < v_acc.amount and v_cat is null then
      v_cat := private.ensure_category(v_uid, 'Sin detallar');
    end if;

    perform public.adjust_account(v_acc.id, v_amount::bigint, v_cat, 'Ajuste: ponerme al día', v_date);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    perform private.fail('sin_cambios', 'No cambiaste ningún monto.');
  end if;
  return v_count;
end;
$$;

-- Borra todos los datos de la persona (menos su perfil) y reinicia la configuración inicial.
create function public.reset_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  perform private.lock_accounts(v_uid);

  -- Primero los movimientos (sus partes se borran en cadena), después lo que referencian
  delete from public.movements where user_id = v_uid;
  delete from public.accounts where user_id = v_uid;
  delete from public.categories where user_id = v_uid;

  insert into public.categories (user_id, name, sort_order)
  select v_uid, c.name, c.ord - 1
  from unnest(array['Alimentación', 'Salud', 'Educación', 'Servicios', 'Solidaridad', 'Ocio / Recreación'])
       with ordinality as c (name, ord);

  update public.profiles
  set onboarding_step = 'intro', hide_owe_tip = false
  where user_id = v_uid;
end;
$$;

revoke all on function public.catch_up(jsonb, date), public.reset_my_data() from public, anon;
grant execute on function public.catch_up(jsonb, date), public.reset_my_data() to authenticated;
