<template>
  <div class="sl-root">
    <div class="hud-top">
      <button class="hback" @click="exit"><AppIcon name="back" :size="18" /></button>
      <div class="title">{{ t('game.slot_fruit') }}</div>
      <div class="hcoins num"><AppIcon name="coin" :size="16" />{{ fmt(balance) }}</div>
    </div>

    <div ref="stageEl" class="stage" />

    <!-- 免费旋转横幅 -->
    <transition name="pop">
      <div v-if="freeSpinsRemaining > 0" class="fs-banner">✨ {{ t('sl.freeSpins', { n: freeSpinsRemaining }) }} ✨</div>
    </transition>

    <!-- 大奖演出（金币雨 + 滚动数字） -->
    <transition name="pop">
      <div v-if="tierShow" class="tier-overlay" @click="skipTier">
        <span v-for="n in 18" :key="n" class="rain-coin" :style="coinStyle(n)">
          <AppIcon name="coin" :size="n % 3 === 0 ? 30 : 22" />
        </span>
        <div class="tier-text" :class="tierShow">{{ tierLabel }}</div>
        <div class="tier-amount num">{{ fmt(rollingWin) }}</div>
      </div>
    </transition>

    <!-- 控制台 -->
    <div class="console glass">
      <div class="ctrl">
        <div class="clabel">{{ t('sl.bet') }}</div>
        <div class="cvals">
          <button class="cbtn" :disabled="spinning" @click="stepBet(-1)">−</button>
          <span class="cval num">{{ betPerLine }}</span>
          <button class="cbtn" :disabled="spinning" @click="stepBet(1)">＋</button>
        </div>
      </div>
      <div class="ctrl">
        <div class="clabel">{{ t('sl.totalBet') }}</div>
        <div class="cval num gold">{{ fmt(betPerLine * 20) }}</div>
      </div>
      <button class="spin-btn" :class="{ spinning }" :disabled="spinning && !autoSpin" @click="onSpin">
        <span v-if="!spinning">{{ t('sl.spin') }}</span>
        <span v-else class="spin-ring" />
      </button>
      <div class="ctrl">
        <div class="clabel">{{ t('sl.win') }}</div>
        <div class="cval num jade">{{ fmt(lastWin) }}</div>
      </div>
      <button class="btn btn-secondary btn-sm" :class="{ activeAuto: autoSpin }" @click="toggleAutoSpin">
        {{ autoSpin ? t('sl.stopAuto') : t('sl.auto') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Application, Container, Graphics } from 'pixi.js';
import { Ev } from '@yanbian/protocol';
import { gameSocket } from '../../net/ws.js';
import { useUserStore } from '../../stores/user.js';
import { t } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import AppIcon from '../../ui/AppIcon.vue';
import { fmt } from '../../ui/format.js';

function coinStyle(n: number): Record<string, string> {
  return {
    left: `${(n * 53) % 100}%`,
    animationDelay: `${((n * 0.37) % 1.6).toFixed(2)}s`,
    animationDuration: `${(1.6 + ((n * 0.53) % 1.4)).toFixed(2)}s`,
  };
}

const router = useRouter();
const user = useUserStore();
const stageEl = ref<HTMLDivElement | null>(null);

const balance = ref(user.me?.coins ?? 0);
const betOptions = ref<number[]>([100, 200, 500, 1000]);
const betPerLine = ref(100);
const lastWin = ref(0);
const spinning = ref(false);
const autoSpin = ref(false);
const freeSpinsRemaining = ref(0);
const tierShow = ref<'' | 'big' | 'mega' | 'epic'>('');
const tierLabel = ref('');
const rollingWin = ref(0);
let rollTimer = 0;

let app: Application | null = null;
let reels: Container[] = [];
let winLineLayer: Graphics | null = null;
const COLS = 5;
const ROWS = 3;
let cellW = 96;
let cellH = 86;
let originX = 0;
let originY = 0;
let paytableLines: number[][] = [];
let destroyed = false;

/** 圆弧折线点集（避免依赖 Graphics.arc 填充行为） */
function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, steps = 20): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

function starPoints(cx: number, cy: number, rOut: number, rIn: number, n = 5, rot = -Math.PI / 2): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i += 1) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = rot + (Math.PI * i) / n;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

/** 程序化矢量符号库（原创；任何 DPI 锐利，三端渲染一致） */
function drawSymbolArt(g: Graphics, sym: string, u: number): void {
  // u = 符号半幅基准
  switch (sym) {
    case 'CHERRY': {
      g.moveTo(-u * 0.05, -u * 0.85)
        .quadraticCurveTo(u * 0.5, -u * 0.7, u * 0.42, u * 0.05)
        .stroke({ color: 0x4c7a3a, width: u * 0.12, cap: 'round' });
      g.moveTo(-u * 0.05, -u * 0.85)
        .quadraticCurveTo(-u * 0.55, -u * 0.6, -u * 0.5, u * 0.15)
        .stroke({ color: 0x4c7a3a, width: u * 0.12, cap: 'round' });
      g.ellipse(u * 0.28, -u * 0.78, u * 0.34, u * 0.15).fill(0x5b9146);
      g.circle(u * 0.42, u * 0.35, u * 0.42).fill(0xc22b3a);
      g.circle(-u * 0.5, u * 0.45, u * 0.38).fill(0xa8202e);
      g.circle(u * 0.28, u * 0.2, u * 0.13).fill({ color: 0xffffff, alpha: 0.55 });
      g.circle(-u * 0.6, u * 0.32, u * 0.1).fill({ color: 0xffffff, alpha: 0.4 });
      break;
    }
    case 'LEMON': {
      g.poly([-u * 0.95, 0, -u * 0.75, -u * 0.16, -u * 0.75, u * 0.16]).fill(0xd9b83a);
      g.poly([u * 0.95, 0, u * 0.75, -u * 0.16, u * 0.75, u * 0.16]).fill(0xd9b83a);
      g.ellipse(0, 0, u * 0.8, u * 0.52).fill(0xe8ce52);
      g.ellipse(0, u * 0.18, u * 0.7, u * 0.3).fill({ color: 0xc7a92e, alpha: 0.45 });
      g.ellipse(-u * 0.24, -u * 0.2, u * 0.34, u * 0.14).fill({ color: 0xffffff, alpha: 0.45 });
      break;
    }
    case 'ORANGE': {
      g.circle(0, u * 0.08, u * 0.62).fill(0xe08a3c);
      g.circle(0, u * 0.22, u * 0.5).fill({ color: 0xc06f26, alpha: 0.4 });
      g.ellipse(-u * 0.2, -u * 0.12, u * 0.24, u * 0.14).fill({ color: 0xffffff, alpha: 0.42 });
      g.ellipse(u * 0.22, -u * 0.62, u * 0.3, u * 0.13).fill(0x5b9146);
      g.circle(0, -u * 0.52, u * 0.06).fill(0x7d5a20);
      break;
    }
    case 'GRAPE': {
      const berry = (x: number, y: number, r: number, c: number): void => {
        g.circle(x, y, r).fill(c);
      };
      g.moveTo(0, -u * 0.85).lineTo(0, -u * 0.5).stroke({ color: 0x4c7a3a, width: u * 0.1, cap: 'round' });
      g.ellipse(u * 0.28, -u * 0.72, u * 0.3, u * 0.13).fill(0x5b9146);
      berry(-u * 0.32, -u * 0.28, u * 0.24, 0x6d4a9e);
      berry(u * 0.32, -u * 0.28, u * 0.24, 0x6d4a9e);
      berry(0, -u * 0.34, u * 0.24, 0x7d58b0);
      berry(-u * 0.48, u * 0.1, u * 0.24, 0x5d3d8a);
      berry(u * 0.48, u * 0.1, u * 0.24, 0x5d3d8a);
      berry(0, u * 0.06, u * 0.26, 0x6d4a9e);
      berry(-u * 0.24, u * 0.44, u * 0.24, 0x54367c);
      berry(u * 0.24, u * 0.44, u * 0.24, 0x54367c);
      berry(0, u * 0.72, u * 0.22, 0x4a2f6e);
      g.circle(-u * 0.08, -u * 0.4, u * 0.08).fill({ color: 0xffffff, alpha: 0.45 });
      g.circle(-u * 0.55, 0, u * 0.07).fill({ color: 0xffffff, alpha: 0.35 });
      break;
    }
    case 'MELON': {
      // 西瓜切片：绿皮弧 + 白圈 + 红瓤 + 籽
      const rind = arcPoints(0, -u * 0.1, u * 0.85, 0.12 * Math.PI, 0.88 * Math.PI);
      g.poly([...rind]).fill(0x3f7a44);
      const white = arcPoints(0, -u * 0.1, u * 0.74, 0.14 * Math.PI, 0.86 * Math.PI);
      g.poly([...white]).fill(0xe9f0dc);
      const flesh = arcPoints(0, -u * 0.1, u * 0.66, 0.15 * Math.PI, 0.85 * Math.PI);
      g.poly([...flesh]).fill(0xd6484e);
      g.circle(-u * 0.26, u * 0.28, u * 0.055).fill(0x2b2320);
      g.circle(u * 0.02, u * 0.42, u * 0.055).fill(0x2b2320);
      g.circle(u * 0.28, u * 0.26, u * 0.055).fill(0x2b2320);
      g.circle(-u * 0.02, u * 0.18, u * 0.055).fill(0x2b2320);
      break;
    }
    case 'BELL': {
      // 钟体（穹顶 + 喇叭口）
      const dome = arcPoints(0, -u * 0.05, u * 0.52, Math.PI, 2 * Math.PI);
      g.poly([...dome, u * 0.62, u * 0.42, -u * 0.62, u * 0.42]).fill(0xe0b44e);
      g.poly([-u * 0.62, u * 0.42, u * 0.62, u * 0.42, u * 0.5, u * 0.55, -u * 0.5, u * 0.55]).fill(0xb8903a);
      g.roundRect(-u * 0.09, -u * 0.72, u * 0.18, u * 0.18, u * 0.06).fill(0x8a6b1e);
      g.circle(0, u * 0.62, u * 0.12).fill(0x8a6b1e);
      g.ellipse(-u * 0.2, -u * 0.18, u * 0.14, u * 0.26).fill({ color: 0xffffff, alpha: 0.35 });
      break;
    }
    case 'SEVEN': {
      // 经典红 7（双层拉出立体感）
      const seven = (dx: number, dy: number, c: number): void => {
        g.poly([
          -u * 0.5 + dx, -u * 0.72 + dy,
          u * 0.52 + dx, -u * 0.72 + dy,
          u * 0.14 + dx, u * 0.72 + dy,
          -u * 0.22 + dx, u * 0.72 + dy,
          u * 0.1 + dx, -u * 0.34 + dy,
          -u * 0.5 + dx, -u * 0.34 + dy,
        ]).fill(c);
      };
      seven(u * 0.06, u * 0.07, 0x7d1d22);
      seven(0, 0, 0xd6363c);
      g.poly([-u * 0.5, -u * 0.72, u * 0.52, -u * 0.72, u * 0.44, -u * 0.56, -u * 0.5, -u * 0.56]).fill({ color: 0xffffff, alpha: 0.3 });
      break;
    }
    case 'CROWN': {
      g.poly([
        -u * 0.66, u * 0.34, -u * 0.72, -u * 0.36, -u * 0.32, -u * 0.05, 0, -u * 0.6,
        u * 0.32, -u * 0.05, u * 0.72, -u * 0.36, u * 0.66, u * 0.34,
      ]).fill(0xd9b352);
      g.roundRect(-u * 0.66, u * 0.34, u * 1.32, u * 0.24, u * 0.08).fill(0xb8903a);
      g.circle(-u * 0.72, -u * 0.42, u * 0.09).fill(0xe8cf82);
      g.circle(0, -u * 0.68, u * 0.1).fill(0xe8cf82);
      g.circle(u * 0.72, -u * 0.42, u * 0.09).fill(0xe8cf82);
      g.circle(-u * 0.34, u * 0.14, u * 0.08).fill(0xc23a4a);
      g.circle(0, u * 0.1, u * 0.09).fill(0x3d6fa8);
      g.circle(u * 0.34, u * 0.14, u * 0.08).fill(0x3f8a5a);
      g.poly([-u * 0.66, u * 0.34, u * 0.66, u * 0.34, u * 0.6, u * 0.42, -u * 0.6, u * 0.42]).fill({ color: 0xffffff, alpha: 0.2 });
      break;
    }
    case 'WILD': {
      g.circle(0, 0, u * 0.78).fill({ color: 0xc9a063, alpha: 0.16 });
      g.poly(starPoints(0, 0, u * 0.8, u * 0.36)).fill(0xd9b352);
      g.poly(starPoints(0, 0, u * 0.52, u * 0.24)).fill(0xf0dcab);
      g.circle(0, 0, u * 0.12).fill(0xfff6df);
      break;
    }
    case 'SCATTER': {
      g.circle(0, u * 0.05, u * 0.8).fill({ color: 0x7fb8e8, alpha: 0.14 });
      g.poly([-u * 0.42, -u * 0.5, u * 0.42, -u * 0.5, u * 0.68, -u * 0.1, 0, u * 0.66, -u * 0.68, -u * 0.1]).fill(0x7fb8e8);
      g.poly([-u * 0.42, -u * 0.5, -u * 0.14, -u * 0.1, 0, u * 0.66, -u * 0.68, -u * 0.1]).fill(0x5d94c6);
      g.poly([u * 0.42, -u * 0.5, u * 0.14, -u * 0.1, 0, u * 0.66, u * 0.68, -u * 0.1]).fill(0x9fd0f2);
      g.poly([-u * 0.14, -u * 0.1, u * 0.14, -u * 0.1, 0, u * 0.66]).fill(0x7fb8e8);
      g.poly([-u * 0.42, -u * 0.5, u * 0.42, -u * 0.5, u * 0.14, -u * 0.1, -u * 0.14, -u * 0.1]).fill(0xcfe8ff);
      break;
    }
    default:
      g.circle(0, 0, u * 0.5).fill(0x555f72);
  }
}

function makeSymbol(sym: string): Container {
  const c = new Container();
  const special = sym === 'WILD' || sym === 'SCATTER';
  const card = new Graphics();
  const w = cellW * 0.88;
  const h = cellH * 0.88;
  card.roundRect(-w / 2, -h / 2, w, h, 12).fill(0x161c2b);
  // 顶部受光面
  card.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.34, 10).fill({ color: 0xffffff, alpha: 0.045 });
  card.roundRect(-w / 2, -h / 2, w, h, 12).stroke({ color: special ? 0xc9a063 : 0x2b3448, width: special ? 2 : 1.2 });
  c.addChild(card);
  const art = new Graphics();
  drawSymbolArt(art, sym, Math.min(cellW, cellH) * 0.34);
  c.addChild(art);
  return c;
}

/** 每列构建符号带（顶部+可视+底部缓冲），旋转时纵向滚动 */
function fillReel(col: number, symbols: string[]): void {
  const reel = reels[col]!;
  reel.removeChildren().forEach((ch) => ch.destroy());
  for (let i = 0; i < symbols.length; i += 1) {
    const node = makeSymbol(symbols[i]!);
    node.y = (i - 1) * cellH;
    reel.addChild(node);
  }
}

const RANDOM_SYMS = ['CHERRY', 'LEMON', 'ORANGE', 'GRAPE', 'MELON', 'BELL', 'SEVEN', 'CROWN', 'WILD', 'SCATTER'];
const rnd = (): string => RANDOM_SYMS[Math.floor(Math.random() * RANDOM_SYMS.length)]!;

/**
 * 按竞品分析的 Spin 节奏公式播放：弹射加速 → 匀速滚动 → 逐列错峰停（120ms 间隔）+ 回弹。
 * 服务端已定结果 grid（[col][row]），动画只负责表现。
 */
function playSpinAnimation(grid: string[][]): Promise<void> {
  return new Promise((resolve) => {
    if (!app) {
      resolve();
      return;
    }
    winLineLayer?.clear();
    const startAt = performance.now();
    const stopDelays = [900, 1020, 1140, 1260, 1380];
    let resolvedCols = 0;
    for (let col = 0; col < COLS; col += 1) {
      const reel = reels[col]!;
      // 滚动带：随机符号 + 末端接最终结果
      const strip: string[] = [];
      for (let i = 0; i < 20; i += 1) strip.push(rnd());
      strip.push(grid[col]![0]!, grid[col]![1]!, grid[col]![2]!);
      fillReel(col, strip);
      const totalScroll = (strip.length - 4) * cellH;
      const stopAt = stopDelays[col]!;
      const tick = (): void => {
        if (destroyed) {
          resolve();
          return;
        }
        const now = performance.now() - startAt;
        let p: number;
        if (now < 160) {
          // 弹射加速（含轻微回拉）
          const k = now / 160;
          p = -0.06 * Math.sin(k * Math.PI) + 0.08 * k * k;
        } else if (now < stopAt) {
          const k = (now - 160) / (stopAt - 160);
          p = 0.08 + 0.86 * k;
        } else if (now < stopAt + 200) {
          // 急停回弹
          const k = (now - stopAt) / 200;
          p = 0.94 + 0.06 * (1 - (1 - k) * (1 - k)) + Math.sin(k * Math.PI) * 0.012;
        } else {
          reel.y = originY + totalScroll;
          resolvedCols += 1;
          if (resolvedCols === COLS) resolve();
          return;
        }
        reel.y = originY + totalScroll * Math.min(1, Math.max(-0.05, p));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });
}

function drawWinLines(winLines: { lineIndex: number }[]): void {
  if (!winLineLayer) return;
  winLineLayer.clear();
  const colors = [0xc9a063, 0x3e9b8f, 0xb5495b, 0x7fb8e8, 0xd7c74a];
  winLines.slice(0, 6).forEach((w, i) => {
    const rows = paytableLines[w.lineIndex];
    if (!rows) return;
    const color = colors[i % colors.length]!;
    winLineLayer!.moveTo(originX + cellW * 0.5, originY + cellH * (rows[0]! + 0.5) + cellH);
    for (let c = 0; c < COLS; c += 1) {
      winLineLayer!.lineTo(originX + cellW * (c + 0.5), originY + cellH * (rows[c]! + 0.5) + cellH);
    }
    winLineLayer!.stroke({ color, width: 3, alpha: 0.85 });
  });
}

let reelMaskRef: Graphics | null = null;

function layout(): void {
  if (!app) return;
  const w = app.renderer.width;
  const h = app.renderer.height;
  cellW = Math.min(110, (w - 40) / COLS);
  cellH = Math.min(100, (h - 60) / (ROWS + 0.6));
  originX = (w - cellW * COLS) / 2;
  originY = (h - cellH * ROWS) / 2 - cellH;
  reels.forEach((reel, col) => {
    reel.x = originX + cellW * (col + 0.5);
    reel.y = originY;
  });
  if (reelMaskRef) {
    reelMaskRef.clear();
    reelMaskRef.roundRect(originX - 8, originY + cellH - 8, cellW * COLS + 16, cellH * ROWS + 16, 14).fill(0xffffff);
  }
}

async function onSpin(): Promise<void> {
  if (spinning.value) return;
  spinning.value = true;
  lastWin.value = 0;
  try {
    const r = await gameSocket.call<any>(Ev.SlSpin, { betPerLine: betPerLine.value, lines: 20 }, 15000);
    // 服务端先结算；客户端播动画
    await playSpinAnimation(r.grid ?? []);
    lastWin.value = r.totalWin;
    balance.value = r.balance;
    user.setBalance(r.balance);
    freeSpinsRemaining.value = r.freeSpinsRemaining ?? 0;
    drawWinLines(r.winLines ?? []);
    if (r.tier === 'big' || r.tier === 'mega' || r.tier === 'epic') {
      await showTier(r.tier, r.totalWin);
    }
    if (r.freeSpinsAwarded > 0) toast(t('sl.freeSpins', { n: r.freeSpinsAwarded }), 'success');
  } catch (e) {
    const err = e as Error & { code?: number };
    toast(err.code === 3000 ? t('error.INSUFFICIENT_BALANCE') : err.message, 'error');
    autoSpin.value = false;
  } finally {
    spinning.value = false;
    if ((autoSpin.value || freeSpinsRemaining.value > 0) && !destroyed) {
      setTimeout(() => {
        if ((autoSpin.value || freeSpinsRemaining.value > 0) && !spinning.value && !destroyed) void onSpin();
      }, 650);
    }
  }
}

function showTier(tier: 'big' | 'mega' | 'epic', amount: number): Promise<void> {
  return new Promise((resolve) => {
    tierShow.value = tier;
    tierLabel.value = tier === 'big' ? t('sl.bigWin') : tier === 'mega' ? t('sl.megaWin') : t('sl.epicWin');
    rollingWin.value = 0;
    const durMs = tier === 'big' ? 1600 : tier === 'mega' ? 2600 : 3600;
    const start = performance.now();
    window.clearInterval(rollTimer);
    rollTimer = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / durMs);
      rollingWin.value = Math.round(amount * p);
      if (p >= 1) {
        window.clearInterval(rollTimer);
        setTimeout(() => {
          tierShow.value = '';
          resolve();
        }, 700);
      }
    }, 40);
  });
}

function skipTier(): void {
  window.clearInterval(rollTimer);
  tierShow.value = '';
}

function stepBet(dir: number): void {
  const idx = betOptions.value.indexOf(betPerLine.value);
  const next = betOptions.value[Math.min(betOptions.value.length - 1, Math.max(0, idx + dir))];
  if (next) betPerLine.value = next;
}

function toggleAutoSpin(): void {
  autoSpin.value = !autoSpin.value;
  if (autoSpin.value && !spinning.value) void onSpin();
}

async function exit(): Promise<void> {
  await gameSocket.call('room.leave').catch(() => undefined);
  void router.replace('/lobby');
}

onMounted(async () => {
  if (gameSocket.status !== 'open') await gameSocket.connect();
  app = new Application();
  await app.init({ resizeTo: stageEl.value!, background: 0x0c0a12, antialias: true, resolution: Math.min(2, window.devicePixelRatio) });
  stageEl.value!.appendChild(app.canvas);

  // 背景装饰
  const glow = new Graphics();
  glow.circle(0, 0, 260).fill({ color: 0x2a2138, alpha: 0.5 });
  glow.position.set(app.renderer.width / 2, app.renderer.height / 2);
  app.stage.addChild(glow);

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
  // 机框（金属双框 + 角饰 + 卷轴筒明暗 + 中线指示）
  const frame = new Graphics();
  app.stage.addChild(frame);
  winLineLayer = new Graphics();
  app.stage.addChild(winLineLayer);
  layout();
  const drawFrame = (): void => {
    const wx = originX - 12;
    const wy = originY + cellH - 12;
    const ww = cellW * COLS + 24;
    const wh = cellH * ROWS + 24;
    frame.clear();
    // 卷轴筒纵深：窗口上下渐暗（多层 alpha 条模拟圆柱阴影）
    for (let i = 0; i < 5; i += 1) {
      const a = 0.3 - i * 0.055;
      frame.rect(wx + 6, wy + 6 + i * 5, ww - 12, 5).fill({ color: 0x05070c, alpha: a });
      frame.rect(wx + 6, wy + wh - 11 - i * 5, ww - 12, 5).fill({ color: 0x05070c, alpha: a });
    }
    // 金属外框
    frame.roundRect(wx - 6, wy - 6, ww + 12, wh + 12, 22).stroke({ color: 0x8a6b3c, width: 6, alpha: 0.9 });
    frame.roundRect(wx - 6, wy - 6, ww + 12, wh + 12, 22).stroke({ color: 0xe6cfa3, width: 1.4, alpha: 0.8 });
    frame.roundRect(wx, wy, ww, wh, 16).stroke({ color: 0xc9a063, width: 2 });
    frame.roundRect(wx + 3, wy + 3, ww - 6, wh - 6, 14).stroke({ color: 0x594420, width: 1, alpha: 0.6 });
    // 列分隔
    for (let cIdx = 1; cIdx < COLS; cIdx += 1) {
      const x = originX + cellW * cIdx;
      frame.moveTo(x, wy + 6).lineTo(x, wy + wh - 6).stroke({ color: 0x2b3448, width: 2, alpha: 0.8 });
      frame.moveTo(x + 1.4, wy + 6).lineTo(x + 1.4, wy + wh - 6).stroke({ color: 0xffffff, width: 0.8, alpha: 0.05 });
    }
    // 角饰铆钉
    for (const [cx, cy] of [
      [wx - 2, wy - 2],
      [wx + ww + 2, wy - 2],
      [wx - 2, wy + wh + 2],
      [wx + ww + 2, wy + wh + 2],
    ] as const) {
      frame.circle(cx, cy, 5.5).fill(0xc9a063);
      frame.circle(cx, cy, 5.5).stroke({ color: 0x6e5426, width: 1.2 });
      frame.circle(cx - 1.4, cy - 1.6, 1.8).fill({ color: 0xffffff, alpha: 0.5 });
    }
    // 中央赔付线指示箭头
    const midY = wy + wh / 2;
    frame.poly([wx - 16, midY - 8, wx - 4, midY, wx - 16, midY + 8]).fill(0xc9a063);
    frame.poly([wx + ww + 16, midY - 8, wx + ww + 4, midY, wx + ww + 16, midY + 8]).fill(0xc9a063);
  };
  drawFrame();
  window.addEventListener('resize', () => {
    layout();
    drawFrame();
  });

  try {
    const enter = await gameSocket.call<any>('slot.enter');
    balance.value = enter.balance;
    betOptions.value = enter.paytable.betOptions;
    betPerLine.value = betOptions.value[0]!;
    paytableLines = enter.paytable.lines;
    freeSpinsRemaining.value = enter.freeSpinsRemaining ?? 0;
    // 初始随机静态盘面
    for (let col = 0; col < COLS; col += 1) {
      fillReel(col, [rnd(), rnd(), rnd(), rnd(), rnd()]);
      reels[col]!.y = originY + cellH;
    }
  } catch (e) {
    toast((e as Error).message, 'error');
    void router.replace('/lobby');
  }
});

onBeforeUnmount(() => {
  destroyed = true;
  autoSpin.value = false;
  window.clearInterval(rollTimer);
  app?.destroy(true, { children: true });
  app = null;
});
</script>

<style scoped>
.sl-root {
  height: 100%;
  position: relative;
  overflow: hidden;
  background: radial-gradient(120% 100% at 50% 30%, #191426 0%, #0c0a12 70%);
  display: flex;
  flex-direction: column;
}
.hud-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--safe-top) + 8px) 14px 8px;
  z-index: 5;
}
.hback {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--line-soft);
  color: var(--gold-champagne);
  font-size: 20px;
  cursor: pointer;
}
.title {
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--gold-champagne);
}
.hcoins {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--gold-warm);
  font-weight: 700;
}
.stage {
  flex: 1;
  position: relative;
}
.fs-banner {
  position: absolute;
  top: calc(var(--safe-top) + 52px);
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(90deg, transparent, rgba(201, 160, 99, 0.3), transparent);
  color: var(--gold-champagne);
  padding: 6px 40px;
  font-weight: 700;
  font-size: 14px;
  z-index: 6;
  white-space: nowrap;
}
.tier-overlay {
  position: absolute;
  inset: 0;
  background: rgba(6, 8, 12, 0.75);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  z-index: 20;
  cursor: pointer;
}
.tier-text {
  font-size: 46px;
  font-weight: 900;
  letter-spacing: 0.1em;
  background: linear-gradient(180deg, #ffe9b8, #c9a063 60%, #8a6b3c);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: tier-in 0.5s var(--ease-out);
  text-shadow: 0 0 40px rgba(201, 160, 99, 0.4);
}
.tier-text.mega {
  font-size: 56px;
}
.tier-text.epic {
  font-size: 64px;
}
@keyframes tier-in {
  0% {
    transform: scale(2.2);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.tier-amount {
  font-size: 34px;
  font-weight: 800;
  color: #ffe9b0;
}
.rain-coin {
  position: absolute;
  top: -40px;
  animation: coin-fall linear infinite;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
  pointer-events: none;
}
@keyframes coin-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  100% {
    transform: translateY(110vh) rotate(340deg);
    opacity: 0.9;
  }
}
.console {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin: 0 12px calc(var(--safe-bottom) + 12px);
  padding: 12px 16px;
  border-radius: 20px;
  z-index: 5;
}
.ctrl {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.clabel {
  font-size: 10px;
  color: var(--text-secondary);
}
.cvals {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cbtn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--line-soft);
  background: var(--bg-night);
  color: var(--gold-champagne);
  cursor: pointer;
}
.cval {
  font-weight: 800;
  font-size: 15px;
}
.cval.gold {
  color: var(--gold-champagne);
}
.cval.jade {
  color: var(--accent-jade);
}
.spin-btn {
  width: 74px;
  height: 74px;
  border-radius: 50%;
  border: 3px solid var(--gold-warm);
  background: radial-gradient(circle at 32% 28%, #4a3a1f, #241a08);
  color: var(--gold-champagne);
  font-size: 17px;
  font-weight: 900;
  letter-spacing: 0.08em;
  cursor: pointer;
  box-shadow: var(--shadow-glow-gold);
  transition: transform var(--dur-micro) var(--ease-out);
}
.spin-btn:active {
  transform: scale(0.93);
}
.spin-btn.spinning {
  filter: brightness(0.8);
}
.spin-ring {
  display: inline-block;
  width: 22px;
  height: 22px;
  border: 3px solid rgba(230, 207, 163, 0.25);
  border-top-color: var(--gold-champagne);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.activeAuto {
  border-color: var(--accent-jade);
  color: var(--accent-jade);
}
</style>
