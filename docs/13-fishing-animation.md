# 13 · 捕鱼动画系统（v2 · 骨骼式网格 + 共享路径 + 状态机）

> 目标：鱼不再是「一张 PNG 平移」。每条鱼同时有 **局部动作**（身体波浪 / 尾摆 / 胸鳍 / 眨眼 / 张嘴）和 **场景移动**（服务器同一路径函数的曲线 + 速度曲线），
> 状态机覆盖 spawn / swim / turn / hit / stun / escape / death，Boss 有入场警告 / 受击 / 愤怒 / 死亡。全部在 Pixi（WebGL/Canvas）统一渲染，不为鱼建 DOM。

## 1. 架构

| 模块 | 文件 | 职责 |
| --- | --- | --- |
| 共享路径库 | `packages/game-common/src/fishing/paths.ts` | 17 条 Catmull-Rom 路径 + 速度曲线（linear / turns 拐点减速 / pause 停留变向）+ 朝向 `headingOnPath` + 鱼群车道 `laneForFish`；**服务端判定与客户端渲染调用同一函数** |
| 波次配置 | `packages/game-common/src/fishing/config.ts` | 每波的鱼种 / 路径 / 数量 / 间隔（小鱼之字 & 深 S 成群，中鱼停留变向，Boss 环绕 / 慢 S） |
| 鱼绑定 | `apps/client-game/src/games/fishing/fishRig.ts` | `FishRig`：MeshPlane（头→尾 8–16 列 × 3 行）顶点变形 + 叠加层（鳍 / 眼皮 / 嘴）+ 状态机 + 每鱼种参数表 `FISH_RIGS` |
| 海底环境 | `apps/client-game/src/games/fishing/ocean.ts` | 远 / 中 / 近三层视差：水体渐变、光束摆动、焦散、海床、水草摆动、远近颗粒、气泡对象池、鱼尾迹气泡 |
| 视图 | `apps/client-game/src/games/fishing/FishingView.vue` | 服务器事件 → rig 状态；命中 / 捕获 / 技能 / Boss 表现；设备分级；页面隐藏暂停；减少动态 |

## 2. 局部动作（方案 B：网格骨骼）

- 顶点公式：列 c 到头的归一化距离 `s∈[0,1]`（0 = 头，1 = 尾），`dy = sin(ωt + φ − 2.6·s) · (waveAmp·s^1.7 + tailAmp·s^4) · h` —— 波沿脊柱**逐节传递**，尾部振幅最大，同时 `dx = −0.35·|dy|·s` 模拟弯曲缩短。
- 身体类型：`fish`（脊柱波）/ `round`（河豚：径向鼓胀呼吸 + 小尾摆）/ `turtle`（壳体微波 + 下部鳍脚划水）/ `humanoid`（财神鱼 Boss：浮动 + 袍摆）。
- 叠加层（Graphics，每个局部帧重画）：胸鳍三角扇动（配色从素材像素采样）、眨眼（肤色眼皮 90–130 ms，间隔 2.2–6 s）、张嘴（暗色椭圆 300 / 520 ms，Boss 愤怒时持续张合）。
- 帧率：普通鱼 9–12 FPS、Boss 14 FPS（愤怒 ×1.3），场景移动每帧插值；随机相位 `φ`；游速 / 逃逸 / 转向时摆尾加快；冰冻时局部动作暂停并变蓝。
- 移动时局部动作不暂停；镜像只翻 `body.scale.x`，鱼身无文字、顶光结构不受影响。

## 3. 场景移动（共享路径）

| kind | 路径 | 说明 |
| --- | --- | --- |
| straight | 0 1 5 6 | 左进右出 / 右进左出 |
| diagonal | 3 4 | 斜向穿场 |
| s | 2 9 | 浅 S / 深 S（turns：拐点减速） |
| arc | 10 11 | 上弧 / 下弧 |
| pause | 12 13 | 进场 → 停留（t 40–56%）→ 反向离开（真实左右翻面） |
| zigzag | 14 | 之字快游（小鱼群） |
| boss-arc | 7 8 16 | Boss 大弧线 / 慢 S |
| boss-circle | 15 | Boss 绕场环形（含 2 次反向） |

- 朝向：`headingOnPath` 数值导数 → 俯仰角平滑（0.12 插值，限 ±35°）；`cos(angle)` 带滞回决定左右；翻面走 **turn** 状态（380 ms 透视翻面：scale.x 经 0.18 过零，摆尾 ×1.7）。
- 转向减速：`ease: 'turns'` 每段 smoothstep（60%）→ 控制点处速度最低，之后加速；`pause` 停留段速度为 0，局部摆尾随 `moveSpeed` 放慢但不停。
- 鱼群：同路径按 `gapMs` 依次出生（跟随），`laneForFish(fishId, size)` 给小鱼 5 条、中鱼 3 条横向车道（服务端判定同函数）。
- 体型行为：小鱼 speedScale 1.0–1.2 + 之字 / 深 S；中鱼 0.8–0.9 + 停留变向 + 35% 受击逃逸（摆尾 ×2.1，900 ms）；大鱼 0.6–0.7 + 大振幅 + 水流阴影；Boss 独立入场（警告 + 镜头震动 12）。

## 4. 状态机

| 状态 | 触发 | 表现 |
| --- | --- | --- |
| spawn | 出生 | 260 ms 淡入 + 0.7→1 缩放，出生朝向直接取路径方向 |
| swim | 默认 | 见 §2 |
| turn | 路径左右反向 | 380 ms 翻面，摆尾加快 |
| hit | 子弹 / 技能命中 | 闪白（tint）+ 局部光环 + 沿子弹方向 7 px 位移回弹，170 ms；不消失 |
| stun | 冰冻 | 变蓝、局部动作暂停（位置按冰冻窗口停住，服务端同源） |
| escape | 受击后 35% 概率（非 Boss） | 摆尾 ×2.1，900 ms |
| death（捕获） | 服务器 `fishKilled` / 技能击杀 | 翻肚 → 下沉 46 px → 变暗淡出 640 ms；金币从鱼位置爆出（普通 ≤12 / 大鱼 ≤18 / Boss ≤28）+ 倍率飘字 + 音效；大鱼 / Boss 额外震动与气泡 |
| Boss | 警告 / 受击 / 愤怒 / 死亡 | 入场警告横幅 + 震动；受击金色冲击；HP < 40% 愤怒（红闪、动作 ×1.3、持续张嘴）；死亡爆炸 + 震动 16 |

## 5. 海底环境

远景（视差 0.25）：水体渐变 + 42 颗远颗粒 · 中景（0.55）：5 束光（明暗 / 摆动 / 漂移）、5 条焦散波线、海床石块、9 株水草逐帧摆动 · 近景（0.9）：气泡池（≤60）、18 颗近颗粒；海床随机冒泡；中大型鱼尾部留气泡；相机随瞄准角与缓慢漂移偏移。

## 6. 性能与降级

- 单一 Pixi 舞台；鱼 = 1 MeshPlane + 1 Graphics，对象池复用（≤96）；气泡 / 颗粒对象池；离屏（t>1）立即回收。
- 设备分级 `lowEnd`（≤4 核或 ≤4 GB）：网格列数 ×0.6、光束 3、水草 5、颗粒减半、气泡 ≤24、无阴影、非 Boss 不画叠加层。
- 页面隐藏：`visibilitychange` → 停 ticker，恢复后按服务器时间对齐。减少动态：光束 / 水草 / 颗粒 / 焦散 / 尾迹 / 震动 / 相机漂移全部停止，鱼保留游动（玩法必需）。
- 实测（`node tests/fishing-verify.mjs`，无 GPU 的容器）：每帧 JS 更新（鱼 + 环境）桌面 **0.49 ms**，手机模拟 + CPU 4× 降速 **2.89 ms**，均远小于 16.7 ms（60 FPS）/ 33 ms（30 FPS）预算；容器内 SwiftShader 软渲染 FPS（6 / 3）不代表真机，真机 GPU 绘制 ≤40 个网格为常规负载。

## 7. 验收记录（2026-09-04，`build/fishing-demo/`）

- 同屏鱼种：whale / dragonKing / clown / puffer（一个观察窗口内 4 种，整轮 4 波共 11 种）；路径 kind：straight / s / boss-circle / boss-arc / pause 等。
- 观察到的状态：swim / hit / escape / death / turn（turn 发生在停留变向路径 13 的海龟上）。
- 局部动作检查：连续 4 帧按鱼位置重新居中裁剪后像素差 —— 鲸 21–24（背景 7.9）、小丑鱼 27–49（背景 0.25），远高于背景噪声；`motion-strip.png` 可肉眼看到尾部 / 鳍逐帧变化。
- 录像：`page@*.webm`（1280×720，约 14 s，含自动开火、技能、捕获）；帧：`frame-0..3.png`、`turn-moment.png`、`desktop-final.png`、`mobile-final.png`。

## 8. 素材清单（类型 / 帧数 / 许可证 / 是否临时）

| 鱼种 | 素材 | 类型 | 帧数 | 许可证 | 状态 |
| --- | --- | --- | --- | --- | --- |
| sardine / clown / butterfly | `fish_clown.png`（染色区分） | 单图 + 网格骨骼 12 列 | 程序生成 | 用户自供（项目自有） | **临时**：正式版需 8–16 帧游泳序列或拆分骨骼素材 |
| puffer / lionfish | `fish_puffer.png` | 单图 + 圆身呼吸 | 程序生成 | 用户自供 | 临时 |
| ray / turtle | `fish_turtle.webp` | 单图 + 壳体微波 + 鳍脚 | 程序生成 | 用户自供 | 临时；魔鬼鱼需独立素材 |
| shark / goldenShark | `fish_shark_01.webp` / `fish_golden.png` | 单图 + 网格 12–14 列 + 阴影 | 程序生成 | 用户自供 | 临时 |
| whale（Boss） | `fish_shark_purple.png` | 单图 + 网格 16 列 | 程序生成 | 用户自供 | 临时；座头鲸需独立素材 |
| dragonKing（Boss） | `boss_caishen_fish.webp` | 单图 + 人形浮动 / 袍摆 | 程序生成 | 用户自供（原创角色） | 临时：需拆分（头 / 身 / 袍 / 手）骨骼素材 |
| 炮台 | `cannon_lv01–03.webp` | 单图（旋转 + 后坐） | — | 用户自供 | 可用 |

按用户要求，**只有单张静态图的鱼类素材标记为「不合格 / 临时」**，当前通过网格骨骼让它们具备真实局部动作以便试玩；正式发布前需替换为帧序列（尺寸中心一致、透明、无跳动）或拆分骨骼素材，来源须为 MIT / Apache / CC0 / 可商用并登记到 `THIRD_PARTY_NOTICES.md`。

## 9. 全项目静态图检查（同批修复）

| 检查项 | 现状 | 处理 |
| --- | --- | --- |
| 人物是否静态平移 | 水果机吉祥物只有上下浮动；轮盘 / 股票财神静态 | 改为浮动 + 呼吸 + 微摆（`mascot-bob` / `analyst-idle`）、结果面板弹入；仍为整图动画，素材待拆分（临时） |
| 金币是否无旋转飞行 | 奖励雨 `--rot` 旋转；捕鱼金币 `scale.x=cos` 翻转 | 已合格 |
| 按钮是否只换色 | `GameButton:active` 缩放 0.95 + 下压 + 变暗 | 已合格 |
| 麻将吃 / 碰 / 杠 / 胡 | 只有文字缩放弹入 | 加冲击波环 + 放射火花（吃碰杠）；胡牌双层冲击波 + 火花 |
| 红十结算 WIN / ×2 / ×4 | 静态图 | 弹入 + 亮度闪 + 延迟叠加 |
| 水果机滚轮 | 真实纵向滚动（符号带） | 已合格 |
| 海底背景是否静止 | 光束 / 焦散静止 | 光束摆动、焦散起伏、水草摆动、颗粒视差、气泡 |
| 特效是否只是发光图 | 捕鱼技能为程序绘制 | 已合格 |

## 10. 方案 A（帧序列）接入方式

`FISH_RIGS[typeId].frames = { key, cols, rows, count, fps }` —— `key` 为 `assets-manifest` 里的 sheet 键（放进 `public/assets/fishing/fish/`，跑 `build-manifest.mjs`）。
sheet 存在时该鱼种自动切换为逐帧播放（循环衔接、随机起始帧、游速 / 逃逸 / 愤怒倍率仍生效），网格变形关闭；sheet 缺失时自动退回网格骨骼。
要求：每帧尺寸与中心一致、透明背景、四周 ≥16% 安全边距（`pad_margins.py` 可逐帧处理）、8–16 帧、来源 MIT / Apache / CC0 / 可商用并登记 `THIRD_PARTY_NOTICES.md`。

素材搜索记录（2026-09-05）：本环境只能访问 GitHub Raw，opengameart.org / itch.io / kenney.nl 被网络策略拦截；GitHub 上可确认的 CC0 鱼类包只有 Kenney Fish Pack（静态单帧、扁平矢量风格，与本项目 HD 风格不符），
未找到可直接使用的 HD 8–16 帧游泳序列。候选（需在可访问网络下核对许可证与风格）：OpenGameArt「Cute Fish Sprites」（多动作帧）、「Swimming Fish」（CC0，32×32 像素风）、「Swimming Whale」、「Fish Sprite sheet」。
