/** 结算演出截图：进桌后不操作（超时托管），等机器人打完一局，抓取 胡牌爆字/喊话 与 结算面板 */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const SHOT_DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const games = [
  { key: 'hongshi', route: 'hongshi', tag: 'hongshi' },
  { key: 'mahjong_yanbian', route: 'mahjong', tag: 'mahjong' },
].filter((g) => !process.env.ONLY || g.tag === process.env.ONLY);
for (const g of games) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => console.error(`[${g.tag}] pageerror:`, e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("游客快速开始")').click();
  await page.waitForURL('**/#/lobby', { timeout: 12000 });
  await page.waitForTimeout(1000);
  await page.locator(`.gcard.${g.key}`).click();
  await page.waitForTimeout(700);
  await page.locator('.stage').first().click();
  await page.waitForURL(`**/#/game/${g.route}**`, { timeout: 10000 });
  const t0 = Date.now();
  let gotCallout = false;
  let gotFx = false;
  let gotSettle = false;
  let gotFxSettle = false;
  const maxMs = Number(process.env.MAX_MS ?? 240000);
  const wantFx = process.env.WANT_FX === '1' && g.tag === 'mahjong';
  while (Date.now() - t0 < maxMs && !(gotSettle && (!wantFx || gotFx))) {
    await page.waitForTimeout(350);
    if (!gotCallout && (await page.locator('.callout').count()) > 0) {
      gotCallout = true;
      await page.screenshot({ path: `${SHOT_DIR}/settle-${g.tag}-callout.png` });
      console.log(`shot: settle-${g.tag}-callout.png (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
    if (!gotFx && (await page.locator('.hu-fx').count()) > 0) {
      gotFx = true;
      await page.screenshot({ path: `${SHOT_DIR}/settle-${g.tag}-fx.png` });
      console.log(`shot: settle-${g.tag}-fx.png`);
    }
    if ((await page.locator('.gp').count()) > 0 && (!gotSettle || (gotFx && !gotFxSettle))) {
      await page.waitForTimeout(900);
      const name = gotFx ? `settle-${g.tag}-hu.png` : `settle-${g.tag}.png`;
      await page.screenshot({ path: `${SHOT_DIR}/${name}` });
      console.log(`shot: ${name} (${Math.round((Date.now() - t0) / 1000)}s)`);
      if (gotFx) gotFxSettle = true;
      gotSettle = true;
      await page.waitForTimeout(7000);
    }
  }
  if (!gotSettle) console.log(`  ✗ ${g.tag}: ${maxMs / 1000}s 内未出现结算面板`);
  if (wantFx && !gotFx) console.log(`  ✗ ${g.tag}: ${maxMs / 1000}s 内未出现胡牌`);
  await page.close();
}
await browser.close();
