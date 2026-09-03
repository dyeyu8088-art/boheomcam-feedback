/**
 * 行情数据源接口：股票涨跌玩法只通过本接口取价，开盘价 / 结算价由数据源决定，与任何投注无关。
 * 当前实现为服务端模拟行情（SimulatedMarketProvider）；接入真实行情源需单独做合规评估后再实现同一接口。
 */
import { gbmStep, type StockConfig } from '@yanbian/game-common/stock';
import { secureRng, type Rng } from '@yanbian/game-common';
import { getLogger, query } from '@yanbian/server-core';

export interface PricePoint {
  ts: number;
  price: number;
}

export type TickListener = (ts: number, prices: Record<string, number>) => void;

export interface MarketDataProvider {
  readonly kind: string;
  start(): Promise<void>;
  stop(): void;
  instruments(): string[];
  getCurrentPrice(instrument: string): PricePoint;
  getHistory(instrument: string, limit: number): PricePoint[];
  /** 回合开盘价：开盘时刻（含）之前最近一个 tick */
  getRoundOpeningPrice(instrument: string, openedAt: number): PricePoint;
  /** 回合结算价：结算时刻（含）之后第一个 tick（需已到达，否则返回最近 tick） */
  getRoundSettlementPrice(instrument: string, settleAt: number): PricePoint;
  onTick(cb: TickListener): () => void;
}

const log = getLogger('market');
const MAX_SERIES = 900;

/**
 * 模拟行情：几何布朗运动 + 轻微均值回归（防止长期漂离基准价），CSPRNG 驱动，逐 tick 落库 `stock_ticks` 以供审计。
 */
export class SimulatedMarketProvider implements MarketDataProvider {
  readonly kind = 'simulated';
  private series = new Map<string, PricePoint[]>();
  private listeners = new Set<TickListener>();
  private timer: NodeJS.Timeout | null = null;
  private pruneTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly cfg: StockConfig,
    private readonly rng: Rng = secureRng,
  ) {}

  instruments(): string[] {
    return this.cfg.instruments.map((i) => i.id);
  }

  async start(): Promise<void> {
    for (const inst of this.cfg.instruments) {
      const r = await query(`SELECT price, ts FROM stock_ticks WHERE instrument=$1 ORDER BY ts DESC LIMIT $2`, [inst.id, MAX_SERIES]);
      const pts: PricePoint[] = r.rows.map((row) => ({ ts: new Date(row.ts as string).getTime(), price: Number(row.price) })).reverse();
      if (pts.length === 0) pts.push({ ts: Date.now(), price: inst.basePrice });
      this.series.set(inst.id, pts);
    }
    this.timer = setInterval(() => void this.tick(), this.cfg.tickMs);
    this.timer.unref();
    this.pruneTimer = setInterval(() => void this.prune(), 600000);
    this.pruneTimer.unref();
    log.info({ instruments: this.instruments(), tickMs: this.cfg.tickMs }, 'simulated market started');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.timer = null;
    this.pruneTimer = null;
  }

  private async tick(): Promise<void> {
    const ts = Date.now();
    const prices: Record<string, number> = {};
    const values: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const inst of this.cfg.instruments) {
      const arr = this.series.get(inst.id)!;
      const prev = arr[arr.length - 1]!.price;
      // 均值回归：偏离基准价越远，漂移越强地拉回（kappa 0.002/tick）
      const drift = inst.driftPerTick + 0.002 * Math.log(inst.basePrice / prev);
      const price = gbmStep(prev, inst.sigmaPerTick, drift, this.rng);
      arr.push({ ts, price });
      if (arr.length > MAX_SERIES) arr.splice(0, arr.length - MAX_SERIES);
      prices[inst.id] = price;
      values.push(`($${i}, to_timestamp($${i + 1}/1000.0), $${i + 2})`);
      params.push(inst.id, ts, price);
      i += 3;
    }
    for (const cb of this.listeners) {
      try {
        cb(ts, prices);
      } catch (e) {
        log.error({ err: (e as Error).message }, 'tick listener failed');
      }
    }
    await query(`INSERT INTO stock_ticks (instrument, ts, price) VALUES ${values.join(',')} ON CONFLICT DO NOTHING`, params).catch((e: Error) =>
      log.error({ err: e.message }, 'persist ticks failed'),
    );
  }

  private async prune(): Promise<void> {
    await query(`DELETE FROM stock_ticks WHERE ts < now() - ($1 || ' milliseconds')::interval`, [String(this.cfg.tickRetentionMs)]).catch(() => undefined);
  }

  getCurrentPrice(instrument: string): PricePoint {
    const arr = this.series.get(instrument);
    if (!arr || arr.length === 0) throw new Error(`unknown instrument ${instrument}`);
    return arr[arr.length - 1]!;
  }

  getHistory(instrument: string, limit: number): PricePoint[] {
    const arr = this.series.get(instrument) ?? [];
    return arr.slice(-limit);
  }

  getRoundOpeningPrice(instrument: string, openedAt: number): PricePoint {
    const arr = this.series.get(instrument) ?? [];
    for (let i = arr.length - 1; i >= 0; i -= 1) if (arr[i]!.ts <= openedAt) return arr[i]!;
    return arr[0] ?? this.getCurrentPrice(instrument);
  }

  getRoundSettlementPrice(instrument: string, settleAt: number): PricePoint {
    const arr = this.series.get(instrument) ?? [];
    for (const p of arr) if (p.ts >= settleAt) return p;
    return this.getCurrentPrice(instrument);
  }

  onTick(cb: TickListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
