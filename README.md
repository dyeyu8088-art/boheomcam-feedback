# YANBIAN GAME / 延边娱乐 — 综合在线棋牌游戏平台

> 商业级多端游戏平台：**延边麻将 · 红十 · 捕鱼 · 黄金水果（水果机）· 幸运轮盘 · 股市风云（模拟行情）**
> 同一账号覆盖 Android APK / 手机 H5 / PC Web，另含 Web 运营管理后台。
> 品牌名称/LOGO/主色后台可配置（白标能力）。
>
> **资产合规原则**：平台内金币/钻石/积分/奖券均为游戏内**虚拟娱乐资产**，不可兑换人民币、不可提现、不可用于真实货币赌博。任何涉真实货币功能须先完成法律/牌照/KYC/AML/支付合规审查后单独立项，本仓库不包含任何现金出入金功能。

## 技术栈

| 层 | 选型 |
|---|---|
| 游戏客户端 | Vue 3 + TypeScript + Pixi.js 8（WebGL）+ Capacitor（Android APK 壳） |
| 管理后台 | Vue 3 + Element Plus + ECharts |
| 服务端 | Node.js 22 + TypeScript + Fastify + ws（模块化服务群，按角色水平扩展） |
| 数据 | PostgreSQL 16（账本/战绩/审计）+ Redis 7（会话/限流/匹配/榜单） |
| 部署 | Docker Compose + Nginx（HTTPS/WSS）+ pg_dump 自动备份 + Prometheus 指标 |

选型论证与架构图见 [docs/01-architecture.md](docs/01-architecture.md)。

## 仓库结构

```
apps/client-game     游戏客户端（H5/PC/APK 同源）
apps/admin-web       运营管理后台
services/api         无状态服务群（auth/user/wallet/admin/activity/…，SERVICE_ROLES 装载）
services/game        有状态游戏服务群（ws网关/房间/麻将/红十/捕鱼/水果机/结算/风控）
packages/protocol    三端共享协议/事件/错误码/DTO
packages/game-common 游戏通用库（牌库/RNG/状态机/规则配置 Schema/回放）
database/migrations  PostgreSQL 迁移（唯一 Schema 权威）
database/seeds       种子数据（游戏登记/默认规则包/RBAC/管理员）
deploy/              docker-compose / nginx / 备份 / 监控
docs/                架构、数据库、协议、规则确认表、安全、设计系统、路线图
tests/               跨服务集成与专项测试
scripts/             工具脚本（RTP 模拟、压测、造数）
```

## 快速开始（开发环境）

```bash
pnpm install
docker compose -f deploy/docker-compose.yml up -d postgres redis   # 基础设施
pnpm migrate                    # 建库+种子；首次运行会打印初始管理员(admin)密码，首登强制改密
pnpm dev:api                    # REST 服务群 :8080
pnpm dev:game                   # 游戏服务群(WS) :8090
pnpm dev:client                 # 游戏客户端 :5173（H5/PC，--host 监听局域网；APK 打包见 docs/10-deployment.md）
pnpm dev:admin                  # 管理后台 :5174
pnpm dev:all                    # 以上一键全部拉起（含 PG/Redis + 迁移），并打印手机 APK 要填的局域网地址
```

没有服务器？任意一台 Linux 云主机（2 vCPU / 2 GB，放行 TCP 80）一条命令起内测服务器（HTTP，无域名）：

```bash
git clone <仓库地址> yanbian && cd yanbian && bash deploy/install-test-server.sh   # 结束时打印 APK 要填的 http://<主机IP> 与后台初始密码
```

## 测试体系（当前全绿）

```bash
pnpm --filter @yanbian/game-common test    # 引擎单元测试 39 项（含模糊测试/RTP 收敛/确定性回放）
pnpm --filter @yanbian/api-service test    # 钱包集成测试 7 项（并发100扣款/幂等/防重复结算/触发器防篡改）
node tests/e2e-smoke.mjs                   # 全栈 E2E 55 项（四游戏整局/防作弊路径/断线重连）
node tests/ui-smoke.mjs                    # 客户端浏览器冒烟 10 项（Playwright；BASE_URL=http://<内测主机> 可对网关跑）
node tests/admin-ui-smoke.mjs              # 后台浏览器冒烟 9 项（需 ADMIN_PASSWORD）
node tests/lobby-shot.mjs                  # 大厅四分辨率截图回归（1920/2560/Android 横屏/手机竖屏）
node tests/table-shot.mjs                  # 麻将/红十牌桌截图回归（1920×1080 / 960×540@2x）
node tests/fishing-shot.mjs                # 捕鱼截图回归（开火 + 技能）
node tests/slot-shot.mjs                   # 水果机截图回归（待机 / 转动中 / 停轮）
node tests/settle-shot.mjs                 # 麻将/红十 喊话 · 胡牌爆字 · 结算面板截图（ONLY=mahjong WANT_FX=1 MAX_MS=900000）
node tests/roulette-shot.mjs               # 轮盘截图回归（放筹码 / 确认 / 转盘 / 派彩；SIZE=pc|land）
node tests/stock-shot.mjs                  # 股票涨跌截图回归（下注 / 走势图 / 结算面板；SIZE=pc|land）
node tests/load-ws.mjs 500 0.1             # WS 负载（本机阶梯；生产压测见 docs/09）
```

内测 APK（WebView 壳，不需要 Android SDK；服务器地址在登录页「服务器设置」运行时填写，如 `http://<开发机IP>:5173`）：

```bash
pnpm --filter @yanbian/client-game build && python3 tools/apk/build-test-apk.py   # → build/yanbian-test.apk
```

生产部署 / APK 打包（正式 Capacitor 流程与内测壳 §3.1）/ RELEASE 检查表：见 [docs/10-deployment.md](docs/10-deployment.md)。
VPS 快速上手（韩文：服务商选择 / 端口放行 / 源码包上传 / APK 填地址）：[docs/11-vps-quickstart.md](docs/11-vps-quickstart.md)；源码包：`bash tools/pack-server.sh`。

## 核心文档

- [PHASE 0 竞品研究](COMPETITOR_ANALYSIS.md) ｜ [路线图 PHASE 0–19](docs/08-roadmap.md)
- [总体架构](docs/01-architecture.md) ｜ [数据库](docs/02-database.md) ｜ [通信协议](docs/03-protocol.md)
- [钱包账本](docs/04-wallet.md) ｜ [安全与防作弊](docs/06-security.md) ｜ [设计系统](docs/07-design-system.md)
- [大厅视觉规范](docs/11-lobby-design.md)（Design Token / Icon / 游戏卡 / 动效 / 多分辨率适配）
- [第三方开源素材清单](THIRD_PARTY_ASSETS.md)（麻将牌面 CC0 / 扑克牌公共领域 / 四款 OFL 字体，含许可证与复现命令）
- 规则确认表：[延边麻将](docs/05-game-rules/yanbian-mahjong-rules-confirmation.md) ｜ [红十](docs/05-game-rules/hongshi-rules-confirmation.md)
- 游戏架构：[捕鱼](docs/05-game-rules/fishing-architecture.md) ｜ [水果机](docs/05-game-rules/slots-architecture.md)

## 工程纪律

- 服务端权威：胡牌/结果/结算/余额一律服务端判定，客户端纯表现。
- 规则配置化：地区差异规则不硬编码，走规则包版本（rule_version）+ 对局快照。
- 账本不可篡改：交易/分录/调账只增不改，触发器拒绝 UPDATE/DELETE。
- 每 PHASE：Build → Run → Test → Review → 修复 → 复测 → 更新 README/CHANGELOG。
- 素材合规：只接入许可证允许商业使用的开源素材（CC0 / 公共领域 / OFL），许可证文件随素材入库并登记到
  [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md)；禁止竞品 APK 提取资源、商标、Logo、受版权保护的音乐 / 美术。
