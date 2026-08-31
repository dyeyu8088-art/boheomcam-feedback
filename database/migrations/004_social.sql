-- 004 社交/运营域
CREATE TABLE friends (
  user_id    BIGINT NOT NULL,
  friend_id  BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE TABLE friend_requests (
  id          BIGSERIAL PRIMARY KEY,
  from_user   BIGINT NOT NULL,
  to_user     BIGINT NOT NULL,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled_at  TIMESTAMPTZ,
  UNIQUE (from_user, to_user, status)
);
CREATE INDEX idx_freq_to ON friend_requests(to_user, status);

CREATE TABLE mail (
  mail_id     BIGINT PRIMARY KEY,
  to_user     BIGINT NOT NULL,           -- 0 = 全服（配合 mail_reads）
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]',   -- [{currency, amount}]
  read_at     TIMESTAMPTZ,
  claimed_at  TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_by  BIGINT,                    -- 管理员 ID（系统邮件为 NULL）
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mail_user ON mail(to_user, created_at DESC);

CREATE TABLE announcements (
  id         BIGSERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  title_ko   TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL,
  body_ko    TEXT NOT NULL DEFAULT '',
  sort       INT NOT NULL DEFAULT 0,
  platform   TEXT NOT NULL DEFAULT 'all',
  start_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at     TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activities (
  id         BIGSERIAL PRIMARY KEY,
  type       TEXT NOT NULL,            -- sign_in/login_reward/festival/...
  name       TEXT NOT NULL,
  name_ko    TEXT NOT NULL DEFAULT '',
  config     JSONB NOT NULL DEFAULT '{}',
  start_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at     TIMESTAMPTZ NOT NULL DEFAULT now() + interval '365 days',
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  task_id    TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  name_ko    TEXT NOT NULL DEFAULT '',
  descr      TEXT NOT NULL DEFAULT '',
  period     TEXT NOT NULL CHECK (period IN ('daily','weekly')),
  metric     TEXT NOT NULL,            -- play_rounds/win_rounds/login/fish_kills/slot_spins
  game_id    TEXT,
  target     INT NOT NULL,
  rewards    JSONB NOT NULL,           -- [{currency, amount}]
  status     TEXT NOT NULL DEFAULT 'active',
  sort       INT NOT NULL DEFAULT 0
);

CREATE TABLE task_progress (
  user_id    BIGINT NOT NULL,
  task_id    TEXT NOT NULL REFERENCES tasks(task_id),
  period_key TEXT NOT NULL,            -- 2026-08-31 / 2026-W36
  progress   INT NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_id, period_key)
);

CREATE TABLE signin_records (
  user_id    BIGINT NOT NULL,
  sign_date  DATE NOT NULL,
  streak     INT NOT NULL DEFAULT 1,
  reward     JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sign_date)
);

CREATE TABLE rankings (
  id         BIGSERIAL PRIMARY KEY,
  board      TEXT NOT NULL,            -- coins/wins_daily/fish_daily/...
  period_key TEXT NOT NULL,
  snapshot   JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (board, period_key)
);

CREATE TABLE notifications (
  id         BIGSERIAL PRIMARY KEY,
  kind       TEXT NOT NULL,            -- marquee/push
  content    TEXT NOT NULL,
  content_ko TEXT NOT NULL DEFAULT '',
  start_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at     TIMESTAMPTZ,
  status     TEXT NOT NULL DEFAULT 'active',
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
