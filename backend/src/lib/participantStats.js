// คำนวณ km / steps / weekly_km / streak / activity_count ของผู้เข้าร่วมใหม่จาก strava_activities
// ใช้ query คงที่ 4 ครั้งไม่ว่าจะมีกี่คน (D1 ฟรีจำกัด 50 query ต่อ request)
import { db, jsonParam } from './db.js';
import { todayBkk, mondayOf, addDays } from './time.js';

const STEPS_PER_KM = 1350;
const round2 = (n) => Math.round(n * 100) / 100;

/** streak = จำนวนวันติดกันย้อนจากวันนี้ (ถ้าวันนี้ยังไม่วิ่ง เริ่มนับจากเมื่อวาน) */
export function streakFrom(daySet, today = todayBkk()) {
  let day = daySet.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (daySet.has(day) && streak <= 400) { streak++; day = addDays(day, -1); }
  return streak;
}

/**
 * คำนวณใหม่ให้ผู้เข้าร่วมทุกคนที่ผูก Strava (หรือเฉพาะ strava_key ที่ระบุ)
 * คืน Map<strava_key, { id, name, km, steps, weekly_km, streak, activity_count }>
 */
export async function recomputeParticipantStats({ keys } = {}) {
  const today = todayBkk();
  const weekStart = mondayOf(today) + ' 00:00:00';
  const since = addDays(today, -400);

  const [participants, agg, days] = await Promise.all([
    db.prepare('SELECT id, name, strava_key FROM participants WHERE strava_key IS NOT NULL').all(),
    db.prepare(`
      SELECT strava_key,
             COALESCE(SUM(COALESCE(credited_km, distance_km)),0) AS km,
             COALESCE(SUM(COALESCE(act_count, 1)),0) AS cnt,
             COALESCE(SUM(CASE WHEN first_seen >= ? THEN COALESCE(credited_km, distance_km) ELSE 0 END),0) AS wk
      FROM strava_activities WHERE is_baseline=0
      GROUP BY strava_key
    `).all(weekStart),
    db.prepare(`
      SELECT DISTINCT strava_key, substr(first_seen,1,10) AS day
      FROM strava_activities WHERE is_baseline=0 AND first_seen >= ?
    `).all(since),
  ]);

  const aggBy = new Map(agg.map(r => [r.strava_key, r]));
  const daysBy = new Map();
  for (const r of days) {
    if (!daysBy.has(r.strava_key)) daysBy.set(r.strava_key, new Set());
    daysBy.get(r.strava_key).add(r.day);
  }

  const only = keys ? new Set(keys) : null;
  const out = new Map();
  for (const p of participants) {
    if (only && !only.has(p.strava_key)) continue;
    const a = aggBy.get(p.strava_key);
    const km = round2(a?.km || 0);
    out.set(p.strava_key, {
      id: p.id, name: p.name, km,
      steps: Math.round(km * STEPS_PER_KM),
      weekly_km: round2(a?.wk || 0),
      streak: streakFrom(daysBy.get(p.strava_key) || new Set(), today),
      activity_count: a?.cnt || 0,
    });
  }

  if (out.size) {
    await db.prepare(`
      UPDATE participants SET km=u.km, steps=u.steps, weekly_km=u.weekly_km, streak=u.streak, activity_count=u.activity_count
      FROM (
        SELECT json_extract(value,'$.id') AS id, json_extract(value,'$.km') AS km, json_extract(value,'$.steps') AS steps,
               json_extract(value,'$.weekly_km') AS weekly_km, json_extract(value,'$.streak') AS streak,
               json_extract(value,'$.activity_count') AS activity_count
        FROM json_each(?)
      ) AS u
      WHERE participants.id = u.id
    `).run(jsonParam([...out.values()]));
  }
  return out;
}
