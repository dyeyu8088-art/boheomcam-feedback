-- 001 账号域
CREATE TABLE users (
  id            BIGINT PRIMARY KEY,                 -- 服务端雪花 UID（100000+ 起始段）
  guest_key     TEXT UNIQUE,                        -- 游客设备键（游客账号）
  phone         TEXT UNIQUE,
  password_hash TEXT,
  status        TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal','frozen','banned')),
  created_ip    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  last_login_ip TEXT
);

CREATE TABLE user_profiles (
  user_id     BIGINT PRIMARY KEY REFERENCES users(id),
  nickname    TEXT NOT NULL,
  avatar_id   INT NOT NULL DEFAULT 1,
  gender      SMALLINT NOT NULL DEFAULT 0 CHECK (gender IN (0,1,2)),
  level       INT NOT NULL DEFAULT 1,
  vip         INT NOT NULL DEFAULT 0,
  exp         BIGINT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_nickname ON user_profiles(nickname);

CREATE TABLE user_devices (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  device_id   TEXT NOT NULL,
  device_type TEXT,             -- android/ios/h5/pc
  os_version  TEXT,
  app_version TEXT,
  trusted     BOOLEAN NOT NULL DEFAULT true,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_id)
);
CREATE INDEX idx_devices_device ON user_devices(device_id);

CREATE TABLE user_login_logs (
  id         BIGSERIAL,
  user_id    BIGINT NOT NULL,
  login_type TEXT NOT NULL,          -- guest/password/sms/token
  ip         TEXT,
  device_id  TEXT,
  result     TEXT NOT NULL,          -- ok/bad_credentials/banned/...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE TABLE user_login_logs_default PARTITION OF user_login_logs DEFAULT;
CREATE INDEX idx_login_logs_user ON user_login_logs(user_id, created_at DESC);

CREATE TABLE refresh_tokens (
  id          BIGSERIAL PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  device_id   TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE sms_codes (
  id         BIGSERIAL PRIMARY KEY,
  phone      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  purpose    TEXT NOT NULL,           -- login/register/reset
  send_ip    TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sms_phone ON sms_codes(phone, created_at DESC);
