# 幸运轮盘（roulette）架构与规则

> 金币为游戏内虚拟娱乐资产，不可兑换现金 / 不可提现。轮盘为单桌共享回合，所有开奖与派彩在服务端完成。

## 规则（欧式单零，`roulette_eu_v1`，可由 `game_rules` 覆盖）

| 投注类型 | selection | 净赔率 | 说明 |
| --- | --- | --- | --- |
| straight 单号 | `"0"`–`"36"` | 35 | 赢返 36 倍 |
| red / black 红黑 | `""` | 1 | 0 不算红黑 |
| odd / even 单双 | `""` | 1 | 0 不算单双 |
| low / high 1-18 / 19-36 | `""` | 1 | |
| dozen 打 | `"1"`–`"3"` | 2 | 1–12 / 13–24 / 25–36 |
| column 列 | `"1"`–`"3"` | 2 | 底行 1,4,7… 为第 1 列 |

- 筹码：10 / 50 / 100 / 500 / 1K / 5K / 10K / 50K / 100K / 500K / 1M
- 限额：单注 ≥ 10；单点 ≤ 1,000,000；单人单局 ≤ 5,000,000
- 阶段：下注 30 s → 转盘 9 s → 派彩展示 6 s → 下一局（服务端 200 ms tick）
- 理论 RTP：单号 / 外围均为 36/37 ≈ 97.3%

## 服务端权威流程（`services/game/src/hosts/rouletteHost.ts`）

1. **开局** `openRound()`：`roulette_rounds` 落库（round_id / lock_at / server_id），广播 `roulette.state{phase:'betting'}`
2. **下注** `roulette.bet{bets:[{type,selection,amount}]}`（需 `requestId`）：
   - 阶段必须为 betting 且距锁盘 ≥ 250 ms；逐注 `validateBet`；单点 / 单局限额；余额预检
   - 单事务：`GAME_BET` 扣款（幂等 key `roulette:bet:<uid>:<requestId>`）→ `roulette_bets` 逐注落库（`idempotency_key = key:index`）
   - 重复 requestId：钱包幂等返回原余额，注单按 key 前缀回查；网关层另有 requestId 响应缓存
3. **锁盘即开奖** `spinRound()`：`secureRng.int(37)`，结果与 `rng_audit{roll, drawnAt, serverId, version}` 先落库，再广播 `roulette.spin{result, wheelIndex, spinMs}`；客户端转盘动画只是把球送到该号码
4. **结算** `settleRoundById()`：以数据库注单为准（不依赖内存），逐用户单事务：更新每注 `payout` → 有赢则 `GAME_WIN`（幂等 `roulette:win:<roundId>:<uid>`）→ 汇总 `total_payout / settled_at`；
   之后 VIP 经验、任务（`roulette_bets` / `roulette_rounds`）、赛事指标（`coin_bet` / `coin_win` / `roulette_win`），并按人推送 `roulette.result{myBets, myBet, myPayout, balance, history}`
5. **崩溃恢复** `recover()`（进程启动时）：`settled_at IS NULL` 的回合 —— 已有 result → 补结算；无 result → 逐用户退款（`GAME_REFUND`，幂等）并标记 `rng_audit.void=true`

## 客户端（`apps/client-game/src/games/roulette/RouletteView.vue`）

- 筹码只在本地暂存（撤销 / 清除 / 重复 / 自动），「确认下注」一次性提交清单；已确认注单实心显示，待确认虚线描边
- 转盘为 Canvas 程序绘制顶视图：球在轮盘坐标系中运动（`WHEEL_ORDER` 定位），因此无论轮盘转到哪里都停在服务端号码；素材 `wheel_hero` 仅作大厅海报
- 投注台为程序绘制布局（素材 `table_layout` 为缩略图，不足以承载交互），落桌筹码为素材筹码 + 程序金额
- 倒计时用服务端时间（`serverTime` 偏移校正）；锁盘前 600 ms 客户端即禁投，服务端再校验一次
- 自动：新一局开始时重复上局已确认注单并自动确认；余额不足或被拒即自动关闭

## 审计与后台

- `roulette_rounds`（结果 / rng_audit / 总投注 / 总派彩 / server_id）、`roulette_bets`（禁止删除触发器）
- 钱包账目：`GAME_BET` / `GAME_WIN` / `GAME_REFUND`，对手账户 `SYS.ROULETTE_POOL`
- 在线人数：Redis `online:game:roulette`
