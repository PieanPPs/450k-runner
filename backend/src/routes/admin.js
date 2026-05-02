import { Router } from 'express';
import { db } from '../db/connection.js';
import { signToken, requireAdmin } from '../middleware/adminAuth.js';
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

// ── Export CSV ────────────────────────────────────────────
router.get('/export', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT name,initials,age_group,km,steps,streak,weekly_km,activity_count FROM participants ORDER BY km DESC').all();
  const header = 'ชื่อ,initials,กลุ่มอายุ,km,steps,streak,weekly_km,activity_count';
  const csv = [header, ...rows.map(r => `${r.name},${r.initials},${r.age_group === 'senior' ? '60+' : 'ทั่วไป'},${r.km},${r.steps},${r.streak},${r.weekly_km},${r.activity_count}`)].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="450k-export.csv"');
  res.send('﻿' + csv);
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
  const SEASON_START = process.env.SEASON_START || '2026-06-01';
  const now          = new Date().toISOString().slice(0,10);
  res.json({
    total_km:     Math.round(totalKm * 10) / 10,
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
