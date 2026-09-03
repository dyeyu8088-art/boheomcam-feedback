/**
 * 轮盘宿主：单桌共享回合 —— 下注窗口 → 服务端 CSPRNG 开奖（锁盘即定）→ 转盘演出 → 结算展示 → 下一局。
 * - 下注 / 开奖 / 派彩全部服务端权威；客户端只提交投注清单并播动画
 * - 每次下注请求幂等（roulette:bet:<uid>:<requestId>），派彩幂等（roulette:win:<roundId>:<uid>）
 * - 结算以数据库中的注单为准（不依赖内存），崩溃恢复：已开奖未结算 → 补结算；未开奖 → 退款并作废
 * - 金币为游戏内虚拟娱乐资产，不可兑换现金
 */
import { ApiError, ErrorCode, Ev } from '@yanbian/protocol';
import {
  ROULETTE_V1,
  RED_NUMBERS,
  WHEEL_ORDER,
  RouletteBetError,
  colorOf,
  drawResult,
  normalizeBets,
  settleBets,
  validateBet,
  type RouletteBet,
  type RouletteConfig,
} from '@yanbian/game-common/roulette';
import { secureRng } from '@yanbian/game-common';
import { getLogger, getRedis, loadEnv, nextId, query, withTx } from '@yanbian/server-core';
import { getBalances } from '@yanbian/wallet';
import { hub, type GameSession } from '../hub.js';
import { loadRule } from '../configs.js';
import { bumpExp, bumpTask, bumpTournament } from '../settlement.js';
import { settleBetInTx, settlePayoutInTx, settleRefundInTx } from '../gameSettlement.js';

const log = getLogger('roulette');

type Phase = 'betting' | 'spinning' | 'result';

interface PlacedBet extends RouletteBet {
  betId: number;
}
interface UserBets {
  bets: PlacedBet[];
  total: number;
}
interface RoundState {
  roundId: number;
  phase: Phase;
  openedAt: number;
  lockAt: number;
  resultAt: number;
  nextAt: number;
  result: number | null;
  bets: Map<number, UserBets>;
}

let cfg: RouletteConfig = ROULETTE_V1;
let round: RoundState | null = null;
let history: number[] = [];
let busy = false;
const entered = new Set<number>();

function serverId(): string {
  return loadEnv().serverId;
}

function broadcast(event: string, data: unknown): void {
  for (const uid of entered) hub.send(uid, event, data);
}

async function trackOnline(): Promise<void> {
  await getRedis().set('online:game:roulette', String(entered.size)).catch(() => undefined);
}

function publicRound(r: RoundState): Record<string, unknown> {
  return {
    roundId: r.roundId,
    phase: r.phase,
    openedAt: r.openedAt,
    lockAt: r.lockAt,
    resultAt: r.resultAt,
    nextAt: r.nextAt,
    result: r.result,
    color: r.result === null ? null : colorOf(r.result),
    serverTime: Date.now(),
  };
}

function myBetsOf(uid: number): { type: string; selection: string; amount: number }[] {
  return (round?.bets.get(uid)?.bets ?? []).map((b) => ({ type: b.type, selection: b.selection, amount: b.amount }));
}

// ───────────────────────── 回合循环 ─────────────────────────

async function openRound(): Promise<void> {
  const now = Date.now();
  const roundId = nextId();
  const lockAt = now + cfg.betWindowMs;
  await query(
    `INSERT INTO roulette_rounds (round_id, table_id, opened_at, lock_at, server_id)
     VALUES ($1,$2,to_timestamp($3/1000.0),to_timestamp($4/1000.0),$5)`,
    [roundId, cfg.tableId, now, lockAt, serverId()],
  );
  round = {
    roundId,
    phase: 'betting',
    openedAt: now,
    lockAt,
    resultAt: lockAt + cfg.spinMs,
    nextAt: lockAt + cfg.spinMs + cfg.resultMs,
    result: null,
    bets: new Map(),
  };
  broadcast(Ev.RlState, publicRound(round));
}

/** 锁盘即开奖：结果与审计立即落库，之后才向客户端播转盘 */
async function spinRound(r: RoundState): Promise<void> {
  const d = drawResult(secureRng);
  await query(`UPDATE roulette_rounds SET result=$2, rng_audit=$3 WHERE round_id=$1`, [
    r.roundId,
    d.result,
    JSON.stringify({ roll: d.roll, drawnAt: new Date().toISOString(), serverId: serverId(), version: cfg.version }),
  ]);
  r.result = d.result;
  r.phase = 'spinning';
  broadcast(Ev.RlSpin, {
    roundId: r.roundId,
    result: d.result,
    color: colorOf(d.result),
    wheelIndex: WHEEL_ORDER.indexOf(d.result),
    spinMs: cfg.spinMs,
    resultAt: r.resultAt,
    serverTime: Date.now(),
  });
}

interface UserSettlement {
  uid: number;
  bets: { type: string; selection: string; amount: number; payout: number }[];
  totalBet: number;
  totalPayout: number;
  balance: number | null;
}

/** 按数据库注单结算（幂等）；notify=false 用于崩溃恢复 */
async function settleRoundById(roundId: number, result: number, notify: boolean): Promise<void> {
  const rows = await query(`SELECT bet_id, user_id, bet_type, selection, amount, payout FROM roulette_bets WHERE round_id=$1 ORDER BY user_id, bet_id`, [roundId]);
  const byUser = new Map<number, { betId: number; bet: RouletteBet }[]>();
  for (const row of rows.rows) {
    const uid = Number(row.user_id);
    const list = byUser.get(uid) ?? [];
    list.push({ betId: Number(row.bet_id), bet: { type: row.bet_type as RouletteBet['type'], selection: String(row.selection), amount: Number(row.amount) } });
    byUser.set(uid, list);
  }
  const settlements = new Map<number, UserSettlement>();
  let totalPayout = 0;
  for (const [uid, list] of byUser) {
    const s = settleBets(cfg, list.map((x) => x.bet), result);
    let balance: number | null = null;
    await withTx(async (c) => {
      for (let i = 0; i < list.length; i += 1) {
        await c.query(`UPDATE roulette_bets SET payout=$2 WHERE bet_id=$1`, [list[i]!.betId, s.payouts[i]!]);
      }
      const win = await settlePayoutInTx(c, {
        gameType: 'roulette',
        userId: uid,
        roundId,
        payout: s.totalPayout,
        gameResult: { result, color: colorOf(result), bets: list.length },
        description: `轮盘中奖 ${result}`,
      });
      if (win) {
        balance = win.balanceAfter;
      } else {
        const b = await c.query('SELECT balance FROM wallet_accounts WHERE user_id=$1 AND currency=$2', [uid, 'COIN']);
        balance = Number(b.rows[0]?.balance ?? 0);
      }
    });
    totalPayout += s.totalPayout;
    settlements.set(uid, {
      uid,
      bets: list.map((x, i) => ({ ...x.bet, payout: s.payouts[i]! })),
      totalBet: s.totalBet,
      totalPayout: s.totalPayout,
      balance,
    });
  }
  await query(`UPDATE roulette_rounds SET total_payout=$2, settled_at=now() WHERE round_id=$1`, [roundId, totalPayout]);
  if (!notify) return;

  history.unshift(result);
  history = history.slice(0, cfg.historySize);
  for (const [uid, s] of settlements) {
    await bumpTask(uid, 'roulette_rounds', 'roulette');
    await bumpExp(uid, 1 + Math.floor(s.totalBet / 500));
    if (s.totalPayout > 0) {
      await bumpTournament(uid, 'roulette', 'coin_win', s.totalPayout);
      if (s.totalPayout > s.totalBet) await bumpTournament(uid, 'roulette', 'roulette_win', s.totalPayout - s.totalBet);
    }
  }
  const color = colorOf(result);
  const winners = [...settlements.values()].filter((s) => s.totalPayout > 0).length;
  for (const uid of entered) {
    const s = settlements.get(uid);
    hub.send(uid, Ev.RlResult, {
      roundId,
      result,
      color,
      myBets: s?.bets ?? [],
      myBet: s?.totalBet ?? 0,
      myPayout: s?.totalPayout ?? 0,
      balance: s?.balance ?? null,
      history,
      players: entered.size,
      winners,
      nextAt: round?.nextAt ?? Date.now() + cfg.resultMs,
      serverTime: Date.now(),
    });
  }
}

async function tick(): Promise<void> {
  if (!round || busy) return;
  const now = Date.now();
  const r = round;
  try {
    busy = true;
    if (r.phase === 'betting' && now >= r.lockAt) {
      await spinRound(r);
    } else if (r.phase === 'spinning' && now >= r.resultAt) {
      await settleRoundById(r.roundId, r.result!, true);
      r.phase = 'result';
      broadcast(Ev.RlState, publicRound(r));
    } else if (r.phase === 'result' && now >= r.nextAt) {
      await openRound();
    }
  } catch (e) {
    log.error({ err: (e as Error).message, roundId: r.roundId, phase: r.phase }, 'roulette tick failed');
  } finally {
    busy = false;
  }
}

/** 崩溃恢复：已开奖未结算 → 补结算；未开奖 → 退款并作废 */
async function recover(): Promise<void> {
  const open = await query(`SELECT round_id, result FROM roulette_rounds WHERE settled_at IS NULL ORDER BY opened_at`);
  for (const row of open.rows) {
    const roundId = Number(row.round_id);
    if (row.result === null || row.result === undefined) {
      const bets = await query(`SELECT user_id, SUM(amount)::bigint AS total FROM roulette_bets WHERE round_id=$1 GROUP BY user_id`, [roundId]);
      for (const b of bets.rows) {
        await withTx((c) => settleRefundInTx(c, { gameType: 'roulette', userId: Number(b.user_id), roundId, amount: Number(b.total), description: '轮盘未开奖退款' }));
      }
      await query(`UPDATE roulette_rounds SET settled_at=now(), rng_audit = rng_audit || '{"void":true}'::jsonb WHERE round_id=$1`, [roundId]);
      log.warn({ roundId, refunds: bets.rowCount }, 'roulette round voided on recovery');
    } else {
      await settleRoundById(roundId, Number(row.result), false);
      log.warn({ roundId }, 'roulette round settled on recovery');
    }
  }
}

export async function startRouletteLoop(): Promise<void> {
  cfg = await loadRule('roulette', ROULETTE_V1);
  await recover();
  const hist = await query(
    `SELECT result FROM roulette_rounds WHERE result IS NOT NULL AND settled_at IS NOT NULL AND NOT (rng_audit ? 'void')
     ORDER BY opened_at DESC LIMIT $1`,
    [cfg.historySize],
  );
  history = hist.rows.map((r) => Number(r.result));
  await openRound();
  setInterval(() => void tick(), 200).unref();
  log.info({ version: cfg.version, betWindowMs: cfg.betWindowMs }, 'roulette table opened');
}

// ───────────────────────── 会话接口 ─────────────────────────

export async function enter(session: GameSession): Promise<Record<string, unknown>> {
  if (!round) throw new ApiError(ErrorCode.MAINTENANCE, '轮盘未开桌');
  log.info({ uid: session.uid, phase: round.phase }, 'roulette enter');
  entered.add(session.uid);
  session.gameCode = 'roulette';
  await trackOnline();
  const balances = await getBalances(session.uid);
  return {
    config: {
      version: cfg.version,
      chips: cfg.chips,
      minBet: cfg.minBet,
      maxBetPerSpot: cfg.maxBetPerSpot,
      maxBetPerRound: cfg.maxBetPerRound,
      betWindowMs: cfg.betWindowMs,
      spinMs: cfg.spinMs,
      resultMs: cfg.resultMs,
      payouts: cfg.payouts,
      wheelOrder: WHEEL_ORDER,
      redNumbers: [...RED_NUMBERS],
    },
    round: publicRound(round),
    myBets: myBetsOf(session.uid),
    myBet: round.bets.get(session.uid)?.total ?? 0,
    history,
    balance: balances.COIN,
    players: entered.size,
    serverTime: Date.now(),
  };
}

export function leave(session: GameSession): void {
  entered.delete(session.uid);
  if (session.gameCode === 'roulette') session.gameCode = null;
  void trackOnline();
}

export function historyOf(): { history: number[] } {
  return { history };
}

export async function bet(session: GameSession, data: Record<string, unknown>, requestId: string): Promise<Record<string, unknown>> {
  const uid = session.uid;
  const r = round;
  if (!r || r.phase !== 'betting') throw new ApiError(ErrorCode.BET_OUT_OF_RANGE, '当前不可下注');
  if (Date.now() > r.lockAt - 250) throw new ApiError(ErrorCode.BET_OUT_OF_RANGE, '下注已截止');
  const raw = Array.isArray(data.bets) ? (data.bets as Record<string, unknown>[]) : [];
  if (raw.length === 0 || raw.length > 40) throw new ApiError(ErrorCode.VALIDATION, '投注列表不合法');
  const bets = normalizeBets(
    raw.map((b) => ({ type: String(b.type ?? '') as RouletteBet['type'], selection: String(b.selection ?? ''), amount: Number(b.amount) })),
  );
  try {
    for (const b of bets) validateBet(cfg, b);
  } catch (e) {
    if (e instanceof RouletteBetError) throw new ApiError(ErrorCode.BET_OUT_OF_RANGE, e.message);
    throw e;
  }
  const mine = r.bets.get(uid) ?? { bets: [], total: 0 };
  const total = bets.reduce((s, b) => s + b.amount, 0);
  if (mine.total + total > cfg.maxBetPerRound) throw new ApiError(ErrorCode.BET_OUT_OF_RANGE, `单局投注上限 ${cfg.maxBetPerRound}`);
  for (const b of bets) {
    const prev = mine.bets.filter((x) => x.type === b.type && x.selection === b.selection).reduce((s, x) => s + x.amount, 0);
    if (prev + b.amount > cfg.maxBetPerSpot) throw new ApiError(ErrorCode.BET_OUT_OF_RANGE, `单点投注上限 ${cfg.maxBetPerSpot}`);
  }
  const balances = await getBalances(uid);
  if (balances.COIN < total) throw new ApiError(ErrorCode.INSUFFICIENT_BALANCE);

  const roundId = r.roundId;
  const key = `roulette:bet:${uid}:${requestId}`;
  const res = await withTx(async (c) => {
    const tx = await settleBetInTx(c, { gameType: 'roulette', userId: uid, roundId, amount: total, requestId, description: `轮盘下注 ${bets.length} 注` });
    if (tx.duplicated) {
      const prev = await c.query(`SELECT bet_id, bet_type, selection, amount FROM roulette_bets WHERE idempotency_key LIKE $1 ORDER BY bet_id`, [`${key}:%`]);
      return { duplicated: true, balance: tx.balanceAfter, rows: prev.rows as { bet_id: string; bet_type: string; selection: string; amount: string }[] };
    }
    const rows: { bet_id: string; bet_type: string; selection: string; amount: string }[] = [];
    for (let i = 0; i < bets.length; i += 1) {
      const b = bets[i]!;
      const ins = await c.query(
        `INSERT INTO roulette_bets (round_id, user_id, bet_type, selection, amount, idempotency_key) VALUES ($1,$2,$3,$4,$5,$6) RETURNING bet_id`,
        [roundId, uid, b.type, b.selection, b.amount, `${key}:${i}`],
      );
      rows.push({ bet_id: String(ins.rows[0]!.bet_id), bet_type: b.type, selection: b.selection, amount: String(b.amount) });
    }
    await c.query(`UPDATE roulette_rounds SET total_bet = total_bet + $2 WHERE round_id=$1`, [roundId, total]);
    return { duplicated: false, balance: tx.balanceAfter, rows };
  });

  if (!res.duplicated) {
    // 内存注单只用于限额与重连回显；结算以数据库为准
    const cur = round && round.roundId === roundId ? round : null;
    if (cur) {
      const list = cur.bets.get(uid) ?? { bets: [], total: 0 };
      for (const row of res.rows) {
        list.bets.push({ betId: Number(row.bet_id), type: row.bet_type as RouletteBet['type'], selection: row.selection, amount: Number(row.amount) });
      }
      list.total += total;
      cur.bets.set(uid, list);
    }
    await bumpTask(uid, 'roulette_bets', 'roulette');
    await bumpTournament(uid, 'roulette', 'coin_bet', total);
  }
  const roundTotal = round && round.roundId === roundId ? (round.bets.get(uid)?.total ?? 0) : total;
  return {
    roundId,
    duplicated: res.duplicated,
    accepted: res.rows.map((row) => ({ type: row.bet_type, selection: row.selection, amount: Number(row.amount) })),
    roundTotal,
    balance: res.balance,
    serverTime: Date.now(),
  };
}
