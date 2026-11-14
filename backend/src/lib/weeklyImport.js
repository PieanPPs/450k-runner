// นำเข้าสรุประยะทางรายสัปดาห์ (แผนสำรองเมื่อดึงกิจกรรมจาก Strava Club ไม่ได้)
//
// แอดมินคัดลอกตาราง Club Leaderboard ของชมรมบน Strava มาวาง → อ่านชื่อ + ระยะทางต่อคน
// แล้วบันทึกเป็นกิจกรรมสรุป 1 แถวต่อคนต่อสัปดาห์ใน strava_activities (hash = WEEKLY|<วันเริ่มสัปดาห์>|<strava_key>)
// ระบบเดิม (km รวม, ด่านรายสัปดาห์, leaderboard) จึงทำงานต่อได้โดยไม่ต้องแก้
//
// ฟังก์ชันในไฟล์นี้เป็นฟังก์ชันล้วน (ไม่แตะ DB) เพื่อทดสอบได้
import { makeStravaKey } from '../strava/client.js';

export const MAX_WEEKLY_KM = 300;   // เกินนี้ถือว่าผิดปกติ (พิมพ์ผิด/อ่านผิดคอลัมน์) — ไม่นำเข้า

const KM_CELL = /^([\d,]*\d(?:\.\d+)?)\s*km$/i;
const SKIP_CELL = /^(#?\d+[.)]?|[\d,.]+\s*(m|ft)|\d+[:'’]\d.*|\d+\s*(h|hr|min|s)\b.*|.*\/\s*(km|mi))$/i;
const HEADER_WORDS = new Set([
  'rank', 'athlete', 'name', 'distance', 'runs', 'run', 'activities', 'longest', 'avg pace', 'avg. pace', 'pace',
  'elev gain', 'elevation', 'elev', 'time', 'moving time', 'total running time', 'climbing', 'member', 'members',
  'อันดับ', 'ชื่อ', 'ระยะทาง', 'ครั้ง', 'last week\'s leaders', 'this week\'s leaders',
]);

/** 'Piean P.' → 'piean_p' (กฎเดียวกับ strava_key ตอน sync จาก Club เดิม) */
export function nameToKey(name) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim();
  const i = clean.lastIndexOf(' ');
  return i < 0 ? makeStravaKey(clean, '') : makeStravaKey(clean.slice(0, i), clean.slice(i + 1));
}

const toKm = (s) => Number(String(s).replace(/,/g, ''));

/**
 * อ่านข้อความที่คัดลอกจากตาราง leaderboard → [{ name, km }]
 * รองรับทั้งแบบแต่ละช่องคั่นด้วย tab / ขึ้นบรรทัดใหม่ทีละช่อง และแบบ "ชื่อ 45.3 km" หรือ "ชื่อ,45.3" บรรทัดเดียว
 * ใช้ช่อง "xx km" ช่องแรกหลังชื่อเป็นระยะทางรวม (ช่อง km ถัดไปเช่น Longest ถูกข้าม)
 */
export function parseLeaderboard(text) {
  const rows = [];
  let cur = null;
  const startRow = (name) => { cur = { name, km: null }; rows.push(cur); };

  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let cells = line.split(/\t+/).map(c => c.trim()).filter(Boolean);

    // บรรทัดเดียวไม่มี tab: "ชื่อ 45.3 km" / "1 ชื่อ, 45.3"
    if (cells.length === 1) {
      const m = /^(?:#?\d+[.)]?\s+)?(.+?)[\s,]+([\d,]*\d(?:\.\d+)?)\s*(?:km)?$/i.exec(cells[0]);
      if (m && /\p{L}/u.test(m[1]) && !KM_CELL.test(cells[0])) cells = [m[1].replace(/[,\s]+$/, ''), `${m[2]} km`];
    }

    // "ชื่อ<tab>8.5" (สองช่อง ช่องหลังเป็นตัวเลขเปล่า) → ถือเป็นระยะทาง
    if (cells.length === 2 && /^[\d,]*\d(?:\.\d+)?$/.test(cells[1])) cells[1] += ' km';

    for (const cell of cells) {
      const km = KM_CELL.exec(cell);
      if (km) { if (cur && cur.km == null) cur.km = toKm(km[1]); continue; }
      if (SKIP_CELL.test(cell)) continue;
      if (HEADER_WORDS.has(cell.toLowerCase())) continue;
      if (!/\p{L}/u.test(cell)) continue;
      startRow(cell.replace(/^#?\d+[.)]?\s+/, ''));
    }
  }
  return rows.filter(r => r.km != null && Number.isFinite(r.km));
}

/**
 * จับคู่แถวกับผู้เข้าร่วมด้วย strava_key
 * participants: [{ id, name, strava_key }]
 * คืน { matched: [{ key, id, participantName, name, km }], unmatched: [{ name, km, reason }], missing: [participantName] }
 *   unmatched = ชื่อที่หาผู้เข้าร่วมไม่เจอ, หรือ km ผิดปกติ (<0 หรือ > MAX_WEEKLY_KM)
 *   missing   = ผู้เข้าร่วมที่ผูก strava_key แต่ไม่อยู่ในข้อมูลที่วาง (จะไม่ได้ km สัปดาห์นั้น)
 * ชื่อซ้ำ (key เดียวกัน) ใช้แถวหลังสุด
 */
export function matchRows(rows, participants) {
  const byKey = new Map(participants.filter(p => p.strava_key).map(p => [p.strava_key.toLowerCase(), p]));
  const matched = new Map();
  const unmatched = [];
  for (const r of rows) {
    const key = nameToKey(r.name);
    const p = byKey.get(key);
    if (!p) { unmatched.push({ name: r.name, km: r.km, reason: 'ไม่พบผู้เข้าร่วมที่ผูกชื่อนี้' }); continue; }
    if (r.km < 0 || r.km > MAX_WEEKLY_KM) {
      unmatched.push({ name: r.name, km: r.km, reason: `ระยะทางผิดปกติ (เกิน ${MAX_WEEKLY_KM} กม.)` });
      continue;
    }
    matched.set(p.strava_key, { key: p.strava_key, id: p.id, participantName: p.name, name: r.name, km: Math.round(r.km * 100) / 100 });
  }
  const missing = participants.filter(p => p.strava_key && !matched.has(p.strava_key)).map(p => p.name);
  return { matched: [...matched.values()], unmatched, missing };
}

export const weeklyHash = (weekStart, key) => `WEEKLY|${weekStart}|${key}`;
export const weeklyHashPrefix = (weekStart) => `WEEKLY|${weekStart}|%`;
