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
