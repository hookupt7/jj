// Motion layer: preloader, page veil, grain, reveals, embers, video autoplay.
// Kept deliberately quiet: no text scrambling, no custom cursor, no sound.
import { $, $$, html, reduced } from './core.js';

/* ---------------- preloader ---------------- */
export function preloader() {
  const finish = () => {
    html.classList.add('is-loaded');
    try { sessionStorage.setItem('eos:seen', '1'); } catch (_) { /* ignore */ }
  };
  if (!html.classList.contains('is-first')) { requestAnimationFrame(finish); return; }
  const count = $('[data-count]');
  const start = performance.now();
  const MIN = 1900;
  let loaded = document.readyState === 'complete';
  window.addEventListener('load', () => { loaded = true; }, { once: true });
  const tick = (t) => {
    const p = Math.min(1, (t - start) / MIN);
    const shown = Math.floor((loaded ? p : Math.min(p, 0.86)) * 100);
    if (count) count.textContent = String(shown).padStart(3, '0');
    if (p >= 1 && loaded) { if (count) count.textContent = '100'; setTimeout(finish, 180); return; }
    if (t - start > 4000) { finish(); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------------- page transitions (fade to black with sigil) ---------------- */
export function transitions() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download') || a.dataset.noTransition !== undefined) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname.startsWith('/admin') || url.pathname.startsWith('/api')) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
    if (reduced()) return;
    e.preventDefault();
    try { sessionStorage.setItem('eos:leaving', '1'); } catch (_) { /* ignore */ }
    html.classList.add('is-leaving');
    setTimeout(() => { location.href = url.href; }, 420);
  });
  // Back/forward cache: clear the veil.
  window.addEventListener('pageshow', (e) => { if (e.persisted) { html.classList.remove('is-leaving', 'is-entering'); html.classList.add('is-loaded'); } });
}

/* ---------------- film grain (one generated tile) ---------------- */
export function grain() {
  const c = document.createElement('canvas'); c.width = c.height = 180;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(180, 180);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  c.toBlob((b) => { if (!b) return; html.style.setProperty('--grain-url', `url(${URL.createObjectURL(b)})`); html.classList.add('has-grain'); });
}

/* ---------------- reveals ---------------- */
let io;
export function reveals(root = document) {
  const items = $$('[data-reveal]:not(.is-in), [data-reveal-stagger]:not(.is-in)', root);
  if (reduced() || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
  io = io || new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((el) => io.observe(el));
}

/* ---------------- embers / ash particles ---------------- */
export function embers(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w = 0; let h = 0; let dpr = 1; let parts = []; let raf = 0; let visible = true;
  const N = () => Math.round(Math.min(46, (w * h) / 26000));
  const spawn = (initial) => ({
    x: Math.random() * w, y: initial ? Math.random() * h : h + 10,
    r: Math.random() * 1.6 + 0.4, vy: -(Math.random() * 0.5 + 0.18), vx: (Math.random() - 0.5) * 0.25,
    life: 0, max: 380 + Math.random() * 520, ash: Math.random() < 0.35, flick: Math.random() * Math.PI * 2,
  });
  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    parts = Array.from({ length: N() }, () => spawn(true));
  };
  const frame = (t) => {
    raf = 0;
    if (!visible || reduced()) { ctx.clearRect(0, 0, w, h); return; }
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      p.life++; p.y += p.vy; p.x += p.vx + Math.sin((p.life + p.flick * 50) / 60) * 0.18;
      const k = 1 - p.life / p.max;
      if (k <= 0 || p.y < -10) Object.assign(p, spawn(false));
      const a = Math.max(0, k) * (0.55 + Math.sin(t / 120 + p.flick) * 0.25);
      if (p.ash) { ctx.fillStyle = `rgba(200,190,175,${a * 0.35})`; ctx.fillRect(p.x, p.y, p.r * 1.4, p.r * 0.7); }
      else {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(255,170,90,${a})`); g.addColorStop(0.4, `rgba(214,40,30,${a * 0.6})`); g.addColorStop(1, 'rgba(120,0,10,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf) raf = requestAnimationFrame(frame); };
  resize(); start();
  window.addEventListener('resize', () => { resize(); start(); });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) start(); });
  html.addEventListener('eos:motion', start);
}


/* ---------------- background / film video autoplay ----------------
   Muted, inline, looping, no controls. iOS Safari needs the muted *property* set before play()
   (the attribute alone is not always enough) and playsinline; if autoplay is still refused
   (Low Power Mode), we retry on the first touch, scroll or tab return. The poster shows meanwhile. */
export function autoplayVideos(root = document) {
  const vids = $$('video[data-autoplay]', root);
  if (!vids.length) return;
  const prep = (v) => {
    v.muted = true; v.defaultMuted = true; v.setAttribute('muted', '');
    v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
    v.loop = true; v.controls = false; v.removeAttribute('controls');
  };
  const play = (v) => { prep(v); const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  vids.forEach((v) => {
    prep(v);
    if (v.readyState >= 2) play(v); else v.addEventListener('loadeddata', () => play(v), { once: true });
    play(v);
    // Pause off-screen films to save battery; resume when they come back.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { if (en.isIntersecting) play(v); else v.pause(); }, { threshold: 0.01 }).observe(v);
    }
  });
  const retry = () => vids.forEach((v) => { if (v.paused) play(v); });
  ['touchstart', 'pointerdown', 'scroll', 'keydown'].forEach((ev) => window.addEventListener(ev, retry, { once: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) retry(); });
  window.addEventListener('pageshow', retry);
}

/* ---------------- back to top ---------------- */
export function toTop() {
  const b = document.querySelector('[data-to-top]');
  if (!b) return;
  let on = false;
  const check = () => { const want = scrollY > Math.max(700, innerHeight * 1.2); if (want !== on) { on = want; b.hidden = false; b.classList.toggle('is-on', on); } };
  window.addEventListener('scroll', check, { passive: true });
  b.addEventListener('click', () => { scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); });
  check();
}
