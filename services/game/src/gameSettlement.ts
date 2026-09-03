/**
 * GameSettlementService：所有游戏统一的下注 / 派彩 / 退款入口（用户要求 §十二）。
 * - 钱包过账只经 `postTransactionInTx`（账本 + 对手系统账户 + 幂等）；本模块只负责统一 key 规范、对手账户与账目类型
 * - 幂等：下注 `<game>:bet:<uid>:<requestId>`，派彩 `<game>:win:<roundId>:<uid>`，退款 `<game>:refund:<roundId>:<uid>`
 *   —— 同一 roundId 对同一用户只可能派一次彩，重复调用返回原余额（duplicated=true），不会重复发钱
 * - 金币为游戏内虚拟娱乐资产，不可兑换现金
 */
import { postTransactionInTx, SYS, type PostedTx } from '@yanbian/wallet';
import { withTx } from '@yanbian/server-core';

type TxClient = Parameters<Parameters<typeof withTx>[0]>[0];

export type GameType = 'slot_fruit' | 'fishing' | 'roulette' | 'stock_updown' | 'mahjong_yanbian' | 'hongshi';

/** 各游戏对手系统账户（资金池），账本上每笔用户账目都有对应的系统账目 */
export const GAME_POOL: Record<GameType, number> = {
  slot_fruit: SYS.SLOT_POOL,
  fishing: SYS.FISH_POOL,
  roulette: SYS.ROULETTE_POOL,
  stock_updown: SYS.STOCK_POOL,
  mahjong_yanbian: SYS.ISSUER,
  hongshi: SYS.ISSUER,
};

export const betKey = (gameType: GameType, uid: number, requestId: string): string => `${gameType}:bet:${uid}:${requestId}`;
export const winKey = (gameType: GameType, roundId: number, uid: number): string => `${gameType}:win:${roundId}:${uid}`;
export const refundKey = (gameType: GameType, roundId: number, uid: number): string => `${gameType}:refund:${roundId}:${uid}`;

export interface BetInput {
  gameType: GameType;
  userId: number;
  roundId: number;
  amount: number;
  /** 客户端请求 id：同一请求重发不会重复扣款 */
  requestId: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
export interface PayoutInput {
  gameType: GameType;
  userId: number;
  roundId: number;
  payout: number;
  /** 结算依据（结果号码 / 方向 / 赔率等），进入账目 metadata 供审计 */
  gameResult?: Record<string, unknown>;
  description?: string;
  /** 默认 `<game>:win:<roundId>:<uid>`；同一回合多次派彩（如水果机 Jackpot）可传后缀区分 */
  keySuffix?: string;
}

/** 扣注（事务内）。amount 必须 > 0 */
export async function settleBetInTx(c: TxClient, input: BetInput): Promise<PostedTx> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error(`settleBet: invalid amount ${input.amount}`);
  return postTransactionInTx(c, {
    idempotencyKey: betKey(input.gameType, input.userId, input.requestId),
    userId: input.userId,
    currency: 'COIN',
    type: 'GAME_BET',
    amount: -input.amount,
    systemAccount: GAME_POOL[input.gameType],
    gameId: input.gameType,
    roundId: input.roundId,
    description: input.description ?? `${input.gameType} 下注`,
    metadata: input.metadata,
  });
}

/** 派彩（事务内）。payout ≤ 0 时不过账，返回 null */
export async function settlePayoutInTx(c: TxClient, input: PayoutInput): Promise<PostedTx | null> {
  if (!Number.isInteger(input.payout) || input.payout <= 0) return null;
  return postTransactionInTx(c, {
    idempotencyKey: winKey(input.gameType, input.roundId, input.userId) + (input.keySuffix ?? ''),
    userId: input.userId,
    currency: 'COIN',
    type: 'GAME_WIN',
    amount: input.payout,
    systemAccount: GAME_POOL[input.gameType],
    gameId: input.gameType,
    roundId: input.roundId,
    description: input.description ?? `${input.gameType} 派彩`,
    metadata: input.gameResult,
  });
}

/** 退款（事务内，幂等）：回合作废 / 服务端异常时退还本金 */
export async function settleRefundInTx(c: TxClient, input: { gameType: GameType; userId: number; roundId: number; amount: number; description?: string }): Promise<PostedTx | null> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) return null;
  return postTransactionInTx(c, {
    idempotencyKey: refundKey(input.gameType, input.roundId, input.userId),
    userId: input.userId,
    currency: 'COIN',
    type: 'GAME_REFUND',
    amount: input.amount,
    systemAccount: GAME_POOL[input.gameType],
    gameId: input.gameType,
    roundId: input.roundId,
    description: input.description ?? `${input.gameType} 退款`,
  });
}

export interface SettleInput {
  gameType: GameType;
  userId: number;
  roundId: number;
  betAmount: number;
  payout: number;
  gameResult: Record<string, unknown>;
  /** 下注幂等依据（客户端 requestId）；一次性结算型游戏（转一次 / 开一枪）用同一 key 判重 */
  idempotencyKey: string;
}
export interface SettleOutcome {
  balance: number;
  /** 下注请求已处理过（重复请求） */
  duplicated: boolean;
}

/**
 * 一次性结算：单事务内 扣注 → 派彩。重复的 idempotencyKey 直接返回当前余额且不再派彩；
 * 派彩按 roundId 幂等，因此即使调用方重试也不会重复发钱。
 */
export async function settle(input: SettleInput): Promise<SettleOutcome> {
  return withTx(async (c) => {
    let balance = 0;
    if (input.betAmount > 0) {
      const bet = await settleBetInTx(c, { gameType: input.gameType, userId: input.userId, roundId: input.roundId, amount: input.betAmount, requestId: input.idempotencyKey });
      balance = bet.balanceAfter;
      if (bet.duplicated) return { balance, duplicated: true };
    }
    const win = await settlePayoutInTx(c, { gameType: input.gameType, userId: input.userId, roundId: input.roundId, payout: input.payout, gameResult: input.gameResult });
    if (win) balance = win.balanceAfter;
    else if (input.betAmount <= 0) {
      const b = await c.query('SELECT balance FROM wallet_accounts WHERE user_id=$1 AND currency=$2', [input.userId, 'COIN']);
      balance = Number(b.rows[0]?.balance ?? 0);
    }
    return { balance, duplicated: false };
  });
}
