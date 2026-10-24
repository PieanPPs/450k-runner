import { Buffer } from 'node:buffer';
import { Router } from '../lib/asyncRouter.js';
import { db, jsonParam } from '../lib/db.js';
import { signToken, requireAdmin } from '../middleware/adminAuth.js';
import { exceedsPaceCap } from '../lib/paceCap.js';
import { platform, mimeFor } from '../lib/platform.js';
import { INTERNAL_SEASON_KEYS, loadSettings, setSettingStmt, currentSeasonId } from '../lib/season.js';
import { recomputeParticipantStats } from '../lib/participantStats.js';
import { thaiNow } from '../lib/time.js';
import {
  takeWeeklySnapshot, closeSeason, startSeason, scheduleSeason, cancelNextSeason, getSeasonStatus,
} from '../lib/seasonLifecycle.js';

const router = Router();

const logStmt = (status, message) =>
  db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)').bind(thaiNow(), status, message);

// POST /api/adminpp/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = signToken({ user: username, role: 'admin' });
    return res.json({ ok: true, token });
  }
  res.status(401).json({ ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
});

// GET /api/adminpp/verify
router.get('/verify', requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

// ── Settings ─────────────────────────────────────────────
// GET /api/adminpp/settings
router.get('/settings', requireAdmin, async (_req, res) => {
  res.json(await loadSettings());
});

// PUT /api/adminpp/settings
router.put('/settings', requireAdmin, async (req, res) => {
  // ค่าที่ระบบ season จัดการเอง — ถ้าหน้า settings ส่งค่าเก่ากลับมาจะทับสถานะล่าสุดของ cron
  const entries = Object.entries(req.body).filter(([key]) => !INTERNAL_SEASON_KEYS.includes(key));
  if (entries.length) await db.batch(entries.map(([key, value]) => setSettingStmt(key, value)));
  res.json({ ok: true });
});

// ── Participants ──────────────────────────────────────────
router.get('/participants', requireAdmin, async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const rows = await db.prepare('SELECT p.id,p.name,p.initials,p.km,p.steps,p.streak,p.weekly_km as weeklyKm,p.activity_count as activityCount,p.strava_key,p.age_group,t.weekly_target_km FROM participants p LEFT JOIN participant_targets t ON t.participant_id = p.id ORDER BY p.km DESC').all();
  res.json(rows);
});

// Pre-season breakdown: km รายเดือน + pre-season vs season
router.get('/preseason', requireAdmin, async (_req, res) => {
  const [participants, rows] = await Promise.all([
    db.prepare('SELECT id,name,initials,strava_key FROM participants ORDER BY name').all(),
    db.prepare(`
      SELECT strava_key, strftime('%Y-%m', first_seen) as month,
             SUM(COALESCE(credited_km, distance_km)) as km, is_baseline
      FROM strava_activities
      GROUP BY strava_key, month, is_baseline
      ORDER BY month
    `).all(),
  ]);
  const byKey = new Map();
  for (const r of rows) {
    if (!byKey.has(r.strava_key)) byKey.set(r.strava_key, []);
    byKey.get(r.strava_key).push(r);
  }
  const result = participants.map(p => {
    if (!p.strava_key) return { ...p, preseason_km:0, season_km:0, total_km:0, monthly:{} };
    const mine = byKey.get(p.strava_key) || [];
    const preKm  = mine.filter(r=>r.is_baseline===1).reduce((s,r)=>s+r.km,0);
    const seaKm  = mine.filter(r=>r.is_baseline===0).reduce((s,r)=>s+r.km,0);
    const monthly = {};
    mine.forEach(r => { monthly[r.month] = Math.round(((monthly[r.month]||0)+r.km)*10)/10; });
    return { ...p,
      preseason_km : Math.round(preKm*10)/10,
      season_km    : Math.round(seaKm*10)/10,
      total_km     : Math.round((preKm+seaKm)*10)/10,
      monthly,
    };
  });
  res.json(result);
});

router.post('/participants', requireAdmin, async (req, res) => {
  const { name, initials, age_group } = req.body;
  if (!name || !initials) return res.status(400).json({ ok: false, message: 'ต้องระบุ name และ initials' });
  const info = await db.prepare(
    "INSERT INTO participants (name,initials,km,steps,streak,weekly_km,age_group) VALUES (?,?,0,0,0,0,?)"
  ).run(name.trim(), initials.trim().toUpperCase(), age_group || 'general');
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/participants/:id', requireAdmin, async (req, res) => {
  const { name, initials, age_group } = req.body;
  await db.prepare('UPDATE participants SET name=?,initials=?,age_group=? WHERE id=?')
    .run(name, initials, age_group || 'general', req.params.id);
  res.json({ ok: true });
});

// PUT /api/adminpp/participants/:id/target — เป้า km ต่อด่าน (สัปดาห์) รายคน; ส่งค่าว่าง/null = ใช้ค่ากลาง
router.put('/participants/:id/target', requireAdmin, async (req, res) => {
  const raw = req.body?.weekly_target_km;
  if (raw === null || raw === '' || raw === undefined) {
    await db.prepare('DELETE FROM participant_targets WHERE participant_id=?').run(req.params.id);
    return res.json({ ok: true, weekly_target_km: null });
  }
  const km = Number(raw);
  if (!Number.isFinite(km) || km <= 0 || km > 200) {
    return res.status(400).json({ ok: false, message: 'เป้าต้องเป็นตัวเลข 0–200 km ต่อสัปดาห์' });
  }
  if (!(await db.prepare('SELECT 1 AS x FROM participants WHERE id=?').get(req.params.id))) {
    return res.status(404).json({ ok: false, message: 'ไม่พบผู้เข้าร่วม' });
  }
  await db.prepare('INSERT INTO participant_targets (participant_id, weekly_target_km) VALUES (?,?) ON CONFLICT(participant_id) DO UPDATE SET weekly_target_km=excluded.weekly_target_km').run(req.params.id, km);
  res.json({ ok: true, weekly_target_km: km });
});

router.delete('/participants/:id', requireAdmin, async (req, res) => {
  // ดึง strava_key ก่อนลบ เพื่อลบ activities ที่ผูกด้วย
  const p = await db.prepare('SELECT strava_key FROM participants WHERE id=?').get(req.params.id);
  // weekly_snapshots / strava_tokens อ้างอิง participants(id) — ต้องลบก่อน (foreign key)
  await db.batch([
    p?.strava_key ? db.prepare('DELETE FROM strava_activities WHERE strava_key=?').bind(p.strava_key) : null,
    db.prepare('DELETE FROM weekly_snapshots WHERE participant_id=?').bind(req.params.id),
    db.prepare('DELETE FROM strava_tokens WHERE participant_id=?').bind(req.params.id),
    db.prepare('DELETE FROM participant_targets WHERE participant_id=?').bind(req.params.id),
    db.prepare('DELETE FROM participants WHERE id=?').bind(req.params.id),
  ]);
  res.json({ ok: true });
});

// POST /api/adminpp/participants/merge
// แก้กรณีเปลี่ยนชื่อบน Strava แล้วระบบสร้าง participant ซ้ำ
// keep_id  = participant ตัวจริง (มีประวัติครบ)
// delete_id = ghost ที่ถูกสร้างอัตโนมัติหลังเปลี่ยนชื่อ
// ผล: ย้าย activities ทั้งหมดมารวมใน keep, อัพเดท strava_key+ชื่อ, ลบ ghost
router.post('/participants/merge', requireAdmin, async (req, res) => {
  const { keep_id, delete_id } = req.body;

  if (!keep_id || !delete_id || Number(keep_id) === Number(delete_id)) {
    return res.status(400).json({ ok: false, message: 'ต้องระบุ keep_id และ delete_id ที่ต่างกัน' });
  }

  const [keepP, delP] = await Promise.all([
    db.prepare('SELECT id,strava_key,name FROM participants WHERE id=?').get(keep_id),
    db.prepare('SELECT id,strava_key,name FROM participants WHERE id=?').get(delete_id),
  ]);
  if (!keepP) return res.status(404).json({ ok:false, message:`ไม่พบ participant id=${keep_id}` });
  if (!delP)  return res.status(404).json({ ok:false, message:`ไม่พบ participant id=${delete_id}` });

  const oldKey = keepP.strava_key;
  const newKey = delP.strava_key;   // key ที่ Strava ส่งมาตอนนี้ (ชื่อใหม่)
  const newName = delP.name;

  try {
    await db.batch([
      // 1. ย้าย activities เก่า (old_key) → new_key ให้ตรงกับที่ Strava ส่งมาในอนาคต
      db.prepare('UPDATE strava_activities SET strava_key=? WHERE strava_key=?').bind(newKey, oldKey),
      // 2. ลบ ghost participant ก่อน (strava_key ซ้ำกับที่จะตั้งให้ตัวหลัก)
      db.prepare('DELETE FROM participant_targets WHERE participant_id=?').bind(delete_id),
      db.prepare('DELETE FROM participants WHERE id=?').bind(delete_id),
      // 3. อัพเดท participant ตัวหลัก: เปลี่ยน strava_key + ชื่อ
      db.prepare('UPDATE participants SET strava_key=?, name=? WHERE id=?').bind(newKey, newName, keep_id),
    ]);
    // 4. คำนวณ km ใหม่ทั้งหมดให้ participant ตัวหลัก
    const stats = (await recomputeParticipantStats({ keys: [newKey] })).get(newKey) || { km: 0, activity_count: 0 };

    await logStmt('merge',
      `Merged participant: keep id=${keep_id} [${oldKey}→${newKey}], deleted ghost id=${delete_id}, total km=${stats.km}`).run();

    res.json({
      ok: true,
      merged: {
        id: keep_id, name: newName,
        old_strava_key: oldKey, new_strava_key: newKey,
        km: stats.km, activity_count: stats.activity_count,
      },
      message: `✅ รวม participant สำเร็จ — "${keepP.name}" → "${newName}" รวม ${stats.km} km จาก ${stats.activity_count} กิจกรรม`,
    });
  } catch (err) {
    console.error('[admin] merge-participant error:', err);
    res.status(500).json({ ok:false, message: err.message });
  }
});

// ── Milestones ────────────────────────────────────────────
router.get('/milestones', requireAdmin, async (_req, res) => {
  res.json(await db.prepare('SELECT * FROM milestones ORDER BY km').all());
});

router.post('/milestones', requireAdmin, async (req, res) => {
  const { km, reward, icon, color, bg } = req.body;
  const info = await db.prepare('INSERT INTO milestones (km,reward,icon,color,bg) VALUES (?,?,?,?,?)').run(km, reward, icon, color, bg);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/milestones/:id', requireAdmin, async (req, res) => {
  const { km, reward, icon, color, bg } = req.body;
  await db.prepare('UPDATE milestones SET km=?,reward=?,icon=?,color=?,bg=? WHERE id=?').run(km, reward, icon, color, bg, req.params.id);
  res.json({ ok: true });
});

router.delete('/milestones/:id', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM milestones WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Distances ─────────────────────────────────────────────
router.get('/distances', requireAdmin, async (_req, res) => {
  res.json(await db.prepare('SELECT * FROM distances ORDER BY km').all());
});

router.post('/distances', requireAdmin, async (req, res) => {
  const { km, label, icon, description, gmap_url } = req.body;
  const info = await db.prepare('INSERT INTO distances (km,label,icon,description,gmap_url) VALUES (?,?,?,?,?)').run(km, label, icon, description, gmap_url);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/distances/:id', requireAdmin, async (req, res) => {
  const { km, label, icon, description, gmap_url } = req.body;
  await db.prepare('UPDATE distances SET km=?,label=?,icon=?,description=?,gmap_url=? WHERE id=?').run(km, label, icon, description, gmap_url, req.params.id);
  res.json({ ok: true });
});

router.delete('/distances/:id', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM distances WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Seasons ───────────────────────────────────────────────
router.get('/seasons', requireAdmin, async (_req, res) => {
  res.json(await db.prepare('SELECT * FROM seasons ORDER BY id').all());
});

router.post('/seasons', requireAdmin, async (req, res) => {
  const { name, subtitle, date_range, status, top_km, total_km, participants, winner } = req.body;
  const info = await db.prepare('INSERT INTO seasons (name,subtitle,date_range,status,top_km,total_km,participants,winner) VALUES (?,?,?,?,?,?,?,?)').run(name, subtitle, date_range, status, top_km||0, total_km||0, participants||0, winner||'-');
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/seasons/:id', requireAdmin, async (req, res) => {
  const { name, subtitle, date_range, status, top_km, total_km, participants, winner } = req.body;
  await db.prepare('UPDATE seasons SET name=?,subtitle=?,date_range=?,status=?,top_km=?,total_km=?,participants=?,winner=? WHERE id=?').run(name, subtitle, date_range, status, top_km, total_km, participants, winner, req.params.id);
  res.json({ ok: true });
});

router.delete('/seasons/:id', requireAdmin, async (req, res) => {
  // badge และ snapshot ของ season นี้อ้างอิง seasons(id) — ลบไปด้วย (foreign key)
  await db.batch([
    db.prepare('DELETE FROM participant_badges WHERE season_id=?').bind(req.params.id),
    db.prepare('DELETE FROM weekly_snapshots WHERE season_id=?').bind(req.params.id),
    db.prepare('DELETE FROM seasons WHERE id=?').bind(req.params.id),
  ]);
  res.json({ ok: true });
});

// ── Sync Logs ─────────────────────────────────────────────
router.get('/sync-logs', requireAdmin, async (_req, res) => {
  const logs = await db.prepare('SELECT id,synced_at,status,message FROM sync_log ORDER BY id DESC LIMIT 20').all();
  res.json(logs);
});

// ── Daily Report ──────────────────────────────────────────
// GET /api/adminpp/daily?date=2026-05-03
router.get('/daily', requireAdmin, async (req, res) => {
  // วันที่ default = วันนี้ (Bangkok time)
  const date = req.query.date ||
    new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).slice(0, 10);

  const [activities, days] = await Promise.all([
    // กิจกรรมในวันที่เลือก (admin เห็นทั้งหมด รวม pre-season และ baseline)
    db.prepare(`
      SELECT sa.id, sa.strava_key,
             COALESCE(p.name, sa.strava_key) AS name,
             sa.activity_name, sa.distance_km, sa.credited_km, sa.elapsed_time,
             sa.first_seen, sa.is_baseline
      FROM strava_activities sa
      LEFT JOIN participants p ON p.strava_key = sa.strava_key
      WHERE substr(sa.first_seen, 1, 10) = ?
      ORDER BY sa.first_seen
    `).all(date),
    // รายชื่อวันที่มีข้อมูลทั้งหมด
    db.prepare(`
      SELECT substr(first_seen,1,10) AS day,
             COUNT(*) AS count,
             ROUND(SUM(CASE WHEN is_baseline=0 THEN COALESCE(credited_km, distance_km) ELSE 0 END),1) AS total_km,
             COUNT(DISTINCT strava_key) AS runners,
             SUM(CASE WHEN is_baseline=1 THEN 1 ELSE 0 END) AS baseline_count
      FROM strava_activities
      GROUP BY day
      ORDER BY day DESC
      LIMIT 90
    `).all(),
  ]);

  res.json({ date, activities, days });
});

// ── Activities (ตรวจสอบ/ลบกิจกรรมเฉพาะราย) ──────────────
// GET /api/adminpp/activities?participant_id=5
router.get('/activities', requireAdmin, async (req, res) => {
  const { participant_id } = req.query;
  if (!participant_id) return res.status(400).json({ ok: false, message: 'ต้องระบุ participant_id' });
  const p = await db.prepare('SELECT strava_key, name FROM participants WHERE id=?').get(Number(participant_id));
  if (!p?.strava_key) return res.json([]);
  const rows = await db.prepare(`
    SELECT id, activity_name, distance_km, credited_km, elapsed_time, moving_time, first_seen, is_baseline,
           ROUND(CASE WHEN distance_km > 0
             THEN (CASE WHEN moving_time > 0 THEN moving_time ELSE elapsed_time END / 60.0) / distance_km
             ELSE 999 END, 2) AS pace
    FROM strava_activities
    WHERE strava_key = ?
    ORDER BY first_seen DESC
    LIMIT 500
  `).all(p.strava_key);
  res.json(rows);
});

// PATCH /api/adminpp/activities/:id — ปรับ km ที่นับจริง (ตัด commute ออก)
// body: { credited_km: 6.2 }  — ห้ามเกิน distance_km ต้นฉบับ
router.patch('/activities/:id', requireAdmin, async (req, res) => {
  const { credited_km } = req.body;
  if (credited_km === undefined || credited_km === null)
    return res.status(400).json({ ok: false, message: 'ต้องระบุ credited_km' });

  const act = await db.prepare('SELECT strava_key, distance_km, is_baseline FROM strava_activities WHERE id=?').get(Number(req.params.id));
  if (!act) return res.status(404).json({ ok: false, message: 'ไม่พบ activity' });

  // ห้ามเกินระยะต้นฉบับ, ต้องไม่ติดลบ
  const newKm = Math.max(0, Math.min(Number(credited_km), act.distance_km));
  await db.prepare('UPDATE strava_activities SET credited_km=? WHERE id=?').run(newKm, Number(req.params.id));

  // คำนวณ km ใหม่ด้วย COALESCE(credited_km, distance_km)
  await recomputeParticipantStats({ keys: [act.strava_key] });
  res.json({ ok: true, credited_km: newKm });
});

// POST /api/adminpp/activities/manual — เพิ่มกิจกรรมด้วยตัวเอง (กรณี sync ไม่ดึงมา)
// body: { participant_id, distance_km, elapsed_sec, activity_name, activity_date }
router.post('/activities/manual', requireAdmin, async (req, res) => {
  const { participant_id, distance_km, elapsed_sec, activity_name, activity_date } = req.body;
  if (!participant_id || !distance_km || distance_km <= 0)
    return res.status(400).json({ ok: false, message: 'ต้องระบุ participant_id และ distance_km' });

  const p = await db.prepare('SELECT strava_key FROM participants WHERE id=?').get(Number(participant_id));
  if (!p?.strava_key) return res.status(404).json({ ok: false, message: 'ไม่พบผู้เข้าร่วม' });

  const firstSeen = activity_date
    ? (activity_date.length === 10 ? activity_date + ' 12:00:00' : activity_date)
    : thaiNow();

  const distKm  = Math.round(Number(distance_km) * 100) / 100;
  const elapsed = Number(elapsed_sec) || Math.round(distKm * 10 * 60); // fallback: 10 min/km
  const name    = activity_name || 'Manual Entry';
  // hash unique ทุก entry เพื่อไม่ conflict กับ strava hash
  const hash = `MANUAL|${p.strava_key}|${distKm}|${elapsed}|${firstSeen}`;

  // ตรวจว่าซ้ำกับที่มีใน DB แล้วหรือยัง
  const dup = await db.prepare('SELECT id FROM strava_activities WHERE activity_hash=?').get(hash);
  if (dup) return res.status(409).json({ ok: false, message: 'กิจกรรมนี้มีอยู่แล้ว' });

  // pace เกิน 20 นาที/กม. → ไม่รับเข้าระบบ (เหมือนกิจกรรมที่ sync มาจาก Strava)
  if (exceedsPaceCap(distKm, elapsed, 0))
    return res.status(400).json({ ok: false, message: `pace เกิน 20 นาที/กม. — ระบบไม่รับกิจกรรมนี้เข้าระบบ` });

  await db.prepare(`
    INSERT INTO strava_activities (strava_key, activity_hash, distance_km, elapsed_time, activity_name, first_seen, is_baseline)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(p.strava_key, hash, distKm, elapsed, name, firstSeen);

  // คำนวณ km ใหม่
  const stats = (await recomputeParticipantStats({ keys: [p.strava_key] })).get(p.strava_key);
  res.json({ ok: true, message: `เพิ่ม ${distKm} km ให้ ${p.strava_key} แล้ว`, km: stats?.km ?? 0 });
});

// DELETE /api/adminpp/activities/:id — บันทึกลงถังขยะก่อน แล้วลบจริง
router.delete('/activities/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const act = await db.prepare('SELECT * FROM strava_activities WHERE id=?').get(id);
  if (!act) return res.status(404).json({ ok: false, message: 'ไม่พบ activity นี้' });

  // บันทึกลงถังขยะก่อน แล้วลบ (atomic)
  await db.batch([
    db.prepare(`
      INSERT INTO deleted_activities (original_id, strava_key, activity_hash, distance_km, credited_km, elapsed_time, activity_name, first_seen, is_baseline, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, act.strava_key, act.activity_hash, act.distance_km, act.credited_km, act.elapsed_time, act.activity_name, act.first_seen, act.is_baseline, thaiNow()),
    db.prepare('DELETE FROM strava_activities WHERE id=?').bind(id),
  ]);

  // คำนวณ km ใหม่
  await recomputeParticipantStats({ keys: [act.strava_key] });
  res.json({ ok: true, message: 'ย้ายไปถังขยะแล้ว — กู้คืนได้ที่เมนู 🗑️ ถังขยะ' });
});

// ── Recycle Bin ───────────────────────────────────────────
// GET /api/adminpp/trash
router.get('/trash', requireAdmin, async (_req, res) => {
  const rows = await db.prepare(`
    SELECT da.id, da.original_id, da.strava_key, da.activity_name,
           da.distance_km, da.credited_km, da.elapsed_time,
           da.first_seen, da.is_baseline, da.deleted_at,
           COALESCE(p.name, da.strava_key) AS name
    FROM deleted_activities da
    LEFT JOIN participants p ON p.strava_key = da.strava_key
    ORDER BY da.deleted_at DESC
    LIMIT 200
  `).all();
  res.json(rows);
});

// POST /api/adminpp/trash/:id/restore — กู้คืน activity
router.post('/trash/:id/restore', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const item = await db.prepare('SELECT * FROM deleted_activities WHERE id=?').get(id);
  if (!item) return res.status(404).json({ ok: false, message: 'ไม่พบใน recycle bin' });

  // ตรวจว่า hash ซ้ำหรือยัง (อาจถูก sync ซ้ำมาแล้ว)
  const existing = item.activity_hash
    ? await db.prepare('SELECT id FROM strava_activities WHERE activity_hash=?').get(item.activity_hash)
    : null;
  if (existing) {
    await db.prepare('DELETE FROM deleted_activities WHERE id=?').run(id);
    return res.json({ ok: true, message: 'sync ดึงกิจกรรมนี้กลับมาแล้ว (ไม่ต้องกู้)' });
  }

  // คืน activity กลับ
  await db.batch([
    db.prepare(`
      INSERT INTO strava_activities (strava_key, activity_hash, distance_km, credited_km, elapsed_time, activity_name, first_seen, is_baseline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(item.strava_key, item.activity_hash, item.distance_km, item.credited_km, item.elapsed_time, item.activity_name, item.first_seen, item.is_baseline),
    db.prepare('DELETE FROM deleted_activities WHERE id=?').bind(id),
  ]);

  // คำนวณ km ใหม่
  if (!item.is_baseline) await recomputeParticipantStats({ keys: [item.strava_key] });
  res.json({ ok: true, message: 'กู้คืนสำเร็จ' });
});

// DELETE /api/adminpp/trash/:id — ลบถาวรออกจากถังขยะ
router.delete('/trash/:id', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM deleted_activities WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

// DELETE /api/adminpp/trash — ล้างถังขยะทั้งหมด
router.delete('/trash', requireAdmin, async (_req, res) => {
  const r = await db.prepare('DELETE FROM deleted_activities').run();
  res.json({ ok: true, deleted: r.changes });
});

// ── Export CSV ────────────────────────────────────────────
router.get('/export', requireAdmin, async (_req, res) => {
  const rows = await db.prepare('SELECT name,initials,age_group,km,steps,streak,weekly_km,activity_count FROM participants ORDER BY km DESC').all();
  const header = 'ชื่อ,initials,กลุ่มอายุ,km,steps,streak,weekly_km,activity_count';
  const csv = [header, ...rows.map(r => `${r.name},${r.initials},${r.age_group === 'senior' ? '60+' : 'ทั่วไป'},${r.km},${r.steps},${r.streak},${r.weekly_km},${r.activity_count}`)].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="450k-export.csv"');
  res.send('﻿' + csv);
});

// ── Weekly Snapshot (manual trigger) ─────────────────────
// POST /api/adminpp/snapshot
// ถ่าย snapshot สัปดาห์ปัจจุบัน ณ ขณะนี้ โดยไม่ต้องรอ cron วันอาทิตย์ 23:59
// - ใช้ weekly_km ที่มีอยู่ใน participants (ค่าจาก sync ล่าสุด)
// - ถ้า snapshot สัปดาห์เดียวกันมีอยู่แล้ว จะ overwrite (เพื่อให้กดได้หลายครั้งในสัปดาห์)
router.post('/snapshot', requireAdmin, async (req, res) => {
  const r = await takeWeeklySnapshot({ label: 'manual', weekOverride: req.body?.week_no });
  if (!r.ok) return res.status(409).json(r);

  await logStmt('snapshot', `Manual snapshot: week ${r.weekNo} — ${r.participants} participants`).run();

  res.json({
    ok: true,
    week_no: r.weekNo,
    week_label: r.weekLabel,
    participants: r.participants,
    message: `✅ บันทึกผล${r.weekLabel}แล้ว — ${r.participants} คน`,
  });
});

// ── Reset ─────────────────────────────────────────────────
// ลบกิจกรรมทุก season ถาวร — ต้องพิมพ์ยืนยัน และ backup ก่อนเสมอ
router.post('/reset', requireAdmin, async (req, res) => {
  if (req.body?.confirm !== 'RESET') {
    return res.status(400).json({ ok: false, message: 'ต้องพิมพ์ RESET เพื่อยืนยัน' });
  }
  let backupFile;
  try { backupFile = await platform.backup('reset'); }
  catch (e) { return res.status(500).json({ ok: false, message: `สำรองข้อมูลไม่สำเร็จ จึงยังไม่รีเซ็ต: ${e.message}` }); }

  await db.batch([
    db.prepare('DELETE FROM sync_log'),
    db.prepare('DELETE FROM weekly_snapshots'),
    db.prepare('DELETE FROM strava_activities'),
    db.prepare('UPDATE participants SET km=0,steps=0,streak=0,weekly_km=0,activity_count=0'),
  ]);
  res.json({ ok: true, backup: backupFile, message: `รีเซ็ตข้อมูลการวิ่งแล้ว (ผู้เข้าร่วมยังอยู่) — backup: ${backupFile}` });
});

// ── Season lifecycle (logic อยู่ใน lib/seasonLifecycle.js — cron ใช้ตัวเดียวกัน) ──
const sendResult = (res, r) => res.status(r.ok ? 200 : (r.status || 400)).json(r);

// GET /api/adminpp/season-status — สถานะ season ปัจจุบัน + season ถัดไปที่ตั้งไว้
router.get('/season-status', requireAdmin, async (_req, res) => {
  res.json(await getSeasonStatus());
});

// POST /api/adminpp/schedule-season — ตั้งค่า season ถัดไป (หรือแก้ season ที่ยังไม่เริ่ม)
// body: { season_name, season_start, duration_months?, season_end?, subtitle?, auto_close?, grace_days? }
router.post('/schedule-season', requireAdmin, async (req, res) => {
  sendResult(res, await scheduleSeason(req.body));
});

// DELETE /api/adminpp/schedule-season — ยกเลิก season ถัดไปที่ตั้งไว้
router.delete('/schedule-season', requireAdmin, async (_req, res) => {
  sendResult(res, await cancelNextSeason());
});

// POST /api/adminpp/close-season — ปิด season ปัจจุบันทันที (backup → archive → freeze → reset)
router.post('/close-season', requireAdmin, async (req, res) => {
  sendResult(res, await closeSeason({ reason: 'manual', seasonName: req.body?.season_name }));
});

// POST /api/adminpp/seasons/:id/results — อัพโหลด results_json ย้อนหลัง (เช่น Season 1 จาก CSV)
// body: { results: [{ name, initials, km, steps, streak, activity_count, age_group }, ...] }
router.post('/seasons/:id/results', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { results } = req.body;
  if (!Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ ok: false, message: 'results array required' });
  }
  const season = await db.prepare('SELECT id FROM seasons WHERE id=?').get(id);
  if (!season) return res.status(404).json({ ok: false, message: 'season not found' });
  await db.prepare('UPDATE seasons SET results_json=? WHERE id=?').run(JSON.stringify(results), id);
  res.json({ ok: true, count: results.length });
});

// POST /api/adminpp/start-season — เริ่ม season ใหม่หลังปิด season เดิมแล้ว (เทียบเท่า schedule-season ตอน season ปิดอยู่)
router.post('/start-season', requireAdmin, async (req, res) => {
  sendResult(res, await startSeason(req.body));
});

// ── Season auto-compute ───────────────────────────────────
router.get('/seasons/compute', requireAdmin, async (_req, res) => {
  const [totals, top, settings] = await Promise.all([
    db.prepare('SELECT COALESCE(SUM(km),0) as v, COUNT(*) as c FROM participants').get(),
    db.prepare('SELECT name, km FROM participants ORDER BY km DESC LIMIT 1').get(),
    loadSettings(),
  ]);
  const SEASON_START = settings.season_start || process.env.SEASON_START || '2026-06-01';
  const now          = new Date().toISOString().slice(0,10);
  res.json({
    total_km:     Math.round(totals.v * 100) / 100,
    participants: totals.c,
    top_km:       top?.km || 0,
    winner:       top?.name || '—',
    date_range:   `${SEASON_START} – ${now}`,
  });
});

// ── Gallery ───────────────────────────────────────────────
// GET /api/adminpp/gallery
router.get('/gallery', requireAdmin, async (_req, res) => {
  const rows = await db.prepare('SELECT id, filename, caption, uploaded_at FROM gallery_images ORDER BY id DESC').all();
  res.json(rows);
});

// POST /api/adminpp/gallery  — body: { filename, data (base64), caption }
router.post('/gallery', requireAdmin, async (req, res) => {
  const { filename, data, caption } = req.body;
  if (!filename || !data) return res.status(400).json({ ok: false, message: 'filename and data required' });

  // Sanitize filename & prefix with timestamp to avoid collisions
  const safe  = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const final = `${Date.now()}_${safe}`;
  const base64Data = data.replace(/^data:[^;]+;base64,/, '');
  await platform.files.put(final, Buffer.from(base64Data, 'base64'), mimeFor(final));

  await db.prepare('INSERT INTO gallery_images (filename, caption) VALUES (?, ?)').run(final, caption || '');
  res.json({ ok: true, filename: final });
});

// DELETE /api/adminpp/gallery/:id
router.delete('/gallery/:id', requireAdmin, async (req, res) => {
  const row = await db.prepare('SELECT filename FROM gallery_images WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, message: 'not found' });
  await platform.files.delete(row.filename);
  await db.prepare('DELETE FROM gallery_images WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
//  BADGES — CRUD + ASSIGN
// ─────────────────────────────────────────────────────────────

const badgeValues = (b) => [
  b.icon || '🏅', b.label, b.color || '#f59e0b', b.description || null,
  b.auto_km             != null ? parseFloat(b.auto_km)             : null,
  b.auto_streak         != null ? parseInt(b.auto_streak)           : null,
  b.auto_activity_count != null ? parseInt(b.auto_activity_count)   : null,
  b.auto_act_km         != null ? parseFloat(b.auto_act_km)         : null,
  b.auto_act_min        != null ? parseInt(b.auto_act_min)          : null,
];

// GET /api/adminpp/badges — รายการ badge ทั้งหมด
router.get('/badges', requireAdmin, async (_req, res) => {
  const badges = await db.prepare('SELECT * FROM badges ORDER BY auto_km ASC NULLS LAST, created_at ASC').all();
  res.json(badges);
});

// POST /api/adminpp/badges — สร้าง badge ใหม่
router.post('/badges', requireAdmin, async (req, res) => {
  if (!req.body.label) return res.status(400).json({ ok: false, message: 'label required' });
  const result = await db.prepare(
    'INSERT INTO badges (icon, label, color, description, auto_km, auto_streak, auto_activity_count, auto_act_km, auto_act_min) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(...badgeValues(req.body));
  res.json({ ok: true, id: result.lastInsertRowid });
});

// PUT /api/adminpp/badges/:id — แก้ไข badge
router.put('/badges/:id', requireAdmin, async (req, res) => {
  if (!req.body.label) return res.status(400).json({ ok: false, message: 'label required' });
  await db.prepare(
    'UPDATE badges SET icon=?, label=?, color=?, description=?, auto_km=?, auto_streak=?, auto_activity_count=?, auto_act_km=?, auto_act_min=? WHERE id=?'
  ).run(...badgeValues(req.body), req.params.id);
  res.json({ ok: true });
});

// DELETE /api/adminpp/badges/:id — ลบ badge (cascade ลบ participant_badges ด้วย)
router.delete('/badges/:id', requireAdmin, async (req, res) => {
  await db.batch([
    db.prepare('DELETE FROM participant_badges WHERE badge_id=?').bind(req.params.id),
    db.prepare('DELETE FROM badges WHERE id=?').bind(req.params.id),
  ]);
  res.json({ ok: true });
});

// GET /api/adminpp/participant-badges — assignments ของ season ปัจจุบัน
router.get('/participant-badges', requireAdmin, async (_req, res) => {
  const seasonId = await currentSeasonId();
  const rows = seasonId
    ? await db.prepare(`
        SELECT pb.id, pb.participant_name, pb.badge_id, pb.source, pb.note, pb.awarded_at,
               b.icon, b.label, b.color
        FROM participant_badges pb
        JOIN badges b ON b.id = pb.badge_id
        WHERE pb.season_id = ?
        ORDER BY pb.awarded_at DESC
      `).all(seasonId)
    : [];
  res.json({ seasonId, rows });
});

// POST /api/adminpp/participant-badges — assign badge ให้ participant
router.post('/participant-badges', requireAdmin, async (req, res) => {
  const { participant_name, badge_id, note } = req.body;
  if (!participant_name || !badge_id) return res.status(400).json({ ok: false, message: 'participant_name + badge_id required' });
  const seasonId = await currentSeasonId();
  try {
    const result = await db.prepare(
      'INSERT INTO participant_badges (participant_name, badge_id, season_id, source, note) VALUES (?,?,?,?,?)'
    ).run(participant_name, badge_id, seasonId, 'manual', note || null);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ ok: false, message: 'badge นี้ assign ให้คนนี้แล้ว' });
    throw e;
  }
});

// DELETE /api/adminpp/participant-badges/:id — ถอด badge
router.delete('/participant-badges/:id', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM participant_badges WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/adminpp/mission-check?min_km=4 — คนที่ weekly_km >= เกณฑ์ (ชื่อจริง ไม่ mask)
router.get('/mission-check', requireAdmin, async (req, res) => {
  const minKm = parseFloat(req.query.min_km) || 4;
  const rows = await db.prepare(
    'SELECT id, name, weekly_km FROM participants WHERE weekly_km >= ? ORDER BY weekly_km DESC'
  ).all(minKm);
  res.json({ minKm, qualifiers: rows });
});

// POST /api/adminpp/participant-badges/batch — assign badge ให้หลายคนพร้อมกัน
router.post('/participant-badges/batch', requireAdmin, async (req, res) => {
  const { badge_id, participant_names, note } = req.body;
  if (!badge_id || !Array.isArray(participant_names) || participant_names.length === 0) {
    return res.status(400).json({ ok: false, message: 'badge_id + participant_names[] required' });
  }
  const seasonId = await currentSeasonId();
  const r = await db.prepare(`
    INSERT OR IGNORE INTO participant_badges (participant_name, badge_id, season_id, source, note)
    SELECT value, ?, ?, 'manual', ? FROM json_each(?)
  `).run(badge_id, seasonId, note || null, jsonParam(participant_names));
  const assigned = r.changes;
  res.json({ ok: true, assigned, skipped: participant_names.length - assigned });
});

export default router;
