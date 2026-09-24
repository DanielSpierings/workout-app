// Rendert public/icon.svg naar PNG-iconen (nodig voor iOS). Gebruik: node scripts/gen-icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
for (const [size, file] of [[180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
  await page.setViewportSize({ width: size, height: size });
  // iOS rondt zelf de hoeken af, dus een vol vierkant zonder transparantie.
  const square = svg.replace('rx="112"', 'rx="0"');
  await page.setContent(`<html><body style="margin:0">${square.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname });
}
await browser.close();
