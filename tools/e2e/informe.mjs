// Prueba de punta a punta del Informe (etapa 7).
// Uso: node tools/e2e/informe.mjs <carpeta-para-fotos>
import { API, openBrowser, plain, prepareUser, step } from './helpers.mjs';

const SHOTS = process.argv[2];
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const day = (back, d = 5) => {
  const x = new Date(now.getFullYear(), now.getMonth() - back, Math.min(d, now.getDate()));
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

const u = await prepareUser({ accounts: [['Banco Principal', 100000000]] });
const B = u.ids['Banco Principal'];
const token = (await (await fetch(`${API}/auth/v1/token?grant_type=password`, { method: 'POST', body: JSON.stringify({ email: u.email, password: u.password }) })).json()).access_token;
const visa = await u.rpc('create_account', { p_name: 'Visa', p_kind: 'pagar', p_owe_type: 'tarjeta', p_amount: 0 });
for (const n of ['Mascotas', 'Transporte']) {
  await fetch(`${API}/rest/v1/categories`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ name: n }) });
}
const cats = await (await fetch(`${API}/rest/v1/categories?select=id,name`, { headers: { authorization: `Bearer ${token}` } })).json();
const cat = (n) => cats.find((c) => c.name === n).id;
const gasto = (category, amount, date, acc = B) =>
  u.rpc('register_movement', { p_type: 'gasto', p_date: date, p_amount: amount, p_category_id: cat(category), p_parts: [{ account_id: acc, amount }] });

// Este mes: 8 categorías con gasto (la Visa también cuenta en el mes de la compra)
const spend = { Alimentación: 5000000, Servicios: 3000000, 'Ocio / Recreación': 2500000, Salud: 1500000, Educación: 1000000, Solidaridad: 500000, Mascotas: 300000, Transporte: 200000 };
for (const [k, v] of Object.entries(spend)) await gasto(k, v, day(0), k === 'Ocio / Recreación' ? visa : B);
await u.rpc('register_movement', { p_type: 'ingreso', p_date: day(0), p_amount: 20000000, p_account_id: B });
await u.rpc('register_movement', { p_type: 'pago', p_date: day(0), p_amount: 2500000, p_from_account_id: B, p_to_account_id: visa });
// Meses anteriores de Alimentación
await gasto('Alimentación', 4000000, day(1));
await gasto('Alimentación', 6000000, day(3));
await gasto('Servicios', 3500000, day(1));

const ui = await openBrowser();
const { page, text } = ui;
await ui.login(u.email, u.password);
await text('Dinero disponible').waitFor();
await page.getByRole('tab', { name: 'Informe' }).or(page.getByRole('link', { name: 'Informe' })).filter({ visible: true }).first().click();
await text(/^¿En qué gastaste más en/).waitFor();

const legend = await page.getByRole('button', { name: /%, \$/ }).filter({ visible: true }).allTextContents();
step(`Dona: ${legend.length} filas (5 categorías + "Otras categorías")`);
if (legend.length !== 6 || !plain(legend[5]).startsWith('Otras categorías')) throw new Error(`Leyenda inesperada: ${legend.map(plain).join(' | ')}`);
await text(/^Gastos de /).waitFor();
step(`Total en el centro: ${plain(await text(/^\$\s140\.000,00$/).textContent())}`);
await ui.shot(SHOTS, 'r1-informe');

await page.getByRole('button', { name: /^Servicios, 21%/ }).filter({ visible: true }).first().click();
await text('21% del total').waitFor();
step('Tocó Servicios en la leyenda → el centro muestra su monto y 21%');
await ui.shot(SHOTS, 'r2-destacado');

await text('Te quedó').waitFor();
step(`Resumen del mes: Te quedó ${plain(await text('Te quedó').locator('xpath=following-sibling::*[1]').textContent())} (los pagos de la Visa no se suman otra vez)`);

await text('▲ +$ 10.000,00').or(text(/▲ \+\$\s10\.000,00/)).first().waitFor();
await text(/▼ −\$\s5\.000,00/).waitFor();
step('Comparar meses: Alimentación ▲ +$ 10.000 y Servicios ▼ −$ 5.000 contra el mes pasado');

await text(/Promedio de los meses con gasto: \$\s50\.000,00/).waitFor();
step('Evolución de Alimentación: promedio de los meses con gasto $ 50.000');
await page.getByRole('button', { name: /: \$\s40\.000,00$/ }).filter({ visible: true }).first().click();
step('Tocó la barra del mes pasado');
await ui.shot(SHOTS, 'r3-comparar-evolucion');

await page.getByRole('button', { name: /^Mascotas, .*Ver movimientos/ }).filter({ visible: true }).first().click();
await text(/^1 movimiento\./).waitFor();
await text('Mascotas').waitFor();
step('Tocó Mascotas en "Todas las categorías" → Movimientos filtrado por esa categoría y mes');
await ui.shot(SHOTS, 'r4-filtrado');

await ui.finish();
