import { Router } from 'express';
import { db } from '../db/connection.js';
import { refreshAccessToken, getClubActivitiesByAthlete, calcStats } from '../strava/client.js';

const router = Router();

// POST /api/sync
router.post('/', async (_req, res) => {
  const SEASON_START = process.env.SEASON_START || '2026-06-01';
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

  for (const [stravaKey, data] of Object.entries(athleteMap)) {
    const { stravaName, firstname, lastname } = data;

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

    const stats = calcStats(data.activities, SEASON_START);
    db.prepare('UPDATE participants SET km=?,steps=?,streak=?,weekly_km=?,activity_count=? WHERE id=?')
      .run(Math.round(stats.km*10)/10, stats.steps, stats.streak, Math.round(stats.weeklyKm*10)/10, stats.activityCount, participant.id);

    synced++;
    results.push({ id:participant.id, name:participant.name, ok:true, km:stats.km.toFixed(1) });
  }

  try { rebuildWeeklyData(SEASON_START); } catch(e) { console.error('[sync] rebuildWeeklyData:', e.message); }
  const thaiNow = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' }).replace('T',' ');
  db.prepare('INSERT INTO sync_log (synced_at,status,message) VALUES (?,?,?)')
    .run(thaiNow, synced===total?'ok':'partial', JSON.stringify(results));

  res.json({ ok:true, synced, total, results });
});

// GET /api/sync/last
router.get('/last', (_req, res) => {
  const log = db.prepare('SELECT synced_at,status,message FROM sync_log ORDER BY id DESC LIMIT 1').get();
  res.json(log || { synced_at:null, status:'never', message:null });
});

// GET /api/sync/debug
router.get('/debug', async (_req, res) => {
  const CLUB_ID = process.env.STRAVA_CLUB_ID;
  const tokenRow = db.prepare('SELECT access_token FROM strava_tokens LIMIT 1').get();
  if (!tokenRow) return res.json({ error:'no token' });
  const url = `https://www.strava.com/api/v3/clubs/${CLUB_ID}/activities?per_page=5`;
  const r = await fetch(url, { headers:{ Authorization:`Bearer ${tokenRow.access_token}` } });
  const raw = await r.json();
  res.json({ status:r.status, count:Array.isArray(raw)?raw.length:'N/A', raw });
});

export default router;

function rebuildWeeklyData(seasonStart) {
  const ps = db.prepare('SELECT km,weekly_km FROM participants').all();
  const totalKm  = ps.reduce((s,p) => s+p.km, 0);
  const weeklyKm = ps.reduce((s,p) => s+p.weekly_km, 0);
  const start    = new Date(seasonStart);
  const diffDays = Math.max(0, Math.floor((new Date()-start)/86400000));
  const numWeeks = Math.max(1, Math.ceil(diffDays/7));
  const avgPerWeek = totalKm/numWeeks;
  db.prepare('DELETE FROM weekly_data').run();
  const ins = db.prepare('INSERT INTO weekly_data (week,km,steps) VALUES (?,?,?)');
  db.transaction(() => {
    for (let w=1; w<=numWeeks; w++) {
      const wKm = w===numWeeks ? weeklyKm : avgPerWeek;
      ins.run(`สัปดาห์ ${w}`, Math.round(wKm*10)/10, Math.round(wKm*1350));
    }
  })();
}