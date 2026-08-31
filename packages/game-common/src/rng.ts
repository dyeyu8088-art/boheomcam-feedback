/**
 * 安全随机数工具（同构：Node 与浏览器均使用 WebCrypto getRandomValues）。
 * 服务端关键游戏随机（洗牌/停轮/命中判定）一律使用本模块，禁止 Math.random()。
 * 通过注入接口便于测试时使用确定性序列复现牌局。
 */

export interface Rng {
  /** [0, maxExclusive) 均匀整数 */
  int(maxExclusive: number): number;
}

const cryptoObj = globalThis.crypto;

/** 拒绝采样保证均匀分布 */
function uniformInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error(`rng.int: invalid bound ${maxExclusive}`);
  }
  if (maxExclusive === 1) return 0;
  const range = 0x1_0000_0000; // 2^32
  const limit = range - (range % maxExclusive);
  const buf = new Uint32Array(1);
  for (;;) {
    cryptoObj.getRandomValues(buf);
    const v = buf[0]!;
    if (v < limit) return v % maxExclusive;
  }
}

export const secureRng: Rng = {
  int: uniformInt,
};

/** 测试用：从给定序列产生（耗尽后回绕） */
export function seqRng(values: number[]): Rng {
  let i = 0;
  return {
    int(maxExclusive: number): number {
      const v = values[i % values.length]!;
      i += 1;
      return ((v % maxExclusive) + maxExclusive) % maxExclusive;
    },
  };
}

/** Fisher–Yates 原地洗牌 */
export function shuffle<T>(arr: T[], rng: Rng = secureRng): T[] {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/** 概率判定：p ∈ [0,1]，用 1e9 分辨率整数抽样避免浮点偏差 */
export function chance(p: number, rng: Rng = secureRng): boolean {
  if (p <= 0) return false;
  if (p >= 1) return true;
  const RES = 1_000_000_000;
  return rng.int(RES) < Math.round(p * RES);
}

export function hexToken(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  cryptoObj.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}
