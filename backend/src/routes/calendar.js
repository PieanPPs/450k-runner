import { Router } from 'express';
import { db } from '../db/connection.js';

const router = Router();

/** helper — หา refDate และ totalWeeks สำหรับนับสัปดาห์
 *  - refDate   : วันเริ่มนับ (เร็วสุดใน preseason_start / earliest activity)
 *  - totalWeeks: คำนวณจาก season_end จริง ไม่ใช่ตายตัว 13
 *                ป้องกัน day 92 (31 ส.ค.) หายเพราะ week_no = 14 ถูก filter
 */
function getRefDate() {
  const seasonStart = db.prepare("SELECT value FROM project_settings WHERE key='season_start'").get()?.value || '2026-06-01';
  const seasonEnd   = db.prepare("SELECT value FROM project_settings WHERE key='season_end'").get()?.value   || '2026-08-31';
  const preseasonStart = db.prepare("SELECT value FROM project_settings WHERE key='preseason_start'").get()?.value || null;
  const now = new Date();

  let refDate;
  let isPreSeason = false;

  if (now < new Date(seasonStart)) {
    isPreSeason = true;
    const earliest = db.prepare(
      "SELECT MIN(date(first_seen)) AS d FROM strava_activities WHERE is_baseline = 0"
    ).get()?.d || null;
    const candidates = [preseasonStart, earliest, seasonStart].filter(Boolean);
    refDate = candidates.sort()[0];
  } else {
    refDate = seasonStart;
  }

  /* ปรับ refDate ให้ตรงกับ วันจันทร์ของสัปดาห์นั้น
   * เพื่อให้ขอบเขตสัปดาห์ใน heatmap ตรงกับ Weekly Results (จันทร์–อาทิตย์)
   * ตัวอย่าง: refDate = 2026-05-02 (เสาร์) → ปรับเป็น 2026-04-27 (จันทร์)
   */
  const refD = new Date(refDate + 'T00:00:00+07:00');
  const dow  = refD.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysBack = dow === 0 ? 6 : dow - 1; // ถอยกลับไปวันจันทร์
  refD.setDate(refD.getDate() - daysBack);
  refDate = refD.toISOString().slice(0, 10);

  /* totalWeeks:
   * - Pre-season : แสดงแค่สัปดาห์ที่ผ่านไปแล้วจนถึงวันนี้ (ไม่ show อนาคต)
   * - Season จริง: คำนวณจาก seasonStart → seasonEnd เพื่อรวม day 92 (31 ส.ค.)
   *                1 มิ.ย. – 31 ส.ค. = 92 วัน → ceil(92/7) = 14 สัปดาห์
   */
  let totalWeeks;
  if (isPreSeason) {
    const today = new Date(now.toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' })).toISOString().slice(0, 10);
    const daysElapsed = Math.ceil(
      (new Date(today).getTime() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    totalWeeks = Math.max(1, Math.ceil(daysElapsed / 7));
  } else {
    const diffDays = Math.ceil(
      (new Date(seasonEnd).getTime() - new Date(seasonStart).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    totalWeeks = Math.ceil(diffDays / 7);
  }

  return { refDate, seasonStart, seasonEnd, isPreSeason, totalWeeks };
}

/**
 * GET /api/weekly-stats
 * ส่งข้อมูล km รายสัปดาห์ของผู้เข้าร่วมทุกคน (13 สัปดาห์)
 */
router.get('/weekly-stats', (req, res) => {
  try {
    const { refDate, seasonStart, isPreSeason, totalWeeks } = getRefDate();

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
      HAVING week_no >= 1 AND week_no <= ?
      ORDER BY m.name, week_no
    `).all(refDate, totalWeeks);

    /* group by person */
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.strava_key)) {
        map.set(row.strava_key, {
          strava_key: row.strava_key,
          name: row.name,
          initials: row.initials || row.name.slice(0, 2),
          weeks: new Array(totalWeeks).fill(0),
        });
      }
      const p = map.get(row.strava_key);
      if (row.week_no >= 1 && row.week_no <= totalWeeks) {
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

    res.json({ seasonStart, refDate, isPreSeason, totalWeeks, goalKm, participants });
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

    const { refDate, isPreSeason, totalWeeks } = getRefDate();

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
      HAVING week_no >= 1 AND week_no <= ?
      ORDER BY run_date
    `).all(refDate, refDate, refDate, strava_key, totalWeeks);

    res.json({ refDate, isPreSeason, totalWeeks, days: rows });
  } catch (err) {
    console.error('[calendar] daily-stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
