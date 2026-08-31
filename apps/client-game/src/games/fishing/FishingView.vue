<template>
  <div class="fs-root">
    <div ref="stageEl" class="stage" />

    <!-- HUD -->
    <div class="hud-top">
      <button class="hback" @click="exit">‹ {{ t('fs.exit') }}</button>
      <div class="hcoins num"><AppIcon name="coin" :size="16" />{{ fmt(balance) }}</div>
    </div>

    <transition name="pop">
      <div v-if="bossWarning" class="boss-banner">⚠ {{ t('fs.bossComing') }} ⚠</div>
    </transition>

    <div class="hud-bottom">
      <div class="mult glass">
        <button class="mbtn" @click="stepMult(-1)">−</button>
        <div class="mval num">×{{ multiplier }}</div>
        <button class="mbtn" @click="stepMult(1)">＋</button>
      </div>
      <button class="btn btn-secondary btn-sm" :class="{ activeAuto: autoFire }" @click="toggleAuto">
        {{ t('fs.auto') }}{{ autoFire ? ' ⏸' : '' }}
      </button>
      <div class="cost num">{{ bulletCost }}/发</div>
    </div>

    <transition-group name="toast" tag="div" class="reward-pops">
      <div v-for="r in rewardPops" :key="r.id" class="rpop num">+{{ fmt(r.amount) }}</div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { Ev } from '@yanbian/protocol';
import { FISH_TYPES, pathById, pointOnPath } from '@yanbian/game-common/fishing';
import { gameSocket } from '../../net/ws.js';
import { useUserStore } from '../../stores/user.js';
import { t } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import AppIcon from '../../ui/AppIcon.vue';
import { fmt } from '../../ui/format.js';

const route = useRoute();
const router = useRouter();
const user = useUserStore();
const stageEl = ref<HTMLDivElement | null>(null);
const balance = ref(user.me?.coins ?? 0);
const multiplier = ref(1);
const multipliers = ref<number[]>([1, 2, 5, 10]);
const bulletBaseCost = ref(10);
const bulletCost = computed(() => bulletBaseCost.value * multiplier.value);
const autoFire = ref(false);
const bossWarning = ref(false);
const rewardPops = ref<{ id: number; amount: number }[]>([]);
let popSeq = 0;
let serverOffset = 0;

interface LiveFish {
  fishId: number;
  typeId: string;
  pathId: number;
  spawnAtMs: number;
  speedScale: number;
  node: Container;
  tail: Graphics | null;
  size: number;
  dead: boolean;
}
interface LiveBullet {
  bulletId: string;
  node: Graphics;
  vx: number;
  vy: number;
  mine: boolean;
}

const offs: (() => void)[] = [];
let app: Application | null = null;
let fishLayer: Container;
let fxLayer: Container;
let bulletLayer: Container;
let cannon: Container;
const fishes = new Map<number, LiveFish>();
const bullets: LiveBullet[] = [];
let aimDeg = -90;
let autoTimer = 0;
let firing = false;
let destroyed = false;

const FISH_COLORS: Record<string, number> = {
  sardine: 0x9fc4de,
  clown: 0xe98f4e,
  butterfly: 0xd7c74a,
  puffer: 0xa5d38f,
  lionfish: 0xc96a5a,
  ray: 0x8b7fc9,
  turtle: 0x5aa87a,
  shark: 0x7c8ca0,
  goldenShark: 0xd9b352,
  whale: 0x5878a8,
  dragonKing: 0x9a4ed0,
};
const FISH_SIZE: Record<string, number> = {
  small: 30,
  medium: 48,
  large: 72,
  boss: 130,
};

function W(): number {
  return app?.renderer.width ?? 800;
}
function H(): number {
  return app?.renderer.height ?? 450;
}

function shade(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f));
  const g2 = Math.min(255, Math.round(((color >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((color & 0xff) * f));
  return (r << 16) | (g2 << 8) | b;
}

function drawEye(g: Graphics, x: number, y: number, r: number): void {
  g.circle(x, y, r).fill(0xf2f4f6);
  g.circle(x + r * 0.28, y + r * 0.1, r * 0.55).fill(0x161b24);
  g.circle(x - r * 0.15, y - r * 0.3, r * 0.22).fill(0xffffff);
}

/** 通用尾鳍（独立节点做摆动动画） */
function makeTail(color: number, s: number, forked = true): Graphics {
  const tg = new Graphics();
  if (forked) {
    tg.poly([0, 0, -s * 0.55, -s * 0.42, -s * 0.34, 0, -s * 0.55, s * 0.42]).fill(shade(color, 0.85));
  } else {
    tg.poly([0, 0, -s * 0.5, -s * 0.34, -s * 0.6, 0, -s * 0.5, s * 0.34]).fill(shade(color, 0.85));
  }
  return tg;
}

/** 分物种程序化鱼形（原创矢量） */
function buildFishNode(typeId: string): { node: Container; tail: Graphics | null; size: number } {
  const type = FISH_TYPES.find((f) => f.typeId === typeId);
  const size = FISH_SIZE[type?.size ?? 'small'] ?? 30;
  const color = FISH_COLORS[typeId] ?? 0x88aacc;
  const c = new Container();
  const g = new Graphics();
  let tail: Graphics | null = null;
  const body = (rx = 1, ry = 0.46): void => {
    g.ellipse(0, 0, size * rx, size * ry).fill(color);
    g.ellipse(0, size * ry * 0.45, size * rx * 0.92, size * ry * 0.55).fill({ color: shade(color, 0.72), alpha: 0.85 });
    g.ellipse(-size * 0.1, -size * ry * 0.4, size * rx * 0.6, size * ry * 0.34).fill({ color: 0xffffff, alpha: 0.16 });
  };
  const dorsal = (h = 0.75): void => {
    g.poly([-size * 0.24, -size * 0.4, size * 0.08, -size * h, size * 0.3, -size * 0.38]).fill(shade(color, 0.8));
  };
  const pectoral = (): void => {
    g.poly([size * 0.1, size * 0.12, -size * 0.18, size * 0.44, size * 0.22, size * 0.3]).fill({ color: shade(color, 0.75), alpha: 0.9 });
  };

  switch (typeId) {
    case 'clown': {
      tail = makeTail(color, size, false);
      tail.x = -size * 0.92;
      c.addChild(tail);
      body(1, 0.52);
      // 双白纹
      g.poly([size * 0.28, -size * 0.5, size * 0.5, -size * 0.48, size * 0.42, size * 0.5, size * 0.2, size * 0.48]).fill(0xf4f0e6);
      g.poly([-size * 0.28, -size * 0.5, -size * 0.06, -size * 0.52, -size * 0.14, size * 0.52, -size * 0.36, size * 0.48]).fill(0xf4f0e6);
      dorsal(0.7);
      pectoral();
      drawEye(g, size * 0.64, -size * 0.1, size * 0.12);
      break;
    }
    case 'puffer': {
      g.circle(0, 0, size * 0.72).fill(color);
      // 刺
      for (let i = 0; i < 12; i += 1) {
        const a = (Math.PI * 2 * i) / 12 + 0.26;
        const x1 = Math.cos(a) * size * 0.68;
        const y1 = Math.sin(a) * size * 0.68;
        const x2 = Math.cos(a) * size * 0.92;
        const y2 = Math.sin(a) * size * 0.92;
        g.poly([x1 - 3, y1, x2, y2, x1 + 3, y1]).fill(shade(color, 0.8));
      }
      g.circle(0, size * 0.2, size * 0.55).fill({ color: 0xe9f0dc, alpha: 0.8 });
      g.ellipse(-size * 0.16, -size * 0.28, size * 0.4, size * 0.2).fill({ color: 0xffffff, alpha: 0.2 });
      drawEye(g, size * 0.34, -size * 0.18, size * 0.15);
      g.ellipse(size * 0.6, size * 0.1, size * 0.12, size * 0.08).fill(shade(color, 0.7));
      break;
    }
    case 'lionfish': {
      tail = makeTail(color, size);
      tail.x = -size * 0.9;
      c.addChild(tail);
      // 放射棘刺
      for (let i = 0; i < 7; i += 1) {
        const a = -Math.PI * 0.82 + (i * Math.PI * 0.64) / 6;
        g.moveTo(0, 0)
          .lineTo(Math.cos(a) * size * 1.05, Math.sin(a) * size * 1.05)
          .stroke({ color: shade(color, 0.85), width: size * 0.055, cap: 'round' });
      }
      body(0.92, 0.5);
      g.poly([size * 0.1, -size * 0.5, size * 0.3, size * 0.5, size * 0.05, size * 0.5]).fill({ color: 0xe9dcc8, alpha: 0.5 });
      g.poly([-size * 0.3, -size * 0.48, -size * 0.1, size * 0.48, -size * 0.38, size * 0.46]).fill({ color: 0xe9dcc8, alpha: 0.45 });
      drawEye(g, size * 0.58, -size * 0.12, size * 0.11);
      break;
    }
    case 'ray': {
      // 菱形翼身
      g.poly([size * 1.05, 0, 0, -size * 0.78, -size * 0.85, 0, 0, size * 0.78]).fill(color);
      g.poly([size * 0.6, 0, 0, -size * 0.45, -size * 0.5, 0, 0, size * 0.45]).fill({ color: shade(color, 1.18), alpha: 0.5 });
      // 长尾
      g.moveTo(-size * 0.8, 0)
        .quadraticCurveTo(-size * 1.3, size * 0.1, -size * 1.65, -size * 0.12)
        .stroke({ color: shade(color, 0.8), width: size * 0.07, cap: 'round' });
      drawEye(g, size * 0.42, -size * 0.16, size * 0.1);
      g.ellipse(-size * 0.05, -size * 0.1, size * 0.3, size * 0.12).fill({ color: 0xffffff, alpha: 0.14 });
      break;
    }
    case 'turtle': {
      // 鳍足
      for (const [fx, fy, ra] of [
        [size * 0.42, -size * 0.5, -0.7],
        [size * 0.42, size * 0.5, 0.7],
        [-size * 0.5, -size * 0.44, -2.4],
        [-size * 0.5, size * 0.44, 2.4],
      ] as const) {
        const fin = new Graphics();
        fin.ellipse(0, 0, size * 0.3, size * 0.13).fill(0x7aa86a);
        fin.rotation = ra;
        fin.position.set(fx, fy);
        c.addChild(fin);
      }
      g.ellipse(0, 0, size * 0.78, size * 0.6).fill(0x3f6e4a);
      g.ellipse(0, 0, size * 0.62, size * 0.46).fill(0x54855c);
      // 龟甲纹
      g.moveTo(-size * 0.5, -size * 0.2).lineTo(size * 0.5, -size * 0.2).stroke({ color: 0x2c5236, width: 2 });
      g.moveTo(-size * 0.5, size * 0.2).lineTo(size * 0.5, size * 0.2).stroke({ color: 0x2c5236, width: 2 });
      g.moveTo(-size * 0.2, -size * 0.55).lineTo(-size * 0.2, size * 0.55).stroke({ color: 0x2c5236, width: 2 });
      g.moveTo(size * 0.2, -size * 0.55).lineTo(size * 0.2, size * 0.55).stroke({ color: 0x2c5236, width: 2 });
      // 头
      g.circle(size * 0.88, 0, size * 0.2).fill(0x7aa86a);
      drawEye(g, size * 0.94, -size * 0.06, size * 0.06);
      g.ellipse(-size * 0.1, -size * 0.24, size * 0.4, size * 0.14).fill({ color: 0xffffff, alpha: 0.14 });
      break;
    }
    case 'shark':
    case 'goldenShark': {
      const gold = typeId === 'goldenShark';
      if (gold) {
        g.circle(0, 0, size * 1.15).fill({ color: 0xf2d692, alpha: 0.12 });
      }
      tail = new Graphics();
      tail.poly([0, 0, -size * 0.42, -size * 0.52, -size * 0.28, -size * 0.05, -size * 0.36, size * 0.34]).fill(shade(color, 0.85));
      tail.x = -size * 0.95;
      c.addChild(tail);
      // 身体（尖吻流线）
      g.poly([
        size * 1.05, 0, size * 0.7, -size * 0.3, size * 0.1, -size * 0.42, -size * 0.6, -size * 0.3,
        -size * 0.98, -size * 0.06, -size * 0.98, size * 0.1, -size * 0.5, size * 0.34, size * 0.2, size * 0.4, size * 0.8, size * 0.2,
      ]).fill(color);
      // 白腹
      g.poly([size * 0.95, size * 0.05, size * 0.6, size * 0.28, -size * 0.2, size * 0.37, -size * 0.7, size * 0.24, -size * 0.4, size * 0.12, size * 0.4, size * 0.16]).fill({
        color: gold ? 0xf4e6c2 : 0xd8e0e8,
        alpha: 0.9,
      });
      // 背鳍
      g.poly([-size * 0.05, -size * 0.4, size * 0.14, -size * 0.85, size * 0.32, -size * 0.38]).fill(shade(color, 0.85));
      // 胸鳍
      g.poly([size * 0.25, size * 0.2, -size * 0.05, size * 0.62, size * 0.4, size * 0.34]).fill(shade(color, 0.8));
      // 鳃线
      for (let i = 0; i < 3; i += 1) {
        g.moveTo(size * (0.42 - i * 0.09), -size * 0.18)
          .lineTo(size * (0.38 - i * 0.09), size * 0.14)
          .stroke({ color: shade(color, 0.7), width: size * 0.035 });
      }
      drawEye(g, size * 0.72, -size * 0.14, size * 0.09);
      break;
    }
    case 'whale': {
      tail = new Graphics();
      tail.poly([0, 0, -size * 0.4, -size * 0.34, -size * 0.24, -size * 0.02, -size * 0.4, size * 0.3]).fill(shade(color, 0.85));
      tail.x = -size * 0.98;
      c.addChild(tail);
      // 大体腔
      g.ellipse(0, 0, size * 1.02, size * 0.56).fill(color);
      g.poly([size * 0.5, -size * 0.3, size * 1.08, -size * 0.05, size * 1.02, size * 0.22, size * 0.4, size * 0.34]).fill(color);
      // 腹纹
      g.ellipse(size * 0.1, size * 0.3, size * 0.85, size * 0.26).fill({ color: 0xbcd0e4, alpha: 0.85 });
      for (let i = 0; i < 4; i += 1) {
        g.moveTo(-size * 0.5, size * (0.16 + i * 0.09))
          .quadraticCurveTo(size * 0.2, size * (0.3 + i * 0.09), size * 0.9, size * (0.12 + i * 0.09))
          .stroke({ color: 0x8fa8c2, width: size * 0.02, alpha: 0.6 });
      }
      // 背脊小鳍
      g.poly([-size * 0.2, -size * 0.5, -size * 0.05, -size * 0.68, size * 0.1, -size * 0.48]).fill(shade(color, 0.85));
      g.ellipse(-size * 0.15, -size * 0.3, size * 0.6, size * 0.18).fill({ color: 0xffffff, alpha: 0.12 });
      drawEye(g, size * 0.82, size * 0.02, size * 0.07);
      // 喷水
      g.moveTo(size * 0.35, -size * 0.55).quadraticCurveTo(size * 0.3, -size * 0.85, size * 0.12, -size * 0.95).stroke({ color: 0xbfe8f2, width: size * 0.035, alpha: 0.7, cap: 'round' });
      g.moveTo(size * 0.38, -size * 0.55).quadraticCurveTo(size * 0.48, -size * 0.85, size * 0.62, -size * 0.92).stroke({ color: 0xbfe8f2, width: size * 0.035, alpha: 0.7, cap: 'round' });
      break;
    }
    case 'dragonKing': {
      g.circle(0, 0, size * 1.2).fill({ color: 0x9a4ed0, alpha: 0.13 });
      tail = new Graphics();
      tail.poly([0, 0, -size * 0.5, -size * 0.4, -size * 0.66, 0, -size * 0.5, size * 0.4]).fill(0x7a3aa8);
      tail.x = -size * 0.95;
      c.addChild(tail);
      // 蛇形躯干（三段波浪）
      g.moveTo(-size * 0.95, 0)
        .quadraticCurveTo(-size * 0.5, -size * 0.42, 0, -size * 0.05)
        .quadraticCurveTo(size * 0.4, size * 0.26, size * 0.85, -size * 0.05)
        .stroke({ color, width: size * 0.44, cap: 'round' });
      g.moveTo(-size * 0.9, 0)
        .quadraticCurveTo(-size * 0.5, -size * 0.36, 0, -size * 0.02)
        .quadraticCurveTo(size * 0.4, size * 0.28, size * 0.8, -size * 0.02)
        .stroke({ color: shade(color, 1.25), width: size * 0.2, cap: 'round', alpha: 0.7 });
      // 背棘
      for (let i = 0; i < 6; i += 1) {
        const bx = -size * 0.75 + i * size * 0.28;
        const by = -size * (0.28 - Math.sin(i * 1.1) * 0.12) - size * 0.12;
        g.poly([bx - size * 0.06, by, bx + size * 0.02, by - size * 0.3, bx + size * 0.1, by]).fill(0xd9b352);
      }
      // 龙首
      g.ellipse(size * 0.92, -size * 0.05, size * 0.3, size * 0.2).fill(shade(color, 1.1));
      g.poly([size * 1.14, -size * 0.1, size * 1.34, -size * 0.05, size * 1.14, size * 0.05]).fill(shade(color, 0.9));
      // 龙角与须
      g.moveTo(size * 0.86, -size * 0.22).lineTo(size * 0.74, -size * 0.48).stroke({ color: 0xd9b352, width: size * 0.05, cap: 'round' });
      g.moveTo(size * 0.98, -size * 0.22).lineTo(size * 0.94, -size * 0.5).stroke({ color: 0xd9b352, width: size * 0.05, cap: 'round' });
      g.moveTo(size * 1.16, size * 0.02).quadraticCurveTo(size * 1.36, size * 0.18, size * 1.28, size * 0.34).stroke({ color: 0xe8cf82, width: size * 0.03, cap: 'round' });
      drawEye(g, size * 0.96, -size * 0.1, size * 0.07);
      break;
    }
    default: {
      // 小型鱼通用（sardine/butterfly 按色区分）
      tail = makeTail(color, size);
      tail.x = -size * 0.92;
      c.addChild(tail);
      body();
      dorsal();
      pectoral();
      // 侧线条纹
      g.moveTo(-size * 0.7, 0).quadraticCurveTo(0, size * 0.08, size * 0.6, -size * 0.02).stroke({ color: shade(color, 1.3), width: size * 0.05, alpha: 0.5 });
      drawEye(g, size * 0.62, -size * 0.12, size * 0.11);
    }
  }
  c.addChild(g);
  const tp = type;
  if (tp && tp.size !== 'small') {
    const label = new Text({
      text: `×${tp.baseOdds}`,
      style: { fontSize: Math.max(11, size * 0.22), fill: 0xffe9c2, fontWeight: '800', stroke: { color: 0x14100a, width: 3 } },
    });
    label.anchor.set(0.5);
    label.y = size * 0.78;
    c.addChild(label);
  }
  return { node: c, tail, size };
}

function spawnFish(list: { fishId: number; typeId: string; pathId: number; spawnAtMs: number; speedScale: number }[]): void {
  for (const f of list) {
    if (fishes.has(f.fishId)) continue;
    const { node, tail, size } = buildFishNode(f.typeId);
    node.visible = false;
    fishLayer.addChild(node);
    fishes.set(f.fishId, { ...f, node, tail, size, dead: false });
  }
}

function serverNow(): number {
  return Date.now() + serverOffset;
}

function updateFish(): void {
  const now = serverNow();
  for (const [id, f] of fishes) {
    const path = pathById.get(f.pathId);
    if (!path) continue;
    const dur = path.durationMs / f.speedScale;
    const tt = (now - f.spawnAtMs) / dur;
    if (tt < 0) {
      f.node.visible = false;
      continue;
    }
    if (tt > 1) {
      f.node.destroy();
      fishes.delete(id);
      continue;
    }
    const [nx, ny] = pointOnPath(path, tt);
    const [nx2, ny2] = pointOnPath(path, Math.min(1, tt + 0.008));
    const x = nx * W();
    const y = ny * H();
    f.node.visible = true;
    f.node.position.set(x, y);
    const dx = nx2 - nx;
    f.node.scale.x = dx >= 0 ? 1 : -1;
    f.node.rotation = dx >= 0 ? Math.atan2(ny2 - ny, Math.abs(dx)) * 0.6 : -Math.atan2(ny2 - ny, Math.abs(dx)) * 0.6;
    // 轻微摆动 + 尾鳍游动
    f.node.y += Math.sin(now / 260 + id) * 2;
    if (f.tail) f.tail.rotation = Math.sin(now / 110 + id * 0.7) * 0.34;
  }
}

function fireVisual(fromX: number, fromY: number, deg: number, bulletId: string, mine: boolean): void {
  const rad = (deg * Math.PI) / 180;
  const g = new Graphics();
  const main = mine ? 0xf3d489 : 0x9fc4de;
  const rim = mine ? 0xc9a063 : 0x6f90aa;
  // 彗尾（朝行进反方向）
  g.poly([-26, 0, -6, -4.5, -6, 4.5]).fill({ color: main, alpha: 0.28 });
  g.poly([-16, 0, -4, -3, -4, 3]).fill({ color: main, alpha: 0.5 });
  // 弹体
  g.circle(0, 0, 6.5).fill(main);
  g.circle(0, 0, 6.5).stroke({ color: rim, width: 1.6 });
  g.circle(0, 0, 10.5).stroke({ color: rim, width: 1.4, alpha: 0.5 });
  g.circle(-1.6, -1.8, 2).fill({ color: 0xffffff, alpha: 0.7 });
  g.rotation = rad;
  g.position.set(fromX, fromY);
  bulletLayer.addChild(g);
  bullets.push({ bulletId, node: g, vx: Math.cos(rad) * 10.5, vy: Math.sin(rad) * 10.5, mine });
  // 炮口后坐 + 口焰
  if (mine && cannon) {
    cannon.y += 5;
    const flash = new Graphics();
    flash.poly(starPointsFx(0, 0, 15, 6, 6)).fill({ color: 0xfff0c8, alpha: 0.9 });
    flash.position.set(fromX + Math.cos(rad) * 46, fromY + Math.sin(rad) * 46);
    fxLayer.addChild(flash);
    setTimeout(() => {
      if (!destroyed) {
        cannon.y -= 5;
        flash.destroy();
      }
    }, 70);
  }
}

function starPointsFx(cx: number, cy: number, rOut: number, rIn: number, n: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i += 1) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = (Math.PI * i) / n;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

function updateBullets(): void {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i]!;
    b.node.x += b.vx;
    b.node.y += b.vy;
    b.node.rotation = Math.atan2(b.vy, b.vx);
    // 边缘反弹一次后消失
    if (b.node.x < 0 || b.node.x > W()) b.vx *= -1;
    if (b.node.y < -20 || b.node.y > H() + 20) {
      b.node.destroy();
      bullets.splice(i, 1);
      continue;
    }
    if (!b.mine) continue;
    // 客户端视觉碰撞 → 提交服务端判定
    for (const [, f] of fishes) {
      if (f.dead || !f.node.visible) continue;
      const dx = f.node.x - b.node.x;
      const dy = f.node.y - b.node.y;
      if (dx * dx + dy * dy < f.size * f.size * 0.72) {
        b.node.destroy();
        bullets.splice(i, 1);
        void resolveHit(b.bulletId, f);
        break;
      }
    }
  }
}

async function resolveHit(bulletId: string, f: LiveFish): Promise<void> {
  hitFlash(f);
  try {
    const r = await gameSocket.call<{ hit: boolean; dead: boolean; reward: number; balance?: number }>(
      Ev.FsHit,
      { bulletId, fishId: f.fishId },
      6000,
    );
    if (r.dead) {
      killFx(f, r.reward);
      if (r.balance !== undefined) {
        balance.value = r.balance;
        user.setBalance(r.balance);
      }
    }
  } catch {
    /* 服务端裁定未通过：仅视觉命中 */
  }
}

function hitFlash(f: LiveFish): void {
  f.node.alpha = 0.45;
  setTimeout(() => {
    if (!f.node.destroyed) f.node.alpha = 1;
  }, 70);
}

function killFx(f: LiveFish, reward: number): void {
  f.dead = true;
  const { x, y } = f.node;
  // 金币飞行
  for (let i = 0; i < Math.min(10, 3 + Math.floor(reward / 100)); i += 1) {
    const coin = new Graphics();
    // 立体金币：外环 + 内盘 + 高光 + 币面纹
    coin.circle(0, 0, 8).fill(0x8a6b3c);
    coin.circle(0, 0, 6.6).fill(0xe9c975);
    coin.circle(0, 0, 4.4).stroke({ color: 0xa87c2e, width: 1.2 });
    coin.rect(-0.9, -3, 1.8, 6).fill(0xa87c2e);
    coin.circle(-2.2, -2.4, 1.8).fill({ color: 0xffffff, alpha: 0.55 });
    coin.position.set(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 30);
    fxLayer.addChild(coin);
    const tx = W() - 80;
    const ty = 30;
    const sx = coin.x;
    const sy = coin.y;
    const start = performance.now();
    const durMs = 550 + Math.random() * 250;
    const tick = (): void => {
      const p = Math.min(1, (performance.now() - start) / durMs);
      const ease = p * p * (3 - 2 * p);
      coin.x = sx + (tx - sx) * ease;
      coin.y = sy + (ty - sy) * ease - Math.sin(p * Math.PI) * 60;
      if (p < 1 && !destroyed) requestAnimationFrame(tick);
      else coin.destroy();
    };
    requestAnimationFrame(tick);
  }
  // 爆点
  const burst = new Graphics();
  burst.circle(0, 0, f.size * 0.8).fill({ color: 0xf7e3b0, alpha: 0.55 });
  burst.position.set(x, y);
  fxLayer.addChild(burst);
  const s0 = performance.now();
  const btick = (): void => {
    const p = Math.min(1, (performance.now() - s0) / 240);
    burst.scale.set(1 + p * 0.9);
    burst.alpha = 0.55 * (1 - p);
    if (p < 1 && !destroyed) requestAnimationFrame(btick);
    else burst.destroy();
  };
  requestAnimationFrame(btick);
  f.node.destroy();
  fishes.delete(f.fishId);
  popSeq += 1;
  const id = popSeq;
  rewardPops.value.push({ id, amount: reward });
  setTimeout(() => {
    rewardPops.value = rewardPops.value.filter((r) => r.id !== id);
  }, 1400);
}

async function doFire(clientX?: number, clientY?: number): Promise<void> {
  if (firing || !app) return;
  if (clientX !== undefined && clientY !== undefined && stageEl.value) {
    const rect = stageEl.value.getBoundingClientRect();
    const dx = clientX - rect.left - W() / 2;
    const dy = clientY - rect.top - (H() - 30);
    aimDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  }
  if (cannon) cannon.rotation = ((aimDeg + 90) * Math.PI) / 180;
  firing = true;
  try {
    const r = await gameSocket.call<{ bulletId: string; balance: number }>(Ev.FsFire, { multiplier: multiplier.value, dirDeg: aimDeg }, 5000);
    balance.value = r.balance;
    user.setBalance(r.balance);
    fireVisual(W() / 2, H() - 30, aimDeg, r.bulletId, true);
  } catch (e) {
    const err = e as Error & { code?: number };
    if (err.code === 3000) toast(t('error.INSUFFICIENT_BALANCE'), 'error');
  } finally {
    firing = false;
  }
}

function stepMult(dir: number): void {
  const idx = multipliers.value.indexOf(multiplier.value);
  const next = multipliers.value[Math.min(multipliers.value.length - 1, Math.max(0, idx + dir))];
  if (next) multiplier.value = next;
}

function toggleAuto(): void {
  autoFire.value = !autoFire.value;
  if (autoFire.value) {
    autoTimer = window.setInterval(() => void doFire(), 300);
  } else {
    window.clearInterval(autoTimer);
  }
}

async function exit(): Promise<void> {
  await gameSocket.call('fishing.leave').catch(() => undefined);
  void router.replace('/lobby');
}

onMounted(async () => {
  if (gameSocket.status !== 'open') await gameSocket.connect();
  app = new Application();
  await app.init({ resizeTo: stageEl.value!, background: 0x06121e, antialias: true, resolution: Math.min(2, window.devicePixelRatio) });
  stageEl.value!.appendChild(app.canvas);

  // 背景层：多层水色渐变 + 海底剪影 + 光柱 + 气泡
  const bg = new Graphics();
  const seabed = new Graphics();
  const drawBg = (): void => {
    const w = W();
    const h = H();
    bg.clear();
    // 纵向水色分层（模拟深度渐变）
    const bands = [0x0d2740, 0x0b2136, 0x091b2d, 0x071524, 0x05101c, 0x040c16];
    for (let i = 0; i < bands.length; i += 1) {
      bg.rect(0, (h / bands.length) * i, w, h / bands.length + 1).fill(bands[i]!);
    }
    // 顶部水面光带
    bg.rect(0, 0, w, h * 0.06).fill({ color: 0x9fd4e8, alpha: 0.07 });
    // 四角暗角
    bg.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.001 });
    seabed.clear();
    // 远景沙丘
    seabed.poly([0, h, 0, h - 46, w * 0.18, h - 72, w * 0.4, h - 40, w * 0.62, h - 66, w * 0.85, h - 36, w, h - 58, w, h]).fill({ color: 0x0a1a2a, alpha: 0.9 });
    // 近景礁石
    seabed.poly([0, h, 0, h - 26, w * 0.12, h - 44, w * 0.22, h - 20, w * 0.3, h - 34, w * 0.4, h - 14, 0, h]).fill(0x061119);
    seabed.poly([w, h, w, h - 30, w * 0.88, h - 52, w * 0.78, h - 22, w * 0.68, h - 36, w * 0.58, h - 12, w, h]).fill(0x061119);
    // 珊瑚枝
    for (const [cx2, s] of [
      [w * 0.16, 1],
      [w * 0.82, 1.25],
      [w * 0.55, 0.8],
    ] as const) {
      const bh = 34 * s;
      seabed.moveTo(cx2, h - 6).quadraticCurveTo(cx2 - 8 * s, h - bh * 0.6, cx2 - 14 * s, h - bh).stroke({ color: 0x2c4a5a, width: 3.4 * s, cap: 'round' });
      seabed.moveTo(cx2, h - 6).quadraticCurveTo(cx2 + 6 * s, h - bh * 0.7, cx2 + 12 * s, h - bh * 1.15).stroke({ color: 0x2c4a5a, width: 3 * s, cap: 'round' });
      seabed.moveTo(cx2 + 2 * s, h - bh * 0.55).lineTo(cx2 + 14 * s, h - bh * 0.75).stroke({ color: 0x2c4a5a, width: 2.4 * s, cap: 'round' });
    }
    // 海草
    for (const kx of [w * 0.07, w * 0.33, w * 0.7, w * 0.93]) {
      seabed.moveTo(kx, h).quadraticCurveTo(kx - 8, h - 26, kx + 4, h - 48).stroke({ color: 0x14382e, width: 4, cap: 'round' });
      seabed.moveTo(kx + 8, h).quadraticCurveTo(kx + 16, h - 20, kx + 8, h - 36).stroke({ color: 0x14382e, width: 3, cap: 'round' });
    }
  };
  drawBg();
  app.stage.addChild(bg);
  const rays = new Container();
  for (let i = 0; i < 4; i += 1) {
    const ray = new Graphics();
    ray.moveTo(0, 0).lineTo(80, 0).lineTo(220, H()).lineTo(-60, H()).closePath().fill({ color: 0x9fd4e8, alpha: 0.045 });
    ray.x = (i + 0.5) * (W() / 4);
    ray.rotation = -0.12;
    rays.addChild(ray);
  }
  app.stage.addChild(rays);
  app.stage.addChild(seabed);
  fishLayer = new Container();
  bulletLayer = new Container();
  fxLayer = new Container();
  app.stage.addChild(fishLayer, bulletLayer, fxLayer);

  // 炮台：固定基座 + 旋转炮塔
  const cannonBase = new Graphics();
  cannonBase.ellipse(0, 16, 44, 14).fill({ color: 0x000000, alpha: 0.4 });
  cannonBase.poly([-40, 18, -26, -6, 26, -6, 40, 18]).fill(0x1a2130);
  cannonBase.poly([-40, 18, -26, -6, 26, -6, 40, 18]).stroke({ color: 0x8a6b3c, width: 1.6 });
  cannonBase.circle(0, -2, 24).fill(0x232c40);
  cannonBase.circle(0, -2, 24).stroke({ color: 0xc9a063, width: 2 });
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI * 2 * i) / 6;
    cannonBase.circle(Math.cos(a) * 18, -2 + Math.sin(a) * 18, 1.8).fill(0xc9a063);
  }
  app.stage.addChild(cannonBase);

  cannon = new Container();
  const barrel = new Graphics();
  // 锥形炮管 + 双金箍 + 炮口
  barrel.poly([-8, 0, 8, 0, 11, -34, 13, -50, -13, -50, -11, -34]).fill(0x2c3550);
  barrel.poly([-8, 0, 8, 0, 11, -34, 13, -50, -13, -50, -11, -34]).stroke({ color: 0x1a2130, width: 1.2 });
  barrel.rect(-11.6, -38, 23.2, 6).fill(0xc9a063);
  barrel.rect(-9.6, -16, 19.2, 5).fill(0xa8874e);
  barrel.roundRect(-14.5, -56, 29, 8, 3).fill(0x3a4358);
  barrel.roundRect(-14.5, -56, 29, 8, 3).stroke({ color: 0xc9a063, width: 1.4 });
  barrel.poly([-3.5, -2, 3.5, -2, 4.5, -48, -4.5, -48]).fill({ color: 0xffffff, alpha: 0.08 });
  const hub2 = new Graphics();
  hub2.circle(0, 0, 12).fill(0x2c3550);
  hub2.circle(0, 0, 12).stroke({ color: 0xc9a063, width: 1.8 });
  hub2.circle(0, 0, 5).fill(0xc9a063);
  hub2.circle(-1.4, -1.6, 1.6).fill({ color: 0xffffff, alpha: 0.6 });
  cannon.addChild(barrel, hub2);
  cannon.position.set(W() / 2, H() - 32);
  app.stage.addChild(cannon);

  const bubbles: { g: Graphics; v: number }[] = [];
  for (let i = 0; i < 14; i += 1) {
    const b = new Graphics();
    b.circle(0, 0, 2 + Math.random() * 3).stroke({ color: 0xbfe4f2, width: 1, alpha: 0.35 });
    b.position.set(Math.random() * W(), Math.random() * H());
    app.stage.addChild(b);
    bubbles.push({ g: b, v: 0.3 + Math.random() * 0.5 });
  }

  app.ticker.add(() => {
    updateFish();
    updateBullets();
    for (const b of bubbles) {
      b.g.y -= b.v;
      if (b.g.y < -6) {
        b.g.y = H() + 6;
        b.g.x = Math.random() * W();
      }
    }
    cannon.position.set(W() / 2, H() - 30);
  });

  // 指针交互：点击/拖动开火
  app.canvas.addEventListener('pointerdown', (e) => void doFire(e.clientX, e.clientY));
  app.canvas.addEventListener('pointermove', (e) => {
    if (!stageEl.value) return;
    const rect = stageEl.value.getBoundingClientRect();
    const dx = e.clientX - rect.left - W() / 2;
    const dy = e.clientY - rect.top - (H() - 30);
    aimDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    cannon.rotation = ((aimDeg + 90) * Math.PI) / 180;
  });

  // WS 事件
  offs.push(
    gameSocket.on(Ev.FsState, (m) => {
      const d = m.data as any;
      serverOffset = d.serverNow - Date.now();
      balance.value = d.balance ?? balance.value;
      multipliers.value = d.stage.multipliers;
      multiplier.value = multipliers.value[0]!;
      bulletBaseCost.value = d.stage.bulletBaseCost;
      spawnFish(d.fish ?? []);
    }),
    gameSocket.on(Ev.FsWave, (m) => {
      const d = m.data as any;
      serverOffset = d.serverNow - Date.now();
      spawnFish(d.fish ?? []);
    }),
    gameSocket.on(Ev.FsBossWarning, () => {
      bossWarning.value = true;
      setTimeout(() => (bossWarning.value = false), 4200);
    }),
    gameSocket.on(Ev.FsPlayerFire, (m) => {
      const d = m.data as any;
      // 他人子弹从顶部相应位置射出
      fireVisual((W() / 4) * ((d.seat % 4) + 0.5), 24, 90 - (d.dirDeg + 90), d.bulletId, false);
    }),
    gameSocket.on(Ev.FsFishKilled, (m) => {
      const d = m.data as any;
      const f = fishes.get(d.fishId);
      if (f && d.byUid !== user.me?.uid) {
        killFx(f, 0);
        rewardPops.value.pop();
      }
    }),
  );

  await gameSocket.call('fishing.enter', { stageId: String(route.query.stageId ?? 'fishing_novice') }).catch((e) => {
    toast((e as Error).message, 'error');
    void router.replace('/lobby');
  });
});

onBeforeUnmount(() => {
  destroyed = true;
  window.clearInterval(autoTimer);
  for (const off of offs) off();
  void gameSocket.call('fishing.leave').catch(() => undefined);
  app?.destroy(true, { children: true });
  app = null;
});
</script>

<style scoped>
.fs-root {
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #06121e;
}
.stage {
  position: absolute;
  inset: 0;
}
.hud-top {
  position: absolute;
  top: calc(var(--safe-top) + 8px);
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  z-index: 5;
  pointer-events: none;
}
.hback {
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--line-soft);
  color: var(--gold-champagne);
  border-radius: 12px;
  padding: 7px 14px;
  cursor: pointer;
  font-size: 13px;
}
.hcoins {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  padding: 7px 14px;
  font-size: 13px;
  color: var(--gold-warm);
  font-weight: 700;
}
.boss-banner {
  position: absolute;
  top: 22%;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(90deg, transparent, rgba(181, 73, 91, 0.85), transparent);
  color: #ffe7ec;
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 0.2em;
  padding: 10px 60px;
  z-index: 6;
  animation: glow-pulse 0.8s ease infinite;
  white-space: nowrap;
}
.hud-bottom {
  position: absolute;
  bottom: calc(var(--safe-bottom) + 10px);
  left: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 5;
}
.mult {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 14px;
}
.mbtn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: var(--bg-night);
  color: var(--gold-champagne);
  font-size: 16px;
  cursor: pointer;
}
.mval {
  min-width: 48px;
  text-align: center;
  color: var(--gold-champagne);
  font-weight: 800;
  font-size: 15px;
}
.activeAuto {
  border-color: var(--accent-jade);
  color: var(--accent-jade);
}
.cost {
  font-size: 11px;
  color: var(--text-secondary);
}
.reward-pops {
  position: absolute;
  right: 20px;
  top: 30%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 6;
  pointer-events: none;
}
.rpop {
  color: #ffe9b0;
  font-weight: 800;
  font-size: 18px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}
</style>
