CREATE TABLE account_privacy_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  request_type TEXT NOT NULL CHECK (request_type='deletion'),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_REVIEW','CLOSED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX account_privacy_requests_user ON account_privacy_requests(user_id,created_at DESC);
CREATE UNIQUE INDEX one_open_account_deletion_request
  ON account_privacy_requests(user_id) WHERE request_type='deletion' AND status IN ('OPEN','IN_REVIEW');