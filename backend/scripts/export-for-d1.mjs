// แปลงไฟล์ SQLite (จาก VPS) เป็นไฟล์ SQL สำหรับ import เข้า Cloudflare D1
//
//   node backend/scripts/export-for-d1.mjs <ไฟล์.sqlite> <ไฟล์ผลลัพธ์.sql>
//   npx wrangler d1 execute 450k-runner --remote --file <ไฟล์ผลลัพธ์.sql>
//
// - ได้ทั้ง schema (รวมคอลัมน์ที่ migration เพิ่มไว้แล้ว) และข้อมูลทุกตาราง
// - ไม่มี BEGIN/COMMIT (D1 ไม่รับ) — ใช้ PRAGMA defer_foreign_keys ให้ลำดับตารางไม่ติด foreign key
// - เปิดไฟล์แบบอ่านอย่างเดียว ไม่แก้ไฟล์ต้นฉบับ
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(new URL('../package.json', import.meta.url));
const Database = require('better-sqlite3');

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('ใช้: node backend/scripts/export-for-d1.mjs <ไฟล์.sqlite> <ไฟล์ผลลัพธ์.sql>');
  process.exit(1);
}

const db = new Database(src, { readonly: true, fileMustExist: true });
const quote = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (Buffer.isBuffer(v)) return `X'${v.toString('hex')}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

const objects = db.prepare(`
  SELECT type, name, sql FROM sqlite_master
  WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
  ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, rowid
`).all();

const lines = ['PRAGMA defer_foreign_keys = true;'];
const tables = objects.filter(o => o.type === 'table');
for (const t of tables) lines.push(`DROP TABLE IF EXISTS "${t.name}";`);
for (const o of objects) lines.push(o.sql.trim().replace(/;?$/, ';'));

let rows = 0;
for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all().map(c => c.name);
  const colList = cols.map(c => `"${c}"`).join(',');
  for (const r of db.prepare(`SELECT * FROM "${t.name}"`).iterate()) {
    lines.push(`INSERT INTO "${t.name}" (${colList}) VALUES (${cols.map(c => quote(r[c])).join(',')});`);
    rows++;
  }
}

fs.writeFileSync(out, lines.join('\n') + '\n');
const counts = tables.map(t => `${t.name}=${db.prepare(`SELECT COUNT(*) c FROM "${t.name}"`).get().c}`).join(', ');
console.log(`เขียน ${out} — ${tables.length} ตาราง, ${rows} แถว`);
console.log(counts);
