# 性能预算与优化策略

## 1. 客户端帧率预算（目标 60FPS，低端安卓兜底 30FPS）

| 场景 | 预算 | 手段 |
|---|---|---|
| 大厅 | DOM 动画仅 transform/opacity；粒子 ≤ 18 个 CSS 节点 | 卡片 sheen 用单层渐变位移；backdrop-filter 限 3 层 |
| 麻将/红十 | 纯 DOM/CSS，无 canvas 常驻 | 牌面 CSS 绘制零图片请求；列表不重排（key 稳定） |
| 捕鱼 | 同屏 ≤60 鱼 + 40 子弹 + 30 粒子 | Pixi 单场景；对象池（子弹/金币/爆点复用——当前版本销毁重建，量小可接受，放量前切池）；纹理图集替换程序化绘制；`resolution` 按 devicePixelRatio 封顶 2 |
| 水果机 | 15 个符号节点滚动 | rAF 驱动位移；滚数计时器 40ms 粒度 |

低端机降级档（设备打分：内存/核数/首帧耗时）：关闭光柱与模糊、粒子减半、resolution=1、30FPS ticker。

## 2. 内存纪律（防捕鱼 30 分钟内存爬升）

- 离开游戏路由即 `app.destroy(true, {children:true})` 销毁 Pixi 场景（已实现）。
- 鱼/子弹越界与过期即时 destroy；`bullets`、`activeFish` 有界。
- 服务端：`recentRequests` 每会话上限 200；引擎 `bullets` 表 30s 滚动清理；房间销毁清计时器。
- 发布前必测：真机捕鱼 30 分钟，Chrome Performance Monitor 内存曲线斜率 ≈ 0。

## 3. 网络包预算

- 鱼群按波次广播（一波一包，~2KB），不逐帧同步；位置由 `(pathId, spawnAtMs, serverNow)` 插值。
- WS 上行心跳 10s 一次；消息体上限 16KB（网关强制断开）。
- 结算广播只带增量（scoreChanges/balances），全量走 `sys.resync`。

## 4. 服务端容量模型

- 无状态 api：水平复制，瓶颈在 PG 连接（每实例池 20）；1 万 DAU 场景 2 实例富余。
- game 节点：单进程 3–5k WS 连接（心跳+房间广播为主）；房间按节点分片，跨节点用户消息走 Redis 总线。10k 在线 = 2–3 game 节点。
- PG：账本行锁按用户分散，无热点行；高频表按月/日分区；读扩展走从库。
- 压测入口：`node tests/load-ws.mjs 1000 0.1`（本机阶梯），生产在独立压力机执行 1k/5k/10k 并观测 /metrics + PG `pg_stat_activity`。

## 5. 资源与加载（Bundle 策略）

- 路由级分包（已实现）：大厅首屏 gzip ≈ 55KB；Pixi 仅在进入捕鱼/水果机时加载（gzip 154KB，一次缓存）。
- 正式美术资产按游戏 Bundle 从 CDN 拉取 + 版本清单（热更新）：清单 `assets/manifest.json` 带 hash，客户端比对增量下载，退出游戏释放纹理。
- 音频：BGM/SFX/Voice 三通道（预留 audio/ 模块），进入游戏懒加载，切后台暂停。

## 6. 已量测数据（本仓库开发环境，单机单节点）

- 客户端构建：全量 gzip ≈ 230KB（含 Pixi）；vite build 7s。
- 服务端：E2E 28 项 91s（含整局麻将/红十真实对局）；钱包并发 100 扣款 326ms 内完成且余额精确。
- 水果机 RTP 模拟：40 万转 96.8%（目标 96%）。
- WS 负载（tests/load-ws.mjs，游戏节点单进程）：
  - 500 并发：连接成功率 100%，心跳 RTT p50=0ms/p99=4ms，Spin（CSPRNG+双账变+审计落库）p50=10ms/p99=26ms，0 错误。
  - 1000 并发（单 IP）：600 成功 400 被全局 IP 限流拦截（限流层按设计工作）；成功连接 RTT p99=1ms、Spin p99=18ms。
  - 单 IP 压测需临时调高 `AUTH_RATE_LIMIT` / `IP_RATE_LIMIT` 环境变量；生产 1k/5k/10k 阶梯在多 IP 压力机执行。
