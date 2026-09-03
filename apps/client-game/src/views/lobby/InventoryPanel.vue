<template>
  <section class="bag">
    <header class="bag-head">
      <h2 class="sk-gold-text">{{ t('bag.title') }}</h2>
      <p class="bag-note">{{ t('bag.note') }}</p>
    </header>
    <EmptyState v-if="!loading && !items.length" :title="t('bag.empty')" :hint="t('bag.emptyHint')" />
    <div v-else class="bag-grid">
      <article v-for="it in items" :key="it.itemId" class="item sk-panel">
        <img class="item-icon" :src="assetByKey(it.icon) || fallback" alt="" draggable="false" />
        <span class="item-qty num">×{{ it.qty }}</span>
        <h3 class="item-name">{{ locale === 'ko' ? it.nameKo || it.name : it.name }}</h3>
        <p class="item-kind">{{ t(`bag.kind.${it.kind}`) }}<template v-if="it.gameId"> · {{ t(`game.${it.gameId}`) }}</template></p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onActivated, onMounted, ref } from 'vue';
import { api } from '../../net/api.js';
import { t, currentLocale } from '../../i18n/index.js';
import { asset, assetByKey } from '../../assets/assets.js';
import EmptyState from '../../ui/EmptyState.vue';

interface Item {
  itemId: string;
  qty: number;
  kind: 'skill' | 'ticket' | 'frame' | 'consumable';
  name: string;
  nameKo: string;
  icon: string;
  gameId: string | null;
}
const locale = currentLocale;
const items = ref<Item[]>([]);
const loading = ref(false);
const fallback = asset('common', 'iconGiftBox');
async function load(): Promise<void> {
  loading.value = true;
  try {
    const d = await api<{ items: Item[] }>('/api/v1/inventory');
    items.value = d.items;
  } catch {
    /* noop */
  } finally {
    loading.value = false;
  }
}
onMounted(load);
onActivated(load);
</script>

<style scoped>
.bag {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}
.bag-head h2 {
  font-size: 30px;
  letter-spacing: 0.1em;
  margin: 0;
  font-family: var(--font-display-zh);
}
.bag-note {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9fb4e8;
}
.bag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 14px;
}
.item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 18px 10px 12px;
  text-align: center;
}
.item-icon {
  height: 72px;
  width: auto;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.55));
}
.item-qty {
  position: absolute;
  top: 8px;
  right: 10px;
  font-weight: 900;
  color: #ffe28a;
  text-shadow: var(--sk-outline);
}
.item-name {
  margin: 4px 0 0;
  font-size: 14px;
  font-weight: 800;
  color: #fff6d5;
}
.item-kind {
  margin: 0;
  font-size: 11px;
  color: #9fb4e8;
}
</style>
