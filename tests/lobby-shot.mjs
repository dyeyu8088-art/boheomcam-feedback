/**
 * 大厅截图回归（v4 四游戏大厅）：桌面 16:9 / 手机横屏 / 手机竖屏 × 中韩。
 * 用法：LOCALES=zh,ko SIZES=pc-1920,pc-1280,phone-land,phone-portrait node tests/lobby-shot.mjs
 * 竖屏额外截一张打开右侧抽屉的图；同时收集 pageerror / console.error。
 */
import { chromium } from 'playwright';

const SHOT_DIR = process.env.SHOT_DIR ?? '/tmp/shots';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const PRESET = {
  'pc-1920': { w: 1920, h: 1080, dsf: 1 },
  'pc-1280': { w: 1280, h: 720, dsf: 1 },
  'phone-land': { w: 844, h: 390, dsf: 2, mobile: true },
  'phone-land-sm': { w: 800, h: 360, dsf: 2, mobile: true },
  'phone-portrait': { w: 390, h: 844, dsf: 2, mobile: true },
};
const sizes = (process.env.SIZES ?? 'pc-1920,pc-1280,phone-land,phone-portrait').split(',');
const locales = (process.env.LOCALES ?? 'zh').split(',');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const errors = [];
for (const locale of locales) {
  for (const name of sizes) {
    const s = PRESET[name];
    if (!s) continue;
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dsf, isMobile: !!s.mobile, hasTouch: !!s.mobile });
    const page = await ctx.newPage();
    await page.addInitScript((l) => localStorage.setItem('locale', l), locale);
    page.on('pageerror', (e) => errors.push(`[${locale}/${name}] ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`[${locale}/${name}] console: ${m.text()}`));
    page.on('response', (r) => r.status() >= 400 && errors.push(`[${locale}/${name}] HTTP ${r.status()} ${r.url()}`));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    if (page.url().includes('/login')) {
      await page.locator('.login-guest, button:has-text("游客快速开始"), button:has-text("게스트")').first().click();
      await page.waitForURL('**/#/lobby', { timeout: 12000 });
    }
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${SHOT_DIR}/lobby-${locale}-${name}.png` });
    console.log(`shot: lobby-${locale}-${name}.png`);
    if (name === 'phone-portrait') {
      await page.locator('.menu-btn').click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOT_DIR}/lobby-${locale}-${name}-drawer.png` });
      console.log(`shot: lobby-${locale}-${name}-drawer.png`);
    }
    // 弹层：更多 / 客服 / 设置（POPUPS=1）
    if (process.env.POPUPS && !s.mobile) {
      for (const [key, sel] of [['more', '.side .feat.more'], ['settings', '.tb-gear'], ['support', '.side .feat:nth-child(5)']]) {
        await page.locator(sel).click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${SHOT_DIR}/lobby-${locale}-${name}-${key}.png` });
        console.log(`shot: lobby-${locale}-${name}-${key}.png`);
        await page.keyboard.press('Escape');
        await page.locator('.gp-close, .ms-close, button.x').first().click({ timeout: 1500 }).catch(() => undefined);
        await page.waitForTimeout(300);
      }
    }
    // 横向溢出检查
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) errors.push(`[${locale}/${name}] 页面出现横向溢出`);
    await ctx.close();
  }
}
await browser.close();
if (errors.length) {
  console.error('ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('no page errors / no horizontal overflow');
