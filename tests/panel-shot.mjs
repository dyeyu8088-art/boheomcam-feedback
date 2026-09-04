/**
 * 大厅各面板截图回归：游戏 / 比赛 / 好友 / 背包 / 商城 / VIP / 设置（1920×1080）。
 * 用法：node tests/panel-shot.mjs   （需 vite :5173 + api :8080）
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const SHOT_DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('  [pageerror]', e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.locator('button:has-text("游客快速开始")').click();
await page.waitForURL('**/#/lobby', { timeout: 10000 });
await page.waitForTimeout(1200);
const tabs = ['games', 'friends', 'bag', 'shop'];
for (let i = 0; i < tabs.length; i += 1) {
  await page.locator(`.gn-item:nth-child(${i + 2})`).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOT_DIR}/panel-${tabs[i]}.png` });
  console.log(`shot: panel-${tabs[i]}.png`);
}
// 商城购买一次（真实下单）
await page.locator('.prod .gb').first().click();
await page.waitForTimeout(2200);
await page.screenshot({ path: `${SHOT_DIR}/panel-shop-bought.png` });
console.log('shot: panel-shop-bought.png');
// VIP 弹窗
await page.locator('.side .feat.more').click();
await page.waitForTimeout(500);
await page.locator('.more-item').first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${SHOT_DIR}/popup-vip.png` });
console.log('shot: popup-vip.png');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
// 设置
await page.locator('.tb-gear').click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${SHOT_DIR}/popup-settings.png` });
console.log('shot: popup-settings.png');
await browser.close();
