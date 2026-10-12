// Express app — ใช้ร่วมกันระหว่าง VPS (server.js) และ Cloudflare Worker (worker.js)
import express from 'express';
import { Buffer } from 'node:buffer';
import cors from 'cors';
import dashboardRoutes  from './routes/dashboard.js';
import authRoutes       from './routes/auth.js';
import syncRoutes       from './routes/sync.js';
import adminRoutes      from './routes/admin.js';
import calendarRoutes   from './routes/calendar.js';
import { platform, mimeFor } from './lib/platform.js';
import { jsonBody } from './lib/jsonBody.js';

export function createApp() {
  const app = express();

  // CORS_ORIGIN คั่นหลายโดเมนด้วย , ได้ (เช่น ช่วงย้ายระบบที่หน้าเว็บยังอยู่คนละโดเมนกับ API)
  const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins.length === 1 ? origins[0] : origins }));
  app.use(jsonBody({ limit: 25 * 1024 * 1024 }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: '450k-runner-backend' });
  });

  app.use('/api', dashboardRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/sync', syncRoutes);
  app.use('/api/adminpp', adminRoutes);
  app.use('/api',         calendarRoutes);

  // รูป gallery — VPS อ่านจากดิสก์, Cloudflare อ่านจาก R2
  app.get('/gallery/:name', async (req, res, next) => {
    try {
      const file = await platform.files.get(req.params.name);
      if (!file) return res.status(404).send('not found');
      res.set('Content-Type', file.contentType || mimeFor(req.params.name));
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(Buffer.from(file.body));
    } catch (e) { next(e); }
  });

  // error จาก handler (asyncRouter ส่งต่อมาที่นี่)
  app.use((err, _req, res, _next) => {
    console.error('[api] error:', err);
    res.status(500).json({ ok: false, message: err.message || 'Internal error' });
  });

  return app;
}
