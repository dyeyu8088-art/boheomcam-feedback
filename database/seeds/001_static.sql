-- 静态种子：游戏、RBAC、任务、公告（幂等）
INSERT INTO games (game_id, name, name_ko, status, sort) VALUES
 ('mahjong_yanbian','延边麻将','연변 마작','online',1),
 ('hongshi','延边红十','연변 홍십','online',2),
 ('fishing','捕鱼达人','물고기 잡기','online',3),
 ('slot_fruit','水果机','과일 슬롯','online',4)
ON CONFLICT (game_id) DO UPDATE SET name = EXCLUDED.name, name_ko = EXCLUDED.name_ko;

INSERT INTO roles (code, name) VALUES
 ('super','超级管理员'),('ops','运营'),('cs','客服'),('finance','财务/资产审核'),
 ('tech','技术'),('risk','风控'),('audit','审计')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name) VALUES
 ('dashboard.view','查看仪表盘'),
 ('user.view','查看用户'),('user.edit','编辑用户资料'),('user.ban','封禁/解封'),('user.kick','强制下线'),
 ('wallet.view','查看资产流水'),('wallet.adjust','调整用户资产'),('wallet.adjust.approve','审批大额调整'),
 ('game.view','查看游戏'),('game.maintain','游戏维护开关'),('config.view','查看配置'),('config.publish','发布配置/规则包/概率'),
 ('room.view','查看房间'),('room.dissolve','解散房间'),
 ('record.view','查看战绩/回放'),
 ('activity.manage','管理活动/任务'),('mail.send','发送邮件'),('announce.manage','管理公告'),
 ('support.manage','处理客服工单'),
 ('risk.view','查看风控'),('risk.handle','处理风控事件'),
 ('audit.view','查看审计日志'),
 ('admin.manage','管理后台账号与角色'),
 ('server.view','查看服务器状态')
ON CONFLICT (code) DO NOTHING;

-- super 拥有全部权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code='super'
ON CONFLICT DO NOTHING;
-- 运营
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
 ('dashboard.view','user.view','game.view','config.view','room.view','record.view','activity.manage','mail.send','announce.manage','support.manage','server.view')
WHERE r.code='ops' ON CONFLICT DO NOTHING;
-- 客服
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
 ('user.view','record.view','mail.send','wallet.view','support.manage')
WHERE r.code='cs' ON CONFLICT DO NOTHING;
-- 财务
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
 ('dashboard.view','wallet.view','wallet.adjust','wallet.adjust.approve','user.view','audit.view')
WHERE r.code='finance' ON CONFLICT DO NOTHING;
-- 技术
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
 ('dashboard.view','server.view','game.view','game.maintain','config.view','config.publish','room.view','room.dissolve')
WHERE r.code='tech' ON CONFLICT DO NOTHING;
-- 风控
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
 ('dashboard.view','risk.view','risk.handle','user.view','user.ban','user.kick','wallet.view','record.view')
WHERE r.code='risk' ON CONFLICT DO NOTHING;
-- 审计（只读）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
 ('dashboard.view','audit.view','wallet.view','user.view','record.view','risk.view','config.view')
WHERE r.code='audit' ON CONFLICT DO NOTHING;

INSERT INTO tasks (task_id, name, name_ko, descr, period, metric, game_id, target, rewards, sort) VALUES
 ('daily_login','每日登录','매일 로그인','登录游戏即可完成','daily','login',NULL,1,'[{"currency":"COIN","amount":2000}]',1),
 ('daily_play3','对局达人','대국 달인','完成 3 局任意对局','daily','play_rounds',NULL,3,'[{"currency":"COIN","amount":5000}]',2),
 ('daily_win1','旗开得胜','승리의 기쁨','赢得 1 局对局','daily','win_rounds',NULL,1,'[{"currency":"COIN","amount":3000}]',3),
 ('daily_fish20','捕鱼小能手','피싱 마스터','击杀 20 条鱼','daily','fish_kills','fishing',20,'[{"currency":"COIN","amount":4000}]',4),
 ('daily_spin10','幸运转轴','행운의 릴','水果机旋转 10 次','daily','slot_spins','slot_fruit',10,'[{"currency":"COIN","amount":3000}]',5),
 ('weekly_play20','周活跃','주간 활약','本周完成 20 局对局','weekly','play_rounds',NULL,20,'[{"currency":"DIAMOND","amount":50}]',10)
ON CONFLICT (task_id) DO NOTHING;

INSERT INTO activities (type, name, name_ko, config) VALUES
 ('sign_in','每日签到','매일 출석체크','{"rewards":[{"day":1,"currency":"COIN","amount":2000},{"day":2,"currency":"COIN","amount":3000},{"day":3,"currency":"COIN","amount":4000},{"day":4,"currency":"COIN","amount":5000},{"day":5,"currency":"COIN","amount":6000},{"day":6,"currency":"COIN","amount":8000},{"day":7,"currency":"DIAMOND","amount":30}]}')
ON CONFLICT DO NOTHING;

-- 品牌更名（延边娱乐 → 延边游戏）：已有库中的欢迎公告同步改名（幂等）
-- 旧种子无唯一约束导致每次启动重复插入欢迎公告：去重（保留最早一条）
DELETE FROM announcements a USING announcements b WHERE a.title=b.title AND a.body=b.body AND a.id>b.id;
UPDATE announcements SET title='欢迎来到延边游戏大厅', title_ko='연변 게임에 오신 것을 환영합니다' WHERE title='欢迎来到延边娱乐';

INSERT INTO announcements (title, title_ko, body, body_ko, sort)
SELECT '欢迎来到延边游戏大厅','연변 게임에 오신 것을 환영합니다',
  '平台内所有金币、钻石、积分均为虚拟娱乐资产，仅供游戏娱乐，不可兑换现金或任何实物。祝您游戏愉快！',
  '플랫폼 내 모든 코인, 다이아몬드, 포인트는 가상 오락 자산으로 게임 오락용으로만 사용되며 현금이나 실물로 교환할 수 없습니다. 즐거운 게임 되세요!',1
WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE title='欢迎来到延边游戏大厅');
