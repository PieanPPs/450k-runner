// วงจรชีวิตของ Season — ใช้ร่วมกันระหว่าง Admin routes และ cron
//
//   upcoming ──(ถึงวันเริ่ม)──▶ active ──(เลยวันสิ้นสุด + grace)──▶ ปิด (done) ──▶ season ถัดไป (ถ้าตั้งไว้)
//
// project_settings ที่เกี่ยวข้อง:
//   season_start / season_end      ช่วงวันที่นับ km ของ season ปัจจุบัน
//   season_closed                  '1' = ปิดแล้ว กิจกรรมใหม่ทั้งหมดเป็น baseline
//   current_season_id              แถวใน seasons ของ season ปัจจุบัน
//   season_auto_close              '1' = cron ปิด season ให้เองเมื่อครบกำหนด
//   season_close_grace_days        รอกี่วันหลังวันสิ้นสุดก่อนปิด (เผื่อคนอัปโหลด Strava ช้า)
//   next_season                    JSON ของ season ถัดไปที่ตั้งล่วงหน้าไว้ (ใช้ตอน season ปัจจุบันยังไม่ปิด)
//   last_frozen_through            วันสุดท้ายของกิจกรรมที่ถูก freeze ตอนปิด season ล่าสุด

import path from 'path';
import { db } from '../db/connection.js';
import { autoBackup } from './backup.js';
import {
  getSetting, setSetting, getSeasonStart, getSeasonEnd, isSeasonClosed, currentSeasonId,
} from './season.js';

const DEFAULT_GRACE_DAYS = 2;

export function todayBkk() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
}

export function addDays(day, n) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// วันสิ้นสุดของ season ยาว `months` เดือน เช่น 2027-04-01 + 3 → 2027-06-30
export function endAfterMonths(start, months) {
  const [y, m, d] = start.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return addDays(target.toISOString().slice(0, 10), -1);
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(new Date(s));
const fail = (status, message) => ({ ok: false, status, message });

function thaiNow() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace('T', ' ');
}

function log(status, message) {
  db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)').run(thaiNow(), status, message);
}

function graceDays() {
  const n = Number(getSetting('season_close_grace_days'));
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_GRACE_DAYS;
}

function getNextSeason() {
  try { return JSON.parse(getSetting('next_season') || 'null'); } catch { return null; }
}

function seasonRow(id) {
  return id ? db.prepare('SELECT * FROM seasons WHERE id=?').get(id) : null;
}

// ── Weekly snapshot ───────────────────────────────────────
// asOf = วันที่ใช้คำนวณเลขสัปดาห์ (ปกติ = วันนี้, ตอนปิด season = วันสิ้นสุด)
// weekOverride = admin ระบุเลขสัปดาห์เอง
export function takeWeeklySnapshot({ asOf = todayBkk(), label = 'cron', weekOverride } = {}) {
  if (isSeasonClosed()) return { ok: false, message: 'Season ปิดอยู่ — ยังไม่มี season ให้บันทึกผล' };
  const start = getSeasonStart();
  if (asOf < start) return { ok: false, message: `Season ยังไม่เริ่ม (เริ่ม ${start})` };

  const diffDays = Math.max(0, Math.floor((new Date(asOf) - new Date(start)) / 86400000));
  const weekNo = Number(weekOverride) || Math.max(1, Math.ceil(diffDays / 7));
  const weekLabel = `สัปดาห์ ${weekNo}`;
  const seasonId = currentSeasonId();

  const participants = db.prepare('SELECT id,name,initials,weekly_km FROM participants ORDER BY weekly_km DESC').all();
  const ins = db.prepare('INSERT INTO weekly_snapshots (week_no,week_label,participant_id,name,initials,km,rank,season_id) VALUES (?,?,?,?,?,?,?,?)');
  db.transaction(() => {
    // ลบเฉพาะ snapshot ของ season เดียวกัน — week_no ซ้ำข้าม season ต้องไม่ทับกัน
    db.prepare('DELETE FROM weekly_snapshots WHERE week_no=? AND season_id IS ?').run(weekNo, seasonId);
    participants.forEach((p, i) => ins.run(weekNo, weekLabel, p.id, p.name, p.initials, p.weekly_km, i + 1, seasonId));
  })();
  console.log(`[snapshot:${label}] week ${weekNo} saved — ${participants.length} participants`);
  return { ok: true, weekNo, weekLabel, participants: participants.length };
}

// ผลรายคนของ season — นับเฉพาะกิจกรรม (ไม่ใช่ baseline) ในช่วงวัน
// participant ที่ไม่มี strava_key (กรอก km เอง) ใช้ค่า km ในตาราง participants
function seasonResults(start, end) {
  const rows = db.prepare(`
    SELECT p.name, p.initials, p.age_group, p.streak, p.strava_key, p.km AS stored_km, p.activity_count AS stored_count,
      COALESCE(SUM(COALESCE(a.credited_km, a.distance_km)), 0) AS act_km,
      COUNT(a.id) AS act_count
    FROM participants p
    LEFT JOIN strava_activities a
      ON a.strava_key = p.strava_key AND a.is_baseline = 0 AND substr(a.first_seen,1,10) BETWEEN ? AND ?
    GROUP BY p.id
  `).all(start, end);
  return rows.map(r => {
    const km = Math.round((r.strava_key ? r.act_km : r.stored_km) * 100) / 100;
    return {
      name: r.name, initials: r.initials, age_group: r.age_group, streak: r.streak,
      km, steps: Math.round(km * 1350),
      activity_count: r.strava_key ? r.act_count : r.stored_count,
    };
  }).sort((a, b) => b.km - a.km);
}

// ── Close ─────────────────────────────────────────────────
// 1) backup (ไม่ผ่าน → ไม่ปิด)  2) snapshot สัปดาห์สุดท้าย  3) archive ผลลง seasons
// 4) freeze กิจกรรม + reset participants  5) season_closed=1  6) เริ่ม season ถัดไปถ้าตั้งไว้
export async function closeSeason({ reason = 'manual', seasonName } = {}) {
  if (isSeasonClosed()) return fail(409, 'Season นี้ถูกปิดไปแล้ว');

  let backupFile;
  try { backupFile = path.basename(await autoBackup('close-season')); }
  catch (e) { return fail(500, `สำรองข้อมูลไม่สำเร็จ จึงยังไม่ปิด Season: ${e.message}`); }

  const today = todayBkk();
  const start = getSeasonStart();
  const end   = getSeasonEnd();
  const lastDay = end && end < today ? end : today;

  // snapshot สัปดาห์สุดท้าย ถ้าสัปดาห์นี้ยังอยู่ในช่วง season
  try {
    const dow = new Date(today + 'T12:00:00Z').getUTCDay();
    const monday = addDays(today, -(dow === 0 ? 6 : dow - 1));
    if (!end || monday <= end) takeWeeklySnapshot({ asOf: lastDay, label: 'close' });
  } catch (e) { console.error('[close-season] final snapshot:', e.message); }

  // ผลสุดท้ายนับเฉพาะกิจกรรมในช่วงวันของ season (ระบบเดิมไม่มี gate วันสิ้นสุด จึงอาจมีกิจกรรมหลังจบ season ปนอยู่)
  const results = seasonResults(start, lastDay);
  const totalKm = Math.round(results.reduce((s, r) => s + r.km, 0) * 100) / 100;
  const pCount  = results.length;
  const top     = results[0];
  const resultsJson = JSON.stringify(results);
  const outside = db.prepare(
    'SELECT COUNT(*) AS c FROM strava_activities WHERE is_baseline=0 AND substr(first_seen,1,10) NOT BETWEEN ? AND ?'
  ).get(start, lastDay).c;
  const dateRange = `${start} – ${lastDay}`;

  const frozen = db.transaction(() => {
    const cur = seasonRow(currentSeasonId());
    const target = cur && cur.status !== 'done'
      ? cur
      : db.prepare("SELECT id FROM seasons WHERE status IN ('active','pre-season') ORDER BY id DESC LIMIT 1").get();

    if (target) {
      db.prepare(
        'UPDATE seasons SET total_km=?,participants=?,top_km=?,winner=?,date_range=?,status=?,results_json=? WHERE id=?'
      ).run(totalKm, pCount, top?.km || 0, top?.name || '—', dateRange, 'done', resultsJson, target.id);
    } else {
      db.prepare(
        'INSERT INTO seasons (name,subtitle,date_range,status,top_km,total_km,participants,winner,results_json) VALUES (?,?,?,?,?,?,?,?,?)'
      ).run(seasonName || 'Season 1', `กิจกรรมวิ่ง ${start}`, dateRange, 'done', top?.km || 0, totalKm, pCount, top?.name || '—', resultsJson);
    }

    // วันที่ล่าสุดของกิจกรรมที่กำลังจะ freeze — season ใหม่ห้ามเริ่มก่อนวันนี้ (กันปลด freeze ของ season เก่า)
    const lastActDay = db.prepare('SELECT MAX(substr(first_seen,1,10)) AS d FROM strava_activities WHERE is_baseline=0').get().d;
    if (lastActDay) setSetting('last_frozen_through', lastActDay);

    const f = db.prepare('UPDATE strava_activities SET is_baseline=1 WHERE is_baseline=0').run();
    db.prepare('UPDATE participants SET km=0,steps=0,weekly_km=0,streak=0,activity_count=0').run();
    setSetting('season_closed', '1');
    return f;
  })();

  log('close-season', `[${reason}] ปิด Season — freeze ${frozen.changes} กิจกรรม (นอกช่วงวัน ${outside}), total ${totalKm} km, winner ${top?.name || '—'}, backup ${backupFile}`);

  const result = {
    ok: true,
    frozen: frozen.changes,
    excluded: outside,
    total_km: totalKm,
    winner: top?.name || '—',
    backup: backupFile,
    message: `ปิด Season สำเร็จ! Freeze ${frozen.changes} กิจกรรม, Reset ${pCount} คน` +
      (outside ? `, ไม่นับ ${outside} กิจกรรมที่อยู่นอกช่วง ${start} – ${lastDay}` : '') +
      ` (backup: ${backupFile})`,
  };

  // เริ่ม season ถัดไปที่ตั้งล่วงหน้าไว้
  const next = getNextSeason();
  if (next) {
    const started = startSeason(next);
    if (started.ok) {
      setSetting('next_season', '');
      result.next = started;
      result.message += ` · ${started.message}`;
    } else {
      log('start-season', `เริ่ม season ถัดไปไม่สำเร็จ: ${started.message}`);
      result.message += ` · ⚠️ เริ่ม season ถัดไปไม่สำเร็จ: ${started.message}`;
    }
  }
  return result;
}

// ── Validate / normalize form ─────────────────────────────
// form: { season_name, season_start, season_end?, duration_months?, subtitle?, auto_close?, grace_days? }
function normalizeForm(form = {}) {
  const season_start = form.season_start;
  if (!isDate(season_start)) return fail(400, 'วันเริ่มต้องเป็น YYYY-MM-DD');
  const months = Number(form.duration_months) || 3;
  const season_end = form.season_end || endAfterMonths(season_start, months);
  if (!isDate(season_end)) return fail(400, 'วันสิ้นสุดต้องเป็น YYYY-MM-DD');
  if (season_end < season_start) return fail(400, 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
  const grace = Number(form.grace_days);
  return {
    ok: true,
    season_name: (form.season_name || '').trim() || 'Season ใหม่',
    season_start,
    season_end,
    subtitle: (form.subtitle || '').trim() || `กิจกรรมวิ่ง ${season_start} – ${season_end}`,
    auto_close: form.auto_close === undefined ? true : !!form.auto_close,
    grace_days: Number.isFinite(grace) && grace >= 0 ? Math.min(grace, 14) : DEFAULT_GRACE_DAYS,
  };
}

function checkAfterFrozen(season_start) {
  const frozenThrough = getSetting('last_frozen_through');
  if (frozenThrough && season_start <= frozenThrough) {
    return fail(400, `วันเริ่มต้องหลัง ${frozenThrough} (วันสุดท้ายของกิจกรรม Season ก่อนหน้า)`);
  }
  return null;
}

// ตั้ง settings + ปรับ is_baseline ของกิจกรรมให้ตรงกับช่วงวันของ season
function applySeasonWindow(f) {
  setSetting('season_start', f.season_start);
  setSetting('season_end', f.season_end);
  setSetting('season_closed', '0');
  setSetting('season_auto_close', f.auto_close ? '1' : '0');
  setSetting('season_close_grace_days', f.grace_days);
  // กิจกรรมก่อนวันเริ่มที่ยังนับอยู่ (เช่นช่วงพักก่อนมีระบบนี้) → ไม่นับ
  db.prepare('UPDATE strava_activities SET is_baseline=1 WHERE is_baseline=0 AND substr(first_seen,1,10) < ?').run(f.season_start);
  // กิจกรรมในช่วง season ที่ถูก sync เข้ามาระหว่าง season ปิดอยู่ → นับ
  return db.prepare(
    'UPDATE strava_activities SET is_baseline=0 WHERE is_baseline=1 AND substr(first_seen,1,10) BETWEEN ? AND ?'
  ).run(f.season_start, f.season_end).changes;
}

// ── Start (ต้องปิด season เดิมแล้ว) ────────────────────────
export function startSeason(form) {
  const f = normalizeForm(form);
  if (!f.ok) return f;
  if (!isSeasonClosed()) return fail(409, 'ยังไม่ได้ปิด Season เดิม — ปิด Season ก่อน หรือใช้ "ตั้งค่า Season ถัดไป" เพื่อให้ระบบเริ่มให้เอง');
  const blocked = checkAfterFrozen(f.season_start);
  if (blocked) return blocked;

  const status = f.season_start <= todayBkk() ? 'active' : 'upcoming';
  const unfrozen = db.transaction(() => {
    const info = db.prepare(
      'INSERT INTO seasons (name,subtitle,date_range,status,top_km,total_km,participants,winner) VALUES (?,?,?,?,?,?,?,?)'
    ).run(f.season_name, f.subtitle, `${f.season_start} – ${f.season_end}`, status, 0, 0, 0, '—');
    setSetting('current_season_id', info.lastInsertRowid);
    return applySeasonWindow(f);
  })();

  log('start-season', `ตั้ง ${f.season_name} ${f.season_start} – ${f.season_end} (${status})`);
  return {
    ok: true,
    status,
    unfrozen,
    message: status === 'active'
      ? `เริ่ม ${f.season_name} แล้ว (${f.season_start} – ${f.season_end})` +
        (unfrozen ? ` · นับกิจกรรมที่วิ่งไว้แล้ว ${unfrozen} รายการ — กด Sync เพื่อคำนวณ km` : '')
      : `ตั้ง ${f.season_name} แล้ว — ระบบจะเริ่มนับ km อัตโนมัติวันที่ ${f.season_start} ถึง ${f.season_end}`,
  };
}

// ── Schedule (ใช้ได้ทุกสถานะ — หน้า "ตั้งค่า Season") ─────────
// - season ปิดอยู่            → สร้าง season ใหม่ทันที (upcoming ถ้ายังไม่ถึงวันเริ่ม)
// - season ปัจจุบันยังไม่เริ่ม → แก้ชื่อ/วันที่ของ season นั้น
// - season ปัจจุบันกำลังวิ่ง   → เก็บเป็น next_season แล้วเริ่มให้เองหลังปิด season ปัจจุบัน
export function scheduleSeason(form) {
  const f = normalizeForm(form);
  if (!f.ok) return f;
  if (isSeasonClosed()) return startSeason(f);

  const cur = seasonRow(currentSeasonId());
  const today = todayBkk();

  if (cur && cur.status === 'upcoming' && today < getSeasonStart()) {
    const blocked = checkAfterFrozen(f.season_start);
    if (blocked) return blocked;
    if (f.season_start <= today) return fail(400, 'Season ที่ยังไม่เริ่ม แก้วันเริ่มเป็นวันในอนาคตเท่านั้น');
    db.transaction(() => {
      db.prepare('UPDATE seasons SET name=?,subtitle=?,date_range=? WHERE id=?')
        .run(f.season_name, f.subtitle, `${f.season_start} – ${f.season_end}`, cur.id);
      applySeasonWindow(f);
    })();
    log('schedule-season', `แก้ ${f.season_name} เป็น ${f.season_start} – ${f.season_end}`);
    return { ok: true, status: 'upcoming', message: `แก้ ${f.season_name} แล้ว — เริ่มนับ km วันที่ ${f.season_start} ถึง ${f.season_end}` };
  }

  const curEnd = getSeasonEnd();
  if (!curEnd) return fail(400, 'Season ปัจจุบันยังไม่มีวันสิ้นสุด — ตั้ง season_end ในหน้าตั้งค่าโครงการก่อน หรือปิด Season ปัจจุบันก่อน');
  if (f.season_start <= curEnd) return fail(400, `Season ถัดไปต้องเริ่มหลัง ${curEnd} (วันสิ้นสุด Season ปัจจุบัน)`);

  setSetting('next_season', JSON.stringify(f));
  setSetting('season_auto_close', f.auto_close ? '1' : '0');
  setSetting('season_close_grace_days', f.grace_days);
  log('schedule-season', `ตั้ง season ถัดไป ${f.season_name} ${f.season_start} – ${f.season_end}`);
  const closeOn = addDays(curEnd, f.grace_days + 1);
  return {
    ok: true,
    status: 'scheduled',
    message: f.auto_close
      ? `ตั้ง ${f.season_name} แล้ว — ระบบจะปิด Season ปัจจุบันอัตโนมัติวันที่ ${closeOn} แล้วเริ่มนับ ${f.season_start} – ${f.season_end}`
      : `ตั้ง ${f.season_name} แล้ว — จะเริ่มหลังจากกดปิด Season ปัจจุบัน`,
  };
}

export function cancelNextSeason() {
  if (!getNextSeason()) return fail(404, 'ไม่มี Season ถัดไปที่ตั้งไว้');
  setSetting('next_season', '');
  log('schedule-season', 'ยกเลิก season ถัดไป');
  return { ok: true, message: 'ยกเลิก Season ถัดไปแล้ว' };
}

// ── Status (หน้า Admin) ───────────────────────────────────
export function getSeasonStatus() {
  const today = todayBkk();
  const closed = isSeasonClosed();
  const start = getSeasonStart();
  const end = getSeasonEnd();
  const autoClose = getSetting('season_auto_close') === '1';
  const grace = graceDays();
  const cur = seasonRow(currentSeasonId());

  let phase;
  if (closed) phase = 'closed';
  else if (today < start) phase = 'upcoming';
  else if (!end || today <= end) phase = 'running';
  else phase = 'ended';   // เลยวันสิ้นสุดแล้ว รอปิด

  const counts = db.prepare(
    'SELECT SUM(is_baseline=0) AS season, SUM(is_baseline=1) AS baseline FROM strava_activities'
  ).get();

  return {
    today,
    phase,
    closed,
    season_start: start,
    season_end: end,
    auto_close: autoClose,
    grace_days: grace,
    auto_close_on: !closed && autoClose && end ? addDays(end, grace + 1) : null,
    current: cur ? { id: cur.id, name: cur.name, status: cur.status, subtitle: cur.subtitle } : null,
    next: getNextSeason(),
    last_frozen_through: getSetting('last_frozen_through') || null,
    season_count: db.prepare('SELECT COUNT(*) AS c FROM seasons').get().c,
    activities: { season: counts.season || 0, baseline: counts.baseline || 0 },
  };
}

// ── Cron: ขยับสถานะตามวันที่ ───────────────────────────────
export async function runSeasonLifecycle(label = 'cron') {
  const today = todayBkk();
  const end = getSeasonEnd();

  // 1) ครบกำหนด + grace → ปิดอัตโนมัติ (closeSeason จะเริ่ม next_season ให้ต่อ)
  if (!isSeasonClosed() && getSetting('season_auto_close') === '1' && end && today > addDays(end, graceDays())) {
    const r = await closeSeason({ reason: `auto:${label}` });
    console.log(`[season:${label}] auto-close:`, r.message);
  }

  // 2) ปิดอยู่แต่มี next_season ค้าง (เช่นปิดเองก่อนตั้ง) → เริ่มเลย
  if (isSeasonClosed() && getNextSeason()) {
    const r = startSeason(getNextSeason());
    if (r.ok) setSetting('next_season', '');
    console.log(`[season:${label}] start next:`, r.message);
  }

  // 3) ถึงวันเริ่มแล้ว → upcoming เป็น active
  const cur = seasonRow(currentSeasonId());
  if (!isSeasonClosed() && cur?.status === 'upcoming' && today >= getSeasonStart()) {
    db.prepare("UPDATE seasons SET status='active' WHERE id=?").run(cur.id);
    log('start-season', `[auto:${label}] ${cur.name} เริ่มแล้ว`);
    console.log(`[season:${label}] ${cur.name} is now active`);
  }
}

// ── Migration: ระบบเดิมยังไม่มี season_closed ─────────────────
// เดาสถานะจากตาราง seasons: ไม่มี season ที่เปิดอยู่ + มี season ที่จบแล้ว = ปิดอยู่
export function migrateSeasonState() {
  if (getSetting('season_closed') !== undefined) return;
  const hasOpen = db.prepare("SELECT 1 FROM seasons WHERE status IN ('active','pre-season') LIMIT 1").get();
  const hasDone = db.prepare("SELECT 1 FROM seasons WHERE status='done' LIMIT 1").get();
  const closed = !hasOpen && hasDone;
  setSetting('season_closed', closed ? '1' : '0');
  if (closed && !getSetting('last_frozen_through')) {
    const d = db.prepare('SELECT MAX(substr(first_seen,1,10)) AS d FROM strava_activities WHERE is_baseline=1').get().d;
    if (d) setSetting('last_frozen_through', d);
  }
  console.log(`[migration] season_closed=${closed ? 1 : 0}`);
}
