// Sync กิจกรรมจาก Strava Club → DB — ใช้ร่วมกันระหว่างปุ่ม Sync (POST /api/sync) และ cron
//
// เขียนแบบอ่านข้อมูลทั้งก้อนแล้วคัดกรองในหน่วยความจำ จากนั้นเขียนลง DB รวดเดียว
// (~20 query ต่อรอบไม่ว่ามีกี่กิจกรรม — D1 แพ็กเกจฟรีจำกัด 50 query ต่อ request)
//
// กฎคัดกรอง (เหมือนเดิม):
//  - อยู่ในถังขยะ (hash ตรง หรือ คนเดียวกัน ระยะ ±0.1 km เวลา ±60 วิ) → ข้าม
//  - ซ้ำใน feed รอบเดียวกัน (โทรศัพท์+นาฬิกา: ระยะ ±0.1 km เวลา ±15 วิ วันเดียวกัน) → ข้าม
//  - ซ้ำกับที่มีใน DB (ระยะ ±0.1 km เวลา ±10 วิ วันเดียวกัน — รวมกรณีเปลี่ยนชื่อบน Strava) → ข้าม
//  - pace เกิน cap → ข้าม
//  - นอกช่วงวันของ season / season ปิดอยู่ → บันทึกเป็น baseline (ไม่นับ km)
import { db, jsonParam } from './db.js';
import { refreshAccessToken, getClubActivitiesByAthlete } from '../strava/client.js';
import { exceedsPaceCap } from './paceCap.js';
import { loadSettings, seasonWindowOf, seasonStartOf, baselineFlagFor, currentSeasonId } from './season.js';
import { recomputeParticipantStats } from './participantStats.js';
import { thaiNow, addDays } from './time.js';

const STEPS_PER_KM = 1350;

/** ดึง feed จาก Strava แล้วบันทึก — คืน { ok, synced, total, results } หรือ { ok:false, status?, message } */
export async function syncStrava({ label = 'manual' } = {}) {
  const CLUB_ID = process.env.STRAVA_CLUB_ID;
  if (!CLUB_ID) return { ok: false, status: 400, message: 'STRAVA_CLUB_ID ยังไม่ได้ตั้งค่า' };

  const tokenRow = await db.prepare('SELECT participant_id,access_token,refresh_token,expires_at FROM strava_tokens LIMIT 1').get();
  if (!tokenRow) return { ok: false, message: 'ยังไม่มีการเชื่อมต่อ Strava', synced: 0, total: 0 };

  let { access_token } = tokenRow;
  if (tokenRow.expires_at - Math.floor(Date.now() / 1000) < 300) {
    try {
      const t = await refreshAccessToken(tokenRow.refresh_token);
      access_token = t.access_token;
      await db.prepare('UPDATE strava_tokens SET access_token=?,refresh_token=?,expires_at=? WHERE participant_id=?')
        .run(t.access_token, t.refresh_token, t.expires_at, tokenRow.participant_id);
    } catch (err) { return { ok: false, status: 500, message: `Token refresh failed: ${err.message}` }; }
  }

  let athleteMap;
  try { athleteMap = await getClubActivitiesByAthlete(access_token, CLUB_ID); }
  catch (err) {
    console.error(`[sync:${label}] getClubActivities error:`, err.message);
    return { ok: false, status: 500, message: err.message };
  }
  return applyClubActivities(athleteMap, { label });
}

/** บันทึก athleteMap (ผลจาก getClubActivitiesByAthlete) ลง DB — แยกออกมาเพื่อทดสอบได้โดยไม่ต้องเรียก Strava */
export async function applyClubActivities(athleteMap, { label = 'manual' } = {}) {
  const now = thaiNow();
  const settings = await loadSettings();
  const win = seasonWindowOf(settings);
  const athletes = Object.values(athleteMap);

  // ── 1. ผู้เข้าร่วม — สร้างใหม่อัตโนมัติถ้ายังไม่มี strava_key นี้ ─────────
  let participants = await db.prepare('SELECT id,name,strava_key FROM participants WHERE strava_key IS NOT NULL').all();
  const knownKeys = new Set(participants.map(p => p.strava_key));
  const missing = athletes.filter(a => !knownKeys.has(a.stravaKey)).map(a => ({
    name: a.stravaName,
    initials: (a.firstname.slice(0, 1) + (a.lastname.slice(0, 1) || '')).toUpperCase() || '??',
    key: a.stravaKey,
  }));
  if (missing.length) {
    await db.prepare(`
      INSERT INTO participants (name,initials,km,steps,streak,weekly_km,strava_key)
      SELECT json_extract(value,'$.name'), json_extract(value,'$.initials'), 0,0,0,0, json_extract(value,'$.key')
      FROM json_each(?)
    `).run(jsonParam(missing));
    participants = await db.prepare('SELECT id,name,strava_key FROM participants WHERE strava_key IS NOT NULL').all();
  }
  const participantBy = new Map(participants.map(p => [p.strava_key, p]));

  // ── 2. แปลง feed เป็นแถวที่จะบันทึก ───────────────────────────────────
  const candidates = [];
  for (const a of athletes) {
    for (const act of a.activities) {
      let actDate = now;
      if (act.start_date_local) {
        const d = act.start_date_local.replace('T', ' ').slice(0, 19);
        actDate = d < now ? d : now; // ป้องกันวันที่ในอนาคต
      }
      candidates.push({
        key: a.stravaKey,
        hash: `${a.stravaKey}|${act.distance}|${act.elapsed_time}|${act.name || ''}`,
        distKm: (act.distance || 0) / 1000,
        elapsed: act.elapsed_time || 0,
        moving: act.moving_time || 0,
        name: act.name || '',
        actDate,
        day: actDate.slice(0, 10),
      });
    }
  }
  const minDay = candidates.reduce((m, c) => (c.day < m ? c.day : m), now.slice(0, 10));

  // ── 3. ข้อมูลที่ต้องใช้คัดกรอง (อ่านครั้งเดียว) ────────────────────────
  const [existing, trash] = await Promise.all([
    db.prepare(`
      SELECT activity_hash, strava_key, distance_km, elapsed_time, substr(first_seen,1,10) AS day
      FROM strava_activities WHERE first_seen >= ?
    `).all(addDays(minDay, -1)),
    db.prepare('SELECT activity_hash, strava_key, distance_km, elapsed_time FROM deleted_activities').all(),
  ]);
  const existingHashes = new Set(existing.map(r => r.activity_hash));
  const existingBy = groupBy(existing, r => r.strava_key);
  const trashHashes = new Set(trash.map(r => r.activity_hash).filter(Boolean));
  const trashBy = groupBy(trash, r => r.strava_key);

  // ── 4. คัดกรองในหน่วยความจำ ───────────────────────────────────────────
  const toInsert = [];
  const newCountBy = new Map();
  const seenInFeed = new Map(); // strava_key → [{distKm, elapsed, day}]
  for (const c of candidates) {
    if (trashHashes.has(c.hash)) continue;
    if ((trashBy.get(c.key) || []).some(t => Math.abs(t.distance_km - c.distKm) < 0.1 && Math.abs(t.elapsed_time - c.elapsed) <= 60)) continue;

    const feed = seenInFeed.get(c.key) || [];
    if (feed.some(s => Math.abs(s.distKm - c.distKm) < 0.1 && Math.abs(s.elapsed - c.elapsed) <= 15 && s.day === c.day)) continue;
    feed.push(c);
    seenInFeed.set(c.key, feed);

    const mine = existingBy.get(c.key) || [];
    if (mine.some(r => Math.abs(r.distance_km - c.distKm) < 0.1 && Math.abs(r.elapsed_time - c.elapsed) <= 10 && r.day === c.day)) continue;

    if (exceedsPaceCap(c.distKm, c.elapsed, c.moving)) continue;

    toInsert.push({
      k: c.key, h: c.hash, d: c.distKm, e: c.elapsed, m: c.moving, n: c.name, f: c.actDate,
      b: baselineFlagFor(c.actDate, win),
    });
    if (!existingHashes.has(c.hash)) newCountBy.set(c.key, (newCountBy.get(c.key) || 0) + 1);
    // กันซ้ำกับแถวที่เพิ่งรับเข้าในรอบนี้ด้วย
    mine.push({ distance_km: c.distKm, elapsed_time: c.elapsed, day: c.day });
    existingBy.set(c.key, mine);
  }

  if (toInsert.length) {
    await db.prepare(`
      INSERT INTO strava_activities (strava_key, activity_hash, distance_km, elapsed_time, moving_time, activity_name, first_seen, is_baseline)
      SELECT json_extract(value,'$.k'), json_extract(value,'$.h'), json_extract(value,'$.d'), json_extract(value,'$.e'),
             json_extract(value,'$.m'), json_extract(value,'$.n'), json_extract(value,'$.f'), json_extract(value,'$.b')
      FROM json_each(?) WHERE true
      ON CONFLICT(activity_hash) DO UPDATE SET first_seen = MIN(first_seen, excluded.first_seen)
    `).run(jsonParam(toInsert));
  }

  // ── 5. สถิติผู้เข้าร่วม + กราฟรายสัปดาห์ + badge ────────────────────────
  const stats = await recomputeParticipantStats();
  try { await rebuildWeeklyData(seasonStartOf(settings)); }
  catch (e) { console.error(`[sync:${label}] rebuildWeeklyData:`, e.message); }

  if (!win.closed) {
    try { await autoAwardBadges(settings); }
    catch (e) { console.error(`[badge] auto-award error:`, e.message); }
  }

  const results = athletes.map(a => {
    const p = participantBy.get(a.stravaKey);
    const s = stats.get(a.stravaKey);
    const fresh = newCountBy.get(a.stravaKey) || 0;
    return {
      id: p?.id, name: p?.name ?? a.stravaName, ok: true,
      km: (s?.km ?? 0).toFixed(1), new: fresh,
      ...(fresh >= 5 && { warning: `⚠️ bulk: ${fresh} new activities` }),
    };
  });

  await db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)')
    .run(now, 'ok', label === 'manual' ? JSON.stringify(results) : `[${label}] auto-sync — ${results.length} คน, ใหม่ ${toInsert.length} กิจกรรม`);
  console.log(`[sync:${label}] done — ${results.length} athletes, ${toInsert.length} new/updated activities`);

  return { ok: true, synced: results.length, total: results.length, results };
}

// กราฟ km รายสัปดาห์ของทั้งทีม (ตาราง weekly_data) — สัปดาห์ที่ 1 = 7 วันแรกนับจากวันเริ่ม season
export async function rebuildWeeklyData(seasonStart) {
  const weeks = await db.prepare(`
    SELECT CAST((julianday(substr(first_seen,1,10)) - julianday(?)) / 7 AS INTEGER) + 1 AS w,
           SUM(COALESCE(credited_km, distance_km)) AS km,
           SUM(ROUND(COALESCE(credited_km, distance_km) * ${STEPS_PER_KM})) AS steps
    FROM strava_activities
    WHERE is_baseline=0 AND substr(first_seen,1,10) >= ?
    GROUP BY w ORDER BY w
  `).all(seasonStart, seasonStart);

  const rows = weeks.map(r => ({ week: `สัปดาห์ ${r.w}`, km: Math.round(r.km * 100) / 100, steps: Math.round(r.steps) }));
  await db.batch([
    db.prepare('DELETE FROM weekly_data'),
    rows.length ? db.prepare(`
      INSERT INTO weekly_data (week,km,steps)
      SELECT json_extract(value,'$.week'), json_extract(value,'$.km'), json_extract(value,'$.steps')
      FROM json_each(?) ORDER BY key
    `).bind(jsonParam(rows)) : null,
  ]);
}

// แจก badge อัตโนมัติ — km สะสม / streak / จำนวนครั้ง / ระยะ+เวลาในกิจกรรมเดียว
export async function autoAwardBadges(settings) {
  const badges = await db.prepare(`
    SELECT * FROM badges
    WHERE auto_km IS NOT NULL OR auto_streak IS NOT NULL OR auto_activity_count IS NOT NULL
       OR (auto_act_km IS NOT NULL AND auto_act_min IS NOT NULL)
  `).all();
  if (!badges.length) return;

  const statBadges = badges.filter(b => b.auto_km != null || b.auto_streak != null || b.auto_activity_count != null);
  const actBadges  = badges.filter(b => b.auto_act_km != null && b.auto_act_min != null);
  const awards = [];

  if (statBadges.length) {
    const everyone = await db.prepare('SELECT name, km, streak, activity_count FROM participants').all();
    for (const p of everyone) {
      for (const b of statBadges) {
        if ((b.auto_km != null && p.km >= b.auto_km) ||
            (b.auto_streak != null && p.streak >= b.auto_streak) ||
            (b.auto_activity_count != null && p.activity_count >= b.auto_activity_count)) {
          awards.push({ n: p.name, b: b.id });
        }
      }
    }
  }

  if (actBadges.length) {
    const minKm = Math.min(...actBadges.map(b => b.auto_act_km));
    const acts = await db.prepare(`
      SELECT p.name, COALESCE(sa.credited_km, sa.distance_km) AS km, sa.elapsed_time
      FROM strava_activities sa JOIN participants p ON p.strava_key = sa.strava_key
      WHERE sa.is_baseline=0 AND sa.elapsed_time > 0
        AND sa.activity_hash NOT LIKE 'WEEKLY|%'   -- แถวสรุปรายสัปดาห์ไม่ใช่กิจกรรมเดี่ยว ใช้เวลา/ระยะต่อครั้งไม่ได้
        AND COALESCE(sa.credited_km, sa.distance_km) > 0 AND COALESCE(sa.credited_km, sa.distance_km) >= ?
    `).all(minKm);
    for (const b of actBadges) {
      const maxSec = b.auto_act_min * 60;
      const names = new Set(acts.filter(a => a.km >= b.auto_act_km && a.elapsed_time <= maxSec).map(a => a.name));
      for (const n of names) awards.push({ n, b: b.id });
    }
  }

  if (!awards.length) return;
  const seasonId = await currentSeasonId(settings);
  const r = await db.prepare(`
    INSERT OR IGNORE INTO participant_badges (participant_name, badge_id, season_id, source)
    SELECT json_extract(value,'$.n'), json_extract(value,'$.b'), ?, 'auto' FROM json_each(?)
  `).run(seasonId, jsonParam(awards));
  if (r.changes > 0) console.log(`[badge] auto-awarded ${r.changes} badge entries`);
}

function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}
