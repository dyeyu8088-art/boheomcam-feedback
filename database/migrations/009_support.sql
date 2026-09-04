-- 009 客服工单（大厅「客服」入口的真实后端：玩家提交 → 后台客服回复 → 双方往来记录 → 关闭）
CREATE TABLE support_tickets (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('account','coins','game','bug','suggest','other')),
  subject       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  last_reply_by TEXT NOT NULL DEFAULT 'user' CHECK (last_reply_by IN ('user','admin')),
  last_reply_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ,
  closed_by     TEXT CHECK (closed_by IN ('user','admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_user ON support_tickets(user_id, created_at DESC);
CREATE INDEX idx_support_status ON support_tickets(status, last_reply_at DESC);

CREATE TABLE support_messages (
  id         BIGSERIAL PRIMARY KEY,
  ticket_id  BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL CHECK (sender IN ('user','admin')),
  admin_id   BIGINT,                       -- sender='admin' 时记录客服账号
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_msg ON support_messages(ticket_id, id);
