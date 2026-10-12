// อัปโหลดรูป gallery จากโฟลเดอร์ (คัดลอกมาจาก VPS: backend/data/gallery) ขึ้น R2
//
//   node backend/scripts/upload-gallery-to-r2.mjs <โฟลเดอร์ gallery> [ชื่อ bucket]
//
// ต้อง login wrangler แล้ว (npx wrangler login) — อัปโหลดทับไฟล์ชื่อเดิมได้ รันซ้ำได้
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const [dir, bucket = '450k-runner-gallery'] = process.argv.slice(2);
if (!dir || !fs.existsSync(dir)) {
  console.error('ใช้: node backend/scripts/upload-gallery-to-r2.mjs <โฟลเดอร์ gallery> [ชื่อ bucket]');
  process.exit(1);
}

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', heic: 'image/heic' };
const files = fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isFile());
let ok = 0;
for (const name of files) {
  const type = MIME[(name.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
  const r = spawnSync('npx', ['wrangler', 'r2', 'object', 'put', `${bucket}/${name}`,
    '--file', path.join(dir, name), '--content-type', type, '--remote'], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status === 0) ok++;
  else console.error(`❌ ${name}`);
}
console.log(`อัปโหลดสำเร็จ ${ok}/${files.length} ไฟล์ → ${bucket}`);
