// ฐานข้อมูลแบบ async — โค้ดชุดเดียวใช้ได้ทั้งสองที่
//   VPS (Node)        → better-sqlite3   (db/driver-node.js)
//   Cloudflare Worker → D1               (worker/driver-d1.js)
//
// ใช้งานเหมือน better-sqlite3 แต่ต้อง await:
//   const row  = await db.prepare('SELECT ... WHERE id=?').get(id);
//   const rows = await db.prepare('SELECT ...').all();
//   const info = await db.prepare('UPDATE ...').run(a, b);   // { changes, lastInsertRowid }
//   await db.batch([db.prepare(sqlA).bind(1), db.prepare(sqlB).bind(2)]);  // atomic (แทน transaction)
//
// แพ็กเกจฟรีของ D1 จำกัด 50 query ต่อ request → งานที่วนหลายแถวให้ส่งข้อมูลเป็น JSON ก้อนเดียว
// แล้วใช้ json_each(?) ใน SQL (ดู jsonParam)

let driver = null;

export function setDbDriver(d) { driver = d; }

function need() {
  if (!driver) throw new Error('ยังไม่ได้ตั้งค่า database driver (setDbDriver)');
  return driver;
}

// better-sqlite3 ไม่รับ boolean/undefined และ D1 ไม่รับ undefined → แปลงให้เหมือนกันทั้งสองที่
function norm(params) {
  return params.map(v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
}

class Statement {
  constructor(sql, params = []) {
    this.sql = sql;
    this.params = params;
  }
  bind(...params) { return new Statement(this.sql, norm(params)); }
  #p(params) { return params.length ? norm(params) : this.params; }
  /** แถวแรก หรือ undefined */
  async get(...params) { return need().get(this.sql, this.#p(params)); }
  /** ทุกแถว (array) */
  async all(...params) { return need().all(this.sql, this.#p(params)); }
  /** { changes, lastInsertRowid } */
  async run(...params) { return need().run(this.sql, this.#p(params)); }
}

export const db = {
  prepare: (sql) => new Statement(sql),
  /** รันหลาย statement แบบ atomic (สำเร็จทั้งหมดหรือไม่มีอะไรเปลี่ยน) */
  batch: (stmts) => need().batch(stmts.filter(Boolean).map(s => ({ sql: s.sql, params: s.params }))),
  /** SQL ดิบหลาย statement (ไม่มี parameter) */
  exec: (sql) => need().exec(sql),
};

/** ส่ง array ของ object เป็น parameter เดียว ใช้คู่กับ json_each(?) — นับเป็น 1 query เสมอ */
export const jsonParam = (rows) => JSON.stringify(rows);
