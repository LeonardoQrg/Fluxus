-- Fluxus · Etapa 1 · Funciones del servidor (RPC)
--
-- Toda operación que cambia saldos pasa por acá. Cada función corre en una sola transacción:
-- si algo falla (por ejemplo, una cuenta quedaría en negativo), no se guarda nada.
--
-- Cómo se llaman desde la app:  supabase.rpc('register_movement', { p_type: 'ingreso', ... })
--
-- Errores: todos usan
--   message → texto amable para mostrar tal cual
--   detail  → código estable para que la app decida qué hacer (ej. 'saldo_negativo')
--   hint    → id de la cuenta involucrada, cuando hay una

-- ===========================================================================
-- Ayudantes privados (la app no los puede llamar)
-- ===========================================================================

create function private.fail(p_code text, p_message text, p_account_id uuid default null)
returns void
language plpgsql
as $$
begin
  raise exception using
    message = p_message,
    detail = p_code,
    hint = coalesce(p_account_id::text, '');
end;
$$;

-- Devuelve el usuario con sesión iniciada, o corta si no hay sesión
create function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform private.fail('sin_sesion', 'Tenés que iniciar sesión.');
  end if;
  return v_uid;
end;
$$;

-- Bloquea las cuentas del usuario hasta el final de la transacción, para que dos operaciones
-- al mismo tiempo no pisen los saldos.
create function private.lock_accounts(p_uid uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.accounts where user_id = p_uid order by id for update;
end;
$$;

-- "Hoy" con un día de tolerancia: el servidor está en UTC y en algunos países el día
-- local ya cambió. La app siempre manda la fecha local y no ofrece fechas futuras.
create function private.max_date()
returns date
language sql
stable
as $$
  select (now() at time zone 'utc')::date + 1;
$$;

-- Busca una cuenta activa del usuario y, si se pide, verifica su tipo
create function private.get_account(p_uid uuid, p_id uuid, p_kind text default null)
returns public.accounts
language plpgsql
set search_path = ''
as $$
declare
  a public.accounts;
begin
  if p_id is null then
    perform private.fail('falta_cuenta', 'Elegí una cuenta.');
  end if;

  select * into a from public.accounts where id = p_id and user_id = p_uid;
  if not found then
    perform private.fail('cuenta_inexistente', 'No encontramos esa cuenta.');
  end if;

  if a.deleted_at is not null then
    perform private.fail('cuenta_eliminada', format('La cuenta %s fue eliminada.', a.name), a.id);
  end if;

  if p_kind is not null and a.kind <> p_kind then
    perform private.fail(
      'tipo_de_cuenta',
      case p_kind
        when 'dinero' then format('%s no es una cuenta de dinero.', a.name)
        else format('%s no es algo por pagar.', a.name)
      end,
      a.id);
  end if;

  return a;
end;
$$;

-- Nombre de cuenta limpio y sin repetir entre las cuentas activas
create function private.clean_account_name(p_uid uuid, p_name text, p_except uuid default null)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_name = '' then
    perform private.fail('falta_nombre', 'Escribí un nombre para la cuenta.');
  end if;
  if length(v_name) > 60 then
    perform private.fail('nombre_largo', 'El nombre es muy largo (máximo 60 letras).');
  end if;
  if exists (
    select 1 from public.accounts
    where user_id = p_uid and deleted_at is null
      and lower(btrim(name)) = lower(v_name)
      and id is distinct from p_except
  ) then
    perform private.fail('nombre_repetido', 'Ya tenés una cuenta con ese nombre.');
  end if;
  return v_name;
end;
$$;

-- Aplica (p_sign = 1) o revierte (p_sign = -1) el efecto de un movimiento sobre los saldos.
-- Es la tabla "Efecto de cada movimiento al registrarse" de la especificación.
create function private.apply_movement(p_id uuid, p_sign integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  m public.movements;
begin
  select * into m from public.movements where id = p_id;

  case m.type
    when 'ingreso' then
      -- Sube la cuenta de dinero elegida
      update public.accounts set amount = amount + p_sign * m.amount where id = m.account_id;

    when 'gasto' then
      -- Cada parte: baja la cuenta de dinero, o sube lo que se debe en la tarjeta
      update public.accounts a
      set amount = a.amount + p_sign * p.amount * (case when a.kind = 'dinero' then -1 else 1 end)
      from public.movement_parts p
      where p.movement_id = m.id and a.id = p.account_id;

    when 'pago' then
      -- Baja la cuenta de origen y baja lo que se debe
      update public.accounts set amount = amount - p_sign * m.amount
      where id in (m.from_account_id, m.to_account_id);

    when 'transfer' then
      update public.accounts set amount = amount - p_sign * m.amount where id = m.from_account_id;
      update public.accounts set amount = amount + p_sign * m.amount where id = m.to_account_id;

    when 'nuevo_pagar' then
      update public.accounts set amount = amount + p_sign * m.amount where id = m.to_account_id;

    when 'ajuste_pagar' then
      update public.accounts set amount = amount + p_sign * m.delta where id = m.to_account_id;
  end case;
end;
$$;

-- La regla madre: ninguna cuenta puede quedar en negativo.
-- Se revisa al final de cada operación (en el medio de una edición puede haber negativos
-- transitorios, por ejemplo al revertir un ingreso antes de aplicar el nuevo).
create function private.check_balances(p_uid uuid, p_context text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  a record;
  v_msg text;
begin
  select id, name, kind into a
  from public.accounts
  where user_id = p_uid and amount < 0
  order by created_at, id
  limit 1;

  if not found then
    return;
  end if;

  v_msg := case
    when p_context = 'eliminar' then
      format('No se puede eliminar: %s quedaría en negativo, porque ese dinero ya se usó en otros movimientos.', a.name)
    when p_context = 'editar' then
      format('Con este cambio, %s quedaría en negativo. Revisá los montos o las cuentas.', a.name)
    when a.kind = 'pagar' then
      format('El monto supera lo que debés en %s.', a.name)
    else
      format('En %s no alcanza el saldo. Ninguna cuenta puede quedar en negativo.', a.name)
  end;

  perform private.fail('saldo_negativo', v_msg, a.id);
end;
$$;

-- ¿El movimiento toca alguna cuenta eliminada?
create function private.touches_deleted(p_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.movements m
    join public.accounts a
      on a.id in (m.account_id, m.from_account_id, m.to_account_id)
    where m.id = p_id and a.deleted_at is not null
  ) or exists (
    select 1
    from public.movement_parts p
    join public.accounts a on a.id = p.account_id
    where p.movement_id = p_id and a.deleted_at is not null
  );
$$;

-- Valida los datos de un movimiento y lo guarda (nuevo si p_id es null, o reemplaza uno existente).
-- No toca saldos: eso lo hace apply_movement.
create function private.write_movement(
  p_uid             uuid,
  p_id              uuid,
  p_type            text,
  p_amount          bigint,
  p_date            date,
  p_description     text,
  p_category_id     uuid,
  p_account_id      uuid,
  p_from_account_id uuid,
  p_to_account_id   uuid,
  p_delta           bigint,
  p_parts           jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id          uuid := p_id;
  v_amount      bigint := p_amount;
  v_description text := left(btrim(coalesce(p_description, '')), 200);
  v_part        jsonb;
  v_part_acc    public.accounts;
  v_part_amount numeric;
  v_part_ids    uuid[] := '{}';
  v_part_amts   bigint[] := '{}';
  v_total       bigint := 0;
  v_from        public.accounts;
begin
  if p_type is null or p_type not in ('ingreso', 'gasto', 'pago', 'transfer', 'nuevo_pagar', 'ajuste_pagar') then
    perform private.fail('tipo_invalido', 'Ese tipo de movimiento no existe.');
  end if;

  -- Monto: en ajuste_pagar sale del delta (con signo); en el resto, mayor a cero
  if p_type = 'ajuste_pagar' then
    if p_delta is null or p_delta = 0 then
      perform private.fail('monto_invalido', 'El nuevo monto es igual al que ya tenías.');
    end if;
    v_amount := abs(p_delta);
  elsif v_amount is null or v_amount <= 0 then
    perform private.fail('monto_invalido', 'El monto tiene que ser mayor a cero.');
  end if;

  if p_date is null then
    perform private.fail('falta_fecha', 'Elegí una fecha.');
  end if;
  if p_date > private.max_date() then
    perform private.fail('fecha_futura', 'La fecha no puede ser futura.');
  end if;

  -- Cuentas y categoría según el tipo
  case p_type
    when 'ingreso' then
      perform private.get_account(p_uid, p_account_id, 'dinero');

    when 'gasto' then
      if p_category_id is null
         or not exists (select 1 from public.categories where id = p_category_id and user_id = p_uid) then
        perform private.fail('falta_categoria', 'Elegí una categoría.');
      end if;

      if p_parts is null or jsonb_typeof(p_parts) <> 'array' or jsonb_array_length(p_parts) = 0 then
        perform private.fail('falta_cuenta', 'Elegí con qué cuenta pagaste.');
      end if;

      for v_part in select value from jsonb_array_elements(p_parts) loop
        if jsonb_typeof(v_part) <> 'object'
           or coalesce(v_part ->> 'account_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
          perform private.fail('falta_cuenta', 'Elegí una cuenta en cada fila del pago.');
        end if;

        if jsonb_typeof(v_part -> 'amount') is distinct from 'number' then
          perform private.fail('parte_invalida', 'Cada cuenta del pago necesita un monto mayor a cero.');
        end if;
        v_part_amount := (v_part ->> 'amount')::numeric;
        if v_part_amount <= 0 or v_part_amount <> trunc(v_part_amount) then
          perform private.fail('parte_invalida', 'Cada cuenta del pago necesita un monto mayor a cero.');
        end if;

        v_part_acc := private.get_account(p_uid, (v_part ->> 'account_id')::uuid);
        if v_part_acc.id = any (v_part_ids) then
          perform private.fail('cuenta_repetida',
            format('%s aparece dos veces en el pago. Usá cada cuenta una sola vez.', v_part_acc.name),
            v_part_acc.id);
        end if;

        v_part_ids := v_part_ids || v_part_acc.id;
        v_part_amts := v_part_amts || v_part_amount::bigint;
        v_total := v_total + v_part_amount::bigint;
      end loop;

      if v_total <> v_amount then
        perform private.fail('reparto_incompleto', 'La suma de las cuentas tiene que ser igual al total del gasto.');
      end if;

    when 'pago' then
      v_from := private.get_account(p_uid, p_from_account_id, 'dinero');
      perform private.get_account(p_uid, p_to_account_id, 'pagar');

    when 'transfer' then
      v_from := private.get_account(p_uid, p_from_account_id, 'dinero');
      perform private.get_account(p_uid, p_to_account_id, 'dinero');
      if p_from_account_id = p_to_account_id then
        perform private.fail('misma_cuenta', 'Elegí dos cuentas distintas.');
      end if;

    when 'nuevo_pagar', 'ajuste_pagar' then
      perform private.get_account(p_uid, p_to_account_id, 'pagar');
  end case;

  -- Guardar (solo los campos que usa cada tipo)
  if v_id is null then
    insert into public.movements (
      user_id, type, amount, date, description,
      category_id, account_id, from_account_id, to_account_id, delta)
    values (
      p_uid, p_type, v_amount, p_date, v_description,
      case when p_type = 'gasto' then p_category_id end,
      case when p_type = 'ingreso' then p_account_id end,
      case when p_type in ('pago', 'transfer') then p_from_account_id end,
      case when p_type in ('pago', 'transfer', 'nuevo_pagar', 'ajuste_pagar') then p_to_account_id end,
      case when p_type = 'ajuste_pagar' then p_delta end)
    returning id into v_id;
  else
    -- Al editar no cambia el tipo: solo se reemplazan los datos
    update public.movements set
      amount      = v_amount,
      date        = p_date,
      description = v_description,
      category_id = case when p_type = 'gasto' then p_category_id end,
      account_id  = case when p_type = 'ingreso' then p_account_id end
    where id = v_id;
  end if;

  delete from public.movement_parts where movement_id = v_id;
  if p_type = 'gasto' then
    insert into public.movement_parts (movement_id, user_id, account_id, amount)
    select v_id, p_uid, x.account_id, x.amount
    from unnest(v_part_ids, v_part_amts) as x (account_id, amount);
  end if;

  return v_id;
end;
$$;

-- ===========================================================================
-- Movimientos (lo que llama la app)
-- ===========================================================================

-- Registrar un movimiento. Campos según el tipo:
--   ingreso      p_amount, p_account_id (dinero)
--   gasto        p_amount, p_category_id, p_parts = [{"account_id": "...", "amount": 1000}, ...]
--   pago         p_amount, p_from_account_id (dinero), p_to_account_id (por pagar)
--   transfer     p_amount, p_from_account_id, p_to_account_id (ambas de dinero)
--   nuevo_pagar  p_amount, p_to_account_id (por pagar)
--   ajuste_pagar p_delta (con signo), p_to_account_id (por pagar)
create function public.register_movement(
  p_type            text,
  p_date            date,
  p_amount          bigint default null,
  p_description     text default '',
  p_category_id     uuid default null,
  p_account_id      uuid default null,
  p_from_account_id uuid default null,
  p_to_account_id   uuid default null,
  p_delta           bigint default null,
  p_parts           jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_id  uuid;
begin
  perform private.lock_accounts(v_uid);

  v_id := private.write_movement(
    v_uid, null, p_type, p_amount, p_date, p_description,
    p_category_id, p_account_id, p_from_account_id, p_to_account_id, p_delta, p_parts);

  perform private.apply_movement(v_id, 1);
  perform private.check_balances(v_uid, 'registrar');
  return v_id;
end;
$$;

-- Editar un ingreso o un gasto: se revierte el original, se aplica el nuevo y,
-- si alguna cuenta queda en negativo, se rechaza todo.
create function public.update_movement(
  p_id          uuid,
  p_date        date,
  p_amount      bigint,
  p_description text default '',
  p_category_id uuid default null,
  p_account_id  uuid default null,
  p_parts       jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  m     public.movements;
begin
  perform private.lock_accounts(v_uid);

  select * into m from public.movements where id = p_id and user_id = v_uid for update;
  if not found then
    perform private.fail('movimiento_inexistente', 'No encontramos ese movimiento.');
  end if;

  if m.type not in ('ingreso', 'gasto') then
    perform private.fail('no_editable', 'Solo se pueden editar ingresos y gastos. Este movimiento se puede eliminar y volver a registrar.');
  end if;

  if private.touches_deleted(m.id) then
    perform private.fail('cuenta_eliminada', 'Este movimiento usa una cuenta eliminada y ya no se puede cambiar.');
  end if;

  perform private.apply_movement(m.id, -1);

  perform private.write_movement(
    v_uid, m.id, m.type, p_amount, p_date, p_description,
    p_category_id, p_account_id, null, null, null, p_parts);

  perform private.apply_movement(m.id, 1);
  perform private.check_balances(v_uid, 'editar');
end;
$$;

-- Eliminar un movimiento: se revierte su efecto. Si deja una cuenta en negativo
-- (porque ese dinero ya se usó), no se permite.
create function public.delete_movement(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  m     public.movements;
begin
  perform private.lock_accounts(v_uid);

  select * into m from public.movements where id = p_id and user_id = v_uid for update;
  if not found then
    perform private.fail('movimiento_inexistente', 'No encontramos ese movimiento.');
  end if;

  if private.touches_deleted(m.id) then
    perform private.fail('cuenta_eliminada', 'Este movimiento usa una cuenta eliminada y ya no se puede eliminar.');
  end if;

  perform private.apply_movement(m.id, -1);
  perform private.check_balances(v_uid, 'eliminar');

  delete from public.movements where id = m.id;
end;
$$;

-- ===========================================================================
-- Cuentas (lo que llama la app)
-- ===========================================================================

-- Crear una cuenta.
--   dinero: p_amount es el saldo inicial (puede ser 0).
--   pagar:  p_owe_type obligatorio; si p_amount > 0 se registra "Anotado por pagar".
create function public.create_account(
  p_name     text,
  p_kind     text default 'dinero',
  p_owe_type text default null,
  p_amount   bigint default 0,
  p_date     date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := private.require_user();
  v_name   text;
  v_amount bigint := coalesce(p_amount, 0);
  v_id     uuid;
  v_mov    uuid;
begin
  perform private.lock_accounts(v_uid);
  v_name := private.clean_account_name(v_uid, p_name);

  if p_kind is null or p_kind not in ('dinero', 'pagar') then
    perform private.fail('tipo_de_cuenta', 'Ese tipo de cuenta no existe.');
  end if;
  if p_kind = 'pagar' and (p_owe_type is null or p_owe_type not in ('tarjeta', 'cuotas', 'persona', 'otro')) then
    perform private.fail('falta_tipo_deuda', 'Elegí qué tipo de cosa por pagar es.');
  end if;
  if v_amount < 0 then
    perform private.fail('monto_negativo', 'El monto no puede ser negativo.');
  end if;

  insert into public.accounts (user_id, name, kind, owe_type, amount)
  values (
    v_uid, v_name, p_kind,
    case when p_kind = 'pagar' then p_owe_type end,
    case when p_kind = 'dinero' then v_amount else 0 end)
  returning id into v_id;

  if p_kind = 'pagar' and v_amount > 0 then
    v_mov := private.write_movement(
      v_uid, null, 'nuevo_pagar', v_amount, coalesce(p_date, (now() at time zone 'utc')::date), '',
      null, null, null, v_id, null, null);
    perform private.apply_movement(v_mov, 1);
  end if;

  return v_id;
end;
$$;

create function public.rename_account(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  perform private.lock_accounts(v_uid);
  perform private.get_account(v_uid, p_id);
  update public.accounts
  set name = private.clean_account_name(v_uid, p_name, p_id)
  where id = p_id;
end;
$$;

-- Ajustar el saldo de una cuenta a un monto nuevo. Nunca se edita el número directo:
--   dinero, baja → gasto (categoría obligatoria, "Ajuste de saldo" por defecto)
--   dinero, sube → ingreso ("Ajuste de saldo" por defecto)
--   pagar        → ajuste_pagar (sube o baja lo que se debe)
-- Devuelve el id del movimiento creado (null si el monto no cambió).
create function public.adjust_account(
  p_id          uuid,
  p_new_amount  bigint,
  p_category_id uuid default null,
  p_description text default null,
  p_date        date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  a      public.accounts;
  v_diff bigint;
  v_desc text;
  v_date date := coalesce(p_date, (now() at time zone 'utc')::date);
  v_mov  uuid;
begin
  perform private.lock_accounts(v_uid);
  a := private.get_account(v_uid, p_id);

  if p_new_amount is null or p_new_amount < 0 then
    perform private.fail('monto_negativo', 'El monto no puede ser negativo.');
  end if;

  v_diff := p_new_amount - a.amount;
  if v_diff = 0 then
    return null;
  end if;

  v_desc := coalesce(nullif(btrim(p_description), ''), case when a.kind = 'dinero' then 'Ajuste de saldo' else '' end);

  if a.kind = 'pagar' then
    v_mov := private.write_movement(
      v_uid, null, 'ajuste_pagar', null, v_date, v_desc,
      null, null, null, a.id, v_diff, null);
  elsif v_diff > 0 then
    v_mov := private.write_movement(
      v_uid, null, 'ingreso', v_diff, v_date, v_desc,
      null, a.id, null, null, null, null);
  else
    v_mov := private.write_movement(
      v_uid, null, 'gasto', -v_diff, v_date, v_desc,
      p_category_id, null, null, null, null,
      jsonb_build_array(jsonb_build_object('account_id', a.id, 'amount', -v_diff)));
  end if;

  perform private.apply_movement(v_mov, 1);
  perform private.check_balances(v_uid, 'registrar');
  return v_mov;
end;
$$;

-- Eliminar una cuenta (se marca con deleted_at; su historial sigue visible).
--   * Con saldo cero: se elimina.
--   * De dinero con saldo: se mueve a p_dest_account_id, o a una cuenta nueva llamada
--     p_new_account_name, con una transferencia "Cierre de …".
--   * Por pagar con deuda pendiente: primero hay que registrar el pago.
--   * Nunca se elimina la última cuenta de dinero.
create function public.delete_account(
  p_id               uuid,
  p_dest_account_id  uuid default null,
  p_new_account_name text default null,
  p_date             date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  a      public.accounts;
  v_dest uuid := p_dest_account_id;
  v_mov  uuid;
begin
  perform private.lock_accounts(v_uid);
  a := private.get_account(v_uid, p_id);

  if a.kind = 'dinero' and not exists (
    select 1 from public.accounts
    where user_id = v_uid and kind = 'dinero' and deleted_at is null and id <> a.id
  ) then
    perform private.fail('ultima_cuenta', 'No podés eliminar tu única cuenta de dinero.', a.id);
  end if;

  if a.kind = 'pagar' and a.amount > 0 then
    perform private.fail('deuda_pendiente',
      format('Todavía tenés algo por pagar en %s. Registrá el pago antes de eliminarla.', a.name), a.id);
  end if;

  if a.kind = 'dinero' and a.amount > 0 then
    if v_dest is null and nullif(btrim(p_new_account_name), '') is not null then
      insert into public.accounts (user_id, name, kind, amount)
      values (v_uid, private.clean_account_name(v_uid, p_new_account_name), 'dinero', 0)
      returning id into v_dest;
    end if;

    if v_dest is null then
      perform private.fail('falta_destino',
        format('La cuenta %s tiene dinero. Elegí a qué cuenta moverlo antes de eliminarla.', a.name), a.id);
    end if;

    v_mov := private.write_movement(
      v_uid, null, 'transfer', a.amount, coalesce(p_date, (now() at time zone 'utc')::date),
      'Cierre de ' || a.name, null, null, a.id, v_dest, null, null);
    perform private.apply_movement(v_mov, 1);
  end if;

  update public.accounts set deleted_at = now() where id = a.id;
  perform private.check_balances(v_uid, 'registrar');
end;
$$;

-- ===========================================================================
-- Informe
-- Solo cuentan ingresos y gastos: pagos, transferencias y deudas anotadas no,
-- para no contar dos veces. Un gasto con tarjeta cuenta en el mes de la compra.
-- ===========================================================================

create view public.report_month
with (security_invoker = true)
as
select
  user_id,
  date_trunc('month', date)::date as month,
  coalesce(sum(amount) filter (where type = 'ingreso'), 0)::bigint as income,
  coalesce(sum(amount) filter (where type = 'gasto'), 0)::bigint as expense
from public.movements
where type in ('ingreso', 'gasto')
group by user_id, date_trunc('month', date);

create view public.report_category_month
with (security_invoker = true)
as
select
  m.user_id,
  date_trunc('month', m.date)::date as month,
  m.category_id,
  sum(m.amount)::bigint as total
from public.movements m
where m.type = 'gasto'
group by m.user_id, date_trunc('month', m.date), m.category_id;

revoke all on public.report_month, public.report_category_month from anon, authenticated;
grant select on public.report_month, public.report_category_month to authenticated;

-- ===========================================================================
-- Permisos de las funciones
-- ===========================================================================
revoke all on schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

revoke all on function
  public.register_movement(text, date, bigint, text, uuid, uuid, uuid, uuid, bigint, jsonb),
  public.update_movement(uuid, date, bigint, text, uuid, uuid, jsonb),
  public.delete_movement(uuid),
  public.create_account(text, text, text, bigint, date),
  public.rename_account(uuid, text),
  public.adjust_account(uuid, bigint, uuid, text, date),
  public.delete_account(uuid, uuid, text, date)
from public, anon;

grant execute on function
  public.register_movement(text, date, bigint, text, uuid, uuid, uuid, uuid, bigint, jsonb),
  public.update_movement(uuid, date, bigint, text, uuid, uuid, jsonb),
  public.delete_movement(uuid),
  public.create_account(text, text, text, bigint, date),
  public.rename_account(uuid, text),
  public.adjust_account(uuid, bigint, uuid, text, date),
  public.delete_account(uuid, uuid, text, date)
to authenticated;
