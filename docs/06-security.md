# 安全与防作弊设计

## 1. 威胁模型与对策矩阵

| 威胁 | 对策（实现位置） |
|---|---|
| SQL 注入 | 全部参数化查询（pg 占位符），无字符串拼接 SQL；迁移脚本静态审查 |
| XSS | 客户端不使用 v-html 渲染用户内容；昵称/聊天入库前长度与字符集白名单过滤；后台前端同样转义 |
| CSRF | API 无 Cookie 会话（Bearer Token），后台加 SameSite=Strict + 自定义头校验 |
| JWT 盗用 | Access 15 分钟短命 + Refresh 旋转（旧 Refresh 用即作废，重放触发全设备下线）+ 设备绑定 |
| 接口重放 | X-Timestamp ±120s + X-Nonce（Redis SETNX 5min）+ HMAC 签名（登录时下发会话签名密钥，非硬编码） |
| API 刷接口 / 撞库 / 暴力登录 | 三层限流：Nginx IP 级 → 网关令牌桶（IP+UID）→ 业务级（登录 5 次/15min 锁、验证码 1 次/60s、发奖类接口独立低阈值桶）；失败计数入 Redis，超限进临时封禁 |
| DDoS 基础 | Nginx 连接数/速率限制、WS 握手前置 Token 校验（无效连接立即断开）、上游可加 CDN/高防（文档指引） |
| 数据越权 / ID 枚举 | 所有查询强制以 token 内 uid 为准（禁止客户端传 userId 查他人）；UID 为随机段起始雪花 ID 非连续自增；后台按 RBAC 数据域过滤 |
| 水平/垂直越权（后台） | RBAC 权限点到接口粒度；中间件统一校验；关键操作二次确认 + 大额双人审批 |
| WebSocket 伪造 | 握手带 Token；每连接绑定 uid；敏感事件 HMAC(sessionKey, event+seq+ts+body)；seq 单调递增拒乱序 |
| 修改 APK / 内存修改 | 客户端零权威：余额/结果/手牌全部服务端；显示值每次以服务器回执覆盖；APK 加固与签名校验（发布清单） |
| 抓包改请求 | HTTPS/WSS 强制 + 签名覆盖 body；重要下行（结算）带服务器签名供客户端校验完整性 |
| 重复结算 / 金币并发 | settlements UNIQUE(round_id,type) + 交易幂等键 + 行锁 + CHECK(balance>=0)；见 docs/04-wallet.md |
| 敏感配置泄漏 | 全部经环境变量注入（.env 不入库，.env.example 提供模板）；客户端构建产物零密钥；概率配置只存服务端 |
| 恶意上传 | 头像走预设头像 ID（首发不开放自由上传）；后台上传限类型/大小/重命名（二期） |

## 2. 通信安全

- 全线 HTTPS/WSS（Nginx 终结，TLS1.2+，HSTS）；HTTP→HTTPS 301。
- 会话签名密钥：登录响应下发 `sessionKey`（服务端 Redis 保存，随 Token 刷新旋转），客户端仅存内存；签名算法 HMAC-SHA256。
- 服务端时间为唯一权威时间；客户端每次心跳校时。

## 3. 风控系统（risk-service）

事件源：登录（异地/新设备/频繁失败）、账变（单笔/小时净增阈值）、行为（射击频率、Spin 频率、胜率偏离、对局时长异常）、关联（同设备多号、同 IP 多号、固定同桌）。
处理管道：规则引擎打分 → risk_events 落库 → 分级动作（观察 / 限制进场 / 冻结钱包 / 封禁 + 后台告警）。所有规则阈值走 config-service 热更新。

## 4. 审计

- audit_logs：后台每个写操作（who/what/before/after/ip/时间），触发器禁 UPDATE/DELETE。
- 财务三表（transactions/ledger/adjustments）只增不改。
- 登录日志、管理员登录独立记录；审计角色只读全量日志。

## 5. 发布安全检查清单（RELEASE 前必过）

依赖漏洞扫描（pnpm audit）、密钥扫描（gitleaks 规则）、后台默认口令强制修改、CORS 白名单收紧、生产日志脱敏（手机号打码）、备份可恢复演练、限流压测、渗透自测脚本（tests/security/*.md 手册）。
