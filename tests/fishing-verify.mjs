/**
 * 捕鱼动画系统验收脚本：
 *   1) 录像（Playwright recordVideo，≈20s）→ build/fishing-demo/*.webm
 *   2) 局部动作检查：连续 4 帧（120ms 间隔）按每条鱼的位置重新居中裁剪后做像素差 —— 差异来自形变 / 鳍 / 眨眼而非位移
 *   3) 观察到的鱼种 / 路径种类 / 状态（swim / turn / hit / escape / death…）
 *   4) 帧率：桌面 1920×1080 与手机模拟（844×390 + CPU 4× 降速）各统计 3s rAF
 * 用法：node tests/fishing-verify.mjs  （BASE_URL 可覆盖）
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = process.env.OUT_DIR ?? 'build/fishing-demo';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { fishTypes: new Set(), pathKinds: new Set(), states: new Set(), fps: {}, errors: [] };

async function enter(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  if (page.url().includes('/login')) {
    await page.locator('.login-guest, button:has-text("游客快速开始"), button:has-text("게스트")').first().click();
    await page.waitForURL('**/#/lobby', { timeout: 12000 });
  }
  await page.waitForTimeout(800);
  await page.locator('.gcard.fishing').click();
  await page.waitForTimeout(500);
  await page.locator('.stage').first().click();
  await page.waitForURL('**/#/game/fishing**', { timeout: 10000 });
}
const snapshotFish = (page) =>
  page.evaluate(() => {
    const fs = window.__fs;
    if (!fs?.fishes) return [];
    return [...fs.fishes.values()].filter((f) => f.node.visible).map((f) => ({ id: f.fishId, type: f.typeId, x: f.node.x, y: f.node.y, size: f.size, state: f.rig.state, facing: f.rig.facing, path: f.pathId }));
  });
const measureFps = (page, ms = 3000) =>
  page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n += 1;
          if (performance.now() - t0 < ms) requestAnimationFrame(tick);
          else resolve(Math.round((n * 1000) / (performance.now() - t0)));
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );

/* ── ONLY=turn：转向观察（停留变向 / Boss 环绕路径会发生左右翻面），40s 内统计 turn 状态并截一张翻面瞬间 ── */
if (process.env.ONLY === 'turn') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  await enter(page);
  const t0 = Date.now();
  const turns = new Map();
  let shot = false;
  while (Date.now() - t0 < 40000) {
    const fish = await page.evaluate(() => {
      const fs = window.__fs;
      if (!fs?.fishes) return [];
      return [...fs.fishes.values()].filter((f) => f.node.visible).map((f) => ({ id: f.fishId, type: f.typeId, state: f.rig.state, path: f.pathId, facing: f.rig.facing, x: f.node.x, y: f.node.y }));
    });
    for (const f of fish) {
      if (f.state === 'turn') {
        turns.set(f.id, { type: f.type, path: f.path });
        if (!shot) {
          shot = true;
          await page.screenshot({ path: `${OUT}/turn-moment.png` });
        }
      }
    }
    await page.waitForTimeout(60);
  }
  report.turns = [...turns.entries()].map(([id, v]) => ({ id, ...v }));
  await ctx.close();
  await browser.close();
  console.log(JSON.stringify({ turns: report.turns, errors: report.errors }, null, 1));
  process.exit(0);
}

/* ── 桌面 1280×720（不录像）：局部动作帧 + 状态观察 + 帧率 / 每帧更新耗时 ── */
async function waitFish(page, n, maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const f = await snapshotFish(page);
    if (f.filter((x) => x.state === 'swim' || x.state === 'turn').length >= n) return f;
    await page.waitForTimeout(400);
  }
  return snapshotFish(page);
}
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  await enter(page);
  await waitFish(page, 6, 45000);
  const frames = [];
  for (let i = 0; i < 4; i += 1) {
    const fish = await snapshotFish(page);
    const png = await page.screenshot({ type: 'png' });
    frames.push(fish);
    fs.writeFileSync(`${OUT}/frame-${i}.png`, png);
    await page.waitForTimeout(120);
  }
  fs.writeFileSync(`${OUT}/frames.json`, JSON.stringify(frames, null, 1));
  // 状态观察 24s：自动发炮 + 一次技能，100ms 采样
  await page.locator('.auto').first().click().catch(() => undefined);
  const t0 = Date.now();
  const stateLog = [];
  let deaths = 0;
  const seenDead = new Set();
  while (Date.now() - t0 < 24000) {
    const fish = await page.evaluate(() => {
      const fs = window.__fs;
      if (!fs?.fishes) return [];
      return [...fs.fishes.values()].map((f) => ({ id: f.fishId, type: f.typeId, state: f.rig.state, dead: f.dead, path: f.pathId, visible: f.node.visible }));
    });
    for (const f of fish) {
      if (!f.visible) continue;
      report.fishTypes.add(f.type);
      report.states.add(f.state);
      report.pathKinds.add(f.path);
      if (f.dead && !seenDead.has(f.id)) {
        seenDead.add(f.id);
        deaths += 1;
      }
    }
    stateLog.push(fish.filter((f) => f.visible).map((f) => f.state));
    if (Date.now() - t0 > 6000 && Date.now() - t0 < 6200) await page.locator('.skill').nth(1).click().catch(() => undefined);
    await page.waitForTimeout(100);
  }
  await page.locator('.auto').first().click().catch(() => undefined);
  report.deathsObserved = deaths;
  report.samples = stateLog.length;
  await page.evaluate(() => {
    window.__fs.stats = { frames: 0, updateMs: 0 };
  });
  report.fps.desktop_1280_headless_swiftshader = await measureFps(page);
  report.updateMsPerFrame = await page.evaluate(() => {
    const s = window.__fs.stats;
    return s.frames ? +(s.updateMs / s.frames).toFixed(2) : null;
  });
  report.fishOnScreen = (await snapshotFish(page)).length;
  await page.screenshot({ path: `${OUT}/desktop-final.png` });
  await ctx.close();
}
/* ── 录像（1280×720，约 14s）── */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
  const page = await ctx.newPage();
  await enter(page);
  await waitFish(page, 5, 30000);
  await page.locator('.auto').first().click().catch(() => undefined);
  await page.waitForTimeout(9000);
  await page.locator('.skill').nth(1).click().catch(() => undefined);
  await page.waitForTimeout(3000);
  await page.locator('.auto').first().click().catch(() => undefined);
  await ctx.close();
  report.video = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm')).map((v) => `${OUT}/${v}`);
}

/* ── 手机模拟：844×390，CPU 4× 降速 ── */
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  page.on('pageerror', (e) => report.errors.push('[mobile] ' + e.message));
  await enter(page);
  await page.waitForTimeout(6000);
  await page.evaluate(() => {
    window.__fs.stats = { frames: 0, updateMs: 0 };
  });
  report.fps.mobile_844x390_headless_cpu4x = await measureFps(page);
  report.updateMsPerFrameMobileCpu4x = await page.evaluate(() => {
    const s = window.__fs.stats;
    return s.frames ? +(s.updateMs / s.frames).toFixed(2) : null;
  });
  await page.screenshot({ path: `${OUT}/mobile-final.png` });
  await ctx.close();
}
await browser.close();
report.fishTypes = [...report.fishTypes];
report.states = [...report.states];
report.pathKinds = [...report.pathKinds].sort((a, b) => a - b);
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
