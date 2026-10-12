// Backup แบบไฟล์ — ใช้บน VPS เท่านั้น (Cloudflare ใช้ D1 Time Travel แทน ดู worker.js)
import path from 'path';
import fs from 'fs';

const MAX_BACKUPS = 60; // เก็บย้อนหลัง 60 ไฟล์ (daily = 2 เดือน, ถ้า sync วันละครั้ง)

/** สร้างฟังก์ชัน backup(label) → ชื่อไฟล์ที่บันทึก  (rawDb = better-sqlite3 Database) */
export function createFileBackup(rawDb) {
  return async function autoBackup(label = 'sync') {
    const dir = process.env.BACKUP_DIR || '/app/data/backups';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ts   = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' })
                           .replace(/[: ]/g, '-').slice(0, 19);
    const dest = path.join(dir, `auto_${label}_${ts}.sqlite`);
    await rawDb.backup(dest);

    // ลบไฟล์เก่าเกิน MAX_BACKUPS (เรียงตามชื่อ = เรียงตามเวลา)
    // ไฟล์ close-season ไม่ถูกลบอัตโนมัติ — เป็นจุด restore ระหว่าง season
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('auto_') && f.endsWith('.sqlite') && !f.startsWith('auto_close-season_'))
      .sort();
    if (files.length > MAX_BACKUPS) {
      files.slice(0, files.length - MAX_BACKUPS)
           .forEach(f => fs.unlinkSync(path.join(dir, f)));
    }
    return path.basename(dest);
  };
}

/** daily backup (cron 23:59) — เก็บ 90 ไฟล์ */
export function createDailyBackup(rawDb) {
  return async function dailyBackup() {
    const dir = process.env.BACKUP_DIR || '/app/data/backups';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ts   = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' })
                           .replace(/[: ]/g, '-').slice(0, 19);
    const dest = path.join(dir, `daily_${ts}.sqlite`);
    await rawDb.backup(dest);
    const files = fs.readdirSync(dir).filter(f => f.startsWith('daily_') && f.endsWith('.sqlite')).sort();
    if (files.length > 90) files.slice(0, files.length - 90).forEach(f => fs.unlinkSync(path.join(dir, f)));
    console.log(`[backup] daily backup saved: ${dest}`);
  };
}

/** ที่เก็บรูป gallery บนดิสก์ (VPS) */
export function createDiskFiles(dir) {
  return {
    async put(name, bytes) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, name), bytes);
    },
    async get(name) {
      const p = path.join(dir, path.basename(name));
      return fs.existsSync(p) ? { body: fs.readFileSync(p) } : null;
    },
    async delete(name) {
      const p = path.join(dir, path.basename(name));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    },
  };
}
