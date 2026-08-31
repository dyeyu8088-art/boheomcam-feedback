-- 005 风控/后台域
CREATE TABLE risk_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT,
  type       TEXT NOT NULL,        -- fire_rate/abnormal_gain/multi_account_device/...
  severity   TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  evidence   JSONB NOT NULL DEFAULT '{}',
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','handled','ignored')),
  handled_by BIGINT,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_risk_user ON risk_events(user_id, created_at DESC);
CREATE INDEX idx_risk_type ON risk_events(type, severity, status);

CREATE TABLE bans (
  id          BIGSERIAL PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('user','device','ip')),
  target      TEXT NOT NULL,
  reason      TEXT NOT NULL,
  until_at    TIMESTAMPTZ,               -- NULL = 永久
  operator_id BIGINT NOT NULL,
  lifted_at   TIMESTAMPTZ,
  lifted_by   BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bans_target ON bans(target_type, target) WHERE lifted_at IS NULL;

CREATE TABLE admins (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  totp_secret   TEXT,
  last_login_at TIMESTAMPTZ,
  last_login_ip TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id    BIGSERIAL PRIMARY KEY,
  code  TEXT NOT NULL UNIQUE,     -- super/ops/cs/finance/tech/risk/audit
  name  TEXT NOT NULL
);

CREATE TABLE permissions (
  id    BIGSERIAL PRIMARY KEY,
  code  TEXT NOT NULL UNIQUE,     -- user.view/user.ban/wallet.adjust/config.publish/...
  name  TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role_id       BIGINT NOT NULL REFERENCES roles(id),
  permission_id BIGINT NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE admin_roles (
  admin_id BIGINT NOT NULL REFERENCES admins(id),
  role_id  BIGINT NOT NULL REFERENCES roles(id),
  PRIMARY KEY (admin_id, role_id)
);

CREATE TABLE audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  admin_id   BIGINT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT,
  before     JSONB,
  after      JSONB,
  reason     TEXT,
  admin_ip   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_admin ON audit_logs(admin_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
CREATE TRIGGER trg_audit_protect BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TABLE admin_login_logs (
  id         BIGSERIAL PRIMARY KEY,
  admin_id   BIGINT,
  username   TEXT NOT NULL,
  ip         TEXT,
  result     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE server_nodes (
  node_id    TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,            -- api/game
  roles      TEXT NOT NULL DEFAULT '',
  host       TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status     TEXT NOT NULL DEFAULT 'online'
);
