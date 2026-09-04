<template>
  <div class="sl-root">
    <div ref="stageEl" class="stage" />

    <!-- ══ 顶栏：退出 / 四档 Jackpot / 金币 ══ -->
    <div class="hud-top">
      <GameButton round size="md" :art="exitArt" class="hback" sfx="close" @click="exit" />
      <div class="jackpots">
        <JackpotBar v-for="tier in TIERS" :key="tier" :tier="tier" :amount="jackpots[tier]" :hit="hitTier === tier" size="sm" />
      </div>
      <CurrencyBar kind="coin" :value="balance" class="hcoins" />
    </div>

    <img class="mascot" :src="mascotArt" alt="" draggable="false" />

    <transition name="pop">
      <div v-if="freeSpinsRemaining > 0" class="fs-banner">
        <img :src="bonusArt" alt="" />
        <span class="sk-outline-text">{{ t('sl.freeLeft', { n: freeSpinsRemaining }) }}</span>
      </div>
    </transition>

    <!-- ══ 控制台 ══ -->
    <div class="console">
      <div class="win-bar">
        <img :src="winFrameArt" alt="" draggable="false" />
        <AnimatedNumber class="win-num" :value="lastWin" raw :duration="700" />
      </div>
      <BetStepper v-model="betPerLine" :options="betOptions" skin="slot" :format="fmtTotal" :disabled="spinning || freeSpinsRemaining > 0" class="bet" />
      <div class="total">
        <span class="t-label">{{ t('sl.bet') }}</span>
        <span class="t-val num">{{ fmt(betPerLine) }}</span>
        <span class="t-lines">{{ t('sl.lines') }} {{ LINES }}</span>
      </div>
      <GameButton :art="maxBetArt" size="md" class="ctl" :disabled="spinning || freeSpinsRemaining > 0" @click="maxBet" />
      <GameButton :art="turboArt" size="md" class="ctl" :class="{ on: turbo }" sfx="toggle" @click="turbo = !turbo" />
      <GameButton :art="autoArt" size="md" class="ctl" :class="{ on: autoSpin }" sfx="toggle" @click="toggleAutoSpin">
        <span v-if="autoSpin" class="auto-n num">{{ autoLeft }}</span>
      </GameButton>
      <GameButton v-if="ticketQty > 0" variant="green" size="md" :icon="bonusArt" :badge="ticketQty" :disabled="spinning" sfx="confirm" @click="useTicket">{{ t('sl.ticket') }}</GameButton>
      <button class="spin" :class="{ spinning }" :disabled="spinning && !autoSpin" type="button" @click="onSpin">
        <img :src="spinArt" alt="" draggable="false" />
        <span v-if="spinning" class="spin-ring" />
      </button>
    </div>
    <RewardAnimation ref="reward" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Application, Container, Graphics, Rectangle, Sprite, Text, type Texture } from 'pixi.js';
import { Ev } from '@yanbian/protocol';
import { gameSocket } from '../../net/ws.js';
import { useUserStore } from '../../stores/user.js';
import { t } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import { fmt } from '../../ui/format.js';
import { asset, pixiTextures, release } from '../../assets/assets.js';
import { contentBounds } from '../../assets/bounds.js';
import { audio } from '../../audio/AudioManager.js';
import GameButton from '../../ui/GameButton.vue';
import CurrencyBar from '../../ui/CurrencyBar.vue';
import BetStepper from '../../ui/BetStepper.vue';
import JackpotBar from '../../ui/JackpotBar.vue';
import AnimatedNumber from '../../ui/AnimatedNumber.vue';
import RewardAnimation from '../../ui/RewardAnimation.vue';

type Tier = 'grand' | 'major' | 'minor' | 'mini';
const TIERS: Tier[] = ['grand', 'major', 'minor', 'mini'];
const LINES = 20;
const COLS = 5;
const ROWS = 3;

const router = useRouter();
const user = useUserStore();
const stageEl = ref<HTMLDivElement | null>(null);
const reward = ref<InstanceType<typeof RewardAnimation> | null>(null);
const balance = ref(user.me?.coins ?? 0);
const betOptions = ref<number[]>([100, 200, 500, 1000]);
const betPerLine = ref(100);
const lastWin = ref(0);
const spinning = ref(false);
const autoSpin = ref(false);
const autoLeft = ref(0);
const turbo = ref(false);
const freeSpinsRemaining = ref(0);
const ticketQty = ref(0);
const jackpots = ref<Record<Tier, number>>({ grand: 0, major: 0, minor: 0, mini: 0 });
const hitTier = ref<Tier | ''>('');

const exitArt = asset('common', 'btnExitRound');
const mascotArt = asset('slots', 'caishenIngot');
const fmtTotal = (v: number): string => fmt(v * LINES);
const bonusArt = asset('slots', 'slotBonus');
const winFrameArt = asset('slots', 'winFrame');
const maxBetArt = asset('slots', 'btnMaxBet');
const turboArt = asset('slots', 'btnTurbo');
const autoArt = asset('slots', 'btnAuto');
const spinArt = asset('slots', 'btnSpin');
const SYMBOL_KEY: Record<string, string> = {
  CHERRY: 'slotCherry',
  LEMON: 'slotLemon',
  ORANGE: 'slotOrange',
  GRAPE: 'slotGrape',
  MELON: 'slotWatermelon',
  BAR: 'slotBar',
  DIAMOND: 'slotDiamond',
  SEVEN: 'slotSeven',
  GOLD: 'slotGold',
  WILD: 'slotWild',
  BONUS: 'slotBonus',
};
const RANDOM_SYMS = Object.keys(SYMBOL_KEY);
const rnd = (): string => RANDOM_SYMS[Math.floor(Math.random() * RANDOM_SYMS.length)]!;

let app: Application | null = null;
let tex: Record<string, Texture> = {};
let reels: Container[] = [];
let winLineLayer: Graphics | null = null;
let highlightLayer: Container | null = null;
let reelMaskRef: Graphics | null = null;
let cellW = 96;
let cellH = 86;
let originX = 0;
let originY = 0;
let paytableLines: number[][] = [];
let destroyed = false;
let lastGrid: string[][] = [];
const offs: (() => void)[] = [];

/** 符号 = 独立透明图标（不画方框底板），按内容包围盒等比缩放、居中；WILD / BONUS 加柔光晕与程序文字标签（不烙进图片） */
function makeSymbol(sym: string): Container {
  const c = new Container();
  const special = sym === 'WILD' || sym === 'BONUS';
  if (special) {
    const halo = new Graphics();
    halo.circle(0, 0, Math.min(cellW, cellH) * 0.44).fill({ color: sym === 'WILD' ? 0xffd25a : 0xc77dff, alpha: 0.16 });
    c.addChild(halo);
  }
  const texture = tex[SYMBOL_KEY[sym] ?? 'slotCherry'];
  if (texture) {
    const b = contentBounds(texture);
    const s = new Sprite(texture);
    s.anchor.set(b.cx, b.cy);
    const fit = Math.min((cellW * 0.8) / b.w, (cellH * (special ? 0.62 : 0.8)) / b.h);
    s.scale.set(fit);
    if (special) s.y = -cellH * 0.08;
    c.addChild(s);
  }
  if (special) {
    const label = new Text({
      text: sym,
      style: { fontSize: Math.max(10, Math.round(cellH * 0.17)), fontWeight: '900', fill: sym === 'WILD' ? 0xffe27a : 0xf3d1ff, stroke: { color: 0x2a1500, width: 3 }, letterSpacing: 1 },
    });
    label.anchor.set(0.5);
    label.y = cellH * 0.33;
    c.addChild(label);
  }
  return c;
}

/** 每列构建符号带（顶部+可视+底部缓冲），旋转时纵向滚动 */
function fillReel(col: number, symbols: string[]): void {
  const reel = reels[col]!;
  reel.removeChildren().forEach((ch) => ch.destroy({ children: true }));
  for (let i = 0; i < symbols.length; i += 1) {
    const node = makeSymbol(symbols[i]!);
    node.y = (i + 0.5) * cellH;
    reel.addChild(node);
  }
}

/** 按竞品分析的 Spin 节奏：弹射加速 → 匀速滚动 → 逐列错峰停 + 回弹；极速模式压缩为 45% */
function playSpinAnimation(grid: string[][], prev: string[][] = []): Promise<void> {
  return new Promise((resolve) => {
    if (!app) {
      resolve();
      return;
    }
    winLineLayer?.clear();
    highlightLayer?.removeChildren().forEach((ch) => ch.destroy());
    audio.sfx('spin', { volume: 0.6 });
    const speed = turbo.value ? 0.45 : 1;
    const startAt = performance.now();
    const stopDelays = [900, 1020, 1140, 1260, 1380].map((d) => d * speed);
    let resolvedCols = 0;
    for (let col = 0; col < COLS; col += 1) {
      const reel = reels[col]!;
      const cur = prev[col] ?? [rnd(), rnd(), rnd()];
      const strip: string[] = [rnd(), grid[col]![0]!, grid[col]![1]!, grid[col]![2]!];
      for (let i = 0; i < 18; i += 1) strip.push(rnd());
      strip.push(cur[0]!, cur[1]!, cur[2]!, rnd());
      fillReel(col, strip);
      const totalScroll = (strip.length - 5) * cellH;
      const stopAt = stopDelays[col]!;
      let stopped = false;
      const tick = (): void => {
        if (destroyed) {
          resolve();
          return;
        }
        const now = performance.now() - startAt;
        let p: number;
        if (now < 160 * speed) {
          const k = now / (160 * speed);
          p = -0.06 * Math.sin(k * Math.PI) + 0.08 * k * k;
        } else if (now < stopAt) {
          const k = (now - 160 * speed) / (stopAt - 160 * speed);
          p = 0.08 + 0.86 * k;
        } else if (now < stopAt + 200 * speed) {
          if (!stopped) {
            stopped = true;
            audio.sfx('reelStop', { volume: 0.5, rate: 0.95 + col * 0.03 });
          }
          const k = (now - stopAt) / (200 * speed);
          p = 0.94 + 0.06 * (1 - (1 - k) * (1 - k)) + Math.sin(k * Math.PI) * 0.012;
        } else {
          reel.y = originY;
          resolvedCols += 1;
          if (resolvedCols === COLS) resolve();
          return;
        }
        reel.y = originY - totalScroll * (1 - Math.min(1.02, Math.max(-0.05, p)));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });
}

function drawWinLines(winLines: { lineIndex: number; count: number }[]): void {
  if (!winLineLayer || !highlightLayer) return;
  winLineLayer.clear();
  highlightLayer.removeChildren().forEach((ch) => ch.destroy());
  const colors = [0xffd25a, 0x7cf36a, 0xff7a68, 0x8ac8ff, 0xd59bff];
  const cells = new Set<string>();
  winLines.slice(0, 8).forEach((w, i) => {
    const rows = paytableLines[w.lineIndex];
    if (!rows) return;
    const color = colors[i % colors.length]!;
    winLineLayer!.moveTo(originX + cellW * 0.5, originY + cellH * (rows[0]! + 0.5) + cellH);
    for (let c = 0; c < COLS; c += 1) winLineLayer!.lineTo(originX + cellW * (c + 0.5), originY + cellH * (rows[c]! + 0.5) + cellH);
    winLineLayer!.stroke({ color, width: 4, alpha: 0.9 });
    winLineLayer!.stroke({ color: 0xffffff, width: 1.5, alpha: 0.6 });
    for (let c = 0; c < w.count; c += 1) cells.add(`${c}:${rows[c]}`);
  });
  // 中奖格金框脉冲
  for (const key of cells) {
    const [c, r] = key.split(':').map(Number) as [number, number];
    const g = new Graphics();
    g.roundRect(-cellW * 0.45, -cellH * 0.45, cellW * 0.9, cellH * 0.9, 12).stroke({ color: 0xffe28a, width: 4, alpha: 0.95 });
    g.position.set(originX + cellW * (c + 0.5), originY + cellH * (r + 0.5) + cellH);
    highlightLayer.addChild(g);
    const s0 = performance.now();
    const pulse = (): void => {
      if (destroyed || g.destroyed) return;
      const k = ((performance.now() - s0) / 600) % 1;
      g.scale.set(1 + Math.sin(k * Math.PI) * 0.06);
      g.alpha = 0.7 + Math.sin(k * Math.PI) * 0.3;
      requestAnimationFrame(pulse);
    };
    requestAnimationFrame(pulse);
  }
}

function layout(): void {
  if (!app) return;
  const w = app.renderer.width;
  const h = app.renderer.height;
  // 顶部留 Jackpot 条、底部留控制台（DOM 层），机台在中间自适应
  const topSafe = Math.max(96, h * 0.15);
  const bottomSafe = Math.max(120, h * 0.2);
  const cell = Math.min((w - 60) / COLS, ((h - topSafe - bottomSafe) / ROWS) * 1.05, 220);
  cellW = cell;
  cellH = cell / 1.05;
  originX = (w - cellW * COLS) / 2;
  originY = topSafe + (h - topSafe - bottomSafe - cellH * ROWS) / 2 - cellH;
  reels.forEach((reel, col) => {
    reel.x = originX + cellW * (col + 0.5);
    reel.y = originY;
  });
  if (reelMaskRef) {
    reelMaskRef.clear();
    // 遮罩严格贴合可见三行：符号带上下的缓冲格在任何格尺寸下都不可见
    reelMaskRef.roundRect(originX - 4, originY + cellH, cellW * COLS + 8, cellH * ROWS, 10).fill(0xffffff);
  }
}

function setBalance(v: number): void {
  balance.value = v;
  user.setBalance(v);
}

async function onSpin(): Promise<void> {
  if (spinning.value) return;
  const cost = betPerLine.value * LINES;
  if (freeSpinsRemaining.value <= 0 && balance.value < cost) {
    toast(t('error.INSUFFICIENT_BALANCE'), 'error');
    autoSpin.value = false;
    return;
  }
  spinning.value = true;
  lastWin.value = 0;
  try {
    const r = await gameSocket.call<any>(Ev.SlSpin, { betPerLine: betPerLine.value, lines: LINES }, 15000);
    const prev = lastGrid;
    lastGrid = r.grid ?? lastGrid;
    await playSpinAnimation(lastGrid, prev);
    lastWin.value = r.totalWin;
    setBalance(r.balance);
    freeSpinsRemaining.value = r.freeSpinsRemaining ?? 0;
    if (r.jackpots) jackpots.value = r.jackpots;
    drawWinLines(r.winLines ?? []);
    if (r.totalWin > 0) audio.sfx(r.tier === 'normal' ? 'coin' : 'win', { volume: 0.7 });
    if (r.jackpotHit) {
      hitTier.value = r.jackpotHit.tier;
      audio.sfx('jackpot');
      await new Promise<void>((res) => {
        reward.value?.play({ amount: r.jackpotHit.amount, tier: 'epic', banner: winFrameArt, caption: `${String(r.jackpotHit.tier).toUpperCase()} ${t('sl.jackpotHit')}`, duration: 2600 });
        setTimeout(res, 4200);
      });
      hitTier.value = '';
    } else if (r.tier === 'big' || r.tier === 'mega' || r.tier === 'epic') {
      await new Promise<void>((res) => {
        reward.value?.play({ amount: r.totalWin, tier: r.tier, banner: winFrameArt, caption: r.tier === 'big' ? t('sl.bigWin') : r.tier === 'mega' ? t('sl.megaWin') : t('sl.epicWin') });
        setTimeout(res, r.tier === 'big' ? 1800 : r.tier === 'mega' ? 2600 : 3400);
      });
    }
    if (r.freeSpinsAwarded > 0) {
      audio.sfx('bigwin');
      toast(t('sl.freeSpins', { n: r.freeSpinsAwarded }), 'success');
    }
  } catch (e) {
    const err = e as Error & { code?: number };
    toast(err.code === 3000 ? t('error.INSUFFICIENT_BALANCE') : err.message, 'error');
    autoSpin.value = false;
  } finally {
    spinning.value = false;
    if (autoSpin.value) autoLeft.value = Math.max(0, autoLeft.value - 1);
    if (autoSpin.value && autoLeft.value <= 0) autoSpin.value = false;
    if ((autoSpin.value || freeSpinsRemaining.value > 0) && !destroyed) {
      setTimeout(() => {
        if ((autoSpin.value || freeSpinsRemaining.value > 0) && !spinning.value && !destroyed) void onSpin();
      }, turbo.value ? 350 : 700);
    }
  }
}

function maxBet(): void {
  betPerLine.value = betOptions.value[betOptions.value.length - 1]!;
  audio.sfx('chips');
}
function toggleAutoSpin(): void {
  autoSpin.value = !autoSpin.value;
  autoLeft.value = autoSpin.value ? 50 : 0;
  if (autoSpin.value && !spinning.value) void onSpin();
}
async function useTicket(): Promise<void> {
  if (spinning.value) return;
  try {
    const r = await gameSocket.call<{ freeSpinsRemaining: number; ticketQty?: number }>(Ev.SlTicket, { betPerLine: betPerLine.value }, 8000);
    freeSpinsRemaining.value = r.freeSpinsRemaining;
    if (r.ticketQty !== undefined) ticketQty.value = r.ticketQty;
    toast(t('sl.ticketUsed'), 'success');
    if (!spinning.value) void onSpin();
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}
async function exit(): Promise<void> {
  autoSpin.value = false;
  await gameSocket.call('room.leave').catch(() => undefined);
  void router.replace('/lobby');
}

onMounted(async () => {
  if (gameSocket.status !== 'open') await gameSocket.connect();
  audio.setScene('slot');
  audio.preload(['spin', 'reelStop', 'win', 'bigwin', 'jackpot', 'coin', 'chips']);
  app = new Application();
  await app.init({ resizeTo: stageEl.value!, background: 0x0a0716, antialias: true, resolution: Math.min(2, window.devicePixelRatio), autoDensity: true });
  stageEl.value!.appendChild(app.canvas);
  tex = await pixiTextures('slots');

  // 背景：放射流光（细长楔形，逐帧旋转）+ 金色光晕（烘焙成 1/4 分辨率纹理，避免每帧十余层全屏叠加）
  const rays = new Graphics();
  const glow = new Graphics();
  const backdrop = new Container();
  let glowSprite: Sprite | null = null;
  const drawBackdrop = (): void => {
    const w = app!.renderer.width;
    const h = app!.renderer.height;
    const cx = w / 2;
    const cy = h * 0.46;
    const R = Math.hypot(w, h);
    rays.clear();
    for (let i = 0; i < 16; i += 1) {
      const a0 = (Math.PI * 2 * i) / 16;
      const a1 = a0 + 0.16;
      rays.poly([0, 0, Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R]).fill({ color: 0xf0c46a, alpha: 0.035 });
    }
    rays.position.set(cx, cy);
    glow.clear();
    for (let i = 10; i >= 1; i -= 1) glow.circle(cx, cy, (Math.min(w, h) * 0.66 * i) / 10).fill({ color: 0x3a1a4a, alpha: 0.05 });
    for (let i = 6; i >= 1; i -= 1) glow.circle(cx, cy, (Math.min(w, h) * 0.32 * i) / 6).fill({ color: 0xf0c46a, alpha: 0.014 });
    if (glowSprite) {
      glowSprite.destroy({ texture: true, textureSource: true });
      glowSprite = null;
    }
    const gtex = app!.renderer.generateTexture({ target: glow, frame: new Rectangle(0, 0, w, h), resolution: 0.25 });
    glowSprite = new Sprite(gtex);
    glowSprite.width = w;
    glowSprite.height = h;
    backdrop.addChildAt(glowSprite, 0);
  };
  app.stage.addChild(backdrop, rays);
  drawBackdrop();

  // 机台底座必须在符号层之下，否则会盖住转轴
  const frame = new Graphics();
  app.stage.addChild(frame);
  const reelStage = new Container();
  app.stage.addChild(reelStage);
  const reelMask = new Graphics();
  app.stage.addChild(reelMask);
  reelStage.mask = reelMask;
  reelMaskRef = reelMask;
  for (let col = 0; col < COLS; col += 1) {
    const reel = new Container();
    reelStage.addChild(reel);
    reels.push(reel);
  }
  if (import.meta.env.DEV) {
    // 开发/测试钩子：E2E 与截图脚本读取布局与转轴状态
    (window as unknown as { __sl: unknown }).__sl = {
      app,
      reels,
      metrics: () => ({ originX, originY, cellW, cellH, w: app!.renderer.width, h: app!.renderer.height, sw: app!.screen.width, sh: app!.screen.height, res: app!.renderer.resolution, mask: reelMaskRef?.getBounds() }),
    };
  }
  highlightLayer = new Container();
  winLineLayer = new Graphics();
  app.stage.addChild(highlightLayer, winLineLayer);
  layout();
  const drawFrame = (): void => {
    const wx = originX - 14;
    const wy = originY + cellH - 14;
    const ww = cellW * COLS + 28;
    const wh = cellH * ROWS + 28;
    frame.clear();
    // 机台底座（深色）+ 金色双框
    frame.roundRect(wx - 16, wy - 16, ww + 32, wh + 32, 30).fill(0x0c1230);
    frame.roundRect(wx - 16, wy - 16, ww + 32, wh + 32, 30).stroke({ color: 0x8f5a12, width: 8 });
    frame.roundRect(wx - 16, wy - 16, ww + 32, wh + 32, 30).stroke({ color: 0xf8c74a, width: 3.5 });
    frame.roundRect(wx - 10, wy - 10, ww + 20, wh + 20, 24).stroke({ color: 0xffe9a6, width: 1.2, alpha: 0.7 });
    frame.roundRect(wx, wy, ww, wh, 16).stroke({ color: 0xd9942a, width: 2 });
    // 卷轴筒纵深
    for (let i = 0; i < 5; i += 1) {
      const a = 0.32 - i * 0.06;
      frame.rect(wx + 6, wy + 6 + i * 5, ww - 12, 5).fill({ color: 0x05070c, alpha: a });
      frame.rect(wx + 6, wy + wh - 11 - i * 5, ww - 12, 5).fill({ color: 0x05070c, alpha: a });
    }
    for (let cIdx = 1; cIdx < COLS; cIdx += 1) {
      const x = originX + cellW * cIdx;
      frame.moveTo(x, wy + 6).lineTo(x, wy + wh - 6).stroke({ color: 0x2b3448, width: 2, alpha: 0.8 });
    }
    // 角饰宝石
    for (const [gx, gy] of [
      [wx - 8, wy - 8],
      [wx + ww + 8, wy - 8],
      [wx - 8, wy + wh + 8],
      [wx + ww + 8, wy + wh + 8],
    ] as const) {
      frame.circle(gx, gy, 9).fill(0x8f5a12);
      frame.circle(gx, gy, 6.5).fill(0x3b7dff);
      frame.circle(gx - 2, gy - 2.2, 2.2).fill({ color: 0xffffff, alpha: 0.7 });
    }
    // 中线指示
    const midY = wy + wh / 2;
    frame.poly([wx - 26, midY - 9, wx - 12, midY, wx - 26, midY + 9]).fill(0xf8c74a);
    frame.poly([wx + ww + 26, midY - 9, wx + ww + 12, midY, wx + ww + 26, midY + 9]).fill(0xf8c74a);
    // 顶部灯带
    const lamps = 11;
    for (let i = 0; i < lamps; i += 1) {
      const lx = wx - 6 + ((ww + 12) * (i + 0.5)) / lamps;
      frame.circle(lx, wy - 16, 4.5).fill(0x8f5a12);
      frame.circle(lx, wy - 16, 3).fill(i % 2 === 0 ? 0xffe28a : 0xff8a5a);
    }
  };
  drawFrame();
  // 初始静态网格
  for (let col = 0; col < COLS; col += 1) {
    const strip = [rnd(), rnd(), rnd(), rnd(), rnd()];
    fillReel(col, strip);
    reels[col]!.y = originY;
  }
  let lampPhase = 0;
  let lastW = app.renderer.width;
  let lastH = app.renderer.height;
  app.ticker.add((tk) => {
    rays.rotation += 0.0006 * tk.deltaTime;
    lampPhase += tk.deltaTime;
    if (app!.renderer.width !== lastW || app!.renderer.height !== lastH) {
      lastW = app!.renderer.width;
      lastH = app!.renderer.height;
      drawBackdrop();
      layout();
      drawFrame();
      if (lastGrid.length) {
        for (let col = 0; col < COLS; col += 1) {
          fillReel(col, [rnd(), lastGrid[col]![0]!, lastGrid[col]![1]!, lastGrid[col]![2]!, rnd()]);
          reels[col]!.y = originY;
        }
      }
    }
  });

  offs.push(
    gameSocket.on(Ev.SlJackpot, (m) => {
      const d = m.data as { pools: Record<Tier, number>; hit?: { tier: Tier; amount: number; uid: number } };
      jackpots.value = d.pools;
      if (d.hit && d.hit.uid !== (user.me?.uid ?? -1)) {
        hitTier.value = d.hit.tier;
        setTimeout(() => (hitTier.value = ''), 2500);
      }
    }),
  );
  try {
    const r = await gameSocket.call<any>(Ev.SlEnter, {}, 8000);
    betOptions.value = r.paytable.betOptions;
    betPerLine.value = betOptions.value[0]!;
    paytableLines = r.paytable.lines;
    setBalance(r.balance);
    freeSpinsRemaining.value = r.freeSpinsRemaining ?? 0;
    jackpots.value = r.jackpots ?? jackpots.value;
    ticketQty.value = r.ticketQty ?? 0;
    if (freeSpinsRemaining.value > 0) void onSpin();
  } catch (e) {
    toast((e as Error).message, 'error');
    void router.replace('/lobby');
  }
});

onBeforeUnmount(() => {
  destroyed = true;
  autoSpin.value = false;
  offs.forEach((off) => off());
  app?.destroy(true, { children: true });
  app = null;
  reels = [];
  void release('slots');
  audio.setScene('none');
});
</script>

<style scoped>
.sl-root {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: #0a0716;
  user-select: none;
}
.stage {
  position: absolute;
  inset: 0;
}
/* ══ 顶栏 ══ */
.hud-top {
  position: absolute;
  z-index: 3;
  top: calc(var(--safe-top) + 8px);
  left: max(var(--safe-left), 12px);
  right: max(var(--safe-right), 12px);
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}
.hud-top > * {
  pointer-events: auto;
}
.jackpots {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}
.jackpots :deep(.jb) {
  --w: clamp(150px, 12vw, 220px);
}
.hcoins {
  --h: 36px;
}
.mascot {
  position: absolute;
  z-index: 1;
  right: max(var(--safe-right), 8px);
  bottom: 120px;
  height: min(38vh, 300px);
  pointer-events: none;
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.6));
  animation: mascot-bob 3s ease-in-out infinite;
}
@keyframes mascot-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-1deg) scaleY(1);
  }
  30% {
    transform: translateY(-6px) rotate(0deg) scaleY(1.015);
  }
  50% {
    transform: translateY(-9px) rotate(1deg) scaleY(1.02);
  }
  80% {
    transform: translateY(-3px) rotate(0.4deg) scaleY(1.005);
  }
}
.mascot {
  transform-origin: 50% 100%;
}
.fs-banner {
  position: absolute;
  z-index: 4;
  left: 50%;
  top: calc(var(--safe-top) + 64px);
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 18px 6px 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(34, 168, 58, 0.9), rgba(15, 92, 34, 0.9));
  box-shadow:
    inset 0 0 0 2px #7d4d0c,
    inset 0 0 0 3.5px #ffd867,
    0 0 26px rgba(124, 243, 106, 0.55);
  font-size: 18px;
}
.fs-banner img {
  height: 40px;
}
/* ══ 控制台 ══ */
.console {
  position: absolute;
  z-index: 3;
  left: max(var(--safe-left), 12px);
  right: max(var(--safe-right), 12px);
  bottom: calc(var(--safe-bottom) + 10px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
.win-bar {
  position: relative;
  width: clamp(180px, 16vw, 260px);
  aspect-ratio: 3.4 / 1;
}
.win-bar img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.win-num {
  position: absolute;
  left: 50%;
  top: 66%;
  transform: translate(-50%, -50%);
  font-size: clamp(16px, 1.5vw, 24px);
  font-weight: 900;
  color: #fff3c4;
  text-shadow:
    0 1px 0 #5a3305,
    0 0 8px rgba(255, 200, 80, 0.55);
}
.bet {
  --h: 44px;
  margin-top: 14px;
}
.total {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}
.t-label,
.t-lines {
  font-size: 11px;
  color: #9fb4e8;
  letter-spacing: 0.08em;
}
.t-val {
  font-size: 18px;
  font-weight: 900;
  color: #ffe28a;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.ctl {
  --h: 52px;
  min-width: 92px !important;
}
.ctl.on {
  filter: drop-shadow(0 0 12px rgba(255, 226, 138, 0.95)) brightness(1.15);
}
.auto-n {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  font-weight: 900;
  color: #ffe28a;
  text-shadow: var(--sk-outline);
}
.spin {
  position: relative;
  width: clamp(88px, 8vw, 128px);
  height: clamp(88px, 8vw, 128px);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  transition: transform 120ms var(--ease-out);
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.6));
}
.spin img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.spin:hover:not(:disabled) {
  transform: scale(1.05);
}
.spin:active:not(:disabled) {
  transform: scale(0.94);
}
.spin:disabled {
  cursor: not-allowed;
  filter: grayscale(0.4) brightness(0.8);
}
.spin.spinning img {
  animation: spin-rot 1.2s linear infinite;
}
@keyframes spin-rot {
  to {
    transform: rotate(360deg);
  }
}
.spin-ring {
  position: absolute;
  inset: 14%;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: #fff;
  animation: spin-rot 800ms linear infinite;
}
.pop-enter-active,
.pop-leave-active {
  transition: all 260ms var(--ease-out);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) scale(0.7);
}
/* ══ 响应式 ══ */
@media (max-width: 900px), (max-height: 560px) {
  .mascot {
    display: none;
  }
  .jackpots :deep(.jb) {
    --w: 120px;
  }
  .win-bar {
    width: 150px;
  }
  .ctl {
    --h: 40px;
    min-width: 72px !important;
  }
  .bet {
    --h: 38px;
  }
  .console {
    gap: 8px;
    bottom: calc(var(--safe-bottom) + 6px);
  }
  .spin {
    width: 74px;
    height: 74px;
  }
}
@media (max-width: 720px) {
  .jackpots {
    gap: 4px;
  }
  .jackpots :deep(.jb) {
    --w: 86px;
  }
  .t-lines {
    display: none;
  }
}
</style>
