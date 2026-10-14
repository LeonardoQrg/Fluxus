// Conexión a un Postgres local para las pruebas.
// Se puede cambiar con la variable DATABASE_URL (por ejemplo, en GitHub Actions).
const base = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';

export const TEST_DB = 'fluxus_test';
export const ADMIN_URL = base;
export const TEST_URL = (() => {
  const url = new URL(base);
  url.pathname = `/${TEST_DB}`;
  return url.toString();
})();
