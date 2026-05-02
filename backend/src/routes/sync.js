import { Router } from 'express';
import { db } from '../db/connection.js';
import { refreshAccessToken, getClubActivitiesByAthlete } from '../strava/client.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = Router();

// helper: อ่าน season_start จาก project_settings ก่อน fallback .env
function getSeasonStart() {
  const row = db.prepare("SELECT value FROM project_settings WHERE key='season_start'").get();
  return row?.value || process.env.SEASON_START || '2026-06-01';
}

// POST /api/sync  — ต้อง login admin
router.post('/', requireAdmin, async (_req, res) => {
  const SEASON_START = getSeasonStart();
  const CLUB_ID      = process.env.STRAVA_CLUB_ID;
  if (!CLUB_ID) return res.status(400).json({ ok:false, message:'STRAVA_CLUB_ID ยังไม่ได้ตั้งค่า' });

  const tokenRow = db.prepare('SELECT participant_id,access_token,refresh_token,expires_at FROM strava_tokens LIMIT 1').get();
  if (!tokenRow) return res.json({ ok:false, message:'ยังไม่มีการเชื่อมต่อ Strava', synced:0, total:0 });

  const nowEpoch = Math.floor(Date.now() / 1000);
  let { access_token, refresh_token, expires_at } = tokenRow;
  if (expires_at - nowEpoch < 300) {
    try {
      const t = await refreshAccessToken(refresh_token);
      access_token = t.access_token; refresh_token = t.refresh_token; expires_at = t.expires_at;
      db.prepare('UPDATE strava_tokens SET access_token=?,refresh_token=?,expires_at=? WHERE participant_id=?')
        .run(access_token, refresh_token, expires_at, tokenRow.participant_id);
    } catch(err) { return res.status(500).json({ ok:false, message:`Token refresh failed: ${err.message}` }); }
  }

  let athleteMap;
  try { athleteMap = await getClubActivitiesByAthlete(access_token, CLUB_ID); }
  catch(err) {
    console.error('[sync] getClubActivities error:', err.message);
    return res.status(500).json({ ok:false, message:err.message });
  }

  const results = [];
  let synced = 0;
  const total = Object.keys(athleteMap).length;

  const insActivity = db.prepare(`
    INSERT OR IGNORE INTO strava_activities (strava_key, activity_hash, distance_km, elapsed_time, activity_name, first_seen, is_baseline)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `);
  const thaiNowActivity = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');

  for (const [stravaKey, data] of Object.entries(athleteMap)) {
    const { stravaName, firstname, lastname, activities } = data;

    // หา participant ที่ผูก strava_key นี้ไว้
    let participant = db.prepare('SELECT id,name FROM participants WHERE strava_key=?').get(stravaKey);

    // ถ้าไม่มี → สร้างใหม่อัตโนมัติ
    if (!participant) {
      const initials = (firstname.slice(0,1) + (lastname.slice(0,1) || '')).toUpperCase() || '??';
      const info = db.prepare(
        'INSERT INTO participants (name,initials,km,steps,streak,weekly_km,strava_key) VALUES (?,?,0,0,0,0,?)'
      ).run(stravaName, initials, stravaKey);
      participant = { id: info.lastInsertRowid, name: stravaName };
    }

    // บันทึก activities ใหม่ลง DB (INSERT OR IGNORE ป้องกัน duplicate)
    // hash = strava_key + distance + elapsed_time + name (Strava Club API ไม่มี activity ID)
    let newCount = 0;
    for (const act of activities) {
      const hash = `${stravaKey}|${act.distance}|${act.elapsed_time}|${act.name || ''}`;
      const result = insActivity.run(stravaKey, hash, (act.distance||0)/1000, act.elapsed_time||0, act.name||'', thaiNowActivity);
      if (result.changes > 0) newCount++;
    }

    // คำนวณ km จาก activities ที่ไม่ใช่ baseline (is_baseline=0 = กิจกรรมหลังเริ่ม season)
    const seasonRow = db.prepare(
      `SELECT COALESCE(SUM(distance_km),0) as km, COUNT(*) as cnt
       FROM strava_activities
       WHERE strava_key=? AND is_baseline=0`
    ).get(stravaKey);

    const totalKm = Math.round(seasonRow.km * 10) / 10;
    const actCount = seasonRow.cnt;
    const steps    = Math.round(totalKm * 1350);

    // weekly km (7 วันล่าสุด เฉพาะกิจกรรมหลัง baseline)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');
    const weekRow = db.prepare(
      `SELECT COALESCE(SUM(distance_km),0) as km FROM strava_activities WHERE strava_key=? AND is_baseline=0 AND first_seen >= ?`
    ).get(stravaKey, weekStr);
    const weeklyKm = Math.round(weekRow.km * 10) / 10;

    // คำนวณ streak จาก first_seen dates (Strava Club API ไม่ส่งวันจริง)
    const seenDates = db.prepare(
      `SELECT DISTINCT substr(first_seen,1,10) as day FROM strava_activities WHERE strava_key=? AND is_baseline=0`
    ).all(stravaKey).map(r => r.day);
    const dateSet = new Set(seenDates);
    let streak = 0;
    const todayD = new Date();
    for (let i = 0; i <= 365; i++) {
      const d = new Date(todayD); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (dateSet.has(key)) { streak++; }
      else if (i === 0) { continue; } // วันนี้ยังไม่มี activity — ข้ามไปวันก่อน
      else { break; }
    }

    db.prepare('UPDATE participants SET km=?,steps=?,weekly_km=?,streak=?,activity_count=? WHERE id=?')
      .run(totalKm, steps, weeklyKm, streak, actCount, participant.id);

    synced++;
    results.push({ id:participant.id, name:participant.name, ok:true, km:totalKm.toFixed(1), new:newCount });
  }

  try { rebuildWeeklyData(SEASON_START); } catch(e) { console.error('[sync] rebuildWeeklyData:', e.message); }
  const thaiNow = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');
  db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)')
    .run(thaiNow, synced===total?'ok':'partial', JSON.stringify(results));

  res.json({ ok:true, synced, total, results });
});

// POST /api/sync/baseline
// ดึง feed ปัจจุบันแล้ว mark ทุก activity ว่า is_baseline=1 (ก่อนเริ่ม season — ไม่นับ km)
router.post('/baseline', requireAdmin, async (_req, res) => {
  const CLUB_ID = process.env.STRAVA_CLUB_ID;
  if (!CLUB_ID) return res.status(400).json({ ok:false, message:'STRAVA_CLUB_ID ยังไม่ได้ตั้งค่า' });

  const tokenRow = db.prepare('SELECT participant_id,access_token,refresh_token,expires_at FROM strava_tokens LIMIT 1').get();
  if (!tokenRow) return res.json({ ok:false, message:'ยังไม่มีการเชื่อมต่อ Strava', marked:0 });

  const nowEpoch = Math.floor(Date.now() / 1000);
  let { access_token, refresh_token, expires_at } = tokenRow;
  if (expires_at - nowEpoch < 300) {
    try {
      const t = await refreshAccessToken(refresh_token);
      access_token = t.access_token; refresh_token = t.refresh_token; expires_at = t.expires_at;
      db.prepare('UPDATE strava_tokens SET access_token=?,refresh_token=?,expires_at=? WHERE participant_id=?')
        .run(access_token, refresh_token, expires_at, tokenRow.participant_id);
    } catch(err) { return res.status(500).json({ ok:false, message:`Token refresh failed: ${err.message}` }); }
  }

  let athleteMap;
  try { athleteMap = await getClubActivitiesByAthlete(access_token, CLUB_ID); }
  catch(err) { return res.status(500).json({ ok:false, message:err.message }); }

  const thaiNow = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');
  // INSERT กิจกรรมที่ยังไม่มีใน DB พร้อม mark is_baseline=1 ทันที
  const insBaseline = db.prepare(`
    INSERT OR IGNORE INTO strava_activities (strava_key, activity_hash, distance_km, elapsed_time, activity_name, first_seen, is_baseline)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  // กิจกรรมที่มีใน DB อยู่แล้ว (is_baseline=0) → update เป็น 1 ด้วย
  const markBaseline = db.prepare(`UPDATE strava_activities SET is_baseline=1 WHERE activity_hash=?`);

  let marked = 0;
  for (const [stravaKey, data] of Object.entries(athleteMap)) {
    for (const act of data.activities) {
      const hash = `${stravaKey}|${act.distance}|${act.elapsed_time}|${act.name || ''}`;
      const r = insBaseline.run(stravaKey, hash, (act.distance||0)/1000, act.elapsed_time||0, act.name||'', thaiNow);
      if (r.changes === 0) markBaseline.run(hash); // มีอยู่แล้ว → mark
      marked++;
    }
  }

  // Reset km ทุกคนเป็น 0 (เพราะ baseline = ยังไม่มีกิจกรรมใน season)
  db.prepare('UPDATE participants SET km=0, steps=0, weekly_km=0, activity_count=0').run();

  db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)')
    .run(thaiNow, 'baseline', `Baseline set: ${marked} activities marked as pre-season`);

  res.json({ ok:true, marked, message:`ตั้ง baseline สำเร็จ — ${marked} กิจกรรมถูก mark เป็น pre-season` });
});

// POST /api/sync/close-preseason
// บันทึกสถิติ Pre-Season → สร้าง season entry → ตั้ง baseline → reset km
router.post('/close-preseason', requireAdmin, (_req, res) => {
  // 1. รวมสถิติจาก activities ที่ยังไม่ใช่ baseline (season ปัจจุบัน)
  const totals = db.prepare(`
    SELECT COALESCE(SUM(distance_km),0) as totalKm,
           COUNT(DISTINCT strava_key)   as participantCount
    FROM strava_activities WHERE is_baseline=0
  `).get();

  // 2. หาผู้นำ
  const topRunner = db.prepare(`
    SELECT p.name, COALESCE(SUM(a.distance_km),0) as km
    FROM strava_activities a
    JOIN participants p ON p.strava_key = a.strava_key
    WHERE a.is_baseline=0
    GROUP BY a.strava_key ORDER BY km DESC LIMIT 1
  `).get();

  const totalKm        = Math.round((totals.totalKm || 0) * 10) / 10;
  const participantCount = totals.participantCount || 0;
  const topKm          = topRunner ? Math.round(topRunner.km * 10) / 10 : 0;
  const winner         = topRunner ? topRunner.name : '-';

  // 3. สร้าง date range string (ภาษาไทย)
  const SEASON_START = getSeasonStart();
  const thaiNow  = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');
  const endStr   = thaiNow.split(' ')[0]; // YYYY-MM-DD
  const months   = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const sd = new Date(SEASON_START + 'T00:00:00');
  const ed = new Date(endStr + 'T00:00:00');
  const buddhistYear = ed.getFullYear() + 543;
  const subtitle  = `${months[sd.getMonth()]} — ${months[ed.getMonth()]} ${buddhistYear}`;
  const dateRange = `${sd.getDate()} ${months[sd.getMonth()]} — ${ed.getDate()} ${months[ed.getMonth()]} ${buddhistYear}`;

  // 4. บันทึก season entry
  const info = db.prepare(
    'INSERT INTO seasons (name,subtitle,date_range,status,top_km,total_km,participants,winner) VALUES (?,?,?,?,?,?,?,?)'
  ).run('Pre-Season', subtitle, dateRange, 'pre-season', topKm, totalKm, participantCount, winner);

  // 5. Mark กิจกรรม season ทั้งหมดเป็น baseline
  const marked = db.prepare('UPDATE strava_activities SET is_baseline=1 WHERE is_baseline=0').run();

  // 6. Reset km ทุกคน
  db.prepare('UPDATE participants SET km=0,steps=0,weekly_km=0,activity_count=0').run();

  // 7. บันทึก log
  db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)')
    .run(thaiNow, 'close-preseason',
      `Pre-Season closed — ${marked.changes} activities, totalKm=${totalKm}, winner=${winner}`);

  res.json({
    ok: true,
    season_id: info.lastInsertRowid,
    stats: { totalKm, topKm, winner, participants: participantCount },
    message: `ปิด Pre-Season สำเร็จ — รวม ${totalKm} km | แชมป์: ${winner}`,
  });
});

// GET /api/sync/baseline-status
router.get('/baseline-status', (_req, res) => {
  const baselineCount = db.prepare('SELECT COUNT(*) as n FROM strava_activities WHERE is_baseline=1').get().n;
  const seasonCount   = db.prepare('SELECT COUNT(*) as n FROM strava_activities WHERE is_baseline=0').get().n;
  const hasBaseline   = baselineCount > 0;
  res.json({ hasBaseline, baselineCount, seasonCount });
});

// POST /api/sync/reset-baseline
// เปลี่ยนใจ: reset is_baseline=0 ทั้งหมด → นับกิจกรรมทุกรายการเป็น season
// แล้วคำนวณ km ใหม่ให้ทุก participant
router.post('/reset-baseline', requireAdmin, (_req, res) => {
  // 1. Reset ทุก activity ให้ is_baseline=0
  const reset = db.prepare('UPDATE strava_activities SET is_baseline=0').run();

  // 2. คำนวณ km ใหม่สำหรับทุก participant
  const participants = db.prepare('SELECT id,strava_key FROM participants').all();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');

  for (const p of participants) {
    const row = db.prepare(
      'SELECT COALESCE(SUM(distance_km),0) as km, COUNT(*) as cnt FROM strava_activities WHERE strava_key=? AND is_baseline=0'
    ).get(p.strava_key);
    const totalKm = Math.round(row.km * 10) / 10;
    const steps   = Math.round(totalKm * 1350);
    const weekRow = db.prepare(
      'SELECT COALESCE(SUM(distance_km),0) as km FROM strava_activities WHERE strava_key=? AND is_baseline=0 AND first_seen>=?'
    ).get(p.strava_key, weekStr);
    const weeklyKm = Math.round(weekRow.km * 10) / 10;
    db.prepare('UPDATE participants SET km=?,steps=?,weekly_km=?,activity_count=? WHERE id=?')
      .run(totalKm, steps, weeklyKm, row.cnt, p.id);
  }

  const thaiNow = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');
  db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)')
    .run(thaiNow, 'reset-baseline', `Reset baseline: ${reset.changes} activities set to is_baseline=0`);

  res.json({ ok:true, reset: reset.changes, message:`Reset สำเร็จ — ${reset.changes} กิจกรรมถูกนับใหม่ทั้งหมด` });
});

// POST /api/sync/test-activity — เพิ่ม fake activity สำหรับทดสอบ (ลบได้ผ่าน DELETE)
router.post('/test-activity', requireAdmin, (req, res) => {
  const { strava_key, distance_km = 5 } = req.body;
  if (!strava_key) return res.status(400).json({ ok:false, message:'ต้องระบุ strava_key' });
  const participant = db.prepare('SELECT id FROM participants WHERE strava_key=?').get(strava_key);
  if (!participant) return res.status(404).json({ ok:false, message:'ไม่พบ participant นี้' });

  const thaiNow = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');
  const hash = `TEST|${strava_key}|${thaiNow}`;
  try {
    db.prepare(`
      INSERT INTO strava_activities (strava_key, activity_hash, distance_km, elapsed_time, activity_name, first_seen, is_baseline)
      VALUES (?, ?, ?, 0, '[TEST] ทดสอบระบบ', ?, 0)
    `).run(strava_key, hash, distance_km, thaiNow);
    res.json({ ok:true, hash, message:`เพิ่ม test activity ${distance_km} km ให้ ${strava_key} แล้ว` });
  } catch(e) {
    res.status(500).json({ ok:false, message: e.message });
  }
});

// DELETE /api/sync/test-activity — ลบ fake activities ทั้งหมด
router.delete('/test-activity', requireAdmin, (_req, res) => {
  const r = db.prepare(`DELETE FROM strava_activities WHERE activity_hash LIKE 'TEST|%'`).run();
  res.json({ ok:true, deleted: r.changes, message:`ลบ test activities ${r.changes} รายการแล้ว` });
});

// GET /api/sync/last
router.get('/last', (_req, res) => {
  const log = db.prepare('SELECT synced_at,status,message FROM sync_log ORDER BY id DESC LIMIT 1').get();
  res.json(log || { synced_at:null, status:'never', message:null });
});

// GET /api/sync/debug  — ต้อง login admin
router.get('/debug', requireAdmin, async (_req, res) => {
  const CLUB_ID = process.env.STRAVA_CLUB_ID;
  const tokenRow = db.prepare('SELECT access_token FROM strava_tokens LIMIT 1').get();
  if (!tokenRow) return res