export const MIGRATION_001 = `
CREATE TABLE character (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  name        TEXT NOT NULL,
  avatar_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE attribute_state (
  attribute       TEXT PRIMARY KEY CHECK (attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  level           INTEGER NOT NULL DEFAULT 1,
  in_progress_xp  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE daily_xp_earned (
  day        TEXT NOT NULL,
  attribute  TEXT NOT NULL CHECK (attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  xp_earned  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, attribute)
);
CREATE INDEX idx_daily_xp_day ON daily_xp_earned(day);

CREATE TABLE logs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  text              TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  day               TEXT NOT NULL,
  ai_summary        TEXT NOT NULL,
  primary_attribute TEXT NOT NULL CHECK (primary_attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  total_xp          INTEGER NOT NULL,
  confidence        REAL NOT NULL,
  improvement       INTEGER NOT NULL DEFAULT 0,
  ai_source         TEXT NOT NULL
);
CREATE INDEX idx_logs_day ON logs(day);
CREATE INDEX idx_logs_created_at ON logs(created_at);

CREATE TABLE log_attribute_xp (
  log_id     INTEGER NOT NULL,
  attribute  TEXT NOT NULL CHECK (attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  xp         INTEGER NOT NULL,
  PRIMARY KEY (log_id, attribute),
  FOREIGN KEY (log_id) REFERENCES logs(id) ON DELETE CASCADE
);

CREATE TABLE missions (
  id              TEXT PRIMARY KEY,
  template_id     TEXT NOT NULL,
  description     TEXT NOT NULL,
  attribute       TEXT NOT NULL CHECK (attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  type            TEXT NOT NULL CHECK (type IN ('daily', 'weekly')),
  bonus_xp        INTEGER NOT NULL,
  progress        INTEGER NOT NULL DEFAULT 0,
  target          INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL CHECK (status IN ('active', 'completed', 'expired')),
  generated_at    TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  completed_at    TEXT
);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_type_status ON missions(type, status);

CREATE TABLE streak (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  current_length  INTEGER NOT NULL DEFAULT 0,
  longest_length  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
`;
