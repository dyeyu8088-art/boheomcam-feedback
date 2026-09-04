# 12 · 素材完整性规范与检查流程（Asset Guidelines）

> 适用于 `apps/client-game/public/assets/**` 全部 PNG / WebP。目标：**任何独立对象素材在任何端都不贴边、不缺失、不带外来背景。**

## 1. 素材文件规则

| 规则 | 要求 |
| --- | --- |
| 来源 | 只用完整原始 PNG / WebP（GitHub MIT / Apache / CC0、爱给可商用、用户自供）。**禁止**预览缩略图、带边框截图、带水印 / 素材站背景的图 |
| 透明 | 独立对象类必须带 Alpha 通道；背景 / 底板 / 横幅类可铺满 |
| 安全边距 | 对象包围盒到四边 **≥ 16%**（按画布短边计，`pad_margins.py` 默认值；检查阈值 12%）；对象居中、四边留白一致 |
| 裁切 | 素材本身被裁（西瓜缺左缘、叶子被切等）→ **更换素材**，不允许放大 / 拉伸 / 镜像补齐 |
| Sprite Sheet | 只按原始坐标切，切完逐张过 `audit.py` |
| 文字 | 不烙进图片（名称 / 副标题 / 金额 / 按钮文案全部由程序渲染，中韩 i18n） |
| 登记 | 每个第三方素材记录作者 / 链接 / 许可证 → `THIRD_PARTY_NOTICES.md`；许可证文件随素材入库 |

「独立对象类」目录（`tools/assets/audit.py` 的 `ICON_DIRS`）：`slots/symbols`、`fishing/{fish,boss,cannon,skills}`、`common/{icons,currency,navigation,avatar,chips,vip,effects}`、`{mahjong,red10}/{character,effects}`、`slots/{character,jackpot}`、`lobby/game_icons`。

## 2. 显示规则（CSS / Pixi）

- `<img>`：全局 `img { object-fit: contain; object-position: center }`（`design/tokens.css`）。**禁止**用 `object-fit: cover` 展示独立对象；`fill` 只用于底板 / 九宫格 / 牌面等有意拉伸的元素。
- 通用类：`.asset-icon { width:100%; height:100%; object-fit:contain; object-position:center; box-sizing:border-box; padding:var(--icon-pad, 6%); display:block }`。
- 容器 `overflow: visible` 优先；若必须 `overflow: hidden`，素材内容必须在安全区内（素材已自带 16% 边距）。
- 尺寸补偿：素材补边后可见对象缩小到 68%，需要与旧版等大时把图片盒放大 `1/0.68` 并负偏移 `-23.5%`（例：捕鱼技能图标 `.sk-icon`、Jackpot 底板 `.jb-frame`），不要缩放素材本身。
- Pixi 场景：一律用 `contentBounds(texture)`（`src/assets/bounds.ts`）取**内容包围盒**做缩放与锚点，不用 `texture.width/height`；补边、换素材都不用改尺寸常量。

## 3. 工具链

```bash
python3 tools/assets/audit.py            # 全量检查 → build/asset-audit.{json,md,html} + 检查表 build/asset-check-*.png
python3 tools/assets/pad_margins.py       # 独立对象类：裁包围盒 + 补透明边到 16%（原地覆盖，不重采样）
python3 tools/assets/pad_margins.py --trim mahjong/character/caishen_fa_tile.webp=0,0,4,0   # 先裁掉外来碎片再补边
python3 tools/assets/build-slot-symbols.py   # 水果机 11 个符号（Fluent 3D MIT + 原创 7/BAR/金币）
node tools/assets/render-svg.mjs tools/assets/svg/coin.svg=out.png --size 256   # 原创 SVG → 透明 PNG
node tools/assets/build-manifest.mjs      # 增删素材后重建 assets-manifest.json / manifest.gen.ts
```

`audit.py` 标记含义：`CUT_<边>` 该边有一段直线贴边（疑似裁切）· `EDGE_<边>` 该边一点触边 · `LOW_MARGIN` 边距 < 12% · `NO_ALPHA` 无透明 · `DARK_BG` 四角深色不透明（带了素材站深底）· `CORNER_OPAQUE` 四角不透明中间透明（方框背景）。独立对象类出现任何标记即不合格。

## 4. 逐项检查清单（提交前）

1. `python3 tools/assets/audit.py` 输出 `0 icon-class flagged`。
2. 打开 `build/asset-audit.html` / `build/asset-check-*.png`：每个对象上下左右完整、无来源背景边框、无拉伸、透明正常。
3. `node tests/res-shot.mjs`（1280×720 / phone）与 `tests/fishing-shot.mjs`：桌面与手机端都完整。
4. 新增第三方素材已登记 `THIRD_PARTY_NOTICES.md` 并附许可证文件。

## 5. 2026-09-04 全面修复记录

- 123 个独立对象类素材全部存在贴边 / 零边距 → 101 个补边到 16%；水果机 10 个符号整套更换（Fluent 3D MIT + 原创 7 / BAR / 金币，新增 BAR 符号并重算赔付表 v3，RTP 95.6%）；财神发牌右缘外来白条裁除；`sparkle_coin`（黑底方块）换为透明星光。
- 删除 15 个不合格素材：深色底图标 7、素材站边框碎片 4、带 `$` 的金币 3、烙字轮盘横幅 1；界面改用完整圆形图标（`icon_*_round`）与平台金币 `coin_yanbian`。
- 水果机符号不再画深蓝方框底板；WILD / BONUS 文字由程序绘制。
