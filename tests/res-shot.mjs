/**
 * 多分辨率布局回归：GAMES=lobby,roulette,stock,slot SIZES=2560x1440,1600x900,1366x768,1280x720,tablet,phone
 * 每个组合各截一张（进入游戏后静态画面），供人工复核布局是否溢出 / 重叠。
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const SHOT_DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const PRESET = {
  '2560x1440': { width: 2560, height: 1440, scale: 1 },
  '1600x900': { width: 1600, height: 900, scale: 1 },
  '1366x768': { width: 1366, height: 768, scale: 1 },
  '1280x720': { width: 1280, height: 720, scale: 1 },
  tablet: { width: 1180, height: 820, scale: 2 },
  phone: { width: 844, height: 390, scale: 3 },
};
const ENTRY = {
  lobby: null,
  roulette: { card: '.gcard.roulette', url: '**/#/game/roulette**', wait: 3000 },
  stock: { card: '.gcard.stock_updown', url: '**/#/game/stock**', wait: 3500 },
  slot: { card: '.gcard.slot_fruit', url: '**/#/game/slot**', wait: 2500 },
  fishing: { card: '.gcard.fishing', url: '**/#/game/fishing**', wait: 5000, stage: true },
};
const games = (process.env.GAMES ?? 'lobby,roulette,stock,slot').split(',');
const sizes = (process.env.SIZES ?? '2560x1440,1366x768,1280x720').split(',');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
for (const sz of sizes) {
  const v = PRESET[sz];
  if (!v) continue;
  for (const g of games) {
    const page = await browser.newPage({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.scale });
    page.on('pageerror', (e) => console.error(`  [pageerror ${g}@${sz}]`, e.message));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.locator('button:has-text("游客快速开始")').click();
    await page.waitForURL('**/#/lobby', { timeout: 10000 });
    await page.waitForTimeout(1200);
    const e = ENTRY[g];
    if (e) {
      await page.locator(e.card).click();
      if (e.stage) {
        await page.waitForTimeout(500);
        await page.locator('.stage').first().click();
      }
      await page.waitForURL(e.url, { timeout: 10000 });
      await page.waitForTimeout(e.wait);
    }
    await page.screenshot({ path: `${SHOT_DIR}/res-${g}-${sz}.png` });
    console.log(`shot: res-${g}-${sz}.png`);
    await page.close();
  }
}
await browser.close();
