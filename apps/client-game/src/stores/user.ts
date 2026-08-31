import { defineStore } from 'pinia';
import { api, deviceId, platformType, setTokens, hasSession } from '../net/api.js';

export interface MeData {
  uid: number;
  nickname: string;
  avatarId: number;
  gender: number;
  level: number;
  vip: number;
  coins: number;
  diamonds: number;
  points: number;
  tickets: number;
  totalRounds: number;
  wins: number;
  winRate: number;
  createdAt: string;
}

export const useUserStore = defineStore('user', {
  state: () => ({
    me: null as MeData | null,
    brand: { nameZh: '延边娱乐', nameKo: '연변오락', nameEn: 'YANBIAN GAME' } as Record<string, string>,
    loggedIn: hasSession(),
  }),
  actions: {
    async guestLogin() {
      let guestKey = localStorage.getItem('guestKey');
      if (!guestKey) {
        guestKey = `guest-${crypto.randomUUID()}`;
        localStorage.setItem('guestKey', guestKey);
      }
      const data = await api<{ accessToken: string; refreshToken: string; sessionKey: string }>(
        '/api/v1/auth/guest',
        { guestKey, deviceId: deviceId(), deviceType: platformType(), appVersion: '0.1.0' },
      );
      setTokens(data);
      this.loggedIn = true;
      await this.loadMe();
    },
    async smsLogin(phone: string, code: string, password?: string) {
      const data = await api<{ accessToken: string; refreshToken: string; sessionKey: string }>(
        '/api/v1/auth/sms/login',
        { phone, code, password, deviceId: deviceId(), deviceType: platformType(), appVersion: '0.1.0' },
      );
      setTokens(data);
      this.loggedIn = true;
      await this.loadMe();
    },
    async passwordLogin(phone: string, password: string) {
      const data = await api<{ accessToken: string; refreshToken: string; sessionKey: string }>(
        '/api/v1/auth/password/login',
        { phone, password, deviceId: deviceId(), deviceType: platformType(), appVersion: '0.1.0' },
      );
      setTokens(data);
      this.loggedIn = true;
      await this.loadMe();
    },
    async loadMe() {
      this.me = await api<MeData>('/api/v1/user/me');
    },
    async loadBrand() {
      try {
        this.brand = await api<Record<string, string>>('/api/v1/config/brand');
      } catch {
        /* 默认品牌 */
      }
    },
    setBalance(coins?: number, diamonds?: number) {
      if (!this.me) return;
      if (coins !== undefined) this.me.coins = coins;
      if (diamonds !== undefined) this.me.diamonds = diamonds;
    },
    async logout() {
      try {
        await api('/api/v1/auth/logout', {});
      } catch {
        /* noop */
      }
      setTokens(null);
      this.loggedIn = false;
      this.me = null;
    },
  },
});
