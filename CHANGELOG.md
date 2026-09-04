# CHANGELOG

## [0.3.2] - 2026-09-04 大厅重设计 v4 · 四游戏 · 客服工单（PHASE 22 · P12）

### 大厅（apps/client-game）
- 只保留四款游戏：延边麻将 / 延边红十 / 捕鱼达人 / 水果机，**2×2 横向卡片**（左插画 / 右名称 + 副标题 + 状态 + 进入按钮），不显示在线人数；轮盘 / 股票路由与逻辑保留但不在大厅出现
- 卡片插画程序合成（麻将牌扇 / 扑克牌扇 / 鱼群 + Boss + 炮台 + 光束气泡 / 三列符号窗），文字全部 HTML 双语；悬停抬起金边发光、按下缩放光圈、进入过渡、金币粒子、游鱼气泡
- 新背景「延边之夜」：深蓝夜幕 + 星光 + 长白山天池 + 海兰江水纹 + 朝鲜族菱格纹（原创 SVG）；HTML Logo `LobbyLogo.vue`（金色圆徽 + 延边游戏 / 연변 게임 / YANBIAN GAME）；`favicon.svg`
- 顶栏：金币（平台金币，无 `$`）/ 钻石 / 语言切换按钮 / 设置；公告栏喇叭 + 自动滚动（无公告显示欢迎语）
- 底部导航 5 项（大厅 / 游戏 / 好友 / 背包 / 商店）；右侧快捷 4 项（活动 / 任务 / 邮件 / 客服）+「更多」（VIP / 排行 / 公告 / 福利 / 比赛）
- 响应式：桌面 2×2；手机横屏压缩；竖屏单列滚动 + 右侧抽屉 + 底栏固定；无横向溢出
- 减少动态：`design/motion.ts`（设置开关 + 系统偏好 → `html.reduce-motion`），全局关闭装饰动画
- i18n 新增 60 余键（大厅 / 客服 / aria 标签 / 错误 / 加载），中韩键完全对齐；品牌名改为 延边游戏 / 연변 게임（store 默认、config 兜底、migrate `brand_v2`、公告、后台、APK 标签）
- `tests/lobby-shot.mjs` 多端截图回归（pageerror / 4xx / 横向溢出）；`ui-smoke` 断言四卡 + 5 导航 + 5 快捷

### 客服工单（真实功能）
- DB `009_support.sql`：`support_tickets` / `support_messages`；权限 `support.manage`（super / ops / cs）
- API `modules/support/routes.ts`：玩家 创建 / 列表 / 详情 / 追加留言 / 关闭（限频：每小时 5 单、每分钟 10 条，未关闭 ≤ 5）；后台 分页 / 详情 / 回复 / 关闭（每次写操作记 `audit_logs`）
- 客户端 `SupportPanel.vue`（列表 / 新建 / 往来记录 / 追加 / 关闭，双语，错误与加载态）；后台 `SupportPage.vue`（状态筛选 / UID 过滤 / 抽屉回复 / 二次确认关闭）
- E2E 新增 `testSupport()`（8 断言，含后台回复链路）

### 其它
- 种子：欢迎公告改名并去重（旧种子无唯一约束导致每次启动重复插入）；`games` 表名称随大厅规格更新（ON CONFLICT DO UPDATE）

## [0.3.1] - 2026-09-04 素材裁切全面检查修复（PHASE 21 · P13）

### 检查工具（tools/assets/）
- `audit.py`：全量扫描 PNG / WebP，标记贴边 `CUT_*` / `EDGE_*`、边距不足 `LOW_MARGIN`、无透明 `NO_ALPHA`、深色底 `DARK_BG`、方框背景 `CORNER_OPAQUE`；
  输出 JSON / MD / HTML 预览网格 + **PNG 检查表 `build/asset-check-*.png`**（棋盘格 + 12% 安全线 + 红黄绿框）
- `pad_margins.py`：独立对象类素材裁到包围盒后补透明边到 **16%**（不缩放、不重采样；`--trim/--crop` 先去外来碎片）
- `build-slot-symbols.py` + `render-svg.mjs` + `svg/{seven,bar,coin}.svg`：水果机符号集生成（Fluent 3D MIT + 原创 SVG 光栅化）
- 规范文档 `docs/12-asset-guidelines.md`；`THIRD_PARTY_ASSETS.md` 更名为 `THIRD_PARTY_NOTICES.md` 并登记 Fluent UI Emoji（MIT）与原创 SVG

### 素材（审计前独立对象类 123/123 不合格 → 0）
- 101 个图标 / 鱼 / 炮台 / 人物 / 特效 / 底板补边到 16%；财神发牌右缘外来白条裁除
- 水果机 10 个符号整套更换为独立透明 PNG（西瓜 / 樱桃 / 柠檬 / 橙子 / 葡萄 / 蓝宝石 / 星 / 礼盒 ← Fluent 3D；7 / BAR / 金币 ← 原创），新增 **BAR**
- `sparkle_coin`（黑底方块）→ 透明星光；新增平台金币 `coin_yanbian`（无 `$`，长白山 + 江水徽记）
- 删除 15 个不合格素材：深色底图标 7、素材站边框碎片 4、`$` 金币 3、烙字轮盘横幅 1

### 客户端
- 新增 `src/assets/bounds.ts`：`contentBounds(texture)` 读取纹理内容包围盒；捕鱼鱼 / 炮台 / 金币、水果机符号一律按**内容尺寸**缩放与锚定，换素材不改常量
- 水果机符号不再画深蓝方框底板；WILD / BONUS 文字由 Pixi 程序绘制；符号可见尺寸 0.8 格
- 全局 `img { object-fit: contain; object-position: center }` + `.asset-icon` 工具类；轮盘去掉唯一的 `object-fit: cover`（烙字横幅改为 HTML 标题）
- 捕鱼技能图标 / Jackpot 底板按 1/0.68 放大盒子补偿内置边距；大厅活动 / 任务 / 邮件 / VIP / 商城图标改用完整圆形版本；金币展示统一 `coin_yanbian`

### 水果机数学
- 赔付表 **fruit_gold_v3**：每列卷轴条第 2、5 个 LEMON 位置改为 BAR，全表赔率上调约 7%；`scripts/slot-rtp-sim.ts` 600k 次实测 RTP **95.63%**（线奖 81.7% + Scatter 3.6% + 免费旋转 10.4%，命中率 48.0%）；
  模拟器新增 `SLOT_PAYS=<json>` 临时覆盖赔率做候选对比；migrate 自动激活 v3 并退役 v2

## [0.3.0] - 2026-09-03 新版美术全量接入（PHASE 20 · P1–P5）

### P1–P2 项目扫描与素材入库
- 新增 `PROJECT_ANALYSIS.md`（技术栈 / 目录 / 功能矩阵 / API / WS 事件 / 27 张表 / 待改文件）与
  `ASSET_MAPPING.md`（素材 → 游戏 → 界面 → 组件 → 功能，状态 ✅ / 🔧 / 📦，以及「明确不接入」清单）
- 六张 AI 生成素材表（红十 / 麻将 / 轮盘 / 捕鱼 / 股票 / 水果机）按 alpha 侵蚀连通域拆分为 343 个独立 PNG，
  统一目录 `public/assets/{common,lobby,fishing,slots,roulette,stock_game,mahjong,red10}/…`，统一英文命名
- `tools/assets/build-manifest.mjs` 生成 `public/assets-manifest.json` + `src/assets/manifest.gen.ts`（key 由文件名派生，重复即报错）；
  `src/assets/assets.ts` 提供 `asset() / assetByKey() / preload()（按字节加权进度）/ pixiTextures() / release()`，禁止散落硬编码路径
- 素材表中的真实商标（Apple / Tesla / Microsoft / BTC / ETH）与 TOP-UP / CASHBACK 现金语义元素不接入；
  含中文烘焙文字的按钮仅作 `_zh` 变体在中文环境使用，其它语言用 CSS 底板 + 程序文字

### P3 统一大厅与公共 UI 组件库
- `ui/`：`GameButton`（四态 / 艺术底图 / 徽标 / 音效）、`CurrencyBar`、`AnimatedNumber`、`PlayerProfile`、`VipBadge`、`GameNavbar`、
  `BetChip`、`BetStepper`、`ProgressBar`、`JackpotBar`、`GameToggle`、`GamePopup`、`Countdown`、`RewardAnimation`、`LoadingScreen`
- `audio/AudioManager.ts`：BGM / SFX / Voice 三总线、设置持久化、首次手势解锁、按场景切换与释放；
  41 个 Kenney CC0 音效转 mono 22.05 kHz MP3
- 大厅重写：六游戏入口（延边麻将 / 红十 / 捕鱼 / 水果机 / 轮盘 / 股票涨跌，后两者由服务端 `games.status` 控制显示「即将上线」）、
  顶部头像 / 昵称 / ID / 等级 / VIP / 金币 / 钻石、功能区（活动 / 签到 / 任务 / 邮件 / 排行 / 公告 / VIP）、底部导航（大厅 / 游戏 / 比赛 / 好友 / 背包 / 商城）
- 新后端：`GET /vip` + `POST /vip/daily`、`GET /inventory`、`GET /shop` + `POST /shop/purchase`（幂等）、
  `GET /tournaments` + `POST /tournaments/:id/join`（幂等）与 60 s 赛事调度器（按排名结算 → 系统邮件发奖 → 自动开启下一期）；
  迁移 `006_expansion.sql` / 种子 `002_expansion.sql`（vip_levels 0–10、道具、商品、四档 Jackpot、赛事）
- 结算链路新增 VIP 经验 `bumpExp` 与赛事指标 `bumpTournament`

### P4 捕鱼
- `game-common/fishing`：技能配置（雷电 / 导弹 / 激光 / 核弹 / 冰冻 / 锁定，冷却与目标数）、Boss 血量模型
  （`bossMaxHp = baseOdds × bulletBaseCost × topMultiplier`，伤害按成本浮动，奖励按 RTP 按伤害比例分配）、冰冻窗口
- `fishingHost`：技能优先消耗背包道具（幂等 key），否则扣金币；击杀入账幂等；Boss 血量 / 死亡 / 分账广播；`fishing_skill_uses` 落库
- 客户端：精灵鱼群对象池、三档炮台、技能栏、锁定准星、Boss 血条、冰冻演出；Pixi `autoDensity` 修复 DPR 2 双倍渲染
- 单测 `fishing-skills.test.ts` 5 项；E2E 新增 3 项技能断言

### P5 水果机
- 赔付表 `fruit_gold_v2`（符号改名 CHERRY LEMON ORANGE GRAPE MELON DIAMOND SEVEN GOLD WILD BONUS，数学不变；迁移时自动激活并退役旧版）
- `slotHost` 重写：四档 Jackpot 奖池（每注按 `contrib_bp` 注入、`hit_chance_ppm` 由高到低判定、命中后 `FOR UPDATE` 重置种子、
  `slot:jackpot:<roundId>` 幂等入账、`slot_jackpot_hits` 落库、`slot.jackpot` 广播）；免费旋转持久化到 Redis；免费旋转券 `slot.ticket`
- 客户端重写：精灵符号、四档 Jackpot 条实时滚动、WIN 板、TOTAL BET 板（数字程序绘制）、MAX BET / TURBO / AUTO(50) / 券；
  转轴弹射 → 匀速 → 错峰停 + 回弹（极速 45%）；中奖线与格子脉冲；大奖 / Jackpot 演出
- 修复：机台底座层级盖住转轴；转轴滚动方向与遮罩贴合；光晕烘焙为 1/4 分辨率纹理减少全屏叠加；
  素材切边残留（元宝 / 樱桃 / 葡萄）与财神立绘矩形光晕清理
- 单测 `slot.test.ts` 7 项；E2E 新增 2 项 Jackpot 断言（合计 33 项）；新增 `tests/slot-shot.mjs`

### P6 麻将与红十换皮（规则与服务端权威不变）
- 两桌统一：顶栏成品退出钮 + 资产胶囊（`CurrencyBar`）、等待卡改 `sk-panel` + 立绘 + `GameButton`、
  结算 / 总结算改 `GamePopup`（cream / red 皮肤、程序标题双语、名次徽章、财神立绘）、匹配取消钮
- 麻将：罗盘指针改用素材 `turn_pointer`（指向当前出牌方）；「轮到你出牌」金牌标；吃 / 碰 / 杠 / 胡 / 过 改为
  `GameButton round xl`（毛笔字程序文字，吃的变体在按钮下方以小牌展示）；吃碰杠胡按座位方位弹喊话；
  胡牌 `fx_hu` 爆字 → 结算；三番及以上结算面板加 `fx_big_win`；本人得分走 `RewardAnimation`；
  发牌 / 出牌 / 胡 / 过 音效；短屏隐藏罗盘「张」字避免与门风重叠
- 红十：修复扑克牌面路径（素材迁至 `red10/cards/` 后经资源清单 `assetByKey` 读取，原先整手牌不显示）；
  红十方身份徽章带 ♥ 图标；「我出牌」箭头（zh 素材 / ko 程序文字）；不出 / 提示 / 出牌改 `GameButton`（全部走服务端校验）；
  炸弹 `fx_bomb_zh`、有红十 `fx_hongshi_zh`、不出 `fx_no_play_zh` 按座位弹出（其它语言程序文字）；
  结算面板：本方获胜 `fx_win` / 平局 / 落败、倍数 `fx_x2` / `fx_x4`（其它倍数程序文字）、按名次排序；
  面板收起后「结算」钮可重新查看本局战绩（zh 用 `btn_settle_zh`）；准备钮 zh 用 `btn_ready_zh`
- 明确不接入：`btn_compare_zh`（「比牌」与出牌语义不符）、`btn_start_zh`（准备即自动开局）、
  `panel_result_zh`（标题烙字，改程序标题）、`badge_master_zh`（「主牌」语义待确认）
- 立绘类素材统一清理切边残留（财神 × 8）
- 测试：`tests/table-shot.mjs` 选择器更新并支持 `ONLY` / `SIZE`；新增 `tests/settle-shot.mjs`（喊话 / 胡牌 / 结算面板截图）；
  UI 冒烟 8/8

### P7 幸运轮盘（新游戏，欧式单零）
- `game-common/roulette`：配置（筹码 / 限额 / 阶段时长 / 赔率，可由 `game_rules` 覆盖）、`WHEEL_ORDER`、
  引擎（`validateBet / normalizeBets / betWins / betPayout / drawResult / settleBets`）；单测 8 项（含 37 结果总返还 = 36×，RTP 97.3%）
- `rouletteHost`：单桌共享回合循环（下注 30 s → 锁盘即 CSPRNG 开奖并落库 rng_audit → 转盘 9 s → 结算 6 s）；
  下注单事务扣款 + 注单落库（幂等 `roulette:bet:<uid>:<requestId>`）、单点 / 单局限额、余额预检、锁盘前 250 ms 拒投；
  结算以数据库注单为准，派彩幂等 `roulette:win:<roundId>:<uid>`；崩溃恢复（已开奖补结算 / 未开奖退款作废）；
  VIP 经验、任务、赛事指标；在线人数 `online:game:roulette`；`games.roulette` 迁移 `007` 上线
- 协议：`roulette.enter / state / bet → bet.ok / spin / result / history / leave`（`docs/03-protocol.md`）
- 客户端 `RouletteView`：Canvas 顶视转盘（球在轮盘坐标系运动，必停服务端号码；财神立绘居中）、程序绘制投注台
  （0 / 1–36 / 三列 / 三打 / 1-18 / 单双 / 红黑）、素材筹码落桌 + 程序金额、撤销 / 清除 / 重复 / 自动 / 确认（成品按钮 + 双语程序说明）、
  服务端时间校正倒计时、近期开奖、本局结果面板 + `RewardAnimation`；1920 / 960×540@2x 适配
- 明确不接入：`table_layout`（缩略图，投注台改程序绘制）；横幅裁掉 JACKPOT 缎带（轮盘无奖池）
- 修复（网关）：`message` 监听器原先在两次 await 之后才挂上，open 后立即发送的帧会被静默丢弃（快客户端 / 重连竞态）；
  现改为连接建立时同步挂上并缓冲，握手完成后按序回放；seq 非递增被拒时输出 warn 日志

### P8 股市风云（股票涨跌玩法，新游戏）
- `game-common/stock`：三个虚拟品种（不含真实公司 / 商标）、赔率（涨跌 / 高低 1.9×、小数首末位 9.5×、四档涨跌幅区间 3.4× / 4.2×）、
  `normalizeBet`（HIGHER / LOWER 参考价由服务端写入）、`evaluateBet`（平盘 / 等价退本金）、`gbmStep`（Box–Muller + CSPRNG）；
  单测 7 项（含 4000 回合蒙特卡洛 RTP 断言）
- `MarketDataProvider` 接口 + `SimulatedMarketProvider`（GBM + 均值回归，每秒 tick，落库 `stock_ticks` 保留 24 h，重启从库恢复序列）
- `stockHost`：每品种独立 30 s 回合（结算 tick 即下一回合开盘）、结算前 8 s 锁盘、每次点击一注（幂等扣款 + 锁定赔率落库）、
  按库结算 + 幂等派彩 + 按人推送、崩溃恢复（补结算 / 退款作废）、VIP / 任务 / 赛事指标；`games.stock_updown` 迁移 `008` 上线
- 协议：`stock.enter / tick / round / bet → bet.ok / result / leave`
- 客户端 `StockView`：品种列表、Canvas 走势图（贝塞尔平滑 / 开盘虚线 / 现价标签 / 涨跌渐变）、素材筹码、看涨 / 看跌成品底板 + 牛熊图标 + 程序文字、
  高低 / 数字 / 区间侧注、本局投注与锁定赔率、近期结果、结算面板 + `RewardAnimation`；1920 / 960×540@2x 适配
- 测试：E2E 新增 12 项（进场 / tick / 锁定赔率 / 服务端参考价 / 幂等 / 非法数字 / 未知品种 / 结算 / 派彩一致 / 余额一致 / 锁盘拒投），合计 55；
  UI 冒烟 +1（10 项）；`tests/stock-shot.mjs`；`docs/05-game-rules/stock-architecture.md`

### P9 验收：统一结算服务 / 后台可见性 / 全量回归
- `services/game/src/gameSettlement.ts`（GameSettlementService）：统一 `settleBetInTx / settlePayoutInTx / settleRefundInTx / settle()`，
  幂等 key 规范 `<game>:bet:<uid>:<requestId>` / `<game>:win:<roundId>:<uid>` / `<game>:refund:<roundId>:<uid>`，
  各游戏对手资金池映射 `GAME_POOL`；轮盘与股票宿主全部改经该服务过账（水果机 / 捕鱼 / 牌桌沿用同一钱包原语与 key 规范）
- 后台：`GET /api/admin/v1/arcade/jackpots`（四档奖池 + 最近命中）、`/arcade/roulette/rounds`、`/arcade/stock/rounds`（含按 roundId 查注单）；
  仪表盘在线人数与今日回合统计加入轮盘 / 股票 / 水果机（`arcadeToday`）；后台前端新增「街机 / 奖池」页
- 捕鱼技能图标（烙中文）在非中文环境用实底小牌叠加程序文字名称
- 捕鱼精灵去底：鱼 / Boss / 炮台原切片带有素材表的水面 / 白底（Boss 在场上显示为矩形），
  用 OpenCV GrabCut（蓝色鱼 / Boss / 炮台）与色相键控（暖色鱼）重新去底并羽化，原图备份于 scratchpad
- 全量回归：game-common 单测 59 / api · game · client · admin 类型检查 / E2E 55 / UI 冒烟 10 / 后台冒烟 7

### P10 打磨
- 轮盘 / 股票：进场逻辑抽为 `enterTable()`，网关每次连接下发的 `sys.hello` 触发重新进场（回合 / 余额 / 注单以服务端为准），
  断线重连后不再依赖下一次广播才能恢复；轮盘重新进场前清空本地筹码堆，避免重复叠加
- 新增 `tests/res-shot.mjs`（GAMES × SIZES：2560×1440 / 1600×900 / 1366×768 / 1280×720 / 平板 / 手机横屏）；
  大厅 / 轮盘 / 股票 / 水果机在 2560×1440、1366×768、1280×720 复核通过
- 轮盘投注台号码格改为显式行列定位（原 `grid-auto-flow: column` 会按阶梯错位并在平板宽度溢出）；
  股票面板手机横屏下筹码 / 数字选择不再换行溢出；大厅新增手机横屏（高度 ≤ 450）布局：六张卡单行、功能栏只留图标
- 素材体积：≥ 30 KB 的 PNG 切片（81 个）转为 WebP（质量 88，含 alpha），7.3 MB → 1.8 MB，资源总量 12 MB → 6.6 MB；
  资源清单 key 不变，客户端无硬编码路径
- 修复（牌桌）：客户端每回合自动发起的只读查询 `mahjong.options` / `hongshi.hint` 被当作手动操作解除托管，
  导致挂机玩家每回合都被解除托管、全桌等满 15 s（一局可拖到 20 分钟）；现只读查询不再解除托管
- 测试：E2E 新增 10 项（进桌 / 扣款 / 幂等 / 非法号 / 超额 / 锁盘开奖 / 开奖后拒投 / 派彩一致 / 余额一致 / 历史），合计 43；
  新增 `tests/roulette-shot.mjs`；UI 冒烟 +1（9 项）；`docs/05-game-rules/roulette-architecture.md`

### P11 内测 APK 与运行时服务器地址
- 客户端新增 `net/config.ts`：REST / WS 地址改为运行时解析（localStorage `serverBase` > `VITE_SERVER_BASE` > `VITE_API_BASE` / `VITE_WS_BASE` > 同源），
  `api.ts` / `ws.ts` 不再在模块加载时固化地址；登录页新增「服务器设置」弹窗（校验 http(s):// 格式、保存后整页重载、可清除），
  支持 `?server=` 链接一次性写入；原生壳（UA 含 `YanbianGameApp/`）未设置地址时登录页高亮提示
- 新增 `tools/apk/build-test-apk.py` + `tools/apk/src/…/MainActivity.java`：不依赖 Android SDK / Gradle / 谷歌仓库的内测 APK 打包
  （WebView 壳 + 内嵌 NanoHTTPD 提供 dist；Robolectric android-all 编译、dx 生成 dex、pyaxml 生成二进制清单并按属性定义改写枚举 / 标志位、
  jarsigner 调试签名、androguard 回读校验包名 / 入口），产物 `build/yanbian-test.apk`（6 MB，minSdk 24 / targetSdk 28）；
  正式发布仍走 Capacitor + Android Studio（docs/10-deployment.md §3，内测壳见 §3.1）

### P11 游戏本体打磨（手机实机走查）
- 修复（严重）：对局中点退出，服务端拒绝但客户端仍回大厅，玩家被困在原桌（托管到整场结束且照常结算），
  再进别的游戏时视图套用了旧桌快照（红十界面渲染麻将牌、图片全裂）。现在：对局中离开 = 本局托管打完并照常结算、
  会话立即脱离房间可去别处、局末由陪练接替座位（保留累计分，机器人不参与钱包）、全员离开即散桌；
  客户端退出前弹确认（说明托管与结算规则），视图只接受同游戏的快照，若仍在另一桌则直接带回那桌；对手席显示「已离开」
- 新增 `tests/phone-play.mjs`（手机横屏触屏走查：ko/zh × 844×390 / 800×360，六游戏全流程截图 + 控制台错误）；E2E 新增「对局中离开」4 项

### P12 内测服务器一条命令部署
- `deploy/docker-compose.test.yml` + `deploy/nginx/gateway-http.conf` + `deploy/install-test-server.sh`：任意 Linux 主机
  `bash deploy/install-test-server.sh` 完成 装 Docker → 生成随机密钥 `.env` → 构建 → 迁移 → 启动，并打印 APK「服务器设置」要填的
  `http://<主机IP>` 与后台初始密码；HTTP 无域名 / 无证书，仅内测（对外发布仍用 prod 编排）
- `pnpm dev:all`（`scripts/dev-all.mjs`）：开发电脑一键拉起 PG / Redis / 迁移 / api / game / client / admin，打印同一 Wi-Fi 手机要填的
  `http://<电脑IP>:5173`；Ctrl+C 全部退出（Windows 用 taskkill 级联）
- 修复：`docker-compose.prod.yml` 的 Redis 开了 `requirepass` 但 `REDIS_URL` 未带密码，服务启动即 NOAUTH；现为 `redis://:<密码>@redis:6379`
- 修复：管理后台经网关挂在 `/admin/` 下时静态资源按 `/assets/…` 请求被路由到游戏客户端（404，后台白屏）；
  `admin-web` 镜像以 `VITE_BASE=/admin/` 构建（Dockerfile.web `BASE` 参数，test / prod 编排均已传），本地 dev 仍为 `/`
- 修复：网关 nginx 用静态 `upstream` 在启动时缓存容器 IP，`up -d --build` 重建 api / 前端容器换 IP 后出现 502 或前后台串路由；
  `gateway.conf` / `gateway-http.conf` 改为 Docker 内置 DNS 动态解析（`resolver 127.0.0.11` + 变量 `proxy_pass`），
  容器重建后无需重启 nginx（本容器内实测：重建 api / client-web 后路由即刻正确）；`/admin` 无斜杠时 301 到 `/admin/`
- Dockerfile 增加可选 `NPM_REGISTRY` 构建参数（`.env` 设 `NPM_REGISTRY=https://registry.npmmirror.com` 加速国内构建）
- 基础镜像来源参数化 `IMAGE_PREFIX`（Dockerfile `ARG` 置于 `FROM` 之前 + compose 镜像名 / 构建参数）：默认 Docker Hub（国内主机配
  `registry-mirrors` 即可），安装脚本自动探测 Docker Hub → `mirror.gcr.io` → 提示配置镜像加速；新增 `.dockerignore`
  （排除 node_modules / dist / .git / .env，构建上下文从数 GB 降到源码体积）
- `tools/pack-server.sh`：按 git 追踪文件打源码 tar 包，无仓库权限的主机也能部署；`docs/11-vps-quickstart.md`（韩文 VPS 快速上手）
- `tools/apk/build-test-apk.py --server <地址>`：以 `VITE_SERVER_BASE` 重新构建并把服务器地址烧进 APK，分发给测试者装上即连（登录页仍可改）
- 新增单容器一体化镜像 根目录 `Dockerfile`（PostgreSQL 16 + Redis 7 + api + game + Node 边缘 `deploy/allinone/edge.mjs`：
  静态 / `/api` 反代 / `/ws` 升级转发；`PORT` 可配；密钥自动生成并持久化到 `/data/secrets.env`；`/data` 挂卷持久化），
  运行时以 `postgres:16-alpine` 为基底、Node / Redis 二进制自官方同版本 Alpine 镜像拷入，构建不依赖 apk 仓库；
  根目录 `railway.json` / `render.yaml` 一键部署配置；文档 §2.2 与韩文快速上手 §4-3
- 安装脚本结束时同时打印局域网地址（Linux / macOS / Windows Git Bash、WSL 均可探测）与公网地址，说明家用电脑需端口映射或 cloudflared；
  文档新增「用自己的电脑当服务器」（Docker Desktop + WSL、同一 Wi-Fi、Cloudflare Tunnel）

## [0.2.1] - 2026-09-03 GitHub 开源素材接入（PHASE 19 美术精修 · 续）

### 素材来源与合规（新增 `THIRD_PARTY_NOTICES.md`）
- 只接入 GitHub 上许可证明确允许商业使用的开源素材：CC0 / 公共领域 / SIL OFL 1.1；
  每项素材目录内保留原始许可证文件，并在清单中登记来源 URL、许可证与落地位置
- 仍然不含任何竞品 APK 提取资源、商标、Logo、游戏名称、受版权保护的音乐 / 角色 / 美术图；
  背景、牌桌、鱼类、炮台、水果机符号、图标、头像纹章、牌背保持本项目原创
- 免费材质站（polyhaven / ambientcg）在本环境网络策略下不可达，绒面 / 木纹继续使用程序化纹理

### 麻将牌面：riichi-mahjong-tiles（FluffyStuff，CC0）
- `public/assets/mahjong/`：37 张 svgo 优化后的 SVG（Front 牌体 + 万/筒/索/风/箭 花色叠层）
- `games/mahjong/MjTile.vue` 重写：`Front.svg` + 花色 SVG 两层 `<img>` 合成，`kind 0–33` 与引擎映射
  （0–8 万 → Man，9–17 条 → Sou，18–26 筒 → Pin，27–33 東南西北中發白 → Ton/Nan/Shaa/Pei/Chun/Hatsu/Haku）；
  牌高比 1.34，保留 2.5D 绿色侧面、抛光斜切高光、原创雪晶菱格牌背（riichi 的红色牌背不采用）
- 大厅麻将海报的「中 / 伍萬 / 五筒」三张主牌改用同一套真实牌面

### 扑克牌：Vector Playing Cards（Byron Knoll，公共领域）
- `public/assets/cards/`：40 张数字牌 SVG（5–13 KB）+ 12 张 J/Q/K 花牌（原 SVG 245–760 KB，
  用 Chromium 光栅化为 480×672 WebP，60–74 KB）；小丑牌不使用
- `games/hongshi/PlayCard.vue` 重写：`SUIT_CODE = [D, C, H, S]` 与引擎花色顺序（方块/梅花/红桃/黑桃）对齐，
  按牌面选择 `.svg` / `.webp`；牌高比 1.45；保留原创牌背（藏青 + 金色菱格）、红十金色描边与「十」角标
- 大厅红十海报的双主牌改用真实 10♥ / 10♦

### 展示字体（Google Fonts，SIL OFL 1.1，自托管子集）
- 新增 `design/fonts.css`（由 `tokens.css` 引入）：`YB Display ZH`（ZCOOL XiaoWei，11.8 KB）、
  `YB Display KO`（Nanum Myeongjo ExtraBold，4.1 KB）、`YB Calligraphy`（Ma Shan Zheng，11.2 KB）、
  `YB Brand`（Cinzel，25.3 KB）；`pyftsubset` 只保留实际用到的字形，`font-display: swap`
- 游戏名、登录页字标、大厅品牌字改为宋体气质的展示字体（中文 400 / 韩文 800），
  `YANBIAN GAME` 改为 Cinzel；麻将罗盘门风与座位门风章改为毛笔楷书
- 字号随语言切换：`.p-title.ko` / `.b-cn.ko` / `.mark.ko` 单独标定，2K / 手机 / 横屏短屏各有断点

### 修复
- 中文语言包 `game.mahjong_yanbian.desc` 混入韩文（`규칙 확인 완료`），改为「地道延边玩法 · 自定规则」
  （规则未确认项保持配置化，不在文案里宣称“规则已确认”）

### 验证
- `vue-tsc` 通过；`vite build` 通过（`public/` 素材与字体原样进入 `dist/`）
- `tests/ui-smoke.mjs` 8/8；`tests/lobby-shot.mjs` 四分辨率、`tests/table-shot.mjs` 四张牌桌截图人工复核：
  牌面 / 扑克 / 字体在 1920、2560、960×540 横屏、手机竖屏均正确渲染

## [0.2.0] - 2026-08-31 大厅商业级美术重制（PHASE 19 美术精修）

### 设计系统「玄夜鎏金」v2
- Token 全面重定：三层背景色阶（`#070C15/#0B1220/#111A2B/#17223A`，禁用纯黑）、
  低饱和香槟金五阶、四级文字层级、材质三件套（边缘受光 + 内阴影 + 外投影）
- 新增 `docs/11-lobby-design.md`：Design Token / Icon 规范 / 游戏卡规范 / 动效规范 /
  多分辨率适配 / 自我审查清单 / 新增游戏落地检查表

### 零 Emoji：原创矢量图标与头像体系
- 新增 `ui/AppIcon.vue`：统一 24×24 视窗、左上 45° 光源、线宽 1.8；
  solid 族（coin/gem/signin/target/trophy/mail/megaphone）+ line 族（导航与工具）
- 新增 `ui/AvatarBadge.vue`：程序化纹章头像（12 纹章 × 8 配色，由 avatarId 稳定派生），
  VIP 金环呼吸光；替换全部 Emoji 头像
- 删除 `ui/format.ts` 的 `avatarEmoji`；大厅、四个游戏内页、登录页 Emoji 全量清除

### 大厅重制（信息架构不变）
- 新增 `views/lobby/LobbyBackdrop.vue`：三层空间背景（长白山山脊/雪线/松林剪影/
  朝鲜族菱格暗纹/冷月/星尘/雾带/中央光源/金色微粒/暗角），四周暗中央微亮
- 玩家信息容器、金币与钻石胶囊、玻璃公告条、五张功能卡、悬浮 Dock（620×86）全部重做材质
- 公告条与功能卡合并为同一行，消除顶部空白带

### 四张游戏海报卡（新增 `views/lobby/GameCardArt.vue`）
- 非对称栅格 `1.62fr 1fr 1fr 1fr`，麻将恒定旗舰位；行高 `clamp(330px, 60vh, 600px)`
- 延边麻将：翡翠牌桌 + 黄铜吊灯 + 2.5D 牌墙 + 「中」主视觉 + 骰子筹码 + 长白山轮廓
- 红十：酒红绒桌 + 会所拱券 + 吊灯光锥 + 双红十主牌 + 扇形背牌 + 筹码堆
- 捕鱼：深海光柱 + 海面焦散 + 金龙鱼（四排鳞甲/鳍骨/鳃盖/龙须/背脊轮廓光）+
  金色渔网 + 爆金 + 海床珊瑚气泡
- 黄金水果：黑金转轮机 + 放射流光 + 樱桃/7/BAR + 顶灯拉杆 + 币粒
- 双构图系统：宽卡 `420×300` / 窄卡 `300×430`，每个场景单独标定 `{s, ax, ay}`，
  保证主体落在窄卡安全区 `x ∈ [30,270]`，不再出现鱼尾、拉杆、筹码被裁

### 多分辨率适配
- `≥1921px`（2K/4K）：容器 2120px、行高 `62vh`、顶栏/Dock/字号整体放大，内容不再塌成小岛
- `landscape + max-height:700px`（Android 横屏 960×540 / 16:9）：四卡强制单行并吃满剩余高度，
  Dock 不再遮挡下排卡片
- `≤900px`：2×2 卡片，旗舰卡自动切窄构图；`≤720px` 收紧边距字号；
  `≤560px` 五张功能卡改图上字下均分一行
- 新增 `tests/lobby-shot.mjs`：1920×1080 / 2560×1440 / Android 横屏 / 手机竖屏 四分辨率截图回归

### 牌桌美术重制（麻将 / 红十）
- 新增共享台面组件 `games/TableSurface.vue`（`tone: emerald | wine`）：胡桃木外框 + 金线嵌条 +
  绒面织纹 + 顶灯光斑 + 双层暗角 + 出牌区内圈金线 + 朝鲜族四角角饰
- 麻将：中央罗盘（四门风 / 余牌数 / 出牌方指针 / 长白山纹章）、胶囊座位牌（门风金属方章 +
  ×N 手牌数 + 倒计时环）、胡桃木手牌托盘；`MjTile` 增加抛光斜切高光与雪晶暗纹牌背
- 红十：四家出牌改为围绕中心底盘四边排布，中心底盘空手时显示长白山纹章水印；
  座位牌与手牌托盘沿用同一材质语言（酒红）
- 横屏短屏（`max-height: 640px`）：左右两家竖排暗牌收敛为 `×N` 计数，自己的座位牌上移到托盘之上
- 新增 `tests/table-shot.mjs`（1920×1080 / 960×540@2x 各两桌截图回归）
- 规范回写 `docs/07-design-system.md` §3.5「牌桌规范」

### 捕鱼 / 水果机内页精修
- 捕鱼：水体改为连续深度渐变（`FillGradient`，近水面通透、越深越暗）+ 海面焦散波纹 +
  悬浮微粒 + 四边线性渐变暗角；鱼身增加背脊轮廓光；炮台放大 1.5× 并修复基座
  从未定位（一直留在画布左上角 (0,0)）的缺陷
- 水果机：转轴格子改为随视口自适应（此前 110×100 的硬上限让 1080p 下机台缩成一小块），
  新增顶部铭牌灯带、左右立柱、底部币槽与背景放射流光（60s 一圈）

### Emoji 全量清零（含管理后台）
- 后台导航新增原创线性图标组件 `admin-web/components/NavIcon.vue`（9 枚，24×24 / 线宽 1.7），
  替换 📊👥💰🎴⚙️📣🛡️📜🔐
- 捕鱼 Boss 预警 ⚠ → 原创三角警示矢量；自动开火 ⏸ → 双竖条指示
- 水果机免费旋转 ✨ → 原创星芒矢量；弹窗关闭 ✕ → 矢量叉号（含 hover 态）
- 全仓扫描确认：仅余扑克花色 ♠♥♦♣ 与文本对勾 ✓（均为正常排版字符，非 Emoji）

### 美术完美化（用户判定「不过关」后的整轮重做）
- 四张海报场景推倒重画：引入 SVG 渲染工具箱 —— Glow（模糊+叠加）/ Bloom（泛光）/ Shadow（投影）/
  DoF（远景虚化）/ Grain（绒面颗粒，feTurbulence）；主体改用径向渐变做体积光，加背脊/棱边轮廓光、
  吊灯体积光锥、星芒与尘光；「中」牌放大为真正的主视觉并带鎏金轮廓光；红十改双主牌 + 五张虚化背牌扇 +
  双筹码堆；金龙鱼改 pattern 鳞甲 + 径向体积 + 轮廓光；水果机改三层鎏金斜面机柜 + 玻璃反光 + 赔付线发光
- 大厅背景 v3「长白山夜色」：残月（遮罩挖出阴影，不再是黑盘）+ 双层泛光 + 月光束、天顶极光轻纱、
  远山主峰群立在顶部天幕带（雪冠 + 月光鎏金棱线 + 大气薄雾）、两翼近景山体做舞台侧幕、
  近脊落在卡片与 Dock 之间的可见带、松林剪影、胶片颗粒、闪烁星
- 海报卡改为「镶金实物」：外沿金属细边 + 内嵌渐变金框（遮罩法）+ 四角朝鲜族括角饰（内联 SVG）；
  标题改金属展示字（五段金渐变 + drop-shadow 浮雕 + 辉光）；副标题改香槟金
- 小屏：角饰 26→20px、金框内缩、副标题单行省略（此前「规칙 확인 완료」被折成两行）；
  麻将/红十窄卡重新标定，五萬不再贴边、红十桌沿贴近标题

### 大厅五个导航面板与弹窗
- 修复面板宽度塌陷：flex 子项上的 `margin: 0 auto` 会取消 `align-items: stretch`，
  四个面板在 1920 下实际只有 341px 宽（`max-width: 640px` 从未生效），改为显式 `width: 100%`
- 活动：桌面双栏（签到 | 任务）；签到格改为 84px 卡片，第 7 天周奖励高亮，已领带对勾、
  次日格上浮发光；任务进度条加金色渐变与发光
- 我的：桌面双栏（个人卡 + 数据 | 资产明细），数据格与卡片补齐材质三件套
- 战绩：时间筛选改为紧凑金色胶囊组（原为四条通栏按钮）；列表行加 hover 位移
- 好友：修复「添加」按钮宽度不足导致两字折行
- 新增 `ui/EmptyState.vue`：长白山纹章 + 主副文案的品牌化空状态，替换战绩/好友/
  资产明细/任务/排行榜/邮件/公告里的一行灰字「暂无内容」
- 弹窗 `ModalSheet`：高度上限从 84vh 收到 `min(84vh, 760px)`，补金色标题分隔线与材质三件套

### 测试
- 全绿 89 项：引擎单测 39 + 钱包集成 7 + 全栈 E2E 28 + 客户端 UI 冒烟 8 + 后台 UI 冒烟 7
- 新增 `tests/panel-shot.mjs`（五个导航面板 + 三个功能弹窗截图回归）
- `tests/ui-smoke.mjs` 选择器同步到新结构（`.poster-card.<gameId>` / `.dock .dock-item`）

## [0.1.0] - 2026-08-31 首个可运行全栈里程碑

### PHASE 0-1 需求/架构
- 竞品研究（欢乐斗地主/欢乐麻将/JJ/微乐/头部捕鱼/国际 Social Casino）→ COMPETITOR_ANALYSIS.md（功能矩阵+首发范围）
- 《延边麻将规则确认表》《红十规则确认表》：地区差异规则 100% 配置化，临时默认值待当地确认
- 架构定稿：Vue3+Pixi+Capacitor 客户端 / Node+TS 模块化服务群（22 服务模块）/ PostgreSQL+Redis / Docker+Nginx
- 资产合规：全虚拟娱乐资产，不可兑换/提现；无现金出入金代码

### PHASE 2-4 基座
- monorepo（pnpm workspace）+ 三端共享 @yanbian/protocol（事件/错误码/DTO）
- 46 表迁移：钱包四表触发器防篡改、流水分区、RBAC、审计；种子与规则包同步；管理员引导（随机初始密码+首登强改）
- server-core：pg/redis/pino 结构化日志/53bit 雪花 ID/JWT(HS256)/scrypt/HMAC/限流/Nonce/Redis 总线/轻量 metrics
- 账号体系：游客/短信/密码登录、双 Token 旋转（重放→全端下线+风控）、设备与登录日志、封禁检查

### PHASE 5-13 游戏与玩法
- @yanbian/game-common 四引擎（同构 WebCrypto RNG）：
  - 麻将：模块化牌型判定器/听牌/桌面状态机（优先级仲裁/过水/杠分/查叫/报听/回放事件流）
  - 红十：牌型解析比较/提示/身份亮明/独打双上倍率/零和结算
  - 捕鱼：波次脚本/滑窗频控/子弹一次性消耗/RTP 池控制器（10 万发实测收敛 96%±4%）
  - 水果机：卷轴条 CSPRNG/Wild/Scatter/免费旋转/演出分级；RTP 模拟器 40 万转实测 96.8%
- game-service：WS 网关（seq/requestId 幂等缓存/心跳/单点踢线/断线保活+快照重连）、房间/匹配（机器人补位）、
  四游戏宿主（计时/托管/多局轮庄/破产保护/结算入账/任务榜单）
- api-service：钱包（行锁+双录+结算单唯一）、战绩+回放、签到任务邮件好友公告排行、大厅与品牌白标配置

### PHASE 14-15 后台与安全
- 管理后台 API+前端：RBAC 到接口粒度、Dashboard 实时图表、用户管理（调账二次确认留痕/封禁/踢线）、
  金币流水/结算单、配置发布留痕（config_versions）、公告双语、系统邮件、风控事件、审计日志（不可篡改）
- 安全：三层限流、登录失败锁、Nonce/时间戳/签名基建、最小信息下发（他人手牌不出服务器）、CSPRNG

### PHASE 16-18 测试与部署
- 测试全绿：引擎单测 39 + 钱包集成 7 + 全栈 E2E 28 + 客户端 UI 冒烟 8 + 后台 UI 冒烟 8
- 部署：Dockerfile×2、docker-compose.prod（api×2/game/前端/pg WAL 归档/redis/每日备份/Prometheus）、
  Nginx HTTPS/WSS/限流、恢复演练脚本、GitHub Actions CI、.env.example
- 文档：架构/DB/协议/钱包/安全/设计系统/性能预算/部署与 RC 检查表（docs/01-10）

### 已知待办（详见 docs/10 §5）
- 规则确认表 ⏳ 项待当地顾问确认后发布正式规则包（后台可发布，零代码改动）
- 正式美术资产替换程序化占位；短信网关接入；真机压测与商店合规流程
