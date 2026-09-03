import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './design/tokens.css';
import { hasSession, onUnauthorized } from './net/api.js';

const routes = [
  { path: '/', redirect: hasSession() ? '/lobby' : '/login' },
  { path: '/login', component: () => import('./views/LoginView.vue') },
  { path: '/lobby', component: () => import('./views/LobbyView.vue') },
  { path: '/game/mahjong', component: () => import('./games/mahjong/MahjongTableView.vue') },
  { path: '/game/hongshi', component: () => import('./games/hongshi/HongshiTableView.vue') },
  { path: '/game/fishing', component: () => import('./games/fishing/FishingView.vue') },
  { path: '/game/slot', component: () => import('./games/slot/SlotView.vue') },
  { path: '/game/roulette', component: () => import('./games/roulette/RouletteView.vue') },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to) => {
  if (to.path !== '/login' && !hasSession()) return '/login';
  return true;
});

onUnauthorized.handler = () => {
  void router.replace('/login');
};

createApp(App).use(createPinia()).use(router).mount('#app');
