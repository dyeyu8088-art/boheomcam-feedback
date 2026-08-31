/**
 * 鱼群路径库 —— 三端共享（服务端判定合理性 / 客户端插值渲染）。
 * 归一化坐标系：x ∈ [-0.15, 1.15]，y ∈ [-0.15, 1.15]（越界段为出入场）。
 * Catmull-Rom 样条插值；t ∈ [0,1] 表示路径进度。
 */

export interface FishPath {
  pathId: number;
  points: [number, number][];
  /** 基准游完全程毫秒（实际 = durationMs / speedScale） */
  durationMs: number;
}

export const FISH_PATHS: FishPath[] = [
  { pathId: 0, durationMs: 16000, points: [[-0.1, 0.2], [0.25, 0.28], [0.5, 0.22], [0.75, 0.3], [1.1, 0.25]] },
  { pathId: 1, durationMs: 15000, points: [[1.1, 0.7], [0.75, 0.62], [0.5, 0.7], [0.25, 0.64], [-0.1, 0.72]] },
  { pathId: 2, durationMs: 18000, points: [[-0.1, 0.5], [0.2, 0.35], [0.5, 0.55], [0.8, 0.35], [1.1, 0.5]] },
  { pathId: 3, durationMs: 17000, points: [[1.1, 0.15], [0.7, 0.3], [0.45, 0.5], [0.2, 0.68], [-0.1, 0.8]] },
  { pathId: 4, durationMs: 19000, points: [[-0.1, 0.85], [0.3, 0.7], [0.55, 0.5], [0.75, 0.35], [1.1, 0.2]] },
  { pathId: 5, durationMs: 20000, points: [[-0.1, 0.4], [0.3, 0.45], [0.6, 0.4], [0.9, 0.45], [1.1, 0.42]] },
  { pathId: 6, durationMs: 24000, points: [[1.1, 0.55], [0.8, 0.5], [0.5, 0.58], [0.2, 0.5], [-0.1, 0.55]] },
  // Boss 巡游路径（大弧线，慢速）
  { pathId: 7, durationMs: 30000, points: [[-0.15, 0.5], [0.2, 0.3], [0.5, 0.5], [0.8, 0.7], [1.15, 0.5]] },
  { pathId: 8, durationMs: 34000, points: [[1.15, 0.45], [0.75, 0.6], [0.5, 0.4], [0.25, 0.6], [-0.15, 0.45]] },
];

export const pathById = new Map(FISH_PATHS.map((p) => [p.pathId, p]));

/** Catmull-Rom 位置插值 */
export function pointOnPath(path: FishPath, t: number): [number, number] {
  const pts = path.points;
  const n = pts.length;
  if (t <= 0) return pts[0]!;
  if (t >= 1) return pts[n - 1]!;
  const segCount = n - 1;
  const ft = t * segCount;
  const i = Math.min(Math.floor(ft), segCount - 1);
  const lt = ft - i;
  const p0 = pts[Math.max(0, i - 1)]!;
  const p1 = pts[i]!;
  const p2 = pts[i + 1]!;
  const p3 = pts[Math.min(n - 1, i + 2)]!;
  const cr = (a: number, b: number, c: number, d: number, u: number) =>
    0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
  return [cr(p0[0], p1[0], p2[0], p3[0], lt), cr(p0[1], p1[1], p2[1], p3[1], lt)];
}

/** 指定时刻鱼在屏幕上的位置（服务端角度合理性校验用） */
export function fishPositionAt(path: FishPath, spawnAtMs: number, speedScale: number, nowMs: number): [number, number] | null {
  const dur = path.durationMs / speedScale;
  const t = (nowMs - spawnAtMs) / dur;
  if (t < 0 || t > 1) return null;
  return pointOnPath(path, t);
}
