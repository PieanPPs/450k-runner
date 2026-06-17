// กำหนด pace สูงสุดที่ถือว่าเป็นการวิ่ง/เดินจริง (นาที/กม.)
// เกินกว่านี้ = เปิดแอพทิ้งไว้, กดหยุดพักแล้วเริ่มใหม่กลางทาง, วางมือถือไว้ ฯลฯ
// → ไม่ใช่ moving time จริง ระบบจะไม่นับ km ของกิจกรรมนี้โดยอัตโนมัติ
export const PACE_CAP_MIN_PER_KM = 20;

// คำนวณ pace (นาที/กม.) — ใช้ moving_time ถ้ามี ไม่งั้น fallback elapsed_time
export function computePace(distKm, elapsedSec, movingSec) {
  if (!distKm || distKm <= 0) return 0;
  const sec = movingSec > 0 ? movingSec : (elapsedSec || 0);
  return (sec / 60) / distKm;
}

// เช็คว่า pace เกิน cap หรือไม่ — ถ้าเกิน ไม่ sync กิจกรรมนี้เข้าระบบเลย (ข้ามตั้งแต่ insert)
// ใช้แทนการ auto-set credited_km=0 แบบเดิม เพื่อไม่ให้กิจกรรมที่ pace ผิดปกติเข้ามาอยู่ใน DB ตั้งแต่ต้น
export function exceedsPaceCap(distKm, elapsedSec, movingSec) {
  if (!distKm || distKm <= 0) return false;
  return computePace(distKm, elapsedSec, movingSec) > PACE_CAP_MIN_PER_KM;
}
