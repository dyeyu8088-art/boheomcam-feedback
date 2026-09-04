# 第三方素材与许可证清单（THIRD-PARTY NOTICES）

本项目**不使用**任何竞品 APK 提取资源、商标、Logo、游戏名称、受版权保护的音乐 / 角色 / 美术图。
以下素材全部来自 GitHub 上的开源仓库，许可证允许商业使用；每项都保留原始许可证文件并在此署名。
其余全部美术（Logo / 图标 / 头像纹章 / 背景 / 牌桌 / 鱼类 / 炮台 / 动画）为本项目原创或用户自供素材（见下表）。
每一项都记录：作者 / 原始链接 / 许可证 / 落地位置；许可不明的素材一律不入库。

| 用途 | 素材 | 来源 | 许可证 | 落地位置 |
| --- | --- | --- | --- | --- |
| 麻将牌面（万 / 筒 / 索 / 风 / 箭 / 牌背） | riichi-mahjong-tiles（Regular 套） | https://github.com/FluffyStuff/riichi-mahjong-tiles | **CC0 1.0（公共领域）** | `apps/client-game/public/assets/mahjong/tiles/*.svg` + `LICENSE.md` |
| 扑克牌（52 张） | Vector Playing Cards（Byron Knoll 原作，notpeter 整理） | https://github.com/notpeter/Vector-Playing-Cards | **公共领域 / WTFPL** | `apps/client-game/public/assets/red10/cards/*.svg`（数字牌）+ `*.webp`（J/Q/K 由本项目光栅化）+ `LICENSE.txt` |
| 中文展示字体（游戏名 / 品牌） | ZCOOL XiaoWei（站酷小薇体） | https://github.com/google/fonts/tree/main/ofl/zcoolxiaowei | **SIL OFL 1.1** | `apps/client-game/public/fonts/zcool-xiaowei-titles.woff2`（子集）+ `OFL-zcoolxiaowei.txt` |
| 中文书法字体（牌面 / 门风 / 主视觉） | Ma Shan Zheng（马善政毛笔楷书） | https://github.com/google/fonts/tree/main/ofl/mashanzheng | **SIL OFL 1.1** | `apps/client-game/public/fonts/mashanzheng-tiles.woff2`（子集）+ `OFL-mashanzheng.txt` |
| 韩文展示字体（游戏名 / 品牌） | Nanum Myeongjo ExtraBold | https://github.com/google/fonts/tree/main/ofl/nanummyeongjo | **SIL OFL 1.1** | `apps/client-game/public/fonts/nanum-myeongjo-titles.woff2`（子集）+ `OFL-nanummyeongjo.txt` |
| 新版 UI / 角色 / 鱼类 / 符号（六张素材表拆分，343 文件） | 用户提供的 AI 生成素材（无第三方版权主张；含财神鱼原创角色） | 用户上传（2026-09-03） | **项目自有素材** | `apps/client-game/public/assets/{common,lobby,fishing,slots,roulette,stock_game,mahjong,red10}/…`（切图脚本：`tools/assets/`；清单：`assets-manifest.json`） |
| 拉丁品牌字体（YANBIAN GAME） | Cinzel | https://github.com/google/fonts/tree/main/ofl/cinzel | **SIL OFL 1.1** | `apps/client-game/public/fonts/cinzel-brand.woff2`（子集）+ `OFL-cinzel.txt` |
| 水果机符号：西瓜 / 樱桃 / 柠檬 / 橙子 / 葡萄 / 蓝宝石 / 星（WILD）/ 礼盒（BONUS）；奖励特效星光 | Fluent UI Emoji — 3D 风格（Microsoft） | https://github.com/microsoft/fluentui-emoji （`assets/<Name>/3D/<name>_3d.png`） | **MIT** | `apps/client-game/public/assets/slots/symbols/slot_{watermelon,cherry,lemon,orange,grape,diamond,wild,bonus}.png`、`common/effects/sparkle_coin.png` + `slots/symbols/LICENSE-fluentui-emoji.txt`（生成脚本：`tools/assets/build-slot-symbols.py`，只裁包围盒 + 补透明边，不重绘） |
| 水果机符号：数字 7 / BAR；平台金币（无货币符号，长白山 + 江水徽记） | 本项目原创 SVG | `tools/assets/svg/{seven,bar,coin}.svg`（`render-svg.mjs` 光栅化） | **项目自有素材** | `slots/symbols/slot_{seven,bar,gold}.png`、`common/currency/coin_yanbian.png` |

## 素材完整性规范

独立对象类素材（图标 / 水果 / 鱼 / 人物 / 道具 / 按钮图标）必须：透明背景、四周 ≥ 16% 透明安全边距、不带素材站边框 / 背景 / 水印、不是预览缩略图。
审计与修复工具、显示规则见 [`docs/12-asset-guidelines.md`](docs/12-asset-guidelines.md)（`tools/assets/audit.py` 全量检查 → `pad_margins.py` 补边 → 检查表）。

## 合规说明

- **OFL 字体**：允许商业使用与自托管；本项目按 OFL 允许的方式做了**子集化**（只保留实际用到的字形，
  4–25 KB / 字体），保留原始版权与许可证文件，未使用 Reserved Font Name 作为衍生字体名。
- **CC0 / 公共领域素材**：无署名义务，此处署名为致谢与可追溯性。
- **SVG 优化**：用 svgo 移除了 Inkscape/Sodipodi 元数据并压缩路径，不改变图形内容；
  J/Q/K 三种花牌原始 SVG 每张 245–760 KB，本项目用 Chromium 光栅化为 480×672 WebP（60–74 KB）。
- 新增任何第三方素材，必须：① 确认许可证允许商业使用；② 把许可证文件放进素材目录；③ 在本表登记；④ 通过 `tools/assets/audit.py` 完整性检查。
- 2026-09-04 清理：删除带深色底 / 素材站边框碎片的 11 个图标（`icon_checkin / icon_event_gift(_2) / icon_free_coins / icon_lucky_wheel / icon_mail(_2) / icon_treasure_chest / icon_vip_crown / icon_shop_ingot / icon_task_scroll`）、带 `$` 符号的 3 个金币、烙字的轮盘横幅；界面改用完整的圆形图标与平台金币。

## 素材获取方式（可复现）

```bash
git clone --depth 1 https://github.com/FluffyStuff/riichi-mahjong-tiles.git
git clone --depth 1 https://github.com/notpeter/Vector-Playing-Cards.git
# Google Fonts 单文件：https://raw.githubusercontent.com/google/fonts/main/ofl/<family>/<file>
pip install fonttools brotli
pyftsubset ZCOOLXiaoWei-Regular.ttf --text='延边麻将红十捕鱼黄金水果娱乐' --unicodes='U+0020-007E' --flavor=woff2 --output-file=zcool-xiaowei-titles.woff2
```

## 自有 AI 生成素材的处理说明

- 六张素材表由自动分割脚本按不透明核心切块并抠透明；烙有玩家数据 / 金额 / 倒计时的板件在切图阶段抹除数字，运行时由程序绘制文字。
- 素材表中出现的真实商标（Apple / Tesla / Microsoft / BTC / ETH Logo）**不接入**；带"充值 / TOP-UP / CASHBACK"语义的元素只作虚拟资产活动图使用。
- 麻将牌面、扑克牌继续使用上表登记的 CC0 / 公共领域全套素材（素材表中的牌面不完整）。
