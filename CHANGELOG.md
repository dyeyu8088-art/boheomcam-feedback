# CHANGELOG

## [0.1.0] - 2026-08-31 首个可运行全栈里程碑

### PHASE 0-1 需求/架构
- 竞品研究（欢乐斗地主/欢乐麻将/JJ/微乐/头部捕鱼/国际 Social Casino）→ COMPETITOR_ANALYSIS.md（功能矩阵+首发范围）
- 《延边麻将规则确认表》《红十规则确认表》：地区差异规则 100% 配置化，临时默认值待当地确认
- 架构定稿：Vue3+Pixi+Capacitor 客户端 / Node+TS 模块化服务群（22 服务模块）/ PostgreSQL+Redis / Docker+Nginx
- 资产合规：全虚拟娱乐资产，不可兑换/提现；无现金出入金代码

### PHASE 2-4 基座
- monorepo（pnpm workspace）+ 三端共享 @yanbian/protocol（事件/错误码/DTO）
- 46 表迁移：钱包四表触发器防篡改、流水分区、RBAC、审计；种子与规则包同步；管理员引导（随机初始密码+首登强改）
- server-core：pg/redis/pino 结构化日志/53bit 雪花 ID/JWT(HS256)/scrypt/HMAC/限流/Nonce/Redis 总线/轻量 metrics
- 账号体系：游客/短信/密码登录、双 Token 旋转（重放→全端下线+风控）、设备与登录日志、封禁检查

### PHASE 5-13 游戏与玩法
- @yanbian/game-common 四引擎（同构 WebCrypto RNG）：
  - 麻将：模块化牌型判定器/听牌/桌面状态机（优先级仲裁/过水/杠分/查叫/报听/回放事件流）
  - 红十：牌型解析比较/提示/身份亮明/独打双上倍率/零和结算
  - 捕鱼：波次脚本/滑窗频控/子弹一次性消耗/RTP 池控制器（10 万发实测收敛 96%±4%）
  - 水果机：卷轴条 CSPRNG/Wild/Scatter/免费旋转/演出分级；RTP 模拟器 40 万转实测 96.8%
- game-service：WS 网关（seq/requestId 幂等缓存/心跳/单点踢线/断线保活+快照重连）、房间/匹配（机器人补位）、
  四游戏宿主（计时/托管/多局轮庄/破产保护/结算入账/任务榜单）
- api-service：钱包（行锁+双录+结算单唯一）、战绩+回放、签到任务邮件好友公告排行、大厅与品牌白标配置

### PHASE 14-15 后台与安全
- 管理后台 API+前端：RBAC 到接口粒度、Dashboard 实时图表、用户管理（调账二次确认留痕/封禁/踢线）、
  金币流水/结算单、配置发布留痕（config_versions）、公告双语、系统邮件、风控事件、审计日志（不可篡改）
- 安全：三层限流、登录失败锁、Nonce/时间戳/签名基建、最小信息下发（他人手牌不出服务器）、CSPRNG

### PHASE 16-18 测试与部署
- 测试全绿：引擎单测 39 + 钱包集成 7 + 全栈 E2E 28 + 客户端 UI 冒烟 8 + 后台 UI 冒烟 8
- 部署：Dockerfile×2、docker-compose.prod（api×2/game/前端/pg WAL 归档/redis/每日备份/Prometheus）、
  Nginx HTTPS/WSS/限流、恢复演练脚本、GitHub Actions CI、.env.example
- 文档：架构/DB/协议/钱包/安全/设计系统/性能预算/部署与 RC 检查表（docs/01-10）

### 已知待办（详见 docs/10 §5）
- 规则确认表 ⏳ 项待当地顾问确认后发布正式规则包（后台可发布，零代码改动）
- 正式美术资产替换程序化占位；短信网关接入；真机压测与商店合规流程
