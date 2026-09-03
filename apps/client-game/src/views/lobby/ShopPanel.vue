<template>
  <section class="shop">
    <header class="shop-head">
      <h2 class="sk-gold-text">{{ t('shop.title') }}</h2>
      <p class="shop-note">{{ t('shop.note') }}</p>
    </header>
    <div v-if="loading && !products.length" class="shop-loading">{{ t('common.loading') }}</div>
    <div v-else class="shop-grid">
      <article v-for="p in products" :key="p.productId" class="prod sk-panel" :class="{ soldout: p.dailyLimit > 0 && p.boughtToday >= p.dailyLimit }">
        <img class="prod-icon" :src="assetByKey(p.icon) || fallbackIcon" alt="" draggable="false" />
        <h3 class="prod-name">{{ locale === 'ko' ? p.nameKo || p.name : p.name }}</h3>
        <p class="prod-grant">
          <template v-if="p.grantCurrency">{{ p.grantCurrency === 'COIN' ? t('shop.coins', { n: fmt(p.grantAmount) }) : t('shop.diamonds', { n: p.grantAmount }) }}</template>
          <template v-else>{{ t('shop.items', { n: p.grantQty }) }}</template>
        </p>
        <p v-if="p.dailyLimit > 0" class="prod-limit">{{ t('shop.limit', { n: p.boughtToday, m: p.dailyLimit }) }}</p>
        <GameButton :variant="p.priceCurrency === 'DIAMOND' ? 'blue' : 'gold'" size="sm" block :loading="pending === p.productId" :disabled="!!pending || (p.dailyLimit > 0 && p.boughtToday >= p.dailyLimit)" sfx="confirm" @click="buy(p)">
          <img class="prod-cur" :src="p.priceCurrency === 'DIAMOND' ? gemIcon : coinIcon" alt="" />{{ p.price.toLocaleString('en-US') }}
        </GameButton>
      </article>
    </div>
    <RewardAnimation ref="reward" />
  </section>
</template>

<script setup lang="ts">
import { onActivated, onMounted, ref } from 'vue';
import { api } from '../../net/api.js';
import { t, currentLocale } from '../../i18n/index.js';
import { asset, assetByKey } from '../../assets/assets.js';
import { useUserStore } from '../../stores/user.js';
import { toast } from '../../ui/toast.js';
import { fmt } from '../../ui/format.js';
import GameButton from '../../ui/GameButton.vue';
import RewardAnimation from '../../ui/RewardAnimation.vue';

interface Product {
  productId: string;
  name: string;
  nameKo: string;
  priceCurrency: 'DIAMOND' | 'COIN';
  price: number;
  grantCurrency: 'COIN' | 'DIAMOND' | null;
  grantAmount: number;
  grantItem: string | null;
  grantQty: number;
  icon: string;
  dailyLimit: number;
  boughtToday: number;
}
const locale = currentLocale;
const user = useUserStore();
const products = ref<Product[]>([]);
const loading = ref(false);
const pending = ref('');
const reward = ref<InstanceType<typeof RewardAnimation> | null>(null);
const coinIcon = asset('common', 'iconCoinLg');
const gemIcon = asset('common', 'iconGemBlue');
const fallbackIcon = asset('common', 'iconGiftBox');

async function load(): Promise<void> {
  loading.value = true;
  try {
    const d = await api<{ products: Product[] }>('/api/v1/shop');
    products.value = d.products;
  } catch {
    /* toast 由拦截层 */
  } finally {
    loading.value = false;
  }
}
onMounted(load);
onActivated(load);

/** 购买：客户端生成幂等键；余额以服务器返回为准（不做本地 += ） */
async function buy(p: Product): Promise<void> {
  if (pending.value) return;
  pending.value = p.productId;
  const key = `shop-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  try {
    const r = await api<{ orderId: string; duplicated: boolean; granted: Record<string, number>; balances: { COIN: number; DIAMOND: number } }>('/api/v1/shop/purchase', {
      productId: p.productId,
      idempotencyKey: key,
    });
    user.setBalance(r.balances.COIN, r.balances.DIAMOND);
    if (p.grantCurrency === 'COIN') reward.value?.play({ amount: p.grantAmount, caption: t('shop.success') });
    else toast(t('shop.success'), 'success');
    await load();
  } catch (e) {
    const err = e as Error & { code?: number };
    toast(err.code === 3000 ? t('error.INSUFFICIENT_BALANCE') : err.message, 'error');
  } finally {
    pending.value = '';
  }
}
</script>

<style scoped>
.shop {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}
.shop-head h2 {
  font-size: 30px;
  letter-spacing: 0.1em;
  margin: 0;
  font-family: var(--font-display-zh);
}
.shop-note {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9fb4e8;
}
.shop-loading {
  color: #9fb4e8;
  padding: 40px;
  text-align: center;
}
.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
  gap: 14px;
}
.prod {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 14px 14px;
  text-align: center;
  transition: transform 160ms var(--ease-out);
}
.prod:hover {
  transform: translateY(-3px);
}
.prod.soldout {
  filter: saturate(0.5) brightness(0.8);
}
.prod-icon {
  height: 84px;
  width: auto;
  max-width: 100%;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.55));
}
.prod-name {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 800;
  color: #fff6d5;
}
.prod-grant {
  margin: 0;
  font-size: 13px;
  color: #ffe28a;
}
.prod-limit {
  margin: 0;
  font-size: 11px;
  color: #9fb4e8;
}
.prod-cur {
  height: 22px;
  width: auto;
  margin-right: 4px;
}
</style>
