'use strict';
const { AppError } = require('./errors');

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const bad = (field, msg) => { throw new AppError('VALIDATION', cap(msg || `Invalid ${field}`), 422, { field }); };

const v = {
  str(val, field, { min = 0, max = 500, required = false, pattern } = {}) {
    if (val === undefined || val === null) val = '';
    if (typeof val !== 'string' && typeof val !== 'number') bad(field);
    const s = String(val).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    if (required && !s) bad(field, `${field} is required`);
    if (s && s.length < min) bad(field, `${field} is too short`);
    if (s.length > max) bad(field, `${field} is too long`);
    if (s && pattern && !pattern.test(s)) bad(field);
    return s;
  },
  text(val, field, opts = {}) { return v.str(val, field, { max: 5000, ...opts }); },
  email(val, field = 'email', { required = true } = {}) {
    const s = v.str(val, field, { max: 254, required }).toLowerCase();
    if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) bad(field, 'Enter a valid email address');
    return s;
  },
  // Nigerian phone -> E.164 (+234XXXXXXXXXX). Accepts 0803..., 234803..., +234803...
  phoneNG(val, field = 'phone', { required = true } = {}) {
    const raw = v.str(val, field, { max: 24, required });
    if (!raw) return '';
    let d = raw.replace(/[^\d+]/g, '');
    if (d.startsWith('+')) d = d.slice(1);
    if (d.startsWith('234')) d = d.slice(3);
    if (d.startsWith('0')) d = d.slice(1);
    if (!/^[789]\d{9}$/.test(d)) bad(field, 'Enter a valid Nigerian phone number');
    return '+234' + d;
  },
  int(val, field, { min = -Infinity, max = Infinity, required = false } = {}) {
    if ((val === '' || val === undefined || val === null) && !required) return null;
    const n = Number(val);
    if (!Number.isInteger(n) || n < min || n > max) bad(field);
    return n;
  },
  money(val, field, { required = false, allowNull = true } = {}) {
    if (val === '' || val === undefined || val === null) { if (required) bad(field, `${field} is required`); return allowNull ? null : 0; }
    const n = Number(String(val).replace(/[,\s₦]/g, ''));
    if (!Number.isFinite(n) || n < 0 || n > 1e9) bad(field, `${field} must be a valid amount`);
    return Math.round(n * 100) / 100;
  },
  bool(val) { return val === true || val === 'true' || val === 1 || val === '1' || val === 'on'; },
  oneOf(val, field, list, { required = true } = {}) {
    if ((val === undefined || val === '' || val === null) && !required) return null;
    if (!list.includes(val)) bad(field);
    return val;
  },
  gid(val, type, field = 'id') {
    const s = v.str(val, field, { required: true, max: 120 });
    if (/^\d+$/.test(s)) return `gid://shopify/${type}/${s}`;
    if (!new RegExp(`^gid://shopify/${type}/\\d+$`).test(s)) bad(field);
    return s;
  },
  date(val, field, { required = false } = {}) {
    if (!val) { if (required) bad(field, `${field} is required`); return null; }
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) bad(field);
    return d.toISOString();
  },
  handle(val, field = 'handle') { return v.str(val, field, { required: true, max: 255, pattern: /^[a-z0-9][a-z0-9-]*$/i }); },
  list(val, field, { max = 50 } = {}) {
    if (val === undefined || val === null || val === '') return [];
    const arr = Array.isArray(val) ? val : String(val).split(',');
    if (arr.length > max) bad(field, `Too many ${field}`);
    return arr.map((x) => String(x).trim()).filter(Boolean);
  },
};
module.exports = v;
