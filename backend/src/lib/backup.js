import { db } from '../db/connection.js';
import path from 'path';
import fs from 'fs';

const BACKUP_DIR  = process.env.BACKUP_DIR || '/app/data/backups';
const MAX_BACKUPS = 60; // เก็บย้อนหลัง 60 ไฟล์ (daily = 2 เดือน, ถ้า sync วันละครั้ง)

// สำรอง DB — คืน path ที่บันทึก
export async function autoBackup(label = 'sync') {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts   = new Date().toLocaleString('sv-SE', { timeZone:'Asia/Bangkok' })
                         .replace(/[: ]/g, '-').slice(0, 19);
  const dest = path.join(BACKUP_DIR, `auto_${label}_${ts}.sqlite`);
  await db.backup(dest);

  // ลบไฟล์เก่าเกิน MAX_BACKUPS (เรียงตามชื่อ = เรียงตามเวลา)
  // ไฟล์ close-season ไม่ถูกลบอัตโนมัติ — เป็นจุด restore ระหว่าง season
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sqlite') && !f.startsWith('auto_close-season_'))
    .sort();
  if (files.length > MAX_BACKUPS) {
    files.slice(0, files.length - MAX_BACKUPS)
         .forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
  }
  return dest;
}
