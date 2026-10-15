// Prueba de punta a punta de Movimientos (etapa 6).
// Uso: node tools/e2e/movimientos.mjs <carpeta-para-fotos>
import { BASE, expectEqual, openBrowser, plain, prepareUser, step } from './helpers.mjs';

const SHOTS = process.argv[2];
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
const lastMonth = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-15`;

const u = await prepareUser({ accounts: [['Banco Principal', 10000000], ['Efectivo', 0]] });
const B = u.ids['Banco Principal'];
const E = u.ids['Efectivo'];
const cats = await (await fetch(`http://localhost:54321/rest/v1/categories?select=id,name`, { headers: { authorization: `Bearer ${(await (await fetch('http://localhost:54321/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: u.email, password: u.password }) })).json()).access_token}` } })).json();
const cat = (n) => cats.find((c) => c.name === n).id;
const gasto = (acc, amount, category, description, date = today) =>
  u.rpc('register_movement', { p_type: 'gasto', p_date: date, p_amount: amount, p_category_id: cat(category), p_description: description, p_parts: [{ account_id: acc, amount }] });
await u.rpc('register_movement', { p_type: 'ingreso', p_date: today, p_amount: 1000000, p_account_id: E, p_description: 'Sueldo' });
await gasto(E, 800000, 'Alimentación', 'Verdulería');
await gasto(B, 2000000, 'Salud', '');
await gasto(B, 500000, 'Educación', 'Libros', lastMonth);
await u.rpc('register_movement', { p_type: 'transfer', p_date: today, p_amount: 100000, p_from_account_id: B, p_to_account_id: E });

const ui = await openBrowser();
const { page, text, label, button, choose } = ui;
const tap = (name) => page.getByRole('button', { name: new RegExp(`^${name},`) }).filter({ visible: true }).last().click();
const count = async () => plain(await text(/movimientos?\b.*Tocá uno/).textContent());
const big = async () => plain(await page.getByText(/^[+−]?\$\s[\d.]+,\d\d$/).filter({ visible: true }).first().textContent());

await ui.login(u.email, u.password);
await text('Dinero disponible').waitFor();
await page.getByRole('tab', { name: 'Movimientos' }).or(page.getByRole('link', { name: 'Movimientos' })).filter({ visible: true }).first().click();
await text(/^Hoy · /).waitFor();
step(`Movimientos de este mes: ${await count()}`);
expectEqual((await count()).split('.')[0], '4 movimientos', 'Cantidad del mes');
await ui.shot(SHOTS, 'm1-movimientos');

await label('Buscar').fill('verdu');
await text(/^1 movimiento\./).waitFor();
step('Búsqueda "verdu" → 1 movimiento (sin importar tildes ni mayúsculas)');
await ui.link('Limpiar filtros').click();
await text(/^4 movimientos\./).waitFor();

await ui.radio('Ingresos').click();
await text(/^1 movimiento\./).waitFor();
await text('Sueldo').waitFor();
step('Filtro Ingresos → solo "Sueldo"');
await ui.radio('Todo').click();

await page.getByRole('button', { name: /^Este mes/ }).filter({ visible: true }).first().click();
await ui.radio(/^Mes pasado/).click();
await text('Libros').waitFor();
step('Filtro Mes pasado → "Libros"');
await page.getByRole('button', { name: /^Mes pasado/ }).filter({ visible: true }).first().click();
await ui.radio(/^Este mes/).click();

await page.getByRole('button', { name: /^Todas las cuentas/ }).filter({ visible: true }).first().click();
await ui.radio(/^Efectivo/).click();
await text(/movimientos de Efectivo/).waitFor();
await text('Transferencia desde Banco Principal').waitFor();
step(`Filtro cuenta Efectivo: ${await count()}`);
await ui.shot(SHOTS, 'm2-filtro-cuenta');
await ui.link('Limpiar filtros').click();

// Caso: eliminar un ingreso cuyo dinero ya se gastó
await tap('Sueldo');
await text('Registrado').waitFor();
await ui.shot(SHOTS, 'm3-detalle');
await button('Eliminar').click();
await text('Se descuentan $ 10.000,00 de Efectivo.').waitFor().catch(() => text(/Se descuentan .*10\.000,00 de Efectivo/).waitFor());
await page.waitForTimeout(600);
await button('Eliminar').click();
await text('No se puede eliminar: Efectivo quedaría en negativo, porque ese dinero ya se usó en otros movimientos.').waitFor();
step('Eliminar el sueldo ya gastado → lo impide y nombra la cuenta');
await ui.shot(SHOTS, 'm4-no-se-puede');
await button('Cancelar').click();
await page.goBack();

// Editar un gasto
await tap('Verdulería');
await button('Editar').click();
await text('Editar gasto').waitFor();
await label('Monto total').fill('9000');
await button('Guardar cambios').click();
await text('Cambios guardados').waitFor();
expectEqual(await big(), '−$ 9.000,00', 'Monto editado');
step('Editó la verdulería a $ 9.000');
await page.goBack();

// Eliminar un gasto
await tap('Salud');
await button('Eliminar').click();
await text(/Vuelven .*20\.000,00 a Banco Principal/).waitFor();
await page.waitForTimeout(600);
await button('Eliminar').click();
await text('Movimiento eliminado').waitFor();
await text(/^3 movimientos\./).waitFor();
step('Eliminó el gasto de Salud: vuelven $ 20.000 al banco');

// Saldos finales en Inicio
await page.getByRole('tab', { name: 'Inicio' }).or(page.getByRole('link', { name: 'Inicio' })).filter({ visible: true }).first().click();
const disponible = plain(await text('Dinero disponible').locator('xpath=following-sibling::*[1]').textContent());
expectEqual(disponible, '$ 96.000,00', 'Dinero disponible final'); // 100.000 − 5.000 (libros) + 10.000 − 9.000
step(`Dinero disponible final correcto: ${disponible}`);

// Movimientos de una cuenta eliminada: no se editan ni eliminan
const vieja = await u.rpc('create_account', { p_name: 'Billetera vieja', p_kind: 'dinero', p_amount: 0 });
await u.rpc('register_movement', { p_type: 'ingreso', p_date: today, p_amount: 50000, p_account_id: vieja, p_description: 'Regalo' });
await u.rpc('delete_account', { p_id: vieja, p_dest_account_id: B, p_date: today });
await page.reload();
await page.getByRole('tab', { name: 'Movimientos' }).or(page.getByRole('link', { name: 'Movimientos' })).filter({ visible: true }).first().click();
await tap('Regalo');
await text('Este movimiento usa una cuenta eliminada, por eso no se puede editar ni eliminar.').waitFor();
await text('Billetera vieja (eliminada)').waitFor();
step('Movimiento de una cuenta eliminada: visible pero bloqueado');

await ui.finish();
