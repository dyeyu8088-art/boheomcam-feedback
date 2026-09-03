-- 006 扩展域：新游戏注册、系统账户、VIP、背包、商城、赛事、Jackpot、轮盘、股票玩法、捕鱼技能
-- 全部为虚拟娱乐资产内部流转；不涉及法币 / 充值 / 提现。

-- 新游戏（上线前 status=offline，大厅按服务器状态显示"即将上线"，不做假入口）
INSERT INTO games (game_id, name, name_ko, status, sort) VALUES
 ('roulette','幸运轮盘','럭키 룰렛','offline',5),
 ('stock_updown','股市风云','주가 예측','offline',6)
ON CONFLICT (game_id) DO NOTHING;

INSERT INTO wallet_system_accounts VALUES
 (7,'SYSTEM_SHOP'),(8,'SYSTEM_ROULETTE_POOL'),(9,'SYSTEM_STOCK_POOL'),(10,'SYSTEM_JACKPOT_POOL')
ON CONFLICT DO NOTHING;

-- ───────── VIP ─────────
CREATE TABLE vip_levels (
  level        INT PRIMARY KEY,
  exp_required BIGINT NOT NULL,
  name         TEXT NOT NULL,
  name_ko      TEXT NOT NULL DEFAULT '',
  perks        JSONB NOT NULL DEFAULT '{}'     -- {dailyBonus, bonusRateBp, frame}
);

-- ───────── 背包 ─────────
CREATE TABLE items (
  item_id  TEXT PRIMARY KEY,
  kind     TEXT NOT NULL CHECK (kind IN ('skill','ticket','frame','consumable')),
  name     TEXT NOT NULL,
  name_ko  TEXT NOT NULL DEFAULT '',
  icon     TEXT NOT NULL DEFAULT '',            -- assets-manifest key（group.key）
  game_id  TEXT,
  meta     JSONB NOT NULL DEFAULT '{}',
  status   TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE user_items (
  user_id    BIGINT NOT NULL,
  item_id    TEXT NOT NULL REFERENCES items(item_id),
  qty        INT NOT NULL DEFAULT 0 CHECK (qty >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE user_item_logs (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL,
  item_id         TEXT NOT NULL,
  delta           INT NOT NULL,
  reason          TEXT NOT NULL,                -- shop / skill_use / reward / admin
  ref_id          TEXT,
  idempotency_key TEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_uitem_logs_user ON user_item_logs(user_id, created_at DESC);
CREATE TRIGGER trg_uitem_logs_protect BEFORE UPDATE OR DELETE ON user_item_logs FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ───────── 商城（钻石 ↔ 金币 / 道具，纯虚拟资产内部兑换） ─────────
CREATE TABLE shop_products (
  product_id     TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  name_ko        TEXT NOT NULL DEFAULT '',
  price_currency TEXT NOT NULL CHECK (price_currency IN ('DIAMOND','COIN')),
  price          BIGINT NOT NULL CHECK (price > 0),
  grant_currency TEXT CHECK (grant_currency IN ('COIN','DIAMOND','POINT','TICKET')),
  grant_amount   BIGINT NOT NULL DEFAULT 0,
  grant_item     TEXT REFERENCES items(item_id),
  grant_qty      INT NOT NULL DEFAULT 0,
  icon           TEXT NOT NULL DEFAULT '',
  sort           INT NOT NULL DEFAULT 0,
  daily_limit    INT NOT NULL DEFAULT 0,        -- 0 = 不限
  status         TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE shop_orders (
  order_id        BIGINT PRIMARY KEY,
  user_id         BIGINT NOT NULL,
  product_id      TEXT NOT NULL REFERENCES shop_products(product_id),
  price_currency  TEXT NOT NULL,
  price           BIGINT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'posted',
  tx_id           BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shop_orders_user ON shop_orders(user_id, created_at DESC);
CREATE TRIGGER trg_shop_orders_protect BEFORE UPDATE OR DELETE ON shop_orders FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ───────── 赛事（纯荣誉 + 虚拟奖励，奖励以邮件附件发放） ─────────
CREATE TABLE tournaments (
  id         BIGSERIAL PRIMARY KEY,
  game_id    TEXT NOT NULL REFERENCES games(game_id),
  name       TEXT NOT NULL,
  name_ko    TEXT NOT NULL DEFAULT '',
  metric     TEXT NOT NULL CHECK (metric IN ('wins','fish_kills','slot_win','coin_win','rounds')),
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  rewards    JSONB NOT NULL DEFAULT '[]',        -- [{rankFrom, rankTo, currency, amount}]
  status     TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','running','settled','cancelled')),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);
CREATE INDEX idx_tournaments_status ON tournaments(status, ends_at);
CREATE TABLE tournament_entries (
  tournament_id     BIGINT NOT NULL REFERENCES tournaments(id),
  user_id           BIGINT NOT NULL,
  score             BIGINT NOT NULL DEFAULT 0,
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  rank              INT,
  reward_mail_id    BIGINT,
  PRIMARY KEY (tournament_id, user_id)
);
CREATE INDEX idx_tent_score ON tournament_entries(tournament_id, score DESC, joined_at);

-- 全服邮件已读 / 已领（004 中引用但未创建）
CREATE TABLE mail_reads (
  mail_id    BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  read_at    TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  PRIMARY KEY (mail_id, user_id)
);

-- ───────── 水果机 Jackpot 四档 ─────────
CREATE TABLE slot_jackpots (
  tier            TEXT PRIMARY KEY CHECK (tier IN ('grand','major','minor','mini')),
  game_id         TEXT NOT NULL DEFAULT 'slot_fruit',
  pool            BIGINT NOT NULL DEFAULT 0 CHECK (pool >= 0),
  seed            BIGINT NOT NULL,               -- 命中后重置到的起始值
  contrib_bp      INT NOT NULL,                  -- 每次投注注入奖池的万分比
  hit_chance_ppm  INT NOT NULL,                  -- 每次旋转命中概率（百万分之一）
  min_bet         BIGINT NOT NULL DEFAULT 0,     -- 低于此投注不参与该档
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE slot_jackpot_hits (
  id         BIGSERIAL PRIMARY KEY,
  tier       TEXT NOT NULL,
  user_id    BIGINT NOT NULL,
  round_id   BIGINT NOT NULL,
  amount     BIGINT NOT NULL,
  rng_audit  JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_jackpot_hits_protect BEFORE UPDATE OR DELETE ON slot_jackpot_hits FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ───────── 轮盘 ─────────
CREATE TABLE roulette_rounds (
  round_id     BIGINT PRIMARY KEY,
  table_id     TEXT NOT NULL,
  opened_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  lock_at      TIMESTAMPTZ NOT NULL,
  result       INT CHECK (result BETWEEN 0 AND 36),
  rng_audit    JSONB NOT NULL DEFAULT '{}',
  total_bet    BIGINT NOT NULL DEFAULT 0,
  total_payout BIGINT NOT NULL DEFAULT 0,
  settled_at   TIMESTAMPTZ,
  server_id    TEXT
);
CREATE TABLE roulette_bets (
  bet_id          BIGSERIAL PRIMARY KEY,
  round_id        BIGINT NOT NULL REFERENCES roulette_rounds(round_id),
  user_id         BIGINT NOT NULL,
  bet_type        TEXT NOT NULL,                -- straight/red/black/odd/even/low/high/dozen/column
  selection       TEXT NOT NULL,
  amount          BIGINT NOT NULL CHECK (amount > 0),
  payout          BIGINT NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rbets_round ON roulette_bets(round_id, user_id);
CREATE TRIGGER trg_roulette_bets_protect BEFORE DELETE ON roulette_bets FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ───────── 股票涨跌玩法（模拟行情，虚拟品种） ─────────
CREATE TABLE stock_rounds (
  round_id         BIGINT PRIMARY KEY,
  instrument       TEXT NOT NULL,
  opened_at        TIMESTAMPTZ NOT NULL,
  lock_at          TIMESTAMPTZ NOT NULL,
  settle_at        TIMESTAMPTZ NOT NULL,
  opening_price    NUMERIC(14,4) NOT NULL,
  settlement_price NUMERIC(14,4),
  direction        TEXT CHECK (direction IN ('UP','DOWN','FLAT')),
  rng_audit        JSONB NOT NULL DEFAULT '{}',
  total_bet        BIGINT NOT NULL DEFAULT 0,
  total_payout     BIGINT NOT NULL DEFAULT 0,
  settled_at       TIMESTAMPTZ,
  server_id        TEXT
);
CREATE INDEX idx_stock_rounds_inst ON stock_rounds(instrument, opened_at DESC);
CREATE TABLE stock_bets (
  bet_id          BIGSERIAL PRIMARY KEY,
  round_id        BIGINT NOT NULL REFERENCES stock_rounds(round_id),
  user_id         BIGINT NOT NULL,
  bet_type        TEXT NOT NULL,                -- UP/DOWN/HIGHER/LOWER/FIRST_DIGIT/LAST_DIGIT/RANGE
  selection       TEXT NOT NULL,
  amount          BIGINT NOT NULL CHECK (amount > 0),
  odds_bp         INT NOT NULL,                 -- 赔率（万分比，含本金）
  payout          BIGINT NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sbets_round ON stock_bets(round_id, user_id);
CREATE TRIGGER trg_stock_bets_protect BEFORE DELETE ON stock_bets FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TABLE stock_ticks (
  instrument TEXT NOT NULL,
  ts         TIMESTAMPTZ NOT NULL,
  price      NUMERIC(14,4) NOT NULL,
  PRIMARY KEY (instrument, ts)
);

-- ───────── 捕鱼技能使用记录 ─────────
CREATE TABLE fishing_skill_uses (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL,
  room_id         BIGINT,
  skill           TEXT NOT NULL,
  cost_type       TEXT NOT NULL CHECK (cost_type IN ('item','coin')),
  cost            BIGINT NOT NULL DEFAULT 0,
  kills           INT NOT NULL DEFAULT 0,
  reward          BIGINT NOT NULL DEFAULT 0,
  rng_audit       JSONB NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fskill_user ON fishing_skill_uses(user_id, created_at DESC);
