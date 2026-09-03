/**
 * 股票涨跌宿主：每个虚拟品种独立回合（开盘 → 锁盘 → 结算即下一回合开盘）。
 * - 价格只来自 MarketDataProvider（当前为服务端模拟行情），与投注完全无关；严禁客户端决定结果
 * - 每次下注单事务扣款 + 落库（幂等 stock:bet:<uid>:<requestId>），赔率在下注时锁定（odds_bp）
 * - 结算以数据库注单为准，派彩幂等 stock:win:<roundId>:<uid>；崩溃恢复：已有结算价 → 补结算，否则退款作废
 * - 金币为游戏内虚拟娱乐资产，不可兑换现金
 */
import { ApiError, ErrorCode, Ev } from '@yanbian/protocol';
import { STOCK_V1, StockBetError, changePct, directionOf, evaluateBet, normalizeBet, type StockBet, type StockConfig } from '@yanbian/game-common/stock';
import { getLogger, getRedis, loadEnv, nextId, query, withTx } from '@yanbian/server-core';
import { getBalances, postTransactionInTx, SYS } from '@yanbian/wallet';
import { hub, type GameSession } from '../hub.js';
import { loadRule } from '../configs.js';
import { bumpExp, bumpTask, bumpTournament } from '../settlement.js';
import { SimulatedMarketProvider, type MarketDataProvider } from '../market/MarketDataProvider.js';

const log = getLogger('stock');

interface PlacedBet extends StockBet {
  betId: number;
}
interface UserBets {
  bets: PlacedBet[];
  total: number;
}
interface RoundState {
  roundId: number;
  instrument: string;
  openedAt: number;
  lockAt: number;
  settleAt: number;
  openingPrice: number;
  settling: boolean;
  bets: Map<number, UserBets>;
}
interface RoundResult {
  roundId: number;
  instrument: string;
  openingPrice: number;
  settlementPrice: number;
  direction: 'UP' | 'DOWN' | 'FLAT';
  changePct: number;
  settledAt: number;
}

let cfg: StockConfig = STOCK_V1;
let provider: MarketDataProvider | null = null;
const rounds = new Map<string, RoundState>();
const results = new Map<string, RoundResult[]>();
const entered = new Set<number>();
const RESULTS_KEEP = 20;

function serverId(): string {
  return loadEnv().serverId;
}
function broadcast(event: string, data: unknown): void {
  for (const uid of entered) hub.send(uid, event, data);
}
async function trackOnline(): Promise<void> {
  await getRedis().set('online:game:stock_updown', String(entered.size)).catch(() => undefined);
}
function publicRound(r: RoundState): Record<string, unknown> {
  return { roundId: r.roundId, instrument: r.instrument, openedAt: r.openedAt, lockAt: r.lockAt, settleAt: r.settleAt, openingPrice: r.openingPrice };
}
function myBetsOf(uid: number): Record<string, { type: string; selection: string; amount: number; oddsBp: number }[]> {
  const out: Record<string, { type: string; selection: string; amount: number; oddsBp: number }[]> = {};
  for (const [inst, r] of rounds) {
    out[inst] = (r.bets.get(uid)?.bets ?? []).map((b) => ({ type: b.type, selection: b.selection, amount: b.amount, oddsBp: b.oddsBp }));
  }
  return out;
}

// ───────────────────────── 回合循环 ─────────────────────────

async function openRound(instrument: string, openedAt: number): Promise<RoundState> {
  const p = provider!;
  const opening = p.getRoundOpeningPrice(instrument, openedAt);
  const roundId = nextId();
  const settleAt = openedAt + cfg.roundMs;
  const lockAt = settleAt - cfg.lockBeforeMs;
  await query(
    `INSERT INTO stock_rounds (round_id, instrument, opened_at, lock_at, settle_at, opening_price, rng_audit, server_id)
     VALUES ($1,$2,to_timestamp($3/1000.0),to_timestamp($4/1000.0),to_timestamp($5/1000.0),$6,$7,$8)`,
    [roundId, instrument, openedAt, lockAt, settleAt, opening.price, JSON.stringify({ provider: p.kind, openTickTs: opening.ts, version: cfg.version }), serverId()],
  );
  const r: RoundState = { roundId, instrument, openedAt, lockAt, settleAt, openingPrice: opening.price, settling: false, bets: new Map() };
  rounds.set(instrument, r);
  broadcast(Ev.StRound, { round: publicRound(r), serverTime: Date.now() });
  return r;
}

interface UserSettlement {
  bets: { type: string; selection: string; amount: number; oddsBp: number; payout: number }[];
  totalBet: number;
  totalPayout: number;
  balance: number | null;
}

/** 按数据库注单结算（幂等）；notify=false 用于崩溃恢复 */
async function settleRoundById(roundId: number, instrument: string, openingPrice: number, settlementPrice: number, settleTickTs: number, notify: boolean): Promise<RoundResult> {
  const direction = directionOf(openingPrice, settlementPrice);
  await query(
    `UPDATE stock_rounds SET settlement_price=$2, direction=$3, rng_audit = rng_audit || $4::jsonb WHERE round_id=$1 AND settlement_price IS NULL`,
    [roundId, settlementPrice, direction, JSON.stringify({ settleTickTs, settledBy: serverId() })],
  );
  const rows = await query(`SELECT bet_id, user_id, bet_type, selection, amount, odds_bp FROM stock_bets WHERE round_id=$1 ORDER BY user_id, bet_id`, [roundId]);
  const byUser = new Map<number, { betId: number; bet: StockBet }[]>();
  for (const row of rows.rows) {
    const uid = Number(row.user_id);
    const list = byUser.get(uid) ?? [];
    list.push({ betId: Number(row.bet_id), bet: { type: row.bet_type as StockBet['type'], selection: String(row.selection), amount: Number(row.amount), oddsBp: Number(row.odds_bp) } });
    byUser.set(uid, list);
  }
  const settlements = new Map<number, UserSettlement>();
  let totalPayout = 0;
  for (const [uid, list] of byUser) {
    const payouts = list.map((x) => evaluateBet(cfg, x.bet, { openingPrice, settlementPrice }));
    const userPayout = payouts.reduce((s, v) => s + v, 0);
    const userBet = list.reduce((s, x) => s + x.bet.amount, 0);
    let balance: number | null = null;
    await withTx(async (c) => {
      for (let i = 0; i < list.length; i += 1) await c.query(`UPDATE stock_bets SET payout=$2 WHERE bet_id=$1`, [list[i]!.betId, payouts[i]!]);
      if (userPayout > 0) {
        const win = await postTransactionInTx(c, {
          idempotencyKey: `stock:win:${roundId}:${uid}`,
          userId: uid,
          currency: 'COIN',
          type: 'GAME_WIN',
          amount: userPayout,
          systemAccount: SYS.STOCK_POOL,
          gameId: 'stock_updown',
          roundId,
          description: `股票涨跌派彩 ${instrument} ${direction}`,
        });
        balance = win.balanceAfter;
      } else {
        const b = await c.query('SELECT balance FROM wallet_accounts WHERE user_id=$1 AND currency=$2', [uid, 'COIN']);
        balance = Number(b.rows[0]?.balance ?? 0);
      }
    });
    totalPayout += userPayout;
    settlements.set(uid, { bets: list.map((x, i) => ({ ...x.bet, payout: payouts[i]! })), totalBet: userBet, totalPayout: userPayout, balance });
  }
  await query(`UPDATE stock_rounds SET total_payout=$2, settled_at=now() WHERE round_id=$1`, [roundId, totalPayout]);
  const result: RoundResult = { roundId, instrument, openingPrice, settlementPrice, direction, changePct: changePct(openingPrice, settlementPrice), settledAt: Date.now() };
  if (!notify) return result;

  const list = results.get(instrument) ?? [];
  list.unshift(result);
  results.set(instrument, list.slice(0, RESULTS_KEEP));
  for (const [uid, s] of settlements) {
    await bumpTask(uid, 'stock_rounds', 'stock_updown');
    await bumpExp(uid, 1 + Math.floor(s.totalBet / 500));
    if (s.totalPayout > 0) {
      await bumpTournament(uid, 'stock_updown', 'coin_win', s.totalPayout);
      if (s.totalPayout > s.totalBet) await bumpTournament(uid, 'stock_updown', 'stock_win', s.totalPayout - s.totalBet);
    }
  }
  for (const uid of entered) {
    const s = settlements.get(uid);
    hub.send(uid, Ev.StResult, {
      ...result,
      myBets: s?.bets ?? [],
      myBet: s?.totalBet ?? 0,
      myPayout: s?.totalPayout ?? 0,
      balance: s?.balance ?? null,
      results: results.get(instrument) ?? [],
      serverTime: Date.now(),
    });
  }
  return result;
}

async function onTick(ts: number, prices: Record<string, number>): Promise<void> {
  broadcast(Ev.StTick, { ts, prices });
  for (const r of [...rounds.values()]) {
    if (r.settling || ts < r.settleAt) continue;
    r.settling = true;
    try {
      const price = prices[r.instrument] ?? provider!.getCurrentPrice(r.instrument).price;
      await settleRoundById(r.roundId, r.instrument, r.openingPrice, price, ts, true);
      // 结算 tick 即下一回合开盘 tick
      await openRound(r.instrument, ts);
    } catch (e) {
      log.error({ err: (e as Error).message, roundId: r.roundId }, 'stock settle failed');
      r.settling = false;
    }
  }
}

/** 崩溃恢复：已有结算价 → 补结算；无结算价 → 退款并作废 */
async function recover(): Promise<void> {
  const open = await query(`SELECT round_id, instrument, opening_price, settlement_price, settle_at FROM stock_rounds WHERE settled_at IS NULL ORDER BY opened_at`);
  for (const row of open.rows) {
    const roundId = Number(row.round_id);
    if (row.settlement_price !== null && row.settlement_price !== undefined) {
      await settleRoundById(roundId, String(row.instrument), Number(row.opening_price), Number(row.settlement_price), new Date(row.settle_at as string).getTime(), false);
      log.warn({ roundId }, 'stock round settled on recovery');
      continue;
    }
    const bets = await query(`SELECT user_id, SUM(amount)::bigint AS total FROM stock_bets WHERE round_id=$1 GROUP BY user_id`, [roundId]);
    for (const b of bets.rows) {
      await withTx((c) =>
        postTransactionInTx(c, {
          idempotencyKey: `stock:refund:${roundId}:${b.user_id}`,
          userId: Number(b.user_id),
          currency: 'COIN',
          type: 'GAME_REFUND',
          amount: Number(b.total),
          systemAccount: SYS.STOCK_POOL,
          gameId: 'stock_updown',
          roundId,
          description: '股票涨跌未结算退款',
        }),
      );
    }
    await query(`UPDATE stock_rounds SET settled_at=now(), rng_audit = rng_audit || '{"void":true}'::jsonb WHERE round_id=$1`, [roundId]);
    log.warn({ roundId, refunds: bets.rowCount }, 'stock round voided on recovery');
  }
}

export async function startStockLoop(): Promise<void> {
  cfg = await loadRule('stock_updown', STOCK_V1);
  const sim = new SimulatedMarketProvider(cfg);
  provider = sim;
  await sim.start();
  await recover();
  for (const inst of cfg.instruments) {
    const hist = await query(
      `SELECT round_id, opening_price, settlement_price, direction, settled_at FROM stock_rounds
       WHERE instrument=$1 AND settlement_price IS NOT NULL AND settled_at IS NOT NULL AND NOT (rng_audit ? 'void')
       ORDER BY settle_at DESC LIMIT $2`,
      [inst.id, RESULTS_KEEP],
    );
    results.set(
      inst.id,
      hist.rows.map((r) => ({
        roundId: Number(r.round_id),
        instrument: inst.id,
        openingPrice: Number(r.opening_price),
        settlementPrice: Number(r.settlement_price),
        direction: r.direction as RoundResult['direction'],
        changePct: changePct(Number(r.opening_price), Number(r.settlement_price)),
        settledAt: new Date(r.settled_at as string).getTime(),
      })),
    );
    await openRound(inst.id, Date.now());
  }
  sim.onTick((ts, prices) => void onTick(ts, prices));
  log.info({ version: cfg.version, roundMs: cfg.roundMs, instruments: cfg.instruments.length }, 'stock table opened');
}

// ───────────────────────── 会话接口 ─────────────────────────

export async function enter(session: GameSession): Promise<Record<string, unknown>> {
  const p = provider;
  if (!p || rounds.size === 0) throw new ApiError(ErrorCode.MAINTENANCE, '行情未开盘');
  entered.add(session.uid);
  session.gameCode = 'stock_updown';
  await trackOnline();
  const balances = await getBalances(session.uid);
  const prices: Record<string, number> = {};
  const history: Record<string, { ts: number; price: number }[]> = {};
  const res: Record<string, RoundResult[]> = {};
  for (const inst of cfg.instruments) {
    prices[inst.id] = p.getCurrentPrice(inst.id).price;
    history[inst.id] = p.getHistory(inst.id, cfg.historyTicks);
    res[inst.id] = results.get(inst.id) ?? [];
  }
  return {
    config: {
      version: cfg.version,
      provider: p.kind,
      instruments: cfg.instruments.map((i) => ({ id: i.id, name: i.name, nameKo: i.nameKo })),
      tickMs: cfg.tickMs,
      roundMs: cfg.roundMs,
      lockBeforeMs: cfg.lockBeforeMs,
      chips: cfg.chips,
      minBet: cfg.minBet,
      maxBetPerRound: cfg.maxBetPerRound,
      oddsBp: cfg.oddsBp,
      ranges: cfg.ranges,
    },
    rounds: [...rounds.values()].map(publicRound),
    prices,
    history,
    results: res,
    myBets: myBetsOf(session.uid),
    balance: balances.COIN,
    players: entered.size,
    serverTime: Date.now(),
  };
}

export function leave(session: GameSession): void {
  entered.delete(session.uid);
  if (session.gameCode === 'stock_updown') session.gameCode = null;
  void trackOnline();
}

export async function bet(session: GameSession, data: Record<string, unknown>, requestId: string): Promise<Record<string, unknown>> {
  const uid = session.uid;
  const instrument = String(data.instrument ?? '');
  const r = rounds.get(instrument);
  if (!r || !provider) throw new ApiError(ErrorCode.VALIDATION, '未知品种');
  const now = Date.now();
  if (r.settling || now > r.lockAt - 200) throw new ApiError(ErrorCode.BET_OUT_OF_RANGE, '本回合已锁盘');
  const current = provider.getCurrentPrice(instrument).price;
  let nb: StockBet;
  try {
    nb = normalizeBet(cfg, { type: String(data.type ?? ''), selection: data.selection === undefined ? '' : String(data.selection), amount: Number(data.amount) }, { currentPrice: current });
  } catch (e) {
    if (e instanceof StockBetError) throw new ApiError(ErrorCode.BET_OUT_OF_RANGE, e.message);
    throw e;
  }
  const mine = r.bets.get(uid) ?? { bets: [], total: 0 };
  if (mine.total + nb.amount > cfg.maxBetPerRound) throw new ApiError(ErrorCode.BET_OUT_OF_RANGE, `单局投注上限 ${cfg.maxBetPerRound}`);
  const balances = await getBalances(uid);
  if (balances.COIN < nb.amount) throw new ApiError(ErrorCode.INSUFFICIENT_BALANCE);

  const roundId = r.roundId;
  const key = `stock:bet:${uid}:${requestId}`;
  const res = await withTx(async (c) => {
    const tx = await postTransactionInTx(c, {
      idempotencyKey: key,
      userId: uid,
      currency: 'COIN',
      type: 'GAME_BET',
      amount: -nb.amount,
      systemAccount: SYS.STOCK_POOL,
      gameId: 'stock_updown',
      roundId,
      description: `股票涨跌下注 ${instrument} ${nb.type}`,
    });
    if (tx.duplicated) {
      const prev = await c.query(`SELECT bet_id, bet_type, selection, amount, odds_bp FROM stock_bets WHERE idempotency_key=$1`, [key]);
      const row = prev.rows[0];
      return { duplicated: true, balance: tx.balanceAfter, betId: Number(row?.bet_id ?? 0), bet: row ? { type: row.bet_type as StockBet['type'], selection: String(row.selection), amount: Number(row.amount), oddsBp: Number(row.odds_bp) } : nb };
    }
    const ins = await c.query(
      `INSERT INTO stock_bets (round_id, user_id, bet_type, selection, amount, odds_bp, idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING bet_id`,
      [roundId, uid, nb.type, nb.selection, nb.amount, nb.oddsBp, key],
    );
    await c.query(`UPDATE stock_rounds SET total_bet = total_bet + $2 WHERE round_id=$1`, [roundId, nb.amount]);
    return { duplicated: false, balance: tx.balanceAfter, betId: Number(ins.rows[0]!.bet_id), bet: nb };
  });
  if (!res.duplicated) {
    const cur = rounds.get(instrument);
    if (cur && cur.roundId === roundId) {
      const list = cur.bets.get(uid) ?? { bets: [], total: 0 };
      list.bets.push({ ...res.bet, betId: res.betId });
      list.total += res.bet.amount;
      cur.bets.set(uid, list);
    }
    await bumpTask(uid, 'stock_bets', 'stock_updown');
    await bumpTournament(uid, 'stock_updown', 'coin_bet', res.bet.amount);
  }
  const roundTotal = rounds.get(instrument)?.roundId === roundId ? (rounds.get(instrument)!.bets.get(uid)?.total ?? 0) : res.bet.amount;
  return { roundId, instrument, duplicated: res.duplicated, bet: res.bet, roundTotal, balance: res.balance, currentPrice: current, serverTime: Date.now() };
}
