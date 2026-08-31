# 《延边麻将规则确认表》

> **用途**：延边麻将存在地区规则差异，工程上禁止臆测硬编码。本表逐项列出所有需产品/当地规则顾问确认的规则点。
> **工程约定**：每一项都对应 `packages/game-common` 麻将规则配置 Schema 中的一个配置键，引擎按配置运行。
> **临时默认值**：仅用于开发联调与演示（构成规则包 `yanbian_2026_01.draft`），全部标注状态；确认后由运营在后台发布正式规则包（自动生成 config_versions 留痕），**无需改代码**。
>
> 状态说明：⏳ 待确认（使用临时默认值） ✅ 已确认 🔧 房主可在建房时二次自定义（在后台允许范围内）

## A. 基础构成

| # | 规则项 | 配置键 | 可选值 | 临时默认值 | 状态 |
|---|---|---|---|---|---|
| A1 | 玩家人数 | `playerCounts` | [2] [3] [4] 任意组合启用 | [4]（2/3 人模式预留） | ⏳🔧 |
| A2 | 是否用万牌 | `tiles.useWan` | true/false | true | ⏳ |
| A3 | 是否用筒牌 | `tiles.useTong` | true/false | true | ⏳ |
| A4 | 是否用条牌 | `tiles.useTiao` | true/false | true | ⏳ |
| A5 | 是否带风牌(东南西北) | `tiles.useWinds` | true/false | false | ⏳🔧 |
| A6 | 是否带箭牌(中发白) | `tiles.useDragons` | true/false | false | ⏳🔧 |
| A7 | 是否带花牌 | `tiles.useFlowers` | true/false | false | ⏳ |
| A8 | 总牌数 | （由 A2–A7 推导） | 108/136/144… | 108 | ⏳ |
| A9 | 起手张数 | `deal.handSize` | 13/16 | 13（庄家14） | ⏳ |
| A10 | 局数选项 | `match.roundOptions` | [4,8,16] 可配 | [4,8,16] | ⏳🔧 |

## B. 庄家体系

| # | 规则项 | 配置键 | 可选值 | 临时默认值 | 状态 |
|---|---|---|---|---|---|
| B1 | 起庄方式 | `dealer.first` | 随机 / 掷骰 / 首局东位 | 随机 | ⏳ |
| B2 | 轮庄规则 | `dealer.rotation` | 胡者坐庄 / 下家轮庄 / 固定轮庄 | 胡者坐庄，流局连庄 | ⏳ |
| B3 | 连庄 | `dealer.streak.enabled` | true/false | true | ⏳ |
| B4 | 连庄加倍 | `dealer.streak.multiplierPerStreak` | 0 / +0.5 / +1 每连庄 | 0（不加倍） | ⏳ |
| B5 | 庄家倍率 | `score.dealerMultiplier` | 1 / 1.5 / 2 | 1（庄闲同倍） | ⏳ |

## C. 行牌动作

| # | 规则项 | 配置键 | 可选值 | 临时默认值 | 状态 |
|---|---|---|---|---|---|
| C1 | 是否可吃 | `actions.canChi` | true/false | false | ⏳🔧 |
| C2 | 是否可碰 | `actions.canPeng` | true/false | true | ⏳ |
| C3 | 是否可明杠 | `actions.canMingGang` | true/false | true | ⏳ |
| C4 | 是否可暗杠 | `actions.canAnGang` | true/false | true | ⏳ |
| C5 | 是否可补杠 | `actions.canBuGang` | true/false | true | ⏳ |
| C6 | 是否可抢杠胡 | `actions.qiangGangHu` | true/false | true | ⏳ |
| C7 | 抢杠是否含暗杠(国士类) | `actions.qiangAnGang` | true/false | false | ⏳ |
| C8 | 报听功能 | `actions.declareTing.enabled` | true/false | true | ⏳ |
| C9 | 报听后锁手牌 | `actions.declareTing.lockHand` | true/false | true | ⏳ |
| C10 | 报听奖励 | `actions.declareTing.bonusFan` | 0/1/2 番 | 1 | ⏳ |
| C11 | 出牌倒计时 | `timing.turnSeconds` | 10–30 | 15（可配） | ⏳🔧 |
| C12 | 动作窗口倒计时 | `timing.claimSeconds` | 3–10 | 5 | ⏳ |
| C13 | 超时处理 | `timing.timeoutPolicy` | 自动打摸牌+进托管 / 仅自动过 | 自动出牌并托管 | ⏳ |

## D. 动作优先级（Action Priority Engine）

| # | 规则项 | 配置键 | 可选值 | 临时默认值 | 状态 |
|---|---|---|---|---|---|
| D1 | 冲突优先级 | `priority.order` | 数组配置 | ["hu","gang","peng","chi"] | ⏳ |
| D2 | 一炮多响 | `priority.multiHu` | 不允许(按逆时针最近者胡) / 允许全胡 | 允许全胡 | ⏳ |
| D3 | 多响时放炮者包赔 | `priority.multiHuPaoAll` | true/false | true | ⏳ |
| D4 | 同级多人碰/杠冲突 | （固定：逆时针最近者） | — | 逆时针最近 | ✅（工程约定） |

> 服务器广播动作窗口 → 收集所有响应或窗口超时 → 统一按 `priority.order` 仲裁。客户端先点无效，仅上报意愿。

## E. 胡牌条件与限制

| # | 规则项 | 配置键 | 可选值 | 临时默认值 | 状态 |
|---|---|---|---|---|---|
| E1 | 最低起胡番 | `hu.minFan` | 0/1/2/3 | 1 | ⏳🔧 |
| E2 | 是否必须门清才能胡 | `hu.requireMenQing` | true/false | false | ⏳ |
| E3 | 是否必须缺一门 | `hu.requireQueMen` | true/false | false | ⏳ |
| E4 | 是否必须含幺九 | `hu.requireYaoJiu` | true/false | false | ⏳ |
| E5 | 是否必须"有将"(2/5/8将) | `hu.require258Jiang` | true/false | false | ⏳ |
| E6 | 点炮胡是否允许 | `hu.allowDianPaoHu` | true/false | true | ⏳ |
| E7 | 只能自摸胡 | `hu.selfDrawOnly` | true/false | false | ⏳ |
| E8 | 过胡限制(过水) | `hu.passHuLock` | 无 / 同巡不可胡 / 番数不增不可胡 | 同巡不可点炮胡 | ⏳ |
| E9 | 天胡 | `hu.tianHu.enabled` + fan | true/false | true，封顶番 | ⏳ |
| E10 | 地胡 | `hu.diHu.enabled` + fan | true/false | true，封顶番 | ⏳ |
| E11 | 杠上开花 | `hu.gangShangKaiHua` | enabled + 加番 | true，+1 番 | ⏳ |
| E12 | 海底捞月/妙手回春 | `hu.haiDi` | enabled + 加番 | true，+1 番 | ⏳ |
| E13 | 杠后炮(杠上炮包赔) | `hu.gangHouPao` | 无 / 加番 / 包赔 | 加 1 番 | ⏳ |

## F. 番型体系（hand_patterns/* 模块化，逐项可开关+配番）

| # | 番型 | 配置键(`patterns.*`) | 临时默认（番） | 状态 |
|---|---|---|---|---|
| F1 | 平胡 | pinghu | 1 | ⏳ |
| F2 | 碰碰胡 | pengpenghu | 2 | ⏳ |
| F3 | 七对 | qidui | 4 | ⏳ |
| F4 | 豪华七对(带4张) | haoqidui | 6 | ⏳ |
| F5 | 清一色 | qingyise | 4 | ⏳ |
| F6 | 混一色 | hunyise | 2（需字牌启用） | ⏳ |
| F7 | 字一色 | ziyise | 8（需字牌启用） | ⏳ |
| F8 | 十三幺 | shisanyao | 封顶（需字牌启用） | ⏳ |
| F9 | 全求人 | quanqiuren | 2 | ⏳ |
| F10 | 门清 | menqing | +1 | ⏳ |
| F11 | 自摸加番 | selfDrawBonus | +1 | ⏳ |
| F12 | 杠(明/暗)即时分 | gangScore | 明杠1/暗杠2（即结或并入） | ⏳ |
| F13 | 延边特色番型 | custom[] | 待当地顾问提供后以插件加入 | ⏳ |

## G. 结算

| # | 规则项 | 配置键 | 可选值 | 临时默认值 | 状态 |
|---|---|---|---|---|---|
| G1 | 基础底分 | `score.baseScore` | 房间档位决定 | 场次配置 | ✅（档位驱动） |
| G2 | 番→倍率曲线 | `score.fanToMultiplier` | 2^番 / 线性 / 查表 | 2^番 查表封顶 | ⏳ |
| G3 | 封顶番数 | `score.maxFan` | 3/4/5/不封顶 | 5 | ⏳🔧 |
| G4 | 点炮承担 | `score.dianPaoPolicy` | 放炮者独付 / 三家均付 | 放炮者独付 | ⏳ |
| G5 | 自摸承担 | `score.selfDrawPolicy` | 三家均付 / 三家均付+自摸加番 | 三家均付 | ⏳ |
| G6 | 包赔场景 | `score.baoPei[]` | 大明杠包/生张包/听牌包… | 空（待确认） | ⏳ |
| G7 | 流局(黄庄)条件 | `draw.wallEnd` | 摸完即流 / 留N张流局 | 留 0 张 | ⏳ |
| G8 | 流局查叫 | `draw.chaJiao` | 无 / 未听付听家 | 未听付听家（每家1番） | ⏳ |
| G9 | 流局查花猪/缺门 | `draw.chaHuaZhu` | 启用需 E3 | false | ⏳ |
| G10 | 流局连庄 | `draw.dealerKeep` | true/false | true | ⏳ |

## H. 需当地顾问补充的开放问题

1. 延边当地是否普遍**不吃牌**？（临时默认不可吃，若可吃改 C1 即可）
2. 是否使用字牌？（东南西北/中发白，默认关闭）
3. 是否存在延边特有叫法/番型（如与朝鲜族玩法相关的特殊胡型），需要词表（中/韩双语 UI 用语）。
4. 韩语界面下麻将术语标准译法（碰/杠/胡 → 뻥/깡/후 等口语用法是否采用）。
5. 房卡场（好友房自定义）允许房主开放哪些子集配置。

**流程要求**：以上 ⏳ 项全部确认后，后台"游戏管理→延边麻将→规则包"发布 `yanbian_2026_01` 正式版；对局快照永久绑定规则包版本，历史战绩不受后续改版影响。
