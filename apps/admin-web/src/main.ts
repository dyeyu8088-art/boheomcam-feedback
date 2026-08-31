import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import App from './App.vue';
import { session } from './api.js';

const routes = [
  { path: '/login', component: () => import('./views/AdminLogin.vue') },
  {
    path: '/',
    component: () => import('./views/Shell.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: () => import('./views/DashboardPage.vue'), meta: { perm: 'dashboard.view', title: 'Dashboard' } },
      { path: 'users', component: () => import('./views/UsersPage.vue'), meta: { perm: 'user.view', title: '用户管理' } },
      { path: 'wallet', component: () => import('./views/WalletPage.vue'), meta: { perm: 'wallet.view', title: '金币流水' } },
      { path: 'rooms', component: () => import('./views/RoomsPage.vue'), meta: { perm: 'room.view', title: '房间/战绩' } },
      { path: 'configs', component: () => import('./views/ConfigsPage.vue'), meta: { perm: 'config.view', title: '游戏配置' } },
      { path: 'ops', component: () => import('./views/OpsPage.vue'), meta: { perm: 'announce.manage', title: '公告/邮件' } },
      { path: 'risk', component: () => import('./views/RiskPage.vue'), meta: { perm: 'risk.view', title: '风控' } },
      { path: 'audit', component: () => import('./views/AuditPage.vue'), meta: { perm: 'audit.view', title: '操作日志' } },
      { path: 'admins', component: () => import('./views/AdminsPage.vue'), meta: { perm: 'admin.manage', title: '后台账号' } },
    ],
  },
];

const router = createRouter({ history: createWebHashHistory(), routes });
router.beforeEach((to) => {
  if (to.path !== '/login' && !session()) return '/login';
  return true;
});

createApp(App).use(router).use(ElementPlus, { locale: zhCn }).mount('#app');
