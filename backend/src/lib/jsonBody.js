// อ่าน JSON body เอง แทน express.json()
// เหตุผล: express.json() โหลด body-parser → iconv-lite รุ่นเก่าที่ bundle เป็น Cloudflare Worker ไม่ได้
// หน้าเว็บส่งข้อมูลเป็น JSON อย่างเดียว จึงไม่ต้องรองรับ form-urlencoded
import { Buffer } from 'node:buffer';

export function jsonBody({ limit = 25 * 1024 * 1024 } = {}) {
  return (req, res, next) => {
    req.body = {};
    const type = req.headers['content-type'] || '';
    if (req.method === 'GET' || req.method === 'HEAD' || !type.includes('application/json')) return next();

    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > limit) {
        aborted = true;
        res.status(413).json({ ok: false, message: 'ข้อมูลใหญ่เกินไป' });
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted) return;
      const text = Buffer.concat(chunks).toString('utf8');
      try { req.body = text ? JSON.parse(text) : {}; }
      catch { return res.status(400).json({ ok: false, message: 'JSON ไม่ถูกต้อง' }); }
      next();
    });
    req.on('error', next);
  };
}
