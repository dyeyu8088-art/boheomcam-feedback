<template>
  <div class="fs-root">
    <div ref="stageEl" class="stage" />

    <!-- HUD -->
    <div class="hud-top">
      <button class="hback" @click="exit">‹ {{ t('fs.exit') }}</button>
      <div class="hcoins num">◉ {{ fmt(balance) }}</div>
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

function buildFishNode(typeId: string): { node: Container; size: number } {
  const type = FISH_TYPES.find((f) => f.typeId === typeId);
  const size = FISH_SIZE[type?.size ?? 'small'] ?? 30;
  const color = FISH_COLORS[typeId] ?? 0x88aacc;
  const c = new Container();
  const g = new Graphics();
  // 鱼体
  g.ellipse(0, 0, size, size * 0.46).fill(color);
  g.ellipse(-size * 0.18, -size * 0.1, size * 0.72, size * 0.3).fill({ color: 0xffffff, alpha: 0.14 });
  // 尾巴
  g.moveTo(-size, 0)
    .lineTo(-size * 1.42, -size * 0.4)
    .lineTo(-size * 1.42, size * 0.4)
    .closePath()
    .fill({ color, alpha: 0.85 });
  // 背鳍
  g.moveTo(-size * 0.2, -size * 0.42)
    .lineTo(size * 0.14, -size * 0.78)
    .lineTo(size * 0.34, -size * 0.4)
    .closePath()
    .fill({ color, alpha: 0.8 });
  // 眼睛
  g.circle(size * 0.62, -size * 0.12, size * 0.11).fill(0xffffff);
  g.circle(size * 0.66, -size * 0.12, size * 0.055).fill(0x14161c);
  c.addChild(g);
  const tp = FISH_TYPES.find((f) => f.typeId === typeId);
  if (tp && tp.size !== 'small') {
    const label = new Text({
      text: `×${tp.baseOdds}`,
      style: { fontSize: Math.max(11, size * 0.24), fill: 0xffe9c2, fontWeight: '800', stroke: { color: 0x14100a, width: 3 } },
    });
    label.anchor.set(0.5);
    label.y = size * 0.72;
    c.addChild(label);
  }
  return { node: c, size };
}

function spawnFish(list: { fishId: number; typeId: string; pathId: number; spawnAtMs: number; speedScale: number }[]): void {
  for (const f of list) {
    if (fishes.has(f.fishId)) continue;
    const { node, size } = buildFishNode(f.typeId);
    node.visible = false;
    fishLayer.addChild(node);
    fishes.set(f.fishId, { ...f, node, size, dead: false });
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
    // 轻微摆动
    f.node.y += Math.sin(now / 260 + id) * 2;
  }
}

function fireVisual(fromX: number, fromY: number, deg: number, bulletId: string, mine: boolean): void {
  const rad = (deg * Math.PI) / 180;
  const g = new Graphics();
  g.circle(0, 0, 7).fill(mine ? 0xf3d489 : 0x9fc4de);
  g.circle(0, 0, 11).stroke({ color: mine ? 0xc9a063 : 0x6f90aa, width: 2, alpha: 0.7 });
  g.position.set(fromX, fromY);
  bulletLayer.addChild(g);
  bullets.push({ bulletId, node: g, vx: Math.cos(rad) * 10.5, vy: Math.sin(rad) * 10.5, mine });
  // 炮口后坐
  if (mine && cannon) {
    cannon.y += 5;
    setTimeout(() => {
      if (!destroyed) cannon.y -= 5;
    }, 60);
  }
}

function updateBullets(): void {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i]!;
    b.node.x += b.vx;
    b.node.y += b.vy;
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
    coin.circle(0, 0, 7).fill(0xe9c975);
    coin.circle(0, 0, 4).stroke({ color: 0xa87c2e, width: 1.5 });
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

  // 背景层：渐变 + 光柱 + 气泡
  const bg = new Graphics();
  const drawBg = (): void => {
    bg.clear();
    bg.rect(0, 0, W(), H()).fill({ color: 0x07131f });
    bg.rect(0, 0, W(), H() * 0.5).fill({ color: 0x0b2233, alpha: 0.8 });
    bg.rect(0, H() * 0.72, W(), H() * 0.28).fill({ color: 0x041018, alpha: 0.9 });
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
  fishLayer = new Container();
  bulletLayer = new Container();
  fxLayer = new Container();
  app.stage.addChild(fishLayer, bulletLayer, fxLayer);

  // 炮台
  cannon = new Container();
  const base = new Graphics();
  base.circle(0, 0, 30).fill(0x1d2432);
  base.circle(0, 0, 30).stroke({ color: 0xc9a063, width: 2 });
  const barrel = new Graphics();
  barrel.roundRect(-9, -52, 18, 52, 8).fill(0x2c3550);
  barrel.roundRect(-9, -52, 18, 52, 8).stroke({ color: 0xc9a063, width: 1.5 });
  cannon.addChild(barrel, base);
  cannon.position.set(W() / 2, H() - 30);
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
