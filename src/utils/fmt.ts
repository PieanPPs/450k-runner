/**
 * แสดง km ให้ตรงกับ Strava: ทศนิยมสูงสุด 2 ตำแหน่ง ตัดศูนย์ท้ายออก
 * 54.40 → "54.4"   3.51 → "3.51"   54.00 → "54"   2.45 → "2.45"
 */
export const fmtKm = (v: number): string => String(parseFloat(v.toFixed(2)));
