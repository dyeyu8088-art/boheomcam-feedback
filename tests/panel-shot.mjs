/** 大厅五个导航面板截图：活动 / 战绩 / 好友 / 我的 + 功能弹窗 */
import { chromium } from 'playwright';

const SHOT_DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror:', e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
if (page.url().includes('/login')) {
  await page.locator('button:has-text("游客快速开始")').click().catch(() => {});
  await page.waitForURL('**/#/lobby', { timeout: 12000 }).catch(() => {});
}
await page.waitForTimeout(1800);

const tabs = [
  { i: 2, name: 'activity' },
  { i: 3, name: 'records' },
  { i: 4, name: 'friends' },
  { i: 5, name: 'me' },
];
for (const t of tabs) {
  await page.locator(`.dock .dock-item:nth-child(${t.i})`).click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${SHOT_DIR}/panel-${t.name}.png` });
  console.log(`shot: panel-${t.name}.png`);
}

// 功能弹窗：排行榜 / 邮件 / 公告
await page.locator('.dock .dock-item:nth-child(1)').click();
await page.waitForTimeout(900);
for (const [idx, name] of [[3, 'rank'], [4, 'mail'], [5, 'announce']]) {
  await page.locator(`.features .feat:nth-child(${idx})`).click();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `${SHOT_DIR}/modal-${name}.png` });
  console.log(`shot: modal-${name}.png`);
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('.sheet .x').click().catch(() => {});
  await page.waitForTimeout(500);
}

await browser.close();
