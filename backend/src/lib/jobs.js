// งานตามเวลา — VPS ใช้ node-cron (server.js), Cloudflare ใช้ Cron Triggers (worker.js)
//
//   ทุก 6 ชม. (00:00 06:00 12:00 18:00 เวลาไทย)  → ขยับสถานะ season แล้ว sync
//   ทุกคืน 23:59 เวลาไทย                         → sync + backup รายวัน + (วันอาทิตย์) บันทึกผลรายสัปดาห์
import { runSeasonLifecycle, takeWeeklySnapshot } from './seasonLifecycle.js';
import { syncStrava } from './stravaSync.js';
import { todayBkk, dayOfWeek } from './time.js';

export async function runSixHourly(label = 'cron-6h') {
  // ขยับสถานะ season ก่อน sync เสมอ — sync จะได้คำนวณ km ตามช่วงวันของ season ล่าสุด
  try { await runSeasonLifecycle(label); }
  catch (err) { console.error(`[season:${label}] error:`, err.message); }
  try {
    const r = await syncStrava({ label });
    if (!r.ok) console.log(`[${label}] sync skipped: ${r.message}`);
  } catch (err) { console.error(`[${label}] sync error:`, err.message); }
}

export async function runDaily({ label = 'cron-daily', dailyBackup } = {}) {
  console.log(`[${label}] end-of-day sync + backup...`);
  try {
    const r = await syncStrava({ label });
    if (!r.ok) console.log(`[${label}] sync skipped: ${r.message}`);
  } catch (err) { console.error(`[${label}] sync error:`, err.message); }

  if (dailyBackup) {
    try { await dailyBackup(); } catch (err) { console.error(`[${label}] backup error:`, err.message); }
  }

  // วันอาทิตย์ (เวลาไทย) → บันทึกผลรายสัปดาห์ (ข้ามเองถ้า season ปิดอยู่หรือยังไม่เริ่ม)
  if (dayOfWeek(todayBkk()) === 0) {
    try {
      const r = await takeWeeklySnapshot({ label: 'cron-sunday' });
      console.log(`[${label}] Sunday weekly snapshot:`, r.ok ? `week ${r.weekNo}` : `skip (${r.message})`);
    } catch (err) { console.error(`[${label}] snapshot error:`, err.message); }
  }
}
