import crypto from 'crypto';

// simple JWT ด้วย crypto (ไม่ต้องติดตั้ง library เพิ่ม)
function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function signToken(payload) {
  const secret = process.env.ADMIN_JWT_SECRET || 'fallback-secret';
  const header  = base64url(JSON.stringify({ alg:'HS256', typ:'JWT' }));
  const body    = base64url(JSON.stringify({ ...payload, exp: Date.now() + 86400000 }));
  const sig     = base64url(
    crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token) {
  try {
    const secret = process.env.ADMIN_JWT_SECRET || 'fallback-secret';
    const [header, body, sig] = token.split('.');
    const expected = base64url(
      crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
    );
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }
  next();
}
