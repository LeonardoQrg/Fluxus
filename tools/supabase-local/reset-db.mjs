// Crea (o recrea desde cero) la base de desarrollo "fluxus_dev" con las migraciones
// y el usuario de prueba admin@gmail.com / admin. SOLO para desarrollo.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scryptSync, randomBytes } from 'node:crypto';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const admin = process.env.ADMIN_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = 'fluxus_dev';

const a = new pg.Client({ connectionString: admin });
await a.connect();
await a.query(`drop database if exists ${DB} with (force)`);
await a.query(`create database ${DB}`);
await a.end();

const url = new URL(admin);
url.pathname = `/${DB}`;
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
await db.query(readFileSync(join(root, 'tests', 'db', 'supabase-stub.sql'), 'utf8'));
const dir = join(root, 'supabase', 'migrations');
for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.query(readFileSync(join(dir, f), 'utf8'));
}

// Usuario de prueba (solo desarrollo; nunca en la versión publicada)
await db.query(`
  create table auth.local_credentials (user_id uuid primary key references auth.users (id) on delete cascade, password_hash text not null);
  create table auth.local_refresh_tokens (token text primary key, user_id uuid not null references auth.users (id) on delete cascade);
`);
const { rows } = await db.query(
  `insert into auth.users (email, raw_user_meta_data) values ('admin@gmail.com', '{"name":"Admin"}') returning id`,
);
const salt = randomBytes(16).toString('hex');
await db.query('insert into auth.local_credentials values ($1, $2)', [rows[0].id, `${salt}:${scryptSync('admin', salt, 32).toString('hex')}`]);
await db.end();
console.log(`Base ${DB} lista, con el usuario admin@gmail.com / admin`);
