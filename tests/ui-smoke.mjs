/**
 * 客户端 UI 冒烟（Playwright + Chromium）：
 * 登录页 → 游客登录 → 大厅 → 水果机 Spin → 返回大厅 → 麻将匹配进桌。
 * 前置：api(:8080)、game(:8090)、vite(:5173) 均已运行。
 */
import { chromium } from 'playwright';

const SHOT_DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173'; // BASE_URL=http://<内测主机> 可对网关跑

let passed = 0;
let failed = 0;
const ok = (cond, name) => {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('  [pageerror]', e.message));

try {
  // 登录页
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  ok(await page.locator('text=YANBIAN GAME').first().isVisible(), '登录页品牌呈现');
  await page.screenshot({ path: `${SHOT_DIR}/01-login.png` });

  // 游客登录 → 大厅
  await page.locator('button:has-text("游客快速开始")').click();
  await page.waitForURL('**/#/lobby', { timeout: 10000 });
  await page.waitForTimeout(1200);
  ok((await page.locator('.gcard').count()) === 4, '大厅四游戏卡片（麻将 / 红十 / 捕鱼 / 水果机）');
  ok((await page.locator('.gn-item').count()) === 5 && (await page.locator('.side .feat').count()) === 5, '底部 5 导航 + 右侧 4 快捷 + 更多');
  ok(await page.locator('.pp-name').first().isVisible(), '顶栏用户信息');
  await page.screenshot({ path: `${SHOT_DIR}/02-lobby.png` });

  // 水果机
  await page.locator('.gcard.slot_fruit').click();
  await page.waitForURL('**/#/game/slot', { timeout: 8000 });
  await page.waitForTimeout(1500);
  ok(await page.locator('button.spin').isVisible(), '水果机界面加载');
  await page.screenshot({ path: `${SHOT_DIR}/03-slot.png` });
  const balBefore = await page.locator('.hud-top .hcoins').textContent();
  await page.locator('button.spin').click();
  // 等待服务端结果 + 停轮动画完成（余额或"赢得"数字任一变化即算收到结果）
  let resultSeen = false;
  for (let i = 0; i < 24; i += 1) {
    await page.waitForTimeout(400);
    const balNow = await page.locator('.hud-top .hcoins').textContent();
    const winNow = await page.locator('.win-num').textContent();
    if (balNow?.trim() !== balBefore?.trim() || (winNow && winNow.trim() !== '0' && winNow.trim() !== '')) {
      resultSeen = true;
      break;
    }
  }
  ok(resultSeen, 'Spin 收到服务端结果并结算');
  await page.screenshot({ path: `${SHOT_DIR}/04-slot-spin.png` });
  await page.locator('.hud-top .hback').click();
  await page.waitForURL('**/#/lobby', { timeout: 8000 });

  // 轮盘（共享回合：进桌即有当前回合与投注台）
  // 轮盘不在大厅卡片中（路由保留），直接进入
  await page.goto(`${BASE}/#/game/roulette`, { waitUntil: 'networkidle' });
  await page.waitForURL('**/#/game/roulette', { timeout: 8000 });
  await page.waitForTimeout(2500);
  ok((await page.locator('.table .cell').count()) >= 49 && (await page.locator('.phase').isVisible()), '轮盘投注台与回合阶段加载');
  await page.screenshot({ path: `${SHOT_DIR}/04b-roulette.png` });
  await page.locator('.hud-top .hback').click();
  await page.waitForURL('**/#/lobby', { timeout: 8000 });
  await page.waitForTimeout(600);

  // 股票涨跌（服务端模拟行情：进场即有三品种走势与回合）
  // 股票不在大厅卡片中（路由保留），直接进入
  await page.goto(`${BASE}/#/game/stock`, { waitUntil: 'networkidle' });
  await page.waitForURL('**/#/game/stock', { timeout: 8000 });
  await page.waitForTimeout(3000);
  ok((await page.locator('.inst').count()) === 3 && (await page.locator('.chart').isVisible()), '股票涨跌三品种与走势图加载');
  await page.screenshot({ path: `${SHOT_DIR}/04c-stock.png` });
  await page.locator('.hud-top .hback').click();
  await page.waitForURL('**/#/lobby', { timeout: 8000 });
  await page.waitForTimeout(600);

  // 签到（活动页：右侧功能栏第一项「活动」）
  await page.locator('.side .feat').first().click();
  await page.waitForTimeout(800);
  ok(await page.locator('text=每日签到').isVisible(), '活动页签到面板');
  await page.screenshot({ path: `${SHOT_DIR}/05-activity.png` });
  await page.locator('.gn-item:nth-child(1)').click();
  await page.waitForTimeout(400);

  // 麻将匹配（机器人补位后应进桌）
  await page.locator('.gcard.mahjong_yanbian').click();
  await page.waitForTimeout(600);
  await page.locator('.stage').first().click();
  await page.waitForURL('**/#/game/mahjong**', { timeout: 8000 });
  await page.waitForTimeout(8000); // 等待机器人补位 + 开局发牌
  const tiles = await page.locator('.my-hand .tile').count();
  ok(tiles >= 13, `麻将开局收到手牌 (${tiles} 张)`);
  await page.screenshot({ path: `${SHOT_DIR}/06-mahjong.png` });

  // 捕鱼
  await page.goto(`${BASE}/#/lobby`);
  await page.waitForTimeout(800);
  await page.locator('.gcard.fishing').click();
  await page.waitForTimeout(500);
  await page.locator('.stage').first().click();
  await page.waitForURL('**/#/game/fishing**', { timeout: 8000 });
  await page.waitForTimeout(3500);
  ok(await page.locator('.mult').isVisible(), '捕鱼 HUD 加载');
  await page.mouse.click(640, 300);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOT_DIR}/07-fishing.png` });
} catch (e) {
  failed += 1;
  console.error('  ✗ 异常:', e.message);
  await page.screenshot({ path: `${SHOT_DIR}/99-error.png` }).catch(() => {});
}

await browser.close();
console.log(`\nUI 冒烟: ${passed} 通过 / ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
