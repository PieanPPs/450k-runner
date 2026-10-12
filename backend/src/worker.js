// Entry สำหรับ Cloudflare Workers — หน้าเว็บ (static assets) + API (Express) + Cron Triggers
// VPS ใช้ src/server.js แทน — routes/logic ใช้ร่วมกันผ่าน app.js
//
// Bindings (wrangler.jsonc ที่ root ของ repo):
//   DB       D1 database
//   GALLERY  R2 bucket เก็บรูป gallery
//   ASSETS   หน้าเว็บที่ build แล้ว (dist/) — Cloudflare เสิร์ฟเองก่อนถึง Worker ยกเว้น /api/* และ /gallery/*
import { env } from 'cloudflare:workers';
import { handleAsNodeRequest } from 'cloudflare:node';
import { setDbDriver } from './lib/db.js';
import { setPlatform } from './lib/platform.js';
import { createD1Driver, createR2Files } from './worker/bindings.js';
import { createApp } from './app.js';
import { runSixHourly, runDaily } from './lib/jobs.js';

setDbDriver(createD1Driver(env.DB));
setPlatform({
  // D1 Time Travel เก็บสถานะย้อนหลังให้อัตโนมัติ (ฟรี 7 วัน / Paid 30 วัน) — จดเวลาไว้ใช้กู้คืน:
  //   npx wrangler d1 time-travel restore 450k-runner --timestamp=<เวลานี้>
  backup: async () => `D1 Time Travel @ ${new Date().toISOString()}`,
  files: createR2Files(env.GALLERY),
});

// Express รันใน Worker ผ่าน node:http — พอร์ตเป็นแค่ชื่อภายใน ไม่ได้เปิดจริง
const PORT = 3000;
createApp().listen(PORT);

// ต้องตรงกับ triggers.crons ใน wrangler.jsonc (เวลาเป็น UTC)
const CRON_DAILY = '59 16 * * *';   // 23:59 เวลาไทย

export default {
  fetch(request) {
    return handleAsNodeRequest(PORT, request);
  },
  async scheduled(controller, _env, ctx) {
    ctx.waitUntil(controller.cron === CRON_DAILY
      ? runDaily({ label: 'cron-daily' })
      : runSixHourly('cron-6h'));
  },
};
