import { Router } from '../lib/asyncRouter.js';
import { db, jsonParam } from '../lib/db.js';
import { refreshAccessToken, getClubActivitiesByAthlete } from '../strava/client.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { platform } from '../lib/platform.js';
import { getSeasonStart } from '../lib/season.js';
import { syncStrava } from '../lib/stravaSync.js';
import { recomputeParticipantStats } from '../lib/participantStats.js';
import { thaiNow } from '../lib/time.js';

const router = Router();

// POST /api/sync  — public (ครูกดเองได้)
router.post('/', async (_req, res) => {
  // สำรองข้อมูลก่อนทุก sync — ป้องกัน data เสียหาย (Cloudflare: D1 Time Travel เก็บให้อยู่แล้ว)
  try { await platform.backup('sync'); } catch(e) { console.warn('[sync] backup failed (non-fatal):', e.message); }

  const r = await syncStrava({ label: 'manual' });
  if (!r.ok && r.status) return res.status(r.status).json(r);
  res.json(r);
});

// อ่าน token + refresh ถ้าใกล้หมดอายุ (ใช้กับเครื่องมือแบบเดิมด้านล่าง)
async function freshAccessToken() {
  const tokenRow = await db.prepare('SELECT participant_id,access_token,refresh_token,expires_at FROM strava_tokens LIMIT 1').get();
  if (!tokenRow) return null;
  if (tokenRow.expires_at - Math.floor(Date.now() / 1000) >= 300) return tokenRow.access_token;
  const t = await refreshAccessToken(tokenRow.refresh_token);
  await db.prepare('UPDATE strava_tokens SET access_token=?,refresh_token=?,expires_at=? WHERE participant_id=?')
    .run(t.access_token, t.refresh_token, t.expires_at, tokenRow.participant_id);
  return t.access_token;
}

// POST /api/sync/baseline  (เครื่องมือแบบเดิม)
// ดึง feed ปัจจุบันแล้ว mark ทุก activity ว่า is_baseline=1 (ก่อนเริ่ม season — ไม่นับ km)
router.post('/baseline', requireAdmin, async (_req, res) => {
  const CLUB_ID = process.env.STRAVA_CLUB_ID;
  if (!CLUB_ID) return res.status(400).json({ ok:false, message:'STRAVA_CLUB_ID ยังไม่ได้ตั้งค่า' });

  let access_token;
  try { access_token = await freshAccessToken(); }
  catch(err) { return res.status(500).json({ ok:false, message:`Token refresh failed: ${err.message}` }); }
  if (!access_token) return res.json({ ok:false, message:'ยังไม่มีการเชื่อมต่อ Strava', marked:0 });

  let athleteMap;
  try { athleteMap = await getClubActivitiesByAthlete(access_token, CLUB_ID); }
  catch(err) { return res.status(500).json({ ok:false, message:err.message }); }

  const now = thaiNow();
  const rows = [];
  for (const [stravaKey, data] of Object.entries(athleteMap)) {
    for (const act of data.activities) {
      rows.push({
        k: stravaKey, h: `${stravaKey}|${act.distance}|${act.elapsed_time}|${act.name || ''}`,
        d: (act.distance||0)/1000, e: act.elapsed_time||0, n: act.name||'',
      });
    }
  }

  // INSERT กิจกรรมที่ยังไม่มีใน DB เป็น baseline ทันที / ที่มีอยู่แล้ว → mark เป็น baseline
  await db.batch([
    db.prepare(`
      INSERT OR IGNORE INTO strava_activities (strava_key, activity_hash, distance_km, elapsed_time, activity_name, first_seen, is_baseline)
      SELECT json_extract(value,'$.k'), json_extract(value,'$.h'), json_extract(value,'$.d'), json_extract(value,'$.e'), json_extract(value,'$.n'), ?, 1
      FROM json_each(?)
    `).bind(now, jsonParam(rows)),
    db.prepare(`UPDATE strava_activities SET is_baseline=1 WHERE activity_hash IN (SELECT json_extract(value,'$.h') FROM json_each(?))`)
      .bind(jsonParam(rows)),
    // Reset km ทุกคนเป็น 0 (เพราะ baseline = ยังไม่มีกิจกรรมใน season)
    db.prepare('UPDATE participants SET km=0, steps=0, weekly_km=0, activity_count=0'),
    db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)')
      .bind(now, 'baseline', `Baseline set: ${rows.length} activities marked as pre-season`),
  ]);

  res.json({ ok:true, marked: rows.length, message:`ตั้ง baseline สำเร็จ — ${rows.length} กิจกรรมถูก mark เป็น pre-season` });
});

// POST /api/sync/close-preseason  (เครื่องมือแบบเดิม)
// บันทึกสถิติ Pre-Season → สร้าง season entry → ตั้ง baseline → reset km
router.post('/close-preseason', requireAdmin, async (_req, res) => {
  // 1. รวมสถิติจาก activities ที่ยังไม่ใช่ baseline + หาผู้นำ
  const [totals, topRunner, SEASON_START] = await Promise.all([
    db.prepare(`
      SELECT COALESCE(SUM(COALESCE(credited_km, distance_km)),0) as totalKm,
             COUNT(DISTINCT strava_key)   as participantCount
      FROM strava_activities WHERE is_baseline=0
    `).get(),
    db.prepare(`
      SELECT p.name, COALESCE(SUM(COALESCE(a.credited_km, a.distance_km)),0) as km
      FROM strava_activities a
      JOIN participants p ON p.strava_key = a.strava_key
      WHERE a.is_baseline=0
      GROUP BY a.strava_key ORDER BY km DESC LIMIT 1
    `).get(),
    getSeasonStart(),
  ]);

  const totalKm        = Math.round((totals.totalKm || 0) * 100) / 100;
  const participantCount = totals.participantCount || 0;
  const topKm          = topRunner ? Math.round(topRunner.km * 100) / 100 : 0;
  const winner         = topRunner ? topRunner.name : '-';

  // 2. สร้าง date range string (ภาษาไทย)
  const now      = thaiNow();
  const endStr   = now.split(' ')[0]; // YYYY-MM-DD
  const months   = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const sd = new Date(SEASON_START + 'T00:00:00');
  const ed = new Date(endStr + 'T00:00:00');
  const buddhistYear = ed.getFullYear() + 543;
  const subtitle  = `${months[sd.getMonth()]} — ${months[ed.getMonth()]} ${buddhistYear}`;
  const dateRange = `${sd.getDate()} ${months[sd.getMonth()]} — ${ed.getDate()} ${months[ed.getMonth()]} ${buddhistYear}`;

  // 3. บันทึก season entry, mark baseline, reset km, log
  const [info, marked] = await db.batch([
    db.prepare('INSERT INTO seasons (name,subtitle,date_range,status,top_km,total_km,participants,winner) VALUES (?,?,?,?,?,?,?,?)')
      .bind('Pre-Season', subtitle, dateRange, 'pre-season', topKm, totalKm, participantCount, winner),
    db.prepare('UPDATE strava_activities SET is_baseline=1 WHERE is_baseline=0'),
    db.prepare('UPDATE participants SET km=0,steps=0,weekly_km=0,activity_count=0'),
  ]);
  await db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)')
    .run(now, 'close-preseason', `Pre-Season closed — ${marked.changes} activities, totalKm=${totalKm}, winner=${winner}`);

  res.json({
    ok: true,
    season_id: info.lastInsertRowid,
    stats: { totalKm, topKm, winner, participants: participantCount },
    message: `ปิด Pre-Season สำเร็จ — รวม ${totalKm} km | แชมป์: ${winner}`,
  });
});

// GET /api/sync/baseline-status
router.get('/baseline-status', async (_req, res) => {
  const r = await db.prepare('SELECT SUM(is_baseline=1) AS b, SUM(is_baseline=0) AS s FROM strava_activities').get();
  const baselineCount = r.b || 0;
  const seasonCount   = r.s || 0;
  res.json({ hasBaseline: baselineCount > 0, baselineCount, seasonCount });
});

// POST /api/sync/reset-baseline
// เปลี่ยนใจ: reset is_baseline=0 ทั้งหมด → นับกิจกรรมทุกรายการเป็น season แล้วคำนวณ km ใหม่
router.post('/reset-baseline', requireAdmin, async (_req, res) => {
  // มี season ที่ปิดไปแล้ว → กิจกรรม baseline รวมกิจกรรมของ season เก่าด้วย ห้ามปลดทั้งหมด
  if (await db.prepare("SELECT 1 AS x FROM seasons WHERE status='done' LIMIT 1").get()) {
    return res.status(409).json({ ok:false, message:'มี Season ที่ปิดไปแล้ว — reset baseline จะดึงกิจกรรม season เก่ากลับมานับ จึงปิดการใช้งาน' });
  }
  const reset = await db.prepare('UPDATE strava_activities SET is_baseline=0').run();
  await recomputeParticipantStats();
  await db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)')
    .run(thaiNow(), 'reset-baseline', `Reset baseline: ${reset.changes} activities set to is_baseline=0`);

  res.json({ ok:true, reset: reset.changes, message:`Reset สำเร็จ — ${reset.changes} กิจกรรมถูกนับใหม่ทั้งหมด` });
});

// POST /api/sync/test-activity — เพิ่ม fake activity สำหรับทดสอบ (ลบได้ผ่าน DELETE)
router.post('/test-activity', requireAdmin, async (req, res) => {
  const { strava_key, distance_km = 5 } = req.body;
  if (!strava_key) return res.status(400).json({ ok:false, message:'ต้องระบุ strava_key' });
  const participant = await db.prepare('SELECT id FROM participants WHERE strava_key=?').get(strava_key);
  if (!participant) return res.status(404).json({ ok:false, message:'ไม่พบ participant นี้' });

  const now = thaiNow();
  const hash = `TEST|${strava_key}|${now}`;
  try {
    await db.prepare(`
      INSERT INTO strava_activities (strava_key, activity_hash, distance_km, elapsed_time, activity_name, first_seen, is_baseline)
      VALUES (?, ?, ?, 0, '[TEST] ทดสอบระบบ', ?, 0)
    `).run(strava_key, hash, distance_km, now);
    res.json({ ok:true, hash, message:`เพิ่ม test activity ${distance_km} km ให้ ${strava_key} แล้ว` });
  } catch(e) {
    res.status(500).json({ ok:false, message: e.message });
  }
});

// DELETE /api/sync/test-activity — ลบ fake activities ทั้งหมด
router.delete('/test-activity', requireAdmin, async (_req, res) => {
  const r = await db.prepare(`DELETE FROM strava_activities WHERE activity_hash LIKE 'TEST|%'`).run();
  res.json({ ok:true, deleted: r.changes, message:`ลบ test activities ${r.changes} รายการแล้ว` });
});

// GET /api/sync/last
router.get('/last', async (_req, res) => {
  const log = await db.prepare('SELECT synced_at,status,message FROM sync_log ORDER BY id DESC LIMIT 1').get();
  res.json(log || { synced_at:null, status:'never', message:null });
});

// GET /api/sync/debug  — ต้อง login admin
router.get('/debug', requireAdmin, async (_req, res) => {
  const CLUB_ID = process.env.STRAVA_CLUB_ID;
  const tokenRow = await db.prepare('SELECT access_token FROM strava_tokens LIMIT 1').get();
  if (!tokenRow) return res.json({ error:'no token' });
  const url = `https://www.strava.com/api/v3/clubs/${CLUB_ID}/activities?per_page=5`;
  const r = await fetch(url, { headers:{ Authorization:`Bearer ${tokenRow.access_token}` } });
  const raw = await r.json();
  res.json({ status:r.status, count:Array.isArray(raw)?raw.length:'N/A', raw });
});

export default router;
