/** 股票涨跌截图回归：1920×1080 与 960×540@2x（进场 → 看涨 / 高于现价 / 区间下注 → 结算面板） */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const SHOT_DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
for (const v of [
  { name: 'pc', width: 1920, height: 1080, scale: 1 },
  { name: 'land', width: 960, height: 540, scale: 2 },
].filter((s) => !process.env.SIZE || s.name === process.env.SIZE)) {
  const page = await browser.newPage({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.scale });
  page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("游客快速开始")').click();
  await page.waitForURL('**/#/lobby', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/#/game/stock`);
  await page.waitForURL('**/#/game/stock**', { timeout: 10000 });
  await page.waitForTimeout(3000);
  for (let i = 0; i < 80; i += 1) {
    const ok = await page.evaluate(() => document.querySelector('.phase')?.classList.contains('betting') && !document.querySelector('.big.up')?.disabled);
    if (ok) break;
    await page.waitForTimeout(500);
  }
  await page.locator('.chips .chip').nth(2).click({ force: true });
  await page.locator('.big.up').click({ force: true });
  await page.waitForTimeout(600);
  await page.locator('.sb').first().click({ force: true });
  await page.waitForTimeout(600);
  await page.locator('.range').nth(2).click({ force: true });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOT_DIR}/stock-${v.name}.png` });
  console.log(`shot: stock-${v.name}.png`);
  for (let i = 0; i < 80; i += 1) {
    if ((await page.locator('.result-panel').count()) > 0) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT_DIR}/stock-${v.name}-result.png` });
  console.log(`shot: stock-${v.name}-result.png`);
  await page.close();
}
await browser.close();
