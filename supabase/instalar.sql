-- Fluxus · instalación completa de la base de datos (generado con: node tools/unir-sql.mjs)
-- Se pega entero en Supabase → SQL Editor → Run, una sola vez, en un proyecto nuevo.

-- ===== 20261014000001_tablas.sql =====

-- Fluxus · Etapa 1 · Tablas y reglas de seguridad
--
-- Cinco tablas: perfiles, cuentas, categorías, movimientos y las partes de cada gasto.
-- Todos los montos son enteros en la unidad mínima de la moneda (centavos; en CLP y COP, unidades).
--
-- Seguridad:
--   * Row Level Security en todas las tablas: cada persona solo ve sus propias filas.
--   * La app NO puede escribir directo en cuentas, movimientos ni partes. Los saldos solo
--     cambian a través de las funciones del archivo 20261014000002_funciones.sql, que validan
--     todo dentro de una transacción.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  name            text not null default '' check (length(name) <= 60),
  currency        text not null default 'ARS'
                  check (currency in ('ARS', 'USD', 'CLP', 'UYU', 'MXN', 'COP', 'PEN', 'EUR')),
  onboarding_step text not null default 'intro'
                  check (onboarding_step in ('intro', 'moneda', 'banco', 'efectivo', 'otras', 'done')),
  hide_owe_tip    boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cuentas: "dinero" (saldo disponible) o "pagar" (lo que se debe)
-- ---------------------------------------------------------------------------
create table public.accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 60),
  kind       text not null check (kind in ('dinero', 'pagar')),
  owe_type   text check (owe_type in ('tarjeta', 'cuotas', 'persona', 'otro')),
  amount     bigint not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  -- owe_type solo existe (y es obligatorio) en las cuentas "pagar"
  constraint accounts_owe_type_solo_pagar check ((kind = 'pagar') = (owe_type is not null))
);

-- Nombre único entre las cuentas activas del usuario (sin importar mayúsculas)
create unique index accounts_nombre_unico
  on public.accounts (user_id, lower(btrim(name)))
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Categorías (sort_order fija el color en los gráficos)
-- ---------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 40),
  sort_order integer not null,
  created_at timestamptz not null default now()
);

create unique index categories_nombre_unico on public.categories (user_id, lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- Movimientos
-- ---------------------------------------------------------------------------
create table public.movements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  type            text not null
                  check (type in ('ingreso', 'gasto', 'pago', 'transfer', 'nuevo_pagar', 'ajuste_pagar')),
  amount          bigint not null check (amount > 0),
  delta           bigint,
  date            date not null,
  description     text not null default '' check (length(description) <= 200),
  category_id     uuid references public.categories (id),
  account_id      uuid references public.accounts (id),
  from_account_id uuid references public.accounts (id),
  to_account_id   uuid references public.accounts (id),
  created_at      timestamptz not null default now(),

  -- Qué campos usa cada tipo de movimiento (ver "Modelo de datos" en la especificación)
  constraint movements_campos_por_tipo check (
    case type
      when 'ingreso' then
        account_id is not null and category_id is null
        and from_account_id is null and to_account_id is null and delta is null
      when 'gasto' then
        category_id is not null and account_id is null
        and from_account_id is null and to_account_id is null and delta is null
      when 'pago' then
        from_account_id is not null and to_account_id is not null
        and account_id is null and category_id is null and delta is null
      when 'transfer' then
        from_account_id is not null and to_account_id is not null and from_account_id <> to_account_id
        and account_id is null and category_id is null and delta is null
      when 'nuevo_pagar' then
        to_account_id is not null
        and account_id is null and from_account_id is null and category_id is null and delta is null
      when 'ajuste_pagar' then
        to_account_id is not null and delta is not null and delta <> 0 and amount = abs(delta)
        and account_id is null and from_account_id is null and category_id is null
    end
  )
);

create index movements_user_date on public.movements (user_id, date desc, created_at desc);
create index movements_account on public.movements (account_id);
create index movements_from_account on public.movements (from_account_id);
create index movements_to_account on public.movements (to_account_id);
create index movements_category on public.movements (category_id);

-- ---------------------------------------------------------------------------
-- Partes de un gasto: una fila por cada cuenta con la que se pagó
-- ---------------------------------------------------------------------------
create table public.movement_parts (
  movement_id uuid not null references public.movements (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  account_id  uuid not null references public.accounts (id),
  amount      bigint not null check (amount > 0),
  primary key (movement_id, account_id)
);

create index movement_parts_account on public.movement_parts (account_id);

-- ---------------------------------------------------------------------------
-- Permisos
-- Supabase da todos los permisos por defecto a los roles anon y authenticated;
-- los quitamos y damos solo lo necesario.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.accounts, public.categories, public.movements, public.movement_parts
  from anon, authenticated;

grant select on public.profiles, public.accounts, public.categories, public.movements, public.movement_parts
  to authenticated;

-- El perfil se puede actualizar directo (nombre, moneda, paso de la configuración, aviso oculto)
grant update (name, currency, onboarding_step, hide_owe_tip) on public.profiles to authenticated;

-- Las categorías no tocan saldos: se pueden crear y renombrar directo
grant insert (name), update (name) on public.categories to authenticated;

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.movements enable row level security;
alter table public.movement_parts enable row level security;

create policy "perfil propio: ver" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "perfil propio: cambiar" on public.profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "cuentas propias: ver" on public.accounts
  for select to authenticated using (user_id = (select auth.uid()));

create policy "categorías propias: ver" on public.categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy "categorías propias: crear" on public.categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "categorías propias: cambiar" on public.categories
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "movimientos propios: ver" on public.movements
  for select to authenticated using (user_id = (select auth.uid()));

create policy "partes propias: ver" on public.movement_parts
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Disparadores
-- ---------------------------------------------------------------------------

-- Al crear un usuario en Supabase Auth: su perfil y las 6 categorías iniciales.
-- El nombre llega en los metadatos del registro: supabase.auth.signUp({ options: { data: { name } } })
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, left(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), 60));

  insert into public.categories (user_id, name, sort_order)
  select new.id, c.name, c.ord - 1
  from unnest(array['Alimentación', 'Salud', 'Educación', 'Servicios', 'Solidaridad', 'Ocio / Recreación'])
       with ordinality as c (name, ord);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Las categorías nuevas van al final (su color queda fijo para siempre)
create function private.set_category_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  if tg_op = 'INSERT' and new.sort_order is null then
    select coalesce(max(sort_order) + 1, 0) into new.sort_order
    from public.categories where user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger categories_set_order
  before insert or update on public.categories
  for each row execute function private.set_category_order();

-- La moneda se elige una sola vez: después de la configuración inicial no se puede cambiar,
-- porque los montos guardados dependen de sus decimales.
create function private.lock_currency()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.currency is distinct from old.currency and old.onboarding_step = 'done' then
    raise exception 'La moneda ya no se puede cambiar.'
      using detail = 'moneda_fija';
  end if;
  new.name := btrim(new.name);
  return new;
end;
$$;

create trigger profiles_lock_currency
  before update on public.profiles
  for each row execute function private.lock_currency();


-- ===== 20261014000002_funciones.sql =====

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


-- ===== 20261015000003_configuracion_inicial.sql =====

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


-- ===== 20261015000004_eliminar_cuenta.sql =====

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
