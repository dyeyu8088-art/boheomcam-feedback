/**
 * 麻将桌状态机（单局）。纯逻辑、无 I/O、无计时器：
 * - 宿主（services/game/mahjong 模块）负责广播事件、调度 phaseDeadline 超时回调、多局编排。
 * - 所有事件进入 events[]（回放事件流，落库 game_actions）。
 * - 优先级仲裁：出牌后统一收集全部玩家意愿，按配置 priority.order 判定，杜绝“先点先得”。
 */
import type { MahjongRuleConfig } from './config.js';
import { evaluateHu, tingKinds, type HuContext, type Meld } from './evaluator.js';
import { buildTiles, kindOf, type Tile, type TileKind } from './tiles.js';
import { shuffle, type Rng } from '../rng.js';

export type MjPhase = 'init' | 'turn' | 'claiming' | 'finished';

export interface MjPlayer {
  seat: number;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  declaredTing: boolean;
  trustee: boolean;
  /** 过水锁：pass 过胡后直到下次自己摸牌不可点炮胡 */
  passHuLocked: boolean;
  /** 杠即时分累计 */
  gangScore: number;
  hasDrawnOnce: boolean;
}

export interface MjEvent {
  seq: number;
  type: string;
  /** 私有事件仅发给 seat；-1 为全体 */
  seat: number;
  data: Record<string, unknown>;
}

export interface ClaimOffer {
  seat: number;
  options: ClaimOption[];
  responded: boolean;
  choice: ClaimChoice | null;
}

export type ClaimOption =
  | { action: 'hu' }
  | { action: 'peng' }
  | { action: 'gang' }
  | { action: 'chi'; variants: TileKind[][] };

export type ClaimChoice =
  | { action: 'pass' }
  | { action: 'hu' }
  | { action: 'peng' }
  | { action: 'gang' }
  | { action: 'chi'; kinds: TileKind[] };

export interface MjRoundResult {
  winners: { seat: number; fan: number; cappedFan: number; multiplier: number; patterns: { id: string; fan: number }[]; selfDraw: boolean }[];
  loserSeat: number | null; // 点炮者
  isDraw: boolean;
  /** 每座位分数变化（含杠分与查叫） */
  scoreChanges: Record<number, number>;
  tingSeats: number[];
  detail: Record<string, unknown>;
}

export interface SelfOptions {
  canHu: boolean;
  anGangKinds: TileKind[];
  buGangKinds: TileKind[];
  canDeclareTing: boolean;
  /** 报听时每个可打出的牌对应听的 kind 列表 */
  tingDiscards?: { discard: TileKind; waits: TileKind[] }[];
}

const sortHand = (hand: Tile[]) => hand.sort((a, b) => a - b);

export class MahjongTable {
  readonly cfg: MahjongRuleConfig;
  readonly seats: number[];
  readonly dealerSeat: number;
  readonly baseScore: number;
  wall: Tile[] = [];
  players = new Map<number, MjPlayer>();
  phase: MjPhase = 'init';
  turnSeat = -1;
  /** 当前回合摸的牌（未出）；null 表示碰/吃后待出 */
  drawnTile: Tile | null = null;
  lastDiscard: { seat: number; tile: Tile } | null = null;
  claims: ClaimOffer[] = [];
  events: MjEvent[] = [];
  result: MjRoundResult | null = null;
  /** 上次摸牌是否为杠后补牌（杠上开花/杠后炮判定） */
  private gangReplacementDraw = false;
  /** 杠后打出的第一张（杠后炮） */
  private gangHouPaoPending = false;
  private anyMeldOrDiscard = false;
  private firstTurnCycle = true;
  private seq = 0;
  /** 当前阶段截止时间基准（宿主换算真实时间） */
  phaseDeadlineMs = 0;

  constructor(cfg: MahjongRuleConfig, seats: number[], dealerSeat: number, baseScore: number, rng: Rng) {
    if (!cfg.playerCounts.includes(seats.length)) {
      throw new Error(`config does not allow ${seats.length} players`);
    }
    this.cfg = cfg;
    this.seats = [...seats];
    this.dealerSeat = dealerSeat;
    this.baseScore = baseScore;
    this.wall = shuffle(buildTiles(cfg.tiles), rng);
    for (const s of seats) {
      this.players.set(s, {
        seat: s,
        hand: [],
        melds: [],
        discards: [],
        declaredTing: false,
        trustee: false,
        passHuLocked: false,
        gangScore: 0,
        hasDrawnOnce: false,
      });
    }
  }

  private emit(type: string, seat: number, data: Record<string, unknown>): void {
    this.seq += 1;
    this.events.push({ seq: this.seq, type, seat, data });
  }

  p(seat: number): MjPlayer {
    const pl = this.players.get(seat);
    if (!pl) throw new Error(`no player at seat ${seat}`);
    return pl;
  }

  nextSeat(seat: number): number {
    const idx = this.seats.indexOf(seat);
    return this.seats[(idx + 1) % this.seats.length]!;
  }

  /** 开局：发牌 + 庄家起手 14 张进入出牌回合 */
  start(): void {
    if (this.phase !== 'init') throw new Error('already started');
    const hs = this.cfg.deal.handSize;
    for (const s of this.seats) {
      const pl = this.p(s);
      pl.hand = this.wall.splice(0, hs);
      sortHand(pl.hand);
      this.emit('deal', s, { tiles: [...pl.hand] });
    }
    // 庄家第 14 张
    const dealer = this.p(this.dealerSeat);
    const t = this.wall.shift()!;
    dealer.hand.push(t);
    sortHand(dealer.hand);
    dealer.hasDrawnOnce = true;
    this.drawnTile = t;
    this.turnSeat = this.dealerSeat;
    this.phase = 'turn';
    this.emit('draw', this.dealerSeat, { tile: t, wallLeft: this.wall.length, tianHuWindow: true });
    this.emit('turn', -1, { seat: this.dealerSeat, wallLeft: this.wall.length });
  }

  /** 当前回合玩家的可选自动作 */
  selfOptions(seat: number): SelfOptions {
    const pl = this.p(seat);
    if (this.phase !== 'turn' || this.turnSeat !== seat) {
      return { canHu: false, anGangKinds: [], buGangKinds: [], canDeclareTing: false };
    }
    const huRes = evaluateHu(this.huCtx(seat, kindOf(this.drawnTile ?? pl.hand[pl.hand.length - 1]!), true), this.cfg);
    const counts = new Map<TileKind, number>();
    for (const t of pl.hand) counts.set(kindOf(t), (counts.get(kindOf(t)) ?? 0) + 1);
    const anGangKinds: TileKind[] = [];
    const buGangKinds: TileKind[] = [];
    if (this.cfg.actions.canAnGang && this.drawnTile !== null) {
      for (const [k, c] of counts) if (c === 4) anGangKinds.push(k);
    }
    if (this.cfg.actions.canBuGang && this.drawnTile !== null) {
      for (const m of pl.melds) {
        if (m.type === 'peng' && (counts.get(m.kinds[0]!) ?? 0) >= 1) buGangKinds.push(m.kinds[0]!);
      }
    }
    let canDeclareTing = false;
    let tingDiscards: { discard: TileKind; waits: TileKind[] }[] | undefined;
    if (this.cfg.actions.declareTing.enabled && !pl.declaredTing && this.drawnTile !== null) {
      tingDiscards = [];
      const seen = new Set<TileKind>();
      for (const t of pl.hand) {
        const k = kindOf(t);
        if (seen.has(k)) continue;
        seen.add(k);
        const rest = [...pl.hand];
        rest.splice(rest.indexOf(t), 1);
        const waits = tingKinds(rest, pl.melds, this.cfg);
        if (waits.length > 0) tingDiscards.push({ discard: k, waits });
      }
      canDeclareTing = tingDiscards.length > 0;
    }
    return { canHu: huRes.ok, anGangKinds, buGangKinds, canDeclareTing, tingDiscards };
  }

  private huCtx(seat: number, winKind: TileKind, selfDraw: boolean, extra: Partial<HuContext> = {}): HuContext {
    const pl = this.p(seat);
    const handTiles = selfDraw ? [...pl.hand] : [...pl.hand, winKind * 4];
    const isFirstDealerTile = seat === this.dealerSeat && selfDraw && pl.discards.length === 0 && !this.anyMeldOrDiscard && pl.melds.length === 0;
    const isFirstOwnDraw = seat !== this.dealerSeat && selfDraw && this.firstTurnCycle && !this.anyMeldOrDiscard && pl.melds.length === 0 && pl.discards.length === 0;
    return {
      handTiles,
      melds: pl.melds,
      winKind,
      selfDraw,
      isTianHu: isFirstDealerTile,
      isDiHu: isFirstOwnDraw,
      isGangShangKaiHua: selfDraw && this.gangReplacementDraw,
      isHaiDi: this.wall.length <= this.cfg.draw.wallReserve,
      declaredTing: pl.declaredTing,
      ...extra,
    };
  }

  /** 出牌 */
  discard(seat: number, tile: Tile): void {
    this.assertTurn(seat);
    const pl = this.p(seat);
    const idx = pl.hand.indexOf(tile);
    if (idx < 0) throw new Error('INVALID_ACTION:tile not in hand');
    if (pl.declaredTing && this.cfg.actions.declareTing.lockHand && this.drawnTile !== null && tile !== this.drawnTile) {
      throw new Error('INVALID_ACTION:ting locked, must discard drawn tile');
    }
    pl.hand.splice(idx, 1);
    pl.discards.push(tile);
    this.gangHouPaoPending = this.gangReplacementDraw;
    this.gangReplacementDraw = false;
    this.drawnTile = null;
    this.lastDiscard = { seat, tile };
    this.anyMeldOrDiscard = true;
    this.emit('discard', -1, { seat, tile, kind: kindOf(tile) });
    this.openClaims();
  }

  /** 报听：打出 discard 并锁手 */
  declareTing(seat: number, tile: Tile): void {
    this.assertTurn(seat);
    if (!this.cfg.actions.declareTing.enabled) throw new Error('INVALID_ACTION:ting disabled');
    const pl = this.p(seat);
    const rest = [...pl.hand];
    const idx = rest.indexOf(tile);
    if (idx < 0) throw new Error('INVALID_ACTION:tile not in hand');
    rest.splice(idx, 1);
    if (tingKinds(rest, pl.melds, this.cfg).length === 0) throw new Error('INVALID_ACTION:not ting after discard');
    pl.declaredTing = true;
    this.emit('ting', -1, { seat });
    this.discard(seat, tile);
  }

  /** 自摸胡 */
  huSelf(seat: number): void {
    this.assertTurn(seat);
    const pl = this.p(seat);
    const winTile = this.drawnTile ?? pl.hand[pl.hand.length - 1]!;
    const res = evaluateHu(this.huCtx(seat, kindOf(winTile), true), this.cfg);
    if (!res.ok) throw new Error(`INVALID_ACTION:cannot hu (${res.reason})`);
    this.finishWithHu([{ seat, res, selfDraw: true }], null);
  }

  /** 暗杠/补杠（turn 阶段）。补杠会开抢杠窗口 */
  gangSelf(seat: number, kind: TileKind, type: 'angang' | 'bugang'): void {
    this.assertTurn(seat);
    const pl = this.p(seat);
    if (this.drawnTile === null) throw new Error('INVALID_ACTION:must gang after draw');
    if (type === 'angang') {
      if (!this.cfg.actions.canAnGang) throw new Error('INVALID_ACTION:angang disabled');
      const tiles = pl.hand.filter((t) => kindOf(t) === kind);
      if (tiles.length !== 4) throw new Error('INVALID_ACTION:need 4 tiles');
      pl.hand = pl.hand.filter((t) => kindOf(t) !== kind);
      pl.melds.push({ type: 'angang', kinds: [kind, kind, kind, kind] });
      this.applyGangScore(seat, 'an');
      this.emit('meld', -1, { seat, type: 'angang', kind });
      this.drawReplacement(seat);
      return;
    }
    if (!this.cfg.actions.canBuGang) throw new Error('INVALID_ACTION:bugang disabled');
    const meld = pl.melds.find((m) => m.type === 'peng' && m.kinds[0] === kind);
    const tileIdx = pl.hand.findIndex((t) => kindOf(t) === kind);
    if (!meld || tileIdx < 0) throw new Error('INVALID_ACTION:no peng/tile for bugang');
    // 抢杠窗口
    if (this.cfg.actions.qiangGangHu) {
      const offers: ClaimOffer[] = [];
      for (const s of this.seats) {
        if (s === seat) continue;
        const other = this.p(s);
        if (other.passHuLocked && this.cfg.hu.passHuLock !== 'none') continue;
        const r = evaluateHu(this.huCtx(s, kind, false, { isQiangGang: true }), this.cfg);
        if (r.ok) offers.push({ seat: s, options: [{ action: 'hu' }], responded: false, choice: null });
      }
      if (offers.length > 0) {
        this.phase = 'claiming';
        this.claims = offers;
        this.pendingBuGang = { seat, kind, meldRef: meld, tileIdx };
        for (const o of offers) this.emit('actionAsk', o.seat, { options: o.options, qiangGangKind: kind });
        return;
      }
    }
    this.commitBuGang(seat, kind);
  }

  private pendingBuGang: { seat: number; kind: TileKind; meldRef: Meld; tileIdx: number } | null = null;

  private commitBuGang(seat: number, kind: TileKind): void {
    const pl = this.p(seat);
    const meld = pl.melds.find((m) => m.type === 'peng' && m.kinds[0] === kind)!;
    const tileIdx = pl.hand.findIndex((t) => kindOf(t) === kind);
    pl.hand.splice(tileIdx, 1);
    meld.type = 'bugang';
    meld.kinds = [kind, kind, kind, kind];
    this.applyGangScore(seat, 'bu');
    this.emit('meld', -1, { seat, type: 'bugang', kind });
    this.pendingBuGang = null;
    this.drawReplacement(seat);
  }

  private applyGangScore(seat: number, kind: 'ming' | 'an' | 'bu'): void {
    const score = this.cfg.score.gangScore[kind];
    if (score <= 0) return;
    const pl = this.p(seat);
    for (const s of this.seats) {
      if (s === seat) continue;
      this.p(s).gangScore -= score;
      pl.gangScore += score;
    }
    this.emit('gangScore', -1, { seat, kind, score });
  }

  /** 杠后补牌（含海底判定→流局） */
  private drawReplacement(seat: number): void {
    if (this.wall.length <= this.cfg.draw.wallReserve) {
      this.finishDraw();
      return;
    }
    const t = this.wall.pop()!; // 杠从墙尾补
    const pl = this.p(seat);
    pl.hand.push(t);
    sortHand(pl.hand);
    this.drawnTile = t;
    this.gangReplacementDraw = true;
    this.emit('draw', seat, { tile: t, wallLeft: this.wall.length, replacement: true });
    this.emit('turn', -1, { seat, wallLeft: this.wall.length });
  }

  private assertTurn(seat: number): void {
    if (this.phase !== 'turn') throw new Error('INVALID_ACTION:not turn phase');
    if (this.turnSeat !== seat) throw new Error('NOT_YOUR_TURN');
  }

  /** 出牌后：收集他家可选动作 */
  private openClaims(): void {
    const { seat: fromSeat, tile } = this.lastDiscard!;
    const kind = kindOf(tile);
    const offers: ClaimOffer[] = [];
    for (const s of this.seats) {
      if (s === fromSeat) continue;
      const pl = this.p(s);
      const options: ClaimOption[] = [];
      // 胡（点炮）
      if (this.cfg.hu.allowDianPaoHu && !this.cfg.hu.selfDrawOnly && !(pl.passHuLocked && this.cfg.hu.passHuLock !== 'none')) {
        const r = evaluateHu(this.huCtx(s, kind, false, { isGangHouPao: this.gangHouPaoPending }), this.cfg);
        if (r.ok) options.push({ action: 'hu' });
      }
      const sameCount = pl.hand.filter((t) => kindOf(t) === kind).length;
      const tingLocked = pl.declaredTing && this.cfg.actions.declareTing.lockHand;
      if (!tingLocked) {
        if (this.cfg.actions.canPeng && sameCount >= 2) options.push({ action: 'peng' });
        if (this.cfg.actions.canMingGang && sameCount >= 3) options.push({ action: 'gang' });
        if (this.cfg.actions.canChi && s === this.nextSeat(fromSeat) && kind < 27) {
          const variants: TileKind[][] = [];
          const has = (k: TileKind) => k >= 0 && k < 27 && Math.floor(k / 9) === Math.floor(kind / 9) && pl.hand.some((t) => kindOf(t) === k);
          if (has(kind - 2) && has(kind - 1)) variants.push([kind - 2, kind - 1, kind]);
          if (has(kind - 1) && has(kind + 1)) variants.push([kind - 1, kind, kind + 1]);
          if (has(kind + 1) && has(kind + 2)) variants.push([kind, kind + 1, kind + 2]);
          if (variants.length > 0) options.push({ action: 'chi', variants });
        }
      }
      if (options.length > 0) offers.push({ seat: s, options, responded: false, choice: null });
    }
    if (offers.length === 0) {
      this.advanceTurn();
      return;
    }
    this.phase = 'claiming';
    this.claims = offers;
    for (const o of offers) this.emit('actionAsk', o.seat, { options: o.options, tile, fromSeat });
  }

  /** 玩家在动作窗口内响应 */
  respondClaim(seat: number, choice: ClaimChoice): void {
    if (this.phase !== 'claiming') throw new Error('INVALID_ACTION:no claim window');
    const offer = this.claims.find((c) => c.seat === seat);
    if (!offer) throw new Error('INVALID_ACTION:no pending claim');
    if (offer.responded) throw new Error('INVALID_ACTION:already responded');
    if (choice.action !== 'pass') {
      const has = offer.options.some((o) => o.action === choice.action);
      if (!has) throw new Error('INVALID_ACTION:option not offered');
      if (choice.action === 'chi') {
        const opt = offer.options.find((o) => o.action === 'chi') as Extract<ClaimOption, { action: 'chi' }>;
        if (!opt.variants.some((v) => v.join(',') === choice.kinds.join(','))) {
          throw new Error('INVALID_ACTION:bad chi variant');
        }
      }
    }
    offer.responded = true;
    offer.choice = choice;
    if (choice.action === 'pass' && offer.options.some((o) => o.action === 'hu')) {
      // 过水锁
      if (this.cfg.hu.passHuLock !== 'none') this.p(seat).passHuLocked = true;
    }
    this.emit('claimResponse', seat, { action: choice.action });
    if (this.claims.every((c) => c.responded)) this.resolveClaims();
  }

  /** 动作窗口超时：未响应者按 pass 处理（托管者由宿主提前代答） */
  timeoutClaims(): void {
    if (this.phase !== 'claiming') return;
    for (const c of this.claims) {
      if (!c.responded) {
        c.responded = true;
        c.choice = { action: 'pass' };
        if (this.cfg.hu.passHuLock !== 'none' && c.options.some((o) => o.action === 'hu')) {
          this.p(c.seat).passHuLocked = true;
        }
      }
    }
    this.resolveClaims();
  }

  /** Action Priority Engine：统一仲裁 */
  private resolveClaims(): void {
    const byAction = (a: string) => this.claims.filter((c) => c.choice && c.choice.action === a);
    // 抢杠特殊路径
    if (this.pendingBuGang) {
      const huClaims = byAction('hu');
      if (huClaims.length > 0) {
        const winners = (this.cfg.priority.multiHu ? huClaims : [this.closestClaim(huClaims, this.pendingBuGang.seat)]).map((c) => ({
          seat: c.seat,
          res: evaluateHu(this.huCtx(c.seat, this.pendingBuGang!.kind, false, { isQiangGang: true }), this.cfg),
          selfDraw: false,
        }));
        const loser = this.pendingBuGang.seat;
        this.pendingBuGang = null;
        this.finishWithHu(winners, loser);
        return;
      }
      const { seat, kind } = this.pendingBuGang;
      this.phase = 'turn';
      this.claims = [];
      this.commitBuGang(seat, kind);
      return;
    }

    const { seat: fromSeat, tile } = this.lastDiscard!;
    const kind = kindOf(tile);
    for (const action of this.cfg.priority.order) {
      const claimed = byAction(action);
      if (claimed.length === 0) continue;
      if (action === 'hu') {
        const winners = (this.cfg.priority.multiHu ? claimed : [this.closestClaim(claimed, fromSeat)]).map((c) => ({
          seat: c.seat,
          res: evaluateHu(this.huCtx(c.seat, kind, false, { isGangHouPao: this.gangHouPaoPending }), this.cfg),
          selfDraw: false,
        }));
        this.finishWithHu(winners, fromSeat);
        return;
      }
      const actor = this.closestClaim(claimed, fromSeat);
      const pl = this.p(actor.seat);
      this.claims = [];
      this.phase = 'turn';
      this.turnSeat = actor.seat;
      this.drawnTile = null;
      this.gangHouPaoPending = false;
      this.firstTurnCycle = false;
      // 从弃牌河移除被拿走的牌
      this.p(fromSeat).discards.pop();
      if (action === 'peng') {
        removeKinds(pl.hand, kind, 2);
        pl.melds.push({ type: 'peng', kinds: [kind, kind, kind], fromSeat });
        this.emit('meld', -1, { seat: actor.seat, type: 'peng', kind, fromSeat });
        this.emit('turn', -1, { seat: actor.seat, wallLeft: this.wall.length, mustDiscard: true });
        return;
      }
      if (action === 'gang') {
        removeKinds(pl.hand, kind, 3);
        pl.melds.push({ type: 'minggang', kinds: [kind, kind, kind, kind], fromSeat });
        this.applyGangScore(actor.seat, 'ming');
        this.emit('meld', -1, { seat: actor.seat, type: 'minggang', kind, fromSeat });
        this.drawReplacement(actor.seat);
        return;
      }
      if (action === 'chi') {
        const kinds = (actor.choice as Extract<ClaimChoice, { action: 'chi' }>).kinds;
        for (const k of kinds) {
          if (k === kind) continue;
          const idx = pl.hand.findIndex((t) => kindOf(t) === k);
          pl.hand.splice(idx, 1);
        }
        pl.melds.push({ type: 'chi', kinds, fromSeat });
        this.emit('meld', -1, { seat: actor.seat, type: 'chi', kinds, fromSeat });
        this.emit('turn', -1, { seat: actor.seat, wallLeft: this.wall.length, mustDiscard: true });
        return;
      }
    }
    // 全部过
    this.claims = [];
    this.phase = 'turn';
    this.advanceTurn();
  }

  private closestClaim(claims: ClaimOffer[], fromSeat: number): ClaimOffer {
    let best: ClaimOffer | null = null;
    let bestDist = 99;
    for (const c of claims) {
      let dist = (this.seats.indexOf(c.seat) - this.seats.indexOf(fromSeat) + this.seats.length) % this.seats.length;
      if (dist === 0) dist = this.seats.length;
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    return best!;
  }

  /** 下一位摸牌 */
  private advanceTurn(): void {
    this.gangHouPaoPending = false;
    const next = this.nextSeat(this.lastDiscard ? this.lastDiscard.seat : this.turnSeat);
    if (this.wall.length <= this.cfg.draw.wallReserve) {
      this.finishDraw();
      return;
    }
    const t = this.wall.shift()!;
    const pl = this.p(next);
    pl.hand.push(t);
    sortHand(pl.hand);
    pl.hasDrawnOnce = true;
    pl.passHuLocked = false; // 过水解锁
    if (this.seats.indexOf(next) === this.seats.length - 1) this.firstTurnCycle = false;
    this.turnSeat = next;
    this.drawnTile = t;
    this.gangReplacementDraw = false;
    this.phase = 'turn';
    this.emit('draw', next, { tile: t, wallLeft: this.wall.length });
    this.emit('drawPublic', -1, { seat: next, wallLeft: this.wall.length });
    this.emit('turn', -1, { seat: next, wallLeft: this.wall.length });
  }

  /** 托管/超时自动行动（turn 阶段） */
  autoActTurn(seat: number): void {
    if (this.phase !== 'turn' || this.turnSeat !== seat) return;
    const opts = this.selfOptions(seat);
    if (opts.canHu) {
      this.huSelf(seat);
      return;
    }
    const pl = this.p(seat);
    const tile = this.drawnTile ?? pl.hand[pl.hand.length - 1]!;
    this.discard(seat, tile);
  }

  /** 托管/超时自动响应（claiming 阶段）：能胡则胡，其余过 */
  autoRespond(seat: number): void {
    const offer = this.claims.find((c) => c.seat === seat && !c.responded);
    if (!offer) return;
    if (offer.options.some((o) => o.action === 'hu')) this.respondClaim(seat, { action: 'hu' });
    else this.respondClaim(seat, { action: 'pass' });
  }

  private finishWithHu(
    winners: { seat: number; res: ReturnType<typeof evaluateHu>; selfDraw: boolean }[],
    loserSeat: number | null,
  ): void {
    const scoreChanges: Record<number, number> = {};
    for (const s of this.seats) scoreChanges[s] = 0;
    for (const w of winners) {
      const mult = w.res.multiplier * this.baseScore * (w.seat === this.dealerSeat || loserSeat === this.dealerSeat ? this.cfg.dealer.dealerMultiplier : 1);
      if (w.selfDraw) {
        for (const s of this.seats) {
          if (s === w.seat) continue;
          scoreChanges[s]! -= mult;
          scoreChanges[w.seat]! += mult;
        }
      } else if (loserSeat !== null) {
        if (this.cfg.score.dianPaoPolicy === 'discarderPays') {
          scoreChanges[loserSeat]! -= mult;
          scoreChanges[w.seat]! += mult;
        } else {
          for (const s of this.seats) {
            if (s === w.seat) continue;
            scoreChanges[s]! -= mult;
            scoreChanges[w.seat]! += mult;
          }
        }
      }
    }
    for (const s of this.seats) scoreChanges[s]! += this.p(s).gangScore;
    this.result = {
      winners: winners.map((w) => ({
        seat: w.seat,
        fan: w.res.fan,
        cappedFan: w.res.cappedFan,
        multiplier: w.res.multiplier,
        patterns: w.res.patterns,
        selfDraw: w.selfDraw,
      })),
      loserSeat,
      isDraw: false,
      scoreChanges,
      tingSeats: [],
      detail: { baseScore: this.baseScore },
    };
    this.phase = 'finished';
    this.emit('roundEnd', -1, { result: this.result });
  }

  /** 流局（黄庄）：查叫结算 */
  private finishDraw(): void {
    const scoreChanges: Record<number, number> = {};
    for (const s of this.seats) scoreChanges[s] = 0;
    const tingSeats: number[] = [];
    if (this.cfg.draw.chaJiao) {
      const tingMap = new Map<number, boolean>();
      for (const s of this.seats) {
        const pl = this.p(s);
        const ting = pl.declaredTing || tingKinds(pl.hand, pl.melds, this.cfg).length > 0;
        tingMap.set(s, ting);
        if (ting) tingSeats.push(s);
      }
      const amount = this.baseScore * 2 ** this.cfg.draw.chaJiaoFan;
      for (const s of this.seats) {
        if (tingMap.get(s)) continue;
        for (const t of tingSeats) {
          scoreChanges[s]! -= amount;
          scoreChanges[t]! += amount;
        }
      }
    }
    for (const s of this.seats) scoreChanges[s]! += this.p(s).gangScore;
    this.result = {
      winners: [],
      loserSeat: null,
      isDraw: true,
      scoreChanges,
      tingSeats,
      detail: { baseScore: this.baseScore, chaJiao: this.cfg.draw.chaJiao },
    };
    this.phase = 'finished';
    this.emit('roundEnd', -1, { result: this.result });
  }

  /** 座位视角快照（断线重连 room.sync 用；他人手牌仅数量） */
  viewFor(seat: number): Record<string, unknown> {
    return {
      phase: this.phase,
      turnSeat: this.turnSeat,
      wallLeft: this.wall.length,
      dealerSeat: this.dealerSeat,
      lastDiscard: this.lastDiscard,
      myHand: [...this.p(seat).hand],
      myDrawn: this.turnSeat === seat ? this.drawnTile : null,
      players: this.seats.map((s) => {
        const pl = this.p(s);
        return {
          seat: s,
          handCount: pl.hand.length,
          melds: pl.melds,
          discards: pl.discards,
          declaredTing: pl.declaredTing,
          trustee: pl.trustee,
          gangScore: pl.gangScore,
        };
      }),
      myPendingClaim: this.claims.find((c) => c.seat === seat && !c.responded)?.options ?? null,
    };
  }
}

function removeKinds(hand: Tile[], kind: TileKind, n: number): void {
  let removed = 0;
  for (let i = hand.length - 1; i >= 0 && removed < n; i -= 1) {
    if (kindOf(hand[i]!) === kind) {
      hand.splice(i, 1);
      removed += 1;
    }
  }
  if (removed < n) throw new Error('INVALID_ACTION:not enough tiles');
}
