// Product media helpers: stage images (white studio backgrounds keyed out by
// the server), colour-to-image matching and swatch colours.
import { esc } from './core.js';

const isShopify = (src) => /cdn\.shopify\.com|shopifycdn/.test(src || '');
export const stageUrl = (src, w = 720) => (isShopify(src) ? `/api/img?w=${w}&src=${encodeURIComponent(src)}` : src);
export const stageSrcset = (src, widths = [360, 540, 720, 960, 1280]) => (isShopify(src) ? widths.map((w) => `${stageUrl(src, w)} ${w}w`).join(', ') : '');

export function stageImg(img, { w = 720, sizes = '50vw', cls = '', lazy = true, alt = '', priority = false } = {}) {
  if (!img) return '';
  const ss = stageSrcset(img.src);
  return `<img class="${cls}" src="${esc(stageUrl(img.src, w))}"${ss ? ` srcset="${esc(ss)}" sizes="${esc(sizes)}"` : ''} alt="${esc(alt || img.alt || '')}" width="${img.w || 1000}" height="${img.h || 1000}" loading="${lazy ? 'lazy' : 'eager'}" decoding="async" draggable="false"${priority ? ' fetchpriority="high"' : ''}>`;
}

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fileParts = (src) => String(src || '').split('?')[0].split('/').pop().toLowerCase().replace(/\.[a-z0-9]+$/, '').split(/[-_]/);

/** Does this image belong to the colour? (alt text starts with it, or the file name carries it) */
export function imageIsColour(img, colour) {
  if (!img || !colour) return false;
  const re = new RegExp(`^${reEsc(String(colour).trim())}(?![\\w/])`, 'i');
  if (re.test(String(img.alt || '').trim())) return true;
  const s = slug(colour);
  return fileParts(img.src).some((x) => x === s);
}

/** Index of the main image for a colour, or -1. */
export function colourIndex(p, colour) {
  if (!p || !colour) return -1;
  if (p.colourImages && Number.isInteger(p.colourImages[colour])) return p.colourImages[colour];
  return (p.images || []).findIndex((im) => imageIsColour(im, colour));
}

/** All images for a colour (front, back, detail). Falls back to every image. */
export function imagesForColour(p, colour) {
  const imgs = p.images || [];
  if (!colour) return imgs.map((im, i) => ({ ...im, i }));
  const own = imgs.map((im, i) => ({ ...im, i })).filter((im) => imageIsColour(im, colour));
  if (own.length) return own;
  const k = colourIndex(p, colour);
  return k >= 0 ? [{ ...imgs[k], i: k }] : imgs.map((im, i) => ({ ...im, i }));
}

/** Short view label from the alt text: Front, Back, Side, Detail... */
export function viewLabel(img, n) {
  const m = String(img && img.alt || '').toLowerCase().match(/\b(front|back|side|top|sole|detail|inside|bottom)\b/);
  return m ? m[1][0].toUpperCase() + m[1].slice(1) : `View ${n}`;
}

const COLOURS = {
  black: '#0b0b0b', white: '#f2efe8', offwhite: '#ece6d8', bone: '#e9e3d7', cream: '#eadfc6', ivory: '#efe8d6',
  red: '#b3001b', blood: '#8a0014', crimson: '#a3001f', maroon: '#5a0d16', burgundy: '#5c0f1f', wine: '#5a1424',
  grey: '#8b8882', gray: '#8b8882', charcoal: '#36353a', silver: '#c0c0c4', ash: '#9b958b',
  pink: '#e2508a', hotpink: '#ff3d8b', rose: '#d98aa0', purple: '#5b2a86', violet: '#6b3fa0',
  navy: '#1b2340', blue: '#2b4a7a', sky: '#7fb0d9', teal: '#1f6f6b', green: '#2e4a2b', olive: '#5d5f33', khaki: '#a59a6f', sage: '#98a68c',
  brown: '#5a3b26', tan: '#b48a5f', beige: '#d6c3a1', sand: '#cdb48a', camel: '#b8865b',
  yellow: '#e2b711', gold: '#c9a24a', orange: '#e0641b', acidwash: 'linear-gradient(135deg,#6f6c66,#bdb8ad 40%,#4b4944 70%,#9a968d)', washedblack: '#2a2927',
};
const one = (name) => COLOURS[slug(name)] || null;
/** CSS background for a colour name. Two-tone names (Black/Red) split diagonally. */
export function swatchCss(name) {
  const parts = String(name || '').split(/\s*[/&+]\s*|\s+and\s+/i).filter(Boolean);
  if (parts.length >= 2) {
    const a = one(parts[0]); const b = one(parts[1]);
    if (a && b) return `linear-gradient(135deg, ${a} 0 50%, ${b} 50% 100%)`;
  }
  return one(name);
}

// Tag stage images once loaded: keyed-out (transparent edges) vs a dark studio
// background, which gets a soft vignette mask so no square edge shows.
let tagged = false;
export function tagStageImages() {
  if (tagged) return; tagged = true;
  const c = document.createElement('canvas'); c.width = c.height = 12;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.currentSrc || !img.currentSrc.includes('/api/img')) return;
    try {
      ctx.clearRect(0, 0, 12, 12); ctx.drawImage(img, 0, 0, 12, 12);
      const d = ctx.getImageData(0, 0, 12, 12).data;
      let alpha = 0; let lum = 0; let n = 0;
      for (const [x, y] of [[0, 0], [11, 0], [0, 11], [11, 11], [6, 0], [0, 6], [11, 6], [6, 11]]) {
        const p = (y * 12 + x) * 4; alpha += d[p + 3]; lum += (d[p] + d[p + 1] + d[p + 2]) / 3; n++;
      }
      alpha /= n; lum /= n;
      img.classList.add(alpha < 60 ? 'is-cut' : lum < 60 ? 'is-darkbg' : 'is-lightbg');
    } catch (_) { /* tainted canvas: leave as is */ }
  }, true);
}
