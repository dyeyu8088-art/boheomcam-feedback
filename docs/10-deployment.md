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

更新版本：`git pull && docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build`；网关经 Docker DNS 动态解析上游，容器重建后无需重启 nginx。

- 迁移器幂等可重复执行；首次运行打印初始管理员密码（或用 `ADMIN_INIT_PASSWORD`），首登强制改密。
- 备份容器每日 02:00 自动 `pg_dump` + 账本/审计 CSV 导出，保留 30 天；每周手动跑 `deploy/backup/restore-verify.sh` 做恢复演练。
- 监控：Prometheus 抓取 `/metrics`；接 Grafana 后按 docs/09 的告警项配置 Alertmanager。
- 扩容：api 改 `deploy.replicas`；game 增加节点（`SERVER_ID`/`NODE_INDEX` 唯一，Nginx upstream 加行，ip_hash 保持粘性）。

## 2.1 内测服务器：任意 Linux 主机一条命令（HTTP，无域名 / 无证书）

没有域名和证书、只想让 APK / H5 连上来测试时，用这条路径。一台 2 vCPU / 2 GB 的云主机（安全组放行 TCP 80）即可：

```bash
git clone <仓库地址> yanbian && cd yanbian
bash deploy/install-test-server.sh
```

脚本做的事：缺 Docker 时安装 → 生成 `.env`（随机数据库 / Redis 密码、JWT / 内部令牌、后台初始密码；不入 Git）→
`deploy/docker-compose.test.yml` 构建 api / game / client-web / admin-web 镜像 → 建库迁移 → 启动 → 打印：

```
 APK / H5 登录页「服务器设置」填:  http://<主机IP>
 管理后台:                        http://<主机IP>/admin/   账号 admin   初始密码: …（首登强制改密）
```

- 与生产编排的差别：nginx 只监听 80（`deploy/nginx/gateway-http.conf`），api 单副本，没有备份 / 监控 / WAL 归档；
  流量是 HTTP 明文，只能用于内部测试，对外正式发布回到 §2
- 重复执行安全（`.env` 保留、迁移幂等、镜像增量构建）；更新代码后 `git pull && bash deploy/install-test-server.sh`
- 换端口：`.env` 里 `HTTP_PORT=8080`，APK 里填 `http://<主机IP>:8080`
- 国内主机：拉取基础镜像超时先配置 Docker 镜像加速（`/etc/docker/daemon.json` 的 `registry-mirrors`）；
  `pnpm install` 慢则在 `.env` 加 `NPM_REGISTRY=https://registry.npmmirror.com` 后重跑脚本
- 只有一台 Windows / macOS 电脑、没有云主机：手机与电脑连同一 Wi-Fi，电脑上 `pnpm dev:all`（见 §3.1），APK 填打印出的 `http://<电脑IP>:5173`

## 2.2 单容器一体化镜像（托管平台一键部署：Railway / Render / Fly.io / Manufact 等）

只提供「一个容器 + 一个端口 + 一个域名」的托管平台，用 根目录 `Dockerfile`：一个镜像内含 PostgreSQL 16、Redis 7、
api-service、game-service 与 Node 边缘（静态文件 + `/api` 反代 + `/ws` 升级转发，`deploy/allinone/edge.mjs`）。

```bash
docker build -t yanbian-allinone .
docker run -d --name yanbian -p 80:80 -v yanbian-data:/data yanbian-allinone
docker logs yanbian | grep 首次登录密码          # 后台初始密码（也持久化在 /data/secrets.env）
```

- 平台注入 `PORT` 即监听该端口；`ADMIN_INIT_PASSWORD` / `JWT_SECRET` / `INTERNAL_TOKEN` 可作为环境变量传入，缺省自动生成并持久化到 `/data/secrets.env`
- `/data` 挂卷即持久化（PG 数据 + Redis AOF + 密钥）；不挂卷则容器重建后清空（仅适合短期内测）
- 仓库根目录已带 `railway.json`（Railway 直接识别 Dockerfile 路径）与 `render.yaml`（Render Blueprint，含 5 GB 持久盘）；
  Fly.io：`fly launch` 后挂卷到 `/data`
- 平台通常自带 HTTPS 域名，APK「服务器设置」直接填 `https://<域名>`（WebSocket 自动走 wss）
- 运行时基础镜像为 `postgres:16-alpine`，Node / Redis 二进制从同版本 Alpine 官方镜像拷入，构建不依赖 apk 仓库；
  单容器无水平扩展、无独立备份 / 监控，用户量上来后迁移到 §2 的 compose / K8s 拓扑（`pg_dump` 导出 `/data` 即可迁移）


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
python3 tools/apk/build-test-apk.py           # → build/yanbian-test.apk（约 6 MB；登录页手填服务器地址）
python3 tools/apk/build-test-apk.py --server https://你的地址   # 先以 VITE_SERVER_BASE 重新 vite build，APK 内置地址，分发给测试者装上即连
```

- 原理：`tools/apk/src` 的 WebView 壳 + 内嵌 NanoHTTPD（127.0.0.1 随机端口）提供 `assets/www`（即 dist），页面以正常 http 源运行，
  localStorage / ES module / fetch / WebSocket 行为与浏览器一致。依赖（Robolectric android-all 作编译用 android.jar、dalvik-dx、NanoHTTPD）
  只从 Maven Central 下载到 `build/apk-cache`，不访问谷歌仓库；需要 JDK 11+（javac / keytool / jarsigner）与 python3
- 服务器地址在运行时填写：登录页「服务器设置」→ 内测主机 `http://<主机IP>`（§2.1 一条命令部署）、
  或同一 Wi-Fi 的开发电脑 `http://<电脑IP>:5173`（电脑上 `pnpm dev:all` 一键拉起 PG / Redis / api / game / client / admin 并打印该地址；
  Vite 已 `--host` 监听局域网，自带 `/api`、`/ws` 代理并对跨源请求返回 CORS 头）、或正式 `https://域名`（Nginx 同时反代 REST 与 WS）；
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
