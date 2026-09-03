<template>
  <section class="gp">
    <h2 class="sk-gold-text gp-title">{{ t('lobby.games') }}</h2>
    <div class="gp-list">
      <button v-for="g in games" :key="g.gameId" class="gp-item sk-panel" :class="{ off: g.status !== 'online' }" type="button" @click="$emit('open', g.gameId)">
        <img class="gp-icon" :src="icon(g.gameId)" alt="" draggable="false" />
        <span class="gp-meta">
          <span class="gp-name">{{ locale === 'ko' ? g.nameKo : g.name }}</span>
          <span class="gp-desc">{{ t(`game.${g.gameId}.desc`) }}</span>
          <span class="gp-online num"><i class="dot" />{{ t('lobby.online', { n: g.online }) }}</span>
        </span>
        <span class="gp-state" :class="g.status">{{ g.status === 'online' ? t('lobby.enter') : g.status === 'maintenance' ? t('game.maintenance') : t('lobby.comingSoon') }}</span>
      </button>
    </div>
    <h2 class="sk-gold-text gp-title">{{ t('lobby.recentRecords') }}</h2>
    <RecordsPanel />
  </section>
</template>

<script setup lang="ts">
import { onActivated, onMounted, ref } from 'vue';
import { api } from '../../net/api.js';
import { t, currentLocale } from '../../i18n/index.js';
import { asset } from '../../assets/assets.js';
import RecordsPanel from './RecordsPanel.vue';

interface GameItem {
  gameId: string;
  name: string;
  nameKo: string;
  status: string;
  online: number;
}
defineEmits<{ (e: 'open', gameId: string): void }>();
const locale = currentLocale;
const games = ref<GameItem[]>([]);
const ORDER = ['mahjong_yanbian', 'hongshi', 'fishing', 'slot_fruit', 'roulette', 'stock_updown'];
const ICONS: Record<string, string> = {
  mahjong_yanbian: asset('common', 'navIconMahjong'),
  hongshi: asset('red10', 'modeIconClassic'),
  fishing: asset('lobby', 'iconGameFishing'),
  slot_fruit: asset('lobby', 'iconGameSlots'),
  roulette: asset('lobby', 'iconGameRoulette'),
  stock_updown: asset('lobby', 'iconGameStock'),
};
function icon(id: string): string {
  return ICONS[id] ?? asset('lobby', 'iconTournament');
}
async function load(): Promise<void> {
  try {
    const d = await api<{ games: GameItem[] }>('/api/v1/lobby');
    games.value = [...d.games].sort((a, b) => ORDER.indexOf(a.gameId) - ORDER.indexOf(b.gameId));
  } catch {
    /* noop */
  }
}
onMounted(load);
onActivated(load);
</script>

<style scoped>
.gp {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}
.gp-title {
  margin: 0;
  font-size: 26px;
  letter-spacing: 0.1em;
  font-family: var(--font-display-zh);
}
.gp-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}
.gp-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border: 0;
  color: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 140ms var(--ease-out);
}
.gp-item:hover {
  transform: translateY(-2px);
}
.gp-item.off {
  cursor: default;
  filter: saturate(0.5);
}
.gp-icon {
  width: 72px;
  height: 72px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
}
.gp-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.gp-name {
  font-size: 18px;
  font-weight: 900;
  color: #fff6d5;
}
.gp-desc {
  font-size: 12px;
  color: #9fb4e8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gp-online {
  font-size: 12px;
  color: #7cf36a;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
}
.gp-state {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 800;
  padding: 6px 12px;
  border-radius: 10px;
  background: linear-gradient(180deg, #ffe38b, #f0a730);
  color: #2a1500;
}
.gp-state.maintenance,
.gp-state.offline {
  background: #2b3448;
  color: #dfe4ec;
}
</style>
