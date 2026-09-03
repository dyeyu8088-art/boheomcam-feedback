<template>
  <el-container class="shell">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <div class="mark">延边娱乐</div>
        <div class="sub">ADMIN CONSOLE</div>
      </div>
      <el-menu :default-active="route.path" router background-color="#10151f" text-color="#9aa3b2" active-text-color="#e6cfa3">
        <el-menu-item v-for="m in menus" :key="m.path" :index="m.path">
          <span class="mi"><NavIcon :name="m.icon" /></span>{{ m.title }}
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="crumb">{{ String(route.meta.title ?? '') }}</div>
        <div class="who">
          <el-tag size="small" type="warning" effect="plain">{{ sess?.displayName }}</el-tag>
          <el-button size="small" text @click="logout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { can, session, setSession } from '../api.js';
import NavIcon from '../components/NavIcon.vue';

const route = useRoute();
const router = useRouter();
const sess = computed(() => session());

const all = [
  { path: '/dashboard', title: 'Dashboard', icon: 'dashboard', perm: 'dashboard.view' },
  { path: '/users', title: '用户管理', icon: 'users', perm: 'user.view' },
  { path: '/wallet', title: '金币流水 / 结算', icon: 'wallet', perm: 'wallet.view' },
  { path: '/rooms', title: '房间 / 战绩', icon: 'rooms', perm: 'room.view' },
  { path: '/arcade', title: '街机 / 奖池', icon: 'rooms', perm: 'record.view' },
  { path: '/configs', title: '游戏 / 配置', icon: 'configs', perm: 'config.view' },
  { path: '/ops', title: '公告 / 邮件', icon: 'ops', perm: 'announce.manage' },
  { path: '/risk', title: '风控 / 封禁', icon: 'risk', perm: 'risk.view' },
  { path: '/audit', title: '操作日志', icon: 'audit', perm: 'audit.view' },
  { path: '/admins', title: '后台账号', icon: 'admins', perm: 'admin.manage' },
];
const menus = computed(() => all.filter((m) => can(m.perm)));

function logout(): void {
  setSession(null);
  void router.replace('/login');
}
</script>

<style scoped>
.shell {
  height: 100vh;
}
.aside {
  background: #10151f;
  display: flex;
  flex-direction: column;
}
.logo {
  padding: 22px 20px 16px;
}
.mark {
  color: #e6cfa3;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.1em;
}
.sub {
  color: #5a6272;
  font-size: 10px;
  letter-spacing: 0.3em;
  margin-top: 4px;
}
.mi {
  display: inline-flex;
  align-items: center;
  margin-right: 10px;
  vertical-align: -3px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.crumb {
  font-weight: 700;
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
}
.main {
  background: #f5f6f8;
}
:deep(.el-menu) {
  border-right: none;
}
</style>
