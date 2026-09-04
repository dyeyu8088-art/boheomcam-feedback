# PROJECT_ANALYSIS — 新版美术接入前的项目扫描

> 扫描日期：2026-09-03 · 分支 `claude/card-game-platform-6mab1f` · 基线提交 `60a6193`
> 目的：在不破坏现有后端、数据库和游戏逻辑的前提下接入新版美术，并补齐缺失玩法。
> 结论先行：**沿用现有技术栈**（Vue 3 + Pixi 8 / Fastify + ws / PostgreSQL + Redis），只替换表现层；轮盘与股票玩法作为新模块补充，复用现有钱包、结算、房间、协议基础设施。

---

## 1. 技术栈

| 层 | 选型 | 版本 / 说明 |
| --- | --- | --- |
| 包管理 | pnpm workspaces | `packages/*`、`services/*`、`apps/*`；Node ≥ 20（Docker 用 node:22） |
| 语言 | TypeScript 5.6 | 后端不编译，Docker 直接 `tsx src/main.ts` |
| 游戏客户端 | Vue 3.5 + Vue Router 4 + Pinia 2 + Vite 5 | `apps/client-game`，Hash 路由 |
| 游戏引擎（Canvas） | Pixi.js 8.x | 仅捕鱼与水果机使用；麻将 / 红十为 DOM + CSS |
| 管理后台 | Vue 3 + Element Plus 2.8 + ECharts 5 | `apps/admin-web` |
| API 服务 | Fastify 5 + @fastify/cors | `services/api`，统一 `{code,msg,data}` 信封 |
| 实时服务 | ws 8 | `services/game`，路径 `/ws?token=`，JWT 鉴权 |
| 数据库 | PostgreSQL 16 | 5 个迁移文件，分区表 + 不可变触发器 |
| 缓存 / 总线 | Redis 7 (ioredis) | 在线状态、排行榜 ZSET、限流、跨节点 bus |
| 协议 | `@yanbian/protocol` | `Ev` 事件常量（63 个）、`WsUp/WsDown` 信封、47 个错误码 |
| 游戏规则共享包 | `@yanbian/game-common` | 麻将 / 红十 / 捕鱼 / 水果机 引擎，服务端与客户端共用 |
| 钱包 | `@yanbian/wallet` | 双式记账、幂等键、结算 docket |
| 测试 | vitest + Playwright + 自研 e2e | 39 单测 + 7 钱包集成 + 28 E2E + 8 客户端 UI + 8 后台 UI |
| 部署 | Docker Compose + Nginx + Prometheus | `deploy/`；APK 走 Capacitor（`capacitor.config.ts` 已在，依赖按 docs/10 安装） |
| 设计系统 | `src/design/tokens.css`（38 个 CSS 变量）+ `fonts.css`（4 款 OFL 字体） | 「玄夜鎏金」v2 |

**Lint**：仓库没有 ESLint / Prettier，类型检查即 lint（`vue-tsc --noEmit` / `tsc --noEmit`）。

---

## 2. 目录结构

```
apps/
  client-game/           游戏客户端（H5 / PC Web / APK）
    src/design/          tokens.css · fonts.css
    src/games/           fishing/ · slot/ · mahjong/ · hongshi/ · TableSurface.vue · useGameRoom.ts
    src/views/           LoginView · LobbyView · lobby/{GameGrid,GameCardArt,LobbyBackdrop,ActivityPanel,RecordsPanel,FriendsPanel,MePanel,FeatureModals}
    src/ui/              AppIcon · AvatarBadge · EmptyState · ModalSheet · toast · format
    src/net/             api.ts（REST + 单飞刷新）· ws.ts（GameSocket：seq / requestId 幂等 / 心跳 / 重连 / resync）
    src/stores/user.ts   唯一 Pinia store
    src/i18n/            zh.ts · ko.ts（各 190 key）
    src/assets/          manifest.gen.ts（本次新增，自动生成）· assets.ts（资源管理器）
    public/assets/       新版素材树（见 §8）· assets-manifest.json
    public/fonts/        4 款子集字体 + OFL
  admin-web/             管理后台（10 个页面，RBAC 权限过滤）
packages/
  protocol/              events.ts · types.ts · errors.ts
  game-common/           mahjong/ · hongshi/ · fishing/ · slot/ · rng.ts（WebCrypto 拒绝采样）
  server-core/           env · db · redis · logger · ids · crypto · ratelimit · bus · metrics
  wallet/                postTransaction · postSettlement · getBalances
services/
  api/src/modules/       auth · user · wallet · config · activity · social · admin
  game/src/              gateway.ts · hub.ts · room.ts · matchmaker.ts · settlement.ts · configs.ts · hosts/{mahjong,hongshi,fishing,slot}Host.ts
database/migrations/     001_users · 002_wallet · 003_games · 004_social · 005_admin
database/seeds/          001_static.sql（游戏、角色、权限、任务、签到活动、公告）
deploy/                  Dockerfile.* · docker-compose(.prod).yml · nginx/ · backup/ · prometheus/
docs/                    01–11 + 05-game-rules/（规则确认表、捕鱼 / 水果机架构）
tests/                   e2e-smoke · ui-smoke · admin-ui-smoke · load-ws · lobby-shot · panel-shot · table-shot
tools/assets/            build-manifest.mjs（本次新增）
```

---

## 3. 当前功能（已存在，只换皮不重写）

| 功能 | 状态 | 关键文件 |
| --- | --- | --- |
| 捕鱼 | ✅ 完整：11 种鱼、2 个场次、9 条路径、4 个波次模板、先扣费后判定、RTP 控制器、风控 | `game-common/src/fishing/*`、`hosts/fishingHost.ts`、`games/fishing/FishingView.vue` |
| 水果机 | ✅ 完整：5×3、20 线、10 符号、Scatter 免费旋转、可审计 RNG、单事务扣费 / 派奖 | `game-common/src/slot/*`、`hosts/slotHost.ts`、`games/slot/SlotView.vue` |
| 延边麻将 | ✅ 完整：规则包 `yanbian_2026_01.draft`（配置化，待确认）、吃碰杠胡优先级、听牌、托管、破产保护 | `game-common/src/mahjong/*`、`hosts/mahjongHost.ts`、`games/mahjong/*` |
| 延边红十 | ✅ 完整：规则包 `hongshi_2026_01.draft`、♥10/♦10 身份牌、组合判定、提示、托管 | `game-common/src/hongshi/*`、`hosts/hongshiHost.ts`、`games/hongshi/*` |
| 大厅 | ✅ 四游戏海报卡、签到 / 任务 / 排行 / 邮件 / 公告、五个 Dock 面板 | `views/LobbyView.vue`、`views/lobby/*` |
| 用户系统 | ✅ 游客 / 手机密码 / 短信登录（短信网关为占位）、JWT + 轮换刷新、设备、单点登录踢下线 | `modules/auth/*`、`modules/user/*` |
| 金币 / 钻石 | ✅ 4 币种账户、双式记账、幂等键、不可变触发器、管理员调账二次审批 | `packages/wallet`、`002_wallet.sql` |
| 结算 | ✅ `postSettlement`（round_id + settle_type 唯一）、`persistRoundEnd`、麻将破产保护 | `services/game/src/settlement.ts` |
| 邮件 | ✅ 收件 / 已读 / 领取附件、后台群发 | `modules/social/routes.ts`、`FeatureModals.vue` |
| 排行榜 | ✅ 金币榜（SQL）、日胜场 / 日捕鱼（Redis ZSET） | 同上 |
| 任务 | ✅ 日 / 周任务、进度 bump、领取 | `modules/activity/*`、`settlement.ts#bumpTask` |
| 签到 | ✅ 7 日阶梯 | `ActivityPanel.vue` |
| 公告 | ✅ 双语公告、后台发布 / 下线 | `FeatureModals.vue`、admin `OpsPage.vue` |
| 好友 | ✅ 搜索 / 申请 / 同意 / 删除、在线状态 | `FriendsPanel.vue` |
| 游戏记录 | ✅ 回合 / 动作流 / 每人结果、回放 | `RecordsPanel.vue`、admin `RoomsPage.vue` |
| 管理后台 | ✅ 仪表盘、用户、钱包、房间、配置、运营、风控、审计、管理员 | `apps/admin-web/src/views/*` |
| 断线重连 | ✅ `sys.hello{resume,snapshot}` + `pushSeq` 缺口重同步；房间内 120 s 保座 | `gateway.ts`、`hub.ts`、`net/ws.ts` |

---

## 4. 缺失功能（需要补充）

| 功能 | 现状 | 本次方案 |
| --- | --- | --- |
| 轮盘 Roulette | ❌ 全库无 | 新增 `game-common/src/roulette/`（0–36、赔率表、可审计 RNG）+ `hosts/rouletteHost.ts`（房间制回合：下注 → 锁盘 → 开奖 → 派奖）+ `games/roulette/RouletteView.vue`；结算走 `postSettlement`，记录进 `game_rounds/game_results` |
| 股票涨跌玩法 | ❌ 全库无 | 新增 `game-common/src/stock/`（`MarketDataProvider` 接口 + 服务端模拟行情 GBM）+ `hosts/stockHost.ts`（回合：开盘 → 倒计时 → 锁盘 → 结算 UP/DOWN/HIGHER/LOWER/首位数/尾数/区间）+ `games/stock/StockView.vue`（Canvas 走势图）。**虚拟品种，不使用真实商标**；素材里的 Apple/Tesla/MSFT/BTC/ETH Logo 不接入 |
| 水果机 Jackpot 四档 | ❌ 文档标注二期 | 新增 `slot_jackpots` 表（GRAND/MAJOR/MINOR/MINI 池，按投注比例注入，服务端触发）+ `slot.jackpot` 推送；后台可见 |
| 捕鱼技能 / Boss 血量 / 锁定 | ❌ 无技能、无 HP | 引擎新增技能（闪电 / 导弹 / 激光 / 核弹 / 冰冻 / 锁定）：拥有 → 冷却 → 服务端判定 → 奖励；Boss 增加 HP（累计伤害到 0 才死），`fishing.bossHp` 推送 |
| VIP 体系 | ⚠ 仅字段 | 新增 `vip_levels` 配置（等级阈值 / 特权描述）+ 经验推进（投注累计）+ `GET /api/v1/vip`；大厅显示等级与进度 |
| 背包 | ❌ | 新增 `user_items`（道具：技能卡 / 免费旋转券 / 头像框）+ `GET /api/v1/inventory`；捕鱼技能消耗背包道具或金币 |
| 商城 | ❌ | 新增 `shop_products` + `POST /api/v1/shop/purchase`（**钻石 ↔ 道具 / 金币，虚拟资产内部兑换，无充值**） |
| 比赛 / 赛事 | ❌ | 新增 `tournaments` + 报名 / 排名（纯荣誉，奖励为虚拟资产），`GET /api/v1/tournaments` |
| 充值 | ❌ 设计上不做 | 保持不做；素材中的 TOP-UP / CASHBACK 元素只作"福利 / 返利"语义使用 |
| 统一结算服务 | ⚠ 分散在各 host | 抽出 `GameSettlementService.settle({gameType,userId,roundId,bet,result,payout})`，内部复用 `postSettlement` + `game_results`，六游戏统一入口 |
| 音效 | ❌ 无 AudioManager | 新增 `src/audio/AudioManager.ts`（BGM / SFX / Voice、开关与音量、切换游戏释放） |
| 公共 UI 组件库 | ⚠ 只有 4 个基础组件 | 新增 GameButton / CurrencyBar / PlayerProfile / VipBadge / JackpotBar / BetChip / GamePopup / Countdown / RewardAnimation / GameNavbar / LoadingScreen |
| 资源管理 | ❌ 路径散落硬编码 | `assets-manifest.json` + `src/assets/assets.ts`（类型安全 key、预加载、Pixi 纹理缓存、退出释放） |
| 登录任务计数 | ⚠ `daily_login` 无人 bump | 登录成功后 bump `login` 指标 |
| 全局邮件 | ⚠ `to_user=0` 未实现 | 补 `mail_reads` 表 |

---

## 5. 现有 API（REST）

**客户端 `/api/v1`**：
`POST auth/guest` · `auth/sms/send` · `auth/sms/login` · `auth/password/login` · `auth/refresh` · `auth/logout`
`GET user/me` · `POST user/profile` · `GET user/records` · `user/records/:roundId` · `user/records/:roundId/replay` · `user/devices`
`GET wallet/balances` · `wallet/transactions`
`GET config/brand` · `GET lobby`
`GET/POST activity/signin` · `GET activity/tasks` · `POST activity/tasks/:taskId/claim`
`GET friends` · `friends/search` · `POST friends/request` · `GET friends/requests` · `POST friends/requests/:id` · `DELETE friends/:uid`
`GET mail` · `POST mail/:mailId/read` · `mail/:mailId/claim` · `GET announcements` · `GET rankings/:board`

**内部**：`POST /internal/wallet/settle`（`x-internal-token`）
**后台 `/api/admin/v1`**：login · password · dashboard · users(+nickname/ban/unban/kick/adjust) · wallet/transactions · wallet/settlements · rooms · rounds · games(+status) · configs(+publish) · config-versions · announcements(+disable) · mail/send · risk-events(+handle) · bans · audit-logs · admins · roles

**本次新增（计划）**：`GET vip` · `GET inventory` · `GET shop/products` · `POST shop/purchase` · `GET tournaments` · `POST tournaments/:id/join` · `GET slot/jackpots` · `GET stock/instruments`。

---

## 6. WebSocket 事件

统一信封：`WsUp{v,requestId,event,seq,timestamp,data}` / `WsDown{v,event,ack,pushSeq,timestamp,code,msg,data}`；每个请求回 `${event}.ok`。

| 域 | 事件 |
| --- | --- |
| sys | ping · pong · kicked · resync · error · hello |
| match / room | match.start · match.cancel · match.found · room.create/join/leave/ready/unready/dissolve/sync/playerJoined/playerLeft/playerOffline/playerReconnect/playerReady/gameStart/chat |
| game | game.roundResult · game.matchOver · game.trustee |
| mahjong | deal · turn · draw · drawPublic · discard · discarded · actionAsk · action · meld · hu · roundEnd · tingInfo（+ 未入 Ev 的 gangScore / options / ting） |
| hongshi | deal · turn · play · played · pass · hint · identityReveal · roundEnd（+ finish / newTrick） |
| fishing | enter · state · wave · bossWarning · fire · fireOk · hit · hitResult · fishKilled · playerFire · leave（+ playerJoined / playerLeft） |
| slot | enter · spin · spinResult · history |

**与用户要求的统一事件命名对照**：现有命名 `域.动作` 与要求的 `GAME_JOIN / FISH_HIT / MAHJONG_HU …` 语义一一对应（见 `docs/03-protocol.md`），**不重命名现有事件**（避免破坏 E2E 与客户端），新增游戏按同一风格追加：
`roulette.enter/state/bet/undo/clear/repeat/confirm/lock/result` · `stock.enter/price/bet/roundStart/roundLock/roundEnd` · `slot.jackpot` · `fishing.skill/skillResult/bossHp/bossDead`，并把散落的裸字符串事件补进 `Ev`。

---

## 7. 数据库表（27 张）

| 迁移 | 表 |
| --- | --- |
| 001 用户 | users · user_profiles · user_devices · user_login_logs(分区) · refresh_tokens · sms_codes |
| 002 钱包 | wallet_accounts · wallet_system_accounts(6 个系统账户) · wallet_transactions(只增) · wallet_ledger_entries(双式) · settlements · wallet_adjustments |
| 003 游戏 | games · game_versions · game_configs · config_versions(只增) · rooms · room_players · game_rounds(分区) · game_actions(分区) · game_results · fishing_sessions · fishing_shots(分区) · slot_paytables · slot_rounds(只增) |
| 004 社交 | friends · friend_requests · mail · announcements · activities · tasks · task_progress · signin_records · rankings(未使用) · notifications(未使用) |
| 005 后台 | risk_events · bans · admins · roles · permissions · role_permissions · admin_roles · audit_logs(只增) · admin_login_logs · server_nodes |

**本次新增迁移 `006_expansion.sql`（计划）**：`slot_jackpots` · `slot_jackpot_hits` · `roulette_rounds` · `roulette_bets` · `stock_rounds` · `stock_bets` · `stock_ticks`(分区) · `fishing_skill_uses` · `vip_levels` · `user_items` · `shop_products` · `shop_orders`(钻石内部兑换) · `tournaments` · `tournament_entries` · `mail_reads`；`games` 追加 `roulette`、`stock_updown` 两行；系统账户追加 `SYSTEM_ROULETTE_POOL`、`SYSTEM_STOCK_POOL`、`SYSTEM_JACKPOT_POOL`。

---

## 8. 美术资源目录

**接入前**：`public/assets/mahjong/*.svg`（CC0 riichi 牌面 37 张）、`public/assets/cards/*`（公共领域扑克 52 张）、`public/fonts/*`（4 款 OFL 字体）；鱼类 / 炮台 / 水果机符号 / 大厅图标全部为程序绘制矢量。

**接入后**（本次已建立，`node tools/assets/build-manifest.mjs` 生成清单）：

```
public/assets/
  common/     avatar · currency · vip · buttons · icons · frames · effects · popup · navigation · chips   (107)
  lobby/      game_icons · banners                                                                       (18)
  fishing/    fish · boss · cannon · skills · ui                                                          (27)
  slots/      symbols · jackpot · buttons · character · ui                                                (24)
  roulette/   wheel · table · chips · buttons · character · ui                                            (20)
  stock_game/ chips · buttons · icons · character                                                         (17)
  mahjong/    tiles(riichi CC0, 由 assets/mahjong 迁入) · character · buttons · effects · ui              (45)
  red10/      cards(由 assets/cards 迁入) · character · buttons · effects · ui                            (85)
public/assets-manifest.json      运行时清单（按组 → key → URL）
src/assets/manifest.gen.ts       编译期类型（AssetGroup / AssetKey）
```

合计 343 文件 / 10.8 MB（PNG，后续按需转 WebP）。来源登记见 `THIRD_PARTY_NOTICES.md`（新版素材为用户提供的 AI 生成图，无第三方版权主张）。

**素材使用原则**（用户要求 §十八）：素材只提供背景 / 框 / 按钮 / 图标 / 角色 / 装饰；金币、昵称、等级、倒计时、Jackpot 金额、赔率、投注额、HP、排名等动态数字一律程序 Text 绘制。Sheet 中烙有数字的板件已在切图时抹除数字（`clear` 区域），烙有中文文案的按钮以 `_zh` 后缀保留，仅在中文环境使用，韩文环境用程序文字 + CSS 板件。

---

## 9. 需要修改的文件

| 模块 | 文件 | 改动 |
| --- | --- | --- |
| 资源 | `src/assets/assets.ts`(新) · `manifest.gen.ts`(生成) · `tools/assets/build-manifest.mjs`(新) | 统一读取，禁止硬编码路径 |
| 公共组件 | `src/ui/{GameButton,CurrencyBar,PlayerProfile,VipBadge,JackpotBar,BetChip,GamePopup,Countdown,RewardAnimation,GameNavbar,LoadingScreen}.vue`(新) | 六游戏共用 |
| 音频 | `src/audio/AudioManager.ts`(新) | BGM / SFX / 设置持久化 |
| 大厅 | `views/LobbyView.vue` · `views/lobby/GameGrid.vue` · `GameCardArt.vue` · `LobbyBackdrop.vue` · `FeatureModals.vue` | 六游戏入口、顶部 / 功能 / 底部导航接新素材，新增 背包 / 商城 / 比赛 面板 |
| 路由 | `src/main.ts` | `/game/roulette` · `/game/stock` |
| 捕鱼 | `games/fishing/FishingView.vue` · `game-common/src/fishing/{config,engine}.ts` · `hosts/fishingHost.ts` · `protocol/events.ts` | 精灵鱼 + 对象池、炮台三档、技能、Boss HP、锁定、奖励动画 |
| 水果机 | `games/slot/SlotView.vue` · `game-common/src/slot/config.ts` · `hosts/slotHost.ts` · `006` 迁移 | 符号换新（BELL→DIAMOND、CROWN→GOLD、SCATTER→BONUS 别名）、Jackpot 四档、MAX BET / TURBO |
| 麻将 | `games/mahjong/MahjongTableView.vue` | HUD / 按钮 / 胡牌与大赢演出 / 结算面板换皮，逻辑不动 |
| 红十 | `games/hongshi/HongshiTableView.vue` | 同上 + 轮到谁 / 倍数 / 身份标志 |
| 轮盘 | `game-common/src/roulette/*`(新) · `hosts/rouletteHost.ts`(新) · `games/roulette/RouletteView.vue`(新) | 新游戏 |
| 股票 | `game-common/src/stock/*`(新) · `hosts/stockHost.ts`(新) · `games/stock/StockView.vue`(新) | 新游戏 |
| 结算 | `services/game/src/settlementService.ts`(新) | GameSettlementService 统一入口 |
| API | `services/api/src/modules/{vip,inventory,shop,tournament}/`(新) | 缺失功能 |
| 后台 | `apps/admin-web/src/views/{ConfigsPage,RoomsPage,DashboardPage}.vue` | 新游戏类型、Jackpot 池、技能记录 |
| i18n | `src/i18n/{zh,ko}.ts` | 新增约 120 key |
| 测试 | `tests/e2e-smoke.mjs` · `tests/ui-smoke.mjs` · `game-common/test/{roulette,stock}.test.ts`(新) | 新游戏与防重复领奖用例 |
| 文档 | `README.md` · `CHANGELOG.md` · `THIRD_PARTY_NOTICES.md` · `ASSET_MAPPING.md`(新) · `docs/03-protocol.md` · `docs/05-game-rules/{roulette,stock}.md`(新) | |

---

## 10. 新素材对应关系（摘要，完整见 `ASSET_MAPPING.md`）

| Sheet | 直接可用 | 需程序补文字 / 已抹数字 | 不接入 |
| --- | --- | --- | --- |
| 捕鱼 | 炮台 ×3、鱼 ×6、Boss 财神鱼（全身 / 头像 / 圆框）、技能图标 ×6、自动发炮、±、投注板 ×3、宽框 ×3、小图标 | 金币 / 钻石板（数字已抹）、HUD 头像框 | 烙有数字的 HUD 整条、Boss HP 条（程序绘制） |
| 水果机 | 符号 ×10（7 / 樱桃 / 葡萄 / 柠檬 / 西瓜 / 橙子 / 元宝 / 钻石 / WILD / BONUS）、SPIN、MAX BET / TURBO、±、金币、功能图标 ×8、弹窗框 ×7、开关、圆按钮 ×7、筹码 ×4 | Jackpot 四档框、WIN 框、总投注板、AUTO 板（数字已抹） | 顶部 HUD 整条 |
| 轮盘 | 台面（静态数字为版面）、筹码 ×11、SPIN / REPEAT / CLOSE / AUTO、箭头 ×4、财神鱼 ×2、金币 / 宝石 / 元宝、弹窗框 ×7 | 幸运轮盘 Jackpot 框（数字已抹） | 透视轮盘图只做装饰（转动轮盘程序绘制） |
| 股票 | 四游戏入口图标、熊 / 牛头像、涨跌板（文字已抹）、筹码 ×7、方向 / 首尾数图标、财神鱼 ×2、宝石 | 走势图 / 行情列表 / 开盘表 / 区间弧（全部程序绘制） | Apple / Tesla / MSFT / BTC / ETH 商标 |
| 麻将 | 财神鱼（持發牌）、胡 / 大赢演出、± 橙、筹码 ×5、指针、弹窗 ×2、麻将大师 Logo、底部导航图标 ×7、功能图标 ×6 | Jackpot 框、投注板、VIP 徽章（数字已抹）、进度条 | 不完整的牌面（筒 / 条缺失）→ 继续用 CC0 riichi 套 |
| 红十 | 红十 Logo、赢 / x2 / x4、财神鱼（持 10♥）、± 金、模式图标 ×5 + 板 ×5、花色 ×4、弹窗 ×4、准备 / 开始 / 比牌 / 结算（中文）、炸弹 / 有红十 / 过 / 不出（中文） | Jackpot 框、投注板、战绩面板（数字已抹） | 烙有玩家数据的积分榜、HUD |

---

## 11. 风险与约束提醒

- 所有金币 / 钻石为**虚拟娱乐资产**，不可兑换法币；轮盘与股票玩法只在虚拟资产内结算，不接入真实行情、不做充值提现。上线前需当地法律 / 商店政策审查（见 `docs/06-security.md` §合规）。
- 麻将 / 红十规则包仍为 `.draft`，未确认项保持配置化，本次不改规则。
- 服务端权威不变：胡牌 / 结果 / 派奖 / 余额 / 捕鱼击杀 / 水果机结果 / 轮盘号码 / 股票结算价全部由服务端决定，客户端只做表现。

## 附：新版美术接入完成状态（2026-09-03，P1–P9）

| 模块 | 状态 | 关键实现 |
| --- | --- | --- |
| 大厅 | ✅ | 六游戏入口（状态由 `games.status` 控制）、顶部 / 功能区 / 底部导航全部接真实路由与后端（商城 / 背包 / 赛事 / VIP） |
| 捕鱼 | ✅ | 技能 / Boss 血量 / 冰冻 / 锁定，全部服务端判定；`fishing_skill_uses` 审计 |
| 水果机 | ✅ | `fruit_gold_v2` 赔付表、四档 Jackpot（服务端注入 / 命中 / 重置）、免费旋转持久化、免费旋转券 |
| 麻将 / 红十 | ✅ | 只换美术，规则与服务端权威不变；喊话 / 胡牌 / 结算演出 |
| 轮盘 | ✅ | `roulette_rounds / roulette_bets`，锁盘即 CSPRNG 开奖、按库结算、崩溃恢复（`007` 上线） |
| 股票涨跌 | ✅ | `MarketDataProvider` + 模拟行情（`stock_ticks`）、`stock_rounds / stock_bets`、锁定赔率（`008` 上线） |
| 统一结算 | ✅ | `services/game/src/gameSettlement.ts`（幂等 key 规范 + 资金池映射） |
| 后台 | ✅ | 街机记录 / 奖池页 + 仪表盘在线与今日回合统计 |
| 网关 | ✅ | 修复握手期间首帧丢失竞态（监听器同步挂载 + 缓冲回放） |

