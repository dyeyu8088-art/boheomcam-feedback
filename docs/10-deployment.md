# 部署、APK 打包与发布检查（PHASE 18/19）

## 1. 环境矩阵

| 环境 | 用途 | 编排 |
|---|---|---|
| local | 开发 | `deploy/docker-compose.yml`（仅 PG/Redis）+ `pnpm dev:*` |
| development / staging | 联调/预发 | `deploy/docker-compose.prod.yml` + `.env` |
| production | 生产 | 同 compose（单机可跑）或按服务边界迁移 K8s |

## 2. 生产部署步骤

```bash
cp .env.example .env            # 填写全部 CHANGE_ME（JWT/INTERNAL_TOKEN 用 64 位随机）
mkdir -p deploy/certs           # 放置 fullchain.pem / privkey.pem（certbot 或云证书）
docker compose -f deploy/docker-compose.prod.yml --env-file .env build
docker compose -f deploy/docker-compose.prod.yml --env-file .env run --rm api npx tsx src/migrate.ts
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d
```

- 迁移器幂等可重复执行；首次运行打印初始管理员密码（或用 `ADMIN_INIT_PASSWORD`），首登强制改密。
- 备份容器每日 02:00 自动 `pg_dump` + 账本/审计 CSV 导出，保留 30 天；每周手动跑 `deploy/backup/restore-verify.sh` 做恢复演练。
- 监控：Prometheus 抓取 `/metrics`；接 Grafana 后按 docs/09 的告警项配置 Alertmanager。
- 扩容：api 改 `deploy.replicas`；game 增加节点（`SERVER_ID`/`NODE_INDEX` 唯一，Nginx upstream 加行，ip_hash 保持粘性）。

## 3. Android APK 打包

```bash
cd apps/client-game
pnpm build
pnpm add -D @capacitor/cli @capacitor/core @capacitor/android
npx cap add android
npx cap sync android
cd android && ./gradlew assembleRelease
```

发布清单：
- [ ] 正式签名 keystore（勿入 Git；CI 用 secret 注入），versionCode/versionName 递增
- [ ] `VITE_API_BASE` / `VITE_WS_BASE` 指向生产域名（HTTPS/WSS）
- [ ] 强更/可选更：客户端启动读 `games.min_client_version` + 品牌配置（低于强更版本弹更新页）
- [ ] 隐私政策 / 用户协议页面链接；权限声明（网络）
- [ ] 崩溃收集（Sentry 等）与性能监控接入
- [ ] 商店合规：虚拟娱乐资产声明、无现金交易、目标市场分级政策核对

### 3.1 内测 APK（不需要 Android SDK / Gradle，调试签名，仅内部测试）

```bash
pnpm --filter @yanbian/client-game build      # 生成 apps/client-game/dist
python3 -m pip install pyaxml androguard       # androguard 只用于回读校验，可省略
python3 tools/apk/build-test-apk.py           # → build/yanbian-test.apk（约 6 MB）
```

- 原理：`tools/apk/src` 的 WebView 壳 + 内嵌 NanoHTTPD（127.0.0.1 随机端口）提供 `assets/www`（即 dist），页面以正常 http 源运行，
  localStorage / ES module / fetch / WebSocket 行为与浏览器一致。依赖（Robolectric android-all 作编译用 android.jar、dalvik-dx、NanoHTTPD）
  只从 Maven Central 下载到 `build/apk-cache`，不访问谷歌仓库；需要 JDK 11+（javac / keytool / jarsigner）与 python3
- 服务器地址在运行时填写：登录页「服务器设置」→ `http://<开发机IP>:5173`（`pnpm dev:client` 已 `--host` 监听局域网，
  自带 `/api`、`/ws` 代理并对跨源请求返回 CORS 头）或正式 `https://域名`（Nginx 同时反代 REST 与 WS）；
  H5 也可用 `?server=http://host:port` 链接一次性写入。壳的 UA 含 `YanbianGameApp/`，未设置地址时登录页会高亮提示
- 与正式包的差异（内测可接受，商店发布不可）：v1 调试签名（targetSdk 28，Android 7.0+ 可安装，不含 v2/v3 签名）、无图标 / 启动页、
  允许明文 HTTP、开启 WebView 远程调试（chrome://inspect）、`applicationId` 为 `com.yanbiangame.app`；正式发布仍走上面的 Capacitor 流程

## 4. Web 兼容目标

Chrome / Edge / Android Chrome / Samsung Browser 最近两个大版本；Safari 16+（backdrop-filter/WS 均可用，发布前真机核）。

## 5. RELEASE CANDIDATE 检查表（全部勾选才可标记 RC）

**功能**
- [x] 账号注册/登录/刷新/踢线（自动化通过）
- [x] 大厅/签到/任务/邮件/公告/排行/好友（API+UI 冒烟通过）
- [x] 延边麻将完整一局（E2E：4 客户端整局+结算+回放）
- [x] 红十完整一局（E2E）
- [x] 捕鱼可玩 + 防作弊路径（E2E）
- [x] 水果机可玩 + 幂等（E2E + UI）
- [x] 断线重连恢复（E2E：快照含手牌、不泄露他人手牌）
- [x] 虚拟资产结算正确（并发/幂等/防重复/借贷平衡 7 项集成测试）
- [x] 后台可管理（登录/改密/用户/调账/配置/审计 UI 冒烟）
- [x] 数据库备份脚本 + 恢复演练脚本
- [x] 结构化日志 + /metrics
**待真实环境执行**
- [ ] 域名/证书/HTTPS/WSS 上线核验
- [ ] APK 真机安装与 30 分钟捕鱼内存曲线
- [ ] 1k/5k/10k 阶梯压测报告（tests/load-ws.mjs + 独立压力机）
- [ ] 《延边麻将规则确认表》《红十规则确认表》全部 ⏳ 项由当地规则顾问确认并发布正式规则包
- [ ] 美术资源替换程序化占位（按设计系统 Token 交付）
- [ ] 短信网关接入（当前生产模式不回显验证码，仅日志）
- [ ] 第三方渗透测试

## 6. Git 规范

main（生产）/ develop（集成）/ feature/* / release/* / hotfix/*。`.env`、证书、私钥、keystore 永不入库（.gitignore 已覆盖）；密钥轮换走部署平台 Secret。
