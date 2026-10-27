'use strict';
const crypto = require('node:crypto');
const config = require('../config');
const { sendError, AppError } = require('./errors');

const COOKIE = 'eos_admin';
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
// A fingerprint of the current password: changing ADMIN_PASSWORD invalidates every session.
const pwVersion = () => sha(`v1:${config.admin.password}`).toString('hex').slice(0, 16);
const sign = (data) => crypto.createHmac('sha256', config.admin.sessionSecret).update(data).digest('base64url');

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) { const k = part.slice(0, i).trim(); try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { /* skip */ } }
  });
  return out;
}

function checkPassword(input) {
  if (!config.admin.configured || typeof input !== 'string' || !input) return false;
  return crypto.timingSafeEqual(sha(input), sha(config.admin.password));
}

function issue(res) {
  const exp = Date.now() + config.admin.sessionHours * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp, pv: pwVersion(), n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
  const value = `${payload}.${sign(payload)}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${config.admin.sessionHours * 3600}${config.isProd ? '; Secure' : ''}`);
}
function clear(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${config.isProd ? '; Secure' : ''}`);
}

function read(req) {
  if (!config.admin.configured) return null;
  const raw = parseCookies(req.headers.cookie)[COOKIE];
  if (!raw || !raw.includes('.')) return null;
  const [payload, sig] = raw.split('.');
  const expect = sign(payload);
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Date.now() || data.pv !== pwVersion()) return null;
    return data;
  } catch (_) { return null; }
}

// Protect admin API routes: valid session + same-origin JSON requests (CSRF defence in depth).
function requireAdmin(req, res, next) {
  if (!config.admin.configured) return sendError(res, new AppError('ADMIN_NOT_CONFIGURED', 'Set ADMIN_PASSWORD and SESSION_SECRET (16+ chars) to enable the admin.', 503));
  if (!read(req)) return sendError(res, new AppError('UNAUTHORIZED', 'Sign in again.', 401));
  if (!['GET', 'HEAD'].includes(req.method)) {
    const origin = req.headers.origin;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (origin && new URL(origin).host !== host) return sendError(res, new AppError('FORBIDDEN', 'Cross-origin request blocked.', 403));
    if (req.headers['x-eos-admin'] !== '1') return sendError(res, new AppError('FORBIDDEN', 'Missing admin header.', 403));
  }
  next();
}

module.exports = { checkPassword, issue, clear, read, requireAdmin, parseCookies };
