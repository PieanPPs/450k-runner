// ด่านรายสัปดาห์ (gamification) — คำนวณจากกิจกรรมโดยตรง ไม่ต้องเก็บสถานะ/ไม่ต้องพึ่ง cron
//
//   ด่านที่ N = ช่วง 7 วันนับจากวันเริ่ม season (วันเริ่ม + 7(N-1) … + 7N-1)
//   season 91 วัน (เช่น 1 เม.ย.–30 มิ.ย.) = 13 ด่านพอดี
//   วันที่เหลือไม่ครบสัปดาห์ (เช่น 92 วัน = 13 ด่าน + 1 วัน) รวมเข้าด่านสุดท้าย — ไม่แยกเป็นด่านสั้นที่ใช้เป้าเต็ม
//   ผ่านด่าน = km รวมในช่วงนั้นถึงเป้าของตัวเอง (participant_targets หรือค่ากลาง)
//
// หมายเหตุ: เป้าที่แก้กลาง season มีผลย้อนหลัง เพราะผลทุกด่านคำนวณใหม่ทุกครั้ง
import { db } from './db.js';
import { loadSettings, seasonStartOf, seasonEndOf, isClosedIn } from './season.js';
import { todayBkk, addDays } from './time.js';
import { maskName } from '../controllers/dashboardController.js';

export const DEFAULT_STAGE_TARGET_KM = 12;
const round1 = (n) => Math.round(n * 10) / 10;

/** ช่วงวันของแต่ละด่าน — ด่านสุดท้ายยาวถึงวันสิ้นสุด season (อาจยาวกว่า 7 วัน) */
export function stageWindows(start, end) {
  if (!start || !end || end < start) return [];
  const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  const total = Math.max(1, Math.floor(days / 7));
  return Array.from({ length: total }, (_, i) => {
    const s = addDays(start, i * 7);
    const e = i === total - 1 ? end : addDays(start, i * 7 + 6);
    return { n: i + 1, start: s, end: e };
  });
}

/** ด่านปัจจุบัน: 0 = ยังไม่เริ่ม, total+1 = จบแล้ว */
export function currentStageNo(windows, today) {
  if (!windows.length || today < windows[0].start) return 0;
  const w = windows.find(x => today >= x.start && today <= x.end);
  return w ? w.n : windows.length + 1;
}

/**
 * ฟังก์ชันล้วน — รับข้อมูลดิบ คืนสถานะด่านของทุกคน
 * kmRows: [{ participant_id, stage, km }]   participants: [{ id, name, initials }]
 * targets: Map<participant_id, km>
 * หน้าสาธารณะไม่ส่งสถานะ "พลาด" (ด่านที่จบแล้วแต่ไม่ผ่านถูกส่งเป็น false เฉย ๆ ไม่ต่างจากยังไม่ถึง)
 */
export function buildStages({ start, end, today, closed, defaultTarget, participants, kmRows, targets }) {
  const windows = stageWindows(start, end);
  const current = closed ? windows.length + 1 : currentStageNo(windows, today);
  const kmBy = new Map();
  for (const r of kmRows) {
    // วันที่เหลือท้าย season (เกินด่านสุดท้าย) นับเป็นของด่านสุดท้าย
    const key = `${r.participant_id}:${Math.min(r.stage, windows.length)}`;
    kmBy.set(key, (kmBy.get(key) || 0) + r.km);
  }

  const players = participants.map(p => {
    const target = targets.get(p.id) ?? defaultTarget;
    const passed = [];       // เลขด่านที่ผ่าน
    let run = 0, best = 0, ended = 0;
    for (const w of windows) {
      if (w.n >= current) break;                    // ด่านปัจจุบัน/อนาคตยังไม่ตัดสิน
      ended++;
      const ok = (kmBy.get(`${p.id}:${w.n}`) || 0) >= target;
      if (ok) { passed.push(w.n); run++; best = Math.max(best, run); } else run = 0;
    }
    const curKm = current >= 1 && current <= windows.length ? round1(kmBy.get(`${p.id}:${current}`) || 0) : 0;
    return {
      id: p.id, name: maskName(p.name), initials: p.initials,
      target,
      passed,
      passedCount: passed.length,
      streak: run,                                   // ผ่านติดกันถึงด่านล่าสุดที่จบ
      bestStreak: best,
      currentKm: curKm,
      currentPassed: current >= 1 && current <= windows.length && curKm >= target,
    };
  });

  players.sort((a, b) => b.passedCount - a.passedCount || b.streak - a.streak
    || (b.currentKm / b.target) - (a.currentKm / a.target) || a.id - b.id);

  const inStage = current >= 1 && current <= windows.length;
  return {
    active: windows.length > 0,
    phase: current === 0 ? 'upcoming' : inStage ? 'running' : 'ended',
    seasonStart: start, seasonEnd: end,
    totalStages: windows.length,
    currentStage: current,
    stages: windows.map(w => ({ ...w, status: w.n < current ? 'done' : w.n === current ? 'current' : 'upcoming' })),
    daysLeftInStage: inStage ? Math.round((new Date(windows[current - 1].end) - new Date(today)) / 86400000) + 1 : 0,
    defaultTarget,
    team: {
      players: players.length,
      passedCurrent: players.filter(p => p.currentPassed).length,
    },
    players,
  };
}

export async function getStages() {
  const s = await loadSettings();
  const start = seasonStartOf(s);
  const end = seasonEndOf(s);
  const closed = isClosedIn(s);
  const defaultTarget = Number(s.stage_target_default_km) > 0 ? Number(s.stage_target_default_km) : DEFAULT_STAGE_TARGET_KM;

  const [participants, targetRows, kmRows] = await Promise.all([
    db.prepare('SELECT id,name,initials FROM participants ORDER BY id').all(),
    db.prepare('SELECT participant_id, weekly_target_km FROM participant_targets').all(),
    start && end ? db.prepare(`
      SELECT p.id AS participant_id,
             CAST((julianday(substr(a.first_seen,1,10)) - julianday(?)) / 7 AS INTEGER) + 1 AS stage,
             SUM(COALESCE(a.credited_km, a.distance_km)) AS km
      FROM strava_activities a JOIN participants p ON p.strava_key = a.strava_key
      WHERE substr(a.first_seen,1,10) BETWEEN ? AND ? AND (a.is_baseline = 0 OR ? = 1)
      GROUP BY p.id, stage
    `).all(start, start, end, closed ? 1 : 0) : Promise.resolve([]),
  ]);

  return buildStages({
    start, end, today: todayBkk(), closed, defaultTarget, participants, kmRows,
    targets: new Map(targetRows.map(t => [t.participant_id, t.weekly_target_km])),
  });
}
