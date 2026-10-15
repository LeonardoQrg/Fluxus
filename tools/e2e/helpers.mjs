// Ayudas para las pruebas de punta a punta: navegador con tamaño de celular y
// preparación rápida de datos a través del Supabase de prueba.
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

export const BASE = 'http://localhost:8081';
export const API = 'http://localhost:54321';

export const plain = (s) => (s ?? '').replace(/[  ]/g, ' ');

async function api(path, { token, method = 'POST', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', apikey: 'local', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${path}: ${text}`);
  return data;
}

/** Crea un usuario con la configuración inicial terminada y sus cuentas de dinero */
export async function prepareUser({ name = 'Leo', currency = 'ARS', accounts = [] } = {}) {
  const email = `${name.toLowerCase()}${Date.now()}${Math.floor(Math.random() * 1000)}@correo.com`;
  const password = 'secreto1';
  const s = await api('/auth/v1/signup', { body: { email, password, data: { name } } });
  const token = s.access_token;
  await api(`/rest/v1/profiles?user_id=eq.${s.user.id}`, { token, method: 'PATCH', body: { currency } });
  const ids = {};
  for (const [accName, amount] of accounts) {
    ids[accName] = await api('/rest/v1/rpc/save_initial_account', { token, body: { p_id: null, p_name: accName, p_amount: amount } });
  }
  await api(`/rest/v1/profiles?user_id=eq.${s.user.id}`, { token, method: 'PATCH', body: { onboarding_step: 'done' } });
  const rpc = (fn, args) => api(`/rest/v1/rpc/${fn}`, { token, body: args });
  return { email, password, ids, rpc };
}

export async function openBrowser() {
  const browser = await chromium.launch({ args: ['--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()));
  const vis = (l) => l.filter({ visible: true }).first();
  const ui = {
    browser,
    page,
    errors,
    text: (t) => vis(page.getByText(t)),
    label: (t) => vis(page.getByLabel(t, { exact: true })),
    button: (t) => vis(page.getByRole('button', { name: t, exact: true })),
    link: (t) => vis(page.getByRole('link', { name: t, exact: true })),
    radio: (t) => vis(page.getByRole('radio', { name: t })),
    /** Abre un campo de selección y elige una opción */
    async choose(fieldLabel, option) {
      await vis(page.getByRole('button', { name: fieldLabel })).click();
      await vis(page.getByRole('radio', { name: option })).click();
    },
    shot: (dir, n) => page.screenshot({ path: `${dir}/${n}.png`, fullPage: true }),
    async login(email, password) {
      await page.goto(`${BASE}/iniciar-sesion`);
      await ui.label('Correo electrónico').fill(email);
      await ui.label('Contraseña').fill(password);
      await ui.button('Ingresar').click();
    },
    finish() {
      console.log(errors.length ? `ERRORES EN CONSOLA:\n${errors.join('\n')}` : 'Sin errores en la consola');
      return browser.close();
    },
  };
  return ui;
}

export const step = (s) => console.log('→', s);

export function expectEqual(actual, expected, what) {
  if (plain(actual) !== expected) throw new Error(`${what}: se esperaba "${expected}" y llegó "${plain(actual)}"`);
}
