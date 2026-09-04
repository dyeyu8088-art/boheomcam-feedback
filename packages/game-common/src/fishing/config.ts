/**
 * 捕鱼配置（后台可调，config_versions 留痕）。
 * 全部为虚拟娱乐积分数值。
 */

export interface FishTypeConfig {
  typeId: string;
  name: string;
  /** 赔率：死亡奖励 = bulletCost × baseOdds */
  baseOdds: number;
  /** 体型（客户端表现 + 角度容差基准） */
  size: 'small' | 'medium' | 'large' | 'boss';
  /** 相对速度系数 */
  speedScale: number;
}

export interface FishingStageConfig {
  stageId: string;
  name: string;
  minCoins: number;
  /** 炮倍白名单 */
  multipliers: number[];
  /** 每发子弹基础成本（×炮倍） */
  bulletBaseCost: number;
  /** 每秒最大射击数 */
  maxFireRate: number;
  /** 目标 RTP（0-1） */
  targetRtp: number;
  /** RTP 控制器：盈亏池每偏离 poolStep，rtpFactor 调整 factorStep，夹在 [minFactor,maxFactor] */
  controller: { poolStep: number; factorStep: number; minFactor: number; maxFactor: number };
  maxPlayers: number;
}

export interface WaveTemplate {
  waveId: string;
  /** 每条：鱼种、路径、出生延迟（ms）、数量、间隔 */
  spawns: { typeId: string; pathId: number; delayMs: number; count: number; gapMs: number }[];
  durationMs: number;
  isBossWave?: boolean;
}

export const FISH_TYPES: FishTypeConfig[] = [
  { typeId: 'sardine', name: '沙丁鱼', baseOdds: 2, size: 'small', speedScale: 1.2 },
  { typeId: 'clown', name: '小丑鱼', baseOdds: 3, size: 'small', speedScale: 1.1 },
  { typeId: 'butterfly', name: '蝶鱼', baseOdds: 4, size: 'small', speedScale: 1.0 },
  { typeId: 'puffer', name: '河豚', baseOdds: 6, size: 'medium', speedScale: 0.9 },
  { typeId: 'lionfish', name: '狮子鱼', baseOdds: 8, size: 'medium', speedScale: 0.85 },
  { typeId: 'ray', name: '魔鬼鱼', baseOdds: 12, size: 'medium', speedScale: 0.8 },
  { typeId: 'turtle', name: '海龟', baseOdds: 18, size: 'large', speedScale: 0.6 },
  { typeId: 'shark', name: '灰鲨', baseOdds: 25, size: 'large', speedScale: 0.7 },
  { typeId: 'goldenShark', name: '黄金鲨', baseOdds: 40, size: 'large', speedScale: 0.65 },
  { typeId: 'whale', name: '座头鲸', baseOdds: 60, size: 'boss', speedScale: 0.5 },
  { typeId: 'dragonKing', name: '深海龙王', baseOdds: 120, size: 'boss', speedScale: 0.45 },
];

export const FISHING_STAGES: FishingStageConfig[] = [
  {
    stageId: 'fishing_novice',
    name: '珊瑚湾·新手场',
    minCoins: 1000,
    multipliers: [1, 2, 5, 10],
    bulletBaseCost: 10,
    maxFireRate: 8,
    targetRtp: 0.96,
    controller: { poolStep: 20000, factorStep: 0.02, minFactor: 0.8, maxFactor: 1.2 },
    maxPlayers: 4,
  },
  {
    stageId: 'fishing_deep',
    name: '深渊海沟·高手场',
    minCoins: 50000,
    multipliers: [10, 20, 50, 100],
    bulletBaseCost: 10,
    maxFireRate: 8,
    targetRtp: 0.96,
    controller: { poolStep: 200000, factorStep: 0.02, minFactor: 0.8, maxFactor: 1.2 },
    maxPlayers: 4,
  },
];

export const WAVE_TEMPLATES: WaveTemplate[] = [
  {
    waveId: 'wave_school_small',
    durationMs: 30000,
    spawns: [
      { typeId: 'sardine', pathId: 14, delayMs: 0, count: 12, gapMs: 320 }, // 之字快游鱼群
      { typeId: 'clown', pathId: 9, delayMs: 2000, count: 8, gapMs: 480 }, // 深 S
      { typeId: 'butterfly', pathId: 10, delayMs: 5000, count: 6, gapMs: 600 }, // 上弧
      { typeId: 'puffer', pathId: 12, delayMs: 8000, count: 3, gapMs: 1100 }, // 停留后变向
      { typeId: 'ray', pathId: 4, delayMs: 12000, count: 3, gapMs: 1200 }, // 斜向
      { typeId: 'shark', pathId: 5, delayMs: 18000, count: 1, gapMs: 0 },
    ],
  },
  {
    waveId: 'wave_mixed',
    durationMs: 32000,
    spawns: [
      { typeId: 'clown', pathId: 2, delayMs: 0, count: 10, gapMs: 400 },
      { typeId: 'lionfish', pathId: 11, delayMs: 3000, count: 5, gapMs: 800 }, // 下弧
      { typeId: 'turtle', pathId: 13, delayMs: 7000, count: 2, gapMs: 2200 }, // 停留后变向
      { typeId: 'goldenShark', pathId: 3, delayMs: 15000, count: 1, gapMs: 0 },
      { typeId: 'sardine', pathId: 1, delayMs: 20000, count: 14, gapMs: 300 },
    ],
  },
  {
    waveId: 'wave_boss_whale',
    durationMs: 48000,
    isBossWave: true,
    spawns: [
      { typeId: 'whale', pathId: 15, delayMs: 5000, count: 1, gapMs: 0 }, // Boss 绕场
      { typeId: 'sardine', pathId: 0, delayMs: 8000, count: 10, gapMs: 400 },
      { typeId: 'butterfly', pathId: 14, delayMs: 12000, count: 8, gapMs: 500 },
    ],
  },
  {
    waveId: 'wave_boss_dragon',
    durationMs: 45000,
    isBossWave: true,
    spawns: [
      { typeId: 'dragonKing', pathId: 16, delayMs: 5000, count: 1, gapMs: 0 }, // Boss 慢 S
      { typeId: 'clown', pathId: 6, delayMs: 9000, count: 8, gapMs: 450 },
      { typeId: 'puffer', pathId: 9, delayMs: 14000, count: 4, gapMs: 900 },
    ],
  },
];

export const fishTypeById = new Map(FISH_TYPES.map((f) => [f.typeId, f]));
export const fishingStageById = new Map(FISHING_STAGES.map((s) => [s.stageId, s]));

/* ───────── 技能与 Boss ───────── */
export type SkillId = 'LIGHTNING' | 'MISSILE' | 'LASER' | 'NUKE' | 'FREEZE' | 'LOCK';

export interface SkillConfig {
  skillId: SkillId;
  /** 费用 = costBullets × bulletBaseCost × 当前炮倍（无道具时以金币支付） */
  costBullets: number;
  /** 最多命中目标数（0 = 无直接伤害） */
  maxTargets: number;
  cooldownMs: number;
  /** 背包道具 id（有则优先消耗道具） */
  itemId: string;
  /** 持续型技能时长 */
  durationMs?: number;
}

export const SKILLS: SkillConfig[] = [
  { skillId: 'LIGHTNING', costBullets: 20, maxTargets: 6, cooldownMs: 8000, itemId: 'skill_lightning' },
  { skillId: 'MISSILE', costBullets: 30, maxTargets: 1, cooldownMs: 6000, itemId: 'skill_missile' },
  { skillId: 'LASER', costBullets: 50, maxTargets: 8, cooldownMs: 12000, itemId: 'skill_laser' },
  { skillId: 'NUKE', costBullets: 100, maxTargets: 40, cooldownMs: 30000, itemId: 'skill_nuke' },
  { skillId: 'FREEZE', costBullets: 80, maxTargets: 0, cooldownMs: 20000, itemId: 'skill_freeze', durationMs: 8000 },
  { skillId: 'LOCK', costBullets: 5, maxTargets: 0, cooldownMs: 2000, itemId: '', durationMs: 12000 },
];
export const skillById = new Map(SKILLS.map((s) => [s.skillId, s]));

/**
 * Boss 血量（以金币伤害计）：= 赔率 × 子弹基础成本 × 场次最高炮倍。
 * 每发子弹造成 cost × [0.6,1.4] 的伤害，期望正好 1 发 = cost，
 * 因此击杀 Boss 的总投入期望 ≈ maxHp，总奖励 = maxHp × targetRtp 按伤害占比分配 → 全场 RTP 不变。
 */
export function bossMaxHp(type: FishTypeConfig, stage: FishingStageConfig): number {
  const topMult = stage.multipliers[stage.multipliers.length - 1] ?? 1;
  return Math.round(type.baseOdds * stage.bulletBaseCost * topMult);
}
