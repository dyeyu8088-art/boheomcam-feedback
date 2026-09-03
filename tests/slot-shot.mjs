/** 水果机界面截图回归：1920×1080 与 960×540@2x（进入 → 等待奖池 → Spin 一次 → 等停轮） */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const SHOT_DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
for (const v of [
  { name: 'pc', width: 1920, height: 1080, scale: 1 },
  { name: 'land', width: 960, height: 540, scale: 2 },
]) {
  const page = await browser.newPage({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.scale });
  page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("游客快速开始")').click();
  await page.waitForURL('**/#/lobby', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.locator('.gcard.slot_fruit').click();
  await page.waitForURL('**/#/game/slot**', { timeout: 10000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOT_DIR}/slot-${v.name}-idle.png` });
  await page.locator('button.spin').click({ force: true });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOT_DIR}/slot-${v.name}-spin.png` });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${SHOT_DIR}/slot-${v.name}.png` });
  console.log(`shot: slot-${v.name}.png`);
  await page.close();
}
await browser.close();
