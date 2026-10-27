'use strict';
const { sendError, AppError } = require('./errors');
// Fixed-window in-memory limiter. Good enough for a single Render instance.
function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Too many attempts. Wait a moment and try again.' }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, windowMs).unref();
  const fn = (req, res, next) => {
    const k = key(req); const now = Date.now();
    let h = hits.get(k);
    if (!h || h.reset < now) { h = { count: 0, reset: now + windowMs }; hits.set(k, h); }
    h.count += 1;
    if (h.count > max) {
      res.setHeader('Retry-After', Math.ceil((h.reset - now) / 1000));
      return sendError(res, new AppError('RATE_LIMITED', message, 429));
    }
    next();
  };
  fn.reset = (req) => hits.delete(key(req));
  return fn;
}
module.exports = rateLimit;
