# UI Design System — 「玄夜鎏金」(Midnight Gilt)

> 视觉定位：现代东方高级娱乐会所 × 高品质手游。高级感来源 = 材质质感 + 体积光 + 暗背景衬托（竞品分析结论），拒绝饱和度堆叠、满屏土豪金、红金渐变、霓虹乱闪。
> 实现：apps/client-game/src/design/tokens.css（唯一来源），所有组件只允许引用 Token，禁止散写色值。

## 1. Design Tokens

### 色彩
| Token | 值 | 用途 |
|---|---|---|
| --bg-abyss | #0A0E14 | 最深背景（启动/游戏外框） |
| --bg-night | #10151F | 页面主背景（深蓝黑） |
| --bg-charcoal | #161C28 | 卡片底 / 面板 |
| --bg-elevated | #1D2432 | 浮层 / 弹窗 |
| --glass | rgba(29,36,50,.66) + blur(20px) | 玻璃拟态面板 |
| --gold-warm | #C9A063 | 主金（低饱和暖金：主按钮、强调描边） |
| --gold-champagne | #E6CFA3 | 香槟金（标题文字、高光） |
| --gold-deep | #8A6B3C | 金色暗部（描边渐变下沿） |
| --accent-jade | #3E9B8F | 玉青（辅助强调：成功、在线态） |
| --accent-crimson | #B5495B | 绛红（危险/输，低饱和，禁大面积） |
| --text-primary | #F2EDE3 | 主文字（暖白） |
| --text-secondary | #9AA3B2 | 次级文字 |
| --text-disabled | #5A6272 | 禁用 |
| --line-soft | rgba(201,160,99,.18) | 金色细分隔线 |

规则：金色仅用于「可交互强调 + 标题 + 描边」，面积占比 < 10%；大面积一律深色；输赢用 玉青/绛红 而非红绿荧光。

### 字体 / 字号
- 正文：system-ui 优先（PingFang SC / MiSans / Noto Sans CJK / Noto Sans KR）。
- 展示字体（自托管 OFL 子集，`design/fonts.css`）：中文标题 ZCOOL XiaoWei `--font-display-zh`、
  韩文标题 Nanum Myeongjo `--font-display-ko`、书法（门风 / 牌面）Ma Shan Zheng `--font-calligraphy`、
  拉丁字标 Cinzel `--font-brand`；详细字号表见 docs/11 §1.2，许可证见 `THIRD_PARTY_ASSETS.md`。
- 数字（金币/倒计时）：等宽变体 `font-variant-numeric: tabular-nums`。
- 字阶（px @375 宽基准，rem 缩放）：display 28 / h1 22 / h2 18 / body 15 / caption 13 / micro 11。行高 1.4–1.6。

### 间距 / 圆角 / 阴影
- 间距刻度：4 / 8 / 12 / 16 / 24 / 32 / 48。
- 圆角：卡片 16、按钮 12、弹窗 20、全屏面板 24、小标签 8。
- 阴影：`--shadow-card: 0 8px 24px rgba(0,0,0,.45)`；`--shadow-glow-gold: 0 0 18px rgba(201,160,99,.35)`（仅焦点/胜利态）。

### 动效
- 时长：微交互 120ms / 面板 240ms / 场景转场 400ms；缓动 `cubic-bezier(.22,.9,.32,1)`（快出缓入）。
- 全局 60FPS 目标；仅 transform/opacity 参与动画；低端档（设备打分）关闭粒子与模糊。

## 2. 组件规范（apps/client-game/src/ui/*）

| 组件 | 状态 | 要点 |
|---|---|---|
| Button | primary/secondary/danger/ghost/disabled/loading/pressed | primary=金渐变描边+深底+香槟金字；pressed 内凹 96% 缩放；loading 内嵌旋转纹 |
| Modal | 标准/全屏 | 玻璃拟态+金细描边，进场 240ms 缩放淡入，蒙层 rgba(6,8,12,.7) |
| Toast | info/success/error | 顶部滑入，2.4s，玉青/绛红左侧光条 |
| Input | 默认/聚焦/错误 | 深底、聚焦金描边呼吸光 |
| Card | 游戏入口/列表 | 大卡片带封面视差微动画与在线人数角标 |
| Loading | 页面/内联 | 金色细环+品牌纹样 |
| Skeleton | 列表/卡片 | 深灰底微光扫过 |
| EmptyState | 通用 | 线性插画+一句话+主按钮 |
| NavBar/TabBar | 底部五枚 | 大厅/活动/战绩/好友/我的；选中金色光点上浮 |
| HUD 数字 | 金币/钻石 | 滚动数字（不跳变），+/- 浮字 |

## 3. 布局与适配

- 响应式断面：手机竖屏（大厅）/ 手机横屏（麻将、红十、捕鱼强制横屏，水果机竖横皆可）/ 平板 / PC（居中舞台 + 环境暗场，最大 1440 逻辑宽）。
- 分辨率适配：1920×1080、1366×768、Android 主流 (360–430 逻辑宽)、全面屏/刘海屏——`env(safe-area-inset-*)` 全局注入，横屏游戏 UI 避让左右刘海区。
- DPI：矢量优先（SVG/CSS/程序化绘制），位图 @2x/@3x 图集。
- 游戏舞台：Pixi 画布固定逻辑分辨率 1624×750（横屏安全区）等比缩放 + 两侧延展背景。

## 3.5 牌桌规范（麻将 / 红十）

台面由共享组件 `apps/client-game/src/games/TableSurface.vue` 提供，`tone` 决定绒面配色
（`emerald` 麻将 / `wine` 红十），其余层次两桌完全一致：

| 层 | 内容 | 说明 |
| --- | --- | --- |
| 房间环境 | 根容器 radial（麻将 `#10261C→#05100C`，红十 `#241019→#0D050A`） | 桌外的暗场，让台面“浮”起来 |
| 外框 `rim` | 胡桃木斜向渐变 + 顶部受光 + 底部内阴影 + 外投影 | `inset: 3.2% 2.4%`，圆角 52px |
| 金线嵌条 `rim-inlay` | 1px 香槟金描边 + 金色外发光 | 桌沿的“镶嵌”质感 |
| 绒面 `felt` | 中心亮、四周暗的径向渐变（68%×78% @ 50% 34%） | 收窄的渐变半径是绒面不发飘的关键 |
| 织纹 `weave` | ±45° 双向 repeating-linear-gradient（≤2.2% 不透明度） | 绒布纤维感 |
| 顶灯光斑 `pool` | 椭圆暖光 + `blur(18px)` | 与吊灯同一光源逻辑 |
| 暗角 `vignette` | 径向 + 上下线性双层 | 把视线压到牌河/出牌区 |
| 出牌区内圈 `hairline` | 圆角矩形金色细线 | 告诉玩家“牌落在这里” |
| 四角角饰 `corners` | 朝鲜族直角括号（`non-scaling-stroke`） | 地域符号，极低对比 |

**麻将专属**

- 中央罗盘 `center-disc`：`clamp(132px, 15vh, 196px)`。翡翠底盘 + 双金环 + 朝鲜族菱格 +
  长白山双峰纹章；四向门风（庄家為東，逆时针 南→西→北）；中心显示余牌数；
  外圈金色指针指向当前出牌方，`transform 400ms var(--ease-out)`。
- 座位牌：胶囊玻璃 + 金色描边，含头像、门风金属方章、`×N` 手牌数、分数、倒计时环；
  轮到该家时描边转金并加 20px 金色外发光。
- 手牌托盘 `my-hand`：与桌沿同材质的胡桃木条盘（顶部受光 + 底部内阴影 + 上下双向投影）。
- 牌 `MjTile`：牌面 = riichi-mahjong-tiles（CC0）`Front.svg` 牌体 + 花色叠层两张 `<img>` 合成，
  `kind 0–33` 按引擎顺序映射到 Man/Sou/Pin/Ton/Nan/Shaa/Pei/Chun/Hatsu/Haku；牌高比 1.34；
  122° 抛光斜切高光 + 底部绿色侧面构成 2.5D；牌背为延边雪晶菱格暗纹（原创，不用 riichi 红色牌背）。
- 罗盘门风与座位门风章使用毛笔楷书 `--font-calligraphy`。

**红十专属**

- 出牌区 `play-zone`：四家最近一手围绕中心底盘的四边排布（下=自己、右、上、左），
  视线不再被拉到桌角；中心底盘在无人出牌时显示长白山纹章水印。
- 座位牌与手牌托盘沿用同一材质语言，配色换为酒红。
- 牌 `PlayCard`：牌面 = Vector Playing Cards（公共领域），数字牌 SVG、J/Q/K 为 480×672 WebP；
  `SUIT_CODE = [D, C, H, S]` 与引擎花色顺序（方块/梅花/红桃/黑桃）对齐；牌高比 1.45；
  牌背（藏青 + 金色菱格）、红十金色描边与「十」角标为原创。

**横屏短屏（`max-height: 640px`）**：左右两家的竖排暗牌会超出可视高度，改为只保留座位牌上的
`×N` 计数；自己的座位牌上移到托盘之上，避免压住第一张手牌。

截图回归：`node tests/table-shot.mjs`（1920×1080 与 960×540@2x 各两桌）。

## 4. 关键界面动效清单

大厅进入（LOGO 光扫→卡片依次浮入 stagger 60ms）、游戏入口按压（卡片下压+光晕）、匹配（雷达波纹）、发牌（弧线飞牌 40ms/张）、摸牌（滑入+提亮）、出牌（抛物线+落桌音）、碰杠（牌组合并震动 1 帧）、胡牌（金色粒子+大字+慢镜 300ms）、捕鱼按打击感公式、水果机按 Spin 节奏公式、结算（数字滚动+名次浮入）。

## 5. 品牌与白标

品牌名（中/朝/英）、LOGO 图、主色三值、启动页文案均来自 config-service `brand.*` 配置；客户端启动拉取并缓存。默认品牌「YANBIAN GAME / 延边娱乐」。所有美术资产为程序化绘制或原创占位（正式发布前由美术团队按本 Token 体系替换，替换只动资源包不动代码）。
