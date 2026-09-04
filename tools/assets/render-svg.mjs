#!/usr/bin/env node
/**
 * 用 Chromium 把 SVG 光栅化为透明 PNG（原创符号 / 徽记的出图工具）。
 * 用法：node tools/assets/render-svg.mjs <in.svg>=<out.png> [...] [--size 256]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const sizeIdx = args.indexOf('--size');
const size = sizeIdx >= 0 ? Number(args[sizeIdx + 1]) : 256;
const pairs = args.filter((a) => a.includes('=') && !a.startsWith('--')).map((a) => a.split('='));
if (!pairs.length) {
  console.error('usage: render-svg.mjs in.svg=out.png [...] [--size 256]');
  process.exit(1);
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
for (const [src, out] of pairs) {
  const svg = fs.readFileSync(src, 'utf8');
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent"><img id="i" style="display:block;width:${size}px;height:${size}px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`,
  );
  await page.waitForFunction(() => document.getElementById('i').complete);
  await page.waitForTimeout(80);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`rendered ${src} → ${out}`);
}
await browser.close();
