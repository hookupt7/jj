'use strict';
// Product image cutout. Studio shots on a white sweep get their background
// keyed out so the piece sits on the dark EOS stage. Dark or busy backgrounds
// are passed through as a resized WebP. Results are cached in memory.
const sharp = require('sharp');

const ALLOWED = /^https:\/\/(cdn\.shopify\.com|[a-z0-9-]+\.shopifycdn\.(com|net))\//i;
const cache = new Map(); // key -> { buf, type, at }
const MAX = 80;
const inflight = new Map();

const remember = (key, val) => {
  cache.set(key, val);
  if (cache.size > MAX) cache.delete(cache.keys().next().value);
  return val;
};

function keyOut(data, w, h) {
  // data: RGBA. Flood from the border through light, low-chroma pixels.
  const n = w * h;
  const light = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    light[i] = mn > 168 && mx - mn < 34 ? 1 : 0;
  }
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (i) => { if (!seen[i] && light[i]) { seen[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const i = stack[--sp]; const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < n - w) push(i + w);
  }
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    if (!seen[i]) continue;
    const l = (data[p] + data[p + 1] + data[p + 2]) / 3;
    // Pure white disappears; grey studio shadow becomes a soft dark shadow.
    const a = Math.max(0, Math.min(1, (247 - l) / 78)) * 0.8;
    data[p] = data[p + 1] = data[p + 2] = 0;
    data[p + 3] = Math.round(a * 255);
  }
  // Soften the one-pixel fringe on the garment edge.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; if (seen[i]) continue;
      const nb = seen[i - 1] + seen[i + 1] + seen[i - w] + seen[i + w];
      if (nb >= 2) {
        const p = i * 4; const l = (data[p] + data[p + 1] + data[p + 2]) / 3;
        if (l > 150) data[p + 3] = Math.round(data[p + 3] * (nb >= 3 ? 0.35 : 0.6));
      }
    }
  }
}

function lightBorder(data, w, h) {
  let lightCount = 0; let total = 0;
  const check = (x, y) => {
    const p = (y * w + x) * 4; total++;
    const mn = Math.min(data[p], data[p + 1], data[p + 2]);
    const mx = Math.max(data[p], data[p + 1], data[p + 2]);
    if (mn > 200 && mx - mn < 30) lightCount++;
  };
  for (let x = 0; x < w; x += 4) { check(x, 0); check(x, h - 1); }
  for (let y = 0; y < h; y += 4) { check(0, y); check(w - 1, y); }
  return lightCount / total;
}

async function build(src, width) {
  const res = await fetch(`${src}${src.includes('?') ? '&' : '?'}width=${width}`);
  if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
  const input = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ratio = lightBorder(data, info.width, info.height);
  if (ratio > 0.85) {
    keyOut(data, info.width, info.height);
    const buf = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 84, alphaQuality: 90 }).toBuffer();
    return { buf, type: 'image/webp', cut: true };
  }
  const buf = await sharp(input).webp({ quality: 84 }).toBuffer();
  return { buf, type: 'image/webp', cut: false };
}

async function cutout(src, width) {
  if (!ALLOWED.test(src)) { const e = new Error('Image source not allowed'); e.status = 400; throw e; }
  const w = [200, 360, 540, 720, 960, 1280].reduce((best, x) => (Math.abs(x - width) < Math.abs(best - width) ? x : best), 720);
  const key = `${src}|${w}`;
  if (cache.has(key)) return cache.get(key);
  if (inflight.has(key)) return inflight.get(key);
  const job = build(src, w).then((v) => remember(key, v)).finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

module.exports = { cutout };
