DROP TABLE IF EXISTS scheduled_messages;
CREATE TABLE scheduled_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Discord channel ID
  channel_id TEXT NOT NULL,

  -- Message creator's Discord user ID
  created_by TEXT NOT NULL,

  -- Title of the scheduled message
  title TEXT NOT NULL,

  -- Content of the scheduled message
  content TEXT NOT NULL,

  -- Optional image URL to be sent with the message
  image_url TEXT,

  -- Time to send the message as Unix timestamp in seconds
  send_time INTEGER NOT NULL,

  -- Do not include any embeds with the message when true
  suppress_embeds BOOLEAN NOT NULL DEFAULT FALSE
    CHECK (suppress_embeds IN (FALSE, TRUE)),

  -- Status of the scheduled message
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'sent', 'failed')),

  -- Number of attempts made to send the scheduled message
  attempts INTEGER NOT NULL DEFAULT 0,

  -- The most recent error that occurred when attempting to send the scheduled message
  last_error TEXT,

  -- Time scheduled message was created as Unix timestamp in seconds
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),

  -- Time scheduled message was sent as Unix timestamp in seconds
  sent_at INTEGER,

  -- ID of the sent Discord message
  discord_id TEXT
);

CREATE INDEX idx_scheduled_messages_due
ON scheduled_messages(status, send_time);
