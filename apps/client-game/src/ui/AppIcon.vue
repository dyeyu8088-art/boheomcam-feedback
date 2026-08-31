<template>
  <!--
    YANBIAN ENTERTAINMENT ICON SYSTEM
    统一规范：24×24 视窗 / 光源左上 45° / 线宽 1.8 / 圆角语言 2px / 金属主色香槟金
    两种族群：solid（资产与功能主图标，2.5D 金属质感） / line（导航与工具，线性）
  -->
  <svg :width="size" :height="size" viewBox="0 0 24 24" class="appicon" :class="`ic-${name}`">
    <defs>
      <linearGradient :id="g('gold')" x1="0.15" y1="0" x2="0.85" y2="1">
        <stop offset="0" stop-color="#f6e6bd" />
        <stop offset="0.45" stop-color="#d3ac6d" />
        <stop offset="1" stop-color="#8a6b3c" />
      </linearGradient>
      <linearGradient :id="g('goldDeep')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#b28c4e" />
        <stop offset="1" stop-color="#6e5426" />
      </linearGradient>
      <linearGradient :id="g('ice')" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stop-color="#d8efff" />
        <stop offset="0.5" stop-color="#7fb8e8" />
        <stop offset="1" stop-color="#35608f" />
      </linearGradient>
      <linearGradient :id="g('steel')" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stop-color="#4a566e" />
        <stop offset="1" stop-color="#232c3e" />
      </linearGradient>
      <linearGradient :id="g('jade')" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stop-color="#7fd8c4" />
        <stop offset="1" stop-color="#2f7f6e" />
      </linearGradient>
    </defs>

    <!-- ══ 资产族：金币 ══ -->
    <template v-if="name === 'coin'">
      <ellipse cx="12" cy="13.4" rx="9" ry="8.6" :fill="`url(#${g('goldDeep')})`" />
      <ellipse cx="12" cy="11.6" rx="9" ry="8.6" :fill="`url(#${g('gold')})`" />
      <ellipse cx="12" cy="11.6" rx="6.2" ry="5.9" fill="none" stroke="#8a6b3c" stroke-width="0.9" opacity="0.7" />
      <path d="M12 7.9 v7.4 M9.6 9.9 h4.8 M9.6 13.3 h4.8" stroke="#7d602e" stroke-width="1.5" stroke-linecap="round" fill="none" />
      <ellipse cx="9" cy="7.6" rx="3.2" ry="1.5" fill="#fff" opacity="0.42" transform="rotate(-26 9 7.6)" />
    </template>

    <!-- ══ 资产族：钻石 ══ -->
    <template v-else-if="name === 'gem'">
      <path d="M7.4 4.4 h9.2 l4 5.4 L12 20.6 3.4 9.8 z" :fill="`url(#${g('ice')})`" />
      <path d="M3.4 9.8 h17.2" stroke="#eaf6ff" stroke-width="0.9" opacity="0.75" />
      <path d="M7.4 4.4 L9.6 9.8 L12 20.6 M16.6 4.4 L14.4 9.8" stroke="#eaf6ff" stroke-width="0.8" opacity="0.6" fill="none" />
      <path d="M9.6 9.8 L12 20.6 L3.4 9.8 z" fill="#2f5c8c" opacity="0.35" />
      <path d="M7.4 4.4 h9.2 l-2.2 5.4 h-4.8 z" fill="#ffffff" opacity="0.28" />
    </template>

    <!-- ══ 功能族：签到（日历+金勾） ══ -->
    <template v-else-if="name === 'signin'">
      <rect x="3.4" y="6.2" width="17.2" height="14.4" rx="2.6" :fill="`url(#${g('steel')})`" />
      <rect x="3.4" y="6.2" width="17.2" height="4" rx="2.6" :fill="`url(#${g('goldDeep')})`" />
      <rect x="3.4" y="6.2" width="17.2" height="14.4" rx="2.6" fill="none" stroke="#c9a063" stroke-width="1.1" opacity="0.8" />
      <rect x="7" y="3.2" width="2.2" height="4.4" rx="1.1" :fill="`url(#${g('gold')})`" />
      <rect x="14.8" y="3.2" width="2.2" height="4.4" rx="1.1" :fill="`url(#${g('gold')})`" />
      <path d="M8.4 14.6 l2.5 2.6 4.7 -5" fill="none" :stroke="`url(#${g('gold')})`" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <!-- ══ 功能族：任务（靶心） ══ -->
    <template v-else-if="name === 'target'">
      <circle cx="12" cy="12" r="8.6" :fill="`url(#${g('steel')})`" />
      <circle cx="12" cy="12" r="8.6" fill="none" stroke="#c9a063" stroke-width="1.1" opacity="0.85" />
      <circle cx="12" cy="12" r="5.4" fill="none" :stroke="`url(#${g('gold')})`" stroke-width="1.4" />
      <circle cx="12" cy="12" r="2.4" :fill="`url(#${g('gold')})`" />
      <path d="M12 12 L19.4 6.2" stroke="#e6cfa3" stroke-width="1.5" stroke-linecap="round" />
      <path d="M17.4 4 l2.6 1.2 -0.6 2.8 -2.6 -1.2 z" :fill="`url(#${g('gold')})`" />
      <path d="M8 8.4 a5 5 0 0 1 3.4 -1.6" stroke="#fff" stroke-width="1" opacity="0.3" fill="none" stroke-linecap="round" />
    </template>

    <!-- ══ 功能族：排行榜（奖杯） ══ -->
    <template v-else-if="name === 'trophy'">
      <path d="M7.6 3.6 h8.8 v5.2 a4.4 4.4 0 0 1 -8.8 0 z" :fill="`url(#${g('gold')})`" />
      <path d="M7.6 4.8 H4.6 a3.4 3.4 0 0 0 3.6 4.4" fill="none" :stroke="`url(#${g('goldDeep')})`" stroke-width="1.6" stroke-linecap="round" />
      <path d="M16.4 4.8 h3 a3.4 3.4 0 0 1 -3.6 4.4" fill="none" :stroke="`url(#${g('goldDeep')})`" stroke-width="1.6" stroke-linecap="round" />
      <rect x="11" y="12.6" width="2" height="3" :fill="`url(#${g('goldDeep')})`" />
      <path d="M8.6 15.6 h6.8 l0.8 2.4 H7.8 z" :fill="`url(#${g('gold')})`" />
      <rect x="6.6" y="18" width="10.8" height="2.4" rx="1" :fill="`url(#${g('goldDeep')})`" />
      <path d="M9 4.6 h1.6 v4.4 a1.4 1.4 0 0 1 -1.6 -1 z" fill="#fff" opacity="0.35" />
      <path d="M12 5.6 l0.7 1.5 1.6 0.2 -1.2 1.1 0.3 1.6 -1.4 -0.8 -1.4 0.8 0.3 -1.6 -1.2 -1.1 1.6 -0.2 z" fill="#fff8e6" opacity="0.85" />
    </template>

    <!-- ══ 功能族：邮件（信封） ══ -->
    <template v-else-if="name === 'mail'">
      <rect x="2.8" y="5.6" width="18.4" height="12.8" rx="2.4" :fill="`url(#${g('steel')})`" />
      <rect x="2.8" y="5.6" width="18.4" height="12.8" rx="2.4" fill="none" stroke="#c9a063" stroke-width="1.1" opacity="0.85" />
      <path d="M3.6 7 L12 13.4 20.4 7" fill="none" :stroke="`url(#${g('gold')})`" stroke-width="1.7" stroke-linejoin="round" />
      <path d="M2.8 8 L12 15 21.2 8 v-0.6 a2 2 0 0 0 -2 -1.8 H4.8 a2 2 0 0 0 -2 1.8 z" fill="#fff" opacity="0.06" />
      <path d="M3.4 17.6 L9.4 12.4 M20.6 17.6 L14.6 12.4" stroke="#c9a063" stroke-width="0.9" opacity="0.45" />
    </template>

    <!-- ══ 功能族：公告（扩音器） ══ -->
    <template v-else-if="name === 'megaphone'">
      <path d="M4 9.6 h3.4 l8.2 -4.6 v14 l-8.2 -4.6 H4 a1.2 1.2 0 0 1 -1.2 -1.2 v-2.4 A1.2 1.2 0 0 1 4 9.6 z" :fill="`url(#${g('gold')})`" />
      <path d="M15.6 5 v14 l-2.4 -1.4 V6.4 z" :fill="`url(#${g('goldDeep')})`" />
      <path d="M18.2 9 a4 4 0 0 1 0 6" fill="none" stroke="#e6cfa3" stroke-width="1.5" stroke-linecap="round" />
      <path d="M20.4 7.2 a7 7 0 0 1 0 9.6" fill="none" stroke="#e6cfa3" stroke-width="1.2" stroke-linecap="round" opacity="0.55" />
      <path d="M7.6 14.4 l1 4.6 -2.6 0.5 -1 -5.1 z" :fill="`url(#${g('goldDeep')})`" />
    </template>

    <!-- ══ 导航族（线性，命中即金） ══ -->
    <template v-else-if="lineIcons[name]">
      <path
        v-for="(d, i) in lineIcons[name]"
        :key="i"
        :d="d"
        fill="none"
        stroke="currentColor"
        :stroke-width="stroke"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>
  </svg>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ name: string; size?: number; stroke?: number }>(), { size: 22, stroke: 1.8 });
const uid = `ic${Math.random().toString(36).slice(2, 7)}`;
const g = (k: string): string => `${uid}-${k}`;
void props;

/** 线性图标：统一线宽/圆角语言 */
const lineIcons: Record<string, string[]> = {
  hall: ['M3 10.4 L12 3.8 L21 10.4', 'M5.6 10.6 V19 M18.4 10.6 V19', 'M3.6 19 h16.8', 'M9.9 19 v-4.4 a2.1 2.1 0 0 1 4.2 0 V19', 'M8.4 7.6 h7.2'],
  gift: ['M4.6 11.4 h14.8 V19.8 H4.6 z', 'M3.6 7.9 h16.8 v3.5 H3.6 z', 'M12 7.9 V19.8', 'M12 7.7 C8.8 7.7 7.4 3.7 9.9 3.5 c1.7 -0.1 2.1 2.5 2.1 4.2 c0 -1.7 0.4 -4.3 2.1 -4.2 c2.5 0.2 1.1 4.2 -2.1 4.2'],
  scroll: ['M7.2 4 h9.6 a2 2 0 0 1 2 2 v12 a2 2 0 0 1 -2 2 H7.2 a2 2 0 0 1 -2 -2 V6 a2 2 0 0 1 2 -2 z', 'M9 9 h6', 'M9 12.4 h6', 'M9 15.8 h3.4'],
  friends: ['M9.2 11.3 a3 3 0 1 0 0 -6 a3 3 0 0 0 0 6 z', 'M3.8 19.4 c0 -3.3 2.6 -5 5.4 -5 s5.4 1.7 5.4 5', 'M15.6 11 a2.5 2.5 0 1 0 0 -5', 'M16.5 14.5 c2.3 0.3 4 1.9 4 4.4'],
  user: ['M12 11.5 a3.6 3.6 0 1 0 0 -7.2 a3.6 3.6 0 0 0 0 7.2 z', 'M5 20 c0 -4 3.4 -6 7 -6 s7 2 7 6'],
  gear: ['M12 15.1 a3.1 3.1 0 1 0 0 -6.2 a3.1 3.1 0 0 0 0 6.2 z', 'M12 3.6 v2.6 M12 17.8 v2.6 M3.6 12 h2.6 M17.8 12 h2.6', 'M6.1 6.1 l1.9 1.9 M16 16 l1.9 1.9 M17.9 6.1 l-1.9 1.9 M8 16 l-1.9 1.9'],
  back: ['M14.4 5.6 L8 12 l6.4 6.4'],
  chat: ['M4.4 5.8 h15.2 a1.4 1.4 0 0 1 1.4 1.4 v7.8 a1.4 1.4 0 0 1 -1.4 1.4 H10 l-4.5 3.6 v-3.6 H4.4 A1.4 1.4 0 0 1 3 15 V7.2 a1.4 1.4 0 0 1 1.4 -1.4 z', 'M7.8 10.9 h.01 M12 10.9 h.01 M16.2 10.9 h.01'],
  service: ['M5 13 a7 7 0 0 1 14 0', 'M4.3 13.4 h2.5 v4.4 H4.7 a1.6 1.6 0 0 1 -1.6 -1.6 v-1.6 a1.2 1.2 0 0 1 1.2 -1.2 z', 'M19.7 13.4 h-2.5 v4.4 h2.1 a1.6 1.6 0 0 0 1.6 -1.6 v-1.6 a1.2 1.2 0 0 0 -1.2 -1.2 z', 'M17.2 17.8 c0 1.8 -2.2 2.6 -4 2.6'],
};
</script>

<style scoped>
.appicon {
  display: block;
  flex-shrink: 0;
  overflow: visible;
}
</style>
