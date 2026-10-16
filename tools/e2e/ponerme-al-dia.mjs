// Prueba de punta a punta de "Ponerme al día" y "Empezar de cero".
// Uso: node tools/e2e/ponerme-al-dia.mjs <carpeta-para-fotos>
import pg from 'pg';
import { expectEqual, openBrowser, plain, prepareUser, step } from './helpers.mjs';

const SHOTS = process.argv[2];
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const u = await prepareUser({ accounts: [['Banco Principal', 10000000], ['Efectivo', 1000000]] });
const visa = await u.rpc('create_account', { p_name: 'Visa', p_kind: 'pagar', p_owe_type: 'tarjeta', p_amount: 3000000 });
await u.rpc('register_movement', { p_type: 'ingreso', p_date: today, p_amount: 100, p_account_id: u.ids['Efectivo'], p_description: 'Vuelto' });

// Hace diez días que no se registra nada: se envejecen los movimientos en la base de prueba
const db = new pg.Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/fluxus_dev' });
await db.connect();
await db.query(`update public.movements set created_at = now() - interval '10 days' where user_id = (select id from auth.users where email = $1)`, [u.email]);
await db.end();

const ui = await openBrowser({ height: 1000 });
const { page, text, label, button } = ui;
const amountOf = async (labelText) => plain(await text(labelText).locator('xpath=following-sibling::*[1]').textContent());

await ui.login(u.email, u.password);
await text('Dinero disponible').waitFor();
await text('Hace 10 días que no registrás nada').waitFor();
step('Inicio: aviso "Hace 10 días que no registrás nada"');
await ui.shot(SHOTS, 'p1-aviso');

await button('Ahora no').click();
await page.waitForTimeout(300);
await page.reload();
await text('Dinero disponible').waitFor();
await page.waitForTimeout(600);
if (await page.getByText(/^Hace \d+ días que no registrás nada/).filter({ visible: true }).count()) throw new Error('El aviso debía quedar pospuesto');
step('"Ahora no" pospone el aviso (sigue oculto al recargar)');

// Ponerme al día desde el menú
await page.getByRole('button', { name: 'Menú' }).click();
await button('Ponerme al día').click();
await text('Si pasó un tiempo sin anotar').waitFor();
if (!(await button('Actualizar todo').isDisabled())) throw new Error('Sin cambios el botón debe estar desactivado');
step('Ponerme al día: lista todas las cuentas; sin cambios el botón está desactivado');
await label('Banco Principal').fill('70000');
await label('Efectivo').fill('12500');
await label('Visa').fill('35000');
await text(/Bajó .*30\.000,00: queda como gasto sin detallar/).waitFor();
await text(/Subió .*2\.499,00: queda como ingreso/).waitFor();
await text(/Sube .*5\.000,00 lo que debés/).waitFor();
await text('Se va a registrar').waitFor();
await ui.shot(SHOTS, 'p2-ponerme-al-dia');
await button('Actualizar todo').click();
await text(/Listo, te pusiste al día\. Se ajustaron 3 cuentas\./).waitFor();
step('Corrigió Banco ($ 70.000), Efectivo ($ 12.500) y Visa ($ 35.000) de una vez');

await text('Dinero disponible').waitFor();
expectEqual(await amountOf('Dinero disponible'), '$ 82.500,00', 'Dinero disponible');
expectEqual(await amountOf('Por pagar'), '$ 35.000,00', 'Por pagar');
step('Inicio muestra $ 82.500 disponibles y $ 35.000 por pagar');

await page.getByRole('tab', { name: 'Movimientos' }).or(page.getByRole('link', { name: 'Movimientos' })).filter({ visible: true }).first().click();
await text(/Ajuste: ponerme al día/).first().waitFor();
await text(/Sin detallar/).first().waitFor();
step('Movimientos: los ajustes quedaron registrados ("Sin detallar")');
await ui.shot(SHOTS, 'p3-movimientos');

// Empezar de cero
await page.getByRole('tab', { name: 'Inicio' }).or(page.getByRole('link', { name: 'Inicio' })).filter({ visible: true }).first().click();
await page.getByRole('button', { name: 'Menú' }).click();
await button('Empezar de cero').click();
await text('Esto no se puede deshacer').waitFor();
if (!(await button('Borrar todo y empezar de cero').isDisabled())) throw new Error('Debe estar desactivado hasta escribir BORRAR');
await label('Para confirmar, escribí BORRAR').fill('borrar');
await ui.shot(SHOTS, 'p4-empezar-de-cero');
await button('Borrar todo y empezar de cero').click();
await text(/Armemos la foto completa de tu dinero/).waitFor();
step('Empezar de cero: todo borrado y vuelve a la configuración inicial');
await page.reload();
await text(/Armemos la foto completa de tu dinero/).waitFor();
step('Al recargar sigue en la configuración inicial');

// Se puede volver a cargar todo
await button('Empezar').click();
await text('¿En qué moneda manejás tu dinero?').waitFor();
await button('Continuar').click();
await text('Ingresá el monto disponible en tu cuenta bancaria principal.').waitFor();
await label('Monto').fill('5000');
await button('Guardar y seguir').click();
await text('Ahora vamos a sumar tu dinero en efectivo.').waitFor();
await label('Monto').fill('0');
await button('Guardar y seguir').click();
await text(/¿Tenés dinero en otra cuenta/).waitFor();
await button('No').click();
await text('Muy bien. Este es tu punto de partida.').waitFor();
await text(/\$\s5\.000,00/).first().waitFor();
await button('Continuar').click();
await text('Dinero disponible').waitFor();
expectEqual(await amountOf('Dinero disponible'), '$ 5.000,00', 'Dinero disponible tras volver a cargar');
step('Volvió a cargar lo que tiene: $ 5.000');
await ui.finish();
