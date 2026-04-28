CREATE TABLE IF NOT EXISTS participants (
  id         INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL,
  initials   TEXT    NOT NULL DEFAULT '',
  km         REAL    NOT NULL DEFAULT 0,
  steps      INTEGER NOT NULL DEFAULT 0,
  streak     INTEGER NOT NULL DEFAULT 0,
  weekly_km  REAL    NOT NULL DEFAULT 0,
  strava_key     TEXT    UNIQUE,  -- firstname_L เช่น "piean_p"
  activity_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS weekly_data (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  week  TEXT    NOT NULL,
  km    REAL    NOT NULL,
  steps INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  subtitle     TEXT    NOT NULL,
  date_range   TEXT    NOT NULL,
  status       TEXT    NOT NULL,
  top_km       REAL    NOT NULL,
  total_km     REAL    NOT NULL,
  participants INTEGER NOT NULL,
  winner       TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS distances (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  km          INTEGER NOT NULL,
  label       TEXT    NOT NULL,
  icon        TEXT    NOT NULL,
  description TEXT    NOT NULL,
  gmap_url    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  km     INTEGER NOT NULL,
  reward TEXT    NOT NULL,
  icon   TEXT    NOT NULL,
  color  TEXT    NOT NULL,
  bg     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS strava_tokens (
  participant_id INTEGER PRIMARY KEY REFERENCES participants(id),
  athlete_id     INTEGER NOT NULL,
  access_token   TEXT    NOT NULL,
  refresh_token  TEXT    NOT NULL,
  expires_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  synced_at TEXT    NOT NULL DEFAULT (datetime('now')),
  status    TEXT    NOT NULL,
  message   TEXT
);

-- ตั้งค่าโครงการ (แก้ได้จาก admin)
CREATE TABLE IF NOT EXISTS project_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- snapshot รายสัปดาห์ (บันทึกทุกวันอาทิตย์ 23:59 อัตโนมัติ)
CREATE TABLE IF NOT EXISTS weekly_snapshots (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  week_no        INTEGER NOT NULL,
  week_label     TEXT    NOT NULL,
  snapped_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  name           TEXT    NOT NULL,
  initials       TEXT    NOT NULL,
  km             REAL    NOT NULL DEFAULT 0,
  rank           INTEGER NOT NULL DEFAULT 0
);
