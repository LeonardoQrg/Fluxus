// Prueba de punta a punta de Inicio y registro (etapa 4).
// Uso: node tools/e2e/inicio.mjs <carpeta-para-fotos>
import { expectEqual, openBrowser, prepareUser, step } from './helpers.mjs';

const SHOTS = process.argv[2];
const u = await prepareUser({ accounts: [['Banco Principal', 10000000], ['Efectivo', 1000000]] }); // $ 100.000 y $ 10.000
const ui = await openBrowser();
const { page, text, label, button, choose } = ui;
const amountOf = async (labelText) => {
  const box = page.getByText(labelText, { exact: true }).filter({ visible: true }).first();
  return (await box.locator('xpath=following-sibling::*[1]').textContent()) ?? '';
};

await ui.login(u.email, u.password);
await text('Dinero disponible').waitFor();
step('Inicio');
expectEqual(await amountOf('Dinero disponible'), '$ 110.000,00', 'Dinero disponible');
await text('Sumá lo que tenés por pagar').waitFor();
await ui.shot(SHOTS, 'i1-inicio');

// Anotar la Visa desde la tarjeta de Inicio
await button('Anotar').click();
await text('Anotá lo que debés hoy.').waitFor();
await label('Nombre').fill('Visa');
await label('Cuánto debés hoy').fill('0');
await ui.shot(SHOTS, 'i2-anotar');
await button('Guardar').click();
await text('Visa anotado').waitFor();
step('Anotó la Visa (debe $ 0)');

// Caso: cine de $ 25.000 con $ 10.000 en efectivo y $ 15.000 con la Visa
await button('Registrar gastos').click();
await label('Monto total').fill('25000');
await choose(/^Categoría/, /Ocio/);
await choose(/^Pagado con/, /^Efectivo/);
await text('Faltan $ 15.000,00 para cubrir este gasto').waitFor().catch(async () => {
  await text(/Faltan .*15\.000,00/).waitFor();
});
const disabled = await button('Registrar gasto').isDisabled();
step(`Gasto mayor que el saldo de Efectivo → aviso y botón desactivado: ${disabled}`);
if (!disabled) throw new Error('El botón debía estar desactivado');
await ui.shot(SHOTS, 'i3-gasto-no-alcanza');
await button('Dividir el pago con otra cuenta').click();
await choose('Cuenta 2', /^Visa/);
await text(/Repartido el total/).waitFor();
await label('Descripción (opcional)').fill('Cine');
await ui.shot(SHOTS, 'i4-gasto-dividido');
await button('Registrar gasto').click();
await text(/Gasto de .*25\.000,00 registrado/).waitFor();
step('Registró el cine dividido');
expectEqual(await amountOf('Dinero disponible'), '$ 100.000,00', 'Dinero disponible después del cine');
expectEqual(await amountOf('Por pagar'), '$ 15.000,00', 'Por pagar después del cine');
await text(/Visa .*15\.000,00 \+ Efectivo .*10\.000,00/).waitFor();
step('Efectivo bajó $ 10.000 y la Visa subió $ 15.000; el movimiento muestra las dos partes');

// Ingreso
await button('Registrar ingresos').click();
await label('Monto').fill('50000');
await choose(/^Cuenta donde entra/, /^Banco Principal/);
await label('Descripción (opcional)').fill('Sueldo');
await button('Registrar ingreso').click();
await text(/Ingreso de .*50\.000,00 registrado en Banco Principal/).waitFor();
step('Registró un ingreso de $ 50.000 en el banco');
const gastosAntes = await page.getByText('Gastos', { exact: true }).filter({ visible: true }).first().locator('xpath=../following-sibling::*[1]').textContent();

// Caso: pagar el resumen de la Visa desde el banco
await button(/^Por pagar/).click();
await text('Total por pagar').waitFor();
await ui.shot(SHOTS, 'i5-por-pagar');
await button('Registrar un pago').click();
await choose(/^¿Qué pagás\?/, /^Visa/);
await page.getByText(/Pagar el total/).filter({ visible: true }).first().click();
await choose(/^Pagado desde/, /^Banco Principal/);
await ui.shot(SHOTS, 'i6-pago');
await button('Registrar pago').click();
await text(/Pago de .*15\.000,00 registrado/).waitFor();
await page.goBack();
await text('Dinero disponible').waitFor();
expectEqual(await amountOf('Dinero disponible'), '$ 135.000,00', 'Dinero disponible después del pago');
const gastosDespues = await page.getByText('Gastos', { exact: true }).filter({ visible: true }).first().locator('xpath=../following-sibling::*[1]').textContent();
expectEqual(gastosDespues, '$ 25.000,00', 'Gastos del mes después del pago');
step(`Pagó la Visa desde el banco: el banco bajó, la deuda quedó en 0 y el gasto del mes sigue en ${gastosAntes}`);

// Gasto con categoría nueva
await button('Registrar gastos').click();
await label('Monto total').fill('1500,5');
await choose(/^Categoría/, /Nueva categoría/);
await label('Nombre de la nueva categoría').fill('Mascotas');
await choose(/^Pagado con/, /^Banco Principal/);
await button('Registrar gasto').click();
await text(/Gasto de .*1\.500,50 registrado/).waitFor();
await text('Mascotas').waitFor();
step('Gasto con categoría nueva "Mascotas"');
await ui.shot(SHOTS, 'i7-inicio-final');

// Menú: cambiar el nombre
await page.getByRole('button', { name: 'Menú' }).click();
await button('Cambiar mi nombre').click();
await label('Así te saludamos en la app').fill('Leonardo');
await button('Guardar').click();
await text('Hola, Leonardo').waitFor();
step('Cambió el nombre desde el menú');

await ui.finish();
