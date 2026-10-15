// Prueba de punta a punta de la configuración inicial (etapa 3), en un navegador con tamaño de celular.
// Uso: node tools/e2e/configuracion.mjs <carpeta-para-fotos>
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const SHOTS = process.argv[2];
const BASE = 'http://localhost:8081';
const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
const step = (s) => console.log('→', s);
const vis = (l) => l.filter({ visible: true }).first();
const text = (t) => vis(page.getByText(t));
const label = (t) => vis(page.getByLabel(t, { exact: true }));
const button = (t) => vis(page.getByRole('button', { name: t, exact: true }));
const plain = (s) => s.replace(/[  ]/g, ' ');

// Perfil nuevo
const email = `conf${Date.now()}@correo.com`;
await page.goto(`${BASE}/crear-perfil`);
await label('Tu nombre').fill('Leo');
await label('Correo electrónico').fill(email);
await label('Contraseña').fill('secreto1');
await label('Repetir contraseña').fill('secreto1');
await button('Crear usuario').click();
await text('Perfil creado. Ya podés iniciar sesión.').waitFor();
await label('Contraseña').fill('secreto1');
await button('Ingresar').click();

// 1 · Bienvenida
await text('Hola, Leo. Armemos la foto completa de tu dinero').waitFor();
step('Paso 1 · Bienvenida'); await shot('c1-intro');
await button('Empezar').click();

// 2 · Moneda
await text('¿En qué moneda manejás tu dinero?').waitFor();
step('Paso 2 · Moneda'); await shot('c2-moneda');
await page.getByRole('radio', { name: /CLP/ }).click();
await button('Continuar').click();

// 3 · Banco (en CLP)
await text('Ingresá el monto disponible en tu cuenta bancaria principal.').waitFor();
const bankName = await label('Cuenta').inputValue();
step(`Paso 3 · Banco: nombre sugerido "${bankName}"`);
await label('Monto').fill('1.500');
await text('Se va a guardar').waitFor();
step(`  CLP: "1.500" → ${plain(await text('Se va a guardar').textContent())}`);
await button('Guardar y seguir').click();

// 4 · Efectivo
await text('Ahora vamos a sumar tu dinero en efectivo.').waitFor();
step('Paso 4 · Efectivo');

// Cerrar y volver a abrir la app: retoma donde quedó
await page.reload();
await text('Ahora vamos a sumar tu dinero en efectivo.').waitFor();
step('Recargó la app → sigue en el paso de efectivo');

// Volver atrás hasta la moneda y cambiar a ARS: el banco mantiene su número
await vis(page.getByLabel('Volver')).click();
await text('Ingresá el monto disponible en tu cuenta bancaria principal.').waitFor();
step(`Volvió al banco: monto guardado "${await label('Monto').inputValue()}"`);
await vis(page.getByLabel('Volver')).click();
await text('¿En qué moneda manejás tu dinero?').waitFor();
await page.getByRole('radio', { name: /ARS/ }).click();
await button('Continuar').click();
await text('Ingresá el monto disponible en tu cuenta bancaria principal.').waitFor();
step(`Cambió a ARS: el banco muestra "${await label('Monto').inputValue()}"`);
await label('Cuenta').fill('Banco Nación');
await label('Monto').fill('250000.5');
step(`  ARS con punto decimal: "250000.5" → ${plain(await text('Se va a guardar').textContent())}`);
await shot('c3-banco');
await button('Guardar y seguir').click();

await text('Ahora vamos a sumar tu dinero en efectivo.').waitFor();
await label('Monto').fill('');
await button('Guardar y seguir').click();
await text('Ingresá un monto. Si no tenés dinero ahí, escribí 0.').waitFor();
step('Monto vacío → pide escribir 0');
await label('Monto').fill('35.000');
await shot('c4-efectivo');
await button('Guardar y seguir').click();

// 5 · Otras cuentas
await text('¿Tenés dinero en otra cuenta, billetera virtual o ahorro?').waitFor();
step('Paso 5 · Otras cuentas');
await button('Sí').click();
await label('Nombre de la cuenta').fill('efectivo');
await label('Monto').fill('10');
await button('Agregar').click();
await text('Ya tenés una cuenta con ese nombre.').waitFor();
step('Nombre repetido → aviso');
await label('Nombre de la cuenta').fill('Mercado Pago');
await label('Monto').fill('12.345,67');
await button('Agregar').click();
await text('Cuenta "Mercado Pago" agregada').waitFor();
await text('¿Tenés dinero en alguna otra cuenta, billetera virtual o ahorro?').waitFor();
step('Agregó Mercado Pago y vuelve a preguntar'); await shot('c5-otras');
await button('No').click();

// 6 · Cierre
await text('Muy bien. Este es tu punto de partida.').waitFor();
const total = plain(await vis(page.getByText(/^\$\s/)).textContent());
step(`Paso 6 · Cierre: total ${total}`); await shot('c6-cierre');
if (total !== '$ 297.346,17') throw new Error(`Total esperado $ 297.346,17, llegó ${total}`);
await button('Continuar').click();
await text('Dinero disponible').waitFor();
step('Continuar → Inicio');

// Ya no vuelve a la configuración
await page.reload();
await text('Dinero disponible').waitFor();
step('Recargó → sigue en Inicio (la configuración se hace una sola vez)');

const real = errors.filter((e) => !e.includes('400') && !e.includes('409'));
console.log(real.length ? `ERRORES EN CONSOLA:\n${real.join('\n')}` : 'Sin errores en la consola');
await browser.close();
