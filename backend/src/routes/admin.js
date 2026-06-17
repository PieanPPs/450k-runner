import { Router } from 'express';
import { db } from '../db/connection.js';
import { signToken, requireAdmin } from '../middleware/adminAuth.js';
import { exceedsPaceCap } from '../lib/paceCap.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GALLERY_DIR = path.resolve(__dirname, '../../data/gallery');

const router = Router();

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
router.get('/settings', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT key,value FROM project_settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(settings);
});

// PUT /api/adminpp/settings
router.put('/settings', requireAdmin, (req, res) => {
  const upsert = db.prepare('INSERT INTO project_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  db.transaction(() => {
    for (const [key, value] of Object.entries(req.body)) {
      upsert.run(key, String(value));
    }
  })();
  res.json({ ok: true });
});

// ── Participants ──────────────────────────────────────────
router.get('/participants', requireAdmin, (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const rows = db.prepare('SELECT id,name,initials,km,steps,streak,weekly_km as weeklyKm,activity_count as activityCount,strava_key,age_group FROM participants ORDER BY km DESC').all();
  res.json(rows);
});

// Pre-season breakdown: km รายเดือน + pre-season vs season
router.get('/preseason', requireAdmin, (_req, res) => {
  const participants = db.prepare('SELECT id,name,initials,strava_key FROM participants ORDER BY name').all();
  const result = participants.map(p => {
    if (!p.strava_key) return { ...p, preseason_km:0, season_km:0, total_km:0, monthly:{} };
    const rows = db.prepare(`
      SELECT strftime('%Y-%m', first_seen) as month,
             SUM(COALESCE(credited_km, distance_km)) as km, is_baseline
      FROM strava_activities
      WHERE strava_key=?
      GROUP BY month, is_baseline
      ORDER BY month
    `).all(p.strava_key);
    const preKm  = rows.filter(r=>r.is_baseline===1).reduce((s,r)=>s+r.km,0);
    const seaKm  = rows.filter(r=>r.is_baseline===0).reduce((s,r)=>s+r.km,0);
    const monthly = {};
    rows.forEach(r => { monthly[r.month] = Math.round(((monthly[r.month]||0)+r.km)*10)/10; });
    return { ...p,
      preseason_km : Math.round(preKm*10)/10,
      season_km    : Math.round(seaKm*10)/10,
      total_km     : Math.round((preKm+seaKm)*10)/10,
      monthly,
    };
  });
  res.json(result);
});

router.post('/participants', requireAdmin, (req, res) => {
  const { name, initials, age_group } = req.body;
  if (!name || !initials) return res.status(400).json({ ok: false, message: 'ต้องระบุ name และ initials' });
  const info = db.prepare(
    "INSERT INTO participants (name,initials,km,steps,streak,weekly_km,age_group) VALUES (?,?,0,0,0,0,?)"
  ).run(name.trim(), initials.trim().toUpperCase(), age_group || 'general');
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/participants/:id', requireAdmin, (req, res) => {
  const { name, initials, age_group } = req.body;
  db.prepare('UPDATE participants SET name=?,initials=?,age_group=? WHERE id=?')
    .run(name, initials, age_group || 'general', req.params.id);
  res.json({ ok: true });
});

router.delete('/participants/:id', requireAdmin, (req, res) => {
  // ดึง strava_key ก่อนลบ เพื่อลบ activities ที่ผูกด้วย
  const p = db.prepare('SELECT strava_key FROM participants WHERE id=?').get(req.params.id);
  if (p?.strava_key) {
    db.prepare('DELETE FROM strava_activities WHERE strava_key=?').run(p.strava_key);
    db.prepare('DELETE FROM weekly_snapshots WHERE participant_id=?').run(req.params.id);
  }
  db.prepare('DELETE FROM strava_tokens WHERE participant_id=?').run(req.params.id);
  db.prepare('DELETE FROM participants WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/adminpp/participants/merge
// แก้กรณีเปลี่ยนชื่อบน Strava แล้วระบบสร้าง participant ซ้ำ
// keep_id  = participant ตัวจริง (มีประวัติครบ)
// delete_id = ghost ที่ถูกสร้างอัตโนมัติหลังเปลี่ยนชื่อ
// ผล: ย้าย activities ทั้งหมดมารวมใน keep, อัพเดท strava_key+ชื่อ, ลบ ghost
router.post('/participants/merge', requireAdmin, (req, res) => {
  const { keep_id, delete_id } = req.body;

  if (!keep_id || !delete_id || Number(keep_id) === Number(delete_id)) {
    return res.status(400).json({ ok: false, message: 'ต้องระบุ keep_id และ delete_id ที่ต่างกัน' });
  }

  const keepP = db.prepare('SELECT id,strava_key,name FROM participants WHERE id=?').get(keep_id);
  const delP  = db.prepare('SELECT id,strava_key,name FROM participants WHERE id=?').get(delete_id);
  if (!keepP) return res.status(404).json({ ok:false, message:`ไม่พบ participant id=${keep_id}` });
  if (!delP)  return res.status(404).json({ ok:false, message:`ไม่พบ participant id=${delete_id}` });

  const oldKey = keepP.strava_key;
  const newKey = delP.strava_key;   // key ที่ Strava ส่งมาตอนนี้ (ชื่อใหม่)
  const newName = delP.name;

  const doMerge = db.transaction(() => {
    // 1. ย้าย activities เก่า (old_key) → new_key ให้ตรงกับที่ Strava ส่งมาในอนาคต
    db.prepare('UPDATE strava_activities SET strava_key=? WHERE strava_key=?').run(newKey, oldKey);

    // 2. อัพเดท participant ตัวหลัก: เปลี่ยน strava_key + ชื่อ
    db.prepare('UPDATE participants SET strava_key=?, name=? WHERE id=?').run(newKey, newName, keep_id);

    // 3. ลบ ghost participant (activities ของมันถูกย้ายไปแล้วในขั้นตอนก่อน
    //    แต่ถ้า ghost ยังไม่มี strava_key เดียวกัน ให้ลบทิ้งโดยไม่ลบ activities ซ้ำ)
    db.prepare('DELETE FROM participants WHERE id=?').run(delete_id);

    // 4. คำนวณ km ใหม่ทั้งหมดให้ participant ตัวหลัก
    const seasonRow = db.prepare(
      `SELECT COALESCE(SUM(COALESCE(credited_km,distance_km)),0) as km, COUNT(*) as cnt
       FROM strava_activities WHERE strava_key=? AND is_baseline=0`
    ).get(newKey);
    const totalKm  = Math.round(seasonRow.km * 100) / 100;
    const steps    = Math.round(totalKm * 1350);

    const nowBkk = new Date(new Date().toLocaleString('en-US', { timeZone:'Asia/Bangkok' }));
    const dow    = nowBkk.getDay();
    const daysBack = dow === 0 ? 6 : dow - 1;
    const weekStart = new Date(nowBkk);
    weekStart.setDate(nowBkk.getDate() - daysBack);
    weekStart.setHours(0,0,0,0);
    const weekStr = weekStart.toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ').slice(0,19);

    const weekRow = db.prepare(
      `SELECT COALESCE(SUM(COALESCE(credited_km,distance_km)),0) as km
       FROM strava_activities WHERE strava_key=? AND is_baseline=0 AND first_seen>=?`
    ).get(newKey, weekStr);
    const weeklyKm = Math.round(weekRow.km * 100) / 100;

    // streak
    const seenDates = db.prepare(
      `SELECT DISTINCT substr(first_seen,1,10) as day FROM strava_activities WHERE strava_key=? AND is_baseline=0`
    ).all(newKey).map(r => r.day);
    const dateSet = new Set(seenDates);
    let streak = 0;
    const today = new Date();
    for (let i = 0; i <= 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0,10);
      if (dateSet.has(k)) { streak++; }
      else if (i === 0)   { continue; }
      else                { break; }
    }

    db.prepare('UPDATE participants SET km=?,steps=?,weekly_km=?,streak=?,activity_count=? WHERE id=?')
      .run(totalKm, steps, weeklyKm, streak, seasonRow.cnt, keep_id);

    return { totalKm, weeklyKm, actCount: seasonRow.cnt, streak };
  });

  try {
    const stats = doMerge();
    const thaiNow = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');
    db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)')
      .run(thaiNow, 'merge',
        `Merged participant: keep id=${keep_id} [${oldKey}→${newKey}], deleted ghost id=${delete_id}, total km=${stats.totalKm}`);

    res.json({
      ok: true,
      merged: {
        id: keep_id, name: newName,
        old_strava_key: oldKey, new_strava_key: newKey,
        km: stats.totalKm, activity_count: stats.actCount,
      },
      message: `✅ รวม participant สำเร็จ — "${keepP.name}" → "${newName}" รวม ${stats.totalKm} km จาก ${stats.actCount} กิจกรรม`,
    });
  } catch (err) {
    console.error('[admin] merge-participant error:', err);
    res.status(500).json({ ok:false, message: err.message });
  }
});

// ── Milestones ────────────────────────────────────────────
router.get('/milestones', requireAdmin, (_req, res) => {
  res.json(db.prepare('SELECT * FROM milestones ORDER BY km').all());
});

router.post('/milestones', requireAdmin, (req, res) => {
  const { km, reward, icon, color, bg } = req.body;
  const info = db.prepare('INSERT INTO milestones (km,reward,icon,color,bg) VALUES (?,?,?,?,?)').run(km, reward, icon, color, bg);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/milestones/:id', requireAdmin, (req, res) => {
  const { km, reward, icon, color, bg } = req.body;
  db.prepare('UPDATE milestones SET km=?,reward=?,icon=?,color=?,bg=? WHERE id=?').run(km, reward, icon, color, bg, req.params.id);
  res.json({ ok: true });
});

router.delete('/milestones/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM milestones WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Distances ─────────────────────────────────────────────
router.get('/distances', requireAdmin, (_req, res) => {
  res.json(db.prepare('SELECT * FROM distances ORDER BY km').all());
});

router.post('/distances', requireAdmin, (req, res) => {
  const { km, label, icon, description, gmap_url } = req.body;
  const info = db.prepare('INSERT INTO distances (km,label,icon,description,gmap_url) VALUES (?,?,?,?,?)').run(km, label, icon, description, gmap_url);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/distances/:id', requireAdmin, (req, res) => {
  const { km, label, icon, description, gmap_url } = req.body;
  db.prepare('UPDATE distances SET km=?,label=?,icon=?,description=?,gmap_url=? WHERE id=?').run(km, label, icon, description, gmap_url, req.params.id);
  res.json({ ok: true });
});

router.delete('/distances/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM distances WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Seasons ───────────────────────────────────────────────
router.get('/seasons', requireAdmin, (_req, res) => {
  res.json(db.prepare('SELECT * FROM seasons ORDER BY id').all());
});

router.post('/seasons', requireAdmin, (req, res) => {
  const { name, subtitle, date_range, status, top_km, total_km, participants, winner } = req.body;
  const info = db.prepare('INSERT INTO seasons (name,subtitle,date_range,status,top_km,total_km,participants,winner) VALUES (?,?,?,?,?,?,?,?)').run(name, subtitle, date_range, status, top_km||0, total_km||0, participants||0, winner||'-');
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/seasons/:id', requireAdmin, (req, res) => {
  const { name, subtitle, date_range, status, top_km, total_km, participants, winner } = req.body;
  db.prepare('UPDATE seasons SET name=?,subtitle=?,date_range=?,status=?,top_km=?,total_km=?,participants=?,winner=? WHERE id=?').run(name, subtitle, date_range, status, top_km, total_km, participants, winner, req.params.id);
  res.json({ ok: true });
});

router.delete('/seasons/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM seasons WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Sync Logs ─────────────────────────────────────────────
router.get('/sync-logs', requireAdmin, (_req, res) => {
  const logs = db.prepare('SELECT id,synced_at,status,message FROM sync_log ORDER BY id DESC LIMIT 20').all();
  res.json(logs);
});

// ── Daily Report ──────────────────────────────────────────
// GET /api/adminpp/daily?date=2026-05-03
router.get('/daily', requireAdmin, (req, res) => {
  // วันที่ default = วันนี้ (Bangkok time)
  const date = req.query.date ||
    new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).slice(0, 10);

  // กิจกรรมในวันที่เลือก (admin เห็นทั้งหมด รวม pre-season และ baseline)
  const activities = db.prepare(`
    SELECT sa.id, sa.strava_key,
           COALESCE(p.name, sa.strava_key) AS name,
           sa.activity_name, sa.distance_km, sa.credited_km, sa.elapsed_time,
           sa.first_seen, sa.is_baseline
    FROM strava_activities sa
    LEFT JOIN participants p ON p.strava_key = sa.strava_key
    WHERE substr(sa.first_seen, 1, 10) = ?
    ORDER BY sa.first_seen
  `).all(date);

  // รายชื่อวันที่มีข้อมูลทั้งหมด
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

  res.json({ date, activities, days });
});

// ── Activities (ตรวจสอบ/ลบกิจกรรมเฉพาะราย) ──────────────
// GET /api/adminpp/activities?participant_id=5
router.get('/activities', requireAdmin, (req, res) => {
  const { participant_id } = req.query;
  if (!participant_id) return res.status(400).json({ ok: false, message: 'ต้องระบุ participant_id' });
  const p = db.prepare('SELECT strava_key, name FROM participants WHERE id=?').get(Number(participant_id));
  if (!p?.strava_key) return res.json([]);
  const rows = db.prepare(`
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
router.patch('/activities/:id', requireAdmin, (req, res) => {
  const { credited_km } = req.body;
  if (credited_km === undefined || credited_km === null)
    return res.status(400).json({ ok: false, message: 'ต้องระบุ credited_km' });

  const act = db.prepare('SELECT strava_key, distance_km, is_baseline FROM strava_activities WHERE id=?').get(Number(req.params.id));
  if (!act) return res.status(404).json({ ok: false, message: 'ไม่พบ activity' });

  // ห้ามเกินระยะต้นฉบับ, ต้องไม่ติดลบ
  const newKm = Math.max(0, Math.min(Number(credited_km), act.distance_km));
  db.prepare('UPDATE strava_activities SET credited_km=? WHERE id=?').run(newKm, Number(req.params.id));

  // คำนวณ km ใหม่ด้วย COALESCE(credited_km, distance_km)
  const participant = db.prepare('SELECT id FROM participants WHERE strava_key=?').get(act.strava_key);
  if (participant) {
    const row = db.prepare(
      'SELECT COALESCE(SUM(COALESCE(credited_km, distance_km)),0) as km, COUNT(*) as cnt FROM strava_activities WHERE strava_key=? AND is_baseline=0'
    ).get(act.strava_key);
    const totalKm = Math.round(row.km * 100) / 100;
    db.prepare('UPDATE participants SET km=?,steps=?,activity_count=? WHERE id=?')
      .run(totalKm, Math.round(totalKm * 1350), row.cnt, participant.id);
  }
  res.json({ ok: true, credited_km: newKm });
});

// POST /api/adminpp/activities/manual — เพิ่มกิจกรรมด้วยตัวเอง (กรณี sync ไม่ดึงมา)
// body: { participant_id, distance_km, elapsed_sec, activity_name, activity_date }
router.post('/activities/manual', requireAdmin, (req, res) => {
  const { participant_id, distance_km, elapsed_sec, activity_name, activity_date } = req.body;
  if (!participant_id || !distance_km || distance_km <= 0)
    return res.status(400).json({ ok: false, message: 'ต้องระบุ participant_id และ distance_km' });

  const p = db.prepare('SELECT strava_key FROM participants WHERE id=?').get(Number(participant_id));
  if (!p?.strava_key) return res.status(404).json({ ok: false, message: 'ไม่พบผู้เข้าร่วม' });

  const thaiNow = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');
  const firstSeen = activity_date
    ? (activity_date.length === 10 ? activity_date + ' 12:00:00' : activity_date)
    : thaiNow;

  const distKm  = Math.round(Number(distance_km) * 100) / 100;
  const elapsed = Number(elapsed_sec) || Math.round(distKm * 10 * 60); // fallback: 10 min/km
  const name    = activity_name || 'Manual Entry';
  // hash unique ทุก entry เพื่อไม่ conflict กับ strava hash
  const hash = `MANUAL|${p.strava_key}|${distKm}|${elapsed}|${firstSeen}`;

  // ตรวจว่าซ้ำกับที่มีใน DB แล้วหรือยัง
  const dup = db.prepare('SELECT id FROM strava_activities WHERE activity_hash=?').get(hash);
  if (dup) return res.status(409).json({ ok: false, message: 'กิจกรรมนี้มีอยู่แล้ว' });

  // pace เกิน 20 นาที/กม. → ไม่รับเข้าระบบ (เหมือนกิจกรรมที่ sync มาจาก Strava)
  if (exceedsPaceCap(distKm, elapsed, 0))
    return res.status(400).json({ ok: false, message: `pace เกิน 20 นาที/กม. — ระบบไม่รับกิจกรรมนี้เข้าระบบ` });

  db.prepare(`
    INSERT INTO strava_activities (strava_key, activity_hash, distance_km, elapsed_time, activity_name, first_seen, is_baseline)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(p.strava_key, hash, distKm, elapsed, name, firstSeen);

  // คำนวณ km ใหม่
  const row = db.prepare(
    'SELECT COALESCE(SUM(COALESCE(credited_km, distance_km)),0) as km, COUNT(*) as cnt FROM strava_activities WHERE strava_key=? AND is_baseline=0'
  ).get(p.strava_key);
  const totalKm = Math.round(row.km * 100) / 100;
  db.prepare('UPDATE participants SET km=?,steps=?,activity_count=? WHERE id=?')
    .run(totalKm, Math.round(totalKm * 1350), row.cnt, Number(participant_id));

  res.json({ ok: true, message: `เพิ่ม ${distKm} km ให้ ${p.strava_key} แล้ว`, km: totalKm });
});

// DELETE /api/adminpp/activities/:id — บันทึกลงถังขยะก่อน แล้วลบจริง
router.delete('/activities/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const act = db.prepare('SELECT * FROM strava_activities WHERE id=?').get(id);
  if (!act) return res.status(404).json({ ok: false, message: 'ไม่พบ activity นี้' });

  const thaiNow = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');

  // บันทึกลงถังขยะก่อน
  db.prepare(`
    INSERT INTO deleted_activities (original_id, strava_key, activity_hash, distance_km, credited_km, elapsed_time, activity_name, first_seen, is_baseline, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, act.strava_key, act.activity_hash, act.distance_km, act.credited_km, act.elapsed_time, act.activity_name, act.first_seen, act.is_baseline, thaiNow);

  db.prepare('DELETE FROM strava_activities WHERE id=?').run(id);

  // คำนวณ km ใหม่
  const participant = db.prepare('SELECT id FROM participants WHERE strava_key=?').get(act.strava_key);
  if (participant) {
    const row = db.prepare(
      'SELECT COALESCE(SUM(COALESCE(credited_km, distance_km)),0) as km, COUNT(*) as cnt FROM strava_activities WHERE strava_key=? AND is_baseline=0'
    ).get(act.strava_key);
    const totalKm = Math.round(row.km * 100) / 100;
    db.prepare('UPDATE participants SET km=?,steps=?,activity_count=? WHERE id=?')
      .run(totalKm, Math.round(totalKm * 1350), row.cnt, participant.id);
  }
  res.json({ ok: true, message: 'ย้ายไปถังขยะแล้ว — กู้คืนได้ที่เมนู 🗑️ ถังขยะ' });
});

// ── Recycle Bin ───────────────────────────────────────────
// GET /api/adminpp/trash
router.get('/trash', requireAdmin, (_req, res) => {
  const rows = db.prepare(`
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
router.post('/trash/:id/restore', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const item = db.prepare('SELECT * FROM deleted_activities WHERE id=?').get(id);
  if (!item) return res.status(404).json({ ok: false, message: 'ไม่พบใน recycle bin' });

  // ตรวจว่า hash ซ้ำหรือยัง (อาจถูก sync ซ้ำมาแล้ว)
  const existing = item.activity_hash
    ? db.prepare('SELECT id FROM strava_activities WHERE activity_hash=?').get(item.activity_hash)
    : null;
  if (existing) {
    db.prepare('DELETE FROM deleted_activities WHERE id=?').run(id);
    return res.json({ ok: true, message: 'sync ดึงกิจกรรมนี้กลับมาแล้ว (ไม่ต้องกู้)' });
  }

  // คืน activity กลับ
  db.prepare(`
    INSERT INTO strava_activities (strava_key, activity_hash, distance_km, credited_km, elapsed_time, activity_name, first_seen, is_baseline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(item.strava_key, item.activity_hash, item.distance_km, item.credited_km, item.elapsed_time, item.activity_name, item.first_seen, item.is_baseline);

  db.prepare('DELETE FROM deleted_activities WHERE id=?').run(id);

  // คำนวณ km ใหม่
  const participant = db.prepare('SELECT id FROM participants WHERE strava_key=?').get(item.strava_key);
  if (participant && !item.is_baseline) {
    const row = db.prepare(
      'SELECT COALESCE(SUM(COALESCE(credited_km, distance_km)),0) as km, COUNT(*) as cnt FROM strava_activities WHERE strava_key=? AND is_baseline=0'
    ).get(item.strava_key);
    const totalKm = Math.round(row.km * 100) / 100;
    db.prepare('UPDATE participants SET km=?,steps=?,activity_count=? WHERE id=?')
      .run(totalKm, Math.round(totalKm * 1350), row.cnt, participant.id);
  }
  res.json({ ok: true, message: 'กู้คืนสำเร็จ' });
});

// DELETE /api/adminpp/trash/:id — ลบถาวรออกจากถังขยะ
router.delete('/trash/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM deleted_activities WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

// DELETE /api/adminpp/trash — ล้างถังขยะทั้งหมด
router.delete('/trash', requireAdmin, (_req, res) => {
  const r = db.prepare('DELETE FROM deleted_activities').run();
  res.json({ ok: true, deleted: r.changes });
});

// ── Export CSV ────────────────────────────────────────────
router.get('/export', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT name,initials,age_group,km,steps,streak,weekly_km,activity_count FROM participants ORDER BY km DESC').all();
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
router.post('/snapshot', requireAdmin, (req, res) => {
  const seasonStart = db.prepare("SELECT value FROM project_settings WHERE key='season_start'").get()?.value || '2026-06-01';
  const now     = new Date();
  const start   = new Date(seasonStart + 'T00:00:00Z');
  const diffDays = Math.max(0, Math.floor((now - start) / 86400000));
  const weekNo   = Math.max(1, Math.ceil(diffDays / 7));

  // รับ weekNo override จาก body (กรณีต้องการถ่าย snapshot สัปดาห์ที่ระบุเอง)
  const targetWeek = Number(req.body?.week_no) || weekNo;
  const weekLabel  = `สัปดาห์ ${targetWeek}`;

  const participants = db.prepare(
    'SELECT id,name,initials,weekly_km FROM participants ORDER BY weekly_km DESC'
  ).all();

  db.transaction(() => {
    db.prepare('DELETE FROM weekly_snapshots WHERE week_no=?').run(targetWeek);
    const ins = db.prepare(
      'INSERT INTO weekly_snapshots (week_no,week_label,participant_id,name,initials,km,rank) VALUES (?,?,?,?,?,?,?)'
    );
    participants.forEach((p, i) => {
      ins.run(targetWeek, weekLabel, p.id, p.name, p.initials, p.weekly_km, i + 1);
    });
  })();

  const thaiNow = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');
  db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)')
    .run(thaiNow, 'snapshot', `Manual snapshot: week ${targetWeek} — ${participants.length} participants`);

  res.json({
    ok: true,
    week_no: targetWeek,
    week_label: weekLabel,
    participants: participants.length,
    message: `✅ บันทึกผล${weekLabel}แล้ว — ${participants.length} คน`,
  });
});

// ── Reset ─────────────────────────────────────────────────
router.post('/reset', requireAdmin, (_req, res) => {
  db.prepare('DELETE FROM sync_log').run();
  db.prepare('DELETE FROM weekly_snapshots').run();
  db.prepare('DELETE FROM strava_activities').run();
  db.prepare('UPDATE participants SET km=0,steps=0,streak=0,weekly_km=0,activity_count=0').run();
  res.json({ ok: true, message: 'รีเซ็ตข้อมูลการวิ่งแล้ว (ผู้เข้าร่วมยังอยู่)' });
});

// ── Season auto-compute ───────────────────────────────────
router.get('/seasons/compute', requireAdmin, (_req, res) => {
  const totalKm      = db.prepare('SELECT COALESCE(SUM(km),0) as v FROM participants').get().v;
  const participants = db.prepare('SELECT COUNT(*) as c FROM participants').get().c;
  const top          = db.prepare('SELECT name, km FROM participants ORDER BY km DESC LIMIT 1').get();
  const settingRow   = db.prepare("SELECT value FROM project_settings WHERE key='season_start'").get();
  const SEASON_START = settingRow?.value || process.env.SEASON_START || '2026-06-01';
  const now          = new Date().toISOString().slice(0,10);
  res.json({
    total_km:     Math.round(totalKm * 100) / 100,
    participants,
    top_km:       top?.km || 0,
    winner:       top?.name || '—',
    date_range:   `${SEASON_START} – ${now}`,
  });
});

// ── Gallery ───────────────────────────────────────────────
// GET /api/adminpp/gallery
router.get('/gallery', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT id, filename, caption, uploaded_at FROM gallery_images ORDER BY id DESC').all();
  res.json(rows);
});

// POST /api/adminpp/gallery  — body: { filename, data (base64), caption }
router.post('/gallery', requireAdmin, (req, res) => {
  const { filename, data, caption } = req.body;
  if (!filename || !data) return res.status(400).json({ ok: false, message: 'filename and data required' });
  if (!fs.existsSync(GALLERY_DIR)) fs.mkdirSync(GALLERY_DIR, { recursive: true });

  // Sanitize filename & prefix with timestamp to avoid collisions
  const safe  = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const final = `${Date.now()}_${safe}`;
  const base64Data = data.replace(/^data:[^;]+;base64,/, '');
  fs.writeFileSync(path.join(GALLERY_DIR, final), Buffer.from(base64Data, 'base64'));

  db.prepare('INSERT INTO gallery_images (filename, caption) VALUES (?, ?)').run(final, caption || '');
  res.json({ ok: true, filename: final });
});

// DELETE /api/adminpp/gallery/:id
router.delete('/gallery/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT filename FROM gallery_images WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, message: 'not found' });
  const filePath = path.join(GALLERY_DIR, row.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM gallery_images WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
