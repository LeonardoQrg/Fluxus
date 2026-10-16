// Une migraciones de supabase/migrations en un solo archivo para pegarlo de una vez en el
// SQL Editor de Supabase.
//
//   node tools/unir-sql.mjs                      → supabase/instalar.sql (todas; para un proyecto nuevo)
//   node tools/unir-sql.mjs --desde 20261015000004 → supabase/actualizar.sql (solo las que faltan
//                                                    en un proyecto que ya tiene las anteriores)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'supabase', 'migrations');
const i = process.argv.indexOf('--desde');
const desde = i > 0 ? process.argv[i + 1] : null;

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .filter((f) => !desde || f.split('_')[0] >= desde);

const parts = files.map((f) => `-- ===== ${f} =====\n\n${readFileSync(join(dir, f), 'utf8')}`);
const out = desde ? 'actualizar.sql' : 'instalar.sql';
const titulo = desde
  ? `-- Fluxus · actualización de la base de datos (migraciones desde ${desde}).\n-- Se pega entero en Supabase → SQL Editor → Run, UNA sola vez, en un proyecto que ya tiene las anteriores.`
  : '-- Fluxus · instalación completa de la base de datos.\n-- Se pega entero en Supabase → SQL Editor → Run, una sola vez, en un proyecto nuevo.';
writeFileSync(join(root, 'supabase', out), `${titulo}\n-- (generado con: node tools/unir-sql.mjs${desde ? ` --desde ${desde}` : ''})\n\n${parts.join('\n\n')}`);
console.log(`supabase/${out} listo (${files.length} migraciones)`);
