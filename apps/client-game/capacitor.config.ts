/**
 * Capacitor Android 壳配置。
 * 打 APK：pnpm build && npx cap add android && npx cap sync android && cd android && ./gradlew assembleRelease
 * 说明见 docs/10-deployment.md（签名/版本号/强更策略）。
 */
// 类型来自 @capacitor/cli（打包 APK 时安装：pnpm add -D @capacitor/cli @capacitor/core @capacitor/android）
interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  backgroundColor?: string;
  android?: { allowMixedContent?: boolean };
  server?: { androidScheme?: string };
}

const config: CapacitorConfig = {
  appId: 'com.yanbiangame.app',
  appName: '延边娱乐',
  webDir: 'dist',
  backgroundColor: '#0A0E14',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
