<template>
  <!--
    后台导航图标（原创线性矢量，零 Emoji）
    统一规范：24×24 视窗 / 线宽 1.7 / 端点 round / 与游戏端 AppIcon 同一套语言
  -->
  <svg viewBox="0 0 24 24" class="navicon" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <!-- 仪表盘 -->
    <template v-if="name === 'dashboard'">
      <rect x="3" y="3" width="7.5" height="8.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="1.6" />
      <rect x="3" y="14.5" width="7.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="1.6" />
    </template>
    <!-- 用户 -->
    <template v-else-if="name === 'users'">
      <circle cx="9.2" cy="8.4" r="3.4" />
      <path d="M3.2 20c.5-3.4 3-5.4 6-5.4s5.5 2 6 5.4" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 6" />
      <path d="M17.6 14.9c1.9.6 3.1 2.4 3.4 5.1" />
    </template>
    <!-- 钱包 / 流水 -->
    <template v-else-if="name === 'wallet'">
      <rect x="3" y="6" width="18" height="13" rx="2.6" />
      <path d="M3 10h18" />
      <circle cx="16.6" cy="14.4" r="1.5" />
      <path d="M6.8 3.4 16 6" />
    </template>
    <!-- 房间 / 战绩 -->
    <template v-else-if="name === 'rooms'">
      <rect x="8.4" y="3.6" width="11" height="15" rx="2.2" />
      <path d="M12.6 8.6h3.4M12.6 12h4.6M12.6 15.4h3" />
      <path d="M5.6 6.4v13.2a1.8 1.8 0 0 0 1.8 1.8h8.2" />
    </template>
    <!-- 配置 -->
    <template v-else-if="name === 'configs'">
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.6v2.6M12 18.8v2.6M4.35 7.3l2.25 1.3M17.4 15.4l2.25 1.3M4.35 16.7l2.25-1.3M17.4 8.6l2.25-1.3" />
    </template>
    <!-- 公告 / 邮件 -->
    <template v-else-if="name === 'ops'">
      <path d="M4 9.4v5.2a1.6 1.6 0 0 0 1.6 1.6h1.8L14 20.4V3.6L7.4 7.8H5.6A1.6 1.6 0 0 0 4 9.4z" />
      <path d="M17.4 8.6a4.6 4.6 0 0 1 0 6.8" />
      <path d="M19.8 6a8 8 0 0 1 0 12" />
    </template>
    <!-- 风控 / 封禁 -->
    <template v-else-if="name === 'risk'">
      <path d="M12 2.8 4.6 6v6.1c0 4.4 3 7.7 7.4 9.1 4.4-1.4 7.4-4.7 7.4-9.1V6z" />
      <path d="M9.4 12.2 11.4 14.3 15 10.4" />
    </template>
    <!-- 审计日志 -->
    <template v-else-if="name === 'audit'">
      <path d="M6.4 3.4h8.4l4.2 4.2v13a1.6 1.6 0 0 1-1.6 1.6H6.4a1.6 1.6 0 0 1-1.6-1.6V5a1.6 1.6 0 0 1 1.6-1.6z" />
      <path d="M14.4 3.4v4.4h4.4" />
      <path d="M8.2 12.4h7.2M8.2 16h5.2" />
    </template>
    <!-- 后台账号 -->
    <template v-else>
      <rect x="4.4" y="10.2" width="15.2" height="10.4" rx="2.2" />
      <path d="M8.2 10.2V7.6a3.8 3.8 0 0 1 7.6 0v2.6" />
      <circle cx="12" cy="15.4" r="1.5" />
    </template>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: string }>();
</script>

<style scoped>
.navicon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
</style>
