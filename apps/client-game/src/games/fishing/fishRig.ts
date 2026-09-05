/**
 * 鱼类骨骼式网格动画（方案 B）。
 * 每条鱼 = 一张纹理贴在 MeshPlane（头→尾 N 列 × 3 行）上，每个「局部动作帧」重算顶点：
 *   身体沿脊柱传递的正弦波（振幅从头到尾递增 → 尾部摆动最大，逐节传递，不是整图旋转）
 *   圆身（河豚）= 鼓胀呼吸；海龟 = 壳体微波 + 鳍脚划水；人形 Boss = 袍摆摆动 + 上下浮动
 * 叠加层（Graphics）：胸鳍扇动、眨眼（肤色眼皮，颜色从纹理采样）、张嘴（暗色椭圆）。
 * 状态机：spawn / swim / turn / hit / stun / escape / death —— 由 FishingView 按服务器事件驱动。
 * 局部动作按 fps 节流（普通鱼 8–12、Boss 12–18），场景移动每帧插值，二者互不影响。
 */
import { Container, Graphics, MeshPlane, Rectangle, Sprite, Texture } from 'pixi.js';
import { contentBounds } from '../../assets/bounds.js';

export type FishState = 'spawn' | 'swim' | 'turn' | 'hit' | 'stun' | 'escape' | 'death';
export type BodyKind = 'fish' | 'round' | 'turtle' | 'humanoid';

export interface RigSpec {
  key: string;
  /** 内容显示宽度（px，按纹理内容包围盒计） */
  w: number;
  tint?: number;
  boss?: boolean;
  body: BodyKind;
  /** 网格列数（头→尾） */
  segments: number;
  /** 身体波幅 / 尾部附加波幅（相对内容高度） */
  waveAmp: number;
  tailAmp: number;
  /** 摆尾频率 Hz */
  freq: number;
  /** 局部动作帧率 */
  fps: number;
  /** 眼 / 嘴 / 鳍锚点：内容框归一化坐标（素材一律朝右） */
  eye?: [number, number];
  eye2?: [number, number];
  mouth?: [number, number];
  fins?: { x: number; y: number; len: number; dir: 1 | -1 }[];
  shadow?: boolean;
  /**
   * 方案 A：帧序列 sprite sheet（8–16 帧游泳循环，尺寸中心一致、透明、无跳动）。
   * 配置后局部动作改为逐帧播放（网格变形关闭，叠加层仍可用）；sheet 缺失时自动退回网格骨骼。
   */
  frames?: { key: string; cols: number; rows: number; count: number; fps: number };
}

/* 纹理像素采样（眼皮 / 鳍配色取自素材本身） */
const sampleCache = new WeakMap<Texture, { data: Uint8ClampedArray; w: number; h: number } | null>();
function samplePixels(texture: Texture): { data: Uint8ClampedArray; w: number; h: number } | null {
  if (sampleCache.has(texture)) return sampleCache.get(texture)!;
  let out: { data: Uint8ClampedArray; w: number; h: number } | null = null;
  try {
    const res = (texture.source as unknown as { resource?: CanvasImageSource }).resource;
    const w = texture.source.pixelWidth;
    const h = texture.source.pixelHeight;
    if (res && w && h) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(res, 0, 0);
        out = { data: ctx.getImageData(0, 0, w, h).data, w, h };
      }
    }
  } catch {
    out = null;
  }
  sampleCache.set(texture, out);
  return out;
}
function sampleColor(texture: Texture, nx: number, ny: number, fallback: number): number {
  const px = samplePixels(texture);
  if (!px) return fallback;
  const b = contentBounds(texture);
  const sx = px.w / texture.width;
  const x = Math.round((b.x + nx * b.w) * sx);
  const y = Math.round((b.y + ny * b.h) * sx);
  // 3×3 平均，避开透明像素
  let r = 0;
  let g = 0;
  let bl = 0;
  let n = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const xx = Math.min(px.w - 1, Math.max(0, x + dx));
      const yy = Math.min(px.h - 1, Math.max(0, y + dy));
      const i = (yy * px.w + xx) * 4;
      if (px.data[i + 3]! < 60) continue;
      r += px.data[i]!;
      g += px.data[i + 1]!;
      bl += px.data[i + 2]!;
      n += 1;
    }
  }
  if (!n) return fallback;
  return ((r / n) << 16) | ((g / n) << 8) | (bl / n);
}
const darken = (c: number, k: number): number => ((((c >> 16) & 255) * k) << 16) | ((((c >> 8) & 255) * k) << 8) | ((c & 255) * k);

export class FishRig {
  /** 世界位置 / 路径朝向 */
  readonly node = new Container();
  /** 镜像与状态位移（scale.x = 朝向） */
  readonly body = new Container();
  mesh: MeshPlane | null = null;
  /** 帧序列模式（方案 A）：逐帧精灵，代替网格变形 */
  private frameSprite: Sprite | null = null;
  private frameTextures: Texture[] = [];
  private frameIdx = 0;
  private base: Float32Array | null = null;
  private cols = 0;
  private rows = 0;
  /** 内容框（纹理坐标） */
  private bx = 0;
  private by = 0;
  private bw = 1;
  private bh = 1;
  private scale = 1;
  private readonly overlay = new Graphics();
  private shadow: Graphics | null = null;
  spec!: RigSpec;
  state: FishState = 'spawn';
  stateAt = 0;
  facing: 1 | -1 = 1;
  private targetFacing: 1 | -1 = 1;
  private turnStart = 0;
  phase = Math.random() * Math.PI * 2;
  private localAt = 0;
  private localT = 0;
  private nextBlink = 0;
  private blinkUntil = 0;
  private nextMouth = 0;
  private mouthUntil = 0;
  private skin = 0xd08a40;
  private finColor = 0xf0a050;
  private hitDx = 0;
  private hitDy = 0;
  /** Boss 低血量愤怒（外部设置） */
  angry = false;
  tintBase = 0xffffff;
  /** 局部动作速度倍率（转向 / 逃逸 / 愤怒时提高） */
  private wagBoost = 1;
  private lowEnd = false;

  constructor() {
    this.node.addChild(this.body);
  }

  setup(spec: RigSpec, texture: Texture, lowEnd: boolean, nowMs: number, initialAngle = 0, sheet?: Texture): void {
    this.spec = spec;
    this.lowEnd = lowEnd;
    this.tintBase = spec.tint ?? 0xffffff;
    const b = contentBounds(texture);
    this.bx = b.x;
    this.by = b.y;
    this.bw = b.w;
    this.bh = b.h;
    this.scale = spec.w / b.w;
    const cols = Math.max(6, lowEnd ? Math.round(spec.segments * 0.6) : spec.segments);
    const rows = 3;
    if (this.mesh) {
      this.mesh.destroy();
      this.mesh = null;
    }
    if (this.frameSprite) {
      this.frameSprite.destroy();
      this.frameSprite = null;
    }
    this.frameTextures = [];
    this.body.removeChildren();
    // 方案 A：帧序列（sheet 有效时）
    if (spec.frames && sheet && sheet.width > 0) {
      const fw = sheet.width / spec.frames.cols;
      const fh = sheet.height / spec.frames.rows;
      for (let i = 0; i < spec.frames.count; i += 1) {
        const fx = (i % spec.frames.cols) * fw;
        const fy = Math.floor(i / spec.frames.cols) * fh;
        this.frameTextures.push(new Texture({ source: sheet.source, frame: new Rectangle(sheet.frame.x + fx, sheet.frame.y + fy, fw, fh) }));
      }
      const first = this.frameTextures[0]!;
      const fb = contentBounds(first);
      this.bx = fb.x;
      this.by = fb.y;
      this.bw = fb.w;
      this.bh = fb.h;
      this.scale = spec.w / fb.w;
      this.frameSprite = new Sprite(first);
      this.frameSprite.anchor.set(fb.cx, fb.cy);
      this.frameSprite.scale.set(this.scale);
      this.frameSprite.tint = this.tintBase;
      this.frameIdx = Math.floor(Math.random() * this.frameTextures.length);
    }
    this.mesh = new MeshPlane({ texture, verticesX: cols, verticesY: rows });
    this.mesh.visible = !this.frameSprite;
    this.cols = cols;
    this.rows = rows;
    const buf = this.mesh.geometry.getAttribute('aPosition').buffer;
    this.base = Float32Array.from(buf.data as Float32Array);
    this.mesh.pivot.set(b.x + b.w / 2, b.y + b.h / 2);
    this.mesh.scale.set(this.scale);
    this.mesh.tint = this.tintBase;
    if (spec.shadow && !lowEnd) {
      this.shadow = new Graphics();
      this.shadow.ellipse(0, 0, spec.w * 0.42, spec.w * 0.09).fill({ color: 0x000000, alpha: 0.28 });
      this.shadow.y = (b.h * this.scale) * 0.55;
      this.body.addChild(this.shadow);
    } else this.shadow = null;
    if (this.frameSprite) this.body.addChild(this.frameSprite);
    this.body.addChild(this.mesh, this.overlay);
    this.overlay.scale.set(this.scale);
    this.overlay.position.set(-(b.w * this.scale) / 2, -(b.h * this.scale) / 2); // 叠加层用内容框归一化坐标
    this.skin = sampleColor(texture, spec.eye ? Math.max(0, spec.eye[0] - 0.06) : 0.5, spec.eye ? spec.eye[1] + 0.06 : 0.5, 0xd08a40);
    this.finColor = spec.fins?.length ? sampleColor(texture, spec.fins[0]!.x, spec.fins[0]!.y, this.skin) : this.skin;
    this.node.alpha = 1;
    this.node.rotation = 0;
    this.body.rotation = 0;
    this.body.scale.set(1);
    this.body.position.set(0, 0);
    this.body.visible = true;
    // 出生朝向直接取路径方向，不做出生翻转
    const f0: 1 | -1 = Number.isNaN(initialAngle) || Math.cos(initialAngle) >= 0 ? 1 : -1;
    this.facing = f0;
    this.targetFacing = f0;
    this.body.scale.x = f0;
    this.phase = Math.random() * Math.PI * 2;
    this.localT = 0;
    this.localAt = 0;
    this.angry = false;
    this.wagBoost = 1;
    this.nextBlink = nowMs + 1500 + Math.random() * 3000;
    this.nextMouth = nowMs + 2000 + Math.random() * 4000;
    this.setState('spawn', nowMs);
  }

  setState(s: FishState, nowMs: number): void {
    if (this.state === 'death') return;
    this.state = s;
    this.stateAt = nowMs;
    if (s === 'escape') this.wagBoost = 2.1;
    else if (s === 'turn') this.wagBoost = 1.7;
    else if (s !== 'hit') this.wagBoost = 1;
  }

  /** 由路径朝向驱动：角度变化平滑，左右翻转走 turn 状态（减速 → 转头 → 尾部跟上 → 加速） */
  faceTo(angle: number, nowMs: number): void {
    if (Number.isNaN(angle)) return;
    const wantFacing: 1 | -1 = Math.cos(angle) >= -0.12 ? (Math.cos(angle) > 0.12 ? 1 : this.targetFacing) : -1;
    if (wantFacing !== this.targetFacing && this.state !== 'death') {
      this.targetFacing = wantFacing;
      this.turnStart = nowMs;
      this.setState('turn', nowMs);
    }
    // 相对朝向的俯仰角（镜像时取反），限制 ±35°
    const pitch = this.facing === 1 ? angle : Math.atan2(Math.sin(angle), -Math.cos(angle));
    const target = Math.max(-0.6, Math.min(0.6, this.spec.body === 'humanoid' ? pitch * 0.25 : pitch * 0.8));
    this.node.rotation += (target - this.node.rotation) * 0.12;
  }

  /** 受击：闪白 + 局部光效 + 轻微位移（不瞬间消失） */
  hit(nowMs: number, fromAngle: number): void {
    if (this.state === 'death') return;
    this.hitDx = Math.cos(fromAngle) * 7;
    this.hitDy = Math.sin(fromAngle) * 7;
    this.setState('hit', nowMs);
  }

  /** 尾部世界坐标（气泡尾迹用） */
  tailPoint(): { x: number; y: number } {
    const lx = (-this.bw * this.scale) / 2 * this.facing;
    const c = Math.cos(this.node.rotation);
    const s = Math.sin(this.node.rotation);
    return { x: this.node.x + lx * c, y: this.node.y + lx * s };
  }

  private setTint(c: number): void {
    if (this.mesh) this.mesh.tint = c;
    if (this.frameSprite) this.frameSprite.tint = c;
  }

  /** @returns death 动画是否已结束（外部回收） */
  update(nowMs: number, dtMs: number, moveSpeed: number, frozen: boolean): boolean {
    if (!this.mesh || !this.base) return false;
    const spec = this.spec;
    const sinceState = nowMs - this.stateAt;
    let finished = false;

    // ── 状态表现 ──
    if (this.state === 'spawn') {
      const p = Math.min(1, sinceState / 260);
      this.node.alpha = p;
      this.body.scale.set(0.7 + 0.3 * p);
      if (p >= 1) this.setState('swim', nowMs);
    } else if (this.state === 'turn') {
      const p = Math.min(1, (nowMs - this.turnStart) / 380);
      // 透视翻面：scale.x 从 facing 经 0.18 到 targetFacing
      const k = p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
      const sx = Math.max(0.18, k);
      if (p >= 0.5) this.facing = this.targetFacing;
      this.body.scale.x = sx * this.facing;
      this.body.scale.y = 1;
      if (p >= 1) {
        this.body.scale.x = this.facing;
        this.setState('swim', nowMs);
      }
    } else if (this.state === 'hit') {
      const p = Math.min(1, sinceState / 170);
      this.body.position.set(this.hitDx * (1 - p), this.hitDy * (1 - p));
      this.setTint(p < 0.45 ? 0xffffff : this.tintBase);
      if (p >= 1) {
        this.body.position.set(0, 0);
        this.setState('swim', nowMs);
      }
    } else if (this.state === 'death') {
      const p = Math.min(1, sinceState / 640);
      const e = p * p;
      this.body.rotation = this.facing * (Math.PI * 0.55) * Math.min(1, p * 1.6);
      this.body.position.y = 46 * e;
      this.setTint(darken(this.tintBase, 1 - 0.55 * p));
      this.node.alpha = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45;
      finished = p >= 1;
    } else if (this.state === 'escape') {
      if (sinceState > 900) this.setState('swim', nowMs);
    }
    if (this.state === 'swim' || this.state === 'escape') {
      this.body.scale.set(this.facing, 1);
      if (!frozen) this.setTint(this.angry && Math.floor(nowMs / 220) % 2 === 0 ? 0xff9a8a : this.tintBase);
    }
    if (frozen && this.state !== 'death') {
      this.setTint(0x9fd8ff);
      return finished; // 冰冻：局部动作暂停
    }
    if (this.state === 'stun') this.setState('swim', nowMs);

    // ── 局部动作（按 fps 节流，游速快 / 逃逸 / 愤怒时更快） ──
    const fps = spec.fps * (this.angry ? 1.3 : 1);
    const boost = this.wagBoost * (0.75 + Math.min(1.6, moveSpeed) * 0.5) * (this.angry ? 1.4 : 1);
    this.localT += dtMs * boost;
    if (nowMs - this.localAt < 1000 / fps && this.state !== 'death') return finished;
    this.localAt = nowMs;
    if (this.frameSprite && this.frameTextures.length) {
      // 帧序列：按 sheet 自身 fps × 游速倍率推进（循环衔接）
      const fr = this.spec.frames!;
      this.frameIdx = Math.floor((this.localT / 1000) * fr.fps) % this.frameTextures.length;
      this.frameSprite.texture = this.frameTextures[this.frameIdx]!;
    } else this.deform(this.localT / 1000);
    this.drawOverlay(nowMs, this.localT / 1000);
    return finished;
  }

  /** 顶点变形：脊柱正弦波沿头→尾传递 */
  private deform(t: number): void {
    const mesh = this.mesh!;
    const base = this.base!;
    const spec = this.spec;
    const buf = mesh.geometry.getAttribute('aPosition').buffer;
    const data = buf.data as Float32Array;
    const w = 2 * Math.PI * spec.freq;
    const cols = this.cols;
    const rows = this.rows;
    const headX = this.bx + this.bw; // 头在右
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const i = (r * cols + c) * 2;
        const x0 = base[i]!;
        const y0 = base[i + 1]!;
        // s：0 = 头，1 = 尾（按内容框）
        const s = Math.min(1, Math.max(0, (headX - x0) / this.bw));
        const ny = Math.min(1, Math.max(0, (y0 - this.by) / this.bh));
        let dx = 0;
        let dy = 0;
        if (spec.body === 'fish') {
          const amp = (spec.waveAmp * Math.pow(s, 1.7) + spec.tailAmp * Math.pow(s, 4)) * this.bh;
          dy = Math.sin(w * t + this.phase - s * 2.6) * amp;
          dx = -Math.abs(dy) * 0.35 * s; // 弯曲时尾部略缩短
        } else if (spec.body === 'round') {
          // 鼓胀呼吸：以内容中心为圆心的径向缩放 ±3%，尾部小幅摆动
          const cx = this.bx + this.bw / 2;
          const cy = this.by + this.bh / 2;
          const k = 1 + Math.sin(w * 0.6 * t + this.phase) * 0.03;
          dx = (x0 - cx) * (k - 1);
          dy = (y0 - cy) * (k - 1) + Math.sin(w * t + this.phase - s * 2) * spec.tailAmp * this.bh * Math.pow(s, 3);
        } else if (spec.body === 'turtle') {
          // 壳体微波 + 鳍脚划水（下 35% 区域、身体中段）
          dy = Math.sin(w * t + this.phase - s * 2) * spec.waveAmp * this.bh * Math.pow(s, 2);
          if (ny > 0.62 && s > 0.25 && s < 0.85) dy += Math.sin(w * 1.2 * t + this.phase + s * 4) * spec.tailAmp * this.bh * (ny - 0.62) * 2.2;
        } else {
          // 人形：上下浮动 + 袍摆（下 45%）摆动
          dy = Math.sin(w * 0.5 * t + this.phase) * spec.waveAmp * this.bh;
          if (ny > 0.55) dx = Math.sin(w * 0.8 * t + this.phase + ny * 3) * spec.tailAmp * this.bw * (ny - 0.55);
        }
        data[i] = x0 + dx;
        data[i + 1] = y0 + dy;
      }
    }
    buf.update();
  }

  /** 叠加层：胸鳍扇动 / 眨眼 / 张嘴（内容框归一化坐标 → 纹理坐标） */
  private drawOverlay(nowMs: number, t: number): void {
    const g = this.overlay;
    const spec = this.spec;
    g.clear();
    if (this.lowEnd && !spec.boss) return;
    const X = (nx: number): number => this.bx + nx * this.bw - this.bx; // 相对内容框
    const Y = (ny: number): number => ny * this.bh;
    const wf = 2 * Math.PI * spec.freq * 1.5;
    for (const f of spec.fins ?? []) {
      const len = f.len * this.bh;
      const a = Math.sin(wf * t + this.phase) * 0.5;
      const cx = X(f.x);
      const cy = Y(f.y);
      const dir = f.dir;
      // 三角鳍：根部在锚点，尖端随扇动摆动
      const tipX = cx - Math.cos(a * 0.6) * len * 0.9;
      const tipY = cy + Math.sin(a) * len * dir + len * 0.55 * dir;
      g.poly([cx, cy, cx - len * 0.28, cy + len * 0.18 * dir, tipX, tipY, cx - len * 0.05, cy + len * 0.5 * dir]).fill({ color: this.finColor, alpha: 0.82 });
      g.poly([cx, cy, cx - len * 0.28, cy + len * 0.18 * dir, tipX, tipY]).stroke({ color: darken(this.finColor, 0.6), width: 1.2 / this.scale, alpha: 0.6 });
    }
    // 眨眼：肤色眼皮盖住眼睛 80–120ms
    if (spec.eye) {
      if (nowMs >= this.nextBlink) {
        this.blinkUntil = nowMs + 90 + Math.random() * 40;
        this.nextBlink = nowMs + 2200 + Math.random() * 3800;
      }
      if (nowMs < this.blinkUntil) {
        const r = Math.max(4, this.bh * 0.085);
        for (const e of [spec.eye, spec.eye2].filter(Boolean) as [number, number][]) g.ellipse(X(e[0]), Y(e[1]), r * 1.15, r * 0.95).fill({ color: this.skin, alpha: 0.98 });
      }
    }
    // 张嘴：暗色椭圆逐渐张开 220ms 再合上
    if (spec.mouth) {
      if (nowMs >= this.nextMouth) {
        this.mouthUntil = nowMs + (spec.boss ? 520 : 300);
        this.nextMouth = nowMs + 2600 + Math.random() * 4200;
      }
      if (nowMs < this.mouthUntil || this.angry) {
        const total = spec.boss ? 520 : 300;
        const p = this.angry ? 0.7 + Math.sin(t * 6) * 0.3 : Math.sin(Math.min(1, (total - (this.mouthUntil - nowMs)) / total) * Math.PI);
        const rw = this.bw * (spec.boss ? 0.06 : 0.05);
        g.ellipse(X(spec.mouth[0]), Y(spec.mouth[1]), rw, rw * 0.75 * Math.max(0.05, p)).fill({ color: 0x2a0b0b, alpha: 0.85 });
      }
    }
    // 受击局部光效
    if (this.state === 'hit') {
      const p = Math.min(1, (nowMs - this.stateAt) / 170);
      g.circle(X(0.5), Y(0.5), this.bw * (0.35 + p * 0.25)).stroke({ color: 0xfff3c4, width: 3 / this.scale, alpha: 0.9 * (1 - p) });
    }
  }

  destroy(): void {
    this.frameSprite?.destroy();
    this.mesh?.destroy();
    this.overlay.destroy();
    this.node.destroy({ children: true });
  }
}

/** 各鱼种绑定参数（素材一律朝右；眼 / 嘴 / 鳍锚点按素材内容框归一化） */
export const FISH_RIGS: Record<string, RigSpec> = {
  sardine: { key: 'fishClown', w: 64, tint: 0xa9d6ff, body: 'fish', segments: 10, waveAmp: 0.05, tailAmp: 0.16, freq: 2.6, fps: 12, eye: [0.8, 0.42], mouth: [0.98, 0.62], fins: [{ x: 0.55, y: 0.62, len: 0.22, dir: 1 }] },
  clown: { key: 'fishClown', w: 84, body: 'fish', segments: 12, waveAmp: 0.05, tailAmp: 0.15, freq: 2.2, fps: 12, eye: [0.8, 0.42], mouth: [0.98, 0.62], fins: [{ x: 0.55, y: 0.62, len: 0.24, dir: 1 }] },
  butterfly: { key: 'fishClown', w: 92, tint: 0xffe58a, body: 'fish', segments: 12, waveAmp: 0.06, tailAmp: 0.14, freq: 2.0, fps: 11, eye: [0.8, 0.42], mouth: [0.98, 0.62], fins: [{ x: 0.55, y: 0.62, len: 0.26, dir: 1 }] },
  puffer: { key: 'fishPuffer', w: 110, body: 'round', segments: 10, waveAmp: 0.02, tailAmp: 0.1, freq: 1.6, fps: 10, eye: [0.56, 0.3], eye2: [0.85, 0.36], mouth: [0.68, 0.53], fins: [{ x: 0.5, y: 0.7, len: 0.16, dir: 1 }] },
  lionfish: { key: 'fishPuffer', w: 120, tint: 0xff9a86, body: 'round', segments: 10, waveAmp: 0.025, tailAmp: 0.12, freq: 1.8, fps: 10, eye: [0.56, 0.3], eye2: [0.85, 0.36], mouth: [0.68, 0.53], fins: [{ x: 0.5, y: 0.7, len: 0.18, dir: 1 }] },
  ray: { key: 'fishTurtle', w: 140, tint: 0xb39cff, body: 'turtle', segments: 12, waveAmp: 0.05, tailAmp: 0.12, freq: 1.2, fps: 10, eye: [0.83, 0.2], mouth: [0.98, 0.32] },
  turtle: { key: 'fishTurtle', w: 160, body: 'turtle', segments: 12, waveAmp: 0.03, tailAmp: 0.1, freq: 1.0, fps: 9, eye: [0.83, 0.2], mouth: [0.98, 0.32], shadow: true },
  shark: { key: 'fishShark01', w: 220, body: 'fish', segments: 14, waveAmp: 0.04, tailAmp: 0.12, freq: 1.3, fps: 10, eye: [0.68, 0.36], mouth: [0.85, 0.62], fins: [{ x: 0.42, y: 0.72, len: 0.3, dir: 1 }], shadow: true },
  goldenShark: { key: 'fishGolden', w: 200, body: 'fish', segments: 12, waveAmp: 0.04, tailAmp: 0.14, freq: 1.4, fps: 10, eye: [0.68, 0.4], mouth: [0.86, 0.62], fins: [{ x: 0.42, y: 0.7, len: 0.28, dir: 1 }], shadow: true },
  whale: { key: 'fishSharkPurple', w: 320, boss: true, body: 'fish', segments: 16, waveAmp: 0.05, tailAmp: 0.14, freq: 0.9, fps: 14, eye: [0.92, 0.42], mouth: [0.98, 0.55], fins: [{ x: 0.5, y: 0.75, len: 0.3, dir: 1 }], shadow: true },
  dragonKing: { key: 'bossCaishenFish', w: 260, boss: true, body: 'humanoid', segments: 8, waveAmp: 0.025, tailAmp: 0.05, freq: 0.8, fps: 14, eye: [0.45, 0.2], eye2: [0.57, 0.2], mouth: [0.5, 0.33], shadow: true },
};
