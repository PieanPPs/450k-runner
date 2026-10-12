// Migration ตอนเปิดเซิร์ฟเวอร์บน VPS (better-sqlite3) — idempotent รันซ้ำได้
// Cloudflare D1 ไม่รันไฟล์นี้: schema มาพร้อมข้อมูลตอน import (ดู scripts/export-for-d1.mjs)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tryRun = (raw, sql, msg) => {
  try { raw.prepare(sql).run(); if (msg) console.log(`[migration] ${msg}`); }
  catch { /* มีอยู่แล้ว — ข้ามได้ */ }
};

/** rawDb = better-sqlite3 Database; currentSeasonId = id ของ season ปัจจุบัน (สำหรับ backfill weekly_snapshots) */
export function runNodeMigrations(raw) {
  // Ensure schema exists (idempotent - CREATE TABLE IF NOT EXISTS)
  raw.exec(fs.readFileSync(path.resolve(__dirname, './schema.sql'), 'utf8'));

  tryRun(raw, 'ALTER TABLE strava_activities ADD COLUMN is_baseline INTEGER NOT NULL DEFAULT 0', 'added is_baseline column to strava_activities');
  tryRun(raw, "ALTER TABLE participants ADD COLUMN age_group TEXT NOT NULL DEFAULT 'general'", 'added age_group column to participants');
  // credited_km — km ที่ admin ปรับแล้ว (ตัด commute ออก) NULL = ใช้ distance_km เต็ม
  tryRun(raw, 'ALTER TABLE strava_activities ADD COLUMN credited_km REAL', 'added credited_km column to strava_activities');
  // moving_time — เวลาเคลื่อนที่จริง ใช้คำนวณ pace (0 = ข้อมูลเก่า ใช้ elapsed_time แทน)
  tryRun(raw, 'ALTER TABLE strava_activities ADD COLUMN moving_time INTEGER NOT NULL DEFAULT 0', 'added moving_time column to strava_activities');
  // activity_date — วันวิ่งจริงจาก start_date_local ของ Strava (YYYY-MM-DD)
  tryRun(raw, 'ALTER TABLE strava_activities ADD COLUMN activity_date TEXT', 'added activity_date column to strava_activities');
  // ถังขยะ — เก็บ activity ที่ถูกลบไว้ก่อน ป้องกันลบพลาด
  tryRun(raw, `
    CREATE TABLE IF NOT EXISTS deleted_activities (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      original_id  INTEGER,
      strava_key   TEXT,
      activity_hash TEXT,
      distance_km  REAL,
      credited_km  REAL,
      elapsed_time INTEGER,
      activity_name TEXT,
      first_seen   TEXT,
      is_baseline  INTEGER DEFAULT 0,
      deleted_at   TEXT
    )`);
  // results_json — เก็บ snapshot ผลแต่ละคนต่อ Season
  tryRun(raw, 'ALTER TABLE seasons ADD COLUMN results_json TEXT', 'added results_json column to seasons');
  // weekly_snapshots.season_id — แยก snapshot ราย season (week_no เริ่มนับใหม่ทุก season)
  try {
    raw.prepare('ALTER TABLE weekly_snapshots ADD COLUMN season_id INTEGER REFERENCES seasons(id)').run();
    // snapshot เดิมทั้งหมดเป็นของ season ปัจจุบัน ณ ตอน migrate (ต้อง deploy ก่อน start-season ใหม่)
    const pinned = Number(raw.prepare("SELECT value FROM project_settings WHERE key='current_season_id'").get()?.value);
    const cur = pinned || raw.prepare("SELECT id FROM seasons ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END, id DESC LIMIT 1").get()?.id || null;
    const r = raw.prepare('UPDATE weekly_snapshots SET season_id=? WHERE season_id IS NULL').run(cur);
    console.log(`[migration] added season_id to weekly_snapshots (backfilled ${r.changes} rows)`);
  } catch { /* column มีอยู่แล้ว — ข้ามได้ */ }
  // badges — badge definitions (manual + auto)
  tryRun(raw, `
    CREATE TABLE IF NOT EXISTS badges (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      icon               TEXT NOT NULL DEFAULT '🏅',
      label              TEXT NOT NULL,
      color              TEXT NOT NULL DEFAULT '#f59e0b',
      description        TEXT,
      auto_km            REAL,
      auto_streak        INTEGER,
      auto_activity_count INTEGER,
      created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  for (const col of ['auto_streak INTEGER', 'auto_activity_count INTEGER', 'auto_act_km REAL', 'auto_act_min INTEGER']) {
    tryRun(raw, `ALTER TABLE badges ADD COLUMN ${col}`);
  }
  // participant_badges — ใครได้ badge ไหน ใน season ไหน
  tryRun(raw, `
    CREATE TABLE IF NOT EXISTS participant_badges (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_name TEXT NOT NULL,
      badge_id         INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
      season_id        INTEGER REFERENCES seasons(id),
      source           TEXT NOT NULL DEFAULT 'manual',
      note             TEXT,
      awarded_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(participant_name, badge_id, season_id)
    )`);
}
