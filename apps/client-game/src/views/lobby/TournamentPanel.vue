<template>
  <section class="tour">
    <header class="tour-head">
      <h2 class="sk-gold-text">{{ t('tour.title') }}</h2>
      <p class="tour-note">{{ t('tour.note') }}</p>
    </header>
    <EmptyState v-if="!loading && !items.length" :title="t('tour.empty')" :hint="t('tour.emptyHint')" />
    <div v-else class="tour-list">
      <article v-for="tt in items" :key="tt.id" class="tcard sk-panel" :class="tt.status">
        <img class="tcard-icon" :src="gameIcon(tt.gameId)" alt="" draggable="false" />
        <div class="tcard-main">
          <div class="tcard-title">
            <h3>{{ locale === 'ko' ? tt.nameKo || tt.name : tt.name }}</h3>
            <span class="tcard-status" :class="tt.status">{{ t(`tour.status.${tt.status}`) }}</span>
          </div>
          <p class="tcard-meta">
            <span>{{ t(`game.${tt.gameId}`) }}</span> · <span>{{ t(`tour.metric.${tt.metric}`) }}</span> · <span class="num">{{ t('tour.participants', { n: tt.participants }) }}</span>
          </p>
          <p class="tcard-time num">{{ tt.status === 'settled' ? t('tour.ended') : t('tour.endsIn', { s: remain(tt.endsAt) }) }}</p>
          <div class="tcard-rewards">
            <span v-for="(r, i) in tt.rewards" :key="i" class="rw">
              <img :src="r.currency === 'DIAMOND' ? gemIcon : coinIcon" alt="" />
              <span class="num">{{ r.rankFrom === r.rankTo ? `#${r.rankFrom}` : `#${r.rankFrom}-${r.rankTo}` }} {{ fmt(r.amount) }}</span>
            </span>
          </div>
          <div v-if="tt.joined" class="tcard-me">
            <span>{{ t('tour.myRank') }} <b class="num">{{ tt.myRank ?? '—' }}</b></span>
            <span>{{ t('tour.myScore') }} <b class="num">{{ tt.myScore ?? 0 }}</b></span>
          </div>
          <details v-if="tt.top.length" class="tcard-top">
            <summary>{{ t('tour.leaderboard') }}</summary>
            <ol>
              <li v-for="row in tt.top" :key="row.uid" :class="{ me: row.uid === myUid }">
                <span class="rk num">{{ row.rank }}</span><span class="nk">{{ row.nickname }}</span><span class="sc num">{{ row.score }}</span>
              </li>
            </ol>
          </details>
        </div>
        <div class="tcard-act">
          <GameButton v-if="tt.status === 'running' && !tt.joined" variant="gold" size="md" :loading="pending === tt.id" :disabled="!!pending" sfx="confirm" @click="join(tt)">{{ t('tour.join') }}</GameButton>
          <GameButton v-else-if="tt.status === 'running'" variant="green" size="md" :disabled="true">{{ t('tour.joined') }}</GameButton>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, ref } from 'vue';
import { api } from '../../net/api.js';
import { t, currentLocale } from '../../i18n/index.js';
import { asset } from '../../assets/assets.js';
import { useUserStore } from '../../stores/user.js';
import { toast } from '../../ui/toast.js';
import { fmt } from '../../ui/format.js';
import GameButton from '../../ui/GameButton.vue';
import EmptyState from '../../ui/EmptyState.vue';

interface Tournament {
  id: string;
  gameId: string;
  name: string;
  nameKo: string;
  metric: string;
  startsAt: number;
  endsAt: number;
  rewards: { rankFrom: number; rankTo: number; currency: 'COIN' | 'DIAMOND'; amount: number }[];
  status: 'scheduled' | 'running' | 'settled' | 'cancelled';
  participants: number;
  joined: boolean;
  myScore: number | null;
  myRank: number | null;
  top: { uid: number; nickname: string; avatarId: number; score: number; rank: number }[];
}
const locale = currentLocale;
const user = useUserStore();
const myUid = computed(() => user.me?.uid ?? 0);
const items = ref<Tournament[]>([]);
const loading = ref(false);
const pending = ref('');
const now = ref(Date.now());
const coinIcon = asset('common', 'iconCoinLg');
const gemIcon = asset('common', 'iconGemBlue');
let timer = 0;

const GAME_ICON: Record<string, string> = {
  mahjong_yanbian: asset('common', 'navIconMahjong'),
  hongshi: asset('red10', 'modeIconClassic'),
  fishing: asset('lobby', 'iconGameFishing'),
  slot_fruit: asset('lobby', 'iconGameSlots'),
  roulette: asset('lobby', 'iconGameRoulette'),
  stock_updown: asset('lobby', 'iconGameStock'),
};
function gameIcon(gameId: string): string {
  return GAME_ICON[gameId] ?? asset('lobby', 'iconTournament');
}
function remain(endsAt: number): string {
  const ms = Math.max(0, endsAt - now.value);
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
async function load(): Promise<void> {
  loading.value = true;
  try {
    const d = await api<{ items: Tournament[] }>('/api/v1/tournaments');
    items.value = d.items;
  } catch {
    /* noop */
  } finally {
    loading.value = false;
  }
}
async function join(tt: Tournament): Promise<void> {
  if (pending.value) return;
  pending.value = tt.id;
  try {
    await api(`/api/v1/tournaments/${tt.id}/join`, {});
    toast(t('tour.joinOk'), 'success');
    await load();
  } catch (e) {
    toast((e as Error).message, 'error');
  } finally {
    pending.value = '';
  }
}
onMounted(() => {
  void load();
  timer = window.setInterval(() => (now.value = Date.now()), 30000);
});
onActivated(load);
onBeforeUnmount(() => clearInterval(timer));
</script>

<style scoped>
.tour {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}
.tour-head h2 {
  font-size: 30px;
  letter-spacing: 0.1em;
  margin: 0;
  font-family: var(--font-display-zh);
}
.tour-note {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9fb4e8;
}
.tour-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tcard {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  padding: 18px 20px;
}
.tcard.settled {
  filter: saturate(0.6);
}
.tcard-icon {
  width: 96px;
  height: 96px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.55));
}
.tcard-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tcard-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.tcard-title h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 900;
  color: #fff6d5;
}
.tcard-status {
  font-size: 11px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 8px;
  background: #2b3448;
  color: #dfe4ec;
}
.tcard-status.running {
  background: linear-gradient(180deg, #7cf36a, #22a83a);
  color: #0a2a10;
}
.tcard-status.scheduled {
  background: linear-gradient(180deg, #8ac8ff, #2f7be6);
  color: #061238;
}
.tcard-meta,
.tcard-time {
  margin: 0;
  font-size: 13px;
  color: #9fb4e8;
}
.tcard-time {
  color: #ffe28a;
}
.tcard-rewards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}
.rw {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #fff;
}
.rw img {
  height: 18px;
}
.tcard-me {
  display: flex;
  gap: 18px;
  font-size: 13px;
  color: #dfe4ec;
}
.tcard-me b {
  color: #ffe28a;
}
.tcard-top summary {
  cursor: pointer;
  font-size: 13px;
  color: #9fb4e8;
}
.tcard-top ol {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 4px 16px;
}
.tcard-top li {
  display: flex;
  gap: 10px;
  font-size: 13px;
  color: #dfe4ec;
  padding: 3px 8px;
  border-radius: 6px;
}
.tcard-top li.me {
  background: rgba(248, 199, 74, 0.15);
}
.tcard-top .rk {
  width: 24px;
  color: #ffe28a;
  font-weight: 800;
}
.tcard-top .nk {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tcard-act {
  flex-shrink: 0;
  align-self: center;
}
@media (max-width: 720px) {
  .tcard {
    flex-wrap: wrap;
  }
  .tcard-icon {
    width: 64px;
    height: 64px;
  }
  .tcard-act {
    width: 100%;
  }
}
</style>
