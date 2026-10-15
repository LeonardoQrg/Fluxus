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
