import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameToKey, nameKeys, parseLeaderboard, matchRows, MAX_WEEKLY_KM } from './weeklyImport.js';

test('nameToKey ใช้กฎเดียวกับ strava_key เดิม', () => {
  assert.equal(nameToKey('Piean P.'), 'piean_p');
  assert.equal(nameToKey('K. B.'), 'k_b');
  assert.equal(nameToKey('  กุลธิรัตน์   เ.  '), 'กุลธิรัตน์_เ');
  assert.equal(nameToKey('Mary Jane S.'), 'mary jane_s');
});

test('อ่านแบบคั่นด้วย tab (คัดลอกจากตาราง)', () => {
  const text = [
    'Rank\tAthlete\tDistance\tRuns\tLongest\tAvg Pace',
    '1\tPiean P.\t45.3 km\t5\t12.1 km\t6:30 /km',
    '2\tK. B.\t1,020.5 km\t4\t9.0 km\t7:10 /km',
  ].join('\n');
  assert.deepEqual(parseLeaderboard(text), [
    { name: 'Piean P.', km: 45.3 },
    { name: 'K. B.', km: 1020.5 },
  ]);
});

test('อ่านแบบแต่ละช่องอยู่คนละบรรทัด', () => {
  const text = '1\nPiean P.\n45.3 km\n5\n12.1 km\n6:30 /km\n2\nสุชา จ.\n30 km\n3\n10 km\n';
  assert.deepEqual(parseLeaderboard(text), [
    { name: 'Piean P.', km: 45.3 },
    { name: 'สุชา จ.', km: 30 },
  ]);
});

test('อ่านแบบบรรทัดเดียว ชื่อ + ระยะ (เว้นวรรค/ลูกน้ำ/มีอันดับนำหน้า)', () => {
  const text = 'Piean P. 45.3 km\n2. K. B., 12\nสุชา จ.\t8.5';
  assert.deepEqual(parseLeaderboard(text), [
    { name: 'Piean P.', km: 45.3 },
    { name: 'K. B.', km: 12 },
    { name: 'สุชา จ.', km: 8.5 },
  ]);
});

test('ใช้ช่อง km แรกเป็นระยะรวม ข้ามช่อง Longest และข้ามแถวที่ไม่มีระยะ', () => {
  const rows = parseLeaderboard('Piean P.\t45.3 km\t12.1 km\nคนไม่มีระยะ\n');
  assert.deepEqual(rows, [{ name: 'Piean P.', km: 45.3 }]);
});

const participants = [
  { id: 1, name: 'ปีเอี้ยน พ.', strava_key: 'piean_p' },
  { id: 2, name: 'กุลธิรัตน์ เ.', strava_key: 'กุลธิรัตน์_เ' },
  { id: 3, name: 'คนไม่มาวาง', strava_key: 'no_show' },
  { id: 4, name: 'กรอก km เอง', strava_key: null },
];

test('matchRows: จับคู่ด้วย strava_key, แยกชื่อที่ไม่พบ, รายงานคนที่ขาด', () => {
  const r = matchRows([
    { name: 'Piean P.', km: 45.3 },
    { name: 'กุลธิรัตน์ เ.', km: 20 },
    { name: 'Stranger X.', km: 5 },
  ], participants);
  assert.deepEqual(r.matched.map(m => [m.id, m.km]), [[1, 45.3], [2, 20]]);
  assert.equal(r.unmatched.length, 1);
  assert.equal(r.unmatched[0].name, 'Stranger X.');
  assert.deepEqual(r.missing, ['คนไม่มาวาง']);   // คนที่ไม่มี strava_key ไม่ถูกนับว่าขาด
});

test('matchRows: ระยะผิดปกติไม่ถูกนำเข้า, ชื่อซ้ำใช้แถวหลังสุด', () => {
  const r = matchRows([
    { name: 'Piean P.', km: MAX_WEEKLY_KM + 1 },
    { name: 'กุลธิรัตน์ เ.', km: 10 },
    { name: 'กุลธิรัตน์ เ.', km: 12 },
  ], participants);
  assert.deepEqual(r.matched.map(m => [m.id, m.km]), [[2, 12]]);
  assert.match(r.unmatched[0].reason, /ผิดปกติ/);
});

test('ตารางจริงจาก Strava (ชื่อเต็ม, หัวตาราง Elev. Gain, หน่วย m และ /km)', () => {
  const text = [
    'Rank\tAthlete\tDistance\tRuns\tLongest\tAvg. Pace\tElev. Gain',
    '1\tMu Mu\t4.0 km\t1\t4.0 km\t10:36 /km\t14 m',
    '2\tJoy Bunkaew\t3.2 km\t1\t3.2 km\t9:15 /km\t10 m',
  ].join('\n');
  assert.deepEqual(parseLeaderboard(text), [
    { name: 'Mu Mu', km: 4 },
    { name: 'Joy Bunkaew', km: 3.2 },
  ]);
});

test('นามสกุลหลายคำ: ลองแยกที่ช่องว่างแรกด้วย', () => {
  assert.deepEqual(nameKeys('Joy Bun Kaew'), ['joy bun_k', 'joy_b']);
  const r = matchRows([{ name: 'Joy Bun Kaew', km: 3 }], [{ id: 9, name: 'จอย', strava_key: 'joy_b' }]);
  assert.equal(r.matched[0].id, 9);
});
