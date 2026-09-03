#!/usr/bin/env node
/**
 * 扫描 apps/client-game/public/assets/** 生成统一资源清单：
 *   apps/client-game/public/assets-manifest.json   运行时读取（按游戏分组，key → URL）
 *   apps/client-game/src/assets/manifest.gen.ts     编译期类型（key 联合类型 + 预加载分组）
 * 命名规则：key = 文件名去扩展名转 camelCase（btn_spin → btnSpin），分组 = 顶层目录（common/lobby/fishing/…）。
 * 同组内 key 冲突会直接报错，杜绝「同名不同图」。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ASSETS = path.join(root, 'apps/client-game/public/assets');
const OUT_JSON = path.join(root, 'apps/client-game/public/assets-manifest.json');
const OUT_TS = path.join(root, 'apps/client-game/src/assets/manifest.gen.ts');
const EXT = new Set(['.png', '.webp', '.jpg', '.jpeg', '.svg', '.mp3', '.ogg']);

const camel = (s) => s.replace(/[-_ .]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase()).replace(/^[A-Z]/, (c) => c.toLowerCase());

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (EXT.has(path.extname(e.name).toLowerCase())) acc.push(p);
  }
  return acc;
}

const files = walk(ASSETS).sort();
const manifest = {};
const meta = {};
for (const f of files) {
  const rel = path.relative(ASSETS, f).split(path.sep).join('/');
  const [group, ...rest] = rel.split('/');
  const base = path.basename(rel, path.extname(rel));
  // 麻将牌面/扑克牌是成套素材，按原始文件名（Man1 / 10H）保留，不转 camelCase
  const key = group === 'mahjong' && rest[0] === 'tiles' ? `tile${base}` : group === 'red10' && rest[0] === 'cards' ? `card${base}` : camel(base);
  manifest[group] ??= {};
  if (manifest[group][key]) throw new Error(`duplicate asset key ${group}.${key}: ${manifest[group][key]} vs /assets/${rel}`);
  manifest[group][key] = `/assets/${rel}`;
  (meta[group] ??= []).push({ key, size: fs.statSync(f).size, sub: rest.slice(0, -1).join('/') });
}

fs.writeFileSync(OUT_JSON, JSON.stringify(manifest, null, 1) + '\n');

let ts = `// 由 tools/assets/build-manifest.mjs 自动生成 —— 请勿手改。\n// 重新生成：node tools/assets/build-manifest.mjs\n\n`;
ts += `export const ASSET_MANIFEST = ${JSON.stringify(manifest, null, 1)} as const;\n\n`;
ts += `export type AssetGroup = keyof typeof ASSET_MANIFEST;\n`;
ts += `export type AssetKey<G extends AssetGroup> = keyof (typeof ASSET_MANIFEST)[G];\n`;
ts += `/** 每组资源的字节数（用于加载进度权重） */\n`;
ts += `export const ASSET_SIZES: Record<string, number> = ${JSON.stringify(Object.fromEntries(Object.entries(meta).flatMap(([g, arr]) => arr.map((m) => [`${g}.${m.key}`, m.size]))), null, 0)};\n`;
fs.mkdirSync(path.dirname(OUT_TS), { recursive: true });
fs.writeFileSync(OUT_TS, ts);

const total = files.reduce((s, f) => s + fs.statSync(f).size, 0);
console.log(`manifest: ${files.length} files, ${(total / 1024 / 1024).toFixed(2)} MB → ${path.relative(root, OUT_JSON)}, ${path.relative(root, OUT_TS)}`);
for (const [g, arr] of Object.entries(meta)) console.log(`  ${g.padEnd(12)} ${String(arr.length).padStart(4)} files ${(arr.reduce((s, m) => s + m.size, 0) / 1024).toFixed(0).padStart(6)} KB`);
