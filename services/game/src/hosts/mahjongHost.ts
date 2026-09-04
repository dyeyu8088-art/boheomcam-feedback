/**
 * 延边麻将宿主：MahjongTable(纯逻辑) ↔ 房间/WS。
 * 服务端权威：动作合法性/优先级仲裁/胡牌/结算全部在 table + 本宿主完成。
 * 最小信息原则：手牌/摸牌只发本人；他人仅计数。
 */
import { ApiError, ErrorCode, Ev } from '@yanbian/protocol';
import {
  MahjongTable,
  type ClaimChoice,
  type MahjongRuleConfig,
} from '@yanbian/game-common/mahjong';
import { secureRng } from '@yanbian/game-common';
import { getLogger, nextId } from '@yanbian/server-core';
import { getBalances } from '@yanbian/wallet';
import type { GameHost, Room } from '../room.js';
import { roomManager } from '../room.js';
import { loadMahjongRule } from '../configs.js';
import { persistRoundEnd, persistRoundStart, type PlayerRoundOutcome } from '../settlement.js';

const log = getLogger('mahjong');

interface MjState {
  table: MahjongTable | null;
  rule: MahjongRuleConfig | null;
  roundId: number;
  flushed: number;
  timer: NodeJS.Timeout | null;
  botTimer: NodeJS.Timeout | null;
  dealerSeat: number;
  roundsPlayed: number;
  deadlineAt: number;
  settling: boolean;
}

function st(room: Room): MjState {
  if (!room.hostState.mj) {
    room.hostState.mj = {
      table: null,
      rule: null,
      roundId: 0,
      flushed: 0,
      timer: null,
      botTimer: null,
      dealerSeat: 0,
      roundsPlayed: 0,
      deadlineAt: 0,
      settling: false,
    } satisfies MjState;
  }
  return room.hostState.mj as MjState;
}

function clearTimers(s: MjState): void {
  if (s.timer) clearTimeout(s.timer);
  if (s.botTimer) clearTimeout(s.botTimer);
  s.timer = null;
  s.botTimer = null;
}

export class MahjongHost implements GameHost {
  start(room: Room): void {
    void this.startRound(room);
  }

  private async startRound(room: Room): Promise<void> {
    const s = st(room);
    const rule = await loadMahjongRule();
    s.rule = rule;
    room.state = 'playing';
    room.currentRound = s.roundsPlayed + 1;
    s.roundId = nextId();
    s.flushed = 0;
    s.settling = false;
    const seats = room.players.map((p) => p.seat);
    if (s.roundsPlayed === 0) {
      s.dealerSeat = seats[Math.floor(Math.random() * seats.length)]!;
    }
    const table = new MahjongTable(rule, seats, s.dealerSeat, room.stage.baseScore, secureRng);
    s.table = table;
    await persistRoundStart(room, s.roundId, { rule: rule.ruleVersion, dealerSeat: s.dealerSeat, baseScore: room.stage.baseScore });
    room.broadcast(Ev.RoomGameStart, {
      roundId: String(s.roundId),
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      dealerSeat: s.dealerSeat,
      ruleVersion: rule.ruleVersion,
    });
    table.start();
    this.flush(room);
    log.info({ roomId: room.roomId, roundId: s.roundId, round: room.currentRound }, 'mahjong round started');
  }

  /** 把 table 新增事件转成 WS 推送 */
  private flush(room: Room): void {
    const s = st(room);
    const table = s.table;
    if (!table) return;
    while (s.flushed < table.events.length) {
      const e = table.events[s.flushed]!;
      s.flushed += 1;
      switch (e.type) {
        case 'deal':
          room.sendSeat(e.seat, Ev.MjDeal, { seat: e.seat, tiles: e.data.tiles, dealerSeat: table.dealerSeat });
          break;
        case 'draw':
          room.sendSeat(e.seat, Ev.MjDraw, { seat: e.seat, tile: e.data.tile, wallLeft: e.data.wallLeft, replacement: !!e.data.replacement });
          break;
        case 'drawPublic':
          for (const p of room.players) {
            if (p.seat !== e.data.seat) room.sendSeat(p.seat, Ev.MjDrawPublic, e.data);
          }
          break;
        case 'discard':
          room.broadcast(Ev.MjDiscarded, e.data);
          break;
        case 'meld':
          room.broadcast(Ev.MjMeld, e.data);
          break;
        case 'ting':
          room.broadcast(Ev.MjTingInfo, e.data);
          break;
        case 'gangScore':
          room.broadcast('mahjong.gangScore', e.data);
          break;
        case 'actionAsk':
          room.sendSeat(e.seat, Ev.MjActionAsk, { ...e.data, deadlineMs: (s.rule?.timing.claimSeconds ?? 5) * 1000 });
          break;
        case 'turn':
          s.deadlineAt = Date.now() + (s.rule?.timing.turnSeconds ?? 15) * 1000;
          room.broadcast(Ev.MjTurn, { ...e.data, deadlineAt: s.deadlineAt });
          break;
        case 'claimResponse':
          break;
        case 'roundEnd':
          void this.finishRound(room);
          return;
        default:
          room.broadcast(`mahjong.${e.type}`, e.data);
      }
    }
    this.armTimers(room);
  }

  /** 阶段计时 + 机器人/托管调度 */
  private armTimers(room: Room): void {
    const s = st(room);
    const table = s.table;
    if (!table || table.phase === 'finished') return;
    clearTimers(s);

    if (table.phase === 'turn') {
      const actor = room.playerBySeat(table.turnSeat);
      const isAuto = !actor || actor.isBot || actor.trustee || !actor.online;
      if (isAuto) {
        s.botTimer = setTimeout(() => {
          try {
            table.autoActTurn(table.turnSeat);
            this.flush(room);
          } catch (e) {
            log.error({ roomId: room.roomId, err: (e as Error).message }, 'bot turn failed');
          }
        }, 700 + Math.floor(Math.random() * 900));
      }
      s.timer = setTimeout(() => {
        const p = room.playerBySeat(table.turnSeat);
        if (p && !p.isBot && (s.rule?.timing.timeoutPolicy ?? 'autoDiscardTrustee') === 'autoDiscardTrustee') {
          p.trustee = true;
          room.broadcast(Ev.GameTrustee, { seat: p.seat, trustee: true, reason: 'timeout' });
        }
        try {
          table.autoActTurn(table.turnSeat);
          this.flush(room);
        } catch (e) {
          log.error({ roomId: room.roomId, err: (e as Error).message }, 'turn timeout act failed');
        }
      }, (s.rule?.timing.turnSeconds ?? 15) * 1000 + 500);
      return;
    }

    if (table.phase === 'claiming') {
      // 托管与机器人立即代答
      s.botTimer = setTimeout(() => {
        for (const c of [...table.claims]) {
          if (c.responded) continue;
          const p = room.playerBySeat(c.seat);
          if (!p || p.isBot || p.trustee || !p.online) {
            try {
              table.autoRespond(c.seat);
            } catch (e) {
              log.error({ err: (e as Error).message }, 'auto respond failed');
            }
          }
        }
        this.flush(room);
      }, 500 + Math.floor(Math.random() * 600));
      s.timer = setTimeout(() => {
        try {
          table.timeoutClaims();
          this.flush(room);
        } catch (e) {
          log.error({ err: (e as Error).message }, 'claim timeout failed');
        }
      }, (s.rule?.timing.claimSeconds ?? 5) * 1000 + 500);
    }
  }

  onAction(room: Room, uid: number, event: string, data: Record<string, unknown>): void {
    const s = st(room);
    const table = s.table;
    const player = room.playerByUid(uid);
    if (!table || !player) throw new ApiError(ErrorCode.GAME_NOT_RUNNING);
    // 只读查询（客户端每回合自动请求可选动作）不算手动操作，否则挂机玩家每回合都会被解除托管、全桌等满 15 s
    if (player.trustee && event !== 'game.trustee' && event !== 'mahjong.options') {
      // 玩家手动操作 → 解除托管
      player.trustee = false;
      room.broadcast(Ev.GameTrustee, { seat: player.seat, trustee: false });
    }
    switch (event) {
      case Ev.MjDiscard: {
        const tile = Number(data.tile);
        if (!Number.isInteger(tile)) throw new ApiError(ErrorCode.VALIDATION);
        table.discard(player.seat, tile);
        break;
      }
      case 'mahjong.ting': {
        const tile = Number(data.tile);
        if (!Number.isInteger(tile)) throw new ApiError(ErrorCode.VALIDATION);
        table.declareTing(player.seat, tile);
        break;
      }
      case Ev.MjAction: {
        const action = String(data.action);
        if (table.phase === 'turn' && table.turnSeat === player.seat) {
          if (action === 'hu') table.huSelf(player.seat);
          else if (action === 'gang') {
            const kind = Number(data.kind);
            const gtype = data.gtype === 'bugang' ? 'bugang' : 'angang';
            table.gangSelf(player.seat, kind, gtype);
          } else throw new ApiError(ErrorCode.INVALID_ACTION);
        } else {
          const choice: ClaimChoice =
            action === 'pass'
              ? { action: 'pass' }
              : action === 'hu'
                ? { action: 'hu' }
                : action === 'peng'
                  ? { action: 'peng' }
                  : action === 'gang'
                    ? { action: 'gang' }
                    : action === 'chi'
                      ? { action: 'chi', kinds: (data.kinds as number[]) ?? [] }
                      : (() => {
                          throw new ApiError(ErrorCode.INVALID_ACTION);
                        })();
          table.respondClaim(player.seat, choice);
        }
        break;
      }
      case 'game.trustee': {
        player.trustee = !!data.on;
        room.broadcast(Ev.GameTrustee, { seat: player.seat, trustee: player.trustee });
        break;
      }
      case 'mahjong.options': {
        // 客户端请求当前可用自动作（胡/杠/听）
        const opts = table.selfOptions(player.seat);
        room.sendSeat(player.seat, 'mahjong.options', opts as unknown as Record<string, unknown>);
        return;
      }
      default:
        throw new ApiError(ErrorCode.INVALID_ACTION, `unknown mahjong event ${event}`);
    }
    this.flush(room);
  }

  private async finishRound(room: Room): Promise<void> {
    const s = st(room);
    const table = s.table;
    if (!table || !table.result || s.settling) return;
    s.settling = true;
    clearTimers(s);
    const result = table.result;
    room.state = 'settling';

    // 输赢封顶：真实玩家亏损不超过其余额（破产保护）；赢家不受影响（差额由系统池吸收）
    const outcomes: PlayerRoundOutcome[] = [];
    for (const p of room.players) {
      const scoreChange = result.scoreChanges[p.seat] ?? 0;
      let coinChange = scoreChange;
      if (!p.isBot && coinChange < 0) {
        const bal = await getBalances(p.uid);
        coinChange = -Math.min(-coinChange, bal.COIN);
      }
      p.score += scoreChange;
      outcomes.push({
        uid: p.uid,
        seat: p.seat,
        scoreChange,
        coinChange,
        isBot: p.isBot,
        isWin: result.winners.some((w) => w.seat === p.seat),
        detail: {
          winners: result.winners.filter((w) => w.seat === p.seat),
          isDraw: result.isDraw,
          stage: room.stage.stageId,
        },
      });
    }
    const { balances } = await persistRoundEnd(
      room,
      s.roundId,
      table.events,
      { winners: result.winners, isDraw: result.isDraw, loserSeat: result.loserSeat, scoreChanges: result.scoreChanges },
      outcomes,
    );

    room.broadcast(Ev.MjRoundEnd, {
      roundId: String(s.roundId),
      result: {
        winners: result.winners,
        loserSeat: result.loserSeat,
        isDraw: result.isDraw,
        scoreChanges: result.scoreChanges,
        tingSeats: result.tingSeats,
      },
      // 结算亮牌：行业惯例，局末公开各家手牌
      hands: room.players.map((p) => ({ seat: p.seat, tiles: table.p(p.seat).hand })),
      balances,
      totals: room.players.map((p) => ({ seat: p.seat, score: p.score })),
    });

    s.roundsPlayed += 1;
    // 对局中离开的玩家：本局已结算，此处由机器人接替；全员离开则直接散桌
    if (roomManager.settleLeavers(room)) {
      s.table = null;
      setTimeout(() => void roomManager.destroyRoom(room, 'empty'), 1500);
      return;
    }
    // 轮庄
    if (s.rule) {
      if (result.winners.length > 0) {
        s.dealerSeat = s.rule.dealer.rotation === 'winner' ? result.winners[0]!.seat : table.nextSeat(s.dealerSeat);
      } else if (!s.rule.draw.dealerKeepOnDraw) {
        s.dealerSeat = table.nextSeat(s.dealerSeat);
      }
    }
    s.table = null;

    if (s.roundsPlayed >= room.totalRounds) {
      room.broadcast(Ev.GameMatchOver, {
        totals: room.players.map((p) => ({ seat: p.seat, uid: p.uid, nickname: p.nickname, score: p.score })),
        rounds: s.roundsPlayed,
      });
      setTimeout(() => void roomManager.destroyRoom(room, 'finished'), 8000);
      return;
    }
    // 下一局
    room.state = 'playing';
    setTimeout(() => {
      if (roomManager.rooms.has(room.roomId)) void this.startRound(room);
    }, 6000);
  }

  syncFor(room: Room, uid: number): Record<string, unknown> | null {
    const s = st(room);
    const player = room.playerByUid(uid);
    if (!player) return null;
    return {
      room: room.info(),
      mySeat: player.seat,
      game: s.table ? s.table.viewFor(player.seat) : null,
      deadlineAt: s.deadlineAt,
      roundId: String(s.roundId),
    };
  }

  onOffline(room: Room, uid: number): void {
    const p = room.playerByUid(uid);
    if (!p) return;
    p.online = false;
    if (room.state === 'playing') {
      p.trustee = true;
      room.broadcast(Ev.GameTrustee, { seat: p.seat, trustee: true, reason: 'offline' });
    }
    room.broadcast(Ev.RoomPlayerOffline, { seat: p.seat, uid });
    this.armTimers(room);
  }

  onReconnect(room: Room, uid: number): void {
    const p = room.playerByUid(uid);
    if (!p) return;
    p.online = true;
    p.trustee = false;
    room.broadcast(Ev.RoomPlayerReconnect, { seat: p.seat, uid });
  }

  dispose(room: Room): void {
    clearTimers(st(room));
  }
}

export const mahjongHost = new MahjongHost();
