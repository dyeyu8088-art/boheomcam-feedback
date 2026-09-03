# 通信协议设计（REST + WebSocket）

## 1. REST（无状态业务）

- 前缀 `/api/v1`，JSON；鉴权 `Authorization: Bearer <accessToken>`。
- 统一响应：`{ "code": 0, "msg": "OK", "data": {…}, "requestId": "…" }`（code 见 packages/protocol/errors.ts）。
- 敏感写接口（登录、领奖、调账等）要求头：`X-Request-Id`（UUID，幂等）、`X-Timestamp`（±120s 窗口）、`X-Nonce`（Redis 5 分钟去重）、`X-Sign`（HMAC-SHA256，会话密钥，见 docs/06-security.md）。
- 全局限流：IP 维度 + 用户维度 双层令牌桶；登录/验证码另有专用低阈值桶。

## 2. WebSocket（实时游戏）

端点：`wss://<host>/ws?token=<accessToken>`（握手即鉴权，失败 4401 关闭）。

### 2.1 信封

```jsonc
// 上行（客户端 → 服务器）
{
  "v": 1,                    // 协议版本
  "requestId": "c-9f3a…",    // 客户端生成，服务端幂等去重（游戏动作类必填）
  "event": "mahjong.discard",
  "seq": 128,                // 客户端自增序号，服务端过滤乱序/重复
  "timestamp": 1767158400123,
  "data": { "tile": 14 },
  "sig": "hex…"              // 敏感动作 HMAC（spin/fire/settle 确认等）
}

// 下行（服务器 → 客户端）
{
  "v": 1,
  "event": "mahjong.discard.ok",  // 或 "error"
  "ack": 128,                     // 回应的上行 seq（请求-响应型）
  "pushSeq": 5231,                // 服务端房间内自增推送序号
  "timestamp": 1767158400180,
  "code": 0,
  "data": { … }
}
```

### 2.2 可靠性机制

| 机制 | 实现 |
|---|---|
| 消息序号 | 上行 `seq` 单调递增；下行 `pushSeq` 房间单调递增 |
| 重复过滤 | `requestId` 于 Redis `SETNX`（TTL 5min）；重复请求返回首次结果（缓存响应） |
| ACK | 请求-响应型事件带 `ack`；客户端 5s 未收 ACK → 重发（同 requestId，幂等安全） |
| 超时/重试 | 客户端指数退避重试 ≤3 次；仍失败 → 触发重连流程 |
| 心跳 | 客户端每 10s `sys.ping{t}` → `sys.pong{t, serverTime}`（顺带校时）；服务端 30s 未见任何包判定断线 |
| 断线重连 | 断线后会话保留：大厅 90s、对局中 120s 且自动托管；重连握手带 `resumeKey` → 服务端推 `room.sync` 全量快照 |
| 状态重同步 | 客户端发现 `pushSeq` 跳号 → 主动发 `sys.resync` → 服务端下发快照，废弃本地状态 |
| 单点登录 | 同 UID 新连接 → 旧连接收 `sys.kicked{reason}` 后关闭（多设备策略可配） |

### 2.3 事件命名空间

`sys.* auth.* lobby.* match.* room.* chat.* mahjong.* hongshi.* fishing.* slot.* roulette.*`

核心事件（完整清单见 packages/protocol/src/events.ts，三端共享常量）：

- 房间：`room.create / room.join / room.leave / room.ready / room.unready / room.dissolve / room.kick / room.sync / room.playerJoined / room.playerLeft / room.playerOffline / room.playerReconnect / room.gameStart`
- 麻将：`mahjong.deal(私发) / mahjong.draw(私发) / mahjong.drawPublic(他人摸牌仅计数) / mahjong.discard / mahjong.actionAsk(可吃碰杠胡窗口) / mahjong.action(chi|peng|gang|hu|pass) / mahjong.trustee / mahjong.roundEnd / mahjong.settle`
- 红十：`hongshi.deal / hongshi.play / hongshi.pass / hongshi.hint / hongshi.trustee / hongshi.roundEnd / hongshi.settle`
- 捕鱼：`fishing.enter / fishing.waveStart(鱼群波次脚本) / fishing.spawn / fishing.fire → fishing.fireOk{bulletId} / fishing.hit → fishing.hitResult / fishing.playerState / fishing.bossWarning / fishing.leave`
- 水果机：`slot.enter / slot.spin → slot.spinResult / slot.history / slot.jackpot(广播奖池) / slot.ticket`
- 轮盘：`roulette.enter → roulette.enter.ok{config, round, myBets, history, balance} / roulette.state(阶段广播) / roulette.bet{bets[]} → roulette.bet.ok{accepted, balance} / roulette.spin{result, wheelIndex, spinMs} / roulette.result{myBets, myPayout, balance, history} / roulette.history / roulette.leave`
- 结算通用：`game.roundResult{roundId, results[], balances[]}`

### 2.4 断线恢复快照（room.sync）

服务端下发（最小信息原则）：房间元数据+规则快照、座位与玩家公开状态（含托管/离线标记）、当前阶段与行动者、行动剩余毫秒、**本人完整手牌**、他人**仅手牌数量**、全部公开牌区（弃牌河/碰杠亮牌/本轮出牌）、本人未决动作窗口、当前比分与本局序号、`pushSeq` 基准值。客户端收到后整体重建 UI。

## 3. 内部服务总线（MessageBus）

Redis Pub/Sub 主题：`bus.room.<roomId>`（房间事件）、`bus.user.<uid>`（跨节点踢线/邮件推送）、`bus.settle`（结算队列，实际用 Redis Stream 保证至少一次+幂等消费）、`bus.risk`（风控事件流）。接口抽象在 packages/game-common/bus.ts，可平移 NATS。
