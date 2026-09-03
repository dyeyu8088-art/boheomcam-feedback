# 第三方开源素材清单（THIRD-PARTY ASSETS）

本项目**不使用**任何竞品 APK 提取资源、商标、Logo、游戏名称、受版权保护的音乐 / 角色 / 美术图。
以下素材全部来自 GitHub 上的开源仓库，许可证允许商业使用；每项都保留原始许可证文件并在此署名。
其余全部美术（Logo / 图标 / 头像纹章 / 背景 / 牌桌 / 鱼类 / 炮台 / 水果机符号 / 动画）均为本项目原创矢量。

| 用途 | 素材 | 来源 | 许可证 | 落地位置 |
| --- | --- | --- | --- | --- |
| 麻将牌面（万 / 筒 / 索 / 风 / 箭 / 牌背） | riichi-mahjong-tiles（Regular 套） | https://github.com/FluffyStuff/riichi-mahjong-tiles | **CC0 1.0（公共领域）** | `apps/client-game/public/assets/mahjong/*.svg` + `LICENSE.md` |
| 扑克牌（52 张） | Vector Playing Cards（Byron Knoll 原作，notpeter 整理） | https://github.com/notpeter/Vector-Playing-Cards | **公共领域 / WTFPL** | `apps/client-game/public/assets/cards/*.svg`（数字牌）+ `*.webp`（J/Q/K 由本项目光栅化）+ `LICENSE.txt` |
| 中文展示字体（游戏名 / 品牌） | ZCOOL XiaoWei（站酷小薇体） | https://github.com/google/fonts/tree/main/ofl/zcoolxiaowei | **SIL OFL 1.1** | `apps/client-game/public/fonts/zcool-xiaowei-titles.woff2`（子集）+ `OFL-zcoolxiaowei.txt` |
| 中文书法字体（牌面 / 门风 / 主视觉） | Ma Shan Zheng（马善政毛笔楷书） | https://github.com/google/fonts/tree/main/ofl/mashanzheng | **SIL OFL 1.1** | `apps/client-game/public/fonts/mashanzheng-tiles.woff2`（子集）+ `OFL-mashanzheng.txt` |
| 韩文展示字体（游戏名 / 品牌） | Nanum Myeongjo ExtraBold | https://github.com/google/fonts/tree/main/ofl/nanummyeongjo | **SIL OFL 1.1** | `apps/client-game/public/fonts/nanum-myeongjo-titles.woff2`（子集）+ `OFL-nanummyeongjo.txt` |
| 拉丁品牌字体（YANBIAN GAME） | Cinzel | https://github.com/google/fonts/tree/main/ofl/cinzel | **SIL OFL 1.1** | `apps/client-game/public/fonts/cinzel-brand.woff2`（子集）+ `OFL-cinzel.txt` |

## 合规说明

- **OFL 字体**：允许商业使用与自托管；本项目按 OFL 允许的方式做了**子集化**（只保留实际用到的字形，
  4–25 KB / 字体），保留原始版权与许可证文件，未使用 Reserved Font Name 作为衍生字体名。
- **CC0 / 公共领域素材**：无署名义务，此处署名为致谢与可追溯性。
- **SVG 优化**：用 svgo 移除了 Inkscape/Sodipodi 元数据并压缩路径，不改变图形内容；
  J/Q/K 三种花牌原始 SVG 每张 245–760 KB，本项目用 Chromium 光栅化为 480×672 WebP（60–74 KB）。
- 新增任何第三方素材，必须：① 确认许可证允许商业使用；② 把许可证文件放进素材目录；③ 在本表登记。

## 素材获取方式（可复现）

```bash
git clone --depth 1 https://github.com/FluffyStuff/riichi-mahjong-tiles.git
git clone --depth 1 https://github.com/notpeter/Vector-Playing-Cards.git
# Google Fonts 单文件：https://raw.githubusercontent.com/google/fonts/main/ofl/<family>/<file>
pip install fonttools brotli
pyftsubset ZCOOLXiaoWei-Regular.ttf --text='延边麻将红十捕鱼黄金水果娱乐' --unicodes='U+0020-007E' --flavor=woff2 --output-file=zcool-xiaowei-titles.woff2
```
