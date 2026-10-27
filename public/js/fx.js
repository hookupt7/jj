// Motion layer: preloader, page veil, cursor, grain, reveals, scramble, magnetic, parallax, embers, toggles.
import { $, $$, html, reduced, isTouch } from './core.js';

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

/* ---------------- custom cursor ---------------- */
export function cursor() {
  if (isTouch() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const el = $('.cursor'); if (!el) return;
  const ring = $('.cursor__ring', el); const dot = $('.cursor__dot', el);
  html.classList.add('has-cursor');
  let x = innerWidth / 2; let y = innerHeight / 2; let rx = x; let ry = y; let raf = 0;
  const loop = () => {
    rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.2 ? requestAnimationFrame(loop) : 0;
  };
  window.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; el.classList.remove('is-hidden'); if (!raf) raf = requestAnimationFrame(loop); }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('a, button, [data-cursor], label, select, summary');
    el.classList.toggle('is-link', Boolean(t));
    el.classList.toggle('is-view', Boolean(e.target.closest('[data-cursor="view"]')));
  });
  document.addEventListener('pointerdown', () => el.classList.add('is-down'));
  document.addEventListener('pointerup', () => el.classList.remove('is-down'));
  document.addEventListener('mouseleave', () => el.classList.add('is-hidden'));
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
    if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); if (en.target.hasAttribute('data-scramble')) scramble(en.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((el) => io.observe(el));
}

/* ---------------- text scramble ---------------- */
const GLYPHS = '\u2020\u2021\u00A7\u0394\u03A8\u039E\u16DF\u16C9\u16B1\u16A0\u2629\u2720\u2135\u03A9';
export function scramble(el, { duration = 900 } = {}) {
  if (reduced() || el.dataset.scrambled === 'busy') return;
  // Only scramble leaf text (keep nested markup intact).
  const target = el.querySelector('[data-scramble]') && el.children.length ? null : el;
  if (!target || target.children.length) return;
  const final = target.dataset.final || target.textContent;
  target.dataset.final = final;
  el.dataset.scrambled = 'busy';
  const start = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - start) / duration);
    let out = '';
    for (let i = 0; i < final.length; i++) {
      const ch = final[i];
      if (ch === ' ' || p > i / final.length + 0.15) out += ch;
      else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    target.textContent = out;
    if (p < 1) requestAnimationFrame(step); else { target.textContent = final; el.dataset.scrambled = 'done'; }
  };
  requestAnimationFrame(step);
}
export function scrambles() {
  $$('[data-scramble]').forEach((el) => {
    if (!el.closest('.hero')) { el.setAttribute('data-reveal', el.getAttribute('data-reveal') || ''); }
    if (!el.children.length) { el.classList.add('glitch'); el.setAttribute('data-text', el.textContent); }
    el.addEventListener('pointerenter', () => scramble(el, { duration: 600 }));
  });
  // Hero lines scramble after the preloader.
  const hero = $$('.hero [data-scramble]');
  if (hero.length) {
    const go = () => hero.forEach((el, i) => setTimeout(() => scramble(el, { duration: 1100 }), 250 + i * 160));
    if (html.classList.contains('is-loaded')) go();
    else new MutationObserver((m, obs) => { if (html.classList.contains('is-loaded')) { obs.disconnect(); go(); } }).observe(html, { attributes: true, attributeFilter: ['class'] });
  }
}

/* ---------------- magnetic buttons ---------------- */
export function magnetic(root = document) {
  if (isTouch()) return;
  $$('[data-magnetic]', root).forEach((el) => {
    if (el.dataset.magBound) return; el.dataset.magBound = '1';
    el.addEventListener('pointermove', (e) => {
      if (reduced()) return;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width; const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.transform = `translate(${dx * 14}px, ${dy * 10}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transition = 'transform 0.6s cubic-bezier(.16,1,.3,1)'; el.style.transform = ''; setTimeout(() => { el.style.transition = ''; }, 600); });
  });
}

/* ---------------- parallax ---------------- */
export function parallax() {
  const items = $$('[data-parallax]');
  if (!items.length) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    if (reduced()) { items.forEach((el) => { el.style.transform = ''; }); return; }
    const vh = innerHeight;
    items.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const speed = Number(el.dataset.parallax) || 0.1;
      const off = (r.top + r.height / 2 - vh / 2) * speed;
      el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
    });
  };
  const on = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', on, { passive: true });
  window.addEventListener('resize', on);
  update();
}

/* ---------------- embers / ash particles ---------------- */
export function embers(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w = 0; let h = 0; let dpr = 1; let parts = []; let raf = 0; let visible = true;
  const N = () => Math.round(Math.min(90, (w * h) / 16000));
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

/* ---------------- image warp on hover (cards) ---------------- */
export function warpHover() {
  if (isTouch()) return;
  const map = document.getElementById('fx-warp-map');
  if (!map) return;
  let raf = 0; let cur = 0; let target = 0;
  const loop = () => { cur += (target - cur) * 0.12; map.setAttribute('scale', cur.toFixed(2)); raf = Math.abs(target - cur) > 0.1 ? requestAnimationFrame(loop) : 0; };
  document.addEventListener('pointerover', (e) => {
    const m = e.target.closest('.coll, .look');
    const was = target; target = m && !reduced() ? 18 : 0;
    if (was !== target && !raf) raf = requestAnimationFrame(loop);
  });
}

/* ---------------- toggles: sound, motion, ambience ---------------- */
export function toggles() {
  const motionBtn = $('[data-toggle="motion"]');
  const ambBtn = $('[data-toggle="ambience"]');
  const setMotion = (on, persist = true) => {
    html.classList.toggle('reduce-motion', !on);
    html.classList.toggle('motion-forced', on);
    if (persist) { try { localStorage.setItem('eos:motion', on ? 'on' : 'off'); } catch (_) { /* ignore */ } }
    if (motionBtn) { motionBtn.setAttribute('aria-pressed', String(on)); motionBtn.querySelector('span').textContent = on ? 'Motion on' : 'Motion off'; }
    $$('video[data-hero-video], video[data-film-video]').forEach((v) => { if (on) { if (v.dataset.autoplay !== 'off') v.play().catch(() => {}); } else v.pause(); });
    html.dispatchEvent(new Event('eos:motion'));
  };
  if (motionBtn) {
    setMotion(!reduced(), false);
    motionBtn.addEventListener('click', () => setMotion(reduced()));
  }
  const setAmb = (lit) => {
    html.setAttribute('data-ambience', lit ? 'lit' : 'dim');
    try { localStorage.setItem('eos:ambience', lit ? 'lit' : 'dim'); } catch (_) { /* ignore */ }
    if (ambBtn) { ambBtn.setAttribute('aria-pressed', String(lit)); ambBtn.querySelector('span').textContent = lit ? 'Candle lit' : 'Candle dim'; }
  };
  if (ambBtn) { setAmb(html.getAttribute('data-ambience') !== 'dim'); ambBtn.addEventListener('click', () => setAmb(html.getAttribute('data-ambience') === 'dim')); }

  // Sound toggle is shown only where a hero video exists.
  const soundBtn = $('[data-toggle="sound"]');
  const video = $('[data-hero-video]');
  if (soundBtn && video) {
    soundBtn.hidden = false;
    const setSound = (on) => {
      video.muted = !on;
      if (on) video.play().catch(() => {});
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.querySelector('use').setAttribute('href', on ? '#i-sound-on' : '#i-sound-off');
      soundBtn.querySelector('span').textContent = on ? 'Sound on' : 'Sound off';
    };
    soundBtn.addEventListener('click', () => setSound(video.muted));
    // Mute again once the hero leaves the screen.
    new IntersectionObserver(([en]) => { if (!en.isIntersecting && !video.muted) setSound(false); }, { threshold: 0.05 }).observe(video);
  }
}
