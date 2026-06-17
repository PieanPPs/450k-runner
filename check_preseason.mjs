import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Database = require('/app/node_modules/better-sqlite3');
const db = new Database('/app/data/450k.sqlite');

console.log('=== PRE-SEASON READINESS CHECK ===\n');

// 1. สรุปภาพรวม
const total = db.prepare('SELECT COUNT(*) as n, ROUND(SUM(distance_km),2) as km FROM strava_activities WHERE is_baseline=0').get();
const pCount = db.prepare('SELECT COUNT(*) as n FROM participants').get();
console.log(`📊 ภาพรวม: ${pCount.n} คน | ${total.n} กิจกรรม | ${total.km} km รวม`);

// 2. km รายคน
console.log('\n--- km รายคน ---');
const perPerson = db.prepare(`
  SELECT p.name, p.strava_key,
    ROUND(SUM(COALESCE(a.credited_km, a.distance_km)),2) AS km,
    COUNT(*) AS acts
  FROM strava_activities a
  JOIN participants p ON p.strava_key = a.strava_key
  WHERE a.is_baseline=0
  GROUP BY a.strava_key ORDER BY km DESC
`).all();
perPerson.forEach(p => console.log(`  ${p.name.padEnd(25)} ${String(p.km).padStart(6)} km  (${p.acts} acts)`));

// 3. Potential duplicates: same person, ABS(distance)<0.1, ABS(elapsed)<=60
console.log('\n--- 🔴 Potential Duplicates (distance ±0.1km, elapsed ±60s) ---');
const dups = db.prepare(`
  SELECT a.strava_key, p.name,
    a.id as id1, a.activity_name as name1, ROUND(a.distance_km,3) as dist1, a.elapsed_time as el1, a.first_seen as seen1,
    b.id as id2, b.activity_name as name2, ROUND(b.distance_km,3) as dist2, b.elapsed_time as el2, b.first_seen as seen2
  FROM strava_activities a
  JOIN strava_activities b ON b.strava_key=a.strava_key AND b.id>a.id
  LEFT JOIN participants p ON p.strava_key=a.strava_key
  WHERE a.is_baseline=0 AND b.is_baseline=0
    AND ABS(a.distance_km - b.distance_km) < 0.1
    AND ABS(a.elapsed_time - b.elapsed_time) <= 60
  ORDER BY a.strava_key, a.first_seen
`).all();
if (dups.length === 0) console.log('  ✅ ไม่พบ');
else dups.forEach(d => {
  console.log(`  ⚠️  ${d.name} (${d.strava_key})`);
  console.log(`     id ${d.id1}: "${d.name1}" ${d.dist1}km ${d.el1}s ${d.seen1}`);
  console.log(`     id ${d.id2}: "${d.name2}" ${d.dist2}km ${d.el2}s ${d.seen2}`);
});

// 4. คนวิ่งหลายรอบวันเดียว (>3 activities ต่อวัน)
console.log('\n--- 🟡 วิ่งเยอะผิดปกติ (>3 activities ใน sync วันเดียวกัน) ---');
const manyPerDay = db.prepare(`
  SELECT p.name, a.strava_key, substr(a.first_seen,1,10) as day, COUNT(*) as cnt,
    ROUND(SUM(a.distance_km),2) as total_km
  FROM strava_activities a
  LEFT JOIN participants p ON p.strava_key=a.strava_key
  WHERE a.is_baseline=0
  GROUP BY a.strava_key, day
  HAVING cnt > 3
  ORDER BY cnt DESC
`).all();
if (manyPerDay.length === 0) console.log('  ✅ ไม่พบ');
else manyPerDay.forEach(r => console.log(`  ⚠️  ${r.name} วัน ${r.day}: ${r.cnt} กิจกรรม รวม ${r.total_km} km`));

// 5. GPS ลืมปิด (elapsed > 2 ชั่วโมง = 7200s)
console.log('\n--- 🟡 Elapsed นานผิดปกติ (>2 ชั่วโมง) ---');
const longElapsed = db.prepare(`
  SELECT a.id, p.name, a.activity_name, ROUND(a.distance_km,2) as km,
    a.elapsed_time, ROUND(a.elapsed_time/3600.0,1) as hours,
    ROUND(a.distance_km/(a.elapsed_time/60.0)*1.0,2) as pace_min_km
  FROM strava_activities a
  LEFT JOIN participants p ON p.strava_key=a.strava_key
  WHERE a.is_baseline=0 AND a.elapsed_time > 7200
  ORDER BY a.elapsed_time DESC
`).all();
if (longElapsed.length === 0) console.log('  ✅ ไม่พบ');
else longElapsed.forEach(r => console.log(`  ⚠️  id ${r.id} ${r.name} "${r.activity_name}" ${r.km}km ${r.hours}h pace:${r.pace_min_km}min/km`));

// 6. Pace ผิดปกติ (ใช้ elapsed_time) — เร็วเกิน 4 min/km หรือช้าเกิน 35 min/km
console.log('\n--- 🟡 Pace ผิดปกติ (elapsed-based, <4 หรือ >35 min/km) ---');
const badPace = db.prepare(`
  SELECT a.id, p.name, a.activity_name, ROUND(a.distance_km,2) as km,
    a.elapsed_time,
    ROUND((a.elapsed_time/60.0)/a.distance_km, 1) as pace
  FROM strava_activities a
  LEFT JOIN participants p ON p.strava_key=a.strava_key
  WHERE a.is_baseline=0 AND a.distance_km > 0
    AND ((a.elapsed_time/60.0)/a.distance_km < 4 OR (a.elapsed_time/60.0)/a.distance_km > 35)
  ORDER BY pace
`).all();
if (badPace.length === 0) console.log('  ✅ ไม่พบ');
else badPace.forEach(r => console.log(`  ⚠️  id ${r.id} ${r.name} "${r.activity_name}" ${r.km}km ${r.elapsed_time}s pace:${r.pace}min/km`));

// 7. ถังขยะ (deleted_activities)
const trashCount = db.prepare('SELECT COUNT(*) as n FROM deleted_activities').get();
console.log(`\n--- 🗑️  ถังขยะ: ${trashCount.n} รายการ (ป้องกัน re-insert แล้ว) ---`);

console.log('\n=== สรุป ===');
const issues = dups.length + manyPerDay.length + longElapsed.length + badPace.length;
if (issues === 0) console.log('✅ ทุกอย่างโอเค พร้อมกด "ปิด Pre-Season & บันทึก" ได้เลย');
else console.log(`⚠️  พบ ${issues} จุดที่ควรตรวจก่อนกด Pre-Season`);
