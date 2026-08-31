# CHANGELOG

## [Unreleased]

### PHASE 0 — 需求与规则确认
- 完成竞品研究（欢乐斗地主/欢乐麻将/JJ/微乐/捕鱼头部产品/国际 Social Casino），输出 COMPETITOR_ANALYSIS.md（含功能矩阵与首发范围决策）
- 输出《延边麻将规则确认表》《红十规则确认表》：全部地区差异项配置化，临时默认值标注待确认
- 确立资产合规原则：全虚拟娱乐资产，无现金出入金

### PHASE 1 — 总体架构
- 技术选型定稿：Vue3+Pixi+Capacitor 客户端 / Node+TS 模块化服务群 / PostgreSQL+Redis / Docker+Nginx
- 输出架构图、22 个服务模块拆分与职责表、WebSocket 协议（seq/ACK/幂等/重连/重同步）、钱包账本四表设计、防作弊矩阵、设计系统「玄夜鎏金」Token、PHASE 0–19 路线图
