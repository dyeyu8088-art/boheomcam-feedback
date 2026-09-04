import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // 生产经网关挂在 /admin/ 下（Dockerfile.web 传 BASE=/admin/）；本地 dev 仍为 /
  base: process.env.VITE_BASE ?? '/',
  plugins: [vue()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
  },
});
