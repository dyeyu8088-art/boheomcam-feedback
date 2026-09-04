/** 红十宿主：HongshiTable ↔ 房间/WS（结构与麻将宿主一致） */
import { ApiError, ErrorCode, Ev } from '@yanbian/protocol';
import { HongshiTable, type HongshiRuleConfig } from '@yanbian/game-common/hongshi';
import { secureRng } from '@yanbian/game-common';
import { getLogger, nextId } from '@yanbian/server-core';
import { getBalances } from '@yanbian/wallet';
import type { GameHost, Room } from '../room.js';
import { roomManager } from '../room.js';
import { loadHongshiRule } from '../configs.js';
import { persistRoundEnd, persistRoundStart, type PlayerRoundOutcome } from '../settlement.js';

const log = getLogger('hongshi');

interface HsState {
  table: HongshiTable | null;
  rule: HongshiRuleConfig | null;
  roundId: number;
  flushed: number;
  timer: NodeJS.Timeout | null;
  botTimer: NodeJS.Timeout | null;
  roundsPlayed: number;
  lastWinnerSeat: number | null;
  deadlineAt: number;
  settling: boolean;
}

function st(room: Room): HsState {
  if (!room.hostState.hs) {
    room.hostState.hs = {
      table: null,
      rule: null,
      roundId: 0,
      flushed: 0,
      timer: null,
      botTimer: null,
      roundsPlayed: 0,
      lastWinnerSeat: null,
      deadlineAt: 0,
      settling: false,
    } satisfies HsState;
  }
  return room.hostState.hs as HsState;
}

function clearTimers(s: HsState): void {
  if (s.timer) clearTimeout(s.timer);
  if (s.botTimer) clearTimeout(s.botTimer);
  s.timer = null;
  s.botTimer = null;
}

export class HongshiHost implements GameHost {
  start(room: Room): void {
    void this.startRound(room);
  }

  private async startRound(room: Room): Promise<void> {
    const s = st(room);
    const rule = await loadHongshiRule();
    s.rule = rule;
    room.state = 'playing';
    room.currentRound = s.roundsPlayed + 1;
    s.roundId = nextId();
    s.flushed = 0;
    s.settling = false;
    const seats = room.players.map((p) => p.seat);
    const table = new HongshiTable(rule, seats, s.lastWinnerSeat, room.stage.baseScore, secureRng);
    s.table = table;
    await persistRoundStart(room, s.roundId, { rule: rule.ruleVersion, baseScore: room.stage.baseScore });
    room.broadcast(Ev.RoomGameStart, {
      roundId: String(s.roundId),
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      ruleVersion: rule.ruleVersion,
    });
    table.start();
    this.flush(room);
    log.info({ roomId: room.roomId, roundId: s.roundId }, 'hongshi round started');
  }

  private flush(room: Room): void {
    const s = st(room);
    const table = s.table;
    if (!table) return;
    while (s.flushed < table.events.length) {
      const e = table.events[s.flushed]!;
      s.flushed += 1;
      switch (e.type) {
        case 'deal':
          room.sendSeat(e.seat, Ev.HsDeal, { seat: e.seat, cards: e.data.cards });
          break;
        case 'turn':
          s.deadlineAt = Date.now() + (s.rule?.timing.turnSeconds ?? 15) * 1000;
          room.broadcast(Ev.HsTurn, { ...e.data, deadlineAt: s.deadlineAt });
          break;
        case 'play':
          room.broadcast(Ev.HsPlayed, e.data);
          break;
        case 'pass':
          room.broadcast(Ev.HsPass, e.data);
          break;
        case 'identityReveal':
          room.broadcast(Ev.HsIdentityReveal, e.data);
          break;
        case 'finish':
          room.broadcast('hongshi.finish', e.data);
          break;
        case 'newTrick':
          room.broadcast('hongshi.newTrick', e.data);
          break;
        case 'roundEnd':
          void this.finishRound(room);
          return;
        default:
          room.broadcast(`hongshi.${e.type}`, e.data);
      }
    }
    this.armTimers(room);
  }

  private armTimers(room: Room): void {
    const s = st(room);
    const table = s.table;
    if (!table || table.phase !== 'playing') return;
    clearTimers(s);
    const actor = room.playerBySeat(table.turnSeat);
    const isAuto = !actor || actor.isBot || actor.trustee || !actor.online;
    if (isAuto) {
      s.botTimer = setTimeout(() => {
        try {
          table.autoAct(table.turnSeat);
          this.flush(room);
        } catch (e) {
          log.error({ err: (e as Error).message }, 'hongshi bot act failed');
        }
      }, 700 + Math.floor(Math.random() * 900));
    }
    s.timer = setTimeout(() => {
      const p = room.playerBySeat(table.turnSeat);
      if (p && !p.isBot) {
        p.trustee = true;
        room.broadcast(Ev.GameTrustee, { seat: p.seat, trustee: true, reason: 'timeout' });
      }
      try {
        table.autoAct(table.turnSeat);
        this.flush(room);
      } catch (e) {
        log.error({ err: (e as Error).message }, 'hongshi timeout act failed');
      }
    }, (s.rule?.timing.turnSeconds ?? 15) * 1000 + 500);
  }

  onAction(room: Room, uid: number, event: string, data: Record<string, unknown>): void {
    const s = st(room);
    const table = s.table;
    const player = room.playerByUid(uid);
    if (!table || !player) throw new ApiError(ErrorCode.GAME_NOT_RUNNING);
    if (player.trustee && event !== 'game.trustee' && event !== 'hongshi.hint') {
      player.trustee = false;
      room.broadcast(Ev.GameTrustee, { seat: player.seat, trustee: false });
    }
    switch (event) {
      case Ev.HsPlay: {
        const cards = data.cards as number[];
        if (!Array.isArray(cards) || cards.length === 0 || cards.length > 20 || cards.some((c) => !Number.isInteger(c))) {
          throw new ApiError(ErrorCode.VALIDATION);
        }
        table.play(player.seat, cards);
        break;
      }
      case Ev.HsPass:
        table.pass(player.seat);
        break;
      case Ev.HsHint: {
        const hint = table.hint(player.seat);
        room.sendSeat(player.seat, Ev.HsHint, { cards: hint });
        return;
      }
      case 'game.trustee':
        player.trustee = !!data.on;
        room.broadcast(Ev.GameTrustee, { seat: player.seat, trustee: player.trustee });
        break;
      default:
        throw new ApiError(ErrorCode.INVALID_ACTION, `unknown hongshi event ${event}`);
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
    const outcomes: PlayerRoundOutcome[] = [];
    for (const p of room.players) {
      const scoreChange = result.scoreChanges[p.seat] ?? 0;
      let coinChange = scoreChange;
      if (!p.isBot && coinChange < 0) {
        const bal = await getBalances(p.uid);
        coinChange = -Math.min(-coinChange, bal.COIN);
      }
      p.score += scoreChange;
      const rank = result.ranks.find((r) => r.seat === p.seat)?.rank ?? 4;
      outcomes.push({
        uid: p.uid,
        seat: p.seat,
        scoreChange,
        coinChange,
        isBot: p.isBot,
        isWin: rank === 1,
        detail: { rank, solo: result.solo, multiplier: result.multiplier, stage: room.stage.stageId },
      });
    }
    const { balances } = await persistRoundEnd(
      room,
      s.roundId,
      table.events,
      { ranks: result.ranks, teams: result.teams, solo: result.solo, multiplier: result.multiplier },
      outcomes,
    );
    s.lastWinnerSeat = result.ranks.find((r) => r.rank === 1)?.seat ?? null;
    room.broadcast(Ev.HsRoundEnd, {
      roundId: String(s.roundId),
      result,
      hands: room.players.map((p) => ({ seat: p.seat, cards: table.p(p.seat).hand })),
      balances,
      totals: room.players.map((p) => ({ seat: p.seat, score: p.score })),
    });
    s.roundsPlayed += 1;
    s.table = null;
    if (s.roundsPlayed >= room.totalRounds) {
      room.broadcast(Ev.GameMatchOver, {
        totals: room.players.map((p) => ({ seat: p.seat, uid: p.uid, nickname: p.nickname, score: p.score })),
        rounds: s.roundsPlayed,
      });
      setTimeout(() => void roomManager.destroyRoom(room, 'finished'), 8000);
      return;
    }
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

export const hongshiHost = new HongshiHost();
