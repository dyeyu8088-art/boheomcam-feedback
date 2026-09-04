# 11 · 大厅视觉规范（YANBIAN GAME 延边游戏）

> 本文是**大厅首页**的商业级美术落地规范，覆盖设计 Token、图标规范、游戏海报卡规范、动效规范、
> 多分辨率适配。所有数值都以代码为准（`apps/client-game/src/design/tokens.css` 为唯一 Token 来源），
> 本文与代码不一致时以代码为准，并应回写本文。
>
> **信息架构未做任何改动**：左上头像/昵称/UID、右上金币/钻石/设置、顶部公告条、
> 签到/任务/排行榜/邮件/公告、四个游戏、底部五个导航——全部保留，只重做美术表现。

---

## 0. 设计命题

| 关键词 | 落地手段 |
| --- | --- |
| 高级东方娱乐 / 现代东方 | 抽象几何暗纹（非具象龙凤云纹）、低对比金线、留白 |
| 延边地域气质 | 长白山双峰轮廓、雪线、松林剪影、朝鲜族窗棂式菱格纹 |
| 高端私人会所 / 轻奢 | 深午夜蓝黑底 + 低饱和香槟金，绝不使用大面积土豪金 |
| 深色 / 空间感 | 三层背景（远景/中景/前景）+ 中央微亮四周压暗 |
| 电影级光影 | 中央光源 radial + 冷月 + 雾带 + 暗角，材质用「边缘高光 + 内阴影 + 环境光」三件套 |
| 高级玻璃材质 | `backdrop-filter: blur()` + 内高光描边 + 渐变边框遮罩（`mask-composite`） |
| 3D 游戏卡片 | 每张卡是一幅**独立矢量场景海报**，不是色块 + 文案 |

### 明令禁止（已在实现中规避）

- ❌ 大面积土豪金、纯 `#FF0000` 大红、廉价霓虹、廉价网页渐变
- ❌ 任何 Emoji（🀄🐟🍒💰💎⚙️🦊📅🎯🏆✉️📣 等）——全局零 Emoji，见 §2
- ❌ 普通 Bootstrap 卡片、过度扁平化、儿童卡通感
- ❌ 纯黑 `#000000` 背景（最深只到 `--bg-abyss: #070c15`）

---

## 1. Design Token

Token 定义在 `apps/client-game/src/design/tokens.css`（设计系统「玄夜鎏金」v2）。

### 1.1 色彩

**背景（三层空间）**

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg-abyss` | `#070C15` | 远景底色 / `body` 背景（禁用纯黑） |
| `--bg-night` | `#0B1220` | 中景 |
| `--bg-charcoal` | `#111A2B` | Surface |
| `--bg-elevated` | `#17223A` | 浮层 / 弹窗 |
| `--glass` | `rgba(18,27,45,.62)` | 玻璃面板底 |
| `--glass-strong` | `rgba(14,21,36,.86)` | 强玻璃（Dock） |

**金属主色（低饱和香槟金，唯一强调色系）**

| Token | 值 | 用途 |
| --- | --- | --- |
| `--gold-pale` | `#F6E6BD` | 金属高光端 |
| `--gold-champagne` | `#E6CFA3` | 强调文字 / 选中态 |
| `--gold-warm` | `#C9A063` | 主金 / 描边 / 分隔 |
| `--gold-deep` | `#8A6B3C` | 金属暗面 |
| `--gold-shadow` | `#6E5426` | 金属最暗 / 刻线 |

**辅助色（严格三色，不再扩张）**

| Token | 值 | 语义 |
| --- | --- | --- |
| `--accent-jade` | `#4BB39C` | 在线 / 胜 / 正向 |
| `--accent-ice` | `#7FB8E8` | 钻石 / 信息 / 等级 |
| `--accent-crimson` | `#B5495B` | 危险 / 负向（柔和酒红，非纯红） |

### 1.2 字体层级（四级）

| 级别 | 字号 / 字重 | Token | 用例 |
| --- | --- | --- | --- |
| L1 主标题 | 32px / 800（旗舰卡 41px @2K） | `--text-primary` `#F4F0E6` | 游戏名「延边麻将」 |
| L2 次标题 | 16–23px / 700–800 | `--text-primary` | 昵称、非旗舰游戏名、资产数值 |
| L3 功能文本 | 13px / 600 | `--text-strong` `#DFE4EC` | 功能卡文字、Dock 文字、公告 |
| L4 弱信息 | 10.5–12px / 400–700 | `--text-secondary` `#97A3B8` / `--text-disabled` `#5D6A80` | 卡片副标题、UID、在线人数 |

- 数字统一 `.num { font-variant-numeric: tabular-nums }`，避免跳数抖动。
- 正文 / 功能文本字族 `system-ui / PingFang SC / MiSans / Noto Sans CJK SC / Noto Sans KR`。
- 游戏名使用金属渐变文字（`background-clip: text`，白→米→暗金三段），不是纯色，
  外加三层 `drop-shadow`（深棕描边 → 黑色离地投影 → 金色柔光）。

**展示字体（自托管子集，`design/fonts.css`，许可证见 `THIRD_PARTY_NOTICES.md`）**

| Token | 字体 | 用途 | 字重 / 尺寸 |
| --- | --- | --- | --- |
| `--font-display-zh` | ZCOOL XiaoWei（OFL） | 中文游戏名、登录字标、大厅品牌字 | 400；卡片 30px / 旗舰 46px / 2K 36·54 / ≤720 22 / 横屏短屏 21·27 |
| `--font-display-ko` | Nanum Myeongjo ExtraBold（OFL） | 韩文游戏名 / 品牌字（`.ko` 修饰类） | 800；比中文小 2–4px（26 / 2K 31·44 / ≤720 19） |
| `--font-calligraphy` | Ma Shan Zheng（OFL） | 麻将罗盘门风、座位门风章、海报书法字 | 400 |
| `--font-brand` | Cinzel（OFL） | `YANBIAN GAME` 拉丁字标 | 600，字距 `.4em` |

- 子集只包含实际用到的字形（游戏名 / 品牌 / 牌面汉字 + ASCII），每个 4–25 KB，`font-display: swap`；
  新增用到展示字体的文案，必须同步更新 `THIRD_PARTY_NOTICES.md` 里的 `pyftsubset --text` 并重新生成。
- 语言切换只换字族与字号，不换布局：`.p-title.ko` / `.b-cn.ko` / `.mark.ko`。

### 1.3 材质与光影（不是简单 box-shadow）

任何"有体积"的容器都必须同时具备三件套：

```css
box-shadow:
  inset 0 1px 0 rgba(255,255,255,.09),      /* ① 顶部边缘受光 */
  inset 0 -14px 26px rgba(0,0,0,.32),        /* ② 底部内阴影（体积） */
  0 10px 30px rgba(0,0,0,.5);                /* ③ 外投影（离地） */
```

Token：`--edge-inner`（①+②）、`--edge-gold`、`--shadow-card`、`--shadow-lift`、`--shadow-glow-gold`。

金色渐变描边用**边框遮罩**实现（公告条 `.n-edge`），而不是 `border: 1px solid gold`：

```css
background: linear-gradient(90deg, rgba(201,160,99,.40), rgba(201,160,99,.08) 40%, rgba(201,160,99,.32)) border-box;
-webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
-webkit-mask-composite: xor; mask-composite: exclude;
```

### 1.4 圆角

| Token | 值 | 用途 |
| --- | --- | --- |
| `--radius-poster` | 22px（2K 28px / 横屏短屏 18px） | 游戏海报卡 |
| `--radius-card` | 18px | 通用卡片 |
| `--radius-btn` | 12px | 按钮 |
| `--radius-modal` | 20px | 弹窗 |
| — | 999px | 玩家容器、资产胶囊、公告条（22px） |

---

## 2. 图标规范（零 Emoji，全部原创矢量）

实现：`apps/client-game/src/ui/AppIcon.vue`（`YANBIAN ENTERTAINMENT ICON SYSTEM`）。

### 2.1 通用规则

- 视窗统一 **24×24**，`viewBox="0 0 24 24"`。
- 光源固定 **左上 45°**：高光在左上，内阴影在右下。
- 线性图标线宽 **1.8**，端点 `round`，圆角语言 2px。
- 两个族群：
  - **solid（2.5D 金属质感）**：资产与功能主图标 —— `coin` `gem` `signin` `target` `trophy` `mail` `megaphone`
  - **line（线性）**：导航与工具 —— `hall` `gift` `scroll` `friends` `user` `gear` `back` `chat` `service`
- 渐变以 `gold / goldDeep / ice / steel / jade` 五套定义，id 按实例加前缀避免多实例冲突。

### 2.2 资产图标（替代 💰 / 💎）

| 图标 | 造型 | 材质 |
| --- | --- | --- |
| `coin` 金币 | 正圆 + 内环刻线 + 中央方孔（东方古钱语义抽象化） | `gold` 渐变 + 左上椭圆高光 + 右下 `goldDeep` 暗环 |
| `gem` 钻石 | 上台面 + 下亭部的多切面棱形 | `ice` 渐变 + 单条白色切面高光，绝不用 Emoji 蓝钻 |

### 2.3 头像系统（替代 🦊 等 Emoji 头像）

实现：`apps/client-game/src/ui/AvatarBadge.vue`。

- **程序化纹章**：`avatarId` → `crest`（12 种）× `palette`（8 套），稳定可复现，无需美术切图。
- 12 种纹章：长白山双峰 / 松枝 / 雪晶 / 云纹 / 鹤形 / 波涛 / 虎纹 / 六角窗棂 / 火焰 / 太极环 / 印章方 / 竹节。
- 底板为深色金属圆角方，带 `radial` 顶光；`vip > 0` 时叠加金环呼吸光（`glow-pulse` 2.8s）。
- 尺寸：桌面 56、2K 70、横屏短屏 40（CSS `!important` 覆盖内联尺寸）。

---

## 3. 大厅结构与尺寸

```
┌────────────────────────────────────────────────────────────┐
│ 顶栏 topbar                                                 │
│  [玩家容器]            [品牌字标]         [金币][钻石][设置]  │
├────────────────────────────────────────────────────────────┤
│ toprow：[公告条 flex:1 ][签到][任务][排行榜][邮件][公告]      │
│                                                            │
│ posters（非对称单行）                                        │
│  ┌────────────┬───────┬───────┬───────┐                    │
│  │ 延边麻将    │ 红十   │ 捕鱼   │ 黄金水果│  1.62fr:1:1:1     │
│  │ （旗舰）    │       │       │       │                    │
│  └────────────┴───────┴───────┴───────┘                    │
│                                                            │
│                  ▁▁▁ 悬浮 Dock ▁▁▁                          │
└────────────────────────────────────────────────────────────┘
```

### 3.1 三层空间背景（v3「长白山夜色」）

实现：`views/lobby/LobbyBackdrop.vue`。

| 层 | 内容 | 目的 |
| --- | --- | --- |
| **L1 远景**（SVG 1920×1080 slice，见下方 v3 构图） | `bdSky` 三段渐变 → `bdWeave` 朝鲜族菱格暗纹（不透明度 0.045–0.055）→ `bdCore` 中央 radial 光源 → 冷月（1712,150）→ 星尘 → 长白山远/近山脊 → 主峰雪线 → 松林剪影 | 「四周暗、中央微亮」，把注意力压到游戏卡区 |
| **L2 中景** | `halo-core`（62vw×42vh 冷蓝）+ `halo-warm`（右上暖金）+ `halo-cool`（左下冷蓝），`blur(90px)` | 电影级光晕，两个 halo 做 16s/20s 慢浮动 |
| **L3 前景** | 22 粒金色微粒 `mote-rise`（16–28s 各自相位）+ `vignette` 暗角 | 空气感，绝不喧宾夺主 |

**v3 构图原则**：卡片区占据画面 45–80% 高度，所以背景的戏剧性必须放在**卡片之外的三个可见带**——
顶部天幕带（y 78–190：残月 + 泛光 + 月光束、极光轻纱、远山主峰群带雪冠与月光鎏金棱线、大气薄雾）、
两侧翼（x<300 / x>1620：近景山体做舞台侧幕）、底部带（y 860–980：近脊 + 雾带 + 松林）。
残月用 `<mask>` 挖出阴影而不是画一个深色圆盘，否则在泛光上会读成黑洞。
极光只在天顶（y<330），是一层轻纱（0.26/0.16），色相偏冷蓝青，不与香槟金打架。

**禁用纯黑**：最深处为 `#050A11`（远景渐变末端），`body` 为 `#070C15`。

### 3.2 玩家信息容器（左上）

胶囊（`border-radius: 999px`）+ 玻璃材质：

- 头像 `AvatarBadge` 56px（2K 70 / 横屏 40）
- L2 昵称 16px/700 → L4 行：`UID xxxxxxxx` + `Lv.n` 冰蓝描边徽章 +（VIP 时）金色 `VIPn` 徽章
- `.p-line` 强制 `nowrap`，窄屏昵称 `max-width: 88px` + 省略号，永不折行

### 3.3 资产胶囊（右上）

- 两个独立胶囊：`AppIcon coin` + 数值、`AppIcon gem` + 数值，均 `height: 40px`（2K 52 / 横屏 34）
- 数值 `--text-primary` 14.5px/700 + `tabular-nums` + `white-space: nowrap`（防止「10.0万」被挤断）
- 设置为 40×40 圆角方按钮，hover 旋转 38°

### 3.4 公告条（玻璃）

- 高 52px，`border-radius: 22px`，`backdrop-filter: blur(14px)`
- 三重阴影：顶部高光 + 内侧金色环境光 `inset 0 0 22px rgba(201,160,99,.07)` + 外投影
- 渐变金色描边（`mask-composite` 方案，见 §1.3）
- 文字 26s 线性滚动；左侧 `AppIcon megaphone` 金色

### 3.5 五个功能卡

- 106×52，`border-radius: 15px`，图标底板 34×34（`radial` 顶光 + 内阴影）
- 与公告条同处 `toprow` 一行 —— **合并这一行是消除大片空白带的关键**
- 入场逐个延迟 `60 + i×40 ms`

### 3.6 悬浮 Dock 导航

| 分辨率 | 宽 | 高 |
| --- | --- | --- |
| 1920 / 2560 以下 | `min(620px, 100vw-40px)` | 86px |
| ≥1921（2K） | `min(780px, 100vw-60px)` | 108px |
| 横屏短屏 | `min(520px, 100vw-32px)` | 60px |
| 手机竖屏 | `min(620px, 100vw-40px)` | 74px |

（规范要求 560–680×82–96，桌面基准 620×86 落在区间内。）

- 强玻璃 `blur(22px) saturate(1.15)`，圆角 26px
- 选中项：图标底板亮起金色 radial + 底部 3px 金色滑条 `dock-glow`，`transform 320ms` 平滑滑动
- 图标为 line 族群，选中转 `--gold-champagne`

---

## 4. 游戏海报卡规范

实现：`views/lobby/GameGrid.vue`（布局）+ `views/lobby/GameCardArt.vue`（场景）。

### 4.1 布局：非对称，麻将最大

```css
grid-template-columns: 1.62fr 1fr 1fr 1fr;   /* ≥1080px */
grid-auto-rows: clamp(330px, 60vh, 600px);   /* 2K: clamp(330px, 62vh, 780px) */
```

- `ORDER = ['mahjong_yanbian','hongshi','fishing','slot_fruit']`，旗舰恒定首位
- 游戏区占页面高度约 **55%**（1920×1080：600 / 1080 ≈ 56%）
- 卡片 z 层：`p-art`（场景）→ `p-scrim`（底部压暗渐变）→ `p-sheen`（掠光）→ `p-tags` / `p-body`

### 4.1.5 渲染工具箱（每张场景的 `<defs>` 里都有一套，id 加游戏前缀）

| 滤镜 | 定义 | 用途 |
| --- | --- | --- |
| `*Glow` | `feGaussianBlur 3` + `feMerge(blur, source)` | 星芒、轮廓光、灯胆、网坠 —— 主体保留、外沿发光 |
| `*Bloom` | `feGaussianBlur 10–12`（纯模糊） | 主视觉背后的光晕、吊灯泛光 —— 单独一层，不与主体合并 |
| `*SoftBloom` | `feGaussianBlur 4–6` | 光锥、投影软化、尘光 |
| `*Shadow` | `feDropShadow dy 12–14 / std 7–10 / 0.7` | 牌、卡、机柜的离地投影 |
| `*Dof` | `feGaussianBlur 1.2–1.6` | 远景（屏风、牌墙、背牌扇、远处鱼群）虚化，拉纵深 |
| `*Grain` | `feTurbulence fractalNoise 0.8–0.85` → 仅取 alpha 0.16 | 绒面桌布的织物颗粒 |

体积感的基本手法：主体用 **径向渐变**（高光点在左上 28%/20%），叠一层 **腹部暗面** 线性渐变，
再压一条 **背脊/棱边轮廓光**（`*Rim` 渐变描边 + `*Glow`）。这三层缺一不可，缺了就回到扁平贴纸。

### 4.2 四张场景规格

| 卡 | 场景 | 主体 | 关键细节 |
| --- | --- | --- | --- |
| **延边麻将**（旗舰・宽构图） | 翡翠牌桌 + 东方屏风 + 黄铜吊灯 | 立体「中」牌 + 伍萬 + 五筒（riichi-mahjong-tiles 真实牌面，CC0） | 椭圆绒面桌 + 金色桌沿 + 七张 2.5D 牌墙（顶面斜切 + 正面 + 桌面投影）+ 骰子 + 筹码 + 长白山极淡轮廓 + 屏风立柱 |
| **红十** | 酒红绒桌 + 会所拱券 + 黄铜吊灯光锥 | 红桃 10 + 方块 10 双主牌（Vector Playing Cards 真实牌面，公共领域） | 扇形背牌（金色对角纹）+ 三层筹码堆 + 两条慢速烟雾（22s/28s 反向） |

- 主牌用 `<image href="/assets/mahjong/tiles/Front.svg">` + 花色叠层 / `<image href="/assets/red10/cards/10H.svg">` 嵌入场景，
  侧面、投影、光照仍由场景滤镜（`*Shadow` / `*Glow`）完成，素材只提供牌面本身。
| **捕鱼** | 深海 + 海面焦散 + 双道光柱 | 金龙鱼（Boss 级） | 四排裁切鳞甲、双叶尾鳍带鳍骨、背/腹/胸鳍、鳃盖双弧、龙须、**背脊轮廓光**（金属逆光的关键）、**金色渔网**罩住鱼身后半（网格 + 网绳 + 网坠 + 收口绳）、六枚爆金、海床剪影 + 珊瑚 + 上升气泡 |
| **黄金水果** | 黑金转轮机 + 12 道慢转放射流光 | 樱桃 / 红 7 / BAR 三符号 | 金属机框渐变 + 筒身上下压暗 + 列分隔 + 顶部三灯 + 拉杆红球 + 六枚币粒 + 两点星芒 |

### 4.3 双构图系统（关键工程约束）

同一场景要同时活在**宽卡**（旗舰 ≈0.92 宽高比）与**窄卡**（≈0.57）里，
`preserveAspectRatio="xMidYMid slice"` 会按较大方向裁切，因此：

```ts
const vb = layout === 'tall' ? '0 0 300 430' : '0 0 420 300';

// 窄卡：每个场景单独标定，anchor 点被放到窄卡 (150, 182)
const TALL = {
  mahjong_yanbian: { s: 1.00, ax: 210, ay: 186 },
  hongshi:         { s: 0.80, ax: 211, ay: 206 },
  fishing:         { s: 0.80, ax: 185, ay: 168 },
  slot_fruit:      { s: 0.68, ax: 214, ay: 158 },
};
```

**窄卡安全区**：`x ∈ [30, 270]`、主体 `y ∈ [70, 340]`。
超出即会被裁（鱼尾、拉杆红球、筹码堆都曾因此被切掉）。新增场景必须按此标定。

**宽卡**：`translate(0 -26)`——上移过多会把吊灯/屏风裁掉，上移过少主体会被底部文字压住。

旗舰卡在 **≤900px** 时会从 2×2 网格变成竖卡，此时 `artLayout()` 自动切到 `tall` 构图
（`window.matchMedia` 响应式，非纯 CSS，因为 viewBox 必须换）。

### 4.3.5 金框与角饰（把卡片读成「镶金的实物」）

- 外沿：`1px rgba(201,160,99,.22)` 金属细边 + 顶部受光 + 底部内阴影 + `0 22px 50px` 离地投影
- 内嵌金框 `.p-frame`：`inset: 9px`，渐变描边用遮罩法（`mask-composite: exclude`），四角亮、中段暗
- 角饰 `.p-corner`：26px 内联 SVG 朝鲜族括角 + 小菱形，四角镜像；小屏 20px
- hover：上浮 7px，外沿转亮金，外发光 34px

### 4.4 卡片文字与角标

- 标题：旗舰 38px/900（2K 41px），其余 25px/900（2K 29px）；五段金属渐变文字。
  `background-clip: text` 下 `text-shadow` 会盖住字面，浮雕与辉光改用 `filter: drop-shadow` 三连：
  `0 1px 0 深棕`（浮雕）→ `0 4px 8px 黑`（离地）→ `0 0 9px 金`（辉光）
- 副标题：12–13px `--text-secondary`
- 底部：翡翠绿在线人数（2.4s 呼吸圆点）+ hover 才出现的「进入游戏 ›」
- 角标：麻将「推荐」金色，捕鱼「火爆」酒红；11px/800，`letter-spacing: .06em`
- 底部压暗 `p-scrim`：`transparent 34% → rgba(4,8,14,.68) 74% → rgba(3,6,11,.92) 100%`，
  保证任意场景下文字对比度都达标（窄屏加强到 62%/95%）

---

## 5. 动效规范（克制，服务于信息，不炫技）

| 动效 | 时长 | 曲线 | 说明 |
| --- | --- | --- | --- |
| 顶栏入场 `fade-down` | 420ms | `--ease-out` | 向下淡入 12px |
| Dock 入场 `fade-up` | 460ms | `--ease-out` | 向上淡入 16px |
| 公告条 / 功能卡 `rise-in` | 420ms | `--ease-out` | 逐个延迟 `60 + i×40 ms` |
| 海报卡 `rise-in` | 460ms | `--ease-out` | 逐个延迟 `120 + i×70 ms` |
| 卡片 hover | 200ms | `--ease-out` | `translateY(-6px)` + 金色描边 + 光晕 |
| 卡片场景 hover 推近 | 420ms | `--ease-out` | `scale(1.045)`（视差感） |
| 卡片掠光 `p-sheen` | 900ms | `--ease-out` | 仅 hover 触发，`-130% → 130%` |
| 卡片按下 | 200ms | `--ease-out` | `translateY(-2px) scale(.985)` |
| Dock 滑条 | 320ms | `--ease-out` | `translateX(index × 100%)` |
| 在线圆点 `pulse-dot` | 2.4s | `ease-in-out` | 循环，0.45↔1 透明度 |
| VIP 金环 `glow-pulse` | 2.8s | `ease-in-out` | 循环 |
| 背景雾带 `mist-drift` | 34s / 46s | `ease-in-out alternate` | 两条反向 |
| 背景光晕 `float-slow` | 16s / 20s | `ease-in-out` | 反向 |
| 金色微粒 `mote-rise` | 16–28s | `linear` | 22 粒各自相位 |
| 场景微动（烟雾/光柱/气泡） | 6–28s | `ease` | 幅度 ≤14px，绝不抢主体 |

**基准 Token**：`--dur-micro 120ms` / `--dur-panel 240ms` / `--dur-scene 400ms`，
统一曲线 `--ease-out: cubic-bezier(.22,.9,.32,1)`。

原则：**交互反馈 ≤ 460ms，环境动效 ≥ 2.4s**，中间地带留空，避免"到处都在动"的廉价感。

---

## 6. 多分辨率适配

断点策略（**先按方向和高度分，再按宽度分**——横屏短屏是 Android 的主战场）：

| 断点 | 场景 | 关键变化 |
| --- | --- | --- |
| `≥1921px` | 2K / 4K 桌面 | 容器上限 2120px；卡片行高 `clamp(330px,62vh,780px)`；顶栏、Dock、功能卡、字号整体放大（头像 70、胶囊 52、Dock 108、旗舰标题 41px） |
| `≥1080px` | 1920×1080 桌面基准 | 四卡单行 `1.62fr 1fr 1fr 1fr`，行高 `clamp(330px,60vh,600px)`，容器 1680px |
| `(orientation: landscape) and (max-height: 700px)` | **Android 横屏 960×540 / 16:9 手机横屏 / 平板横屏** | 四卡强制单行；`.grid-wrap { flex:1 }` + `.posters { grid-auto-rows: minmax(0,1fr) }` 让卡片吃满剩余高度，**永不被 Dock 遮挡**；顶栏 / Dock / 功能卡整体压缩（头像 40、胶囊 34、Dock 60、功能卡 80×40） |
| `(orientation: landscape) and (max-height: 430px)` | 极窄横屏（667×375） | 功能卡改为可横滑 |
| `≤900px` | 手机 / 小平板竖屏 | 海报卡 2×2；旗舰卡切 `tall` 构图；功能卡可横滑 |
| `≤720px` | 手机竖屏 | 边距 26→14；标题 18px；副标题 11px；`p-scrim` 加强；Dock 74px；玩家容器收紧 |
| `≤560px` | 小屏手机（414×896 等） | 五张功能卡改**图上字下**均分一行，不再横向裁切 |

### 6.1 四个验收分辨率

| 名称 | 视口 | DPR | 验收点 |
| --- | --- | --- | --- |
| `pc-1920` | 1920×1080 | 1 | 基准稿。四卡单行、非对称、游戏区约 56% 高度 |
| `pc-2560` | 2560×1440 | 1 | 内容不塌成小岛（容器 2120px），字号图标同步放大 |
| `android-land` | 960×540 | 2 | 四卡单行且完整可见，Dock 不遮挡，主体不被裁 |
| `phone-portrait` | 414×896 | 2 | 2×2 卡、五功能卡一行、UID 不折行、标题不压主体 |

回归脚本：

```bash
SHOT_DIR=/path/to/shots node tests/lobby-shot.mjs
```

### 6.2 安全区

顶栏 / 内容区 / Dock 全部叠加 `env(safe-area-inset-*)`：

```css
padding: calc(var(--safe-top) + 16px) max(var(--safe-right), 26px) 12px max(var(--safe-left), 26px);
bottom: calc(var(--safe-bottom) + 18px);   /* Dock */
```

刘海屏、Android 手势条、iPad 圆角都不会压到内容。

---

## 7. 品牌识别

| 元素 | 规格 |
| --- | --- |
| 字标 | `延边娱乐` 21px/400 `--font-display-zh`（韩文 18px/800 `--font-display-ko`），字距 `.34em`，金属三段渐变文字；下方 `YANBIAN GAME` 9.5px/600 `--font-brand`（Cinzel），字距 `.4em`，`--gold-warm` 75% |
| 标志 | 44×44 SVG：双同心金环 + 长白山双峰折线 + 峰侧圆（雪/日）+ 底部横线；`drop-shadow` 金色柔光 |
| 地域符号 | 长白山轮廓（背景山脊 + 麻将卡内极淡轮廓 + 头像纹章 0 号）、雪线、松林剪影、朝鲜族窗棂菱格纹（背景 `bdWeave` + 麻将屏风 `mjScreen`） |
| 可配置 | 品牌名（中/韩/英）由后台 `brand` 配置下发，前端 `user.brand` 读取，不硬编码 |
| `≤1180px` | 字标隐藏，避免与玩家容器/资产胶囊挤压 |

**原创性与素材边界**：Logo / UI / Icon / 头像纹章 / 背景 / 牌桌 / 牌背 / 鱼类 / 炮台 / 水果机符号 / 动画
均为本项目矢量绘制（SVG / Pixi Graphics），无竞品资源提取、无反编译内容。
仅麻将牌面（CC0）、扑克牌面（公共领域）与四款展示字体（OFL）来自 GitHub 开源仓库，
许可证文件随素材入库，来源与合规说明见 [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)。

---

## 8. 自我审查清单（每次改动大厅必须重跑）

| 检查项 | 结论 |
| --- | --- |
| 有没有廉价感？ | 无。深色低饱和 + 三层空间 + 材质三件套；无廉价网页渐变、无大红大金 |
| 有没有 Emoji？ | 零。`AppIcon` + `AvatarBadge` 全量替代，`format.ts` 中 `avatarEmoji` 已删除 |
| 游戏卡是否像真正的游戏宣传入口？ | 是。四张均为独立矢量场景海报（牌桌 / 会所 / 深海捕捞 / 转轮机），非色块 + 文案 |
| 主次层级是否明显？ | 是。旗舰 1.62fr + 标题 32px vs 23px + 金色「推荐」角标；非对称栅格 |
| 是否还有大片无意义空白？ | 否。公告条与功能卡合并为一行；卡片行高 `60vh`；2K 容器放大到 2120px；内容区垂直居中 |
| UI 是否太像网页后台？ | 否。悬浮 Dock、胶囊资产、玻璃公告条、海报卡、掠光与光晕，无表格式布局 |
| 是否具有延边游戏自己的品牌？ | 是。长白山 / 雪 / 松 / 朝鲜族纹样贯穿背景、纹章、麻将场景；字标 + 双环山峰标志 |

### 新增游戏时的落地检查表

1. 在 `GameCardArt.vue` 新增场景 `<svg>`，**必须**用 `:viewBox="vb"` + `<g :transform="fit">` 包裹。
2. 在 `TALL` 表中登记该游戏的 `{ s, ax, ay }`，并验证主体落在窄卡安全区 `x ∈ [30,270]`。
3. 场景内所有渐变 / clipPath 的 `id` 加游戏前缀（`mj*` `hs*` `fs*` `sl*`），避免跨卡冲突。
4. 跑 `node tests/lobby-shot.mjs`，四个分辨率逐张目视验收。
5. 跑 `node tests/ui-smoke.mjs`（大厅卡片选择器为 `.poster-card.<gameId>`）。

---

## v4 · 四游戏大厅（2026-09-04，用户规格）

> 本节为当前实现（`views/LobbyView.vue` / `views/lobby/GameGrid.vue` / `views/lobby/LobbyBackdrop.vue` / `ui/LobbyLogo.vue` / `views/lobby/SupportPanel.vue`），与上文旧版信息架构冲突处以本节为准。

### 信息架构

| 区域 | 内容 |
| --- | --- |
| 顶栏左 | 头像 / 昵称 / ID / 等级（`PlayerProfile`） |
| 顶栏中 | **HTML Logo**（`LobbyLogo.vue`）：金色圆徽（长白山三峰 + 天池 + 海兰江水纹 + 朝阳，原创 SVG）+ 文字「延边游戏 / 연변 게임」+ `YANBIAN GAME`，文字随语言切换，不烙进图片 |
| 顶栏右 | 金币（平台金币 `coin_yanbian`，无货币符号）· 钻石 · 语言切换（中 ⇄ 한）· 设置 ·（竖屏）菜单按钮 |
| 公告栏 | 喇叭图标 + 自动横向滚动；无公告时显示「欢迎来到延边游戏大厅 / 연변 게임에 오신 것을 환영합니다」；`reduce-motion` 时静态显示 |
| 游戏卡 | **只保留四款**：延边麻将 / 延边红十 / 捕鱼达人 / 水果机，2×2 横向卡片（左插画 46% / 右文字）：名称、副标题、状态（开发中 / 立即试玩）、进入按钮；不显示在线人数（不伪造数据）；轮盘 / 股票路由与逻辑保留但不在大厅出现 |
| 右侧快捷 | 活动 / 任务 / 邮件 / 客服 + **更多**（VIP / 排行 / 公告 / 福利 / 比赛） |
| 底部导航 | 大厅 / 游戏 / 好友 / 背包 / 商店 |
| 客服 | 真实工单系统：`/api/v1/support/*`（创建 / 列表 / 详情 / 追加留言 / 关闭）+ 后台 `/api/admin/v1/support/*`（分页 / 回复 / 关闭，权限 `support.manage`，写操作进 `audit_logs`）+ 管理后台「客服工单」页 |

副标题（i18n `game.<id>.desc`）：麻将「正宗延边玩法 / 정통 연변 규칙」· 红十「本地规则 · 好友对战 / 지역 규칙 · 친구 대전」· 捕鱼「深海狩猎 · 挑战Boss / 심해 사냥 · 보스 도전」· 水果机「休闲转盘 · 趣味奖励 / 과일 릴 · 재미있는 보상」。

### 卡片插画（图文分离，全部程序合成）

| 游戏 | 素材层 | 许可证 | 动效 |
| --- | --- | --- | --- |
| 延边麻将 | 牌身 `Front.svg` + 牌面 伍萬 / 三筒 / 七索 / 發 / 中（riichi-mahjong-tiles）扇形展开 + 金色星光 | CC0 | 星光闪烁 |
| 延边红十 | 7♣ K♥ 10♦ 10♥ A♠（Vector Playing Cards）扇形展开 + 红光 | 公共领域 | 星光闪烁 |
| 捕鱼达人 | 鲨鱼 / 海龟 / 小丑鱼 ×3 / 财神鱼 Boss / 三级炮台（用户自供）+ 光束 + 气泡 | 项目自有 | 游动、光束摆动、气泡上浮 |
| 水果机 | 7 / BAR / 金币（原创）+ 西瓜 / 樱桃 / 柠檬 / 葡萄 / 橙子 / 宝石（Fluent 3D）三列符号窗 + 金光 | 原创 / MIT | 金光呼吸 |

**待完成（需合法素材）**：麻将 / 红十卡片的延边人物插画（背包青年、安全帽工人、朝鲜族服装女性、儿童）——目前无可商用来源，先以牌面构图代替；吉祥物红鱼只用于捕鱼卡。

### 背景「延边之夜」（`LobbyBackdrop.vue`，原创 SVG）

深蓝夜幕 → 星光（固定种子、缓慢闪烁）→ 薄雾 → 冷月 → 长白山四层山脊 + 主峰天池（湖面微光）→ 松林剪影 → 海兰江水纹（三条，缓慢流动）→ 朝鲜族窗棂式菱格纹带（顶 / 底，低对比）→ 舞台光 + 暗角 → 金色微粒。

### 交互 / 动效

- 卡片：悬停抬起 5px + 金边发光；按下缩放 0.975 + 扩散光圈（`.pressed` 420ms）；进入时卡片放大发光 + `LoadingScreen` 真实资源预载。
- 金币粒子：余额增加时从金币栏迸出 8–14 粒（`coin-pop`）。
- 减少动态：设置页开关或系统 `prefers-reduced-motion`（`design/motion.ts` → `html.reduce-motion`），关闭星光 / 水纹 / 微粒 / 游鱼 / 气泡 / 粒子 / 公告滚动。

### 响应式

| 端 | 布局 |
| --- | --- |
| 桌面 16:9（1920×1080 / 1280×720） | 2×2 卡片；右侧快捷竖排；Logo 居中 |
| 手机横屏（高 ≤ 450：844×390 / 800×360） | 顶栏 / 公告 / 导航压扁；快捷栏只留图标；卡片文字缩小 |
| 手机竖屏（宽 ≤ 720 或 portrait） | 单列卡片滚动；快捷栏变右侧抽屉（菜单按钮 / 遮罩关闭）；底栏 sticky；钻石 / 设置收进抽屉外（设置在更多 → 设置） |

无障碍：全部图标按钮带 `aria-label`（`aria.*` 键），卡片 `aria-label` = 名称 + 副标题 + 状态；错误 / 加载文案均走 i18n。

回归脚本：`node tests/lobby-shot.mjs`（`LOCALES=zh,ko SIZES=pc-1920,pc-1280,phone-land,phone-portrait POPUPS=1`，检查 pageerror / 4xx / 横向溢出）。
