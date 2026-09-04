/** 轮盘截图回归：1920×1080 与 960×540@2x（进桌 → 放筹码 → 确认 → 开奖转盘 → 派彩面板） */
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
  await page.goto(`${BASE}/#/game/roulette`);
  await page.waitForURL('**/#/game/roulette**', { timeout: 10000 });
  await page.waitForTimeout(2500);
  // 等到下注阶段且剩余 ≥ 8s
  for (let i = 0; i < 120; i += 1) {
    const ok = await page.evaluate(() => {
      const el = document.querySelector('.phase');
      return el && el.classList.contains('betting');
    });
    if (ok) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(300);
  await page.locator('.chips .chip').nth(2).click({ force: true });
  await page.locator('.cell.red').first().click({ force: true });
  await page.locator('.grid .cell').nth(16).click({ force: true });
  await page.locator('.grid .cell').nth(16).click({ force: true });
  await page.locator('.dozens .cell').nth(1).click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT_DIR}/roulette-${v.name}-staged.png` });
  await page.locator('button.confirm').click({ force: true });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOT_DIR}/roulette-${v.name}.png` });
  console.log(`shot: roulette-${v.name}.png`);
  // 等开奖动画
  for (let i = 0; i < 100; i += 1) {
    const spinning = await page.evaluate(() => document.querySelector('.phase')?.classList.contains('spinning'));
    if (spinning) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${SHOT_DIR}/roulette-${v.name}-spin.png` });
  for (let i = 0; i < 40; i += 1) {
    if ((await page.locator('.result-panel').count()) > 0) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOT_DIR}/roulette-${v.name}-result.png` });
  console.log(`shot: roulette-${v.name}-result.png`);
  await page.close();
}
await browser.close();
