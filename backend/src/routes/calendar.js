import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

/**
 * GET /api/weekly-stats
 * ส่งข้อมูล km รายสัปดาห์ของผู้เข้าร่วมทุกคน (13 สัปดาห์)
 * week_no คำนวณจาก julianday(first_seen) - julianday(season_start)
 */
router.get('/weekly-stats', (req, res) => {
  try {
    const seasonStart = db.prepare(
      "SELECT value FROM project_settings WHERE key='season_start'"
    ).get()?.value || '2026-06-01';

    const goalKm = parseFloat(
      db.prepare("SELECT value FROM project_settings WHERE key='goal_km_per_person'").get()?.value || '450'
    );

    const rows = db.prepare(`
      SELECT
        sa.strava_key,
        m.name,
        m.initials,
        CAST((julianday(sa.first_seen) - julianday(?)) / 7 AS INTEGER) + 1 AS week_no,
        ROUND(SUM(sa.distance_km), 2) AS km
      FROM strava_activities sa
      JOIN members m ON m.strava_key = sa.strava_key
      WHERE sa.is_baseline = 0
      GROUP BY sa.strava_key, week_no
      HAVING week_no >= 1 AND week_no <= 13
      ORDER BY m.name, week_no
    `).all(seasonStart);

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

    res.json({ seasonStart, goalKm, participants });
  } catch (err) {
    console.error('[calendar] weekly-stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
