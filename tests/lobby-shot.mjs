/** 大厅设计稿截图：1920×1080 / 2560×1440 / Android 横屏 / 手机竖屏 */
import { chromium } from 'playwright';

const SHOT_DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });

const sizes = [
  { name: 'pc-1920', w: 1920, h: 1080, dsf: 1 },
  { name: 'pc-2560', w: 2560, h: 1440, dsf: 1 },
  { name: 'android-land', w: 960, h: 540, dsf: 2 },
  { name: 'phone-portrait', w: 414, h: 896, dsf: 2 },
];

for (const s of sizes) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dsf });
  page.on('pageerror', (e) => console.error(`[${s.name}] pageerror:`, e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  // 登录（已有会话直接进大厅）
  if (page.url().includes('/login')) {
    await page.locator('button:has-text("游客快速开始")').click().catch(() => {});
    await page.waitForURL('**/#/lobby', { timeout: 12000 }).catch(() => {});
  }
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${SHOT_DIR}/lobby-${s.name}.png` });
  console.log(`shot: lobby-${s.name}.png`);
  await page.close();
}

await browser.close();
