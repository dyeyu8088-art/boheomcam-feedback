/** 牌桌设计稿截图：延边麻将 / 红十（1920×1080 + Android 横屏 960×540@2x） */
import { chromium } from 'playwright';

const SHOT_DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });

const sizes = [
  { name: 'pc', w: 1920, h: 1080, dsf: 1 },
  { name: 'land', w: 960, h: 540, dsf: 2 },
];
const games = [
  { key: 'mahjong_yanbian', route: 'mahjong', tag: 'mahjong' },
  { key: 'hongshi', route: 'hongshi', tag: 'hongshi' },
];

for (const s of sizes) {
  for (const g of games) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dsf });
    page.on('pageerror', (e) => console.error(`[${g.tag}/${s.name}] pageerror:`, e.message));
    try {
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(700);
      if (page.url().includes('/login')) {
        await page.locator('button:has-text("游客快速开始")').click().catch(() => {});
        await page.waitForURL('**/#/lobby', { timeout: 12000 }).catch(() => {});
      }
      await page.waitForTimeout(1200);
      await page.locator(`.poster-card.${g.key}`).click();
      await page.waitForTimeout(700);
      await page.locator('.stage').first().click();
      await page.waitForURL(`**/#/game/${g.route}**`, { timeout: 10000 });
      // 等待机器人补位 + 开局发牌
      await page.waitForTimeout(11000);
      await page.screenshot({ path: `${SHOT_DIR}/table-${g.tag}-${s.name}.png` });
      console.log(`shot: table-${g.tag}-${s.name}.png`);
    } catch (e) {
      console.error(`  ✗ ${g.tag}/${s.name}:`, e.message);
      await page.screenshot({ path: `${SHOT_DIR}/table-${g.tag}-${s.name}-err.png` }).catch(() => {});
    }
    await page.close();
  }
}

await browser.close();
