// Supabase de prueba local (SOLO para desarrollo).
//
// Imita las partes de Supabase que usa Fluxus, sobre un Postgres local:
//   /auth/v1  → crear perfil, iniciar sesión, renovar sesión, recuperar contraseña
//   /rest/v1  → leer tablas con filtros simples, actualizar, insertar y llamar funciones (rpc)
// Las consultas corren con el rol "authenticated" y el usuario de la sesión, así que
// las reglas de seguridad (RLS) son las mismas que en Supabase.
//
// Uso:  node tools/supabase-local/server.mjs   (ver tools/supabase-local/README.md)
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';
import pg from 'pg';

const PORT = Number(process.env.PORT ?? 54321);
const DB_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/fluxus_dev';
const SECRET = 'solo-para-desarrollo-local';
const MAIL_LOG = process.env.MAIL_LOG ?? '/tmp/fluxus-correos.log';
const TOKEN_SECONDS = 3600;

// Tipos como los devuelve PostgREST: bigint como número, fechas como texto
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());
pg.types.setTypeParser(1114, (v) => v.replace(' ', 'T'));

const pool = new pg.Pool({ connectionString: DB_URL, max: 8 });

await pool.query(`
  create table if not exists auth.local_credentials (
    user_id uuid primary key references auth.users (id) on delete cascade,
    password_hash text not null
  );
  create table if not exists auth.local_refresh_tokens (
    token text primary key,
    user_id uuid not null references auth.users (id) on delete cascade
  );
`);

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const b64url = (buf) => Buffer.from(buf).toString('base64url');

function signJwt(payload) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

function verifyJwt(token) {
  const [head, body, sig] = String(token ?? '').split('.');
  if (!sig) return null;
  const expected = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}

const hashPassword = (pw) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`;
};
const checkPassword = (pw, stored) => {
  const [salt, hash] = stored.split(':');
  const got = scryptSync(pw, salt, 32);
  return timingSafeEqual(got, Buffer.from(hash, 'hex'));
};

function userJson(row) {
  return {
    id: row.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: row.email,
    email_confirmed_at: new Date().toISOString(),
    user_metadata: row.raw_user_meta_data ?? {},
    app_metadata: { provider: 'email', providers: ['email'] },
    identities: [{ id: row.id, user_id: row.id, provider: 'email', identity_data: { email: row.email } }],
    created_at: new Date().toISOString(),
  };
}

async function newSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const refresh = randomBytes(24).toString('hex');
  await pool.query('insert into auth.local_refresh_tokens values ($1, $2)', [refresh, user.id]);
  return {
    access_token: signJwt({ sub: user.id, role: 'authenticated', aud: 'authenticated', email: user.email, iat: now, exp: now + TOKEN_SECONDS }),
    token_type: 'bearer',
    expires_in: TOKEN_SECONDS,
    expires_at: now + TOKEN_SECONDS,
    refresh_token: refresh,
    user: userJson(user),
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

const authError = (res, status, code, msg) => send(res, status, { code: status, error_code: code, msg });

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : {};
}

function bearerUser(req) {
  const h = req.headers.authorization ?? '';
  return verifyJwt(h.replace(/^Bearer\s+/i, ''));
}

/** Corre fn como el usuario del token (rol authenticated + claims), igual que PostgREST */
async function asUser(claims, fn) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`set local role ${claims ? 'authenticated' : 'anon'}`);
    if (claims) await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// ---------------------------------------------------------------------------
// /auth/v1
// ---------------------------------------------------------------------------
async function findUserByEmail(email) {
  const { rows } = await pool.query('select * from auth.users where lower(email) = lower($1)', [email]);
  return rows[0];
}

async function handleAuth(req, res, path, url) {
  if (path === '/health') return send(res, 200, { name: 'supabase-local', description: 'ok' });

  if (path === '/signup' && req.method === 'POST') {
    const { email, password, data } = await readBody(req);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authError(res, 400, 'email_address_invalid', 'Invalid email');
    if (!password || password.length < (Number(process.env.MIN_PASSWORD) || 5))
      return authError(res, 422, 'weak_password', 'Password should be at least 6 characters.');
    if (await findUserByEmail(email)) return authError(res, 422, 'user_already_exists', 'User already registered');
    const id = randomUUID();
    const { rows } = await pool.query(
      'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3) returning *',
      [id, email.toLowerCase(), JSON.stringify(data ?? {})],
    );
    await pool.query('insert into auth.local_credentials values ($1, $2)', [id, hashPassword(password)]);
    return send(res, 200, await newSession(rows[0]));
  }

  if (path === '/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    const body = await readBody(req);
    if (grant === 'password') {
      const user = await findUserByEmail(body.email ?? '');
      const cred = user && (await pool.query('select password_hash from auth.local_credentials where user_id = $1', [user.id])).rows[0];
      if (!cred || !checkPassword(body.password ?? '', cred.password_hash))
        return authError(res, 400, 'invalid_credentials', 'Invalid login credentials');
      return send(res, 200, await newSession(user));
    }
    if (grant === 'refresh_token') {
      const { rows } = await pool.query(
        'delete from auth.local_refresh_tokens where token = $1 returning user_id',
        [body.refresh_token ?? ''],
      );
      if (!rows[0]) return authError(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
      const user = (await pool.query('select * from auth.users where id = $1', [rows[0].user_id])).rows[0];
      return send(res, 200, await newSession(user));
    }
    return authError(res, 400, 'validation_failed', 'unsupported grant_type');
  }

  if (path === '/user') {
    const claims = bearerUser(req);
    if (!claims) return authError(res, 401, 'bad_jwt', 'invalid JWT');
    let user = (await pool.query('select * from auth.users where id = $1', [claims.sub])).rows[0];
    if (!user) return authError(res, 404, 'user_not_found', 'User not found');
    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (body.password !== undefined) {
        if (body.password.length < (Number(process.env.MIN_PASSWORD) || 5))
          return authError(res, 422, 'weak_password', 'Password should be at least 6 characters.');
        await pool.query('update auth.local_credentials set password_hash = $2 where user_id = $1', [user.id, hashPassword(body.password)]);
      }
      if (body.data) {
        user = (
          await pool.query('update auth.users set raw_user_meta_data = raw_user_meta_data || $2 where id = $1 returning *', [
            user.id,
            JSON.stringify(body.data),
          ])
        ).rows[0];
      }
    }
    return send(res, 200, userJson(user));
  }

  if (path === '/logout' && req.method === 'POST') {
    const claims = bearerUser(req);
    if (claims) await pool.query('delete from auth.local_refresh_tokens where user_id = $1', [claims.sub]);
    return send(res, 204);
  }

  if (path === '/recover' && req.method === 'POST') {
    // En vez de mandar un correo, se anota el enlace en un archivo
    const body = await readBody(req);
    const redirect = url.searchParams.get('redirect_to') ?? body.redirect_to ?? 'fluxus://';
    const user = await findUserByEmail(body.email ?? '');
    if (user) {
      const s = await newSession(user);
      const link = `${redirect}#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=${s.expires_in}&token_type=bearer&type=recovery`;
      appendFileSync(MAIL_LOG, `${new Date().toISOString()} ${user.email} ${link}\n`);
      console.log(`[correo] enlace de recuperación para ${user.email}: ${link}`);
    }
    return send(res, 200, {});
  }

  return authError(res, 404, 'not_found', `No implementado: ${req.method} /auth/v1${path}`);
}

// ---------------------------------------------------------------------------
// /rest/v1 (lo justo de PostgREST)
// ---------------------------------------------------------------------------
const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s) => {
  if (!IDENT.test(s)) throw Object.assign(new Error(`Nombre inválido: ${s}`), { status: 400 });
  return `"${s}"`;
};
const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict']);

function parseInList(raw) {
  const inner = raw.replace(/^\(/, '').replace(/\)$/, '');
  return inner === '' ? [] : inner.split(',').map((v) => v.replace(/^"(.*)"$/, '$1'));
}

function buildWhere(params, values) {
  const parts = [];
  for (const [key, raw] of params) {
    if (RESERVED.has(key)) continue;
    const col = ident(key);
    let negate = false;
    let expr = raw;
    if (expr.startsWith('not.')) {
      negate = true;
      expr = expr.slice(4);
    }
    const dot = expr.indexOf('.');
    const op = expr.slice(0, dot);
    const val = expr.slice(dot + 1);
    let sql;
    if (op === 'is') {
      const v = { null: 'null', true: 'true', false: 'false' }[val];
      if (!v) throw Object.assign(new Error(`is.${val} no soportado`), { status: 400 });
      sql = `${col} is ${v}`;
    } else if (op === 'in') {
      values.push(parseInList(val));
      sql = `${col}::text = any($${values.length}::text[])`;
    } else if (OPS[op]) {
      values.push(op.endsWith('like') ? val.replaceAll('*', '%') : val);
      sql = `${col} ${OPS[op]} $${values.length}`;
    } else {
      throw Object.assign(new Error(`Operador no soportado: ${op}`), { status: 400 });
    }
    parts.push(negate ? `not (${sql})` : sql);
  }
  return parts.length ? `where ${parts.join(' and ')}` : '';
}

function buildSelect(raw) {
  if (!raw || raw === '*') return '*';
  return raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => (c === '*' ? '*' : ident(c)))
    .join(', ');
}

function buildOrder(raw) {
  if (!raw) return '';
  return (
    'order by ' +
    raw
      .split(',')
      .map((part) => {
        const [col, ...mods] = part.split('.');
        let s = ident(col);
        if (mods.includes('desc')) s += ' desc';
        if (mods.includes('nullsfirst')) s += ' nulls first';
        if (mods.includes('nullslast')) s += ' nulls last';
        return s;
      })
      .join(', ')
  );
}

function pgError(res, e) {
  const status = e.status ?? (e.code === '42501' ? 403 : e.code === 'PGRST116' ? 406 : 400);
  return send(res, status, { code: e.code ?? 'PGRST000', message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
}

async function handleRest(req, res, path, url) {
  const claims = bearerUser(req);
  const params = [...url.searchParams.entries()];
  const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object');
  const prefer = req.headers.prefer ?? '';

  try {
    if (path.startsWith('/rpc/')) {
      const fn = ident(path.slice(5));
      const args = req.method === 'GET' ? Object.fromEntries(url.searchParams) : await readBody(req);
      const keys = Object.keys(args);
      keys.forEach(ident);
      const values = keys.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]));
      const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
      const rows = await asUser(claims, (c) => c.query(sql, values)).then((r) => r.rows);
      return send(res, 200, rows[0].r);
    }

    const table = `public.${ident(path.slice(1))}`;
    const values = [];
    const where = buildWhere(params, values);
    const select = buildSelect(url.searchParams.get('select'));
    let rows;

    if (req.method === 'GET' || req.method === 'HEAD') {
      const order = buildOrder(url.searchParams.get('order'));
      const limit = url.searchParams.get('limit');
      const offset = url.searchParams.get('offset');
      const sql = `select ${select} from ${table} ${where} ${order} ${limit ? `limit ${Number(limit)}` : ''} ${offset ? `offset ${Number(offset)}` : ''}`;
      rows = (await asUser(claims, (c) => c.query(sql, values))).rows;
    } else if (req.method === 'PATCH') {
      const body = await readBody(req);
      const sets = Object.keys(body).map((k) => {
        values.push(body[k]);
        return `${ident(k)} = $${values.length}`;
      });
      const sql = `update ${table} set ${sets.join(', ')} ${where} returning ${select}`;
      rows = (await asUser(claims, (c) => c.query(sql, values))).rows;
    } else if (req.method === 'POST') {
      const body = await readBody(req);
      const list = Array.isArray(body) ? body : [body];
      rows = await asUser(claims, async (c) => {
        const out = [];
        for (const item of list) {
          const keys = Object.keys(item);
          const sql = `insert into ${table} (${keys.map(ident).join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning ${select}`;
          out.push(...(await c.query(sql, keys.map((k) => item[k]))).rows);
        }
        return out;
      });
    } else if (req.method === 'DELETE') {
      const sql = `delete from ${table} ${where} returning ${select}`;
      rows = (await asUser(claims, (c) => c.query(sql, values))).rows;
    } else {
      return send(res, 405, { message: 'Método no soportado' });
    }

    if (req.method !== 'GET' && !prefer.includes('return=representation')) return send(res, 204);
    if (wantsObject) {
      if (rows.length !== 1)
        return pgError(res, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', status: 406 });
      return send(res, 200, rows[0]);
    }
    return send(res, 200, rows, { 'content-range': `0-${Math.max(rows.length - 1, 0)}/*` });
  } catch (e) {
    return pgError(res, e);
  }
}

// ---------------------------------------------------------------------------
createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('access-control-expose-headers', 'content-range');
  if (req.method === 'OPTIONS') return send(res, 204);

  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url.pathname.slice(8), url);
    if (url.pathname.startsWith('/rest/v1')) return await handleRest(req, res, url.pathname.slice(8), url);
    return send(res, 404, { message: 'No encontrado' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { message: String(e?.message ?? e) });
  }
}).listen(PORT, () => console.log(`Supabase de prueba en http://localhost:${PORT} (base: ${DB_URL})`));
