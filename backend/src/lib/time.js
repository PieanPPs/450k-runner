// เวลาไทย (Asia/Bangkok) — เซิร์ฟเวอร์ทั้ง VPS (Docker) และ Cloudflare รันเป็น UTC

/** 'YYYY-MM-DD HH:MM:SS' เวลาไทยตอนนี้ */
export const thaiNow = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace('T', ' ');

/** 'YYYY-MM-DD' วันนี้ตามเวลาไทย */
export const todayBkk = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });

export function addDays(day, n) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0=อาทิตย์ … 6=เสาร์ ของวันที่ 'YYYY-MM-DD' */
export const dayOfWeek = (day) => new Date(day + 'T12:00:00Z').getUTCDay();

/** วันจันทร์ของสัปดาห์ (ปฏิทินจันทร์–อาทิตย์ แบบ Strava) */
export function mondayOf(day) {
  const dow = dayOfWeek(day);
  return addDays(day, -(dow === 0 ? 6 : dow - 1));
}
