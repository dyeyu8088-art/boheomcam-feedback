/**
 * 水果机宿主：服务端 CSPRNG 结果、先结算后返回、免费旋转状态（Redis 持久化）、
 * 四档 Jackpot（按投注注入 / 服务端命中 / 命中后重置种子）、免费旋转券、审计落库。
 */
import { ApiError, ErrorCode, Ev } from '@yanbian/protocol';
import { spin, winTier } from '@yanbian/game-common/slot';
import { secureRng } from '@yanbian/game-common';
import { getRedis, loadEnv, nextId, query, withTx } from '@yanbian/server-core';
import { getBalances, postTransactionInTx, SYS } from '@yanbian/wallet';
type TxClient = Parameters<Parameters<typeof withTx>[0]>[0];
import { hub, type GameSession } from '../hub.js';
import { loadPaytable } from '../configs.js';
import { bumpExp, bumpTask, bumpTournament } from '../settlement.js';

interface FreeSpinState {
  remaining: number;
  betPerLine: number;
  lines: number;
}

type JackpotTier = 'grand' | 'major' | 'minor' | 'mini';
const TIER_ORDER: JackpotTier[] = ['grand', 'major', 'minor', 'mini'];

const freeSpins = new Map<number, FreeSpinState>();
const enteredUids = new Set<number>();
const FS_KEY = (uid: number): string => `slot:fs:${uid}`;

async function loadFreeSpins(uid: number): Promise<FreeSpinState | undefined> {
  const mem = freeSpins.get(uid);
  if (mem) return mem;
  const raw = await getRedis().get(FS_KEY(uid)).catch(() => null);
  if (!raw) return undefined;
  const fs = JSON.parse(raw) as FreeSpinState;
  freeSpins.set(uid, fs);
  return fs;
}
async function saveFreeSpins(uid: number, fs: FreeSpinState | undefined): Promise<void> {
  if (!fs || fs.remaining <= 0) {
    freeSpins.delete(uid);
    await getRedis().del(FS_KEY(uid)).catch(() => undefined);
    return;
  }
  freeSpins.set(uid, fs);
  await getRedis().set(FS_KEY(uid), JSON.stringify(fs), 'EX', 86400).catch(() => undefined);
}

async function trackOnline(): Promise<void> {
  await getRedis().set('online:game:slot_fruit', String(enteredUids.size)).catch(() => undefined);
}

export async function jackpotPools(): Promise<Record<JackpotTier, number>> {
  const r = await query(`SELECT tier, pool FROM slot_jackpots WHERE game_id='slot_fruit'`);
  const out: Record<string, number> = { grand: 0, major: 0, minor: 0, mini: 0 };
  for (const row of r.rows) out[row.tier as string] = Number(row.pool);
  return out as Record<JackpotTier, number>;
}

function broadcastJackpots(pools: Record<JackpotTier, number>, hit?: { tier: JackpotTier; amount: number; uid: number }): void {
  for (const uid of enteredUids) hub.send(uid, Ev.SlJackpot, { pools, hit });
}

/**
 * Jackpot 结算（事务内，行锁）：每档按投注比例注入；从高到低逐档掷骰，命中即派奖并重置为种子。
 * 只有一档能命中；免费旋转局不注入但可命中（投注按触发局的投注计）。
 */
async function settleJackpots(c: TxClient, uid: number, roundId: number, totalBet: number, inFree: boolean): Promise<{ pools: Record<JackpotTier, number>; hit?: { tier: JackpotTier; amount: number; roll: number } }> {
  const rows = await c.query(`SELECT tier, pool, seed, contrib_bp, hit_chance_ppm, min_bet FROM slot_jackpots WHERE game_id='slot_fruit' FOR UPDATE`);
  const byTier = new Map<string, { pool: number; seed: number; contribBp: number; ppm: number; minBet: number }>();
  for (const r of rows.rows) byTier.set(r.tier as string, { pool: Number(r.pool), seed: Number(r.seed), contribBp: Number(r.contrib_bp), ppm: Number(r.hit_chance_ppm), minBet: Number(r.min_bet) });
  let hit: { tier: JackpotTier; amount: number; roll: number } | undefined;
  for (const tier of TIER_ORDER) {
    const j = byTier.get(tier);
    if (!j) continue;
    const eligible = totalBet >= j.minBet;
    if (eligible && !inFree) j.pool += Math.floor((totalBet * j.contribBp) / 10000);
    if (eligible && !hit) {
      const roll = secureRng.int(1_000_000);
      if (roll < j.ppm) {
        hit = { tier, amount: j.pool, roll };
        j.pool = j.seed;
      }
    }
    await c.query(`UPDATE slot_jackpots SET pool=$2, updated_at=now() WHERE tier=$1`, [tier, j.pool]);
  }
  if (hit && hit.amount > 0) {
    await postTransactionInTx(c, {
      idempotencyKey: `slot:jackpot:${roundId}`,
      userId: uid,
      currency: 'COIN',
      type: 'JACKPOT_WIN',
      amount: hit.amount,
      systemAccount: SYS.JACKPOT_POOL,
      gameId: 'slot_fruit',
      roundId,
      description: `Jackpot ${hit.tier.toUpperCase()}`,
    });
    await c.query(`INSERT INTO slot_jackpot_hits (tier, user_id, round_id, amount, rng_audit) VALUES ($1,$2,$3,$4,$5)`, [hit.tier, uid, roundId, hit.amount, JSON.stringify({ roll: hit.roll, ppm: byTier.get(hit.tier)!.ppm })]);
  }
  const pools = Object.fromEntries(TIER_ORDER.map((t) => [t, byTier.get(t)?.pool ?? 0])) as Record<JackpotTier, number>;
  return { pools, hit };
}

export const slotHost = {
  async enter(session: GameSession): Promise<Record<string, unknown>> {
    const cfg = await loadPaytable();
    const balances = await getBalances(session.uid);
    enteredUids.add(session.uid);
    session.gameCode = 'slot_fruit';
    await trackOnline();
    const fs = await loadFreeSpins(session.uid);
    const tickets = await query(`SELECT qty FROM user_items WHERE user_id=$1 AND item_id='ticket_free_spin'`, [session.uid]);
    return {
      paytable: {
        paytableVersion: cfg.paytableVersion,
        columns: cfg.columns,
        rows: cfg.rows,
        lines: cfg.lines,
        pays: cfg.pays,
        wild: cfg.wild,
        scatter: cfg.scatter,
        scatterPays: cfg.scatterPays,
        freeSpins: cfg.freeSpins,
        freeSpinMultiplier: cfg.freeSpinMultiplier,
        betOptions: cfg.betOptions,
        symbolsPerReel: cfg.reels.map((r) => r.length),
      },
      balance: balances.COIN,
      freeSpinsRemaining: fs?.remaining ?? 0,
      jackpots: await jackpotPools(),
      ticketQty: Number(tickets.rows[0]?.qty ?? 0),
    };
  },

  leave(session: GameSession): void {
    enteredUids.delete(session.uid);
    if (session.gameCode === 'slot_fruit') session.gameCode = null;
    void trackOnline();
  },

  async spin(session: GameSession, data: Record<string, unknown>, requestId: string): Promise<Record<string, unknown>> {
    const cfg = await loadPaytable();
    const uid = session.uid;
    const fs = await loadFreeSpins(uid);
    const inFree = !!fs && fs.remaining > 0;
    const betPerLine = inFree ? fs.betPerLine : Number(data.betPerLine);
    const lines = inFree ? fs.lines : Math.min(Number(data.lines ?? cfg.lines.length), cfg.lines.length);
    if (!inFree) {
      if (!cfg.betOptions.includes(betPerLine)) throw new ApiError(ErrorCode.BET_OUT_OF_RANGE);
      if (!Number.isInteger(lines) || lines < 1) throw new ApiError(ErrorCode.VALIDATION);
    }
    const totalBet = betPerLine * lines;
    const roundId = nextId();
    const outcome = spin(cfg, betPerLine, lines, secureRng, inFree);

    // 先结算（单事务：扣注 + Jackpot 注入/命中 + 加奖），后返回动画数据
    const result = await withTx(async (c) => {
      let balance = 0;
      if (!inFree) {
        const bet = await postTransactionInTx(c, {
          idempotencyKey: `slot:bet:${uid}:${requestId}`,
          userId: uid,
          currency: 'COIN',
          type: 'GAME_BET',
          amount: -totalBet,
          systemAccount: SYS.SLOT_POOL,
          gameId: 'slot_fruit',
          roundId,
          description: `水果机下注 ${betPerLine}×${lines}`,
        });
        balance = bet.balanceAfter;
        if (bet.duplicated) {
          // 重复请求：直接查已存储的结果返回（不再重新旋转，不再注入 Jackpot）
          const prev = await c.query(
            `SELECT round_id, stops, win_lines, total_win, free_spins_awarded FROM slot_rounds
             WHERE user_id=$1 AND rng_audit->>'requestId'=$2 ORDER BY created_at DESC LIMIT 1`,
            [uid, requestId],
          );
          if (prev.rowCount) {
            const p = prev.rows[0]!;
            return { duplicated: true, roundId: p.round_id, stops: p.stops, winLines: p.win_lines, totalWin: p.total_win, freeSpinsAwarded: p.free_spins_awarded, balance };
          }
        }
      }
      const jp = await settleJackpots(c, uid, roundId, totalBet, inFree);
      if (outcome.totalWin > 0) {
        const win = await postTransactionInTx(c, {
          idempotencyKey: `slot:win:${roundId}`,
          userId: uid,
          currency: 'COIN',
          type: 'GAME_WIN',
          amount: outcome.totalWin,
          systemAccount: SYS.SLOT_POOL,
          gameId: 'slot_fruit',
          roundId,
          description: '水果机中奖',
        });
        balance = win.balanceAfter;
      }
      if (jp.hit || (inFree && outcome.totalWin === 0)) {
        const b = await c.query('SELECT balance FROM wallet_accounts WHERE user_id=$1 AND currency=$2', [uid, 'COIN']);
        balance = Number(b.rows[0]?.balance ?? balance);
      }
      await c.query(
        `INSERT INTO slot_rounds
          (round_id, user_id, bet_per_line, line_count, total_bet, paytable_version, stops, win_lines, scatter_count, free_spins_awarded, in_free_spin, total_win, rng_audit, server_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          roundId,
          uid,
          betPerLine,
          lines,
          inFree ? 0 : totalBet,
          cfg.paytableVersion,
          JSON.stringify(outcome.stops),
          JSON.stringify(outcome.lineWins),
          outcome.scatterCount,
          outcome.freeSpinsAwarded,
          inFree,
          outcome.totalWin,
          JSON.stringify({ algo: 'crypto.randomInt', rolls: outcome.rolls, requestId, jackpot: jp.hit ?? null }),
          loadEnv().serverId,
        ],
      );
      return { duplicated: false, balance, jackpots: jp.pools, jackpotHit: jp.hit };
    });

    if ((result as { duplicated: boolean }).duplicated) {
      const r = result as Record<string, unknown>;
      return { roundId: String(r.roundId), stops: r.stops, winLines: r.winLines, totalWin: r.totalWin, freeSpinsAwarded: r.freeSpinsAwarded, balance: r.balance, jackpots: await jackpotPools(), duplicated: true };
    }
    const res = result as { balance: number; jackpots: Record<JackpotTier, number>; jackpotHit?: { tier: JackpotTier; amount: number } };

    // 免费旋转状态机（Redis 持久化，进程重启不丢）
    if (inFree && fs) {
      fs.remaining -= 1;
      fs.remaining += outcome.freeSpinsAwarded;
      await saveFreeSpins(uid, fs);
    } else if (outcome.freeSpinsAwarded > 0) {
      await saveFreeSpins(uid, { remaining: outcome.freeSpinsAwarded, betPerLine, lines });
    }
    await bumpTask(uid, 'slot_spins', 'slot_fruit');
    await bumpExp(uid, 2 + Math.floor(totalBet / 200));
    const totalWon = outcome.totalWin + (res.jackpotHit?.amount ?? 0);
    if (totalWon > 0) {
      await bumpTournament(uid, 'slot_fruit', 'slot_win', totalWon);
      await bumpTournament(uid, 'slot_fruit', 'coin_win', totalWon);
    }
    broadcastJackpots(res.jackpots, res.jackpotHit ? { ...res.jackpotHit, uid } : undefined);

    return {
      roundId: String(roundId),
      stops: outcome.stops,
      grid: outcome.grid,
      winLines: outcome.lineWins,
      scatterCount: outcome.scatterCount,
      scatterWin: outcome.scatterWin,
      freeSpinsAwarded: outcome.freeSpinsAwarded,
      freeSpinsRemaining: freeSpins.get(uid)?.remaining ?? 0,
      inFreeSpin: inFree,
      totalWin: outcome.totalWin,
      totalBet,
      tier: winTier(outcome.totalWin, totalBet),
      balance: res.balance,
      jackpots: res.jackpots,
      jackpotHit: res.jackpotHit,
    };
  },

  /** 免费旋转券：消耗背包道具 ticket_free_spin（幂等），按当前投注档发放免费局 */
  async useTicket(session: GameSession, data: Record<string, unknown>, requestId: string): Promise<Record<string, unknown>> {
    const cfg = await loadPaytable();
    const uid = session.uid;
    const betPerLine = Number(data.betPerLine);
    if (!cfg.betOptions.includes(betPerLine)) throw new ApiError(ErrorCode.BET_OUT_OF_RANGE);
    const key = `slot:ticket:${uid}:${requestId}`;
    const r = await withTx(async (c) => {
      const dup = await c.query('SELECT 1 FROM user_item_logs WHERE idempotency_key=$1', [key]);
      if (dup.rowCount) return { duplicated: true, qty: 0 };
      const used = await c.query(`UPDATE user_items SET qty = qty - 1, updated_at = now() WHERE user_id=$1 AND item_id='ticket_free_spin' AND qty > 0 RETURNING qty`, [uid]);
      if (!used.rowCount) throw new ApiError(ErrorCode.NOT_FOUND, '没有免费旋转券');
      await c.query(`INSERT INTO user_item_logs (user_id, item_id, delta, reason, ref_id, idempotency_key) VALUES ($1,'ticket_free_spin',-1,'slot_ticket',$2,$3)`, [uid, requestId, key]);
      const meta = await c.query(`SELECT meta FROM items WHERE item_id='ticket_free_spin'`);
      return { duplicated: false, qty: Number(used.rows[0]!.qty), spins: Number((meta.rows[0]?.meta as { spins?: number })?.spins ?? 5) };
    });
    if (r.duplicated) {
      const fs = await loadFreeSpins(uid);
      return { freeSpinsRemaining: fs?.remaining ?? 0, duplicated: true };
    }
    const cur = (await loadFreeSpins(uid)) ?? { remaining: 0, betPerLine, lines: cfg.lines.length };
    cur.remaining += r.spins ?? 5;
    if (cur.remaining === (r.spins ?? 5)) {
      cur.betPerLine = betPerLine;
      cur.lines = cfg.lines.length;
    }
    await saveFreeSpins(uid, cur);
    return { freeSpinsRemaining: cur.remaining, ticketQty: r.qty, duplicated: false };
  },

  async history(session: GameSession): Promise<Record<string, unknown>> {
    const r = await query(
      `SELECT round_id, bet_per_line, line_count, total_bet, total_win, in_free_spin, created_at
       FROM slot_rounds WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`,
      [session.uid],
    );
    return { items: r.rows };
  },
};
