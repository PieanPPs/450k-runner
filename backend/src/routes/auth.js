import { Router } from 'express';
import { db } from '../db/connection.js';
import { makeStravaKey } from '../strava/client.js';

const router = Router();
const STRAVA_AUTH_URL  = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

router.get('/strava', (req, res) => {
  const { participant_id } = req.query;
  if (!participant_id) return res.status(400).send('ต้องระบุ participant_id ครับ');
  const participant = db.prepare('SELECT id, name FROM participants WHERE id = ?').get(Number(participant_id));
  if (!participant) return res.status(404).send(`ไม่พบผู้เข้าร่วม id=${participant_id}`);

  const params = new URLSearchParams({
    client_id      : process.env.STRAVA_CLIENT_ID,
    redirect_uri   : `${process.env.APP_BASE_URL}/api/auth/strava/callback`,
    response_type  : 'code',
    approval_prompt: 'auto',
    scope          : 'read,activity:read',
    state          : String(participant_id),
  });
  res.redirect(`${STRAVA_AUTH_URL}?${params.toString()}`);
});

router.get('/strava/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.send(htmlPage('❌ ยกเลิก', '<p>คุณยกเลิกการเชื่อมต่อ Strava แล้วครับ</p>'));

  const participant_id = Number(state);
  const participant = db.prepare('SELECT id, name FROM participants WHERE id = ?').get(participant_id);
  if (!participant) return res.status(400).send(htmlPage('❌ Error', '<p>participant_id ไม่ถูกต้อง</p>'));

  try {
    const tokenRes = await fetch(STRAVA_TOKEN_URL, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        client_id    : process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type   : 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
    const tokenData = await tokenRes.json();

    // สร้าง strava_key จาก firstname + lastname[0]
    const stravaKey = makeStravaKey(tokenData.athlete.firstname, tokenData.athlete.lastname);

    // บันทึก token
    db.prepare(`
      INSERT INTO strava_tokens (participant_id, athlete_id, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(participant_id) DO UPDATE SET
        athlete_id=excluded.athlete_id, access_token=excluded.access_token,
        refresh_token=excluded.refresh_token, expires_at=excluded.expires_at
    `).run(participant_id, tokenData.athlete.id, tokenData.access_token, tokenData.refresh_token, tokenData.expires_at);

    // บันทึก strava_key ใน participants (ใช้ match กับ Club activities)
    db.prepare('UPDATE participants SET strava_key=? WHERE id=?').run(stravaKey, participant_id);

    const stravaName = `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`.trim();
    res.send(htmlPage('✅ เชื่อมต่อสำเร็จ!',
      `<p><strong>${participant.name}</strong> เชื่อมต่อ Strava เรียบร้อยแล้วครับ 🎉</p>
       <p>Strava: <strong>${stravaName}</strong> (key: ${stravaKey})</p>
       <p>ปิดหน้าต่างนี้ได้เลยครับ</p>`
    ));
  } catch (err) {
    console.error('[auth/callback] error:', err);
    res.status(500).send(htmlPage('❌ Error', `<p>${err.message}</p>`));
  }
});

router.get('/status', (_req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.name, p.initials, p.strava_key,
           CASE WHEN t.participant_id IS NOT NULL THEN 1 ELSE 0 END as connected
    FROM participants p
    LEFT JOIN strava_tokens t ON t.participant_id = p.id
    ORDER BY p.id
  `).all();
  res.json(rows);
});

export default router;

function htmlPage(title, body) {
  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>${title}</title>
  <style>body{font-family:Sarabun,sans-serif;display:flex;align-items:center;justify-content:center;
  min-height:100vh;margin:0;background:#0f0f14;color:#e8e8f0;}
  .box{background:#1a1a24;border:1px solid #2a2a3a;border-radius:16px;padding:40px 48px;max-width:420px;text-align:center;}
  h1{font-size:28px;margin-bottom:16px;}p{color:#9191a8;line-height:1.6;}</style>
  </head><body><div class="box"><h1>${title}</h1>${body}</div></body></html>`;
}
