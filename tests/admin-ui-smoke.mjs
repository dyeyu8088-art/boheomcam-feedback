/**
 * 管理后台 UI 冒烟：登录 → 首登强制改密 → Dashboard → 用户管理 → 审计日志。
 * 用法：ADMIN_PASSWORD=xxx node tests/admin-ui-smoke.mjs（首次跑会将密码改为 NEW_PASSWORD）
 */
import { chromium } from 'playwright';

const SHOT_DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const BASE = 'http://localhost:5174';
const OLD = process.env.ADMIN_PASSWORD ?? '';
const NEW = process.env.NEW_PASSWORD ?? 'YanbianAdmin2026x';

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
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });

try {
  await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' });
  ok(await page.locator('text=运营管理后台').first().isVisible(), '登录页加载');
  await page.locator('input[placeholder="用户名"]').fill('admin');
  await page.locator('input[placeholder="密码"]').fill(OLD);
  await page.locator('button:has-text("登 录")').click();
  await page.waitForTimeout(1500);

  // 首登强制改密对话框
  if (await page.locator('text=首次登录必须修改密码').isVisible().catch(() => false)) {
    ok(true, '首登强制改密弹出');
    await page.locator('.el-dialog input[type="password"]').nth(0).fill(OLD);
    await page.locator('.el-dialog input[type="password"]').nth(1).fill(NEW);
    await page.locator('button:has-text("确认修改")').click();
    await page.waitForTimeout(1200);
  }
  await page.waitForURL('**/#/dashboard', { timeout: 8000 });
  await page.waitForTimeout(1500);
  ok(await page.locator('text=注册用户').isVisible(), 'Dashboard 统计卡');
  ok(await page.locator('text=各游戏实时在线').isVisible(), 'Dashboard 图表');
  await page.screenshot({ path: `${SHOT_DIR}/10-admin-dashboard.png` });

  await page.locator('.el-menu-item:has-text("用户管理")').click();
  await page.waitForTimeout(1200);
  const rows = await page.locator('.el-table__row').count();
  ok(rows > 0, `用户列表 ${rows} 行`);
  await page.locator('.el-table__row').first().click();
  await page.waitForTimeout(1000);
  ok(await page.locator('text=登录记录').isVisible(), '用户详情抽屉');
  await page.screenshot({ path: `${SHOT_DIR}/11-admin-users.png` });
  await page.keyboard.press('Escape');

  await page.locator('.el-menu-item:has-text("金币流水")').click();
  await page.waitForTimeout(1200);
  ok((await page.locator('.el-table__row').count()) > 0, '交易流水列表');
  await page.screenshot({ path: `${SHOT_DIR}/12-admin-wallet.png` });

  await page.locator('.el-menu-item:has-text("操作日志")').click();
  await page.waitForTimeout(1200);
  ok(await page.locator('text=审计日志与账本').isVisible(), '审计页加载');

  // 街机 / 奖池：水果机四档奖池 + 轮盘 / 股票回合
  await page.locator('.el-menu-item:has-text("街机")').click();
  await page.waitForTimeout(1500);
  ok((await page.locator('.el-table__row').count()) >= 4, '街机页：Jackpot 四档奖池');
  await page.locator('.el-tabs__item:has-text("轮盘回合")').click();
  await page.waitForTimeout(1500);
  ok((await page.locator('.el-table__row').count()) > 0, '街机页：轮盘回合列表');
  await page.screenshot({ path: `${SHOT_DIR}/13-admin-arcade.png` });
} catch (e) {
  failed += 1;
  console.error('  ✗ 异常:', e.message);
  await page.screenshot({ path: `${SHOT_DIR}/99-admin-error.png` }).catch(() => {});
}

await browser.close();
console.log(`\n后台 UI 冒烟: ${passed} 通过 / ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
