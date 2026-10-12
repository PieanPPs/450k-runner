// Express 4 ไม่จับ error จาก async handler (request จะค้าง) → ห่อ handler ทุกตัวให้ส่ง error ต่อไปที่ error middleware
import { Router as ExpressRouter } from 'express';

const wrap = (fn) => (typeof fn === 'function' && fn.length < 4)
  ? (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
  : fn;

export function Router() {
  const router = ExpressRouter();
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const original = router[method].bind(router);
    router[method] = (path, ...handlers) => original(path, ...handlers.map(wrap));
  }
  return router;
}
