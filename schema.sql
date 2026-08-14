DROP TABLE IF EXISTS scheduled_messages;
CREATE TABLE scheduled_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  channel_id TEXT NOT NULL,
  created_by TEXT NOT NULL,

  content TEXT NOT NULL,
  image_url TEXT,
  send_time INTEGER NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'canceled')),

  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  sent_at INTEGER
);

CREATE INDEX idx_scheduled_messages_due
ON scheduled_messages(status, send_time);
