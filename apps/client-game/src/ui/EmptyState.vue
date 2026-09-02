<template>
  <!--
    空状态：原创矢量纹章（长白山双峰 + 雪晶）+ 主副文案。
    比一行灰字「暂无内容」更像商业产品，也保持品牌一致性。
  -->
  <div class="empty-state">
    <svg class="es-mark" viewBox="0 0 96 96">
      <defs>
        <linearGradient :id="gid" x1="0.15" y1="0" x2="0.75" y2="1">
          <stop offset="0" stop-color="#f6e6bd" />
          <stop offset="0.5" stop-color="#c9a063" />
          <stop offset="1" stop-color="#7d5f2c" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="35" fill="none" :stroke="`url(#${gid})`" stroke-width="1.2" stroke-opacity="0.34" />
      <circle cx="48" cy="48" r="43" fill="none" :stroke="`url(#${gid})`" stroke-width="0.8" stroke-opacity="0.14" />
      <path d="M24 62 L38 40 L46 50 L56 32 L72 62 z" :fill="`url(#${gid})`" opacity="0.28" />
      <path d="M24 62 L38 40 L46 50 L56 32 L72 62" fill="none" :stroke="`url(#${gid})`" stroke-width="1.6" stroke-linejoin="round" stroke-opacity="0.6" />
      <path d="M56 32 L60 38 L64 34" fill="none" :stroke="`url(#${gid})`" stroke-width="1.4" stroke-linecap="round" stroke-opacity="0.5" />
      <circle cx="66" cy="26" r="4" fill="none" :stroke="`url(#${gid})`" stroke-width="1.4" stroke-opacity="0.45" />
      <path d="M30 70 h36" :stroke="`url(#${gid})`" stroke-width="1" stroke-linecap="round" stroke-opacity="0.3" />
    </svg>
    <div class="es-title">{{ title }}</div>
    <div v-if="hint" class="es-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; hint?: string }>();
/** 多实例并存时避免 gradient id 冲突 */
const gid = `esG${Math.random().toString(36).slice(2, 8)}`;
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 44px 20px 48px;
  text-align: center;
}
.es-mark {
  width: 84px;
  height: 84px;
  filter: drop-shadow(0 4px 14px rgba(201, 160, 99, 0.16));
}
.es-title {
  margin-top: 4px;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.06em;
}
.es-hint {
  font-size: 12.5px;
  color: var(--text-disabled);
  max-width: 320px;
  line-height: 1.6;
}
</style>
