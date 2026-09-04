<template>
  <div class="st-root">
    <!-- ══ 顶栏：退出 / 标题 / 阶段倒计时 / 金币 ══ -->
    <div class="hud-top">
      <GameButton round size="md" :art="exitArt" class="hback" sfx="close" @click="exit" />
      <div class="title">
        <span class="title-text sk-gold-text">{{ t('game.stock_updown') }}</span>
        <span class="title-sub">{{ t('st.simulated') }}</span>
      </div>
      <div class="phase sk-panel" :class="phase">
        <span class="phase-label">{{ phaseLabel }}</span>
        <Countdown v-if="curRound" :key="`${curRound.roundId}-${phase}`" :deadline-at="phase === 'betting' ? curRound.lockAt : curRound.settleAt" :total-ms="phase === 'betting' ? config.roundMs - config.lockBeforeMs : config.lockBeforeMs" :server-offset="serverOffset" size="sm" />
      </div>
      <CurrencyBar kind="coin" :value="balance" class="hcoins" />
    </div>

    <div class="body">
      <!-- ══ 左：品种列表 + 本局投注 + 近期结果 ══ -->
      <div class="left">
        <div class="inst-list">
          <button v-for="i in config.instruments" :key="i.id" class="inst" :class="{ on: i.id === selected }" type="button" @click="selectInstrument(i.id)">
            <span class="i-name">{{ zh ? i.name : i.nameKo }}</span>
            <span class="i-price num" :class="trendClass(i.id)">{{ priceOf(i.id).toFixed(2) }}</span>
            <span class="i-chg num" :class="trendClass(i.id)">{{ changeLabel(i.id) }}</span>
          </button>
        </div>
        <div class="my-bets sk-panel">
          <div class="mb-title">{{ t('st.myBets') }}<span class="num mb-total">{{ fmt(myTotal) }}</span></div>
          <div v-if="myBets.length === 0" class="mb-empty">—</div>
          <div v-for="(b, i) in myBets" :key="i" class="mb-row">
            <span class="mb-type">{{ betLabel(b) }}</span>
            <span class="num mb-amt">{{ fmt(b.amount) }}</span>
            <span class="num mb-odds">×{{ (b.oddsBp / 10000).toFixed(2) }}</span>
          </div>
        </div>
        <div class="results sk-panel">
          <span class="r-label">{{ t('st.results') }}</span>
          <span v-for="r in (results[selected] ?? []).slice(0, 12)" :key="r.roundId" class="r-dot" :class="r.direction" :title="`${r.openingPrice} → ${r.settlementPrice}`">
            {{ r.direction === 'UP' ? '↑' : r.direction === 'DOWN' ? '↓' : '=' }}
          </span>
        </div>
        <div class="players">{{ t('st.players', { n: players }) }}</div>
        <img class="analyst" :src="analystArt" alt="" draggable="false" />
      </div>

      <!-- ══ 中：走势图（程序绘制） ══ -->
      <div class="center">
        <div class="chart-wrap">
          <canvas ref="chartEl" class="chart" />
          <div class="chart-hud">
            <div class="ch-item"><span class="ch-l">{{ t('st.open') }}</span><span class="num ch-v gold">{{ curRound ? curRound.openingPrice.toFixed(2) : '—' }}</span></div>
            <div class="ch-item"><span class="ch-l">{{ t('st.current') }}</span><span class="num ch-v" :class="trendClass(selected)">{{ priceOf(selected).toFixed(2) }}</span></div>
            <div class="ch-item"><span class="ch-l">{{ phase === 'betting' ? t('st.lockIn') : t('st.settleIn') }}</span><span class="num ch-v">{{ remainLabel }}</span></div>
          </div>
        </div>
      </div>

      <!-- ══ 右：下注面板（每次点击即向服务端提交一注） ══ -->
      <div class="right">
        <div class="chips">
          <button v-for="v in config.chips" :key="v" class="chip" :class="{ on: chip === v }" :disabled="v > balance" type="button" @click="pickChip(v)">
            <img :src="chipArt(v)" alt="" draggable="false" />
          </button>
        </div>
        <div class="main-bets">
          <button class="big up" :disabled="!canBet" type="button" @click="placeBet('UP')">
            <img class="plate" :src="upPlateArt" alt="" draggable="false" />
            <img class="icon" :src="bullArt" alt="" draggable="false" />
            <span class="big-txt sk-outline-text">{{ t('st.up') }}</span>
            <span class="big-odds num">×{{ odds('UP') }}</span>
          </button>
          <button class="big down" :disabled="!canBet" type="button" @click="placeBet('DOWN')">
            <img class="plate" :src="downPlateArt" alt="" draggable="false" />
            <img class="icon" :src="bearArt" alt="" draggable="false" />
            <span class="big-txt sk-outline-text">{{ t('st.down') }}</span>
            <span class="big-odds num">×{{ odds('DOWN') }}</span>
          </button>
        </div>
        <div class="more-title">{{ t('st.more') }}</div>
        <div class="side-bets">
          <button class="sb" :disabled="!canBet" type="button" @click="placeBet('HIGHER')">
            <img :src="arrowUpArt" alt="" /><span class="sb-l">{{ t('st.higher') }}</span><span class="sb-o num">×{{ odds('HIGHER') }}</span>
          </button>
          <button class="sb" :disabled="!canBet" type="button" @click="placeBet('LOWER')">
            <img :src="arrowDownArt" alt="" /><span class="sb-l">{{ t('st.lower') }}</span><span class="sb-o num">×{{ odds('LOWER') }}</span>
          </button>
          <button class="sb" :disabled="!canBet" type="button" @click="placeBet('FIRST_DIGIT', String(digit))">
            <img :src="digitFirstArt" alt="" /><span class="sb-l">{{ t('st.firstDigit') }} = {{ digit }}</span><span class="sb-o num">×{{ odds('FIRST_DIGIT') }}</span>
          </button>
          <button class="sb" :disabled="!canBet" type="button" @click="placeBet('LAST_DIGIT', String(digit))">
            <img :src="digitLastArt" alt="" /><span class="sb-l">{{ t('st.lastDigit') }} = {{ digit }}</span><span class="sb-o num">×{{ odds('LAST_DIGIT') }}</span>
          </button>
        </div>
        <div class="digits">
          <span class="d-label">{{ t('st.pickDigit') }}</span>
          <button v-for="d in 10" :key="d" class="digit num" :class="{ on: digit === d - 1 }" type="button" @click="digit = d - 1">{{ d - 1 }}</button>
        </div>
        <div class="ranges">
          <button v-for="b in config.ranges" :key="b.id" class="range" :class="b.id.startsWith('UP') ? 'up' : 'down'" :disabled="!canBet" type="button" @click="placeBet('RANGE', b.id)">
            <span class="rg-l">{{ bandLabel(b.id) }}</span>
            <span class="rg-o num">×{{ (b.oddsBp / 10000).toFixed(1) }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ══ 结算面板 ══ -->
    <transition name="pop">
      <div v-if="resultPanel" class="result-panel sk-panel">
        <img class="rp-mascot" :src="resultPanel.myPayout > resultPanel.myBet ? scrollArt : analystArt" alt="" draggable="false" />
        <div class="rp-main">
          <div class="rp-title">{{ t('st.result') }} · {{ instName(resultPanel.instrument) }}</div>
          <div class="rp-prices num">
            <span>{{ resultPanel.openingPrice.toFixed(2) }}</span>
            <span class="rp-arrow" :class="resultPanel.direction">{{ resultPanel.direction === 'UP' ? '↑' : resultPanel.direction === 'DOWN' ? '↓' : '=' }}</span>
            <span :class="resultPanel.direction">{{ resultPanel.settlementPrice.toFixed(2) }}</span>
            <span class="rp-pct" :class="resultPanel.direction">{{ resultPanel.changePct >= 0 ? '+' : '' }}{{ resultPanel.changePct.toFixed(2) }}%</span>
          </div>
          <div v-if="resultPanel.myBet > 0" class="rp-rows">
            <span>{{ t('rl.myBet') }}</span><span class="num">{{ fmt(resultPanel.myBet) }}</span>
            <span>{{ t('rl.payout') }}</span><span class="num" :class="resultPanel.myPayout > resultPanel.myBet ? 'win' : ''">{{ fmt(resultPanel.myPayout) }}</span>
          </div>
          <div class="rp-verdict" :class="{ win: resultPanel.myPayout > resultPanel.myBet }">
            {{ resultPanel.myBet === 0 ? t('rl.nextRound') + '…' : resultPanel.direction === 'FLAT' ? t('st.flat') : resultPanel.myPayout > resultPanel.myBet ? t('st.win') : resultPanel.myPayout > 0 ? t('st.flat') : t('st.lose') }}
          </div>
        </div>
      </div>
    </transition>
    <RewardAnimation ref="reward" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Ev } from '@yanbian/protocol';
import { gameSocket } from '../../net/ws.js';
import { useUserStore } from '../../stores/user.js';
import { currentLocale, t } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import { fmt } from '../../ui/format.js';
import { asset } from '../../assets/assets.js';
import { audio } from '../../audio/AudioManager.js';
import GameButton from '../../ui/GameButton.vue';
import CurrencyBar from '../../ui/CurrencyBar.vue';
import Countdown from '../../ui/Countdown.vue';
import RewardAnimation from '../../ui/RewardAnimation.vue';

/**
 * 股市风云（股票涨跌玩法）。行情来自服务端 MarketDataProvider（当前为模拟行情，虚拟品种），
 * 客户端只负责：展示走势 → 点击下注（每次一注，服务端校验 / 扣款 / 锁定赔率）→ 展示结算。
 */

type BetType = 'UP' | 'DOWN' | 'HIGHER' | 'LOWER' | 'FIRST_DIGIT' | 'LAST_DIGIT' | 'RANGE';
interface Instrument {
  id: string;
  name: string;
  nameKo: string;
}
interface RangeBand {
  id: string;
  minPct: number | null;
  maxPct: number | null;
  oddsBp: number;
}
interface Config {
  instruments: Instrument[];
  tickMs: number;
  roundMs: number;
  lockBeforeMs: number;
  chips: number[];
  minBet: number;
  maxBetPerRound: number;
  oddsBp: Record<Exclude<BetType, 'RANGE'>, number>;
  ranges: RangeBand[];
}
interface RoundInfo {
  roundId: number;
  instrument: string;
  openedAt: number;
  lockAt: number;
  settleAt: number;
  openingPrice: number;
}
interface MyBet {
  type: BetType;
  selection: string;
  amount: number;
  oddsBp: number;
}
interface RoundResult {
  roundId: number;
  instrument: string;
  openingPrice: number;
  settlementPrice: number;
  direction: 'UP' | 'DOWN' | 'FLAT';
  changePct: number;
}
interface Point {
  ts: number;
  price: number;
}

const router = useRouter();
const user = useUserStore();
const zh = computed(() => currentLocale.value === 'zh');

const exitArt = asset('common', 'btnExitRound');
const upPlateArt = asset('stock_game', 'btnUpPlate');
const downPlateArt = asset('stock_game', 'btnDownPlate');
const bullArt = asset('stock_game', 'iconBull');
const bearArt = asset('stock_game', 'iconBear');
const arrowUpArt = asset('stock_game', 'iconArrowUpGreen');
const arrowDownArt = asset('stock_game', 'iconArrowDownRed');
const digitFirstArt = asset('stock_game', 'iconDigitFirst');
const digitLastArt = asset('stock_game', 'iconDigitLast');
const analystArt = asset('stock_game', 'caishenAnalyst');
const scrollArt = asset('stock_game', 'caishenScroll');
const CHIP_ART: Record<number, string> = {
  10: asset('stock_game', 'chip10'),
  50: asset('stock_game', 'chip50'),
  100: asset('stock_game', 'chip100'),
  500: asset('stock_game', 'chip500'),
  1000: asset('stock_game', 'chip1k'),
  5000: asset('stock_game', 'chip5k'),
  10000: asset('stock_game', 'chip10k'),
};
const chipArt = (v: number): string => CHIP_ART[v] ?? CHIP_ART[100]!;

const config = ref<Config>({
  instruments: [],
  tickMs: 1000,
  roundMs: 30000,
  lockBeforeMs: 8000,
  chips: [10, 50, 100, 500, 1000, 5000, 10000],
  minBet: 10,
  maxBetPerRound: 500000,
  oddsBp: { UP: 19000, DOWN: 19000, HIGHER: 19000, LOWER: 19000, FIRST_DIGIT: 95000, LAST_DIGIT: 95000 },
  ranges: [],
});
const rounds = ref<Record<string, RoundInfo>>({});
const prices = ref<Record<string, number>>({});
const series = ref<Record<string, Point[]>>({});
const results = ref<Record<string, RoundResult[]>>({});
const myBetsAll = ref<Record<string, MyBet[]>>({});
const selected = ref('');
const chip = ref(100);
const digit = ref(7);
const balance = ref(0);
const players = ref(0);
const serverOffset = ref(0);
const now = ref(Date.now());
const resultPanel = ref<(RoundResult & { myBet: number; myPayout: number }) | null>(null);
const reward = ref<InstanceType<typeof RewardAnimation> | null>(null);
const chartEl = ref<HTMLCanvasElement | null>(null);
const offs: (() => void)[] = [];
let resultTimer: ReturnType<typeof setTimeout> | null = null;
let clock: ReturnType<typeof setInterval> | null = null;
let betting = false;

const curRound = computed(() => rounds.value[selected.value] ?? null);
const phase = computed<'betting' | 'locked'>(() => {
  const r = curRound.value;
  if (!r) return 'locked';
  return now.value + serverOffset.value < r.lockAt ? 'betting' : 'locked';
});
const phaseLabel = computed(() => (phase.value === 'betting' ? t('st.betting') : t('st.locked')));
const canBet = computed(() => !!curRound.value && phase.value === 'betting' && curRound.value.lockAt - (now.value + serverOffset.value) > 500);
const remainLabel = computed(() => {
  const r = curRound.value;
  if (!r) return '—';
  const target = phase.value === 'betting' ? r.lockAt : r.settleAt;
  return `${Math.max(0, Math.ceil((target - (now.value + serverOffset.value)) / 1000))}s`;
});
const myBets = computed(() => myBetsAll.value[selected.value] ?? []);
const myTotal = computed(() => myBets.value.reduce((s, b) => s + b.amount, 0));

const priceOf = (id: string): number => prices.value[id] ?? 0;
function trendClass(id: string): string {
  const r = rounds.value[id];
  if (!r) return '';
  const p = priceOf(id);
  return p > r.openingPrice ? 'up' : p < r.openingPrice ? 'down' : 'flat';
}
function changeLabel(id: string): string {
  const r = rounds.value[id];
  if (!r) return '';
  const pct = ((priceOf(id) - r.openingPrice) / r.openingPrice) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}
function instName(id: string): string {
  const i = config.value.instruments.find((x) => x.id === id);
  return i ? (zh.value ? i.name : i.nameKo) : id;
}
const odds = (type: Exclude<BetType, 'RANGE'>): string => (config.value.oddsBp[type] / 10000).toFixed(2);
function bandLabel(id: string): string {
  const key = id === 'DN2' ? 'st.bandDn2' : id === 'DN1' ? 'st.bandDn1' : id === 'UP1' ? 'st.bandUp1' : id === 'UP2' ? 'st.bandUp2' : '';
  return key ? t(key) : id;
}
function betLabel(b: MyBet): string {
  switch (b.type) {
    case 'UP':
      return t('st.up');
    case 'DOWN':
      return t('st.down');
    case 'HIGHER':
      return `${t('st.higher')} ${b.selection}`;
    case 'LOWER':
      return `${t('st.lower')} ${b.selection}`;
    case 'FIRST_DIGIT':
      return `${t('st.firstDigit')} ${b.selection}`;
    case 'LAST_DIGIT':
      return `${t('st.lastDigit')} ${b.selection}`;
    case 'RANGE':
      return bandLabel(b.selection);
    default:
      return b.type;
  }
}
function pickChip(v: number): void {
  chip.value = v;
  audio.sfx('chip');
}
function selectInstrument(id: string): void {
  selected.value = id;
  audio.sfx('tab');
  resizeChart();
}
function setBalance(v: number): void {
  balance.value = v;
  user.setBalance(v);
}

async function placeBet(type: BetType, selection = ''): Promise<void> {
  if (!canBet.value || betting) return;
  if (chip.value > balance.value) {
    toast(t('error.INSUFFICIENT_BALANCE'), 'error');
    return;
  }
  if (myTotal.value + chip.value > config.value.maxBetPerRound) {
    toast(t('st.overRound'), 'error');
    return;
  }
  betting = true;
  try {
    const r = await gameSocket.call<{ roundId: number; instrument: string; bet: MyBet; balance: number; roundTotal: number }>(
      Ev.StBet,
      { instrument: selected.value, type, selection, amount: chip.value },
      8000,
    );
    const cur = rounds.value[r.instrument];
    if (cur && cur.roundId === r.roundId) {
      const list = myBetsAll.value[r.instrument] ?? [];
      list.push(r.bet);
      myBetsAll.value = { ...myBetsAll.value, [r.instrument]: list };
    }
    setBalance(r.balance);
    audio.sfx('chips', { volume: 0.7 });
  } catch (e) {
    toast((e as Error).message, 'error');
  } finally {
    betting = false;
  }
}

// ───────────────────────── 走势图（Canvas） ─────────────────────────
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let W = 0;
let H = 0;
let animPrice = 0;

function resizeChart(): void {
  const c = chartEl.value;
  if (!c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = c.clientWidth;
  H = c.clientHeight;
  c.width = Math.max(1, Math.floor(W * dpr));
  c.height = Math.max(1, Math.floor(H * dpr));
  ctx = c.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawChart(): void {
  raf = requestAnimationFrame(drawChart);
  if (!ctx || W === 0) return;
  const pts = series.value[selected.value] ?? [];
  const r = rounds.value[selected.value];
  ctx.clearRect(0, 0, W, H);
  const padL = 10;
  const padR = 78;
  const padT = 18;
  const padB = 22;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  if (pts.length < 2) return;
  const last = pts[pts.length - 1]!;
  animPrice += (last.price - animPrice) * 0.18;
  if (Math.abs(animPrice - last.price) < 0.0005) animPrice = last.price;
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pts) {
    lo = Math.min(lo, p.price);
    hi = Math.max(hi, p.price);
  }
  if (r) {
    lo = Math.min(lo, r.openingPrice);
    hi = Math.max(hi, r.openingPrice);
  }
  const span = Math.max(hi - lo, last.price * 0.004);
  lo -= span * 0.18;
  hi += span * 0.18;
  const x = (i: number): number => padL + (iw * i) / (pts.length - 1);
  const y = (p: number): number => padT + ih * (1 - (p - lo) / (hi - lo));
  const up = r ? animPrice >= r.openingPrice : true;
  const col = up ? '#4ade80' : '#f87171';

  // 网格
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g += 1) {
    const gy = padT + (ih * g) / 4;
    ctx.beginPath();
    ctx.moveTo(padL, gy);
    ctx.lineTo(padL + iw, gy);
    ctx.stroke();
    const v = hi - ((hi - lo) * g) / 4;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(v.toFixed(2), padL + iw + 6, gy + 3);
  }
  // 回合开盘线
  if (r) {
    const oy = y(r.openingPrice);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(240,193,78,0.8)';
    ctx.beginPath();
    ctx.moveTo(padL, oy);
    ctx.lineTo(padL + iw, oy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f0c14e';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(r.openingPrice.toFixed(2), padL + iw + 6, oy - 5);
    // 开盘时刻竖线
    const idx = pts.findIndex((p) => p.ts >= r.openedAt);
    if (idx > 0) {
      const ox = x(idx);
      ctx.strokeStyle = 'rgba(240,193,78,0.35)';
      ctx.beginPath();
      ctx.moveTo(ox, padT);
      ctx.lineTo(ox, padT + ih);
      ctx.stroke();
    }
  }
  // 曲线 + 渐变填充
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 1) {
    const px = x(i);
    const py = y(i === pts.length - 1 ? animPrice : pts[i]!.price);
    if (i === 0) ctx.moveTo(px, py);
    else {
      const prevX = x(i - 1);
      const prevY = y(i - 1 === pts.length - 1 ? animPrice : pts[i - 1]!.price);
      const cx = (prevX + px) / 2;
      ctx.bezierCurveTo(cx, prevY, cx, py, px, py);
    }
  }
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.2;
  ctx.shadowColor = col;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineTo(x(pts.length - 1), padT + ih);
  ctx.lineTo(x(0), padT + ih);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, padT, 0, padT + ih);
  grad.addColorStop(0, up ? 'rgba(74,222,128,0.28)' : 'rgba(248,113,113,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fill();
  // 现价点 + 标签
  const lx = x(pts.length - 1);
  const ly = y(animPrice);
  ctx.beginPath();
  ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lx, ly, 9, 0, Math.PI * 2);
  ctx.fillStyle = up ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)';
  ctx.fill();
  ctx.fillStyle = col;
  ctx.fillRect(padL + iw + 2, ly - 10, padR - 6, 20);
  ctx.fillStyle = '#0b0f14';
  ctx.font = '800 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(animPrice.toFixed(2), padL + iw + 8, ly + 4);
  // 时间轴
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let g = 0; g <= 4; g += 1) {
    const i = Math.round(((pts.length - 1) * g) / 4);
    const d = new Date(pts[i]!.ts);
    ctx.fillText(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`, x(i), H - 6);
  }
}

// ───────────────────────── 生命周期 ─────────────────────────
async function exit(): Promise<void> {
  await gameSocket.call(Ev.StLeave, {}, 3000).catch(() => undefined);
  void router.replace('/lobby');
}

/** 进场 / 断线重连后重新进场：全部状态以服务端返回为准 */
let enteredOnce = false;
async function enterTable(initial: boolean): Promise<void> {
  try {
    const r = await gameSocket.call<{
      config: Config;
      rounds: RoundInfo[];
      prices: Record<string, number>;
      history: Record<string, Point[]>;
      results: Record<string, RoundResult[]>;
      myBets: Record<string, MyBet[]>;
      balance: number;
      players: number;
      serverTime: number;
    }>(Ev.StEnter, {}, 8000);
    config.value = r.config;
    serverOffset.value = r.serverTime - Date.now();
    const rm: Record<string, RoundInfo> = {};
    for (const x of r.rounds) rm[x.instrument] = x;
    rounds.value = rm;
    prices.value = r.prices;
    series.value = r.history;
    results.value = r.results;
    myBetsAll.value = r.myBets ?? {};
    setBalance(r.balance);
    players.value = r.players ?? 1;
    selected.value = r.config.instruments[0]?.id ?? '';
    chip.value = r.config.chips.includes(100) ? 100 : r.config.chips[0]!;
    animPrice = prices.value[selected.value] ?? 0;
    resizeChart();
    enteredOnce = true;
  } catch (e) {
    toast((e as Error).message, 'error');
    if (initial) void router.replace('/lobby');
  }
}

onMounted(async () => {
  if (gameSocket.status !== 'open') await gameSocket.connect();
  audio.setScene('stock');
  audio.preload(['chip', 'chips', 'tab', 'win', 'lose', 'tick']);
  resizeChart();
  window.addEventListener('resize', resizeChart);
  raf = requestAnimationFrame(drawChart);
  clock = setInterval(() => (now.value = Date.now()), 250);

  offs.push(
    gameSocket.on(Ev.StTick, (m) => {
      const d = m.data as { ts: number; prices: Record<string, number> };
      serverOffset.value = d.ts - Date.now();
      const next = { ...series.value };
      for (const [id, price] of Object.entries(d.prices)) {
        prices.value[id] = price;
        const arr = [...(next[id] ?? []), { ts: d.ts, price }];
        next[id] = arr.slice(-160);
      }
      series.value = next;
      prices.value = { ...prices.value };
    }),
    gameSocket.on(Ev.StRound, (m) => {
      const d = m.data as { round: RoundInfo; serverTime?: number };
      if (d.serverTime) serverOffset.value = d.serverTime - Date.now();
      rounds.value = { ...rounds.value, [d.round.instrument]: d.round };
      myBetsAll.value = { ...myBetsAll.value, [d.round.instrument]: [] };
    }),
    gameSocket.on(Ev.StResult, (m) => {
      const d = m.data as RoundResult & { myBet: number; myPayout: number; balance: number | null; results: RoundResult[] };
      results.value = { ...results.value, [d.instrument]: d.results ?? results.value[d.instrument] ?? [] };
      if (typeof d.balance === 'number') setBalance(d.balance);
      if (d.instrument !== selected.value && d.myBet === 0) return;
      resultPanel.value = { ...d };
      if (resultTimer) clearTimeout(resultTimer);
      resultTimer = setTimeout(() => (resultPanel.value = null), d.myBet > 0 ? 5000 : 2600);
      if (d.myPayout > d.myBet) {
        reward.value?.play({ amount: d.myPayout, tier: d.myPayout >= d.myBet * 5 ? 'mega' : d.myPayout >= d.myBet * 2 ? 'big' : 'normal', banner: t('st.win'), caption: `${instName(d.instrument)} ${d.direction}` });
      } else if (d.myBet > 0 && d.myPayout === 0) {
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
  if (clock) clearInterval(clock);
  if (resultTimer) clearTimeout(resultTimer);
  window.removeEventListener('resize', resizeChart);
  for (const off of offs) off();
  audio.setScene('none');
  void gameSocket.call(Ev.StLeave, {}, 2000).catch(() => undefined);
});
</script>

<style scoped>
.st-root {
  height: 100%;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(90% 60% at 50% 0%, rgba(20, 60, 90, 0.5), transparent 60%),
    radial-gradient(120% 100% at 50% 100%, #0b1622 0%, #070d16 60%, #04070d 100%);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
}
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
  flex-direction: column;
  min-width: 0;
}
.title-text {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
  line-height: 1.1;
}
.title-sub {
  font-size: 10px;
  color: var(--text-disabled);
  letter-spacing: 0.06em;
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
  color: #ffd25a;
  letter-spacing: 0.06em;
}
.phase.betting .phase-label {
  color: #8cf59a;
}
.body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(180px, 19%) 1fr minmax(280px, 30%);
  gap: 10px;
  padding: 0 max(var(--safe-right), 12px) calc(var(--safe-bottom) + 8px) max(var(--safe-left), 12px);
}
/* ══ 左 ══ */
.left {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.inst-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.inst {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 0 8px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1.5px solid rgba(240, 193, 78, 0.2);
  background: linear-gradient(180deg, rgba(20, 34, 52, 0.9), rgba(8, 14, 24, 0.9));
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: border-color 140ms var(--ease-out);
}
.inst.on {
  border-color: #f0c14e;
  box-shadow: 0 0 0 1px rgba(240, 193, 78, 0.35) inset, 0 6px 16px rgba(0, 0, 0, 0.4);
}
.i-name {
  font-size: 13px;
  font-weight: 800;
  grid-row: 1 / span 2;
  align-self: center;
}
.i-price {
  font-size: 15px;
  font-weight: 900;
  text-align: right;
}
.i-chg {
  font-size: 11px;
  text-align: right;
}
.up {
  color: #4ade80;
}
.down {
  color: #f87171;
}
.flat {
  color: var(--text-secondary);
}
.my-bets {
  flex: 1;
  min-height: 0;
  padding: 8px 12px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
  scrollbar-width: none;
}
.mb-title {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
}
.mb-total {
  color: #ffe28a;
  font-weight: 800;
}
.mb-empty {
  color: var(--text-disabled);
  text-align: center;
  font-size: 12px;
  padding: 8px 0;
}
.mb-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 6px;
  font-size: 11.5px;
  padding: 3px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.mb-amt {
  color: #ffe28a;
  font-weight: 800;
}
.mb-odds {
  color: var(--text-secondary);
}
.results {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 12px;
  overflow: hidden;
}
.r-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-right: 4px;
  white-space: nowrap;
}
.r-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 900;
  color: #fff;
  flex-shrink: 0;
  background: #44506a;
}
.r-dot.UP {
  background: #16a34a;
}
.r-dot.DOWN {
  background: #dc2626;
}
.players {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
}
/* ══ 中：走势图 ══ */
.center {
  min-width: 0;
  min-height: 0;
  display: flex;
}
.chart-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(12, 22, 36, 0.95), rgba(6, 11, 20, 0.95));
  box-shadow:
    inset 0 0 0 1.5px rgba(240, 193, 78, 0.35),
    0 12px 30px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
.chart {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.chart-hud {
  position: absolute;
  left: 12px;
  top: 10px;
  display: flex;
  gap: 16px;
  pointer-events: none;
}
.ch-item {
  display: flex;
  flex-direction: column;
}
.ch-l {
  font-size: 10px;
  color: var(--text-secondary);
}
.ch-v {
  font-size: 16px;
  font-weight: 900;
}
.ch-v.gold {
  color: #ffe28a;
}
.analyst {
  align-self: center;
  height: clamp(70px, 15vh, 140px);
  margin-top: -4px;
  pointer-events: none;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5));
}
/* ══ 右：下注面板 ══ */
.right {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  min-width: 0;
}
.chips {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
}
.chip {
  position: relative;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  transition: transform 120ms var(--ease-out);
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.5));
}
/* 素材自带 16% 透明安全边距：图片盒按 1/0.68 放大并负偏移，可见板件与按钮盒等大（docs/12） */
.chip img {
  position: absolute;
  inset: -23.5%;
  width: 147%;
  height: 147%;
  object-fit: contain;
  object-position: center;
}
.chip.on {
  transform: translateY(-5px) scale(1.12);
  filter: drop-shadow(0 0 10px rgba(255, 226, 138, 0.9));
}
.chip:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.main-bets {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.big {
  position: relative;
  height: clamp(64px, 11vh, 96px);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 120ms var(--ease-out);
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5));
}
.big:not(:disabled):active {
  transform: scale(0.96);
}
.big:disabled {
  filter: grayscale(0.7) brightness(0.7);
  cursor: not-allowed;
}
.big .plate {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}
.big .icon {
  position: absolute;
  left: 8%;
  top: 50%;
  transform: translateY(-50%);
  height: 62%;
}
.big-txt {
  position: relative;
  font-size: clamp(18px, 3vh, 26px);
  font-weight: 900;
  margin-left: 18%;
}
.big-odds {
  position: absolute;
  right: 10%;
  bottom: 8%;
  font-size: 12px;
  font-weight: 800;
  color: #ffe9a6;
}
.more-title {
  font-size: 11px;
  color: var(--text-secondary);
  letter-spacing: 0.1em;
  text-align: center;
}
.side-bets {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.sb {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1.5px solid rgba(240, 193, 78, 0.28);
  background: linear-gradient(180deg, rgba(20, 34, 52, 0.9), rgba(8, 14, 24, 0.9));
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: transform 120ms var(--ease-out);
}
.sb:not(:disabled):hover {
  border-color: #f0c14e;
}
.sb:not(:disabled):active {
  transform: scale(0.97);
}
.sb:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sb img {
  height: 26px;
}
.sb-l {
  flex: 1;
  font-size: 12px;
  font-weight: 700;
}
.sb-o {
  font-size: 12px;
  color: #ffe28a;
  font-weight: 800;
}
.digits {
  display: flex;
  align-items: center;
  gap: 4px;
}
.d-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-right: 4px;
  white-space: nowrap;
}
.digit {
  flex: 1;
  height: 28px;
  border-radius: 7px;
  border: 1px solid rgba(240, 193, 78, 0.3);
  background: rgba(0, 0, 0, 0.3);
  color: var(--text-primary);
  font-weight: 800;
  cursor: pointer;
}
.digit.on {
  background: linear-gradient(180deg, #ffe9a6, #c98a1c);
  color: #1a1206;
  border-color: #ffe9a6;
}
.ranges {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.range {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px;
  border-radius: 10px;
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
  cursor: pointer;
  transition: transform 120ms var(--ease-out);
}
.range.up {
  background: linear-gradient(180deg, rgba(22, 163, 74, 0.35), rgba(8, 40, 20, 0.7));
}
.range.down {
  background: linear-gradient(180deg, rgba(220, 38, 38, 0.35), rgba(50, 10, 10, 0.7));
}
.range:not(:disabled):active {
  transform: scale(0.96);
}
.range:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rg-l {
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.rg-o {
  font-size: 12px;
  font-weight: 900;
  color: #ffe28a;
}
/* ══ 结算面板 ══ */
.result-panel {
  position: absolute;
  left: 50%;
  top: 66%;
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
  gap: 6px;
  min-width: 220px;
}
.rp-title {
  font-size: 13px;
  color: var(--text-secondary);
  letter-spacing: 0.1em;
}
.rp-prices {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
  font-weight: 900;
}
.rp-arrow.UP,
.rp-pct.UP,
.rp-prices .UP {
  color: #4ade80;
}
.rp-arrow.DOWN,
.rp-pct.DOWN,
.rp-prices .DOWN {
  color: #f87171;
}
.rp-pct {
  font-size: 14px;
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
/* ══ 响应式 ══ */
@media (max-width: 1180px) {
  .body {
    grid-template-columns: minmax(160px, 18%) 1fr minmax(250px, 30%);
  }
}
@media (max-width: 900px), (max-height: 600px) {
  .title-text {
    font-size: 17px;
  }
  .title-sub {
    display: none;
  }
  .phase {
    min-width: 120px;
    padding: 2px 10px;
  }
  .body {
    grid-template-columns: minmax(140px, 18%) 1fr minmax(230px, 31%);
    gap: 6px;
  }
  .inst {
    padding: 5px 8px;
    border-radius: 9px;
  }
  .i-name {
    font-size: 11px;
  }
  .i-price {
    font-size: 13px;
  }
  .i-chg {
    font-size: 10px;
  }
  .my-bets {
    padding: 5px 8px;
  }
  .results,
  .players {
    display: none;
  }
  .chips {
    gap: 3px;
  }
  .chip {
    width: 28px;
    height: 28px;
  }
  .d-label {
    display: none;
  }
  .digits {
    gap: 3px;
  }
  .big {
    height: clamp(48px, 11vh, 64px);
  }
  .big-txt {
    font-size: 15px;
  }
  .big-odds {
    font-size: 10px;
  }
  .sb {
    padding: 4px 6px;
  }
  .sb img {
    height: 20px;
  }
  .sb-l,
  .sb-o {
    font-size: 10.5px;
  }
  .digit {
    height: 22px;
    min-width: 0;
    padding: 0;
    font-size: 11px;
  }
  .rg-l {
    font-size: 9.5px;
  }
  .rg-o {
    font-size: 10.5px;
  }
  .analyst {
    display: none;
  }
  .ch-v {
    font-size: 13px;
  }
  .rp-mascot {
    height: 84px;
  }
}
@media (max-width: 640px) {
  .body {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 180px 1fr;
  }
  .left {
    grid-column: 1;
  }
  .center {
    grid-column: 2;
  }
  .right {
    grid-column: 1 / span 2;
  }
}
/* 分析师待机：浮动 + 呼吸 + 微摆；结果面板吉祥物弹入（整图动画，素材待拆分） */
.analyst {
  animation: analyst-idle 3.4s ease-in-out infinite;
  transform-origin: 50% 100%;
}
@keyframes analyst-idle {
  0%,
  100% {
    transform: translateY(0) rotate(-0.8deg) scaleY(1);
  }
  50% {
    transform: translateY(-7px) rotate(0.8deg) scaleY(1.02);
  }
}
.rp-mascot {
  animation: rp-mascot-in 520ms var(--ease-out) both;
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
</style>
