import { db } from './db.js';

/** project_settings ทั้งหมดเป็น object — อ่านครั้งเดียวแล้วส่งต่อ (D1 ฟรีจำกัด 50 query ต่อ request) */
export async function loadSettings() {
  const rows = await db.prepare('SELECT key,value FROM project_settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export async function getSetting(key) {
  return (await db.prepare('SELECT value FROM project_settings WHERE key=?').get(key))?.value;
}

export const setSettingStmt = (key, value) =>
  db.prepare('INSERT INTO project_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .bind(key, String(value));

export async function setSetting(key, value) {
  await setSettingStmt(key, value).run();
}

// ค่าที่ระบบ season จัดการเอง — ห้ามแก้ผ่านหน้า "ตั้งค่าโครงการ" (PUT /settings)
export const INTERNAL_SEASON_KEYS = ['season_closed', 'last_frozen_through', 'next_season', 'current_season_id'];

export const seasonStartOf = (s) => s.season_start || process.env.SEASON_START || '2026-06-01';
export const seasonEndOf   = (s) => s.season_end || null;
export const isClosedIn    = (s) => s.season_closed === '1';

export async function getSeasonStart() { return seasonStartOf(await loadSettings()); }
export async function isSeasonClosed() { return isClosedIn(await loadSettings()); }

// season ปัจจุบัน = แถวที่ start-season สร้างล่าสุด (current_season_id)
// ถ้าไม่มี → active ล่าสุด → season ล่าสุด
export async function currentSeasonId(settings) {
  const s = settings || await loadSettings();
  const pinned = Number(s.current_season_id);
  if (pinned && await db.prepare('SELECT id FROM seasons WHERE id=?').get(pinned)) return pinned;
  const row = await db.prepare(
    "SELECT id FROM seasons ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END, id DESC LIMIT 1"
  ).get();
  return row?.id ?? null;
}

// ช่วงที่นับ km ของ season ปัจจุบัน
export function seasonWindowOf(s) {
  return { start: seasonStartOf(s), end: seasonEndOf(s), closed: isClosedIn(s) };
}
export async function getSeasonWindow() { return seasonWindowOf(await loadSettings()); }

// กิจกรรมใหม่ที่ sync เข้ามาควรเป็น baseline (ไม่นับ km) หรือไม่
// - ก่อนวันเริ่ม หรือหลังวันสิ้นสุด season → baseline
// - ช่วงที่ season ถูกปิดแล้ว → baseline (start-season จะปลดให้เองถ้าวันที่อยู่ในช่วง season ใหม่)
// actDate = 'YYYY-MM-DD HH:MM:SS' (เวลาไทย)
export function baselineFlagFor(actDate, win) {
  const day = actDate.slice(0, 10);
  if (win.closed) return 1;
  if (day < win.start) return 1;
  if (win.end && day > win.end) return 1;
  return 0;
}
