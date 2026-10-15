// Une todas las migraciones de supabase/migrations en un solo archivo, supabase/instalar.sql,
// para pegarlo de una vez en el SQL Editor de Supabase.
// Uso: node tools/unir-sql.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'supabase', 'migrations');
const parts = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => `-- ===== ${f} =====\n\n${readFileSync(join(dir, f), 'utf8')}`);
writeFileSync(
  join(root, 'supabase', 'instalar.sql'),
  `-- Fluxus · instalación completa de la base de datos (generado con: node tools/unir-sql.mjs)\n-- Se pega entero en Supabase → SQL Editor → Run, una sola vez, en un proyecto nuevo.\n\n${parts.join('\n\n')}`,
);
console.log('supabase/instalar.sql listo');
