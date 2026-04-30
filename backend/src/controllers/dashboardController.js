import { db } from '../db/connection.js';

export function getParticipants(_req, res) {
  const rows = db.prepare('SELECT id,name,initials,km,steps,streak,weekly_km as weeklyKm,activity_count as activityCount,age_group as ageGroup FROM participants ORDER BY id').all();
  res.json(rows);
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
  res.json({ metric, rows });
}

export function getWeekly(_req, res) {
  const rows = db.prepare('SELECT week,km,steps FROM weekly_data ORDER BY id').all();
  res.json(rows);
}

export function getSeasons(_req, res) {
  const rows = db.prepare('SELECT name,subtitle,date_range as dateRange,status,top_km as topKm,total_km as totalKm,participants,winner FROM seasons ORDER BY id').all();
  res.json(rows);
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
      id: r.participant_id, name: r.name, initials: r.initials, km: r.km, rank: r.rank
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
  const goalKm         = participantCount * 450;
  const pct            = goalKm > 0 ? Math.min(100, (totalKm / goalKm) * 100) : 0;
  res.json({
    totalKm: Math.round(totalKm * 10) / 10,
    totalWeeklyKm: Math.round(totalWeeklyKm * 10) / 10,
    totalActivities,
    participantCount,
    goalKm,
    pct: Math.round(pct * 10) / 10,
    topName: top?.name || '—',
    topKm: top?.km || 0,
  });
}

export function getGallery(_req, res) {
  const rows = db.prepare('SELECT filename, caption, uploaded_at FROM gallery_images ORDER BY id DESC').all();
  res.json(rows);
}
