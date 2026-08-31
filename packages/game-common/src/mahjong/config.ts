/**
 * 麻将规则配置 Schema —— 与《延边麻将规则确认表》逐项对应。
 * 引擎只读配置运行；正式规则包由后台发布（game_configs 表），此处默认值为
 * `yanbian_2026_01.draft` 开发联调用临时值（全部待当地规则确认）。
 */

export type PriorityAction = 'hu' | 'gang' | 'peng' | 'chi';

export interface MahjongRuleConfig {
  ruleVersion: string;
  playerCounts: number[];
  tiles: {
    useWan: boolean;
    useTiao: boolean;
    useTong: boolean;
    useWinds: boolean;
    useDragons: boolean;
    useFlowers: boolean;
  };
  deal: { handSize: 13 | 16 };
  match: { roundOptions: number[] };
  dealer: {
    first: 'random' | 'east';
    rotation: 'winner' | 'next';
    streakEnabled: boolean;
    streakMultiplierPerStreak: number;
    dealerMultiplier: number;
  };
  actions: {
    canChi: boolean;
    canPeng: boolean;
    canMingGang: boolean;
    canAnGang: boolean;
    canBuGang: boolean;
    qiangGangHu: boolean;
    qiangAnGang: boolean;
    declareTing: { enabled: boolean; lockHand: boolean; bonusFan: number };
  };
  timing: {
    turnSeconds: number;
    claimSeconds: number;
    timeoutPolicy: 'autoDiscardTrustee' | 'autoPass';
  };
  priority: {
    order: PriorityAction[];
    multiHu: boolean;
    multiHuPaoAll: boolean;
  };
  hu: {
    minFan: number;
    requireMenQing: boolean;
    requireQueMen: boolean;
    requireYaoJiu: boolean;
    require258Jiang: boolean;
    allowDianPaoHu: boolean;
    selfDrawOnly: boolean;
    passHuLock: 'none' | 'sameTurn' | 'untilDraw';
    tianHu: { enabled: boolean; fan: number };
    diHu: { enabled: boolean; fan: number };
    gangShangKaiHua: { enabled: boolean; bonusFan: number };
    haiDi: { enabled: boolean; bonusFan: number };
    gangHouPao: { mode: 'none' | 'bonusFan' | 'baoPei'; bonusFan: number };
  };
  /** 番型开关与番数（基础型取最大，加成型累加） */
  patterns: {
    pinghu: { enabled: boolean; fan: number };
    pengpenghu: { enabled: boolean; fan: number };
    qidui: { enabled: boolean; fan: number };
    haoqidui: { enabled: boolean; fan: number };
    qingyise: { enabled: boolean; fan: number };
    hunyise: { enabled: boolean; fan: number };
    ziyise: { enabled: boolean; fan: number };
    shisanyao: { enabled: boolean; fan: number };
    quanqiuren: { enabled: boolean; fan: number };
    menqingBonus: { enabled: boolean; fan: number };
    selfDrawBonus: { enabled: boolean; fan: number };
  };
  score: {
    /** 番→倍率：2^fan 查表并按 maxFan 封顶 */
    fanCurve: 'pow2';
    maxFan: number;
    dianPaoPolicy: 'discarderPays' | 'allPay';
    selfDrawPolicy: 'allPay';
    /** 杠即时分（每家）：明杠/暗杠/补杠 */
    gangScore: { ming: number; an: number; bu: number };
  };
  draw: {
    /** 墙余多少张判流局 */
    wallReserve: number;
    chaJiao: boolean;
    chaJiaoFan: number;
    dealerKeepOnDraw: boolean;
  };
}

export const YANBIAN_DRAFT_RULE: MahjongRuleConfig = {
  ruleVersion: 'yanbian_2026_01.draft',
  playerCounts: [4],
  tiles: { useWan: true, useTiao: true, useTong: true, useWinds: false, useDragons: false, useFlowers: false },
  deal: { handSize: 13 },
  match: { roundOptions: [4, 8, 16] },
  dealer: { first: 'random', rotation: 'winner', streakEnabled: true, streakMultiplierPerStreak: 0, dealerMultiplier: 1 },
  actions: {
    canChi: false,
    canPeng: true,
    canMingGang: true,
    canAnGang: true,
    canBuGang: true,
    qiangGangHu: true,
    qiangAnGang: false,
    declareTing: { enabled: true, lockHand: true, bonusFan: 1 },
  },
  timing: { turnSeconds: 15, claimSeconds: 5, timeoutPolicy: 'autoDiscardTrustee' },
  priority: { order: ['hu', 'gang', 'peng', 'chi'], multiHu: true, multiHuPaoAll: true },
  hu: {
    minFan: 1,
    requireMenQing: false,
    requireQueMen: false,
    requireYaoJiu: false,
    require258Jiang: false,
    allowDianPaoHu: true,
    selfDrawOnly: false,
    passHuLock: 'sameTurn',
    tianHu: { enabled: true, fan: 5 },
    diHu: { enabled: true, fan: 5 },
    gangShangKaiHua: { enabled: true, bonusFan: 1 },
    haiDi: { enabled: true, bonusFan: 1 },
    gangHouPao: { mode: 'bonusFan', bonusFan: 1 },
  },
  patterns: {
    pinghu: { enabled: true, fan: 1 },
    pengpenghu: { enabled: true, fan: 2 },
    qidui: { enabled: true, fan: 4 },
    haoqidui: { enabled: true, fan: 5 },
    qingyise: { enabled: true, fan: 4 },
    // 混一色/字一色/十三幺依赖字牌；draft 默认关闭字牌，故随之禁用（启用字牌的正式规则包再打开）
    hunyise: { enabled: false, fan: 2 },
    ziyise: { enabled: false, fan: 5 },
    shisanyao: { enabled: false, fan: 5 },
    quanqiuren: { enabled: true, fan: 2 },
    menqingBonus: { enabled: true, fan: 1 },
    selfDrawBonus: { enabled: true, fan: 1 },
  },
  score: {
    fanCurve: 'pow2',
    maxFan: 5,
    dianPaoPolicy: 'discarderPays',
    selfDrawPolicy: 'allPay',
    gangScore: { ming: 1, an: 2, bu: 1 },
  },
  draw: { wallReserve: 0, chaJiao: true, chaJiaoFan: 1, dealerKeepOnDraw: true },
};

/** 配置合法性校验（后台发布规则包前调用） */
export function validateMahjongRule(cfg: MahjongRuleConfig): string[] {
  const errors: string[] = [];
  const t = cfg.tiles;
  if (!t.useWan && !t.useTiao && !t.useTong) errors.push('至少启用一门序数牌');
  const kinds = (t.useWan ? 9 : 0) + (t.useTiao ? 9 : 0) + (t.useTong ? 9 : 0) + (t.useWinds ? 4 : 0) + (t.useDragons ? 3 : 0);
  const total = kinds * 4;
  for (const pc of cfg.playerCounts) {
    if (pc < 2 || pc > 4) errors.push(`不支持的人数 ${pc}`);
    if (total < pc * (cfg.deal.handSize + 1) + 14) errors.push(`牌数 ${total} 不足以支撑 ${pc} 人局`);
  }
  if (cfg.hu.minFan > cfg.score.maxFan) errors.push('minFan 不能大于 maxFan');
  if (!cfg.priority.order.includes('hu')) errors.push('优先级必须包含 hu');
  if (cfg.timing.turnSeconds < 5 || cfg.timing.turnSeconds > 60) errors.push('turnSeconds 超出范围');
  if (cfg.patterns.ziyise.enabled && !t.useWinds && !t.useDragons) errors.push('字一色需启用字牌');
  if (cfg.patterns.shisanyao.enabled && (!t.useWinds || !t.useDragons || !t.useWan || !t.useTiao || !t.useTong)) {
    errors.push('十三幺需启用全部牌门');
  }
  return errors;
}
