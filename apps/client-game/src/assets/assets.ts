/**
 * 统一资源管理器（用户要求 §三 / §十七）
 * - 所有 UI / Pixi 素材通过 `asset(group, key)` 读取，禁止散落硬编码路径。
 * - `preload(group)` 按组预加载（浏览器 Image 解码 + Pixi Assets 纹理缓存）。
 * - `release(group)` 在离开游戏时释放该组 Pixi 纹理，避免六游戏纹理常驻内存。
 * key 与 URL 由 `tools/assets/build-manifest.mjs` 从 public/assets 目录自动生成到 manifest.gen.ts。
 */
import { Assets, Texture } from 'pixi.js';
import { ASSET_MANIFEST, ASSET_SIZES, type AssetGroup, type AssetKey } from './manifest.gen.js';

export type { AssetGroup, AssetKey };

/** 取素材 URL（类型安全：group / key 拼错会在编译期报错） */
export function asset<G extends AssetGroup>(group: G, key: AssetKey<G>): string {
  return (ASSET_MANIFEST[group] as Record<string, string>)[key as string]!;
}

/** 按 "group.key" 字符串取 URL（服务器下发的图标引用，如商品 / 道具 icon），未登记返回空串 */
export function assetByKey(ref: string | null | undefined): string {
  if (!ref) return '';
  const dot = ref.indexOf('.');
  if (dot < 0) return '';
  const group = ref.slice(0, dot) as AssetGroup;
  const key = ref.slice(dot + 1);
  return ((ASSET_MANIFEST as Record<string, Record<string, string>>)[group] ?? {})[key] ?? '';
}

/** 组内全部 URL */
export function assetGroup<G extends AssetGroup>(group: G): Record<string, string> {
  return ASSET_MANIFEST[group] as Record<string, string>;
}

const decoded = new Set<string>();
const inflight = new Map<string, Promise<void>>();

/** 浏览器层预解码（DOM/CSS 使用的图片）。同一 URL 只加载一次。 */
export function warmImage(url: string): Promise<void> {
  if (decoded.has(url)) return Promise.resolve();
  const cur = inflight.get(url);
  if (cur) return cur;
  const p = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      decoded.add(url);
      inflight.delete(url);
      resolve();
    };
    img.onerror = () => {
      inflight.delete(url);
      resolve(); // 404 不阻塞界面；在 DEV 控制台报错方便排查
      if (import.meta.env.DEV) console.error(`[assets] 资源加载失败: ${url}`);
    };
    img.src = url;
  });
  inflight.set(url, p);
  return p;
}

export interface PreloadProgress {
  loaded: number;
  total: number;
  bytesLoaded: number;
  bytesTotal: number;
}

/**
 * 预加载若干组（DOM 图片解码）。`onProgress` 以字节为权重，供 LoadingScreen 显示。
 * 只解码，不建 Pixi 纹理；Pixi 纹理由 `pixiTextures()` 按需建立。
 */
export async function preload(groups: AssetGroup[], onProgress?: (p: PreloadProgress) => void): Promise<void> {
  const urls: { url: string; bytes: number }[] = [];
  for (const g of groups) {
    for (const [k, url] of Object.entries(ASSET_MANIFEST[g] as Record<string, string>)) {
      urls.push({ url, bytes: ASSET_SIZES[`${g}.${k}`] ?? 0 });
    }
  }
  const bytesTotal = urls.reduce((s, u) => s + u.bytes, 0);
  let loaded = 0;
  let bytesLoaded = 0;
  onProgress?.({ loaded, total: urls.length, bytesLoaded, bytesTotal });
  // 并发 8 个，避免几十个大图同时解码卡主线程
  const queue = [...urls];
  const worker = async (): Promise<void> => {
    while (queue.length) {
      const u = queue.shift()!;
      await warmImage(u.url);
      loaded += 1;
      bytesLoaded += u.bytes;
      onProgress?.({ loaded, total: urls.length, bytesLoaded, bytesTotal });
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, queue.length) }, worker));
}

const pixiLoaded = new Map<AssetGroup, Set<string>>();

/**
 * 为 Pixi 场景加载一组素材为纹理（走 Pixi Assets 缓存）。返回 key → Texture。
 * 同组重复调用直接返回缓存；`release(group)` 后可再次加载。
 */
export async function pixiTextures<G extends AssetGroup>(group: G, keys?: AssetKey<G>[]): Promise<Record<string, Texture>> {
  const all = ASSET_MANIFEST[group] as Record<string, string>;
  const list = (keys ?? (Object.keys(all) as AssetKey<G>[])) as string[];
  const out: Record<string, Texture> = {};
  const set = pixiLoaded.get(group) ?? new Set<string>();
  pixiLoaded.set(group, set);
  await Promise.all(
    list.map(async (k) => {
      const url = all[k]!;
      const tex = (await Assets.load<Texture>({ alias: `${group}.${k}`, src: url })) as Texture;
      out[k] = tex;
      set.add(`${group}.${k}`);
    }),
  );
  return out;
}

/** 离开游戏页面时释放该组的 Pixi 纹理（GPU 内存），DOM 解码缓存由浏览器自行管理 */
export async function release(group: AssetGroup): Promise<void> {
  const set = pixiLoaded.get(group);
  if (!set) return;
  await Assets.unload([...set]);
  pixiLoaded.delete(group);
}

/** 各游戏进入前需要预加载的资源组（大厅只需 common + lobby） */
export const GAME_PRELOAD: Record<string, AssetGroup[]> = {
  lobby: ['common', 'lobby'],
  fishing: ['common', 'fishing'],
  slot_fruit: ['common', 'slots'],
  roulette: ['common', 'roulette'],
  stock_updown: ['common', 'stock_game'],
  mahjong_yanbian: ['common', 'mahjong'],
  hongshi: ['common', 'red10'],
};
