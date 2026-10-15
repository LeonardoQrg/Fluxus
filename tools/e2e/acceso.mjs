// Prueba de punta a punta del acceso (etapa 2), en un navegador con tamaño de celular.
// Requiere el Supabase de prueba y la web exportada (ver tools/supabase-local/README.md).
// Uso: node tools/e2e/acceso.mjs <carpeta-para-fotos>
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
// Usa el Playwright instalado en el sistema
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const SHOTS = process.argv[2];
const BASE = 'http://localhost:8081';
const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const step = (s) => console.log('→', s);
const email = `leo${Date.now()}@correo.com`;

await page.goto(BASE);
await page.getByText('Tu dinero, en movimiento y en orden.').filter({ visible: true }).first().waitFor();
step('Bienvenida'); await shot('01-bienvenida');

await page.getByText('Crear nuevo perfil').filter({ visible: true }).first().click();
await page.getByText('Así te vamos a saludar en la app.').filter({ visible: true }).first().waitFor();
await page.getByLabel('Tu nombre').filter({ visible: true }).fill('Leo');
await page.getByLabel('Correo electrónico').filter({ visible: true }).fill(email);
await page.getByLabel('Contraseña', { exact: true }).filter({ visible: true }).fill('secreto1');
await page.getByLabel('Repetir contraseña').filter({ visible: true }).fill('secreto');
await page.getByText('Contraseñas incorrectas').filter({ visible: true }).first().waitFor();
const disabled = await page.getByRole('button', { name: 'Crear usuario' }).filter({ visible: true }).isDisabled();
step(`Contraseñas distintas → botón desactivado: ${disabled}`); await shot('02-crear-incorrectas');
await page.getByLabel('Repetir contraseña').filter({ visible: true }).fill('secreto1');
await page.getByText('Contraseñas correctas').filter({ visible: true }).first().waitFor();
step('Contraseñas iguales'); await shot('03-crear-correctas');
await page.getByRole('button', { name: 'Crear usuario' }).filter({ visible: true }).click();

await page.getByText('Perfil creado. Ya podés iniciar sesión.').filter({ visible: true }).first().waitFor();
const prefilled = await page.getByLabel('Correo electrónico').filter({ visible: true }).inputValue();
step(`Volvió a Iniciar sesión con el correo cargado: ${prefilled === email}`); await shot('04-login-creado');

await page.getByLabel('Contraseña', { exact: true }).filter({ visible: true }).fill('mala');
await page.getByRole('button', { name: 'Ingresar' }).filter({ visible: true }).click();
await page.getByText('El correo o la contraseña no coinciden. Revisalos e intentá de nuevo.').filter({ visible: true }).first().waitFor();
step('Contraseña incorrecta → mensaje'); await shot('05-login-error');

await page.getByLabel('Contraseña', { exact: true }).filter({ visible: true }).fill('secreto1');
await page.getByRole('button', { name: 'Ingresar' }).filter({ visible: true }).click();
await page.getByText('Hola, Leo').filter({ visible: true }).first().waitFor();
step('Ingresó: "Hola, Leo"'); await shot('06-inicio');

// Al recargar, la sesión sigue
await page.reload();
await page.getByText('Hola, Leo').filter({ visible: true }).first().waitFor();
step('Recargó y sigue con la sesión iniciada');

await page.getByText('Cerrar sesión').filter({ visible: true }).first().click();
await page.getByText('Tu dinero, en movimiento y en orden.').filter({ visible: true }).first().waitFor();
step('Cerró sesión → bienvenida');

// Olvidé mi contraseña
await page.getByText('Iniciar sesión').filter({ visible: true }).first().click();
await page.getByLabel('Correo electrónico').filter({ visible: true }).fill(email);
await page.getByText('Olvidé mi contraseña').filter({ visible: true }).first().click();
await page.getByText('Recuperar contraseña').filter({ visible: true }).first().waitFor();
await page.getByRole('button', { name: 'Enviar enlace' }).filter({ visible: true }).click();
await page.getByText(`Si hay un perfil con ${email}, vas a recibir el enlace en unos minutos.`).filter({ visible: true }).first().waitFor();
step('Pidió el enlace'); await shot('07-olvide');
await page.getByLabel('Correo electrónico').filter({ visible: true }).fill('nadie@correo.com');
await page.getByRole('button', { name: 'Enviar enlace' }).filter({ visible: true }).click();
await page.getByText('Si hay un perfil con nadie@correo.com, vas a recibir el enlace en unos minutos.').filter({ visible: true }).first().waitFor();
step('Con un correo que no existe responde lo mismo');

const link = readFileSync('/tmp/fluxus-correos.log', 'utf8').trim().split('\n').pop().split(' ').pop();
await page.goto(link);
await page.getByText('Nueva contraseña').filter({ visible: true }).first().first().waitFor();
step('Abrió el enlace del correo → Nueva contraseña'); await shot('08-nueva-contrasena');
await page.getByLabel('Contraseña nueva').filter({ visible: true }).fill('otra1234');
await page.getByLabel('Repetir contraseña').filter({ visible: true }).fill('otra1234');
await page.getByRole('button', { name: 'Guardar contraseña' }).filter({ visible: true }).click();
await page.getByText('Hola, Leo').filter({ visible: true }).first().waitFor();
step('Guardó la contraseña nueva → entró');
await page.getByText('Cerrar sesión').filter({ visible: true }).first().click();
await page.getByText('Iniciar sesión').filter({ visible: true }).first().click();
await page.getByLabel('Correo electrónico').filter({ visible: true }).fill(email);
await page.getByLabel('Contraseña', { exact: true }).filter({ visible: true }).fill('otra1234');
await page.getByRole('button', { name: 'Ingresar' }).filter({ visible: true }).click();
await page.getByText('Hola, Leo').filter({ visible: true }).first().waitFor();
step('Entró con la contraseña nueva');

// Usuario de prueba
await page.getByText('Cerrar sesión').filter({ visible: true }).first().click();
await page.getByText('Iniciar sesión').filter({ visible: true }).first().click();
await page.getByLabel('Correo electrónico').filter({ visible: true }).fill('admin@gmail.com');
await page.getByLabel('Contraseña', { exact: true }).filter({ visible: true }).fill('admin');
await page.getByRole('button', { name: 'Ingresar' }).filter({ visible: true }).click();
await page.getByText('Hola, Admin').filter({ visible: true }).first().waitFor();
step('Usuario de prueba admin@gmail.com / admin funciona');

console.log(errors.length ? `ERRORES EN CONSOLA:\n${errors.join('\n')}` : 'Sin errores en la consola');
await browser.close();
