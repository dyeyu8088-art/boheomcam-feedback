<template>
  <div class="panel">
    <div class="searchbar">
      <input v-model="searchUid" class="input num" :placeholder="t('friends.search')" inputmode="numeric" />
      <button class="btn btn-primary btn-sm" :disabled="!searchUid" @click="doSearch">{{ t('friends.add') }}</button>
    </div>

    <section v-if="requests.length" class="glass sec">
      <h4>{{ t('friends.requests') }}</h4>
      <div v-for="r in requests" :key="r.id" class="row">
        <span class="person"><AvatarBadge :id="r.avatar_id" :size="30" :ring="false" /> {{ r.nickname }} <span class="dim num">({{ r.uid }})</span></span>
        <div class="acts">
          <button class="btn btn-primary btn-sm" @click="handle(r.id, 'accept')">{{ t('friends.accept') }}</button>
          <button class="btn btn-ghost btn-sm" @click="handle(r.id, 'reject')">{{ t('friends.reject') }}</button>
        </div>
      </div>
    </section>

    <section class="glass sec">
      <h4>{{ t('friends.title') }} ({{ friends.length }})</h4>
      <div v-if="friends.length === 0" class="empty">{{ t('common.empty') }}</div>
      <div v-for="f in friends" :key="f.uid" class="row">
        <span class="person">
          <span class="stat" :class="{ on: f.online }" /><AvatarBadge :id="f.avatarId" :size="30" :ring="false" /> {{ f.nickname }}
          <span class="dim num">({{ f.uid }})</span>
        </span>
        <span class="dim">{{ f.playing ? t('friends.playing') : f.online ? t('friends.online') : t('friends.offline') }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onActivated, onMounted, ref } from 'vue';
import { api } from '../../net/api.js';
import { t } from '../../i18n/index.js';
import { toast } from '../../ui/toast.js';
import AvatarBadge from '../../ui/AvatarBadge.vue';

interface FriendItem {
  uid: number;
  nickname: string;
  avatarId: number;
  online: boolean;
  playing: string | null;
}

const searchUid = ref('');
const friends = ref<FriendItem[]>([]);
const requests = ref<{ id: number; uid: number; nickname: string; avatar_id: number }[]>([]);

async function load(): Promise<void> {
  try {
    friends.value = (await api<{ items: FriendItem[] }>('/api/v1/friends')).items;
    requests.value = (await api<{ items: typeof requests.value }>('/api/v1/friends/requests')).items;
  } catch {
    /* noop */
  }
}
onMounted(load);
onActivated(load);

async function doSearch(): Promise<void> {
  try {
    const r = await api<{ found: { uid: number; nickname: string } | null }>(`/api/v1/friends/search?uid=${searchUid.value}`);
    if (!r.found) {
      toast(t('error.ROOM_NOT_FOUND'), 'error');
      return;
    }
    await api('/api/v1/friends/request', { toUid: r.found.uid });
    toast(`${r.found.nickname} ✓`, 'success');
    searchUid.value = '';
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}

async function handle(id: number, action: string): Promise<void> {
  try {
    await api(`/api/v1/friends/requests/${id}`, { action });
    await load();
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}
</script>

<style scoped>
.panel {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.searchbar {
  display: flex;
  gap: 10px;
}
.sec {
  padding: 16px;
}
h4 {
  margin: 0 0 10px;
  font-size: 15px;
  color: var(--gold-champagne);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-top: 1px solid rgba(154, 163, 178, 0.08);
  font-size: 14px;
}
.person {
  display: flex;
  align-items: center;
  gap: 8px;
}
.acts {
  display: flex;
  gap: 8px;
}
.dim {
  color: var(--text-disabled);
  font-size: 12px;
}
.stat {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-disabled);
  margin-right: 8px;
}
.stat.on {
  background: var(--accent-jade);
  box-shadow: 0 0 6px var(--accent-jade);
}
.empty {
  color: var(--text-disabled);
  text-align: center;
  padding: 16px;
}
</style>
