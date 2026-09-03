# 股市风云（stock_updown）架构与规则

> 全部为**虚拟品种 + 服务端模拟行情**，不使用任何真实公司名称 / 商标 / 真实行情源；金币为游戏内虚拟娱乐资产，不可兑换现金 / 不可提现。
> 若未来要接入真实行情或涉及真实货币，必须先单独完成当地法律 / 牌照 / KYC / AML / 支付合规审查（见 README 合规声明）。

## 行情数据源：`MarketDataProvider`（`services/game/src/market/MarketDataProvider.ts`）

```ts
interface MarketDataProvider {
  getCurrentPrice(instrument): PricePoint;          // 现价
  getHistory(instrument, limit): PricePoint[];       // 历史 tick
  getRoundOpeningPrice(instrument, openedAt);        // 开盘时刻（含）之前最近 tick
  getRoundSettlementPrice(instrument, settleAt);     // 结算时刻（含）之后第一个 tick
  onTick(cb): () => void;                            // 每 tick 回调
}
```

- 当前实现 `SimulatedMarketProvider`：几何布朗运动（每 tick σ = 0.12%，Box–Muller 的均匀数来自 CSPRNG）+ 轻微均值回归
  （`drift = 0.002 × ln(base / price)`，防止长期漂离基准价）；价格保留两位小数；每 tick 落库 `stock_ticks`（保留 24 h）供审计 / 回放
- 价格生成与投注完全无关；服务端 tick 每 1000 ms 广播 `stock.tick{ts, prices}`；客户端只绘图，**严禁**前端决定结果
- 三个虚拟品种：延吉科技（YB_TECH 128.00）、长白山泉（CB_SPRING 56.50）、图们江航运（TM_SHIP 23.80）

## 回合（`stockHost.ts`，`stock_sim_v1`，可由 `game_rules` 覆盖）

- 每个品种独立回合：开盘 → 30 s 后结算，结算 tick 即下一回合开盘 tick（开盘价 = 上一回合结算价）；结算前 8 s 锁盘
- 每次点击即一注：`stock.bet{instrument, type, selection, amount}`（需 `requestId`）
  - 校验：回合存在且未锁盘（服务端再留 200 ms 余量）、`normalizeBet`（类型 / 数字 / 区间）、单局上限 500,000、余额预检
  - **赔率在下注时锁定**（`odds_bp`，含本金）；HIGHER / LOWER 的参考价由服务端当前价写入（忽略客户端传值）
  - 单事务：`GAME_BET` 扣款（幂等 `stock:bet:<uid>:<requestId>`）→ `stock_bets` 落库；重复 requestId 返回原注单与余额
- 结算：以数据库注单为准，逐用户单事务更新 `payout` → 有赢则 `GAME_WIN`（幂等 `stock:win:<roundId>:<uid>`）→
  `stock_rounds.settlement_price / direction / total_payout / settled_at`，`rng_audit` 记录开盘 / 结算 tick 时间与数据源；
  按人推送 `stock.result{openingPrice, settlementPrice, direction, changePct, myBets[{…,payout}], myPayout, balance, results}`
- 崩溃恢复：已有结算价 → 补结算；无结算价 → 退款（`GAME_REFUND`，幂等）并标记 `void`

## 玩法与赔率（`packages/game-common/src/stock`）

| 类型 | selection | 判定 | 赔率（含本金） |
| --- | --- | --- | --- |
| UP / DOWN 涨跌 | — | 结算价 vs 开盘价；平盘退还本金 | 1.90× |
| HIGHER / LOWER 高低 | 下注时现价（服务端写入） | 结算价 vs 参考价；相等退还本金 | 1.90× |
| FIRST_DIGIT 小数首位 | `"0"`–`"9"` | 结算价小数点后第一位 | 9.50× |
| LAST_DIGIT 小数末位 | `"0"`–`"9"` | 结算价小数点后第二位 | 9.50× |
| RANGE 涨跌幅区间 | `DN2 / DN1 / UP1 / UP2` | 相对开盘价：< -0.5% / [-0.5%, 0) / [0, 0.5%) / ≥ 0.5% | 4.2× / 3.4× / 3.4× / 4.2× |

理论：30 tick × σ 0.12% → σ_round ≈ 0.66%；涨跌 / 高低 ≈ 50%（RTP 95%），数字 ≈ 10%（RTP 95%），
区间 |r| > 0.5% ≈ 22.4%、0 < r < 0.5% ≈ 27.6%（RTP ≈ 94%）。单测 `stock.test.ts` 含 4000 回合蒙特卡洛 RTP 断言。

## 客户端（`apps/client-game/src/games/stock/StockView.vue`）

- 左：品种列表（现价 / 相对开盘涨跌幅）、本局投注（含锁定赔率）、近期结果；中：Canvas 走势图
  （150 tick、贝塞尔平滑、开盘价虚线、现价标签、涨绿跌红渐变填充、分析师立绘）；右：筹码（素材）、看涨 / 看跌
  （素材底板 + 牛熊图标 + 程序文字 + 赔率）、高于 / 低于现价、小数首位 / 末位（数字选择 0–9）、四档涨跌幅区间
- 倒计时用服务端时间偏移校正；锁盘前 500 ms 客户端禁投，服务端再校验；结算面板 + `RewardAnimation`
- 素材 `chip_*` 为静态面额版面；`caishen_analyst` / `caishen_scroll` 为立绘；箭头 / 数字图标为程序文字的图标前缀
