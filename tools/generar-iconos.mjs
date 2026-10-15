// Genera los íconos de la app a partir del logo (dos cintas que suben y terminan en una flecha).
// Uso: node tools/generar-iconos.mjs   (usa el navegador de Playwright para dibujar el SVG)
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BG = '#0B1226';
const TURQUESA = '#4FE3D4';
const MARK = (color) => `
  <path d="M483 328 L565 220 L648 328 L620 328 C620 390 600 440 545 480 C480 525 400 560 382 620 C376 645 378 665 380 682 C345 655 325 615 330 570 C338 510 380 470 430 445 C490 415 515 385 520 328 Z" fill="${color}"/>
  <path d="M635 405 C662 435 672 480 655 520 C635 565 585 590 540 615 C495 640 475 680 480 720 C483 748 490 765 500 780 C460 770 420 740 410 695 C400 645 430 610 480 585 C540 555 595 530 620 485 C632 460 636 430 635 405 Z" fill="${color}"/>`;

/** Logo centrado ocupando `scale` del alto del lienzo (el dibujo mide 400×600) */
function svg(size, { bg = null, color = TURQUESA, scale = 0.6, radius = 0 } = {}) {
  const h = size * scale;
  const w = (h * 2) / 3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bg ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>` : ''}
    <svg x="${(size - w) / 2}" y="${(size - h) / 2}" width="${w}" height="${h}" viewBox="300 200 400 600">${MARK(color)}</svg>
  </svg>`;
}

const files = [
  ['assets/icon.png', 1024, { bg: BG, scale: 0.56 }],
  // Ícono adaptativo de Android: el dibujo tiene que quedar dentro del círculo central (66%)
  ['assets/android-icon-foreground.png', 1024, { scale: 0.42 }],
  ['assets/android-icon-background.png', 1024, { bg: BG, scale: 0, color: BG }],
  ['assets/android-icon-monochrome.png', 1024, { scale: 0.42, color: '#FFFFFF' }],
  ['assets/splash-icon.png', 1024, { scale: 0.7 }],
  ['assets/favicon.png', 48, { bg: BG, scale: 0.7, radius: 10 }],
  ['assets/store/icono-512.png', 512, { bg: BG, scale: 0.56 }],
];

const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const page = await browser.newPage();
for (const [file, size, opts] of files) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size, opts)}</body></html>`);
  await page.locator('svg').first().screenshot({ path: join(root, file), omitBackground: true });
  console.log('✓', file);
}
await browser.close();
