// Herramientas para las pruebas: crear usuarios y llamar a la base como lo haría la app.
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll } from 'vitest';
import { TEST_URL } from './config';

const pool = new Pool({ connectionString: TEST_URL, max: 4 });
afterAll(() => pool.end());

/** Error de una función del servidor, con los mismos campos que devuelve Supabase. */
export class DbError extends Error {
  constructor(
    message: string,
    public code: string | undefined,
    public detail: string | undefined,
    public hint: string | undefined,
  ) {
    super(message);
  }
}

type Params = Record<string, unknown>;

/** Corre una consulta como usuario con sesión iniciada (rol authenticated, con RLS). */
async function asUser<T>(uid: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query('set local role authenticated');
    if (uid) {
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
    }
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback');
    const pg = e as { message: string; code?: string; detail?: string; hint?: string };
    throw new DbError(pg.message, pg.code, pg.detail, pg.hint);
  } finally {
    c.release();
  }
}

function encode(v: unknown) {
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}

/** Una persona usando la app: llama funciones (rpc) y lee tablas con sus permisos. */
export class Session {
  constructor(public uid: string | null) {}

  async rpc<T = unknown>(fn: string, params: Params = {}): Promise<T> {
    const keys = Object.keys(params);
    const args = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
    return asUser(this.uid, async (c) => {
      const r = await c.query(`select public.${fn}(${args}) as result`, keys.map((k) => encode(params[k])));
      return r.rows[0].result as T;
    });
  }

  async query<T = Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<T[]> {
    return asUser(this.uid, async (c) => (await c.query(sql, values)).rows as T[]);
  }

  /** Saldo de una cuenta, como número (los bigint llegan como texto). */
  async balance(accountId: string): Promise<number> {
    const [row] = await this.query<{ amount: string }>('select amount from public.accounts where id = $1', [accountId]);
    return Number(row.amount);
  }

  async categoryId(name: string): Promise<string> {
    const [row] = await this.query<{ id: string }>('select id from public.categories where name = $1', [name]);
    return row.id;
  }

  createMoney(name: string, amount = 0) {
    return this.rpc<string>('create_account', { p_name: name, p_kind: 'dinero', p_amount: amount });
  }

  createOwe(name: string, amount = 0, oweType = 'tarjeta') {
    return this.rpc<string>('create_account', { p_name: name, p_kind: 'pagar', p_owe_type: oweType, p_amount: amount });
  }
}

/** Crea un usuario nuevo (como si se registrara en Supabase Auth) y devuelve su sesión. */
export async function newUser(name = 'Ana'): Promise<Session> {
  const id = randomUUID();
  await pool.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    id,
    `${id}@prueba.test`,
    JSON.stringify({ name }),
  ]);
  return new Session(id);
}

/** Fecha de hoy (YYYY-MM-DD) en UTC, como la que usa el servidor. */
export const today = () => new Date().toISOString().slice(0, 10);

/** Fecha de hace n días. */
export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
