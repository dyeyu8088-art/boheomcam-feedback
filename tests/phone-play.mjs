/**
 * 手机横屏实机走查（Playwright + Chromium，触屏 + 移动 UA）：六游戏全流程截图 + 页面错误收集。
 *   PHONE=844x390|800x360  LOCALE=ko|zh  ONLY=lobby,mahjong,hongshi,fishing,slot,roulette,stock  BASE_URL=…
 * 输出 /tmp/shots/phone-<locale>-<preset>-<step>.png；用于人工审阅布局 / 文案 / 触控目标 / 流程提示。
 */
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const SHOT_DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const LOCALE = process.env.LOCALE ?? 'ko';
const PRESETS = { '844x390': { w: 844, h: 390, dsf: 3 }, '800x360': { w: 800, h: 360, dsf: 3 }, '915x412': { w: 915, h: 412, dsf: 2.6 } };
const P = PRESETS[process.env.PHONE ?? '844x390'] ?? PRESETS['844x390'];
const only = (process.env.ONLY ?? 'lobby,mahjong,hongshi,fishing,slot,roulette,stock').split(',');
const tag = `phone-${LOCALE}-${process.env.PHONE ?? '844x390'}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({
  viewport: { width: P.w, height: P.h },
  deviceScaleFactor: P.dsf,
  isMobile: true,
  hasTouch: true,
  userAgent: devices['Pixel 7'].userAgent,
});
await ctx.addInitScript((l) => localStorage.setItem('locale', l), LOCALE);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`);
});
const shot = async (name) => {
  await page.screenshot({ path: `${SHOT_DIR}/${tag}-${name}.png` });
  console.log(`  shot ${name}`);
};
const waitFor = async (sel, ms) => {
  try {
    await page.locator(sel).first().waitFor({ state: 'visible', timeout: ms });
    return true;
  } catch {
    return false;
  }
};
const closePopup = async () => {
  const c = page.locator('.gp-close');
  if ((await c.count()) > 0 && (await c.first().isVisible())) await c.first().click();
  await page.waitForTimeout(400);
};
const backToLobby = async () => {
  await page.goto(`${BASE}/#/lobby`);
  await page.waitForTimeout(1500);
};
const leaveTable = async () => {
  await page.locator('.hback').first().click().catch(() => undefined);
  await page.waitForTimeout(600);
  const leave = page.locator('.gp-body button', { hasText: LOCALE === 'ko' ? '방 나가기' : '退出房间' });
  if ((await leave.count()) > 0) await leave.first().click().catch(() => undefined);
  await page.waitForTimeout(800);
  await backToLobby();
};

// 登录
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await shot('login');
await page.locator('.btn-primary.big').first().click();
await page.waitForURL('**/#/lobby', { timeout: 10000 });
await page.waitForTimeout(1500);

if (only.includes('lobby')) {
  console.log('▶ lobby');
  await shot('lobby');
  const feats = ['activity', 'signin', 'tasks', 'mail', 'rank', 'announce', 'vip'];
  for (let i = 0; i < feats.length; i += 1) {
    await page.locator('.side .feat').nth(i).click().catch(() => undefined);
    await page.waitForTimeout(900);
    await shot(`lobby-${feats[i]}`);
    await closePopup();
  }
  const navs = ['games', 'tournament', 'friends', 'bag', 'shop'];
  for (let i = 0; i < navs.length; i += 1) {
    await page.locator('.gn-item').nth(i + 1).click().catch(() => undefined);
    await page.waitForTimeout(900);
    await shot(`lobby-${navs[i]}`);
    await closePopup();
    await page.locator('.gn-item').nth(0).click().catch(() => undefined);
    await page.waitForTimeout(300);
  }
  await page.locator('.pp-name').first().click().catch(() => undefined);
  await page.waitForTimeout(900);
  await shot('lobby-me');
  await closePopup();
}

if (only.includes('mahjong')) {
  console.log('▶ mahjong');
  await page.locator('.gcard.mahjong_yanbian').click();
  await page.waitForTimeout(600);
  await shot('mj-stages');
  await page.locator('.stage').first().click();
  await page.waitForURL('**/#/game/mahjong**', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await shot('mj-matching');
  await waitFor('.my-hand .htile', 20000);
  await page.waitForTimeout(1200);
  await shot('mj-deal');
  if (await waitFor('.my-head.active', 45000)) {
    await page.waitForTimeout(400);
    await shot('mj-turn');
    const tiles = page.locator('.my-hand .htile');
    await tiles.first().click();
    await page.waitForTimeout(400);
    await shot('mj-select');
    await tiles.first().click();
    await page.waitForTimeout(800);
    await shot('mj-discarded');
  }
  if (await waitFor('.action-bar', 60000)) {
    await shot('mj-ask');
    const pass = page.locator('.action-bar .act.pass');
    if ((await pass.count()) > 0) await pass.first().click();
  }
  // 不再操作 → 超时后进入托管，由服务端把本局打完
  if (await waitFor('.trustee-bar', 40000)) await shot('mj-trustee');
  if (await waitFor('.settle', 240000)) {
    await page.waitForTimeout(600);
    await shot('mj-settle');
  }
  await leaveTable();
}

if (only.includes('hongshi')) {
  console.log('▶ hongshi');
  await page.locator('.gcard.hongshi').click();
  await page.waitForTimeout(600);
  await page.locator('.stage').first().click();
  await page.waitForURL('**/#/game/hongshi**', { timeout: 10000 });
  await waitFor('.my-hand .hcard', 20000);
  await page.waitForTimeout(1200);
  await shot('hs-deal');
  if (await waitFor('.hs-actions', 60000)) {
    await shot('hs-turn');
    await page.locator('.hs-actions button').nth(1).click(); // 提示
    await page.waitForTimeout(700);
    await shot('hs-hint');
    const sel = page.locator('.my-hand .hcard.selected, .my-hand .hcard.on');
    if ((await sel.count()) === 0) await page.locator('.my-hand .hcard').first().click();
    await page.waitForTimeout(300);
    await page.locator('.hs-actions button').nth(2).click(); // 出牌
    await page.waitForTimeout(900);
    await shot('hs-played');
  }
  if (await waitFor('.trustee-bar', 40000)) await shot('hs-trustee');
  if (await waitFor('.settle', 240000)) {
    await page.waitForTimeout(600);
    await shot('hs-settle');
  }
  await leaveTable();
}

if (only.includes('fishing')) {
  console.log('▶ fishing');
  await page.locator('.gcard.fishing').click();
  await page.waitForTimeout(600);
  await shot('fs-stages');
  await page.locator('.stage').first().click();
  await page.waitForURL('**/#/game/fishing**', { timeout: 10000 });
  await page.waitForTimeout(4500);
  await shot('fs-idle');
  await page.mouse.click(P.w * 0.55, P.h * 0.35);
  await page.waitForTimeout(500);
  await page.mouse.click(P.w * 0.45, P.h * 0.3);
  await page.waitForTimeout(700);
  await shot('fs-fire');
  await page.locator('.skills .skill').first().click().catch(() => undefined);
  await page.waitForTimeout(900);
  await shot('fs-skill');
  await page.locator('.auto').first().click().catch(() => undefined);
  await page.waitForTimeout(4000);
  await shot('fs-auto');
  await page.locator('.auto').first().click().catch(() => undefined);
  await leaveTable();
}

if (only.includes('slot')) {
  console.log('▶ slot');
  await page.locator('.gcard.slot_fruit').click();
  await page.waitForURL('**/#/game/slot**', { timeout: 10000 });
  await page.waitForTimeout(2500);
  await shot('slot-idle');
  await page.locator('button.spin').click();
  await page.waitForTimeout(1500);
  await shot('slot-spinning');
  await page.waitForTimeout(4500);
  await shot('slot-result');
  await leaveTable();
}

if (only.includes('roulette')) {
  console.log('▶ roulette');
  await page.goto(`${BASE}/#/game/roulette`);
  await page.waitForURL('**/#/game/roulette**', { timeout: 10000 });
  await page.waitForTimeout(3000);
  await shot('rl-idle');
  await page.locator('.chips .chip').nth(1).click().catch(() => undefined);
  await page.locator('.table .cell.red').first().click().catch(() => undefined);
  await page.locator('.table .cell', { hasText: '17' }).first().click().catch(() => undefined);
  await page.waitForTimeout(400);
  await shot('rl-staged');
  await page.locator('.confirm').click().catch(() => undefined);
  await page.waitForTimeout(1200);
  await shot('rl-bet');
  if (await waitFor('.result-panel', 60000)) {
    await page.waitForTimeout(800);
    await shot('rl-result');
  }
  await leaveTable();
}

if (only.includes('stock')) {
  console.log('▶ stock');
  await page.goto(`${BASE}/#/game/stock`);
  await page.waitForURL('**/#/game/stock**', { timeout: 10000 });
  await page.waitForTimeout(3500);
  await shot('st-idle');
  await page.locator('.chips .chip').nth(2).click().catch(() => undefined);
  await page.locator('.big.up').click().catch(() => undefined);
  await page.waitForTimeout(1000);
  await shot('st-bet');
  if (await waitFor('.result-panel', 45000)) {
    await page.waitForTimeout(800);
    await shot('st-result');
  }
  await leaveTable();
}

await browser.close();
console.log(`\n${tag}: ${errors.length} page/console errors`);
for (const e of [...new Set(errors)].slice(0, 30)) console.log('  !', e);
