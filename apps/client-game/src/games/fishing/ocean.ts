/**
 * 海底环境层（Pixi Graphics，全部程序绘制、对象池、按设备分级）：
 *   far  远景：水体渐变 + 远处漂浮颗粒（视差 0.25）
 *   mid  中景：光束（缓慢摆动 / 明暗变化）+ 焦散波纹 + 海床 + 水草（逐帧摆动）
 *   near 近景：气泡（上浮、鱼尾尾迹）+ 近处颗粒（视差 0.9）
 * 视差：相机偏移（随炮台瞄准与缓慢漂移）按层系数位移。
 * 减少动态：光束 / 颗粒 / 水草静止，气泡保留但减半。
 */
import { Container, FillGradient, Graphics } from 'pixi.js';

export interface OceanOptions {
  lowEnd: boolean;
  reduceMotion: () => boolean;
}

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
}

export class Ocean {
  readonly far = new Container();
  readonly mid = new Container();
  readonly near = new Container();
  private readonly water = new Graphics();
  private readonly beams: { g: Graphics; x: number; phase: number }[] = [];
  private readonly caustics = new Graphics();
  private readonly seabed = new Graphics();
  private readonly weeds = new Graphics();
  private readonly weedSeeds: { x: number; h: number; w: number; phase: number; color: number }[] = [];
  private readonly farMotes: Particle[] = [];
  private readonly nearMotes: Particle[] = [];
  private readonly bubbles: Particle[] = [];
  private readonly bubblePool: Graphics[] = [];
  private w = 800;
  private h = 450;
  private cam = { x: 0, y: 0 };
  private readonly opts: OceanOptions;

  constructor(opts: OceanOptions) {
    this.opts = opts;
    this.far.addChild(this.water);
    this.mid.addChild(this.caustics);
    this.mid.addChild(this.seabed, this.weeds);
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.drawWater();
    this.buildBeams();
    this.drawSeabed();
    this.buildWeeds();
    this.buildMotes();
  }

  private drawWater(): void {
    const { w, h, water } = this;
    water.clear();
    const grad = new FillGradient(0, 0, 0, 1);
    grad.addColorStop(0, 0x1b6a8e);
    grad.addColorStop(0.18, 0x145575);
    grad.addColorStop(0.45, 0x0c3550);
    grad.addColorStop(0.75, 0x072033);
    grad.addColorStop(1, 0x03101a);
    water.rect(-40, -40, w + 80, h + 80).fill(grad);
    water.rect(0, 0, w, h * 0.05).fill({ color: 0xbfe8f2, alpha: 0.1 });
    // 暗角
    const edge = Math.max(90, Math.min(w, h) * 0.28);
    const strips: [number, number, number, number, number, number, number, number][] = [
      [0, 0, w, edge, 0, 0, 0, 1],
      [0, h - edge, w, edge, 0, 1, 0, 0],
      [0, 0, edge, h, 0, 0, 1, 0],
      [w - edge, 0, edge, h, 1, 0, 0, 0],
    ];
    for (const [rx, ry, rw, rh, x0, y0, x1, y1] of strips) {
      const gr = new FillGradient(x0, y0, x1, y1);
      gr.addColorStop(0, 'rgba(2, 10, 16, 0.5)');
      gr.addColorStop(1, 'rgba(2, 10, 16, 0)');
      water.rect(rx, ry, rw, rh).fill(gr);
    }
  }

  private buildBeams(): void {
    for (const b of this.beams) b.g.destroy();
    this.beams.length = 0;
    const n = this.opts.lowEnd ? 3 : 5;
    for (let i = 0; i < n; i += 1) {
      const g = new Graphics();
      const bw = 60 + (i % 2) * 40;
      g.poly([0, -20, bw, -20, bw * 3.2, this.h + 20, -bw * 1.6, this.h + 20]).fill({ color: 0x9fd4e8, alpha: 0.055 });
      g.poly([bw * 0.3, -20, bw * 0.7, -20, bw * 2.4, this.h + 20, bw * 0.2, this.h + 20]).fill({ color: 0xcdeeff, alpha: 0.035 });
      g.x = ((i + 0.5) / n) * this.w;
      g.rotation = -0.12;
      this.mid.addChildAt(g, 1);
      this.beams.push({ g, x: g.x, phase: i * 1.3 });
    }
  }

  private drawSeabed(): void {
    const { w, h, seabed } = this;
    seabed.clear();
    seabed.poly([0, h, 0, h - 46, w * 0.18, h - 72, w * 0.4, h - 40, w * 0.62, h - 66, w * 0.85, h - 36, w, h - 58, w, h]).fill({ color: 0x0a1a2a, alpha: 0.9 });
    seabed.poly([0, h, 0, h - 26, w * 0.12, h - 44, w * 0.22, h - 20, w * 0.3, h - 34, w * 0.4, h - 14, 0, h]).fill(0x061119);
    seabed.poly([w, h, w, h - 30, w * 0.88, h - 52, w * 0.78, h - 22, w * 0.68, h - 36, w * 0.58, h - 12, w, h]).fill(0x061119);
    // 石块
    for (const [kx, kw] of [[w * 0.15, 40], [w * 0.52, 56], [w * 0.8, 36]] as [number, number][]) {
      seabed.ellipse(kx, h - 18, kw, kw * 0.4).fill({ color: 0x0d2438, alpha: 0.95 });
      seabed.ellipse(kx - kw * 0.2, h - 24, kw * 0.5, kw * 0.18).fill({ color: 0x17364d, alpha: 0.6 });
    }
  }

  private buildWeeds(): void {
    this.weedSeeds.length = 0;
    const n = this.opts.lowEnd ? 5 : 9;
    for (let i = 0; i < n; i += 1) {
      const x = (i + 0.5) * (this.w / n) + ((i * 37) % 23) - 11;
      this.weedSeeds.push({ x, h: 40 + ((i * 53) % 46), w: 3 + (i % 3), phase: i * 0.9, color: i % 2 ? 0x14382e : 0x1a4a3a });
    }
    this.drawWeeds(0);
  }

  private drawWeeds(t: number): void {
    const g = this.weeds;
    g.clear();
    const still = this.opts.reduceMotion();
    for (const s of this.weedSeeds) {
      const segs = 6;
      let x = s.x;
      let y = this.h;
      g.moveTo(x, y);
      for (let i = 1; i <= segs; i += 1) {
        const p = i / segs;
        const sway = still ? 0 : Math.sin(t * 1.1 + s.phase + p * 2.2) * 9 * p * p;
        const nx = s.x + sway + Math.sin(p * 3 + s.phase) * 2;
        const ny = this.h - s.h * p;
        g.quadraticCurveTo(x + (nx - x) * 0.4, y - s.h / segs / 2, nx, ny);
        x = nx;
        y = ny;
      }
      g.stroke({ color: s.color, width: s.w, cap: 'round' });
      // 叶片
      for (let i = 2; i <= segs; i += 2) {
        const p = i / segs;
        const sway = still ? 0 : Math.sin(t * 1.1 + s.phase + p * 2.2) * 9 * p * p;
        g.ellipse(s.x + sway + 7 * (i % 4 ? 1 : -1), this.h - s.h * p, 7, 3).fill({ color: s.color, alpha: 0.8 });
      }
    }
  }

  private buildMotes(): void {
    const mk = (arr: Particle[], layer: Container, n: number, size: number, alpha: number): void => {
      for (const p of arr) p.g.destroy();
      arr.length = 0;
      for (let i = 0; i < n; i += 1) {
        const g = new Graphics();
        g.circle(0, 0, size * (0.6 + Math.random() * 0.8)).fill({ color: 0xbfe8f2, alpha });
        g.position.set(Math.random() * this.w, Math.random() * this.h);
        layer.addChild(g);
        arr.push({ g, vx: (Math.random() - 0.5) * 0.12, vy: -(0.08 + Math.random() * 0.14), life: 0, ttl: Infinity });
      }
    };
    mk(this.farMotes, this.far, this.opts.lowEnd ? 18 : 42, 1.1, 0.16);
    mk(this.nearMotes, this.near, this.opts.lowEnd ? 8 : 18, 2.0, 0.1);
  }

  /** 冒一个气泡（鱼尾迹 / 海床 / 击杀） */
  emitBubble(x: number, y: number, r = 2 + Math.random() * 3, speed = 0.5): void {
    if (this.bubbles.length >= (this.opts.lowEnd ? 24 : 60)) return;
    let g = this.bubblePool.pop();
    if (!g) {
      g = new Graphics();
      this.near.addChild(g);
    }
    g.clear();
    g.circle(0, 0, r).stroke({ color: 0xbfe4f2, width: 1, alpha: 0.5 });
    g.circle(-r * 0.3, -r * 0.3, r * 0.3).fill({ color: 0xffffff, alpha: 0.45 });
    g.position.set(x, y);
    g.visible = true;
    g.alpha = 1;
    this.bubbles.push({ g, vx: (Math.random() - 0.5) * 0.3, vy: -(speed + Math.random() * 0.6), life: 0, ttl: 2600 + Math.random() * 2000 });
  }

  /** 相机偏移（视差）：由炮台瞄准角与缓慢漂移驱动 */
  setCamera(x: number, y: number): void {
    this.cam.x += (x - this.cam.x) * 0.04;
    this.cam.y += (y - this.cam.y) * 0.04;
  }

  update(nowMs: number, dtMs: number): void {
    const t = nowMs / 1000;
    const still = this.opts.reduceMotion();
    const k = dtMs / 16.67;
    this.far.position.set(this.cam.x * 0.25, this.cam.y * 0.25);
    this.mid.position.set(this.cam.x * 0.55, this.cam.y * 0.55);
    this.near.position.set(this.cam.x * 0.9, this.cam.y * 0.9);
    if (!still) {
      for (const b of this.beams) {
        b.g.alpha = 0.7 + Math.sin(t * 0.5 + b.phase) * 0.3;
        b.g.rotation = -0.12 + Math.sin(t * 0.23 + b.phase) * 0.05;
        b.g.x = b.x + Math.sin(t * 0.17 + b.phase) * 18;
      }
      // 焦散：顶部几条缓慢起伏的波线
      if (Math.floor(nowMs / 90) !== Math.floor((nowMs - dtMs) / 90)) {
        const c = this.caustics;
        c.clear();
        const step = this.w / 26;
        for (let r = 0; r < (this.opts.lowEnd ? 3 : 5); r += 1) {
          const y0 = this.h * (0.035 + r * 0.038);
          const amp = 5 - r * 0.7;
          c.moveTo(-step, y0);
          for (let i = 0; i <= 27; i += 1) c.quadraticCurveTo((i - 0.5) * step, y0 + Math.sin(t * 1.4 + i * 0.9 + r) * amp, i * step, y0);
          c.stroke({ color: 0xbfe8f2, width: 1.6 - r * 0.2, alpha: 0.13 - r * 0.02 });
        }
      }
      if (Math.floor(nowMs / 66) !== Math.floor((nowMs - dtMs) / 66)) this.drawWeeds(t);
      for (const arr of [this.farMotes, this.nearMotes]) {
        for (const p of arr) {
          p.g.x += p.vx * k + Math.sin(t + p.g.y * 0.01) * 0.05;
          p.g.y += p.vy * k;
          if (p.g.y < -6) {
            p.g.y = this.h + 6;
            p.g.x = Math.random() * this.w;
          }
        }
      }
      // 海床偶尔冒泡
      if (Math.random() < 0.012 * k) this.emitBubble(Math.random() * this.w, this.h - 20, 2 + Math.random() * 2, 0.35);
    }
    for (let i = this.bubbles.length - 1; i >= 0; i -= 1) {
      const b = this.bubbles[i]!;
      b.life += dtMs;
      b.g.x += b.vx * k + Math.sin(t * 3 + i) * 0.25;
      b.g.y += b.vy * k;
      b.g.alpha = b.life > b.ttl - 500 ? Math.max(0, (b.ttl - b.life) / 500) : 1;
      if (b.life >= b.ttl || b.g.y < -8) {
        b.g.visible = false;
        this.bubblePool.push(b.g);
        this.bubbles.splice(i, 1);
      }
    }
  }

  destroy(): void {
    this.far.destroy({ children: true });
    this.mid.destroy({ children: true });
    this.near.destroy({ children: true });
  }
}
