// ส่วนที่ต่างกันระหว่าง VPS กับ Cloudflare — entry แต่ละฝั่ง (server.js / worker.js) เป็นคนตั้งค่า
//
// backup(label) → ชื่อ/คำอธิบาย backup ที่สร้าง (โยน error ถ้าไม่สำเร็จ)
//   VPS:        ไฟล์ .sqlite ใน BACKUP_DIR
//   Cloudflare: D1 Time Travel เก็บย้อนหลังให้อัตโนมัติ → คืนเวลาไว้ใช้กู้คืน
//
// files — ที่เก็บรูป gallery
//   put(name, bytes, contentType) / get(name) → { body, contentType } | null / delete(name)
//   VPS: โฟลเดอร์ data/gallery   Cloudflare: R2

const impl = {
  backup: async () => { throw new Error('backup ยังไม่ได้ตั้งค่า'); },
  files: null,
};

export function setPlatform(p) { Object.assign(impl, p); }

export const platform = {
  backup: (label) => impl.backup(label),
  get files() {
    if (!impl.files) throw new Error('ที่เก็บไฟล์ยังไม่ได้ตั้งค่า');
    return impl.files;
  },
};

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', heic: 'image/heic' };
export const mimeFor = (name) => MIME[(name.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
