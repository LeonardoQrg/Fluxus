// Acceso a los datos de la persona en Supabase.
import { toFluxusError, supabase, type FluxusError } from './supabase';

export type AccountKind = 'dinero' | 'pagar';
export type OweType = 'tarjeta' | 'cuotas' | 'persona' | 'otro';

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  owe_type: OweType | null;
  /** En la unidad mínima de la moneda: saldo (dinero) o lo que se debe (pagar) */
  amount: number;
  deleted_at: string | null;
  created_at: string;
};

export const OWE_TYPES: Record<OweType, string> = {
  tarjeta: 'Tarjeta de crédito',
  cuotas: 'Cuotas o préstamo',
  persona: 'A una persona',
  otro: 'Otro',
};

export class DataError extends Error {
  constructor(public info: FluxusError) {
    super(info.message);
  }
}

const NETWORK: FluxusError = {
  message: 'No pudimos conectarnos. Revisá tu conexión a internet e intentá de nuevo.',
  code: 'sin_conexion',
  accountId: null,
};

function fail(error: { message: string; details?: string | null; hint?: string | null; code?: string }): never {
  // Los errores de las funciones de Fluxus traen un código en "details"; el resto son de red o inesperados
  if (error.details && /^[a-z_]+$/.test(error.details)) throw new DataError(toFluxusError(error));
  if (/fetch|network/i.test(error.message)) throw new DataError(NETWORK);
  throw new DataError({ message: 'Algo salió mal. Intentá de nuevo en un momento.', code: 'desconocido', accountId: null });
}

/** Llama a una función del servidor (ver supabase/migrations) */
export async function call<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) fail(error);
  return data as T;
}

/** Todas las cuentas (también las eliminadas, para el historial), de la más vieja a la más nueva */
export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, kind, owe_type, amount, deleted_at, created_at')
    .order('created_at')
    .order('id');
  if (error) fail(error);
  return data as Account[];
}

/** Mensaje para mostrar a partir de cualquier error */
export function errorMessage(e: unknown): string {
  if (e instanceof DataError) return e.info.message;
  return NETWORK.message;
}

export type MovementType = 'ingreso' | 'gasto' | 'pago' | 'transfer' | 'nuevo_pagar' | 'ajuste_pagar';

export type MovementPart = { movement_id: string; account_id: string; amount: number };

export type Movement = {
  id: string;
  type: MovementType;
  amount: number;
  delta: number | null;
  date: string;
  description: string;
  category_id: string | null;
  account_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  created_at: string;
  /** Solo en gastos: con qué cuentas se pagó */
  parts: MovementPart[];
};

export type Category = { id: string; name: string; sort_order: number };

const PAGE = 1000; // Supabase devuelve como máximo 1000 filas por pedido

async function fetchAll<T>(table: string, columns: string, order: { column: string; ascending: boolean }[]): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select(columns);
    for (const o of order) q = q.order(o.column, { ascending: o.ascending });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) fail(error);
    out.push(...(data as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

export async function listCategories(): Promise<Category[]> {
  return fetchAll<Category>('categories', 'id, name, sort_order', [{ column: 'sort_order', ascending: true }]);
}

/** Todos los movimientos, del más reciente al más antiguo, con las partes de cada gasto */
export async function listMovements(): Promise<Movement[]> {
  const [rows, parts] = await Promise.all([
    fetchAll<Omit<Movement, 'parts'>>(
      'movements',
      'id, type, amount, delta, date, description, category_id, account_id, from_account_id, to_account_id, created_at',
      [
        { column: 'date', ascending: false },
        { column: 'created_at', ascending: false },
        { column: 'id', ascending: true },
      ],
    ),
    fetchAll<MovementPart>('movement_parts', 'movement_id, account_id, amount', [
      { column: 'movement_id', ascending: true },
      { column: 'amount', ascending: false },
    ]),
  ]);
  const byMovement = new Map<string, MovementPart[]>();
  for (const p of parts) {
    const list = byMovement.get(p.movement_id) ?? [];
    list.push(p);
    byMovement.set(p.movement_id, list);
  }
  return rows.map((m) => ({ ...m, parts: byMovement.get(m.id) ?? [] }));
}

/** Crea una categoría (o devuelve la que ya existe con ese nombre) */
export async function createCategory(name: string, existing: Category[]): Promise<Category> {
  const clean = name.trim();
  const found = existing.find((c) => c.name.toLowerCase() === clean.toLowerCase());
  if (found) return found;
  const { data, error } = await supabase.from('categories').insert({ name: clean }).select('id, name, sort_order').single();
  if (error) fail(error);
  return data as Category;
}
