import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

/** helper — หา refDate สำหรับนับสัปดาห์
 *  ใช้ค่าที่เร็วที่สุดระหว่าง preseason_start กับ earliest activity
 *  เพื่อป้องกัน activity ก่อน preseason_start หายจาก heatmap
 */
function getRefDate() {
  const seasonStart    = db.prepare("SELECT value FROM project_settings WHERE key='season_start'").get()?.value    || '2026-06-01';
  const preseasonStart = db.prepare("SELECT value FROM project_settings WHERE key='preseason_start'").get()?.value || null;
  const now = new Date();

  if (now < new Date(seasonStart)) {
    /* หา earliest activity จริงๆ */
    const earliest = db.prepare(
      "SELECT MIN(date(first_seen)) AS d FROM strava_activities WHERE is_baseline = 0"
    ).get()?.d || null;

    /* ใช้ค่าที่เร็วที่สุดในสามค่า: preseasonStart, earliest activity, seasonStart */
    const candidates = [preseasonStart, earliest, seasonStart].filter(Boolean);
    const refDate = candidates.sort()[0]; // sort ascending → ค่าแรก = เร็วที่สุด

    return { refDate, seasonStart, isPreSeason: true };
  }

  return { refDate: seasonStart, seasonStart, isPreSeason: false };
}

/**
 * GET /api/weekly-stats
 * ส่งข้อมูล km รายสัปดาห์ของผู้เข้าร่วมทุกคน (13 สัปดาห์)
 */
router.get('/weekly-stats', (req, res) => {
  try {
    const { refDate, seasonStart, isPreSeason } = getRefDate();

    const goalKm = parseFloat(
      db.prepare("SELECT value FROM project_settings WHERE key='goal_km_per_person'").get()?.value || '450'
    );

    const rows = db.prepare(`
      SELECT
        sa.strava_key,
        m.name,
        m.initials,
        CAST((julianday(date(sa.first_seen)) - julianday(?)) / 7 AS INTEGER) + 1 AS week_no,
        ROUND(SUM(sa.distance_km), 2) AS km
      FROM strava_activities sa
      JOIN participants m ON m.strava_key = sa.strava_key
      WHERE sa.is_baseline = 0
      GROUP BY sa.strava_key, week_no
      HAVING week_no >= 1 AND week_no <= 13
      ORDER BY m.name, week_no
    `).all(refDate);


    /* group by person */
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.strava_key)) {
        map.set(row.strava_key, {
          strava_key: row.strava_key,
          name: row.name,
          initials: row.initials || row.name.slice(0, 2),
          weeks: new Array(13).fill(0),
        });
      }
      const p = map.get(row.strava_key);
      if (row.week_no >= 1 && row.week_no <= 13) {
        p.weeks[row.week_no - 1] = row.km;
      }
    }

    const participants = Array.from(map.values()).map(p => ({
      ...p,
      total:        Math.round(p.weeks.reduce((s, w) => s + w, 0) * 10) / 10,
      best_week:    Math.round(Math.max(...p.weeks) * 10) / 10,
      active_weeks: p.weeks.filter(w => w > 0).length,
    }));

    participants.sort((a, b) => b.total - a.total);

    res.json({ seasonStart, refDate, isPreSeason, goalKm, participants });
  } catch (err) {
    console.error('[calendar] weekly-stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/daily-stats?strava_key=xxx
 * ส่งข้อมูล km รายวันของครู 1 คน (สำหรับ individual heatmap 13w×7d)
 */
router.get('/daily-stats', (req, res) => {
  try {
    const { strava_key } = req.query;
    if (!strava_key) return res.status(400).json({ error: 'strava_key required' });

    const { refDate, isPreSeason } = getRefDate();

    const rows = db.prepare(`
      SELECT
        date(first_seen)                                                         AS run_date,
        CAST(julianday(date(first_seen)) - julianday(?)          AS INTEGER)    AS day_offset,
        CAST((julianday(date(first_seen)) - julianday(?)) / 7 AS INTEGER) + 1  AS week_no,
        CAST((julianday(date(first_seen)) - julianday(?)) AS INTEGER) % 7       AS day_in_week,
        ROUND(SUM(distance_km), 2)                                               AS km
      FROM strava_activities
      WHERE strava_key = ? AND is_baseline = 0
      GROUP BY run_date
      HAVING week_no >= 1 AND week_no <= 13
      ORDER BY run_date
    `).all(refDate, refDate, refDate, strava_key);

    res.json({ refDate, isPreSeason, days: rows });
  } catch (err) {
    console.error('[calendar] daily-stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
