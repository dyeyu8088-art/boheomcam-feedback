/**
 * 水果机宿主：服务端 CSPRNG 结果、先结算后返回、免费旋转状态、审计落库。
 */
import { ApiError, ErrorCode } from '@yanbian/protocol';
import { spin, winTier } from '@yanbian/game-common/slot';
import { secureRng } from '@yanbian/game-common';
import { getRedis, loadEnv, nextId, query, withTx } from '@yanbian/server-core';
import { getBalances, postTransactionInTx, SYS } from '@yanbian/wallet';
import type { GameSession } from '../hub.js';
import { loadPaytable } from '../configs.js';
import { bumpTask } from '../settlement.js';

interface FreeSpinState {
  remaining: number;
  betPerLine: number;
  lines: number;
}

const freeSpins = new Map<number, FreeSpinState>();
const enteredUids = new Set<number>();

async function trackOnline(): Promise<void> {
  await getRedis().set('online:game:slot_fruit', String(enteredUids.size)).catch(() => undefined);
}

export const slotHost = {
  async enter(session: GameSession): Promise<Record<string, unknown>> {
    const cfg = await loadPaytable();
    const balances = await getBalances(session.uid);
    enteredUids.add(session.uid);
    session.gameCode = 'slot_fruit';
    await trackOnline();
    const fs = freeSpins.get(session.uid);
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
    const fs = freeSpins.get(uid);
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

    // 先结算（单事务：扣注 + 加奖），后返回动画数据
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
          // 重复请求：直接查已存储的结果返回（不再重新旋转）
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
      } else if (inFree) {
        balance = (await getBalances(uid)).COIN;
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
          JSON.stringify({ algo: 'crypto.randomInt', rolls: outcome.rolls, requestId }),
          loadEnv().serverId,
        ],
      );
      return { duplicated: false, balance };
    });

    if ((result as { duplicated: boolean }).duplicated) {
      const r = result as Record<string, unknown>;
      return { roundId: String(r.roundId), stops: r.stops, winLines: r.winLines, totalWin: r.totalWin, freeSpinsAwarded: r.freeSpinsAwarded, balance: r.balance, duplicated: true };
    }

    // 免费旋转状态机
    if (inFree) {
      fs!.remaining -= 1;
      fs!.remaining += outcome.freeSpinsAwarded; // retrigger（免费局内 awarded=0，规则可改）
      if (fs!.remaining <= 0) freeSpins.delete(uid);
    } else if (outcome.freeSpinsAwarded > 0) {
      freeSpins.set(uid, { remaining: outcome.freeSpinsAwarded, betPerLine, lines });
    }
    await bumpTask(uid, 'slot_spins', 'slot_fruit');

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
      balance: (result as { balance: number }).balance,
    };
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
