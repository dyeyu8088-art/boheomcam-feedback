# 统一虚拟钱包 / 账本体系（Wallet & Ledger）

> 所有资产均为虚拟娱乐资产（金币 COIN / 钻石 DIAMOND / 积分 POINT / 奖券 TICKET），不可兑换法币、不可提现。

## 1. 为什么不是 `users.balance += x`

单字段加减无法回答商业运营必答的四个问题：这 1 个金币从哪来？谁动的？当时余额多少？有没有被结算两次？因此采用「**账户 + 交易 + 借贷双录账本 + 结算单**」四层结构，全部只增不改。

## 2. 表结构

### wallet_accounts（账户）
```
user_id BIGINT, currency TEXT, balance BIGINT CHECK(balance>=0),
frozen BIGINT DEFAULT 0, version BIGINT, updated_at
UNIQUE(user_id, currency)
```
- 系统侧账户使用保留 UID：`1=系统发行账户`、`2=游戏抽水账户`、`3=活动奖励账户`、`4=调账账户`、`5=捕鱼奖池账户`、`6=水果机奖池账户`。所有用户账变必有系统对手方 → 平台总账恒平。

### wallet_transactions（交易，唯一入口函数写入）
```
transaction_id BIGINT PK, idempotency_key TEXT UNIQUE NOT NULL,
user_id, currency, type, amount BIGINT(有符号),
balance_before, balance_after,
game_id, room_id, round_id, reference_id,
server_id, status(posted/reversed), metadata JSONB, created_at
```
交易类型：`GAME_BET / GAME_WIN / GAME_LOSS / GAME_REFUND / ACTIVITY_REWARD / TASK_REWARD / MAIL_REWARD / SIGNIN_REWARD / ADMIN_ADJUSTMENT / SYSTEM_COMPENSATION / EXCHANGE / INIT_GRANT`

### wallet_ledger_entries（借贷分录）
每笔交易两行：用户账户 ±amount、系统对手账户 ∓amount。`SUM(amount) GROUP BY transaction_id == 0` 是对账任务的硬校验；全表 SUM == 0 是平台级审计校验。

### settlements（结算单）
```
settlement_id PK, round_id, game_id, settle_type, status(pending/posted/failed),
payload JSONB(每人输赢明细), created_by_server, posted_at
UNIQUE(round_id, settle_type)   -- 一局一种结算只可能存在一张单
```
游戏服务提交结算单 → wallet 模块在**单个数据库事务**内：锁定涉及账户（按 user_id 排序 `FOR UPDATE` 防死锁）→ 逐人校验与写交易+分录 → 标记结算单 posted。任何一步失败整体回滚，结算单转 failed 并报警，绝不出现半结算。

### wallet_adjustments（管理员调账）
```
adjustment_id PK, admin_id, user_id, currency, amount, reason NOT NULL,
balance_before, balance_after, approve_admin_id, admin_ip,
transaction_id FK, created_at
```
后台调账流程：填写原因 → 二次确认（金额复述）→（大额需第二管理员审批，阈值可配）→ 生成 adjustment + ADMIN_ADJUSTMENT 交易 + audit_log。**触发器禁止对本表及 ledger/audit 的 UPDATE/DELETE**，做不到"无痕改资产"。

## 3. 并发与幂等策略

| 风险 | 对策 |
|---|---|
| 并发扣款超扣 | 行锁 `SELECT balance FROM wallet_accounts WHERE … FOR UPDATE`；扣后 `CHECK(balance>=0)` 兜底 |
| 重复结算 | `settlements(round_id, settle_type)` UNIQUE + 交易 `idempotency_key` UNIQUE；重复提交返回原结果 |
| 网络重试重复入账 | 幂等键 = `round:{roundId}:{type}:{userId}` 或客户端 `requestId`，冲突即读旧 |
| 多服并发同一用户 | 锁在数据库行上，与节点无关；跨账户批量按 user_id 升序加锁防死锁 |
| 精度 | 一律 BIGINT 整数最小单位，无浮点 |
| 异常账变 | 单笔超阈值 / 单人每小时净增超阈值 → risk_events + 报警（阈值 config 可调） |

## 4. 对账与审计任务

- 每 5 分钟：增量校验 ledger 借贷平衡、交易 before/after 连续性（同账户按 transaction_id 排序，前后余额衔接）。
- 每日：全表 SUM(ledger)=0、账户余额 == 分录累计、输出对账报告入 audit。
- 所有校验失败 → 高优风控事件 + 后台醒目告警。
