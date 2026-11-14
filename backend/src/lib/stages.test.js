import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageWindows, currentStageNo, buildStages } from './stages.js';
import { endAfterMonths } from './seasonLifecycle.js';

test('season 91 วัน = 13 ด่านพอดี', () => {
  const w = stageWindows('2027-04-01', '2027-06-30');
  assert.equal(w.length, 13);
  assert.deepEqual(w[12], { n: 13, start: '2027-06-24', end: '2027-06-30' });
});

test('season 1 มี.ค.–31 พ.ค. (92 วัน) = 13 ด่าน ด่านสุดท้าย 8 วัน ไม่มีด่านวันเดียว', () => {
  const end = endAfterMonths('2027-03-01', 3);
  assert.equal(end, '2027-05-31');
  const w = stageWindows('2027-03-01', end);
  assert.equal(w.length, 13);
  assert.deepEqual(w[12], { n: 13, start: '2027-05-24', end: '2027-05-31' });
  assert.equal(w[11].end, '2027-05-23');
});

test('ด่านต่อเนื่องไม่ซ้อน/ไม่ขาด และครอบคลุมทั้ง season', () => {
  for (const [s, e] of [['2027-03-01', '2027-05-31'], ['2027-03-01', '2027-05-29'], ['2027-03-01', '2027-03-03'], ['2027-03-01', '2027-03-08']]) {
    const w = stageWindows(s, e);
    assert.equal(w[0].start, s);
    assert.equal(w.at(-1).end, e);
    for (let i = 1; i < w.length; i++) {
      const prevEnd = new Date(w[i - 1].end + 'T12:00:00Z');
      const start = new Date(w[i].start + 'T12:00:00Z');
      assert.equal((start - prevEnd) / 86400000, 1);
    }
  }
});

test('season สั้นกว่า 7 วัน = 1 ด่าน, ข้อมูลไม่ครบ = ไม่มีด่าน', () => {
  assert.equal(stageWindows('2027-03-01', '2027-03-03').length, 1);
  assert.deepEqual(stageWindows('2027-03-01', '2027-02-01'), []);
  assert.deepEqual(stageWindows(null, '2027-05-31'), []);
});

test('currentStageNo: ก่อนเริ่ม / ระหว่าง / หลังจบ', () => {
  const w = stageWindows('2027-03-01', '2027-05-31');
  assert.equal(currentStageNo(w, '2027-02-28'), 0);
  assert.equal(currentStageNo(w, '2027-03-01'), 1);
  assert.equal(currentStageNo(w, '2027-03-08'), 2);
  assert.equal(currentStageNo(w, '2027-05-31'), 13);
  assert.equal(currentStageNo(w, '2027-06-01'), 14);
});

const base = { start: '2027-03-01', end: '2027-05-31', defaultTarget: 12, targets: new Map(), closed: false };
const players = [{ id: 1, name: 'สมชาย ใจดี', initials: 'ส' }];

test('km ในวันที่ 92 (เกินด่าน 13 ตามสูตร) นับเป็นด่านสุดท้าย', () => {
  // SQL จัดวันที่ 31 พ.ค. เป็น stage 14
  const r = buildStages({ ...base, today: '2027-06-05', closed: true, participants: players,
    kmRows: [{ participant_id: 1, stage: 13, km: 5 }, { participant_id: 1, stage: 14, km: 8 }] });
  assert.equal(r.totalStages, 13);
  assert.deepEqual(r.players[0].passed, [13]);   // 5 + 8 = 13 >= 12
});

test('ผ่านด่านต้องถึงเป้า, streak นับเฉพาะด่านที่จบแล้วติดกัน', () => {
  const kmRows = [
    { participant_id: 1, stage: 1, km: 12 }, { participant_id: 1, stage: 2, km: 11.9 },
    { participant_id: 1, stage: 3, km: 20 }, { participant_id: 1, stage: 4, km: 30 },
  ];
  const r = buildStages({ ...base, today: '2027-03-23', participants: players, kmRows });   // กำลังด่าน 4
  const p = r.players[0];
  assert.equal(r.currentStage, 4);
  assert.deepEqual(p.passed, [1, 3]);
  assert.equal(p.streak, 1);
  assert.equal(p.bestStreak, 1);
  assert.equal(p.currentKm, 30);
  assert.equal(p.currentPassed, true);   // ด่านปัจจุบันยังไม่ตัดสินใน passed
});

test('เป้ารายคนใช้แทนค่ากลาง', () => {
  const r = buildStages({ ...base, today: '2027-03-09', participants: players,
    targets: new Map([[1, 5]]), kmRows: [{ participant_id: 1, stage: 1, km: 6 }] });
  assert.deepEqual(r.players[0].passed, [1]);
  assert.equal(r.players[0].target, 5);
});

test('ก่อน season เริ่ม: phase upcoming, ไม่มีใครผ่านด่าน', () => {
  const r = buildStages({ ...base, today: '2027-02-01', participants: players, kmRows: [] });
  assert.equal(r.phase, 'upcoming');
  assert.equal(r.players[0].passedCount, 0);
});
