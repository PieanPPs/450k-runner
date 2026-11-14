// นำเข้าสรุประยะทางรายสัปดาห์ (แผนสำรองเมื่อดึงกิจกรรมจาก Strava Club ไม่ได้)
//
// แอดมินคัดลอกตาราง Club Leaderboard ของชมรมบน Strava มาวาง → อ่านชื่อ + ระยะทางต่อคน
// แล้วบันทึกเป็นกิจกรรมสรุป 1 แถวต่อคนต่อสัปดาห์ใน strava_activities (hash = WEEKLY|<วันเริ่มสัปดาห์>|<strava_key>)
// ระบบเดิม (km รวม, ด่านรายสัปดาห์, leaderboard) จึงทำงานต่อได้โดยไม่ต้องแก้
//
// ฟังก์ชันในไฟล์นี้เป็นฟังก์ชันล้วน (ไม่แตะ DB) เพื่อทดสอบได้
import { makeStravaKey } from '../strava/client.js';
import { PACE_CAP_MIN_PER_KM } from './paceCap.js';

export const MAX_WEEKLY_KM = 300;   // เกินนี้ถือว่าผิดปกติ (พิมพ์ผิด/อ่านผิดคอลัมน์) — ไม่นำเข้า
const MIN_PACE_MIN_PER_KM = 3.5;    // เร็วกว่านี้ = ปั่น/ขับรถ (เกณฑ์เดียวกับตอน sync จาก Club)

const PACE_CELL = /^(\d+):(\d{2})\s*\/\s*km$/i;
const INT_CELL = /^\d+$/;
const KM_CELL = /^([\d,]*\d(?:\.\d+)?)\s*km$/i;
const SKIP_CELL = /^(#?\d+[.)]?|[\d,.]+\s*(m|ft)|\d+[:'’]\d.*|\d+\s*(h|hr|min|s)\b.*|.*\/\s*(km|mi))$/i;
const HEADER_WORDS = new Set([
  'rank', 'athlete', 'name', 'distance', 'runs', 'run', 'activities', 'longest', 'avg pace', 'avg. pace', 'pace',
  'elev gain', 'elev. gain', 'elevation', 'elev', 'avg pace', 'time', 'moving time', 'total running time', 'climbing', 'member', 'members',
  'อันดับ', 'ชื่อ', 'ระยะทาง', 'ครั้ง', 'last week\'s leaders', 'this week\'s leaders',
]);

/** 'Piean P.' → 'piean_p' (กฎเดียวกับ strava_key ตอน sync จาก Club เดิม) */
export function nameToKey(name) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim();
  const i = clean.lastIndexOf(' ');
  return i < 0 ? makeStravaKey(clean, '') : makeStravaKey(clean.slice(0, i), clean.slice(i + 1));
}

/**
 * key ที่เป็นไปได้ของชื่อหนึ่ง: แยกชื่อ/นามสกุลที่ช่องว่างสุดท้าย (ปกติ) และที่ช่องว่างแรก
 * (กรณีนามสกุลมีหลายคำ เช่น "Joy Bun Kaew" ที่ Strava เก็บ firstname=Joy lastname="Bun Kaew")
 */
export function nameKeys(name) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim();
  const out = new Set([nameToKey(clean)]);
  const i = clean.indexOf(' ');
  if (i > 0) out.add(makeStravaKey(clean.slice(0, i), clean.slice(i + 1)));
  return [...out];
}

const toKm = (s) => Number(String(s).replace(/,/g, ''));

/**
 * อ่านข้อความที่คัดลอกจากตาราง leaderboard → [{ name, km, runs?, paceSec? }]
 * รองรับทั้งแบบแต่ละช่องคั่นด้วย tab / ขึ้นบรรทัดใหม่ทีละช่อง และแบบ "ชื่อ 45.3 km" หรือ "ชื่อ,45.3" บรรทัดเดียว
 * ใช้ช่อง "xx km" ช่องแรกหลังชื่อเป็นระยะทางรวม (ช่อง km ถัดไปเช่น Longest ถูกข้าม)
 * Runs (จำนวนครั้ง) และ Avg. Pace (วินาที/กม.) อ่านเมื่อเจอหัวตาราง "Runs" / "Avg. Pace" เท่านั้น
 * เพื่อไม่ให้เลขอันดับของแถวถัดไปถูกอ่านเป็นจำนวนครั้ง
 */
export function parseLeaderboard(text) {
  const rows = [];
  let cur = null;
  let hasRuns = false, hasPace = false;
  const startRow = (name, line) => { cur = { name, km: null, line }; rows.push(cur); };

  for (const [lineNo, raw] of String(text || '').split(/\r?\n/).entries()) {
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

    // แถวแบบตาราง (หลายช่องในบรรทัดเดียว) : ช่องตัวเลข/pace หลังระยะทางของแถวเดียวกันคือ Runs / Avg. Pace แม้ไม่มีหัวตาราง
    const tabular = cells.length >= 3;

    for (const cell of cells) {
      const km = KM_CELL.exec(cell);
      if (km) { if (cur && cur.km == null) cur.km = toKm(km[1]); continue; }
      const mine = cur && cur.km != null && (tabular && cur.line === lineNo);
      if ((hasRuns || mine) && INT_CELL.test(cell) && cur && cur.km != null && cur.runs === undefined && cur.paceSec === undefined) {
        cur.runs = Number(cell); continue;
      }
      const pace = PACE_CELL.exec(cell);
      if (pace) {
        if ((hasPace || mine) && cur && cur.km != null && cur.paceSec === undefined) cur.paceSec = Number(pace[1]) * 60 + Number(pace[2]);
        continue;
      }
      if (SKIP_CELL.test(cell)) continue;
      const lower = cell.toLowerCase();
      if (HEADER_WORDS.has(lower)) {
        if (lower === 'runs') hasRuns = true;
        if (lower === 'avg. pace' || lower === 'avg pace') hasPace = true;
        continue;
      }
      if (!/\p{L}/u.test(cell)) continue;
      startRow(dedupeName(cell.replace(/^#?\d+[.)]?\s+/, '')), lineNo);
    }
  }
  return rows.filter(r => r.km != null && Number.isFinite(r.km)).map(({ line, ...r }) => r);
}

/**
 * Strava ใส่ชื่อซ้ำตอนคัดลอกบางแถว (ข้อความแทนรูปโปรไฟล์ + ชื่อ) → "วันเพ็ญ โคตรวิชัย วันเพ็ญ โคตรวิชัย"
 * ยุบเมื่อมี ≥ 4 คำและครึ่งแรก = ครึ่งหลัง ("Mu Mu" 2 คำ ยังเป็นชื่อจริง ไม่ยุบ)
 */
export function dedupeName(name) {
  const t = String(name || '').replace(/\s+/g, ' ').trim().split(' ');
  const h = t.length / 2;
  return t.length >= 4 && Number.isInteger(h) && t.slice(0, h).join(' ') === t.slice(h).join(' ') ? t.slice(0, h).join(' ') : t.join(' ');
}

/** คำเตือนตอนดูตัวอย่าง (ไม่บล็อกการนำเข้า) — pace/จำนวนครั้งที่ดูผิดปกติ */
function warningFor(r) {
  if (r.paceSec != null && r.paceSec > 0) {
    const pace = r.paceSec / 60;
    if (pace < MIN_PACE_MIN_PER_KM) return `pace เร็วผิดปกติ (< ${MIN_PACE_MIN_PER_KM} นาที/กม.) อาจเป็นการปั่น/ขับรถ`;
    if (pace > PACE_CAP_MIN_PER_KM) return `pace ช้าเกิน ${PACE_CAP_MIN_PER_KM} นาที/กม. (เกณฑ์ปกติของระบบไม่นับ)`;
  }
  if (r.runs === 0 && r.km > 0) return 'มีระยะแต่จำนวนครั้ง = 0';
  return '';
}

/**
 * จับคู่แถวกับผู้เข้าร่วมด้วย strava_key
 * participants: [{ id, name, strava_key }]
 * คืน { matched: [{ key, id, participantName, name, km, runs?, paceSec?, warning? }], unmatched: [{ name, km, reason }], missing: [participantName] }
 *   unmatched = ชื่อที่หาผู้เข้าร่วมไม่เจอ, หรือ km ผิดปกติ (<0 หรือ > MAX_WEEKLY_KM)
 *   missing   = ผู้เข้าร่วมที่ผูก strava_key แต่ไม่อยู่ในข้อมูลที่วาง (จะไม่ได้ km สัปดาห์นั้น)
 * ชื่อซ้ำ (key เดียวกัน) ใช้แถวหลังสุด
 */
export function matchRows(rows, participants) {
  const byKey = new Map(participants.filter(p => p.strava_key).map(p => [p.strava_key.toLowerCase(), p]));
  const matched = new Map();
  const unmatched = [];
  for (const r of rows) {
    const p = nameKeys(r.name).map(k => byKey.get(k)).find(Boolean);
    if (!p) { unmatched.push({ name: r.name, km: r.km, reason: 'ไม่พบผู้เข้าร่วมที่ผูกชื่อนี้' }); continue; }
    if (r.km < 0 || r.km > MAX_WEEKLY_KM) {
      unmatched.push({ name: r.name, km: r.km, reason: `ระยะทางผิดปกติ (เกิน ${MAX_WEEKLY_KM} กม.)` });
      continue;
    }
    const m = { key: p.strava_key, id: p.id, participantName: p.name, name: r.name, km: Math.round(r.km * 100) / 100 };
    if (r.runs != null) m.runs = r.runs;
    if (r.paceSec != null) m.paceSec = r.paceSec;
    const warning = warningFor(r);
    if (warning) m.warning = warning;
    matched.set(p.strava_key, m);
  }
  const missing = participants.filter(p => p.strava_key && !matched.has(p.strava_key)).map(p => p.name);
  return { matched: [...matched.values()], unmatched, missing };
}

export const weeklyHash = (weekStart, key) => `WEEKLY|${weekStart}|${key}`;
export const weeklyHashPrefix = (weekStart) => `WEEKLY|${weekStart}|%`;
