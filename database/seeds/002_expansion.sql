-- 002 扩展域参考数据（幂等）
INSERT INTO vip_levels (level, exp_required, name, name_ko, perks) VALUES
 (0, 0,        'VIP0', 'VIP0', '{"dailyBonus":0,"bonusRateBp":0}'),
 (1, 1000,     'VIP1', 'VIP1', '{"dailyBonus":1000,"bonusRateBp":0}'),
 (2, 5000,     'VIP2', 'VIP2', '{"dailyBonus":2000,"bonusRateBp":50}'),
 (3, 20000,    'VIP3', 'VIP3', '{"dailyBonus":4000,"bonusRateBp":100}'),
 (4, 50000,    'VIP4', 'VIP4', '{"dailyBonus":8000,"bonusRateBp":150}'),
 (5, 120000,   'VIP5', 'VIP5', '{"dailyBonus":15000,"bonusRateBp":200}'),
 (6, 300000,   'VIP6', 'VIP6', '{"dailyBonus":30000,"bonusRateBp":250}'),
 (7, 700000,   'VIP7', 'VIP7', '{"dailyBonus":60000,"bonusRateBp":300}'),
 (8, 1500000,  'VIP8', 'VIP8', '{"dailyBonus":120000,"bonusRateBp":400}'),
 (9, 3000000,  'VIP9', 'VIP9', '{"dailyBonus":250000,"bonusRateBp":500}'),
 (10, 6000000, 'VIP10','VIP10','{"dailyBonus":500000,"bonusRateBp":600}')
ON CONFLICT (level) DO NOTHING;

INSERT INTO items (item_id, kind, name, name_ko, icon, game_id, meta) VALUES
 ('skill_lightning', 'skill', '闪电', '번개',   'fishing.skillLightning', 'fishing', '{"skill":"LIGHTNING"}'),
 ('skill_missile',   'skill', '导弹', '미사일', 'fishing.skillMissile',   'fishing', '{"skill":"MISSILE"}'),
 ('skill_laser',     'skill', '激光', '레이저', 'fishing.skillLaser',     'fishing', '{"skill":"LASER"}'),
 ('skill_nuke',      'skill', '核弹', '핵폭탄', 'fishing.skillNuke',      'fishing', '{"skill":"NUKE"}'),
 ('skill_freeze',    'skill', '冰冻', '빙결',   'fishing.skillFreeze',    'fishing', '{"skill":"FREEZE"}'),
 ('ticket_free_spin','ticket','免费旋转券','무료 스핀권','slots.slotBonus','slot_fruit','{"spins":5}'),
 ('frame_gold',      'frame', '黄金头像框','골드 아바타 프레임','common.vipCrown', NULL, '{"frame":"gold"}'),
 ('frame_caishen',   'frame', '财神头像框','재신 아바타 프레임','common.avatarCaishenRound', NULL, '{"frame":"caishen"}')
ON CONFLICT (item_id) DO NOTHING;

INSERT INTO shop_products (product_id, name, name_ko, price_currency, price, grant_currency, grant_amount, grant_item, grant_qty, icon, sort, daily_limit) VALUES
 ('coins_20k',  '金币袋 2 万',  '코인 2만',   'DIAMOND', 10,  'COIN', 20000,  NULL, 0, 'common.coinStack',        1, 0),
 ('coins_110k', '金币箱 11 万', '코인 11만',  'DIAMOND', 50,  'COIN', 110000, NULL, 0, 'common.iconTreasureChest', 2, 0),
 ('coins_250k', '金币宝库 25 万','코인 25만', 'DIAMOND', 100, 'COIN', 250000, NULL, 0, 'common.iconGoldIngot',    3, 0),
 ('skill_pack_lightning', '闪电 ×3', '번개 ×3', 'COIN', 6000,  NULL, 0, 'skill_lightning', 3, 'fishing.skillLightning', 10, 20),
 ('skill_pack_missile',   '导弹 ×3', '미사일 ×3','COIN', 9000,  NULL, 0, 'skill_missile',   3, 'fishing.skillMissile',   11, 20),
 ('skill_pack_laser',     '激光 ×3', '레이저 ×3','COIN', 15000, NULL, 0, 'skill_laser',     3, 'fishing.skillLaser',     12, 20),
 ('skill_pack_nuke',      '核弹 ×1', '핵폭탄 ×1','COIN', 30000, NULL, 0, 'skill_nuke',      1, 'fishing.skillNuke',      13, 10),
 ('skill_pack_freeze',    '冰冻 ×3', '빙결 ×3', 'COIN', 24000, NULL, 0, 'skill_freeze',    3, 'fishing.skillFreeze',    14, 20),
 ('ticket_spin_5',        '免费旋转券 ×1','무료 스핀권 ×1','DIAMOND', 5, NULL, 0, 'ticket_free_spin', 1, 'slots.slotBonus', 20, 10),
 ('frame_gold',           '黄金头像框','골드 아바타 프레임','DIAMOND', 30, NULL, 0, 'frame_gold',    1, 'common.vipCrown', 30, 1),
 ('frame_caishen',        '财神头像框','재신 아바타 프레임','DIAMOND', 60, NULL, 0, 'frame_caishen', 1, 'common.avatarCaishenRound', 31, 1)
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO slot_jackpots (tier, pool, seed, contrib_bp, hit_chance_ppm, min_bet) VALUES
 ('mini',  20000,   20000,   20, 4000, 0),
 ('minor', 100000,  100000,  15, 600,  2000),
 ('major', 800000,  800000,  10, 60,   10000),
 ('grand', 5000000, 5000000, 5,  4,    40000)
ON CONFLICT (tier) DO NOTHING;

-- 三个滚动赛事（首次播种时创建；结束后由 api 服务的赛事调度自动结算并生成下一期）
INSERT INTO tournaments (game_id, name, name_ko, metric, starts_at, ends_at, rewards, status)
SELECT * FROM (VALUES
 ('mahjong_yanbian', '麻将周赛', '마작 주간전', 'wins', now(), now() + interval '7 days',
  '[{"rankFrom":1,"rankTo":1,"currency":"COIN","amount":500000},{"rankFrom":2,"rankTo":3,"currency":"COIN","amount":200000},{"rankFrom":4,"rankTo":10,"currency":"COIN","amount":50000}]'::jsonb, 'running'),
 ('fishing', '捕鱼大赛', '피싱 대회', 'fish_kills', now(), now() + interval '3 days',
  '[{"rankFrom":1,"rankTo":1,"currency":"COIN","amount":300000},{"rankFrom":2,"rankTo":5,"currency":"COIN","amount":100000},{"rankFrom":6,"rankTo":20,"currency":"COIN","amount":20000}]'::jsonb, 'running'),
 ('slot_fruit', '水果机大奖赛', '슬롯 그랑프리', 'slot_win', now(), now() + interval '3 days',
  '[{"rankFrom":1,"rankTo":1,"currency":"DIAMOND","amount":200},{"rankFrom":2,"rankTo":5,"currency":"DIAMOND","amount":50},{"rankFrom":6,"rankTo":20,"currency":"COIN","amount":20000}]'::jsonb, 'running')
) AS v(game_id, name, name_ko, metric, starts_at, ends_at, rewards, status)
WHERE NOT EXISTS (SELECT 1 FROM tournaments t WHERE t.name = v.name AND t.status IN ('scheduled','running'));
