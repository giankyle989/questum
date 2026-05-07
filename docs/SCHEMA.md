# SQLite Schema

Local database via `expo-sqlite`. Single database file: `questum.db`.

All schema changes go through numbered migration files in `src/storage/migrations/`. Never modify a migration after it has been deployed.

## Tables

### `character`

Single-row table for the user's character. Enforced by `id = 1` constraint.

```sql
CREATE TABLE character (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  name          TEXT NOT NULL,
  avatar_id     TEXT NOT NULL,
  created_at    TEXT NOT NULL,    -- ISO 8601
  last_log_date TEXT              -- ISO 8601 date (YYYY-MM-DD), null until first log
);
```

### `attribute_state`

Per-attribute level and in-progress XP.

```sql
CREATE TABLE attribute_state (
  attribute       TEXT PRIMARY KEY CHECK (attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  level           INTEGER NOT NULL DEFAULT 1,
  in_progress_xp  INTEGER NOT NULL DEFAULT 0
);
```

Six rows, seeded on character creation. Never deleted.

### `daily_xp_earned`

Tracks per-attribute XP earned per day, for the daily cap enforcement.

```sql
CREATE TABLE daily_xp_earned (
  day        TEXT NOT NULL,    -- YYYY-MM-DD
  attribute  TEXT NOT NULL CHECK (attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  xp_earned  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, attribute)
);

CREATE INDEX idx_daily_xp_day ON daily_xp_earned(day);
```

Cleanup: delete rows older than 60 days on app open.

### `logs`

Every user log entry, immutable after AI processes it (per current decision).

```sql
CREATE TABLE logs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  text              TEXT NOT NULL,
  created_at        TEXT NOT NULL,    -- ISO 8601 datetime
  day               TEXT NOT NULL,    -- YYYY-MM-DD, denormalized for indexing
  ai_summary        TEXT NOT NULL,
  primary_attribute TEXT NOT NULL CHECK (primary_attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  total_xp          INTEGER NOT NULL,
  confidence        REAL NOT NULL,
  improvement       INTEGER NOT NULL DEFAULT 0,    -- 0 or 1 (boolean)
  ai_source         TEXT NOT NULL                  -- 'apple', 'gemini', 'mock'
);

CREATE INDEX idx_logs_day ON logs(day);
CREATE INDEX idx_logs_created_at ON logs(created_at);
```

### `log_attribute_xp`

Per-attribute XP for each log. One row per attribute that received XP.

```sql
CREATE TABLE log_attribute_xp (
  log_id     INTEGER NOT NULL,
  attribute  TEXT NOT NULL CHECK (attribute IN ('STR','DEX','CON','INT','WIS','CHA')),
  xp         INTEGER NOT NULL,
  PRIMARY KEY (log_id, attribute),
  FOREIGN KEY (log_id) REFERENCES logs(id) ON DELETE CASCADE
);
```

### `missions`

Active and completed missions.

```sql
CREATE TABLE missions (
  id              TEXT PRIMARY KEY,           -- e.g., 'daily_cardio_20_2026-05-07'
  template_id     TEXT NOT NULL,              -- e.g., 'daily_cardio_20'
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
```

### `streak`

Single-row table tracking the user's streak.

```sql
CREATE TABLE streak (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  current_length    INTEGER NOT NULL DEFAULT 0,
  longest_length    INTEGER NOT NULL DEFAULT 0,
  last_log_day      TEXT                       -- YYYY-MM-DD
);
```

### `settings`

Key-value settings store. Single-row table is brittle; key-value is flexible.

```sql
CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
```

Known keys (typed in TypeScript wrappers):
- `notifications_enabled` ('true' | 'false')
- `notification_morning_time` ('HH:MM')
- `decay_paused` ('true' | 'false')
- `decay_pause_started_at` (ISO 8601 or empty)
- `decay_paused_days_this_year` (integer string)
- `decay_paused_year` (year integer string, for resetting the count)
- `first_decay_shown` ('true' | 'false')
- `ai_source_last_used` ('apple' | 'gemini' | 'mock' | 'none')
- `onboarding_complete` ('true' | 'false')

### `waitlist_emails`

For unsupported devices that opt into the waitlist. Stored locally; sent to a remote endpoint when networking is added (post-MVP).

```sql
CREATE TABLE waitlist_emails (
  email          TEXT PRIMARY KEY,
  created_at     TEXT NOT NULL,
  device_info    TEXT,
  synced         INTEGER NOT NULL DEFAULT 0    -- 0 = pending, 1 = sent
);
```

## Migrations

Migration files: `src/storage/migrations/NNN_description.sql`. Numbered sequentially from 001.

A `schema_version` table tracks which migrations have been applied:

```sql
CREATE TABLE schema_version (
  version  INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
```

Migration runner on app start:
1. Read `schema_version` (or 0 if table doesn't exist)
2. Apply all migrations with `version > current` in order
3. Insert into `schema_version` after each

001_initial.sql contains all the tables above plus the seed for `attribute_state` (six rows) when the character is created.

## Repository pattern

Each table gets a repository in `src/storage/repositories/` that returns plain TypeScript objects:

```typescript
// src/storage/repositories/characterRepo.ts
export async function getCharacter(): Promise<Character | null>;
export async function createCharacter(name: string, avatarId: string): Promise<Character>;
export async function updateLastLogDate(date: string): Promise<void>;
```

Repositories never apply game rules. They read and write rows.

## Backup considerations (post-MVP)

For v1.1 cloud backup:
- Export entire database as JSON
- Upload to iCloud (iOS) / Google Drive (Android) using platform APIs
- No server-side storage by Anthropic of project owner

Out of scope for MVP — flagged here so future Claude knows the schema was designed with this in mind.
