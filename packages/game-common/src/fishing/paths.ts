/**
 * 鱼群路径库 —— 三端共享（服务端判定合理性 / 客户端插值渲染），任何一端改动都必须在这里改。
 * 归一化坐标系：x ∈ [-0.15, 1.15]，y ∈ [-0.15, 1.15]（越界段为出入场）。
 * 形状：Catmull-Rom 样条；速度曲线（ease）把时间进度 t 映射为样条参数 u：
 *   linear —— 匀速
 *   turns  —— 每个控制点附近减速（减速 → 转头 → 尾部跟上 → 加速）
 *   pause  —— 中段停留（t ∈ [0.40, 0.56] 停在路径 45% 处）后变向离开
 * 路径种类（kind）供客户端选择表现：直线 / 斜向 / 弧线 / S 形 / 停留变向 / Boss 环绕 / Boss 弧线。
 */

export type PathEase = 'linear' | 'turns' | 'pause';
export type PathKind = 'straight' | 'diagonal' | 'arc' | 's' | 'pause' | 'zigzag' | 'boss-arc' | 'boss-circle';

export interface FishPath {
  pathId: number;
  points: [number, number][];
  /** 基准游完全程毫秒（实际 = durationMs / speedScale） */
  durationMs: number;
  kind: PathKind;
  ease: PathEase;
}

const P = (pathId: number, kind: PathKind, ease: PathEase, durationMs: number, points: [number, number][]): FishPath => ({ pathId, kind, ease, durationMs, points });

export const FISH_PATHS: FishPath[] = [
  // 0–6：基础直线 / 斜向 / 浅 S（左进右出 / 右进左出）
  P(0, 'straight', 'linear', 16000, [[-0.1, 0.2], [0.25, 0.28], [0.5, 0.22], [0.75, 0.3], [1.1, 0.25]]),
  P(1, 'straight', 'linear', 15000, [[1.1, 0.7], [0.75, 0.62], [0.5, 0.7], [0.25, 0.64], [-0.1, 0.72]]),
  P(2, 's', 'turns', 18000, [[-0.1, 0.5], [0.2, 0.35], [0.5, 0.55], [0.8, 0.35], [1.1, 0.5]]),
  P(3, 'diagonal', 'linear', 17000, [[1.1, 0.15], [0.7, 0.3], [0.45, 0.5], [0.2, 0.68], [-0.1, 0.8]]),
  P(4, 'diagonal', 'linear', 19000, [[-0.1, 0.85], [0.3, 0.7], [0.55, 0.5], [0.75, 0.35], [1.1, 0.2]]),
  P(5, 'straight', 'linear', 20000, [[-0.1, 0.4], [0.3, 0.45], [0.6, 0.4], [0.9, 0.45], [1.1, 0.42]]),
  P(6, 'straight', 'linear', 24000, [[1.1, 0.55], [0.8, 0.5], [0.5, 0.58], [0.2, 0.5], [-0.1, 0.55]]),
  // 7–8：Boss 大弧线（慢速）
  P(7, 'boss-arc', 'turns', 30000, [[-0.15, 0.5], [0.2, 0.3], [0.5, 0.5], [0.8, 0.7], [1.15, 0.5]]),
  P(8, 'boss-arc', 'turns', 34000, [[1.15, 0.45], [0.75, 0.6], [0.5, 0.4], [0.25, 0.6], [-0.15, 0.45]]),
  // 9–14：深 S / 上弧 / 下弧 / 停留变向 ×2 / 之字
  P(9, 's', 'turns', 20000, [[-0.12, 0.3], [0.2, 0.6], [0.45, 0.25], [0.7, 0.65], [1.12, 0.35]]),
  P(10, 'arc', 'turns', 21000, [[1.12, 0.75], [0.8, 0.35], [0.5, 0.2], [0.2, 0.35], [-0.12, 0.75]]),
  P(11, 'arc', 'turns', 21000, [[-0.12, 0.2], [0.25, 0.55], [0.5, 0.72], [0.75, 0.55], [1.12, 0.2]]),
  P(12, 'pause', 'pause', 22000, [[-0.12, 0.55], [0.22, 0.5], [0.42, 0.48], [0.3, 0.3], [-0.12, 0.2]]),
  P(13, 'pause', 'pause', 22000, [[1.12, 0.4], [0.72, 0.45], [0.55, 0.5], [0.7, 0.72], [1.12, 0.8]]),
  P(14, 'zigzag', 'turns', 15000, [[-0.12, 0.8], [0.2, 0.6], [0.4, 0.75], [0.6, 0.5], [0.8, 0.62], [1.12, 0.4]]),
  // 15–16：Boss 绕场环形 / Boss 慢 S
  P(15, 'boss-circle', 'linear', 44000, [
    [1.15, 0.5], [0.82, 0.3], [0.5, 0.2], [0.24, 0.4], [0.3, 0.7], [0.55, 0.8], [0.78, 0.62], [0.72, 0.36], [0.5, 0.26], [0.28, 0.46], [0.4, 0.7], [0.7, 0.75], [1.15, 0.55],
  ]),
  P(16, 'boss-arc', 'turns', 38000, [[-0.15, 0.35], [0.25, 0.6], [0.5, 0.35], [0.75, 0.6], [1.15, 0.4]]),
];

export const pathById = new Map(FISH_PATHS.map((p) => [p.pathId, p]));

const smooth = (x: number): number => x * x * (3 - 2 * x);

/** 速度曲线：时间进度 t → 样条参数 u（单调不减，u(0)=0，u(1)=1） */
export function pathProgress(path: FishPath, t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (path.ease === 'linear') return t;
  if (path.ease === 'pause') {
    // 0–0.40 → 0–0.45（进场减速），0.40–0.56 停留在 0.45，0.56–1 → 0.45–1（转向后加速离开）
    if (t < 0.4) return 0.45 * smooth(t / 0.4) * 0.35 + 0.45 * (t / 0.4) * 0.65;
    if (t < 0.56) return 0.45;
    const r = (t - 0.56) / 0.44;
    return 0.45 + 0.55 * (r * r * 0.4 + r * 0.6);
  }
  // turns：每段内 smoothstep —— 控制点处（拐点）速度最低
  const seg = path.points.length - 1;
  const ft = t * seg;
  const i = Math.min(Math.floor(ft), seg - 1);
  const lt = ft - i;
  // 混合 60% smoothstep + 40% 线性，避免完全停顿
  return (i + smooth(lt) * 0.6 + lt * 0.4) / seg;
}

/** Catmull-Rom 位置插值（u 为样条参数） */
function splineAt(path: FishPath, u: number): [number, number] {
  const pts = path.points;
  const n = pts.length;
  if (u <= 0) return pts[0]!;
  if (u >= 1) return pts[n - 1]!;
  const segCount = n - 1;
  const fu = u * segCount;
  const i = Math.min(Math.floor(fu), segCount - 1);
  const lu = fu - i;
  const p0 = pts[Math.max(0, i - 1)]!;
  const p1 = pts[i]!;
  const p2 = pts[i + 1]!;
  const p3 = pts[Math.min(n - 1, i + 2)]!;
  const cr = (a: number, b: number, c: number, d: number, x: number) =>
    0.5 * (2 * b + (c - a) * x + (2 * a - 5 * b + 4 * c - d) * x * x + (3 * b - a - 3 * c + d) * x * x * x);
  return [cr(p0[0], p1[0], p2[0], p3[0], lu), cr(p0[1], p1[1], p2[1], p3[1], lu)];
}

/** 指定时间进度 t ∈ [0,1] 的位置（含速度曲线） */
export function pointOnPath(path: FishPath, t: number): [number, number] {
  return splineAt(path, pathProgress(path, t));
}

/** 指定时间进度的朝向（弧度，屏幕坐标，x 向右 y 向下）与瞬时速度（归一化单位 / 进度） */
export function headingOnPath(path: FishPath, t: number): { angle: number; speed: number } {
  const d = 0.004;
  const [x0, y0] = pointOnPath(path, Math.max(0, t - d));
  const [x1, y1] = pointOnPath(path, Math.min(1, t + d));
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  return { angle: len < 1e-6 ? NaN : Math.atan2(dy, dx), speed: len / (2 * d) };
}

/**
 * 鱼群车道：同一路径上的多条鱼按 fishId 分配横向偏移（垂直于路径方向），避免叠成一条线。
 * 小鱼 5 条车道 ×0.035、中型鱼 3 条 ×0.03、大鱼 / Boss 走中线。服务端判定与客户端渲染都用它。
 */
export function laneForFish(fishId: number, size: 'small' | 'medium' | 'large' | 'boss'): number {
  if (size === 'small') return (((fishId * 7) % 5) - 2) * 0.035;
  if (size === 'medium') return (((fishId * 7) % 3) - 1) * 0.03;
  return 0;
}

/** 指定进度的位置 + 车道偏移（沿路径法线） */
export function pointOnPathLane(path: FishPath, t: number, lane: number): [number, number] {
  const [x, y] = pointOnPath(path, t);
  if (!lane) return [x, y];
  const h = headingOnPath(path, t);
  if (Number.isNaN(h.angle)) return [x, y];
  return [x - Math.sin(h.angle) * lane, y + Math.cos(h.angle) * lane];
}

/** 指定时刻鱼在屏幕上的位置（服务端角度合理性校验用） */
export function fishPositionAt(path: FishPath, spawnAtMs: number, speedScale: number, nowMs: number, lane = 0): [number, number] | null {
  const dur = path.durationMs / speedScale;
  const t = (nowMs - spawnAtMs) / dur;
  if (t < 0 || t > 1) return null;
  return pointOnPathLane(path, t, lane);
}
