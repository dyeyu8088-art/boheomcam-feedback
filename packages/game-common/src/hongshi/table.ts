/**
 * 红十桌状态机（单局）。纯逻辑无 I/O；宿主负责计时与广播。
 * 服务端权威：洗牌/发牌/身份/轮转/合法性/胜负/积分全部在此判定。
 */
import { buildDeck, type Card } from './cards.js';
import { beats, findHint, parseCombo, type HsCombo } from './combos.js';
import type { HongshiRuleConfig } from './config.js';
import { shuffle, type Rng } from '../rng.js';

export type HsPhase = 'init' | 'playing' | 'finished';

export interface HsPlayer {
  seat: number;
  hand: Card[];
  trustee: boolean;
  finishRank: number | null; // 1=头游
  identityRevealed: boolean;
}

export interface HsEvent {
  seq: number;
  type: string;
  seat: number; // -1 广播
  data: Record<string, unknown>;
}

export interface HsRoundResult {
  ranks: { seat: number; rank: number }[];
  teams: { seats: number[]; isRedTeam: boolean; points: number }[];
  solo: boolean;
  multiplier: number;
  scoreChanges: Record<number, number>;
  detail: Record<string, unknown>;
}

export class HongshiTable {
  readonly cfg: HongshiRuleConfig;
  readonly seats: number[];
  readonly baseScore: number;
  players = new Map<number, HsPlayer>();
  phase: HsPhase = 'init';
  turnSeat = -1;
  /** 当前需要压制的牌（null=任意起手） */
  tableCombo: HsCombo | null = null;
  tableComboSeat = -1;
  passCount = 0;
  events: HsEvent[] = [];
  result: HsRoundResult | null = null;
  redSeats: number[] = [];
  private finishOrder: number[] = [];
  private seq = 0;

  constructor(cfg: HongshiRuleConfig, seats: number[], firstSeat: number | null, baseScore: number, rng: Rng) {
    if (!cfg.playerCounts.includes(seats.length)) throw new Error(`config does not allow ${seats.length} players`);
    this.cfg = cfg;
    this.seats = [...seats];
    this.baseScore = baseScore;
    const deck = shuffle(buildDeck(cfg.deckCount), rng);
    const per = deck.length / seats.length;
    for (let i = 0; i < seats.length; i += 1) {
      const hand = deck.slice(i * per, (i + 1) * per).sort((a, b) => a - b);
      this.players.set(seats[i]!, { seat: seats[i]!, hand, trustee: false, finishRank: null, identityRevealed: false });
    }
    for (const s of seats) {
      const pl = this.players.get(s)!;
      if (pl.hand.some((c) => cfg.identityCards.includes(c))) this.redSeats.push(s);
    }
    this.turnSeat = firstSeat ?? seats[rng.int(seats.length)]!;
  }

  private emit(type: string, seat: number, data: Record<string, unknown>): void {
    this.seq += 1;
    this.events.push({ seq: this.seq, type, seat, data });
  }

  p(seat: number): HsPlayer {
    const pl = this.players.get(seat);
    if (!pl) throw new Error(`no player at seat ${seat}`);
    return pl;
  }

  start(): void {
    if (this.phase !== 'init') throw new Error('already started');
    this.phase = 'playing';
    for (const s of this.seats) this.emit('deal', s, { cards: [...this.p(s).hand] });
    if (this.cfg.identityReveal === 'open') {
      for (const s of this.redSeats) this.p(s).identityRevealed = true;
      this.emit('identityReveal', -1, { seats: [...this.redSeats], mode: 'open' });
    }
    this.emit('turn', -1, { seat: this.turnSeat, lead: true });
  }

  /** 出牌 */
  play(seat: number, cards: Card[]): void {
    this.assertTurn(seat);
    const pl = this.p(seat);
    for (const c of cards) if (!pl.hand.includes(c)) throw new Error('INVALID_ACTION:card not in hand');
    if (new Set(cards).size !== cards.length) throw new Error('INVALID_ACTION:duplicate cards');
    const combo = parseCombo(cards, this.cfg);
    if (!combo) throw new Error('INVALID_ACTION:not a valid combo');
    if (this.tableCombo && !beats(this.tableCombo, combo, this.cfg)) {
      throw new Error('INVALID_ACTION:cannot beat table combo');
    }
    pl.hand = pl.hand.filter((c) => !cards.includes(c));
    this.tableCombo = combo;
    this.tableComboSeat = seat;
    this.passCount = 0;
    // 红十亮明
    const playedIdentity = cards.filter((c) => this.cfg.identityCards.includes(c));
    if (playedIdentity.length > 0 && !pl.identityRevealed) {
      pl.identityRevealed = true;
      this.emit('identityReveal', -1, { seats: [seat], mode: 'played', cards: playedIdentity });
    }
    this.emit('play', -1, { seat, cards, comboType: combo.type, handLeft: pl.hand.length });
    if (pl.hand.length === 0) {
      this.finishOrder.push(seat);
      pl.finishRank = this.finishOrder.length;
      this.emit('finish', -1, { seat, rank: pl.finishRank });
      if (this.finishOrder.length >= this.seats.length - 1) {
        this.finishRound();
        return;
      }
    }
    this.advance();
  }

  /** 过 */
  pass(seat: number): void {
    this.assertTurn(seat);
    if (this.tableCombo === null) throw new Error('INVALID_ACTION:leader must play');
    if (this.cfg.mustBeat) {
      const hint = findHint(this.p(seat).hand, this.tableCombo, this.cfg);
      if (hint) throw new Error('INVALID_ACTION:must beat when able');
    }
    this.passCount += 1;
    this.emit('pass', -1, { seat });
    this.advance();
  }

  /** 提示 */
  hint(seat: number): Card[] | null {
    return findHint(this.p(seat).hand, this.tableCombo, this.cfg);
  }

  /** 托管自动行动：能压则出提示牌，否则过；起手出最小 */
  autoAct(seat: number): void {
    if (this.phase !== 'playing' || this.turnSeat !== seat) return;
    const h = this.hint(seat);
    if (h) this.play(seat, h);
    else this.pass(seat);
  }

  private assertTurn(seat: number): void {
    if (this.phase !== 'playing') throw new Error('INVALID_ACTION:not playing');
    if (this.turnSeat !== seat) throw new Error('NOT_YOUR_TURN');
  }

  private nextActiveSeat(from: number): number {
    let s = from;
    do {
      const idx = this.seats.indexOf(s);
      s = this.seats[(idx + 1) % this.seats.length]!;
    } while (this.p(s).finishRank !== null && s !== from);
    return s;
  }

  private advance(): void {
    let next = this.nextActiveSeat(this.turnSeat);
    // 一轮全过（或其余人已出完）→ 桌面清空，最后出牌者（或其接班人）任意起手
    const activeOthers = this.seats.filter((s) => s !== this.tableComboSeat && this.p(s).finishRank === null).length;
    if (this.tableCombo !== null && (this.passCount >= activeOthers || next === this.tableComboSeat)) {
      this.tableCombo = null;
      this.passCount = 0;
      next = this.p(this.tableComboSeat).finishRank === null ? this.tableComboSeat : this.nextActiveSeat(this.tableComboSeat);
      this.emit('newTrick', -1, { seat: next });
    }
    this.turnSeat = next;
    this.emit('turn', -1, { seat: next, lead: this.tableCombo === null });
  }

  private finishRound(): void {
    // 最后一名补上
    for (const s of this.seats) {
      if (this.p(s).finishRank === null) {
        this.finishOrder.push(s);
        this.p(s).finishRank = this.finishOrder.length;
      }
    }
    const solo = this.redSeats.length === 1 || (this.cfg.soloWhenAll && new Set(this.redSeats).size === 1);
    const redTeam = [...new Set(this.redSeats)];
    const blueTeam = this.seats.filter((s) => !redTeam.includes(s));
    const pointsOf = (seat: number) => this.cfg.score.rankPoints[this.p(seat).finishRank! - 1] ?? 0;
    const redPoints = redTeam.reduce((a, s) => a + pointsOf(s), 0);
    const bluePoints = blueTeam.reduce((a, s) => a + pointsOf(s), 0);

    let multiplier = 1;
    // 双上：队友包揽 1、2 游
    const ranksOf = (team: number[]) => team.map((s) => this.p(s).finishRank!).sort((a, b) => a - b);
    const redRanks = ranksOf(redTeam);
    const blueRanks = ranksOf(blueTeam);
    if (redTeam.length === 2 && redRanks[0] === 1 && redRanks[1] === 2) multiplier *= this.cfg.score.doubleWinMultiplier;
    if (blueTeam.length === 2 && blueRanks[0] === 1 && blueRanks[1] === 2) multiplier *= this.cfg.score.doubleWinMultiplier;
    if (solo) multiplier *= this.cfg.score.soloWinMultiplier;
    multiplier = Math.min(multiplier, this.cfg.score.maxMultiplier);

    const scoreChanges: Record<number, number> = {};
    // 零和：红队每人得 redPoints × base × mult / 人数均摊？—— 采用直接名次分零和，再按队伍倍率放大
    for (const s of this.seats) {
      const teamPts = redTeam.includes(s) ? redPoints : bluePoints;
      const size = redTeam.includes(s) ? redTeam.length : blueTeam.length;
      scoreChanges[s] = Math.round((teamPts / size) * this.baseScore * multiplier);
    }
    // 修正舍入导致的非零和
    const drift = Object.values(scoreChanges).reduce((a, b) => a + b, 0);
    if (drift !== 0) {
      const first = this.finishOrder[0]!;
      scoreChanges[first]! -= drift;
    }

    for (const s of this.redSeats) this.p(s).identityRevealed = true;
    this.result = {
      ranks: this.seats.map((s) => ({ seat: s, rank: this.p(s).finishRank! })),
      teams: [
        { seats: redTeam, isRedTeam: true, points: redPoints },
        { seats: blueTeam, isRedTeam: false, points: bluePoints },
      ],
      solo,
      multiplier,
      scoreChanges,
      detail: { redSeats: redTeam, baseScore: this.baseScore },
    };
    this.phase = 'finished';
    this.emit('roundEnd', -1, { result: this.result });
  }

  viewFor(seat: number): Record<string, unknown> {
    return {
      phase: this.phase,
      turnSeat: this.turnSeat,
      tableCombo: this.tableCombo,
      tableComboSeat: this.tableComboSeat,
      myHand: [...this.p(seat).hand],
      players: this.seats.map((s) => {
        const pl = this.p(s);
        return {
          seat: s,
          handCount: pl.hand.length,
          finishRank: pl.finishRank,
          trustee: pl.trustee,
          identityRevealed: pl.identityRevealed,
          isRed: pl.identityRevealed ? this.redSeats.includes(s) : undefined,
        };
      }),
    };
  }
}
