# 水果机 — 服务端结果架构（虚拟积分娱乐模式）

> 全部使用虚拟娱乐积分；不涉及真实货币。概率配置修改必须留痕（config_versions + audit_logs）。

## 1. 结果生成流程（客户端零决定权）

```
客户端 slot.spin{requestId, bet, lines}
  → 服务端校验：会话 / 下注白名单（后台配置的 betOptions）/ 频率（防脚本）/ 余额
  → 幂等检查 requestId（重复→返回首次结果）
  → 生成 round_id
  → CSPRNG（crypto.randomInt）对每列卷轴条独立抽停位
  → 按 Paytable 计算中奖线 / Scatter / Free Spin 触发
  → 单事务入账：扣 bet + 加 win（幂等键 = spin:{roundId}）
  → 写 slot_rounds 审计行
  → 返回 {roundId, stops[], winLines[], win, freeSpins, balance}
  → 客户端才开始播放转轴动画（结果已定，动画纯表现）
```

## 2. 数学模型（后台可配置）

- **卷轴条（Reel Strips）**：每列一条符号序列（长度可配，如 32 格），符号出现次数决定命中率——这是行业标准做法，RTP 由模拟器计算而非拍脑袋。
- **Paytable**：`symbol × count → multiplier`；Wild 替代规则、Scatter 计数规则、Free Spin 触发表全部在 `slot_paytables.config` JSONB。
- **RTP 验证**：`scripts/slot-rtp-sim.ts` 用蒙特卡洛（≥1000 万次）计算配置的理论 RTP / Hit Rate / 方差，后台发布新 Paytable 前必须附带模拟报告（发布接口强制要求填入模拟结果，进 config_versions）。
- **Jackpot**：虚拟积分累积奖池（每注抽千分比入池，池值展示用），触发条件配置化；首发做视觉演出+固定大奖，累积奖池二期开。

## 3. 可审计随机日志

`slot_rounds` 每局记录：`round_id, user_id, bet, lines, paytable_version, reel_version, stops[], win_lines, win, free_spin_state, rng_audit{algo:"crypto.randomInt", rolls:[...]}, created_at, server_id`。
审计员可用 rolls + 当版本卷轴条离线重算结果，验证服务器未篡改。

## 4. 演出规格（对齐竞品分析的 Spin 节奏公式）

加速弹射 → 匀速拖影 → 逐列错峰急停（120ms 间隔）+回弹 → 听牌末列慢停+灯效+心跳音 → 分级演出（线奖 / BIG WIN / MEGA WIN / JACKPOT，时长×2 递增、可点击跳过滚数）。Auto Spin 支持次数选择与"中大奖停止"。
