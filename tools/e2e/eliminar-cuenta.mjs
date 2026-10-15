// Prueba de punta a punta de "Eliminar mi cuenta".
// Uso: node tools/e2e/eliminar-cuenta.mjs <carpeta-para-fotos>
import { API, openBrowser, prepareUser, step } from './helpers.mjs';

const SHOTS = process.argv[2];
const u = await prepareUser({ name: 'Eli', accounts: [['Banco Principal', 5000000]] });
const otra = await prepareUser({ name: 'Otra', accounts: [['Banco', 100]] });
const ui = await openBrowser();
const { page, text, label, button } = ui;

await ui.login(u.email, u.password);
await text('Dinero disponible').waitFor();
await page.getByRole('button', { name: 'Menú' }).click();
await button('Eliminar mi cuenta').click();
await text('Esto no se puede deshacer').waitFor();
if (!(await button('Eliminar mi cuenta y mis datos').isDisabled())) throw new Error('Debe estar desactivado hasta escribir ELIMINAR');
step('Pantalla de confirmación: el botón está desactivado');
await ui.shot(SHOTS, 'e1-eliminar-cuenta');
await label('Para confirmar, escribí ELIMINAR').fill('eliminar');
await ui.shot(SHOTS, 'e2-escrito');
await button('Eliminar mi cuenta y mis datos').click();
await text('Tu dinero, en movimiento y en orden.').waitFor();
step('Escribió ELIMINAR → cuenta borrada y vuelta a la bienvenida');

await ui.login(u.email, u.password);
await text('El correo o la contraseña no coinciden. Revisalos e intentá de nuevo.').waitFor();
step('Ya no se puede entrar con ese correo');

await page.evaluate(() => localStorage.clear());
await ui.login(otra.email, otra.password);
await text('Dinero disponible').waitFor();
step('La cuenta de otra persona sigue intacta');
await ui.finish();
