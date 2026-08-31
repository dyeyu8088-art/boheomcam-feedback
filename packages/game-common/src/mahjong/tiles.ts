/**
 * 麻将牌编码。
 * kind ∈ [0,33]：0–8 万1-9 ｜ 9–17 条1-9 ｜ 18–26 筒1-9 ｜ 27–30 东南西北 ｜ 31–33 中发白
 * 物理牌 tile = kind * 4 + copy(0..3)，保证每张牌唯一（回放/追踪用）。
 */

export type TileKind = number; // 0..33
export type Tile = number; // kind*4+copy

export const SUIT_WAN = 0;
export const SUIT_TIAO = 1;
export const SUIT_TONG = 2;
export const SUIT_HONOR = 3;

export const kindOf = (tile: Tile): TileKind => Math.floor(tile / 4);
export const suitOfKind = (kind: TileKind): number => (kind < 27 ? Math.floor(kind / 9) : SUIT_HONOR);
export const rankOfKind = (kind: TileKind): number => (kind < 27 ? (kind % 9) + 1 : kind - 26); // 字牌 1..7
export const isHonorKind = (kind: TileKind): boolean => kind >= 27;
export const isWindKind = (kind: TileKind): boolean => kind >= 27 && kind <= 30;
export const isDragonKind = (kind: TileKind): boolean => kind >= 31;
/** 幺九：1/9 序数牌与全部字牌 */
export const isTerminalOrHonor = (kind: TileKind): boolean =>
  isHonorKind(kind) || rankOfKind(kind) === 1 || rankOfKind(kind) === 9;

const WAN_NAMES = ['一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万'];
const TIAO_NAMES = ['一条', '二条', '三条', '四条', '五条', '六条', '七条', '八条', '九条'];
const TONG_NAMES = ['一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒'];
const HONOR_NAMES = ['东', '南', '西', '北', '中', '发', '白'];

export function kindName(kind: TileKind): string {
  if (kind < 9) return WAN_NAMES[kind]!;
  if (kind < 18) return TIAO_NAMES[kind - 9]!;
  if (kind < 27) return TONG_NAMES[kind - 18]!;
  return HONOR_NAMES[kind - 27]!;
}

export interface TileSetOptions {
  useWan: boolean;
  useTiao: boolean;
  useTong: boolean;
  useWinds: boolean;
  useDragons: boolean;
}

/** 按规则配置生成整副物理牌（未洗） */
export function buildTiles(opts: TileSetOptions): Tile[] {
  const kinds: TileKind[] = [];
  if (opts.useWan) for (let k = 0; k < 9; k += 1) kinds.push(k);
  if (opts.useTiao) for (let k = 9; k < 18; k += 1) kinds.push(k);
  if (opts.useTong) for (let k = 18; k < 27; k += 1) kinds.push(k);
  if (opts.useWinds) for (let k = 27; k < 31; k += 1) kinds.push(k);
  if (opts.useDragons) for (let k = 31; k < 34; k += 1) kinds.push(k);
  const tiles: Tile[] = [];
  for (const k of kinds) for (let c = 0; c < 4; c += 1) tiles.push(k * 4 + c);
  return tiles;
}

/** kind 计数数组（长度34） */
export function countByKind(tiles: Tile[]): Int8Array {
  const counts = new Int8Array(34);
  for (const t of tiles) counts[kindOf(t)] += 1;
  return counts;
}
