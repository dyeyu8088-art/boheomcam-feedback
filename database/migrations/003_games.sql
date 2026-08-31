-- 003 游戏域
CREATE TABLE games (
  game_id     TEXT PRIMARY KEY,       -- mahjong_yanbian / hongshi / fishing / slot_fruit
  name        TEXT NOT NULL,
  name_ko     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online','maintenance','offline')),
  min_client_version TEXT NOT NULL DEFAULT '0.1.0',
  sort        INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE game_versions (
  id          BIGSERIAL PRIMARY KEY,
  game_id     TEXT NOT NULL REFERENCES games(game_id),
  version     TEXT NOT NULL,
  notes       TEXT,
  released_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE game_configs (
  id           BIGSERIAL PRIMARY KEY,
  game_id      TEXT NOT NULL REFERENCES games(game_id),
  config_key   TEXT NOT NULL,            -- rule/stage/paytable/brand/...
  rule_version TEXT NOT NULL,
  config       JSONB NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_by   BIGINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, config_key, rule_version)
);

CREATE TABLE config_versions (
  id          BIGSERIAL PRIMARY KEY,
  scope       TEXT NOT NULL,             -- game_config/brand/risk/...
  ref_id      TEXT NOT NULL,
  admin_id    BIGINT NOT NULL,
  reason      TEXT NOT NULL,
  before      JSONB,
  after       JSONB NOT NULL,
  admin_ip    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_cfgver_protect BEFORE UPDATE OR DELETE ON config_versions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TABLE rooms (
  room_id     BIGINT PRIMARY KEY,
  game_id     TEXT NOT NULL REFERENCES games(game_id),
  stage_id    TEXT NOT NULL,
  room_no     TEXT NOT NULL,            -- 6 位展示号
  mode        TEXT NOT NULL CHECK (mode IN ('match','private')),
  owner_id    BIGINT,
  password_hash TEXT,
  rule_snapshot JSONB NOT NULL,
  total_rounds INT NOT NULL DEFAULT 1,
  state       TEXT NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting','playing','settling','finished','dissolved')),
  server_node TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ
);
CREATE INDEX idx_rooms_state ON rooms(game_id, state);
CREATE UNIQUE INDEX idx_rooms_no_active ON rooms(room_no) WHERE state IN ('waiting','playing','settling');

CREATE TABLE room_players (
  id        BIGSERIAL PRIMARY KEY,
  room_id   BIGINT NOT NULL REFERENCES rooms(room_id),
  user_id   BIGINT NOT NULL,
  seat      INT NOT NULL,
  state     TEXT NOT NULL DEFAULT 'joined',
  score     BIGINT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at   TIMESTAMPTZ,
  UNIQUE (room_id, seat)
);
CREATE INDEX idx_room_players_user ON room_players(user_id);

CREATE TABLE game_rounds (
  round_id      BIGINT NOT NULL,
  room_id       BIGINT NOT NULL,
  game_id       TEXT NOT NULL,
  stage_id      TEXT NOT NULL,
  round_index   INT NOT NULL DEFAULT 1,
  rule_snapshot JSONB NOT NULL,
  game_version  TEXT NOT NULL,
  rule_version  TEXT NOT NULL,
  config_version TEXT NOT NULL DEFAULT '',
  result_summary JSONB,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  PRIMARY KEY (round_id, started_at)
) PARTITION BY RANGE (started_at);
CREATE TABLE game_rounds_default PARTITION OF game_rounds DEFAULT;
CREATE INDEX idx_rounds_room ON game_rounds(room_id);
CREATE INDEX idx_rounds_game ON game_rounds(game_id, started_at DESC);

CREATE TABLE game_actions (
  round_id   BIGINT NOT NULL,
  seq        INT NOT NULL,
  actor_seat INT NOT NULL,
  action     TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, seq, created_at)
) PARTITION BY RANGE (created_at);
CREATE TABLE game_actions_default PARTITION OF game_actions DEFAULT;

CREATE TABLE game_results (
  id            BIGSERIAL PRIMARY KEY,
  round_id      BIGINT NOT NULL,
  room_id       BIGINT NOT NULL,
  game_id       TEXT NOT NULL,
  user_id       BIGINT NOT NULL,
  seat          INT,
  score_change  BIGINT NOT NULL DEFAULT 0,
  coin_change   BIGINT NOT NULL DEFAULT 0,
  detail        JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id)
);
CREATE INDEX idx_results_user ON game_results(user_id, created_at DESC);

CREATE TABLE fishing_sessions (
  session_id  BIGINT PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  room_id     BIGINT NOT NULL,
  stage_id    TEXT NOT NULL,
  coins_in    BIGINT NOT NULL DEFAULT 0,   -- 消耗子弹成本
  coins_out   BIGINT NOT NULL DEFAULT 0,   -- 击杀奖励
  shots       INT NOT NULL DEFAULT 0,
  kills       INT NOT NULL DEFAULT 0,
  entered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at     TIMESTAMPTZ
);
CREATE INDEX idx_fsession_user ON fishing_sessions(user_id, entered_at DESC);

CREATE TABLE fishing_shots (
  bullet_id  TEXT NOT NULL,
  user_id    BIGINT NOT NULL,
  room_id    BIGINT NOT NULL,
  multiplier INT NOT NULL,
  cost       BIGINT NOT NULL,
  fish_id    BIGINT,
  fish_type  TEXT,
  hit        BOOLEAN NOT NULL DEFAULT false,
  dead       BOOLEAN NOT NULL DEFAULT false,
  reward     BIGINT NOT NULL DEFAULT 0,
  rng_audit  JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bullet_id, created_at)
) PARTITION BY RANGE (created_at);
CREATE TABLE fishing_shots_default PARTITION OF fishing_shots DEFAULT;
CREATE INDEX idx_fshots_user ON fishing_shots(user_id, created_at DESC);

CREATE TABLE slot_paytables (
  id           BIGSERIAL PRIMARY KEY,
  paytable_version TEXT NOT NULL UNIQUE,
  game_id      TEXT NOT NULL REFERENCES games(game_id),
  config       JSONB NOT NULL,
  rtp_report   JSONB,                    -- 发布前模拟报告
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_by   BIGINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE slot_rounds (
  round_id     BIGINT PRIMARY KEY,
  user_id      BIGINT NOT NULL,
  bet_per_line BIGINT NOT NULL,
  line_count   INT NOT NULL,
  total_bet    BIGINT NOT NULL,
  paytable_version TEXT NOT NULL,
  stops        JSONB NOT NULL,
  win_lines    JSONB NOT NULL DEFAULT '[]',
  scatter_count INT NOT NULL DEFAULT 0,
  free_spins_awarded INT NOT NULL DEFAULT 0,
  in_free_spin BOOLEAN NOT NULL DEFAULT false,
  total_win    BIGINT NOT NULL DEFAULT 0,
  rng_audit    JSONB NOT NULL DEFAULT '{}',
  server_id    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_slot_rounds_user ON slot_rounds(user_id, created_at DESC);
CREATE TRIGGER trg_slot_rounds_protect BEFORE UPDATE OR DELETE ON slot_rounds
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
