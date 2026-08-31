-- 002 钱包/账本域（只增不改；触发器强制不可篡改）
CREATE TABLE wallet_accounts (
  user_id    BIGINT NOT NULL,
  currency   TEXT NOT NULL CHECK (currency IN ('COIN','DIAMOND','POINT','TICKET')),
  balance    BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  frozen     BIGINT NOT NULL DEFAULT 0 CHECK (frozen >= 0),
  version    BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, currency)
);

-- 系统对手账户（借贷双录）：1发行 2抽水 3活动 4调账 5捕鱼池 6水果机池
-- 系统账户允许负余额（发行方天然为负），用哨兵行为区分
CREATE TABLE wallet_system_accounts (
  user_id BIGINT PRIMARY KEY,
  name    TEXT NOT NULL
);
INSERT INTO wallet_system_accounts VALUES
 (1,'SYSTEM_ISSUER'),(2,'SYSTEM_RAKE'),(3,'SYSTEM_ACTIVITY'),(4,'SYSTEM_ADJUST'),(5,'SYSTEM_FISH_POOL'),(6,'SYSTEM_SLOT_POOL');

CREATE TABLE wallet_transactions (
  transaction_id   BIGINT PRIMARY KEY,
  idempotency_key  TEXT NOT NULL UNIQUE,
  user_id          BIGINT NOT NULL,
  currency         TEXT NOT NULL,
  type             TEXT NOT NULL,
  amount           BIGINT NOT NULL,              -- 有符号：用户视角
  balance_before   BIGINT NOT NULL,
  balance_after    BIGINT NOT NULL,
  game_id          TEXT,
  room_id          BIGINT,
  round_id         BIGINT,
  reference_id     TEXT,
  server_id        TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
  description      TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (balance_after = balance_before + amount)
);
CREATE INDEX idx_wtx_user ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX idx_wtx_round ON wallet_transactions(round_id);
CREATE INDEX idx_wtx_type ON wallet_transactions(type, created_at DESC);

CREATE TABLE wallet_ledger_entries (
  id             BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES wallet_transactions(transaction_id),
  account_id     BIGINT NOT NULL,          -- 用户 UID 或系统账户
  currency       TEXT NOT NULL,
  amount         BIGINT NOT NULL,          -- 借贷：每笔交易两行之和为 0
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_tx ON wallet_ledger_entries(transaction_id);
CREATE INDEX idx_ledger_account ON wallet_ledger_entries(account_id, created_at DESC);

CREATE TABLE settlements (
  settlement_id    BIGINT PRIMARY KEY,
  round_id         BIGINT NOT NULL,
  game_id          TEXT NOT NULL,
  settle_type      TEXT NOT NULL,           -- round/gang/chajiao/...
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','failed')),
  payload          JSONB NOT NULL,
  created_by_server TEXT NOT NULL,
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at        TIMESTAMPTZ,
  UNIQUE (round_id, settle_type)
);

CREATE TABLE wallet_adjustments (
  adjustment_id    BIGINT PRIMARY KEY,
  admin_id         BIGINT NOT NULL,
  user_id          BIGINT NOT NULL,
  currency         TEXT NOT NULL,
  amount           BIGINT NOT NULL,
  reason           TEXT NOT NULL,
  balance_before   BIGINT NOT NULL,
  balance_after    BIGINT NOT NULL,
  approve_admin_id BIGINT,
  admin_ip         TEXT,
  transaction_id   BIGINT REFERENCES wallet_transactions(transaction_id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_adjust_user ON wallet_adjustments(user_id, created_at DESC);
CREATE INDEX idx_adjust_admin ON wallet_adjustments(admin_id, created_at DESC);

-- 不可篡改：交易/分录/调账 禁止 UPDATE（status 翻转除外）与 DELETE
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only (audit protected)', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION forbid_tx_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'wallet_transactions is append-only';
  END IF;
  -- 仅允许 status: posted -> reversed（冲正走新交易，本行只标记）
  IF NEW.transaction_id <> OLD.transaction_id OR NEW.amount <> OLD.amount
     OR NEW.balance_before <> OLD.balance_before OR NEW.balance_after <> OLD.balance_after
     OR NEW.user_id <> OLD.user_id OR NEW.currency <> OLD.currency
     OR NEW.idempotency_key <> OLD.idempotency_key OR NEW.type <> OLD.type THEN
    RAISE EXCEPTION 'wallet_transactions core fields are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wtx_protect BEFORE UPDATE OR DELETE ON wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION forbid_tx_mutation();
CREATE TRIGGER trg_ledger_protect BEFORE UPDATE OR DELETE ON wallet_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER trg_adjust_protect BEFORE UPDATE OR DELETE ON wallet_adjustments
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
