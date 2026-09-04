<template>
  <div class="rl-root">
    <!-- ══ 顶栏：退出 / 标题 / 阶段倒计时 / 金币 ══ -->
    <div class="hud-top">
      <GameButton round size="md" :art="exitArt" class="hback" sfx="close" @click="exit" />
      <div class="title">
        <span class="title-text sk-gold-text">{{ t('game.roulette') }}</span>
      </div>
      <div class="phase sk-panel" :class="round?.phase">
        <span class="phase-label">{{ phaseLabel }}</span>
        <Countdown v-if="round" :key="`${round.roundId}-${round.phase}`" :deadline-at="phaseDeadline" :total-ms="phaseTotal" :server-offset="serverOffset" size="sm" />
      </div>
      <CurrencyBar kind="coin" :value="balance" class="hcoins" />
    </div>

    <div class="body">
      <!-- ══ 左：转盘（程序绘制顶视图，停在服务端号码）+ 结果 + 历史 ══ -->
      <div class="left">
        <div class="wheel-wrap">
          <canvas ref="wheelEl" class="wheel" />
          <transition name="pop">
            <div v-if="lastResult !== null && round?.phase !== 'spinning'" class="result-badge" :class="colorOf(lastResult)">
              <span class="num">{{ lastResult }}</span>
            </div>
          </transition>
        </div>
        <div class="history sk-panel">
          <span class="h-label">{{ t('rl.history') }}</span>
          <span v-for="(h, i) in history.slice(0, 14)" :key="`${i}-${h}`" class="hist num" :class="colorOf(h)">{{ h }}</span>
        </div>
        <div class="players">{{ t('rl.players', { n: players }) }}</div>
      </div>

      <!-- ══ 右：投注台（程序绘制布局，落子为素材筹码）+ 筹码栏 + 控制台 ══ -->
      <div class="right">
        <div class="table" :class="{ locked: !canBet }">
          <button class="cell zero" type="button" @click="place('straight', '0')">
            <span class="cell-n num">0</span>
            <Stake :stake="stakeAt('straight:0')" :chip-art="chipArtFor" />
          </button>
          <div class="grid">
            <!-- 显式指定行列：1 在左下、3 在左上，与真实轮盘台一致（auto-flow 会产生阶梯错位） -->
            <button v-for="n in 36" :key="n" class="cell" :class="colorOf(n)" :style="{ gridColumn: Math.ceil(n / 3), gridRow: 3 - ((n - 1) % 3) }" type="button" @click="place('straight', String(n))">
              <span class="cell-n num">{{ n }}</span>
              <Stake :stake="stakeAt(`straight:${n}`)" :chip-art="chipArtFor" />
            </button>
          </div>
          <div class="cols">
            <button v-for="c in 3" :key="c" class="cell side" type="button" @click="place('column', String(4 - c))">
              <span class="cell-t">2:1</span>
              <Stake :stake="stakeAt(`column:${4 - c}`)" :chip-art="chipArtFor" />
            </button>
          </div>
          <div class="dozens">
            <button v-for="d in 3" :key="d" class="cell side" type="button" @click="place('dozen', String(d))">
              <span class="cell-t">{{ t(`rl.dozen${d}`) }}</span>
              <Stake :stake="stakeAt(`dozen:${d}`)" :chip-art="chipArtFor" />
            </button>
          </div>
          <div class="outside">
            <button class="cell side" type="button" @click="place('low', '')"><span class="cell-t">1-18</span><Stake :stake="stakeAt('low:')" :chip-art="chipArtFor" /></button>
            <button class="cell side" type="button" @click="place('even', '')"><span class="cell-t">{{ t('rl.even') }}</span><Stake :stake="stakeAt('even:')" :chip-art="chipArtFor" /></button>
            <button class="cell side red" type="button" @click="place('red', '')"><span class="cell-t diamond red" /><Stake :stake="stakeAt('red:')" :chip-art="chipArtFor" /></button>
            <button class="cell side black" type="button" @click="place('black', '')"><span class="cell-t diamond black" /><Stake :stake="stakeAt('black:')" :chip-art="chipArtFor" /></button>
            <button class="cell side" type="button" @click="place('odd', '')"><span class="cell-t">{{ t('rl.odd') }}</span><Stake :stake="stakeAt('odd:')" :chip-art="chipArtFor" /></button>
            <button class="cell side" type="button" @click="place('high', '')"><span class="cell-t">19-36</span><Stake :stake="stakeAt('high:')" :chip-art="chipArtFor" /></button>
          </div>
        </div>

        <div class="chips">
          <BetChip v-for="v in config.chips" :key="v" :value="v" :selected="chip === v" size="sm" :disabled="v > balance" @select="chip = v" />
        </div>

        <div class="console">
          <div class="stakes sk-panel">
            <div class="st-row"><span class="st-l">{{ t('rl.placed') }}</span><span class="st-v num placed">{{ fmt(confirmedTotal) }}</span></div>
            <div class="st-row"><span class="st-l">{{ t('rl.staged') }}</span><span class="st-v num staged">{{ fmt(stagedTotal) }}</span></div>
          </div>
          <div class="ctl">
            <GameButton :art="undoArt" round size="md" :disabled="actions.length === 0 || !canBet" sfx="tick" @click="undo" />
            <span class="cap">{{ t('rl.undo') }}</span>
          </div>
          <div class="ctl">
            <GameButton :art="closeArt" size="md" :disabled="stagedTotal === 0 || !canBet" sfx="close" @click="clearStaged" />
            <span class="cap">{{ t('rl.clear') }}</span>
          </div>
          <div class="ctl">
            <GameButton :art="repeatArt" size="md" :disabled="lastRoundBets.length === 0 || !canBet" sfx="chip" @click="repeatLast" />
            <span class="cap">{{ t('rl.repeat') }}</span>
          </div>
          <div class="ctl">
            <GameButton :art="autoArt" size="md" :class="{ on: auto }" sfx="toggle" @click="toggleAuto" />
            <span class="cap">{{ t('rl.auto') }}</span>
          </div>
          <div class="ctl confirm-wrap">
            <button class="confirm" :class="{ pulse: stagedTotal > 0 && canBet }" :disabled="stagedTotal === 0 || !canBet || confirming" type="button" @click="confirm">
              <img :src="spinArt" alt="" draggable="false" />
              <span v-if="confirming" class="spin-ring" />
            </button>
            <span class="cap gold">{{ t('rl.confirm') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ 本局结果面板（派彩阶段） ══ -->
    <transition name="pop">
      <div v-if="resultPanel" class="result-panel sk-panel">
        <img class="rp-mascot" :src="resultPanel.myPayout > 0 ? mascotWinArt : mascotArt" alt="" draggable="false" />
        <div class="rp-main">
          <div class="rp-title">{{ t('rl.result') }}</div>
          <div class="rp-num num" :class="colorOf(resultPanel.result)">{{ resultPanel.result }}</div>
          <div class="rp-rows">
            <span>{{ t('rl.myBet') }}</span><span class="num">{{ fmt(resultPanel.myBet) }}</span>
            <span>{{ t('rl.payout') }}</span><span class="num" :class="resultPanel.myPayout > 0 ? 'win' : ''">{{ fmt(resultPanel.myPayout) }}</span>
          </div>
          <div class="rp-verdict" :class="resultPanel.myPayout > 0 ? 'win' : ''">
            {{ resultPanel.myBet === 0 ? t('rl.nextRound') + '…' : resultPanel.myPayout > 0 ? t('rl.win') : t('rl.lose') }}
          </div>
        </div>
      </div>
    </transition>
    <RewardAnimation ref="reward" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Ev } from '@yanbian/protocol';
import { gameSocket } from '../../net/ws.js';
import { useUserStore } from '../../stores/user.js';
import { t } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import { fmt } from '../../ui/format.js';
import { asset } from '../../assets/assets.js';
import { audio } from '../../audio/AudioManager.js';
import GameButton from '../../ui/GameButton.vue';
import CurrencyBar from '../../ui/CurrencyBar.vue';
import Countdown from '../../ui/Countdown.vue';
import BetChip from '../../ui/BetChip.vue';
import RewardAnimation from '../../ui/RewardAnimation.vue';

/**
 * 幸运轮盘（欧式单零）。客户端只负责：暂存筹码 → 一次性提交投注清单 → 播转盘动画到服务端号码 → 展示派彩。
 * 开奖号码、赔付、余额全部来自服务端（roulette.spin / roulette.result）。
 */

type BetType = 'straight' | 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' | 'dozen' | 'column';
interface Bet {
  type: BetType;
  selection: string;
  amount: number;
}
interface RoundInfo {
  roundId: number;
  phase: 'betting' | 'spinning' | 'result';
  lockAt: number;
  resultAt: number;
  nextAt: number;
  result: number | null;
}
interface Config {
  chips: number[];
  minBet: number;
  maxBetPerSpot: number;
  maxBetPerRound: number;
  betWindowMs: number;
  spinMs: number;
  resultMs: number;
  payouts: Record<BetType, number>;
  wheelOrder: number[];
  redNumbers: number[];
}
interface StakeInfo {
  confirmed: number;
  staged: number;
}

const router = useRouter();
const user = useUserStore();

const exitArt = asset('common', 'btnExitRound');
const spinArt = asset('roulette', 'btnSpin');
const repeatArt = asset('roulette', 'btnRepeat');
const closeArt = asset('roulette', 'btnClose');
const autoArt = asset('roulette', 'btnAuto');
const undoArt = asset('common', 'btnArrowLeft');
const mascotArt = asset('roulette', 'caishenRound');
const mascotWinArt = asset('roulette', 'caishenIngotSplash');
const CHIP_ART: [number, string][] = [
  [1000000, asset('roulette', 'rouletteChip1m')],
  [500000, asset('roulette', 'rouletteChip500k')],
  [100000, asset('roulette', 'rouletteChip100k')],
  [50000, asset('roulette', 'rouletteChip50k')],
  [10000, asset('roulette', 'rouletteChip10k')],
  [5000, asset('roulette', 'rouletteChip5k')],
  [1000, asset('roulette', 'rouletteChip1k')],
  [500, asset('roulette', 'rouletteChip500')],
  [100, asset('roulette', 'rouletteChip100')],
  [50, asset('roulette', 'rouletteChip50')],
  [10, asset('roulette', 'rouletteChip10')],
];
/** 落桌筹码：按金额选最接近的素材面额（金额数字由程序绘制） */
function chipArtFor(amount: number): string {
  for (const [v, src] of CHIP_ART) if (amount >= v) return src;
  return CHIP_ART[CHIP_ART.length - 1]![1];
}
function shortAmt(v: number): string {
  if (v >= 1000000) return `${+(v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 1)}M`;
  if (v >= 1000) return `${+(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`;
  return String(v);
}

/** 格子上的筹码堆：已确认（实心）+ 待确认（虚线描边） */
const Stake = defineComponent({
  props: { stake: { type: Object as () => StakeInfo | null, default: null }, chipArt: { type: Function as unknown as () => (n: number) => string, required: true } },
  setup(props) {
    return () => {
      const s = props.stake;
      if (!s || (s.confirmed === 0 && s.staged === 0)) return null;
      const total = s.confirmed + s.staged;
      return h('span', { class: ['stake', { staged: s.staged > 0 }] }, [
        h('img', { src: props.chipArt(total), alt: '', draggable: false }),
        h('span', { class: 'stake-v num' }, shortAmt(total)),
      ]);
    };
  },
});

const config = ref<Config>({
  chips: [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  minBet: 10,
  maxBetPerSpot: 1000000,
  maxBetPerRound: 5000000,
  betWindowMs: 30000,
  spinMs: 9000,
  resultMs: 6000,
  payouts: { straight: 35, red: 1, black: 1, odd: 1, even: 1, low: 1, high: 1, dozen: 2, column: 2 },
  wheelOrder: [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26],
  redNumbers: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
});
const round = ref<RoundInfo | null>(null);
const serverOffset = ref(0);
const balance = ref(0);
const players = ref(0);
const history = ref<number[]>([]);
const lastResult = ref<number | null>(null);
const chip = ref(100);
const stakes = ref(new Map<string, StakeInfo>());
const actions = ref<{ key: string; amount: number }[]>([]);
const lastRoundBets = ref<Bet[]>([]);
const auto = ref(false);
const confirming = ref(false);
const resultPanel = ref<{ result: number; myBet: number; myPayout: number } | null>(null);
const reward = ref<InstanceType<typeof RewardAnimation> | null>(null);
const wheelEl = ref<HTMLCanvasElement | null>(null);
const offs: (() => void)[] = [];
let resultTimer: ReturnType<typeof setTimeout> | null = null;

const redSet = computed(() => new Set(config.value.redNumbers));
const colorOf = (n: number): 'green' | 'red' | 'black' => (n === 0 ? 'green' : redSet.value.has(n) ? 'red' : 'black');
const canBet = computed(() => !!round.value && round.value.phase === 'betting' && round.value.lockAt - (Date.now() + serverOffset.value) > 600);
const phaseLabel = computed(() => {
  const p = round.value?.phase;
  return p === 'betting' ? t('rl.betting') : p === 'spinning' ? t('rl.spinning') : p === 'result' ? t('rl.result') : '';
});
const phaseDeadline = computed(() => {
  const r = round.value;
  if (!r) return 0;
  return r.phase === 'betting' ? r.lockAt : r.phase === 'spinning' ? r.resultAt : r.nextAt;
});
const phaseTotal = computed(() => {
  const p = round.value?.phase;
  return p === 'betting' ? config.value.betWindowMs : p === 'spinning' ? config.value.spinMs : config.value.resultMs;
});
const stakeAt = (key: string): StakeInfo | null => stakes.value.get(key) ?? null;
const confirmedTotal = computed(() => [...stakes.value.values()].reduce((s, x) => s + x.confirmed, 0));
const stagedTotal = computed(() => [...stakes.value.values()].reduce((s, x) => s + x.staged, 0));

function touch(): void {
  stakes.value = new Map(stakes.value);
}

// ───────────────────────── 投注操作（本地暂存，确认后一次提交） ─────────────────────────
function place(type: BetType, selection: string): void {
  if (!canBet.value) {
    toast(t('rl.locked'), 'error');
    return;
  }
  const key = `${type}:${selection}`;
  const cur = stakes.value.get(key) ?? { confirmed: 0, staged: 0 };
  const amount = chip.value;
  if (cur.confirmed + cur.staged + amount > config.value.maxBetPerSpot) {
    toast(t('rl.overSpot'), 'error');
    return;
  }
  if (confirmedTotal.value + stagedTotal.value + amount > config.value.maxBetPerRound) {
    toast(t('rl.overRound'), 'error');
    return;
  }
  if (stagedTotal.value + amount > balance.value) {
    toast(t('error.INSUFFICIENT_BALANCE'), 'error');
    return;
  }
  cur.staged += amount;
  stakes.value.set(key, cur);
  actions.value.push({ key, amount });
  touch();
  audio.sfx('chip', { rate: 0.95 + Math.random() * 0.1 });
}
function undo(): void {
  const a = actions.value.pop();
  if (!a) return;
  const cur = stakes.value.get(a.key);
  if (cur) {
    cur.staged = Math.max(0, cur.staged - a.amount);
    if (cur.staged === 0 && cur.confirmed === 0) stakes.value.delete(a.key);
  }
  touch();
}
function clearStaged(): void {
  for (const [k, v] of stakes.value) {
    v.staged = 0;
    if (v.confirmed === 0) stakes.value.delete(k);
  }
  actions.value = [];
  touch();
}
function stageBets(bets: Bet[]): boolean {
  let total = 0;
  for (const b of bets) total += b.amount;
  if (total + stagedTotal.value > balance.value) {
    toast(t('error.INSUFFICIENT_BALANCE'), 'error');
    return false;
  }
  if (total + stagedTotal.value + confirmedTotal.value > config.value.maxBetPerRound) {
    toast(t('rl.overRound'), 'error');
    return false;
  }
  for (const b of bets) {
    const key = `${b.type}:${b.selection}`;
    const cur = stakes.value.get(key) ?? { confirmed: 0, staged: 0 };
    cur.staged += b.amount;
    stakes.value.set(key, cur);
    actions.value.push({ key, amount: b.amount });
  }
  touch();
  return true;
}
function repeatLast(): void {
  if (!canBet.value || lastRoundBets.value.length === 0) return;
  if (stageBets(lastRoundBets.value)) audio.sfx('chips');
}
function toggleAuto(): void {
  auto.value = !auto.value;
  toast(auto.value ? t('rl.autoOn') : t('rl.autoOff'));
}
function stagedBets(): Bet[] {
  const out: Bet[] = [];
  for (const [k, v] of stakes.value) {
    if (v.staged <= 0) continue;
    const [type, selection = ''] = k.split(':') as [BetType, string];
    out.push({ type, selection, amount: v.staged });
  }
  return out;
}
async function confirm(): Promise<void> {
  if (confirming.value || !canBet.value) return;
  const bets = stagedBets();
  if (bets.length === 0) {
    toast(t('rl.noBets'));
    return;
  }
  confirming.value = true;
  try {
    const r = await gameSocket.call<{ accepted: Bet[]; balance: number; roundId: number }>(Ev.RlBet, { bets }, 10000);
    for (const b of r.accepted) {
      const key = `${b.type}:${b.selection}`;
      const cur = stakes.value.get(key) ?? { confirmed: 0, staged: 0 };
      cur.confirmed += b.amount;
      cur.staged = Math.max(0, cur.staged - b.amount);
      stakes.value.set(key, cur);
    }
    actions.value = [];
    touch();
    setBalance(r.balance);
    audio.sfx('chips');
  } catch (e) {
    toast((e as Error).message, 'error');
    if (auto.value) auto.value = false;
  } finally {
    confirming.value = false;
  }
}
function setBalance(v: number): void {
  balance.value = v;
  user.setBalance(v);
}

// ───────────────────────── 回合事件 ─────────────────────────
function applyRound(r: RoundInfo): void {
  const prev = round.value;
  round.value = r;
  if (r.phase === 'betting' && (!prev || prev.roundId !== r.roundId)) {
    // 新一局：记住上局已确认投注（供“重复”/“自动”），清空桌面
    const confirmed: Bet[] = [];
    for (const [k, v] of stakes.value) {
      if (v.confirmed > 0) {
        const [type, selection = ''] = k.split(':') as [BetType, string];
        confirmed.push({ type, selection, amount: v.confirmed });
      }
    }
    if (confirmed.length) lastRoundBets.value = confirmed;
    stakes.value = new Map();
    actions.value = [];
    resultPanel.value = null;
    if (auto.value && lastRoundBets.value.length) {
      if (stageBets(lastRoundBets.value)) void confirm();
      else auto.value = false;
    }
  }
}

// ───────────────────────── 转盘（Canvas 顶视图；球在轮盘坐标系中运动，保证停在服务端号码） ─────────────────────────
const SEG = (Math.PI * 2) / 37;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let wheelAngle = 0;
let wheelSpeed = 0.12; // rad/s 待机慢转
let ballLocal = 0; // 球相对轮盘的角度（弧度）
let spinAnim: { start: number; dur: number; from: number; to: number } | null = null;
let lastTs = 0;
let hubImg: HTMLImageElement | null = null;

function resizeWheel(): void {
  const c = wheelEl.value;
  if (!c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = Math.floor(Math.min(c.clientWidth, c.clientHeight) || 300);
  c.width = size * dpr;
  c.height = size * dpr;
  ctx = c.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function easeOutQuint(k: number): number {
  return 1 - Math.pow(1 - k, 5);
}
function startSpin(result: number, spinMs: number): void {
  const idx = config.value.wheelOrder.indexOf(result);
  const target = idx * SEG + SEG / 2;
  const turns = 6 + Math.floor(Math.random() * 3);
  // 球逆时针跑：从当前位置减去若干整圈后落到目标格
  const from = ballLocal;
  const to = target - Math.PI * 2 * turns;
  spinAnim = { start: performance.now(), dur: Math.max(2500, spinMs - 400), from, to };
  wheelSpeed = 1.6;
  audio.sfx('spin', { volume: 0.5 });
}
function drawWheel(ts: number): void {
  raf = requestAnimationFrame(drawWheel);
  if (!ctx || !wheelEl.value) return;
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  wheelAngle += wheelSpeed * dt;
  if (spinAnim) {
    const k = Math.min(1, (ts - spinAnim.start) / spinAnim.dur);
    ballLocal = spinAnim.from + (spinAnim.to - spinAnim.from) * easeOutQuint(k);
    wheelSpeed = 1.6 - 1.45 * easeOutQuint(k);
    if (k >= 1) {
      ballLocal = ((spinAnim.to % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      spinAnim = null;
      wheelSpeed = 0.12;
      audio.sfx('ballDrop', { volume: 0.7 });
    } else if (Math.floor(ballLocal / SEG) !== Math.floor((ballLocal - (spinAnim.to - spinAnim.from) * 0.002) / SEG)) {
      if (k > 0.55) audio.sfx('wheelTick', { volume: 0.18 * (1 - k) + 0.05, rate: 1.2 });
    }
  }
  const c = wheelEl.value;
  const size = c.width / Math.min(2, window.devicePixelRatio || 1);
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 4;
  ctx.clearRect(0, 0, size, size);
  // 木质外环
  const wood = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R);
  wood.addColorStop(0, '#6b3a12');
  wood.addColorStop(0.5, '#8f5a1e');
  wood.addColorStop(1, '#3a1e08');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f0c14e';
  ctx.stroke();
  // 球道
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.86, 0, Math.PI * 2);
  ctx.fillStyle = '#1c1008';
  ctx.fill();
  // 号码格
  const r1 = R * 0.8;
  const r0 = R * 0.56;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(wheelAngle);
  for (let i = 0; i < 37; i += 1) {
    const n = config.value.wheelOrder[i]!;
    const a0 = i * SEG - Math.PI / 2;
    const a1 = a0 + SEG;
    ctx.beginPath();
    ctx.arc(0, 0, r1, a0, a1);
    ctx.arc(0, 0, r0, a1, a0, true);
    ctx.closePath();
    const col = colorOf(n);
    ctx.fillStyle = col === 'green' ? '#1e8a4a' : col === 'red' ? '#c62828' : '#1b1b22';
    ctx.fill();
    ctx.strokeStyle = 'rgba(240, 193, 78, 0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.rotate(a0 + SEG / 2);
    ctx.translate(r1 - (r1 - r0) * 0.32, 0);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#fff3c4';
    ctx.font = `700 ${Math.max(9, R * 0.085)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
  }
  // 内圈金环 + 中心立绘
  const hubG = ctx.createRadialGradient(0, 0, r0 * 0.2, 0, 0, r0);
  hubG.addColorStop(0, '#ffe9a6');
  hubG.addColorStop(0.55, '#c98a1c');
  hubG.addColorStop(1, '#6b3a12');
  ctx.beginPath();
  ctx.arc(0, 0, r0, 0, Math.PI * 2);
  ctx.fillStyle = hubG;
  ctx.fill();
  if (hubImg && hubImg.complete && hubImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r0 * 0.86, 0, Math.PI * 2);
    ctx.clip();
    ctx.rotate(-wheelAngle);
    const d = r0 * 1.9;
    ctx.drawImage(hubImg, -d / 2, -d / 2 + r0 * 0.06, d, d * (hubImg.naturalHeight / hubImg.naturalWidth));
    ctx.restore();
  }
  // 球（轮盘坐标系）
  const ba = ballLocal - Math.PI / 2;
  const br = spinAnim ? R * 0.83 - (R * 0.83 - (r1 - (r1 - r0) * 0.22)) * easeOutQuint(Math.min(1, (performance.now() - spinAnim.start) / spinAnim.dur)) : r1 - (r1 - r0) * 0.22;
  ctx.beginPath();
  ctx.arc(Math.cos(ba) * br, Math.sin(ba) * br, Math.max(4, R * 0.035), 0, Math.PI * 2);
  ctx.fillStyle = '#fffdf5';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
  // 顶部指针
  ctx.beginPath();
  ctx.moveTo(cx - 8, 2);
  ctx.lineTo(cx + 8, 2);
  ctx.lineTo(cx, 18);
  ctx.closePath();
  ctx.fillStyle = '#ffe28a';
  ctx.fill();
}

// ───────────────────────── 生命周期 ─────────────────────────
async function exit(): Promise<void> {
  await gameSocket.call(Ev.RlLeave, {}, 3000).catch(() => undefined);
  void router.replace('/lobby');
}

/** 进场 / 断线重连后重新进场：全部状态以服务端返回为准 */
let enteredOnce = false;
async function enterTable(initial: boolean): Promise<void> {
  try {
    stakes.value = new Map();
    actions.value = [];
    const r = await gameSocket.call<{
      config: Config;
      round: RoundInfo & { serverTime: number };
      myBets: Bet[];
      history: number[];
      balance: number;
      players: number;
      serverTime: number;
    }>(Ev.RlEnter, {}, 8000);
    config.value = r.config;
    serverOffset.value = r.serverTime - Date.now();
    chip.value = r.config.chips.includes(100) ? 100 : r.config.chips[0]!;
    history.value = r.history ?? [];
    players.value = r.players ?? 1;
    setBalance(r.balance);
    round.value = r.round;
    lastResult.value = r.round.result ?? r.history?.[0] ?? null;
    if (r.round.result !== null && r.round.result !== undefined) {
      ballLocal = r.config.wheelOrder.indexOf(r.round.result) * SEG + SEG / 2;
    }
    for (const b of r.myBets ?? []) {
      const key = `${b.type}:${b.selection}`;
      const cur = stakes.value.get(key) ?? { confirmed: 0, staged: 0 };
      cur.confirmed += b.amount;
      stakes.value.set(key, cur);
    }
    touch();
    enteredOnce = true;
  } catch (e) {
    toast((e as Error).message, 'error');
    if (initial) void router.replace('/lobby');
  }
}

onMounted(async () => {
  if (gameSocket.status !== 'open') await gameSocket.connect();
  audio.setScene('roulette');
  audio.preload(['chip', 'chips', 'spin', 'wheelTick', 'ballDrop', 'win', 'lose', 'tick']);
  hubImg = new Image();
  hubImg.src = mascotArt;
  resizeWheel();
  window.addEventListener('resize', resizeWheel);
  raf = requestAnimationFrame(drawWheel);

  offs.push(
    gameSocket.on(Ev.RlState, (m) => {
      const d = m.data as RoundInfo & { serverTime?: number };
      if (d.serverTime) serverOffset.value = d.serverTime - Date.now();
      applyRound(d);
    }),
    gameSocket.on(Ev.RlSpin, (m) => {
      const d = m.data as { roundId: number; result: number; spinMs: number; resultAt: number; serverTime?: number };
      if (d.serverTime) serverOffset.value = d.serverTime - Date.now();
      if (round.value) round.value = { ...round.value, phase: 'spinning', result: d.result, resultAt: d.resultAt };
      // 服务端已开奖：动画只是把球送到该号码
      startSpin(d.result, d.spinMs);
    }),
    gameSocket.on(Ev.RlResult, (m) => {
      const d = m.data as { roundId: number; result: number; myBet: number; myPayout: number; balance: number | null; history: number[]; players: number; nextAt: number };
      lastResult.value = d.result;
      history.value = d.history ?? history.value;
      players.value = d.players ?? players.value;
      if (round.value) round.value = { ...round.value, phase: 'result', result: d.result, nextAt: d.nextAt };
      if (typeof d.balance === 'number') setBalance(d.balance);
      resultPanel.value = { result: d.result, myBet: d.myBet, myPayout: d.myPayout };
      if (resultTimer) clearTimeout(resultTimer);
      resultTimer = setTimeout(() => (resultPanel.value = null), Math.max(2500, d.nextAt - (Date.now() + serverOffset.value) - 300));
      if (d.myPayout > 0) {
        reward.value?.play({ amount: d.myPayout, tier: d.myPayout >= d.myBet * 10 ? 'mega' : d.myPayout >= d.myBet * 3 ? 'big' : 'normal', banner: t('rl.win'), caption: `${t('rl.result')} ${d.result}` });
      } else if (d.myBet > 0) {
        audio.sfx('lose', { volume: 0.45 });
      }
    }),
  );

  // 断线重连：网关每次连接都会下发 sys.hello，重新进场以刷新回合 / 余额 / 注单
  offs.push(
    gameSocket.on(Ev.SysHello, () => {
      if (enteredOnce) void enterTable(false);
    }),
  );
  await enterTable(true);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener('resize', resizeWheel);
  if (resultTimer) clearTimeout(resultTimer);
  for (const off of offs) off();
  audio.setScene('none');
  void gameSocket.call(Ev.RlLeave, {}, 2000).catch(() => undefined);
});
</script>

<style scoped>
.rl-root {
  height: 100%;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(110% 80% at 50% 0%, rgba(120, 30, 40, 0.45), transparent 60%),
    radial-gradient(120% 100% at 50% 100%, #1a0a10 0%, #0b0508 60%, #05030a 100%);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
}
/* ══ 顶栏 ══ */
.hud-top {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: calc(var(--safe-top) + 8px) max(var(--safe-right), 12px) 4px max(var(--safe-left), 12px);
}
.hback,
.hcoins {
  flex-shrink: 0;
}
.title {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}
.title-text {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
}
.phase {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 14px;
  border-radius: 999px;
  min-width: 150px;
  justify-content: center;
}
.phase-label {
  font-size: 13px;
  font-weight: 800;
  color: var(--sk-gold-1, #ffe9a6);
  letter-spacing: 0.06em;
}
.phase.betting .phase-label {
  color: #8cf59a;
}
.phase.spinning .phase-label {
  color: #ffd25a;
}
/* ══ 主体 ══ */
.body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(240px, 32%) 1fr;
  gap: 12px;
  padding: 0 max(var(--safe-right), 12px) calc(var(--safe-bottom) + 8px) max(var(--safe-left), 12px);
}
.left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-height: 0;
}
.wheel-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  display: grid;
  place-items: center;
}
.wheel {
  width: min(100%, 100vh - 260px);
  aspect-ratio: 1;
  max-height: 100%;
  filter: drop-shadow(0 14px 30px rgba(0, 0, 0, 0.65));
}
.result-badge {
  position: absolute;
  right: 6%;
  bottom: 6%;
  width: 62px;
  height: 62px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 900;
  color: #fff;
  border: 3px solid #f0c14e;
  box-shadow:
    0 0 20px rgba(240, 193, 78, 0.55),
    0 8px 16px rgba(0, 0, 0, 0.5);
}
.result-badge.red {
  background: #c62828;
}
.result-badge.black {
  background: #1b1b22;
}
.result-badge.green {
  background: #1e8a4a;
}
.history {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-radius: 12px;
  width: 100%;
  overflow: hidden;
}
.h-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-right: 4px;
  white-space: nowrap;
}
.hist {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}
.hist.red {
  background: #c62828;
}
.hist.black {
  background: #23232c;
}
.hist.green {
  background: #1e8a4a;
}
.hist:nth-child(2) {
  outline: 2px solid #ffe28a;
}
.players {
  font-size: 11px;
  color: var(--text-secondary);
}
/* ══ 投注台 ══ */
.right {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  min-height: 0;
  min-width: 0;
}
.table {
  --cell: clamp(30px, 7.4vh, 88px);
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: var(--cell) 1fr calc(var(--cell) * 1.2);
  grid-template-rows: auto auto auto;
  gap: 4px;
  padding: 10px;
  border-radius: 16px;
  background: radial-gradient(90% 80% at 50% 30%, #0f5a3a, #073522 70%, #04241a);
  box-shadow:
    inset 0 0 0 2px #7d4d0c,
    inset 0 0 0 4px #f0c14e,
    inset 0 0 40px rgba(0, 0, 0, 0.5),
    0 12px 30px rgba(0, 0, 0, 0.55);
  align-content: center;
  user-select: none;
}
.table.locked .cell {
  cursor: not-allowed;
  filter: saturate(0.7) brightness(0.85);
}
.cell {
  position: relative;
  border: 1.5px solid rgba(255, 236, 200, 0.55);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.18);
  color: #fff;
  cursor: pointer;
  min-height: var(--cell);
  display: grid;
  place-items: center;
  padding: 0;
  transition:
    transform 100ms var(--ease-out),
    box-shadow 120ms var(--ease-out);
}
.cell:hover {
  box-shadow: 0 0 0 2px #ffe28a inset;
}
.cell:active {
  transform: scale(0.96);
}
.cell.red {
  background: #c62828;
}
.cell.black {
  background: #1b1b22;
}
.cell.zero {
  grid-row: 1;
  grid-column: 1;
  background: #1e8a4a;
  height: 100%;
}
.cell-n {
  font-size: calc(var(--cell) * 0.4);
  font-weight: 900;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.cell-t {
  font-size: calc(var(--cell) * 0.3);
  font-weight: 800;
  color: #ffe9a6;
  letter-spacing: 0.04em;
}
.cell-t.diamond {
  width: calc(var(--cell) * 0.42);
  height: calc(var(--cell) * 0.42);
  transform: rotate(45deg);
  border-radius: 3px;
  border: 1.5px solid #ffe9a6;
}
.cell-t.diamond.red {
  background: #e53935;
}
.cell-t.diamond.black {
  background: #111;
}
.grid {
  grid-row: 1;
  grid-column: 2;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: repeat(3, var(--cell));
  gap: 3px;
  min-width: 0;
}
.grid .cell {
  min-width: 0;
}
.cols {
  grid-row: 1;
  grid-column: 3;
  display: grid;
  grid-template-rows: repeat(3, var(--cell));
  gap: 3px;
}
.dozens {
  grid-row: 2;
  grid-column: 2;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
}
.outside {
  grid-row: 3;
  grid-column: 2;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 3px;
}
.cell.side {
  min-height: calc(var(--cell) * 0.82);
  background: rgba(0, 0, 0, 0.22);
}
/* 宽格（打 / 外围）上的筹码靠右放，不遮住文字 */
.dozens .cell :deep(.stake),
.outside .cell :deep(.stake) {
  left: 76%;
}
@keyframes stake-drop-side {
  0% {
    transform: translate(-50%, -90%) scale(1.5);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}
.cell.side.red {
  background: rgba(198, 40, 40, 0.35);
}
.cell.side.black {
  background: rgba(20, 20, 26, 0.6);
}
/* 落桌筹码 */
.cell :deep(.stake) {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: calc(var(--cell) * 0.78);
  height: calc(var(--cell) * 0.78);
  display: grid;
  place-items: center;
  filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.6));
  pointer-events: none;
  animation: stake-drop 220ms var(--ease-out);
}
.cell :deep(.stake img) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.cell :deep(.stake.staged img) {
  opacity: 0.86;
}
.cell :deep(.stake.staged)::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 2px dashed #ffe28a;
}
.cell :deep(.stake-v) {
  position: relative;
  font-size: calc(var(--cell) * 0.22);
  font-weight: 900;
  color: #fff;
  text-shadow:
    0 0 2px #000,
    0 0 3px #000,
    0 1px 2px #000;
}
@keyframes stake-drop {
  0% {
    transform: translate(-50%, -90%) scale(1.5);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}
/* ══ 筹码栏 / 控制台 ══ */
.chips {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
}
.console {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 12px;
}
.stakes {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 14px;
  border-radius: 12px;
  min-width: 150px;
  margin-right: auto;
}
.st-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}
.st-l {
  color: var(--text-secondary);
}
.st-v {
  font-weight: 900;
}
.st-v.placed {
  color: #ffe28a;
}
.st-v.staged {
  color: #8cf59a;
}
.ctl {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.ctl :deep(.gb) {
  --h: 44px;
}
.ctl :deep(.gb.on) {
  filter: drop-shadow(0 0 12px rgba(255, 226, 138, 0.95)) brightness(1.15);
}
.cap {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.cap.gold {
  color: #ffe28a;
  font-weight: 800;
}
.confirm {
  position: relative;
  width: 92px;
  height: 92px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.6));
  transition: transform 120ms var(--ease-out);
}
.confirm img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.confirm:disabled {
  filter: grayscale(0.6) brightness(0.7);
  cursor: not-allowed;
}
.confirm:not(:disabled):active {
  transform: scale(0.94);
}
.confirm.pulse {
  animation: confirm-pulse 1.1s ease-in-out infinite;
}
@keyframes confirm-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}
.spin-ring {
  position: absolute;
  inset: 8px;
  border-radius: 50%;
  border: 3px solid transparent;
  border-top-color: #ffe28a;
  animation: spin-rot 800ms linear infinite;
}
@keyframes spin-rot {
  to {
    transform: rotate(360deg);
  }
}
/* ══ 结果面板 ══ */
.result-panel {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 22px;
  border-radius: 18px;
  pointer-events: none;
}
.rp-mascot {
  height: 120px;
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5));
}
.rp-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 170px;
}
.rp-title {
  font-size: 13px;
  color: var(--text-secondary);
  letter-spacing: 0.1em;
}
.rp-num {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 30px;
  font-weight: 900;
  color: #fff;
  border: 3px solid #f0c14e;
}
.rp-num.red {
  background: #c62828;
}
.rp-num.black {
  background: #1b1b22;
}
.rp-num.green {
  background: #1e8a4a;
}
.rp-rows {
  display: grid;
  grid-template-columns: auto auto;
  gap: 2px 14px;
  font-size: 13px;
  color: var(--text-secondary);
}
.rp-rows .num {
  text-align: right;
  color: #fff3c4;
  font-weight: 800;
}
.rp-rows .num.win {
  color: #8cf59a;
}
.rp-verdict {
  font-size: 16px;
  font-weight: 900;
  color: var(--text-secondary);
}
.rp-verdict.win {
  color: #ffe28a;
  text-shadow: 0 0 10px rgba(255, 200, 80, 0.6);
}
.pop-enter-active,
.pop-leave-active {
  transition: all 240ms var(--ease-out);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.8);
}
.result-badge.pop-enter-from,
.result-badge.pop-leave-to {
  transform: scale(0.6);
}
/* ══ 响应式 ══ */
@media (max-width: 1180px) {
  .body {
    grid-template-columns: minmax(200px, 28%) 1fr;
  }
  .stakes {
    min-width: 120px;
  }
}
@media (max-width: 900px), (max-height: 600px) {
  .title-text {
    font-size: 18px;
  }
  .phase {
    min-width: 120px;
    padding: 2px 10px;
  }
  .body {
    grid-template-columns: minmax(150px, 24%) 1fr;
    gap: 8px;
  }
  .table {
    --cell: clamp(24px, 5.4vh, 44px);
    padding: 6px;
    gap: 3px;
    border-radius: 12px;
  }
  .history {
    padding: 4px 6px;
  }
  .hist {
    width: 20px;
    height: 20px;
    font-size: 10px;
  }
  .players,
  .h-label {
    display: none;
  }
  .chips :deep(.chip) {
    --d: 36px;
  }
  .console {
    gap: 8px;
  }
  .ctl :deep(.gb) {
    --h: 36px;
  }
  .confirm {
    width: 64px;
    height: 64px;
  }
  .cap {
    font-size: 10px;
  }
  .stakes {
    padding: 4px 10px;
    min-width: 110px;
  }
  .st-row {
    font-size: 11px;
  }
  .result-badge {
    width: 44px;
    height: 44px;
    font-size: 20px;
  }
  .rp-mascot {
    height: 84px;
  }
}
@media (max-width: 640px) {
  .body {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  .left {
    flex-direction: row;
    align-items: center;
  }
  .wheel-wrap {
    width: 120px;
    height: 120px;
    flex: none;
  }
  .wheel {
    width: 120px;
  }
  .stakes {
    display: none;
  }
}
/* 结果面板吉祥物弹入 + 待机呼吸（整图动画，素材待拆分） */
.rp-mascot {
  animation: rp-mascot-in 520ms var(--ease-out) both, mascot-breathe 3.2s ease-in-out 520ms infinite;
  transform-origin: 50% 100%;
}
@keyframes rp-mascot-in {
  0% {
    transform: translateY(24px) scale(0.6);
    opacity: 0;
  }
  70% {
    transform: translateY(-4px) scale(1.06);
    opacity: 1;
  }
  100% {
    transform: translateY(0) scale(1);
  }
}
@keyframes mascot-breathe {
  0%,
  100% {
    transform: translateY(0) scaleY(1);
  }
  50% {
    transform: translateY(-4px) scaleY(1.02);
  }
}
</style>
