import { db } from '../db/connection.js';

/**
 * maskName — ซ่อนนามสกุลเพื่อ PDPA
 * "กิตติพร กลสรร"  → "กิตติพร ก."
 * "Kittiporn Klasorn" → "Kittiporn K."
 * ชื่อเดียว (ไม่มีสกุล) → คืนเดิม
 */
function maskName(fullName) {
  if (!fullName) return fullName;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const lastPart = parts[parts.length - 1];
  const firstLetter = [...lastPart][0]; // รองรับ Unicode / ภาษาไทย
  return parts.slice(0, -1).join(' ') + ' ' + firstLetter + '.';
}

export function getParticipants(_req, res) {
  const rows = db.prepare('SELECT id,name,initials,km,steps,streak,weekly_km as weeklyKm,activity_count as activityCount,age_group as ageGroup FROM participants ORDER BY id').all();
  res.json(rows.map(r => ({ ...r, name: maskName(r.name) })));
}

export function getLeaderboard(req, res) {
  const metric = req.query.metric || 'km';
  const keyMap = {
    km: 'km',
    steps: 'steps',
    streak: 'streak',
    weeklyKm: 'weekly_km',
  };
  const column = keyMap[metric] || 'km';
  const rows = db.prepare(`SELECT id,name,initials,km,steps,streak,weekly_km as weeklyKm,activity_count as activityCount,age_group as ageGroup FROM participants ORDER BY ${column} DESC, id ASC`).all();
  res.json({ metric, rows: rows.map(r => ({ ...r, name: maskName(r.name) })) });
}

export function getWeekly(_req, res) {
  const rows = db.prepare('SELECT week,km,steps FROM weekly_data ORDER BY id').all();
  res.json(rows);
}

export function getSeasons(_req, res) {
  const rows = db.prepare('SELECT id,name,subtitle,date_range as dateRange,status,top_km as topKm,total_km as totalKm,participants,winner,results_json as resultsJson FROM seasons ORDER BY id').all();
  // Parse resultsJson string → array (keep null if missing)
  res.json(rows.map(r => ({ ...r, results: r.resultsJson ? JSON.parse(r.resultsJson) : null, resultsJson: undefined })));
}

// GET /api/improvement — เปรียบเทียบ Season ปัจจุบัน vs Season ก่อนหน้า (by name match)
// คืน array เรียงตาม diff (km เพิ่มขึ้น) desc
export function getImprovement(_req, res) {
  // Season ก่อนหน้า = season ที่ status='done' ล่าสุด (id ใหญ่สุด)
  const prevSeason = db.prepare("SELECT results_json FROM seasons WHERE status='done' AND results_json IS NOT NULL ORDER BY id DESC LIMIT 1").get();
  if (!prevSeason) return res.json([]);

  const prev = JSON.parse(prevSeason.results_json);
  const prevMap = new Map(prev.map(p => [p.name, p]));

  // Season ปัจจุบัน
  const current = db.prepare('SELECT name,initials,km,age_group FROM participants ORDER BY km DESC').all();

  const result = current
    .map(p => {
      const old = prevMap.get(p.name);
      const prevKm = old ? old.km : null;
      const diff = prevKm !== null ? Math.round((p.km - prevKm) * 100) / 100 : null;
      return { name: maskName(p.name), initials: p.initials, currentKm: p.km, prevKm, diff, ageGroup: p.age_group };
    })
    .filter(p => p.diff !== null)         // เฉพาะคนที่มีข้อมูล Season ก่อน
    .sort((a, b) => b.diff - a.diff);     // เรียงจากมากไปน้อย

  res.json(result);
}

export function getDistances(_req, res) {
  const rows = db.prepare('SELECT km,label,icon,description as desc,gmap_url as gmapUrl FROM distances ORDER BY km').all();
  res.json(rows);
}

export function getMilestones(_req, res) {
  const base = db.prepare('SELECT km,reward,icon,color,bg FROM milestones ORDER BY km').all();
  const out = base.map((m) => {
    const achievers = m.km === 0
      ? db.prepare('SELECT COUNT(*) as c FROM participants').get().c
      : db.prepare('SELECT COUNT(*) as c FROM participants WHERE km >= ?').get(m.km).c;
    return { ...m, achievers };
  });
  res.json(out);
}

export function getWeeklySnapshots(_req, res) {
  // คืนค่า snapshot ทุก week_no พร้อม array ของผู้เข้าร่วม เรียงตาม rank
  const rows = db.prepare(`
    SELECT week_no, week_label, snapped_at, participant_id, name, initials, km, rank
    FROM weekly_snapshots
    ORDER BY week_no DESC, rank ASC
  `).all();

  // group by week_no
  const weeks = [];
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.week_no)) {
      map.set(r.week_no, { weekNo: r.week_no, weekLabel: r.week_label, snappedAt: r.snapped_at, participants: [] });
      weeks.push(map.get(r.week_no));
    }
    map.get(r.week_no).participants.push({
      id: r.participant_id, name: maskName(r.name), initials: r.initials, km: r.km, rank: r.rank
    });
  }
  res.json(weeks);
}

export function getSummary(_req, res) {
  const totalKm        = db.prepare('SELECT COALESCE(SUM(km),0)          as v FROM participants').get().v;
  const totalWeeklyKm  = db.prepare('SELECT COALESCE(SUM(weekly_km),0)   as v FROM participants').get().v;
  const totalActivities= db.prepare('SELECT COALESCE(SUM(activity_count),0) as v FROM participants').get().v;
  const participantCount = db.prepare('SELECT COUNT(*) as c FROM participants').get().c;
  const top            = db.prepare('SELECT name, km FROM participants ORDER BY km DESC LIMIT 1').get();
  const goalPerPerson  = Number(db.prepare("SELECT value FROM project_settings WHERE key='goal_km_per_person'").get()?.value || 450);
  const goalKm         = participantCount * goalPerPerson;
  const pct            = goalKm > 0 ? Math.min(100, (totalKm / goalKm) * 100) : 0;
  res.json({
    totalKm: Math.round(totalKm * 100) / 100,
    totalWeeklyKm: Math.round(totalWeeklyKm * 100) / 100,
    totalActivities,
    participantCount,
    goalKm,
    goalPerPerson,
    pct: Math.round(pct * 10) / 10,
    topName: maskName(top?.name) || '—',
    topKm: top?.km || 0,
  });
}

export function getSettings(_req, res) {
  const rows = db.prepare('SELECT key,value FROM project_settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
}

export function getGallery(_req, res) {
  const rows = db.prepare('SELECT filename, caption, uploaded_at FROM gallery_images ORDER BY id DESC').all();
  res.json(rows);
}

// GET /api/daily?date=YYYY-MM-DD  — public, ไม่ต้อง auth
export function getDailyLog(req, res) {
  const date = req.query.date ||
    new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).slice(0, 10);

  const activities = db.prepare(`
    SELECT sa.strava_key,
           COALESCE(p.name, sa.strava_key) AS name_full,
           p.initials,
           sa.activity_name,
           sa.distance_km,
           sa.credited_km,
           COALESCE(sa.credited_km, sa.distance_km) AS effective_km,
           sa.elapsed_time,
           sa.first_seen, sa.is_baseline
    FROM strava_activities sa
    LEFT JOIN participants p ON p.strava_key = sa.strava_key
    WHERE substr(sa.first_seen,1,10) = ?
    ORDER BY sa.is_baseline ASC, COALESCE(sa.credited_km, sa.distance_km) DESC
  `).all(date);

  // รายชื่อวันที่มีข้อมูลทั้งหมด (รวม pre-season) — ใช้ effective_km สำหรับ total
  const days = db.prepare(`
    SELECT substr(first_seen,1,10) AS day,
           COUNT(*) AS count,
           ROUND(SUM(CASE WHEN is_baseline=0 THEN COALESCE(credited_km, distance_km) ELSE 0 END),1) AS total_km,
           COUNT(DISTINCT strava_key) AS runners,
           SUM(CASE WHEN is_baseline=1 THEN 1 ELSE 0 END) AS baseline_count
    FROM strava_activities
    GROUP BY day
    ORDER BY day DESC
    LIMIT 90
  `).all();

  res.json({ date, activities: activities.map(a => ({ ...a, name: maskName(a.name_full), name_full: undefined })), days });
}

/**
 * GET /api/badges
 * คืน badge definitions ทั้งหมด + participant assignments ของ season ปัจจุบัน
 * Format: { badges: [...], assignments: { participantName: [badge, ...] } }
 */
export function getBadges(_req, res) {
  const badges = db.prepare('SELECT * FROM badges ORDER BY auto_km ASC NULLS LAST, created_at ASC').all();

  // หา season ปัจจุบัน (active หรือล่าสุด)
  const season = db.prepare("SELECT id FROM seasons WHERE status='active' ORDER BY id DESC LIMIT 1").get()
    || db.prepare('SELECT id FROM seasons ORDER BY id DESC LIMIT 1').get();
  const seasonId = season?.id ?? null;

  // assignments ของ season นี้ — keyed by participant.id (integer) เพื่อ match ง่ายใน frontend
  const rows = seasonId
    ? db.prepare(`
        SELECT pb.badge_id, p.id as participant_id
        FROM participant_badges pb
        LEFT JOIN participants p ON p.name = pb.participant_name
        WHERE pb.season_id = ?
      `).all(seasonId)
    : [];

  // { participantId: [badgeId, ...] }
  const assignments = {};
  for (const r of rows) {
    if (!r.participant_id) continue;
    const key = String(r.participant_id);
    if (!assignments[key]) assignments[key] = [];
    assignments[key].push(r.badge_id);
  }

  res.json({ badges, assignments, seasonId });
}
