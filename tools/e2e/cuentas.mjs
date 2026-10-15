// Prueba de punta a punta de Cuentas (etapa 5).
// Uso: node tools/e2e/cuentas.mjs <carpeta-para-fotos>
import { BASE, expectEqual, openBrowser, plain, prepareUser, step } from './helpers.mjs';

const SHOTS = process.argv[2];
const u = await prepareUser({ accounts: [['Banco Principal', 10000000], ['Efectivo', 2000000], ['Ahorro', 5000000]] });
await u.rpc('create_account', { p_name: 'Visa', p_kind: 'pagar', p_owe_type: 'tarjeta', p_amount: 3000000 });
const ui = await openBrowser();
const { page, text, label, button, choose } = ui;
const big = async () => plain(await page.getByText(/^\$\s[\d.]+,\d\d$/).filter({ visible: true }).first().textContent());
const openTab = (name) => page.getByRole('tab', { name }).or(page.getByRole('link', { name })).filter({ visible: true }).first().click();
const openAccount = (name) => page.getByRole('button', { name: new RegExp(`^${name},`) }).filter({ visible: true }).first().click();

await ui.login(u.email, u.password);
await text('Dinero disponible').waitFor();
await openTab('Cuentas');
await text('Tu dinero').waitFor();
await text('Tocá una cuenta para ver sus movimientos').waitFor();
step('Cuentas: dos grupos con su total');
await ui.shot(SHOTS, 'k1-cuentas');

// Ajustar saldo hacia abajo: pide categoría y registra un gasto
await openAccount('Ahorro');
await text('Saldo actual').waitFor();
await button('Ajustar saldo').click();
await label('Monto actual correcto').fill('45000');
await text(/Bajó .*5\.000,00/).waitFor();
if (!(await button('Actualizar').isDisabled())) throw new Error('Sin categoría no debería poder actualizar');
await choose(/^¿En qué se usó\?/, /^Alimentación/);
await ui.shot(SHOTS, 'k2-ajustar');
await button('Actualizar').click();
await text('Se ha actualizado el monto total de Ahorro. El monto actual es').waitFor();
await text('Ajuste de saldo').waitFor();
step(`Ajustó Ahorro a ${await big()}: registró un gasto "Ajuste de saldo"`);

// Cambiar nombre
await button('Cambiar nombre').click();
await label('Nombre de la cuenta').fill('Ahorros');
await button('Guardar').click();
await text('Nombre actualizado').waitFor();
await text('Ahorros').waitFor();
step('Cambió el nombre a "Ahorros"');

// Transferir desde el detalle
await button('Transferir').click();
await text('Mover dinero entre tus cuentas').waitFor();
await choose(/^Hacia/, /^Efectivo/);
await label('Monto').fill('50000');
await text(/En Ahorros tenés/).waitFor();
step('Transferir más que el saldo → aviso');
await label('Monto').fill('5000');
await button('Transferir').click();
await text(/5\.000,00 transferidos a Efectivo/).waitFor();
await text('Transferencia a Efectivo').waitFor();
expectEqual(await big(), '$ 40.000,00', 'Saldo de Ahorros después de transferir');
step('Transfirió $ 5.000 a Efectivo');

// Caso: eliminar una cuenta con dinero
await button('Eliminar').click();
await text('La cuenta Ahorros que desea eliminar tiene $ 40.000,00').waitFor().catch(() => text(/La cuenta Ahorros que desea eliminar tiene/).waitFor());
await choose(/^Mover el dinero a/, /^Banco Principal/);
await ui.shot(SHOTS, 'k3-eliminar');
await button('Mover y eliminar').click();
await text(/40\.000,00 movidos a Banco Principal\. Cuenta Ahorros eliminada/).waitFor();
step('Eliminó Ahorros moviendo $ 40.000 al banco');
await openAccount('Banco Principal');
expectEqual(await big(), '$ 140.000,00', 'Saldo del banco');
await text('Transferencia desde Ahorros').waitFor();
step('El banco recibió el dinero y el historial muestra "Transferencia desde Ahorros"');
await page.goBack();

// Algo por pagar con deuda: primero el pago
await openAccount('Visa');
await text('Lo que debés hoy').waitFor();
await button('Eliminar').click();
await text(/Todavía debés .*30\.000,00 en Visa/).waitFor();
step('Visa con deuda → pide registrar el pago');
await button('Registrar un pago').click();
await page.getByText(/Pagar el total/).filter({ visible: true }).first().click();
await choose(/^Pagado desde/, /^Banco Principal/);
await button('Registrar pago').click();
await text(/Pago de .*30\.000,00 registrado/).waitFor();
await text('Lo que debés hoy').waitFor();
expectEqual(await big(), '$ 0,00', 'Deuda de la Visa');
// Al volver del pago sigue abierto el panel para eliminar, ahora con la deuda en 0
await text('¿Eliminar Visa? Sus movimientos quedan en el historial.').waitFor();
await button('Eliminar').click();
await text(/Cuenta Visa eliminada/).waitFor();
step('Pagó la Visa y la eliminó');

// Nueva cuenta
await button('+ Nueva cuenta').click();
await label('Nombre').fill('Caja chica');
await label('Monto inicial (opcional)').fill('1000');
await button('Crear cuenta').click();
await text('Cuenta Caja chica creada').waitFor();
step('Creó "Caja chica" con $ 1.000');
await ui.shot(SHOTS, 'k4-cuentas-final');

// La última cuenta de dinero no se puede eliminar
const solo = await prepareUser({ name: 'Ana', accounts: [['Banco', 0]] });
await page.evaluate(() => localStorage.clear());
await ui.login(solo.email, solo.password);
await text('Dinero disponible').waitFor();
await openTab('Cuentas');
await openAccount('Banco');
await button('Eliminar').click();
await text(/Necesitás al menos una cuenta de dinero/).waitFor();
step('No deja eliminar la única cuenta de dinero');

await ui.finish();
