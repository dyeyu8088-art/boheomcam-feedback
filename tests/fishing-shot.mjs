/** 捕鱼界面截图回归：1920×1080 与 960×540@2x（进入新手场，等待鱼群，开火 + 用一次技能） */
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
  await page.locator('.gcard.fishing').click();
  await page.waitForTimeout(500);
  await page.locator('.stage').first().click();
  await page.waitForURL('**/#/game/fishing**', { timeout: 10000 });
  await page.waitForTimeout(7000);
  await page.mouse.move(v.width * 0.6, v.height * 0.35);
  await page.mouse.click(v.width * 0.6, v.height * 0.35);
  await page.waitForTimeout(300);
  await page.locator('.skill').first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOT_DIR}/fishing-${v.name}.png` });
  console.log(`shot: fishing-${v.name}.png`);
  await page.close();
}
await browser.close();
