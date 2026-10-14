// Antes de las pruebas: crea una base de datos limpia y le aplica las migraciones de supabase/.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { ADMIN_URL, TEST_DB, TEST_URL } from './config';

export default async function setup() {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const db = new Client({ connectionString: TEST_URL });
  await db.connect();
  await db.query(readFileSync(join(__dirname, 'supabase-stub.sql'), 'utf8'));

  const dir = join(__dirname, '..', '..', 'supabase', 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.query(readFileSync(join(dir, file), 'utf8'));
    } catch (e) {
      throw new Error(`Falló la migración ${file}: ${(e as Error).message}`);
    }
  }
  await db.end();
}
