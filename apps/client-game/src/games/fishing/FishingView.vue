<template>
  <div class="fs-root" :class="{ frozen: frozenActive }">
    <div ref="stageEl" class="stage" />

    <!-- ══ 顶栏：退出 / 金币 / 同桌玩家 / Boss 血条 ══ -->
    <div class="hud-top">
      <GameButton round size="md" :art="exitArt" class="hback" sfx="close" @click="exit" />
      <CurrencyBar kind="coin" :value="balance" class="hcoins" />
      <div class="players">
        <span v-for="p in others" :key="p.uid" class="pl">
          <AvatarBadge :id="p.avatarId" :size="26" />
          <span class="pl-name">{{ p.nickname }}</span>
          <span class="pl-mult num">×{{ p.multiplier }}</span>
        </span>
      </div>
      <div v-if="boss" class="boss-bar">
        <img class="bb-portrait" :src="bossPortrait" alt="" draggable="false" />
        <div class="bb-main">
          <div class="bb-name">{{ bossName }}</div>
          <ProgressBar :value="boss.hp / boss.maxHp" tone="red" :text="`${fmt(boss.hp)} / ${fmt(boss.maxHp)}`" class="bb-hp" />
        </div>
      </div>
    </div>

    <transition name="pop">
      <div v-if="bossWarning" class="boss-banner">
        <img :src="bossPortrait" alt="" draggable="false" />
        <span class="sk-outline-text">{{ t('fs.bossComing') }}</span>
      </div>
    </transition>
    <transition name="pop">
      <div v-if="frozenActive" class="frozen-tag sk-outline-text">{{ t('fs.frozen') }}</div>
    </transition>

    <!-- ══ 底栏：技能 / 炮倍 / 自动 ══ -->
    <div class="hud-bottom">
      <div class="skills">
        <button
          v-for="s in skillList"
          :key="s.skillId"
          class="skill"
          :class="{ cd: cooldownLeft(s.skillId) > 0, active: s.skillId === 'LOCK' && lockActive }"
          :disabled="skillPending"
          type="button"
          :title="t(`fs.skill.${s.skillId}`)"
          @click="useSkill(s.skillId)"
        >
          <img class="sk-icon" :src="skillIcon(s.skillId)" alt="" draggable="false" />
          <span v-if="cooldownLeft(s.skillId) > 0" class="sk-cd"><b class="num">{{ Math.ceil(cooldownLeft(s.skillId) / 1000) }}</b></span>
          <span class="sk-cost num" :class="{ item: itemQty(s) > 0 }">
            <template v-if="itemQty(s) > 0">×{{ itemQty(s) }}</template>
            <template v-else>{{ fmt(skillCost(s)) }}</template>
          </span>
        </button>
      </div>
      <div class="controls">
        <BetStepper v-model="multiplier" :options="multipliers" skin="fishingBlue" :format="(v: number) => `×${v}`" class="mult" />
        <div class="cost num">{{ bulletCost }} / {{ t('fs.shot') }}</div>
        <GameButton :art="autoArt" size="lg" class="auto" :class="{ on: autoFire }" sfx="toggle" @click="toggleAuto" />
      </div>
    </div>

    <transition-group name="toast" tag="div" class="reward-pops">
      <div v-for="r in rewardPops" :key="r.id" class="rpop sk-gold-text num">+{{ fmt(r.amount) }}</div>
    </transition-group>
    <RewardAnimation ref="reward" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Application, Container, FillGradient, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { Ev } from '@yanbian/protocol';
import { FISH_TYPES, SKILLS, frozenOverlapMs, pathById, pointOnPath, type FreezeWindow, type SkillConfig, type SkillId } from '@yanbian/game-common/fishing';
import { gameSocket } from '../../net/ws.js';
import { api } from '../../net/api.js';
import { useUserStore } from '../../stores/user.js';
import { t } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import { fmt } from '../../ui/format.js';
import { asset, pixiTextures, release } from '../../assets/assets.js';
import { audio } from '../../audio/AudioManager.js';
import GameButton from '../../ui/GameButton.vue';
import CurrencyBar from '../../ui/CurrencyBar.vue';
import BetStepper from '../../ui/BetStepper.vue';
import ProgressBar from '../../ui/ProgressBar.vue';
import AvatarBadge from '../../ui/AvatarBadge.vue';
import RewardAnimation from '../../ui/RewardAnimation.vue';

const route = useRoute();
const router = useRouter();
const user = useUserStore();
const stageEl = ref<HTMLDivElement | null>(null);
const reward = ref<InstanceType<typeof RewardAnimation> | null>(null);
const balance = ref(user.me?.coins ?? 0);
const multiplier = ref(1);
const multipliers = ref<number[]>([1, 2, 5, 10]);
const bulletBaseCost = ref(10);
const bulletCost = computed(() => bulletBaseCost.value * multiplier.value);
const autoFire = ref(false);
const bossWarning = ref(false);
const rewardPops = ref<{ id: number; amount: number }[]>([]);
const others = ref<{ uid: number; nickname: string; avatarId: number; multiplier: number }[]>([]);
const boss = ref<{ fishId: number; hp: number; maxHp: number; typeId: string } | null>(null);
const bossName = computed(() => (boss.value ? t(`fs.boss.${boss.value.typeId}`) : ''));
const frozenActive = ref(false);
const lockActive = ref(false);
const skillPending = ref(false);
const cooldowns = ref<Record<string, number>>({});
const inventory = ref<Record<string, number>>({});
const nowTick = ref(Date.now());
const skillList: SkillConfig[] = SKILLS;

const exitArt = asset('common', 'btnExitRound');
const autoArt = asset('fishing', 'btnAutoFire');
const bossPortrait = asset('fishing', 'bossCaishenFishRound');
const SKILL_ICON: Record<SkillId, string> = {
  LIGHTNING: asset('fishing', 'skillLightning'),
  MISSILE: asset('fishing', 'skillMissile'),
  LASER: asset('fishing', 'skillLaser'),
  NUKE: asset('fishing', 'skillNuke'),
  FREEZE: asset('fishing', 'skillFreeze'),
  LOCK: asset('fishing', 'skillLock'),
};
function skillIcon(id: SkillId): string {
  return SKILL_ICON[id];
}
function skillCost(s: SkillConfig): number {
  return s.costBullets * bulletBaseCost.value * multiplier.value;
}
function itemQty(s: SkillConfig): number {
  return s.itemId ? (inventory.value[s.itemId] ?? 0) : 0;
}
function cooldownLeft(id: SkillId): number {
  return Math.max(0, (cooldowns.value[id] ?? 0) - (nowTick.value + serverOffset));
}

let popSeq = 0;
let serverOffset = 0;
let myUid = 0;

/* ───────── Pixi 状态 ───────── */
interface LiveFish {
  fishId: number;
  typeId: string;
  pathId: number;
  spawnAtMs: number;
  speedScale: number;
  node: Container;
  sprite: Sprite;
  label: Text | null;
  size: number;
  dead: boolean;
  isBoss: boolean;
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
let world: Container; // 可整体震动的世界容器
let fishLayer: Container;
let fxLayer: Container;
let bulletLayer: Container;
let cannon: Sprite | null = null;
let cannonGlow: Graphics | null = null;
let reticle: Graphics | null = null;
let tex: Record<string, Texture> = {};
const fishes = new Map<number, LiveFish>();
const bullets: LiveBullet[] = [];
const freezes: FreezeWindow[] = [];
const pool: LiveFish[] = [];
let aimDeg = -90;
let autoTimer = 0;
let firing = false;
let destroyed = false;
let lockedFishId = 0;
let lockUntil = 0;
let mySeat = -1;
let shake = 0;
let tickTimer = 0;

/** 鱼种 → 精灵素材 + 缩放/染色（素材不足的鱼种用同族素材染色区分） */
const FISH_SPRITE: Record<string, { key: string; w: number; tint?: number; boss?: boolean }> = {
  sardine: { key: 'fishClown', w: 64, tint: 0xa9d6ff },
  clown: { key: 'fishClown', w: 84 },
  butterfly: { key: 'fishClown', w: 92, tint: 0xffe58a },
  puffer: { key: 'fishPuffer', w: 110 },
  lionfish: { key: 'fishPuffer', w: 120, tint: 0xff9a86 },
  ray: { key: 'fishTurtle', w: 140, tint: 0xb39cff },
  turtle: { key: 'fishTurtle', w: 160 },
  shark: { key: 'fishShark01', w: 220 },
  goldenShark: { key: 'fishGolden', w: 200 },
  whale: { key: 'fishSharkPurple', w: 320, boss: true },
  dragonKing: { key: 'bossCaishenFish', w: 260, boss: true },
};

function W(): number {
  return app?.renderer.width ?? 800;
}
function H(): number {
  return app?.renderer.height ?? 450;
}
function serverNow(): number {
  return Date.now() + serverOffset;
}
function cannonPos(): [number, number] {
  return [W() / 2, H() - 40];
}

/* ───────── 鱼对象池 ───────── */
function acquireFish(f: { fishId: number; typeId: string; pathId: number; spawnAtMs: number; speedScale: number }): LiveFish {
  const type = FISH_TYPES.find((x) => x.typeId === f.typeId);
  const spec = FISH_SPRITE[f.typeId] ?? FISH_SPRITE.clown!;
  let lf = pool.pop();
  if (!lf) {
    const node = new Container();
    const sprite = new Sprite();
    sprite.anchor.set(0.5);
    node.addChild(sprite);
    lf = { fishId: 0, typeId: '', pathId: 0, spawnAtMs: 0, speedScale: 1, node, sprite, label: null, size: 30, dead: false, isBoss: false };
  }
  lf.fishId = f.fishId;
  lf.typeId = f.typeId;
  lf.pathId = f.pathId;
  lf.spawnAtMs = f.spawnAtMs;
  lf.speedScale = f.speedScale;
  lf.dead = false;
  lf.isBoss = !!spec.boss;
  const texture = tex[spec.key];
  if (texture) {
    lf.sprite.texture = texture;
    const scale = spec.w / texture.width;
    lf.sprite.scale.set(scale);
  }
  lf.sprite.tint = spec.tint ?? 0xffffff;
  lf.sprite.alpha = 1;
  lf.size = spec.w * 0.45;
  lf.node.visible = false;
  lf.node.alpha = 1;
  lf.node.rotation = 0;
  lf.node.scale.set(1);
  // 赔率标签（中大型鱼）
  if (type && type.size !== 'small') {
    if (!lf.label) {
      lf.label = new Text({ text: '', style: { fontSize: 14, fill: 0xffe9a6, fontWeight: '900', stroke: { color: 0x2a1500, width: 3 } } });
      lf.label.anchor.set(0.5);
      lf.node.addChild(lf.label);
    }
    lf.label.text = `×${type.baseOdds}`;
    lf.label.y = spec.w * 0.32;
    lf.label.visible = true;
  } else if (lf.label) lf.label.visible = false;
  fishLayer.addChild(lf.node);
  return lf;
}
function releaseFish(lf: LiveFish): void {
  fishLayer.removeChild(lf.node);
  lf.node.visible = false;
  fishes.delete(lf.fishId);
  if (pool.length < 96) pool.push(lf);
}

function spawnFish(list: { fishId: number; typeId: string; pathId: number; spawnAtMs: number; speedScale: number }[]): void {
  for (const f of list) {
    if (fishes.has(f.fishId)) continue;
    fishes.set(f.fishId, acquireFish(f));
  }
}

function updateFish(): void {
  const now = serverNow();
  frozenActive.value = freezes.some((w) => w.startMs <= now && now < w.endMs);
  for (const f of fishes.values()) {
    const path = pathById.get(f.pathId);
    if (!path) continue;
    const dur = path.durationMs / f.speedScale;
    const eff = now - frozenOverlapMs(freezes, f.spawnAtMs, now);
    const tt = (eff - f.spawnAtMs) / dur;
    if (tt < 0) {
      f.node.visible = false;
      continue;
    }
    if (tt > 1) {
      releaseFish(f);
      if (boss.value?.fishId === f.fishId) boss.value = null;
      continue;
    }
    const [nx, ny] = pointOnPath(path, tt);
    const [nx2, ny2] = pointOnPath(path, Math.min(1, tt + 0.008));
    f.node.visible = true;
    f.node.position.set(nx * W(), ny * H());
    const dx = nx2 - nx;
    const faceLeft = dx < 0;
    f.sprite.scale.x = Math.abs(f.sprite.scale.x) * (faceLeft ? -1 : 1);
    if (!f.isBoss) f.node.rotation = (faceLeft ? -1 : 1) * Math.atan2(ny2 - ny, Math.abs(dx)) * 0.5;
    f.node.y += Math.sin(now / 260 + f.fishId) * (f.isBoss ? 6 : 2);
    if (frozenActive.value) f.sprite.tint = 0x9fd8ff;
    else f.sprite.tint = FISH_SPRITE[f.typeId]?.tint ?? 0xffffff;
    // 尾部摆动（缩放呼吸模拟）
    if (!frozenActive.value) f.node.scale.x = 1 + Math.sin(now / 140 + f.fishId) * 0.03;
  }
  // 锁定：目标离开则重新选
  if (lockActive.value) {
    if (serverNow() > lockUntil) {
      lockActive.value = false;
      lockedFishId = 0;
    } else {
      const cur = fishes.get(lockedFishId);
      if (!cur || !cur.node.visible || cur.dead) lockedFishId = pickBestTarget()?.fishId ?? 0;
      const target = fishes.get(lockedFishId);
      if (target && cannon) {
        const [cx, cy] = cannonPos();
        aimDeg = (Math.atan2(target.node.y - cy, target.node.x - cx) * 180) / Math.PI;
        cannon.rotation = aimRotation();
        reticle!.visible = true;
        reticle!.position.set(target.node.x, target.node.y);
        reticle!.rotation += 0.03;
        reticle!.scale.set(Math.max(0.6, target.size / 40));
      }
    }
  } else if (reticle) reticle.visible = false;
}

function pickBestTarget(): LiveFish | null {
  let best: LiveFish | null = null;
  let bestOdds = -1;
  for (const f of fishes.values()) {
    if (!f.node.visible || f.dead) continue;
    const odds = FISH_TYPES.find((x) => x.typeId === f.typeId)?.baseOdds ?? 0;
    if (odds > bestOdds) {
      bestOdds = odds;
      best = f;
    }
  }
  return best;
}

/** 素材炮管指向约 -55°（右上），aim 为屏幕角度 → 精灵旋转 */
const BARREL_DEG = -55;
function aimRotation(): number {
  return ((aimDeg - BARREL_DEG) * Math.PI) / 180;
}

/* ───────── 子弹 ───────── */
function fireVisual(deg: number, bulletId: string, mine: boolean): void {
  const rad = (deg * Math.PI) / 180;
  const [fromX, fromY] = cannonPos();
  const g = new Graphics();
  const main = mine ? 0xffd25a : 0x9fc4de;
  g.poly([-30, 0, -6, -5, -6, 5]).fill({ color: main, alpha: 0.3 });
  g.poly([-18, 0, -4, -3, -4, 3]).fill({ color: main, alpha: 0.55 });
  g.circle(0, 0, 7).fill(main);
  g.circle(0, 0, 7).stroke({ color: 0xfff6d5, width: 1.6 });
  g.circle(0, 0, 11).stroke({ color: main, width: 1.4, alpha: 0.45 });
  g.circle(-1.6, -1.8, 2.2).fill({ color: 0xffffff, alpha: 0.75 });
  g.rotation = rad;
  g.position.set(fromX + Math.cos(rad) * 70, fromY + Math.sin(rad) * 70);
  bulletLayer.addChild(g);
  bullets.push({ bulletId, node: g, vx: Math.cos(rad) * 11, vy: Math.sin(rad) * 11, mine });
  if (mine && cannon) {
    cannon.y += 6;
    const flash = new Graphics();
    flash.poly(starPoints(0, 0, 22, 8, 7)).fill({ color: 0xfff0c8, alpha: 0.95 });
    flash.position.set(fromX + Math.cos(rad) * 82, fromY + Math.sin(rad) * 82);
    fxLayer.addChild(flash);
    setTimeout(() => {
      if (!destroyed && cannon) {
        cannon.y -= 6;
        flash.destroy();
      }
    }, 70);
  }
}
function starPoints(cx: number, cy: number, rOut: number, rIn: number, n: number): number[] {
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
    if (b.node.x < 0 || b.node.x > W()) b.vx *= -1;
    if (b.node.y < -20 || b.node.y > H() + 20) {
      b.node.destroy();
      bullets.splice(i, 1);
      continue;
    }
    if (!b.mine) continue;
    for (const f of fishes.values()) {
      if (f.dead || !f.node.visible) continue;
      const dx = f.node.x - b.node.x;
      const dy = f.node.y - b.node.y;
      if (dx * dx + dy * dy < f.size * f.size * 0.8) {
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
  audio.sfx('hit', { volume: 0.5 });
  try {
    const r = await gameSocket.call<{ hit: boolean; dead: boolean; reward: number; balance?: number; boss?: { fishId: number; hp: number; maxHp: number; dead: boolean } }>(Ev.FsHit, { bulletId, fishId: f.fishId }, 6000);
    if (r.boss && boss.value?.fishId === r.boss.fishId) {
      boss.value = { ...boss.value, hp: r.boss.hp };
      if (!r.boss.dead) bossHitFx(f);
    }
    if (r.dead && !r.boss) killFx(f, r.reward, true);
    if (r.balance !== undefined) setBalance(r.balance);
  } catch {
    /* 服务端裁定未通过：仅视觉命中 */
  }
}

function setBalance(v: number): void {
  balance.value = v;
  user.setBalance(v);
}

function hitFlash(f: LiveFish): void {
  f.sprite.tint = 0xffffff;
  f.node.alpha = 0.6;
  setTimeout(() => {
    if (!destroyed) f.node.alpha = 1;
  }, 70);
}
function bossHitFx(f: LiveFish): void {
  const g = new Graphics();
  g.circle(0, 0, 18).fill({ color: 0xffd25a, alpha: 0.6 });
  g.position.set(f.node.x + (Math.random() - 0.5) * 60, f.node.y + (Math.random() - 0.5) * 40);
  fxLayer.addChild(g);
  const s0 = performance.now();
  const tick = (): void => {
    const p = Math.min(1, (performance.now() - s0) / 220);
    g.scale.set(1 + p * 1.4);
    g.alpha = 0.6 * (1 - p);
    if (p < 1 && !destroyed) requestAnimationFrame(tick);
    else g.destroy();
  };
  requestAnimationFrame(tick);
}

function coinFly(x: number, y: number, n: number): void {
  const coinTex = tex.iconCoinDollar;
  for (let i = 0; i < n; i += 1) {
    const coin = coinTex ? new Sprite(coinTex) : new Sprite();
    coin.anchor.set(0.5);
    coin.scale.set(coinTex ? 26 / coinTex.width : 1);
    coin.position.set(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 36);
    fxLayer.addChild(coin);
    const tx = 150;
    const ty = 34;
    const sx = coin.x;
    const sy = coin.y;
    const start = performance.now();
    const durMs = 520 + Math.random() * 260;
    const tick = (): void => {
      const p = Math.min(1, (performance.now() - start) / durMs);
      const ease = p * p * (3 - 2 * p);
      coin.x = sx + (tx - sx) * ease;
      coin.y = sy + (ty - sy) * ease - Math.sin(p * Math.PI) * 70;
      coin.scale.x = (coinTex ? 26 / coinTex.width : 1) * Math.abs(Math.cos(p * 9));
      if (p < 1 && !destroyed) requestAnimationFrame(tick);
      else coin.destroy();
    };
    requestAnimationFrame(tick);
  }
}

function killFx(f: LiveFish, rewardAmt: number, mine: boolean): void {
  if (f.dead) return;
  f.dead = true;
  const { x, y } = f.node;
  audio.sfx(f.isBoss ? 'boss' : 'kill', { volume: 0.7 });
  if (mine) {
    coinFly(x, y, Math.min(12, 3 + Math.floor(rewardAmt / 100)));
    audio.sfx('coin', { volume: 0.5 });
  }
  const burst = new Graphics();
  burst.circle(0, 0, f.size * 0.9).fill({ color: 0xfff0c8, alpha: 0.6 });
  burst.position.set(x, y);
  fxLayer.addChild(burst);
  const s0 = performance.now();
  const btick = (): void => {
    const p = Math.min(1, (performance.now() - s0) / 260);
    burst.scale.set(1 + p);
    burst.alpha = 0.6 * (1 - p);
    if (p < 1 && !destroyed) requestAnimationFrame(btick);
    else burst.destroy();
  };
  requestAnimationFrame(btick);
  // 鱼体：翻白淡出
  const s1 = performance.now();
  const dtick = (): void => {
    const p = Math.min(1, (performance.now() - s1) / 320);
    f.node.alpha = 1 - p;
    f.node.rotation += 0.08;
    if (p < 1 && !destroyed) requestAnimationFrame(dtick);
    else releaseFish(f);
  };
  requestAnimationFrame(dtick);
  if (mine && rewardAmt > 0) {
    popSeq += 1;
    const id = popSeq;
    rewardPops.value.push({ id, amount: rewardAmt });
    setTimeout(() => {
      rewardPops.value = rewardPops.value.filter((r) => r.id !== id);
    }, 1400);
  }
}

/* ───────── 开火 / 炮倍 / 自动 ───────── */
async function doFire(clientX?: number, clientY?: number): Promise<void> {
  if (firing || !app) return;
  if (!lockActive.value && clientX !== undefined && clientY !== undefined && stageEl.value) {
    const rect = stageEl.value.getBoundingClientRect();
    const [cx, cy] = cannonPos();
    aimDeg = (Math.atan2(clientY - rect.top - cy, clientX - rect.left - cx) * 180) / Math.PI;
  }
  aimDeg = Math.max(-170, Math.min(-10, aimDeg));
  if (cannon) cannon.rotation = aimRotation();
  firing = true;
  try {
    const r = await gameSocket.call<{ bulletId: string; balance: number }>(Ev.FsFire, { multiplier: multiplier.value, dirDeg: aimDeg }, 5000);
    setBalance(r.balance);
    audio.sfx('fire', { volume: 0.45, rate: 0.9 + Math.random() * 0.2 });
    fireVisual(aimDeg, r.bulletId, true);
  } catch (e) {
    const err = e as Error & { code?: number };
    if (err.code === 3000) {
      toast(t('error.INSUFFICIENT_BALANCE'), 'error');
      if (autoFire.value) toggleAuto();
    }
  } finally {
    firing = false;
  }
}
function toggleAuto(): void {
  autoFire.value = !autoFire.value;
  if (autoFire.value) autoTimer = window.setInterval(() => void doFire(), 300);
  else window.clearInterval(autoTimer);
}

/* ───────── 技能 ───────── */
async function useSkill(id: SkillId): Promise<void> {
  if (skillPending.value) return;
  if (cooldownLeft(id) > 0) {
    toast(t('fs.skillCd'), 'error');
    return;
  }
  if (id === 'LOCK' && lockActive.value) {
    lockActive.value = false;
    lockedFishId = 0;
    return;
  }
  const targetFishId = id === 'MISSILE' ? (lockActive.value ? lockedFishId : pickBestTarget()?.fishId) : undefined;
  if ((id === 'MISSILE' || id === 'LIGHTNING' || id === 'LASER' || id === 'NUKE') && !pickBestTarget()) {
    toast(t('fs.noTarget'), 'error');
    return;
  }
  skillPending.value = true;
  try {
    const r = await gameSocket.call<{
      skill: SkillId;
      cost: number;
      costType: 'item' | 'coin';
      itemQty?: number;
      targets: number[];
      kills: { fishId: number; typeId: string; reward: number }[];
      boss?: { fishId: number; hp: number; maxHp: number; dead: boolean };
      frozenUntilMs?: number;
      lockUntilMs?: number;
      cooldownUntilMs: number;
      balance: number;
    }>(Ev.FsSkill, { skill: id, targetFishId, dirDeg: aimDeg }, 8000);
    cooldowns.value = { ...cooldowns.value, [id]: r.cooldownUntilMs };
    setBalance(r.balance);
    const cfg = SKILLS.find((s) => s.skillId === id);
    if (r.costType === 'item' && cfg?.itemId) inventory.value = { ...inventory.value, [cfg.itemId]: r.itemQty ?? 0 };
    skillFx(id, r.targets, aimDeg, myUid);
    if (r.lockUntilMs) {
      lockActive.value = true;
      lockUntil = r.lockUntilMs;
      lockedFishId = pickBestTarget()?.fishId ?? 0;
    }
    // 击杀由技能回包直接结算（广播的 fishKilled 对自己会被 dead 标记去重）
    const total = r.kills.reduce((s, k) => s + k.reward, 0);
    for (const k of r.kills) {
      const f = fishes.get(k.fishId);
      if (f) killFx(f, k.reward, true);
    }
    if (total >= 2000) reward.value?.play({ amount: total, caption: t(`fs.skill.${id}`) });
    if (r.boss && boss.value?.fishId === r.boss.fishId) boss.value = { ...boss.value, hp: r.boss.hp };
  } catch (e) {
    const err = e as Error & { code?: number };
    toast(err.code === 3000 ? t('error.INSUFFICIENT_BALANCE') : err.message, 'error');
  } finally {
    skillPending.value = false;
  }
}

/** 技能表现（自己与他人共用；判定结果全部来自服务器） */
function skillFx(id: SkillId, targets: number[], deg: number, byUid: number): void {
  const [cx, cy] = cannonPos();
  const mine = byUid === myUid;
  const from: [number, number] = mine ? [cx, cy] : [cx + (byUid % 2 === 0 ? -1 : 1) * W() * 0.3, cy];
  if (id === 'LIGHTNING') {
    audio.sfx('lightning');
    for (const fid of targets) {
      const f = fishes.get(fid);
      if (!f) continue;
      const g = new Graphics();
      const segs = 7;
      g.moveTo(from[0], from[1] - 60);
      for (let i = 1; i <= segs; i += 1) {
        const p = i / segs;
        const x = from[0] + (f.node.x - from[0]) * p + (i < segs ? (Math.random() - 0.5) * 40 : 0);
        const y = from[1] - 60 + (f.node.y - from[1] + 60) * p + (i < segs ? (Math.random() - 0.5) * 30 : 0);
        g.lineTo(x, y);
      }
      g.stroke({ color: 0x9fd8ff, width: 5, alpha: 0.9 });
      g.stroke({ color: 0xffffff, width: 2, alpha: 1 });
      fxLayer.addChild(g);
      fadeOut(g, 380);
      hitFlash(f);
    }
    flashScreen(0x9fd8ff, 0.25, 200);
  } else if (id === 'MISSILE') {
    audio.sfx('missile');
    const f = fishes.get(targets[0] ?? 0);
    const tx = f ? f.node.x : from[0];
    const ty = f ? f.node.y : from[1] - 300;
    const m = new Graphics();
    m.poly([16, 0, -10, -7, -6, 0, -10, 7]).fill(0xffd25a);
    m.circle(-12, 0, 5).fill({ color: 0xff7a3a, alpha: 0.9 });
    m.position.set(from[0], from[1] - 40);
    fxLayer.addChild(m);
    const s0 = performance.now();
    const sx = m.x;
    const sy = m.y;
    const tick = (): void => {
      const p = Math.min(1, (performance.now() - s0) / 420);
      m.x = sx + (tx - sx) * p;
      m.y = sy + (ty - sy) * p - Math.sin(p * Math.PI) * 80;
      m.rotation = Math.atan2(ty - sy - Math.cos(p * Math.PI) * 80, tx - sx);
      if (p < 1 && !destroyed) requestAnimationFrame(tick);
      else {
        m.destroy();
        explosion(tx, ty, 70);
        if (f) hitFlash(f);
      }
    };
    requestAnimationFrame(tick);
  } else if (id === 'LASER') {
    audio.sfx('laser');
    const rad = (deg * Math.PI) / 180;
    const len = Math.hypot(W(), H());
    const g = new Graphics();
    g.moveTo(from[0], from[1] - 50).lineTo(from[0] + Math.cos(rad) * len, from[1] - 50 + Math.sin(rad) * len);
    g.stroke({ color: 0x7cf36a, width: 26, alpha: 0.35 });
    g.stroke({ color: 0xbfffb0, width: 10, alpha: 0.8 });
    g.stroke({ color: 0xffffff, width: 3, alpha: 1 });
    fxLayer.addChild(g);
    fadeOut(g, 520);
    for (const fid of targets) {
      const f = fishes.get(fid);
      if (f) hitFlash(f);
    }
  } else if (id === 'NUKE') {
    audio.sfx('nuke');
    flashScreen(0xffffff, 0.85, 600);
    shake = 18;
    for (const fid of targets) {
      const f = fishes.get(fid);
      if (f) explosion(f.node.x, f.node.y, 40);
    }
  } else if (id === 'FREEZE') {
    audio.sfx('freeze');
    flashScreen(0x9fd8ff, 0.5, 700);
  } else if (id === 'LOCK') {
    audio.sfx('lock');
  }
}
function explosion(x: number, y: number, r: number): void {
  const g = new Graphics();
  g.circle(0, 0, r).fill({ color: 0xffb15c, alpha: 0.85 });
  g.circle(0, 0, r * 0.6).fill({ color: 0xfff0c8, alpha: 0.95 });
  g.position.set(x, y);
  fxLayer.addChild(g);
  const s0 = performance.now();
  const tick = (): void => {
    const p = Math.min(1, (performance.now() - s0) / 360);
    g.scale.set(0.4 + p * 1.6);
    g.alpha = 1 - p;
    if (p < 1 && !destroyed) requestAnimationFrame(tick);
    else g.destroy();
  };
  requestAnimationFrame(tick);
}
function fadeOut(g: Graphics, ms: number): void {
  const s0 = performance.now();
  const tick = (): void => {
    const p = Math.min(1, (performance.now() - s0) / ms);
    g.alpha = 1 - p;
    if (p < 1 && !destroyed) requestAnimationFrame(tick);
    else g.destroy();
  };
  requestAnimationFrame(tick);
}
function flashScreen(color: number, alpha: number, ms: number): void {
  const g = new Graphics();
  g.rect(0, 0, W(), H()).fill({ color, alpha });
  fxLayer.addChild(g);
  fadeOut(g, ms);
}

async function exit(): Promise<void> {
  if (autoFire.value) toggleAuto();
  await gameSocket.call('fishing.leave').catch(() => undefined);
  void router.replace('/lobby');
}

async function loadInventory(): Promise<void> {
  try {
    const d = await api<{ items: { itemId: string; qty: number }[] }>('/api/v1/inventory');
    inventory.value = Object.fromEntries(d.items.map((i) => [i.itemId, i.qty]));
  } catch {
    /* noop */
  }
}

/* ───────── 生命周期 ───────── */
onMounted(async () => {
  if (gameSocket.status !== 'open') await gameSocket.connect();
  myUid = user.me?.uid ?? 0;
  audio.setScene('fishing');
  audio.preload(['fire', 'hit', 'kill', 'coin', 'boss', 'lightning', 'missile', 'laser', 'nuke', 'freeze', 'lock']);
  void loadInventory();
  tickTimer = window.setInterval(() => (nowTick.value = Date.now()), 250);

  app = new Application();
  // autoDensity：高 DPR 下把画布 CSS 尺寸压回逻辑像素，否则 2x 屏只显示左上四分之一
  await app.init({ resizeTo: stageEl.value!, background: 0x06121e, antialias: true, resolution: Math.min(2, window.devicePixelRatio), autoDensity: true });
  stageEl.value!.appendChild(app.canvas);
  tex = await pixiTextures('fishing');
  Object.assign(tex, await pixiTextures('common', ['iconCoinDollar']));

  world = new Container();
  app.stage.addChild(world);

  // 背景：水体渐变 + 焦散 + 微粒 + 暗角 + 海床
  const bg = new Graphics();
  const seabed = new Graphics();
  const drawBg = (): void => {
    const w = W();
    const h = H();
    bg.clear();
    const water = new FillGradient(0, 0, 0, 1);
    water.addColorStop(0, 0x1b6a8e);
    water.addColorStop(0.18, 0x145575);
    water.addColorStop(0.45, 0x0c3550);
    water.addColorStop(0.75, 0x072033);
    water.addColorStop(1, 0x03101a);
    bg.rect(0, 0, w, h).fill(water);
    bg.rect(0, 0, w, h * 0.05).fill({ color: 0xbfe8f2, alpha: 0.1 });
    for (let r = 0; r < 5; r += 1) {
      const y0 = h * (0.035 + r * 0.038);
      const amp = 5 - r * 0.7;
      const step = w / 26;
      bg.moveTo(-step, y0);
      for (let i = 0; i <= 27; i += 1) bg.quadraticCurveTo((i - 0.5) * step, y0 + (i % 2 === 0 ? -amp : amp), i * step, y0);
      bg.stroke({ color: 0xbfe8f2, width: 1.6 - r * 0.2, alpha: 0.13 - r * 0.02 });
    }
    for (let i = 0; i < 46; i += 1) {
      const px = ((i * 197) % 1000) / 1000;
      const py = ((i * 421) % 1000) / 1000;
      bg.circle(px * w, py * h, 0.7 + ((i * 13) % 5) * 0.34).fill({ color: 0xbfe8f2, alpha: 0.05 + ((i * 7) % 10) / 160 });
    }
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
      bg.rect(rx, ry, rw, rh).fill(gr);
    }
    seabed.clear();
    seabed.poly([0, h, 0, h - 46, w * 0.18, h - 72, w * 0.4, h - 40, w * 0.62, h - 66, w * 0.85, h - 36, w, h - 58, w, h]).fill({ color: 0x0a1a2a, alpha: 0.9 });
    seabed.poly([0, h, 0, h - 26, w * 0.12, h - 44, w * 0.22, h - 20, w * 0.3, h - 34, w * 0.4, h - 14, 0, h]).fill(0x061119);
    seabed.poly([w, h, w, h - 30, w * 0.88, h - 52, w * 0.78, h - 22, w * 0.68, h - 36, w * 0.58, h - 12, w, h]).fill(0x061119);
    for (const kx of [w * 0.07, w * 0.33, w * 0.7, w * 0.93]) {
      seabed.moveTo(kx, h).quadraticCurveTo(kx - 8, h - 26, kx + 4, h - 48).stroke({ color: 0x14382e, width: 4, cap: 'round' });
      seabed.moveTo(kx + 8, h).quadraticCurveTo(kx + 16, h - 20, kx + 8, h - 36).stroke({ color: 0x14382e, width: 3, cap: 'round' });
    }
  };
  drawBg();
  world.addChild(bg);
  const rays = new Container();
  for (let i = 0; i < 4; i += 1) {
    const ray = new Graphics();
    ray.moveTo(0, 0).lineTo(80, 0).lineTo(220, H()).lineTo(-60, H()).closePath().fill({ color: 0x9fd4e8, alpha: 0.05 });
    ray.x = (i + 0.5) * (W() / 4);
    ray.rotation = -0.12;
    rays.addChild(ray);
  }
  world.addChild(rays, seabed);
  fishLayer = new Container();
  bulletLayer = new Container();
  fxLayer = new Container();
  world.addChild(fishLayer, bulletLayer, fxLayer);

  // 炮台（素材精灵，随炮倍档位切换）
  cannonGlow = new Graphics();
  cannonGlow.ellipse(0, 0, 70, 22).fill({ color: 0x000000, alpha: 0.45 });
  world.addChild(cannonGlow);
  cannon = new Sprite(tex.cannonLv01 ?? undefined);
  cannon.anchor.set(0.5, 0.78);
  world.addChild(cannon);
  const applyCannon = (): void => {
    if (!cannon) return;
    const idx = multipliers.value.indexOf(multiplier.value);
    const key = idx >= 3 ? 'cannonLv03' : idx === 2 ? 'cannonLv02' : 'cannonLv01';
    const tx = tex[key];
    if (tx && cannon.texture !== tx) cannon.texture = tx;
    const targetH = Math.max(110, Math.min(170, H() * 0.24));
    cannon.scale.set(targetH / cannon.texture.height);
  };
  applyCannon();
  reticle = new Graphics();
  reticle.circle(0, 0, 34).stroke({ color: 0xffd25a, width: 2.5, alpha: 0.9 });
  for (let i = 0; i < 4; i += 1) {
    const a = (Math.PI / 2) * i;
    reticle.moveTo(Math.cos(a) * 26, Math.sin(a) * 26).lineTo(Math.cos(a) * 44, Math.sin(a) * 44).stroke({ color: 0xffd25a, width: 3 });
  }
  reticle.visible = false;
  fxLayer.addChild(reticle);

  const bubbles: { g: Graphics; v: number }[] = [];
  for (let i = 0; i < 14; i += 1) {
    const b = new Graphics();
    b.circle(0, 0, 2 + Math.random() * 3).stroke({ color: 0xbfe4f2, width: 1, alpha: 0.35 });
    b.position.set(Math.random() * W(), Math.random() * H());
    world.addChild(b);
    bubbles.push({ g: b, v: 0.3 + Math.random() * 0.5 });
  }

  let lastW = W();
  let lastH = H();
  app.ticker.add(() => {
    if (W() !== lastW || H() !== lastH) {
      lastW = W();
      lastH = H();
      drawBg();
      applyCannon();
    }
    updateFish();
    updateBullets();
    for (const b of bubbles) {
      b.g.y -= b.v;
      if (b.g.y < -6) {
        b.g.y = H() + 6;
        b.g.x = Math.random() * W();
      }
    }
    const [cx, cy] = cannonPos();
    cannon!.position.set(cx, cy);
    cannonGlow!.position.set(cx, cy + 8);
    if (shake > 0) {
      world.position.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake = Math.max(0, shake - 1);
    } else world.position.set(0, 0);
  });
  offs.push(() => app?.ticker.stop());

  // 炮倍切换 → 换炮
  const stopWatch = (() => {
    let last = multiplier.value;
    const id = window.setInterval(() => {
      if (multiplier.value !== last) {
        last = multiplier.value;
        applyCannon();
        audio.sfx('tick');
      }
    }, 120);
    return () => clearInterval(id);
  })();
  offs.push(stopWatch);

  app.canvas.addEventListener('pointerdown', (e) => void doFire(e.clientX, e.clientY));
  app.canvas.addEventListener('pointermove', (e) => {
    if (!stageEl.value || lockActive.value) return;
    const rect = stageEl.value.getBoundingClientRect();
    const [cx, cy] = cannonPos();
    aimDeg = Math.max(-170, Math.min(-10, (Math.atan2(e.clientY - rect.top - cy, e.clientX - rect.left - cx) * 180) / Math.PI));
    if (cannon) cannon.rotation = aimRotation();
  });

  /* ───── WS 事件 ───── */
  const applyState = (d: any): void => {
    serverOffset = d.serverNow - Date.now();
    if (d.balance !== undefined) setBalance(d.balance);
    multipliers.value = d.stage.multipliers;
    if (!multipliers.value.includes(multiplier.value)) multiplier.value = multipliers.value[0]!;
    bulletBaseCost.value = d.stage.bulletBaseCost;
    mySeat = typeof d.mySeat === 'number' ? d.mySeat : mySeat;
    const me = (d.players ?? []).find((p: any) => p.seat === mySeat);
    if (me) myUid = me.uid;
    others.value = (d.players ?? []).filter((p: any) => p.seat !== mySeat);
    if (import.meta.env.DEV) (window as any).__fs = { app, tex, fishes, W, H };
    freezes.splice(0, freezes.length, ...((d.freezes ?? []) as FreezeWindow[]));
    cooldowns.value = d.cooldowns ?? {};
    spawnFish(d.fish ?? []);
    const b = (d.bosses ?? [])[0];
    if (b) {
      const f = fishes.get(b.fishId);
      boss.value = { fishId: b.fishId, hp: b.hp, maxHp: b.maxHp, typeId: f?.typeId ?? 'dragonKing' };
    }
    applyCannon();
  };
  offs.push(
    gameSocket.on(Ev.FsState, (m) => applyState(m.data)),
    gameSocket.on(Ev.SysHello, (m) => {
      const d = m.data as any;
      if (d?.resume && d.snapshot?.kind === 'fishing') applyState(d.snapshot);
    }),
    gameSocket.on(Ev.FsWave, (m) => {
      const d = m.data as any;
      serverOffset = d.serverNow - Date.now();
      spawnFish(d.fish ?? []);
      const b = (d.bosses ?? [])[0];
      if (b) {
        const f = d.fish.find((x: any) => x.fishId === b.fishId);
        boss.value = { fishId: b.fishId, hp: b.maxHp, maxHp: b.maxHp, typeId: f?.typeId ?? 'dragonKing' };
      }
    }),
    gameSocket.on(Ev.FsBossWarning, () => {
      bossWarning.value = true;
      audio.sfx('boss');
      setTimeout(() => (bossWarning.value = false), 3200);
    }),
    gameSocket.on(Ev.FsFishKilled, (m) => {
      const d = m.data as any;
      const f = fishes.get(d.fishId);
      if (f && !f.dead) killFx(f, d.reward, d.byUid === myUid);
    }),
    gameSocket.on(Ev.FsPlayerFire, (m) => {
      const d = m.data as any;
      fireVisual(d.dirDeg, d.bulletId, false);
    }),
    gameSocket.on(Ev.FsBossHp, (m) => {
      const d = m.data as any;
      const cur = boss.value;
      if (cur && cur.fishId === d.fishId) boss.value = { ...cur, hp: Number(d.hp) };
      const f = fishes.get(d.fishId);
      if (f) bossHitFx(f);
    }),
    gameSocket.on(Ev.FsBossDead, (m) => {
      const d = m.data as any;
      const f = fishes.get(d.fishId);
      if (f) {
        explosion(f.node.x, f.node.y, 120);
        shake = 14;
        killFx(f, 0, false);
      }
      if (boss.value?.fishId === d.fishId) boss.value = null;
    }),
    gameSocket.on(Ev.FsBossReward, (m) => {
      const d = m.data as any;
      setBalance(d.balance);
      reward.value?.play({ amount: d.amount, caption: t('fs.bossReward') });
    }),
    gameSocket.on(Ev.FsFrozen, (m) => {
      const d = m.data as any;
      freezes.push({ startMs: d.startMs, endMs: d.untilMs });
      if (freezes.length > 8) freezes.shift();
      for (const f of fishes.values()) void f;
      if (d.byUid !== myUid) audio.sfx('freeze');
    }),
    gameSocket.on(Ev.FsSkillUsed, (m) => {
      const d = m.data as any;
      skillFx(d.skill, d.targets ?? [], d.dirDeg ?? -90, d.uid);
    }),
    gameSocket.on(Ev.FsPlayerJoined, (m) => {
      const d = m.data as any;
      if (d.uid !== myUid && !others.value.some((p) => p.uid === d.uid)) others.value = [...others.value, { uid: d.uid, nickname: d.nickname, avatarId: d.avatarId, multiplier: 1 }];
    }),
    gameSocket.on(Ev.FsPlayerLeft, (m) => {
      const d = m.data as any;
      others.value = others.value.filter((p) => p.uid !== d.uid);
    }),
  );
  try {
    await gameSocket.call(Ev.FsEnter, { stageId: String(route.query.stageId ?? 'fishing_novice') }, 8000);
  } catch (e) {
    toast((e as Error).message, 'error');
    void router.replace('/lobby');
  }
});

onBeforeUnmount(() => {
  destroyed = true;
  window.clearInterval(autoTimer);
  window.clearInterval(tickTimer);
  offs.forEach((off) => off());
  app?.destroy(true, { children: true });
  app = null;
  void release('fishing');
  audio.setScene('none');
});
</script>

<style scoped>
.fs-root {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: #06121e;
  user-select: none;
}
.stage {
  position: absolute;
  inset: 0;
}
.fs-root.frozen::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 50%, rgba(159, 216, 255, 0.05), rgba(120, 190, 255, 0.22));
  box-shadow: inset 0 0 120px rgba(159, 216, 255, 0.55);
}
/* ══ 顶栏 ══ */
.hud-top {
  position: absolute;
  z-index: 3;
  top: calc(var(--safe-top) + 10px);
  left: max(var(--safe-left), 12px);
  right: max(var(--safe-right), 12px);
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: none;
}
.hud-top > * {
  pointer-events: auto;
}
.hcoins {
  --h: 36px;
}
.players {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 4px;
  border-radius: 999px;
  background: rgba(4, 12, 30, 0.7);
  box-shadow: inset 0 0 0 1.5px rgba(248, 199, 74, 0.5);
  font-size: 12px;
  color: #dfe4ec;
}
.pl-mult {
  color: #ffe28a;
  font-weight: 800;
}
.boss-bar {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(440px, 46vw);
  padding: 4px 14px 4px 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(60, 8, 12, 0.85), rgba(20, 4, 8, 0.85));
  box-shadow:
    inset 0 0 0 2px #7d4d0c,
    inset 0 0 0 3.5px #f0c14e,
    0 8px 18px rgba(0, 0, 0, 0.5);
  animation: rise-in 360ms var(--ease-out) both;
}
.bb-portrait {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  flex-shrink: 0;
}
.bb-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.bb-name {
  font-size: 13px;
  font-weight: 900;
  color: #ffe28a;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.bb-hp {
  --h: 18px;
}
.boss-banner {
  position: absolute;
  z-index: 4;
  left: 50%;
  top: 30%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 26px 10px 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(200, 22, 26, 0.9), rgba(122, 10, 16, 0.9));
  box-shadow:
    inset 0 0 0 2px #7d4d0c,
    inset 0 0 0 4px #ffd867,
    0 0 40px rgba(255, 90, 60, 0.6);
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 0.2em;
  animation: banner-pulse 700ms ease-in-out infinite alternate;
}
.boss-banner img {
  width: 64px;
  height: 64px;
  border-radius: 50%;
}
@keyframes banner-pulse {
  from {
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    transform: translate(-50%, -50%) scale(1.06);
  }
}
.frozen-tag {
  position: absolute;
  z-index: 4;
  left: 50%;
  top: 18%;
  transform: translateX(-50%);
  font-size: 20px;
  letter-spacing: 0.3em;
  color: #cfeaff;
}
/* ══ 底栏 ══ */
.hud-bottom {
  position: absolute;
  z-index: 3;
  left: max(var(--safe-left), 12px);
  right: max(var(--safe-right), 12px);
  bottom: calc(var(--safe-bottom) + 10px);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;
}
.hud-bottom > * {
  pointer-events: auto;
}
.skills {
  display: flex;
  gap: 8px;
}
.skill {
  --d: 62px;
  position: relative;
  width: var(--d);
  height: var(--d);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  transition: transform 120ms var(--ease-out);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.55));
}
.skill:hover:not(:disabled) {
  transform: translateY(-3px);
}
.skill:active:not(:disabled) {
  transform: scale(0.92);
}
.skill.active {
  filter: drop-shadow(0 0 12px rgba(255, 226, 138, 0.95));
}
.sk-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
}
.skill.cd .sk-icon {
  filter: grayscale(0.7) brightness(0.55);
}
.sk-cd {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 22px;
  text-shadow: var(--sk-outline);
}
.sk-cost {
  position: absolute;
  left: 50%;
  bottom: -10px;
  transform: translateX(-50%);
  padding: 1px 8px;
  border-radius: 8px;
  background: linear-gradient(180deg, #ffe38b, #f0a730);
  box-shadow: inset 0 0 0 1px #8f5a12;
  color: #2a1500;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}
.sk-cost.item {
  background: linear-gradient(180deg, #9cf27a, #22a83a);
  color: #0a2a10;
}
.controls {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mult {
  --h: 44px;
}
.cost {
  font-size: 12px;
  color: #ffe9a6;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
}
.auto {
  --h: 64px;
}
.auto.on {
  filter: drop-shadow(0 0 14px rgba(255, 200, 80, 0.95));
  animation: auto-pulse 1s ease-in-out infinite alternate;
}
@keyframes auto-pulse {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.05);
  }
}
/* 奖励飘字 */
.reward-pops {
  position: absolute;
  z-index: 4;
  right: max(var(--safe-right), 20px);
  top: calc(var(--safe-top) + 60px);
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}
.rpop {
  font-size: 24px;
}
.toast-enter-active,
.toast-leave-active {
  transition: all 400ms var(--ease-out);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.8);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-24px);
}
.pop-enter-active,
.pop-leave-active {
  transition: all 260ms var(--ease-out);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.7);
}
/* ══ 响应式 ══ */
@media (max-width: 720px), (max-height: 520px) {
  .skill {
    --d: 46px;
  }
  .sk-cd {
    font-size: 16px;
  }
  .auto {
    --h: 50px;
  }
  .mult {
    --h: 36px;
  }
  .players {
    display: none;
  }
  .boss-bar {
    width: min(320px, 52vw);
  }
  .bb-portrait {
    width: 40px;
    height: 40px;
  }
  .boss-banner {
    font-size: 18px;
  }
}
</style>
