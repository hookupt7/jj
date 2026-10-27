// Shared helpers. No framework.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
export const html = document.documentElement;

export const boot = (() => {
  try { return JSON.parse(document.getElementById('boot').textContent); } catch (_) { return { settings: {}, contact: {}, states: [] }; }
})();

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const nf0 = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** ₦12,500 (kobo only when present). */
export const ngn = (n) => {
  const v = Number(n) || 0;
  return '\u20A6' + (Math.round(v) === v ? nf0.format(v) : nf2.format(v));
};
export const priceRange = (p) => (p.maxPrice && p.maxPrice > p.price ? `From ${ngn(p.price)}` : ngn(p.price));

export const reduced = () => html.classList.contains('reduce-motion');
export const isTouch = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;

export const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* full or blocked */ } },
};

export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.error && body.error.message) || `Request failed (${status})`);
    this.status = status; this.code = body && body.error && body.error.code; this.details = body && body.error && body.error.details;
  }
}
export async function api(path, { method = 'GET', body, signal } = {}) {
  // Storefront calls short-circuit until Shopify is connected (no failed requests in the console).
  if (!boot.shopifyConfigured && !path.startsWith('/api/admin')) throw new ApiError(503, { error: { code: 'SHOPIFY_NOT_CONFIGURED', message: 'Not connected yet' } });
  const res = await fetch(path, {
    method, signal, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* not json */ }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
export const notConfigured = (e) => e && (e.code === 'SHOPIFY_NOT_CONFIGURED' || e.status === 503);

/** Shopify CDN resize. Our own assets pass through untouched. */
export const imgUrl = (src, w) => {
  if (!src) return '';
  if (!/cdn\.shopify\.com|shopifycdn/.test(src)) return src;
  return src + (src.includes('?') ? '&' : '?') + 'width=' + w;
};
export const srcset = (src, widths = [360, 540, 720, 960, 1280]) => widths.map((w) => `${imgUrl(src, w)} ${w}w`).join(', ');

let toastTimer;
export function toast(msg, { error = false, ms = 3200 } = {}) {
  const el = $('.toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('is-error', error);
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// Scroll lock that keeps position (iOS safe).
let locks = 0;
export function lockScroll(on) {
  locks = Math.max(0, locks + (on ? 1 : -1));
  document.body.classList.toggle('is-locked', locks > 0);
}

/** Keep keyboard focus inside an open dialog. Returns a release function. */
export function trapFocus(container, onEscape) {
  const prev = document.activeElement;
  const sel = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]):not(.hp),select,textarea,[tabindex]:not([tabindex="-1"])';
  const key = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onEscape && onEscape(); return; }
    if (e.key !== 'Tab') return;
    const items = $$(sel, container).filter((x) => x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0]; const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', key);
  requestAnimationFrame(() => { const f = $$(sel, container).find((x) => x.offsetParent !== null); f && f.focus({ preventScroll: true }); });
  return () => { document.removeEventListener('keydown', key); prev && prev.focus && prev.focus({ preventScroll: true }); };
}

export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export const waLink = (text, number = boot.contact && boot.contact.whatsapp) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

export function setBusy(btn, busy) { if (!btn) return; btn.classList.toggle('is-busy', busy); btn.disabled = busy; }

// Colour names -> swatch colours (fallback: none, text only).
const COLOURS = { black: '#0a0a0a', white: '#f2efe8', bone: '#e9e3d7', cream: '#efe6d2', red: '#b0001a', blood: '#8a0014', grey: '#8a8780', gray: '#8a8780', 'acid wash': 'linear-gradient(135deg,#6f6c66,#bdb8ad 40%,#4b4944 70%,#9a968d)', 'washed black': '#2a2927', charcoal: '#333', brown: '#5a3b26', green: '#2e4a2b', navy: '#1b2236', blue: '#2b4a7a', pink: '#d9a3a8' };
export const colourCss = (name) => COLOURS[String(name).toLowerCase()] || null;
