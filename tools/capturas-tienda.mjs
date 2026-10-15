// Genera las capturas de pantalla y la imagen de portada para la ficha de Google Play.
// Usa datos de ejemplo en el Supabase de prueba local (ver tools/supabase-local/README.md).
// Uso: node tools/capturas-tienda.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, openBrowser, prepareUser, step } from './e2e/helpers.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets', 'store');
mkdirSync(OUT, { recursive: true });

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const day = (back, d) => {
  const x = new Date(now.getFullYear(), now.getMonth() - back, Math.min(d, back === 0 ? now.getDate() : d));
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

// ── Datos de ejemplo (montos en centavos de ARS) ─────────────────────────────
const u = await prepareUser({ name: 'Lucía', accounts: [['Banco Principal', 5000000], ['Efectivo', 3250000], ['Mercado Pago', 5834000]] });
const B = u.ids['Banco Principal'], E = u.ids['Efectivo'], M = u.ids['Mercado Pago'];
const visa = await u.rpc('create_account', { p_name: 'Visa', p_kind: 'pagar', p_owe_type: 'tarjeta', p_amount: 0 });
await u.rpc('create_account', { p_name: 'Préstamo de mamá', p_kind: 'pagar', p_owe_type: 'persona', p_amount: 4500000 });
const token = (await (await fetch(`${API}/auth/v1/token?grant_type=password`, { method: 'POST', body: JSON.stringify({ email: u.email, password: u.password }) })).json()).access_token;
await fetch(`${API}/rest/v1/categories`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Mascotas' }) });
const cats = await (await fetch(`${API}/rest/v1/categories?select=id,name`, { headers: { authorization: `Bearer ${token}` } })).json();
const cat = (n) => cats.find((c) => c.name === n).id;
const gasto = (c, parts, date, description = '') =>
  u.rpc('register_movement', { p_type: 'gasto', p_date: date, p_amount: parts.reduce((t, p) => t + p[1], 0), p_category_id: cat(c), p_description: description, p_parts: parts.map(([a, v]) => ({ account_id: a, amount: v })) });
const ingreso = (acc, v, date, d) => u.rpc('register_movement', { p_type: 'ingreso', p_date: date, p_amount: v, p_account_id: acc, p_description: d });

for (const back of [0, 1, 2, 3, 4, 5]) await ingreso(B, 52000000, day(back, 1), 'Sueldo');
const month = (back, k) => Math.round(1 + 0.12 * Math.sin(back * 1.7 + k));
for (const back of [5, 4, 3, 2, 1]) {
  await gasto('Alimentación', [[B, 8200000 * month(back, 1)]], day(back, 6), 'Supermercado');
  await gasto('Servicios', [[B, 3100000 * month(back, 2)]], day(back, 9), 'Luz y gas');
  await gasto('Salud', [[B, 1400000 * month(back, 3)]], day(back, 12), 'Farmacia');
  await gasto('Educación', [[B, 6500000]], day(back, 3), 'Cuota del colegio');
}
await gasto('Alimentación', [[B, 8900000]], day(0, 2), 'Supermercado');
await gasto('Educación', [[B, 6500000]], day(0, 3), 'Cuota del colegio');
await gasto('Servicios', [[B, 3400000]], day(0, 4), 'Luz y gas');
await gasto('Salud', [[M, 1850000]], day(0, 5), 'Farmacia');
await gasto('Solidaridad', [[E, 500000]], day(0, 5), 'Colecta del barrio');
await gasto('Mascotas', [[M, 950000]], day(0, 6), 'Veterinario');
await gasto('Ocio / Recreación', [[E, 1000000], [visa, 1500000]], day(0, 6), 'Cine');
await gasto('Alimentación', [[visa, 5900000]], day(0, 7), 'Verdulería y carnicería');
await u.rpc('register_movement', { p_type: 'transfer', p_date: day(0, 7), p_amount: 2000000, p_from_account_id: B, p_to_account_id: E, p_description: 'Retiro del cajero' });

// ── Capturas ─────────────────────────────────────────────────────────────────
const ui = await openBrowser({ width: 390, height: 780, scale: 3 }); // 1170 × 2340 px
const { page, text, label, button, choose } = ui;
const shot = (n) => page.screenshot({ path: join(OUT, `captura-${n}.png`) });
const tab = (name) => page.getByRole('tab', { name }).or(page.getByRole('link', { name })).filter({ visible: true }).first().click();

await ui.login(u.email, u.password);
await text('Dinero disponible').waitFor();
await page.waitForTimeout(400);
await shot('1-inicio'); step('1 · Inicio');

await button('Registrar gastos').click();
await label('Monto total').fill('45000');
await choose(/^Categoría/, /^Alimentación/);
await choose(/^Pagado con/, /^Efectivo/);
await button('Dividir el pago con otra cuenta').click();
await choose('Cuenta 2', /^Banco Principal/);
await label('Descripción (opcional)').fill('Compra de la semana');
await text(/Repartido el total/).waitFor();
await page.waitForTimeout(300);
await shot('2-gasto-dividido'); step('2 · Gasto dividido');
await page.goBack();

await tab('Cuentas'); await text('Tu dinero').waitFor(); await page.waitForTimeout(300);
await shot('3-cuentas'); step('3 · Cuentas');

await tab('Movimientos'); await text(/^Hoy · |^Ayer · /).first().waitFor().catch(() => {}); await page.waitForTimeout(300);
await shot('4-movimientos'); step('4 · Movimientos');

await tab('Informe'); await text(/^¿En qué gastaste más/).waitFor(); await page.waitForTimeout(500);
await shot('5-informe'); step('5 · Informe');
await ui.finish();

// ── Imagen de portada 1024 × 500 ─────────────────────────────────────────────
const { chromium } = (await import('node:module')).createRequire(process.env.PLAYWRIGHT_DIR ?? '/opt/node22/lib/node_modules/')('playwright');
const font = (w, f) =>
  `@font-face{font-family:Sora;font-weight:${w};src:url(data:font/ttf;base64,${readFileSync(join(root, 'node_modules/@expo-google-fonts/sora', f)).toString('base64')})}`;
const mark = `<svg viewBox="300 200 400 600" width="170" height="255"><path d="M483 328 L565 220 L648 328 L620 328 C620 390 600 440 545 480 C480 525 400 560 382 620 C376 645 378 665 380 682 C345 655 325 615 330 570 C338 510 380 470 430 445 C490 415 515 385 520 328 Z" fill="#4FE3D4"/><path d="M635 405 C662 435 672 480 655 520 C635 565 585 590 540 615 C495 640 475 680 480 720 C483 748 490 765 500 780 C460 770 420 740 410 695 C400 645 430 610 480 585 C540 555 595 530 620 485 C632 460 636 430 635 405 Z" fill="#4FE3D4"/></svg>`;
const html = `<html><head><style>${font(800, '800ExtraBold/Sora_800ExtraBold.ttf')}${font(500, '500Medium/Sora_500Medium.ttf')}
body{margin:0;width:1024px;height:500px;background:radial-gradient(circle at 20% 50%,#16224A 0,#0B1226 70%);font-family:Sora;color:#EAF0FF;display:flex;align-items:center;gap:56px;padding:0 90px;box-sizing:border-box}
h1{margin:0;font-size:84px;letter-spacing:10px;font-weight:800;color:#4FE3D4}p{margin:14px 0 0;font-size:34px;font-weight:500;line-height:1.3;color:#EAF0FF}</style></head>
<body>${mark}<div><h1>FLUXUS</h1><p>Tu dinero, en movimiento<br>y en orden.</p></div></body></html>`;
const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const pg = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await pg.setContent(html);
await pg.waitForTimeout(500);
await pg.screenshot({ path: join(OUT, 'portada-1024x500.png') });
await browser.close();
step('Portada 1024×500');
