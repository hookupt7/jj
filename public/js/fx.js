// Cinematic motion: gate, grain, embers, drips, cursor, wipes, reveals, Lenis.
// No people, no scramble. Respects prefers-reduced-motion. Mobile-first.
import { $, $$, html, reduced, isTouch } from './core.js';

const gsap = () => window.gsap;
const hasGsap = () => typeof window.gsap === 'function' || (window.gsap && window.gsap.to);

export function gate() {
  const box = $('#gate');
  if (!box || !html.classList.contains('is-gated')) return Promise.resolve();
  const ring = $('#gate-ring');
  const skip = $('[data-gate-skip]', box);
  let done = false;

  const finish = (e) => {
    if (e) e.preventDefault();
    if (done) return;
    done = true;
    if (ring) ring.style.strokeDashoffset = '0';
    try { sessionStorage.setItem('eos:entered', '1'); } catch (_) { /* ignore */ }
    const close = () => {
      html.classList.remove('is-gated', 'is-gate-late');
      box.setAttribute('hidden', '');
    };
    const g = gsap();
    if (g && !reduced()) {
      g.to(box, { opacity: 0, scale: 1.12, duration: 0.7, ease: 'power3.inOut', onComplete: close });
    } else {
      close();
    }
    document.dispatchEvent(new CustomEvent('eos:entered'));
  };

  const arm = (e) => {
    if (e) e.preventDefault();
    if (ring && !done) ring.style.strokeDashoffset = '0';
  };

  box.addEventListener('pointerdown', arm);
  box.addEventListener('pointerup', finish);
  box.addEventListener('click', finish);
  box.addEventListener('contextmenu', (e) => e.preventDefault());
  if (skip) {
    skip.addEventListener('pointerup', finish);
    skip.addEventListener('click', finish);
  }
  addEventListener('keydown', (e) => { if (!done && (e.key === 'Enter' || e.key === ' ')) finish(e); });
}

export function grain() {
  const c = document.createElement('canvas'); c.width = c.height = 180;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(180, 180);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  c.toBlob((b) => { if (!b) return; html.style.setProperty('--grain-url', `url(${URL.createObjectURL(b)})`); html.classList.add('has-grain'); });
}

export function drips(root) {
  const box = root || $('[data-drips]');
  if (!box || reduced()) return;
  const n = window.innerWidth < 700 ? 5 : 9;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i += 1) {
    const d = document.createElement('span');
    d.className = 'hero__drip';
    d.style.left = `${6 + (i * 11) + Math.random() * 6}%`;
    d.style.height = `${18 + Math.random() * 38}%`;
    d.style.animationDelay = `${-Math.random() * 4}s`;
    d.style.animationDuration = `${3.8 + Math.random() * 2.4}s`;
    frag.appendChild(d);
  }
  box.appendChild(frag);
}

export function reveals(root = document) {
  const items = $$('[data-reveal]:not(.is-in), [data-reveal-stagger]:not(.is-in)', root);
  if (reduced() || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
  if (!reveals.io) {
    reveals.io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); reveals.io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  }
  items.forEach((el) => reveals.io.observe(el));
}

export function embers(canvas) {
  if (!canvas || reduced()) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  let w = 0; let h = 0; let dpr = 1; let parts = []; let raf = 0; let visible = true;
  const N = () => Math.round(Math.min(window.innerWidth < 700 ? 22 : 42, (w * h) / 30000));
  const spawn = (initial) => ({
    x: Math.random() * w, y: initial ? Math.random() * h : h + 10,
    r: Math.random() * 1.6 + 0.4, vy: -(Math.random() * 0.5 + 0.18), vx: (Math.random() - 0.5) * 0.25,
    life: 0, max: 380 + Math.random() * 520, ash: Math.random() < 0.35, flick: Math.random() * Math.PI * 2,
  });
  const resize = () => {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    parts = Array.from({ length: N() }, () => spawn(true));
  };
  const frame = (t) => {
    raf = 0;
    if (!visible || reduced() || document.hidden) { ctx.clearRect(0, 0, w, h); return; }
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
  window.addEventListener('resize', () => { resize(); start(); }, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }).observe(canvas);
  }
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) start(); });
}

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
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { if (en.isIntersecting) play(v); else v.pause(); }, { threshold: 0.01 }).observe(v);
    }
  });
  const retry = () => vids.forEach((v) => { if (v.paused) play(v); });
  ['touchstart', 'pointerdown', 'scroll', 'keydown'].forEach((ev) => window.addEventListener(ev, retry, { once: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) retry(); });
  window.addEventListener('pageshow', retry);
}

export function toTop() {
  const b = document.querySelector('[data-to-top]');
  if (!b) return;
  let on = false;
  const check = () => { const want = scrollY > Math.max(700, innerHeight * 1.2); if (want !== on) { on = want; b.hidden = false; b.classList.toggle('is-on', on); } };
  window.addEventListener('scroll', check, { passive: true });
  b.addEventListener('click', () => { scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); });
  check();
}

export function transitions() {
  const wipe = $('#wipe');
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download') || a.dataset.noTransition !== undefined) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname.startsWith('/admin') || url.pathname.startsWith('/api')) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    if (reduced() || !wipe) return;
    e.preventDefault();
    try { sessionStorage.setItem('eos:leaving', '1'); } catch (_) { /* ignore */ }
    let gone = false;
    const go = () => { if (gone) return; gone = true; location.href = url.href; };
    setTimeout(go, 700); // never let the wipe animation hold up navigation
    wipe.classList.add('is-on');
    const g = gsap();
    if (g) {
      g.timeline()
        .set(wipe, { yPercent: 100 })
        .to(wipe, { yPercent: 0, duration: 0.48, ease: 'power4.inOut' })
        .add(go);
    } else {
      wipe.style.transform = 'translateY(0)';
      setTimeout(go, 420);
    }
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) { html.classList.remove('is-entering', 'is-gated'); html.classList.add('is-loaded'); }
    if (html.classList.contains('is-entering') && wipe) {
      const g = gsap();
      wipe.classList.add('is-on');
      if (g && !reduced()) {
        g.fromTo(wipe, { yPercent: 0 }, { yPercent: -100, duration: 0.5, ease: 'power4.inOut', onComplete: () => { g.set(wipe, { yPercent: 100 }); wipe.classList.remove('is-on'); html.classList.remove('is-entering'); } });
      } else { wipe.classList.remove('is-on'); html.classList.remove('is-entering'); }
    }
  });
}

export function cursor() {
  const c = $('#cur');
  if (!c || reduced() || isTouch() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  html.classList.add('has-cursor');
  const g = gsap();
  if (g && g.quickTo) {
    const qx = g.quickTo(c, 'x', { duration: 0.22 });
    const qy = g.quickTo(c, 'y', { duration: 0.22 });
    addEventListener('pointermove', (e) => { qx(e.clientX); qy(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      g.to(c, { scale: e.target.closest('a, button, input, [data-float-item], [data-rail-item]') ? 1.9 : 1, rotate: e.target.closest('a, button') ? 45 : 0, duration: 0.25 });
    });
  } else {
    addEventListener('pointermove', (e) => { c.style.left = `${e.clientX}px`; c.style.top = `${e.clientY}px`; }, { passive: true });
  }
}

export function progress() {
  const bar = $('#eos-progress');
  if (!bar || reduced()) return;
  let busy = false;
  addEventListener('scroll', () => {
    if (busy) return; busy = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
      busy = false;
    });
  }, { passive: true });
}

export function magnetic() {
  if (reduced() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const strength = 7;
  $$('.btn, .icon-btn').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2 || 1);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2 || 1);
      el.style.setProperty('--mx', `${(dx * strength).toFixed(2)}px`);
      el.style.setProperty('--my', `${(dy * strength).toFixed(2)}px`);
    }, { passive: true });
    const reset = () => { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); };
    el.addEventListener('pointerleave', reset, { passive: true });
    el.addEventListener('blur', reset);
  });
}

export function smoothScroll() {
  // Lenis is smoother on a fine pointer. Native scrolling stays faster on phones.
  if (reduced() || isTouch() || !window.Lenis) return null;
  const lenis = new window.Lenis({ lerp: 0.12, smoothWheel: true });
  const g = gsap();
  if (g && window.ScrollTrigger) {
    g.registerPlugin(window.ScrollTrigger);
    lenis.on('scroll', window.ScrollTrigger.update);
    g.ticker.add((t) => lenis.raf(t * 1000));
    g.ticker.lagSmoothing(0);
  } else {
    const loop = (t) => { lenis.raf(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  window.__eosLenis = lenis;
  return lenis;
}

export function story() {
  const root = $('[data-story]');
  if (!root) return;
  const g = gsap();
  const pin = !reduced() && window.innerWidth >= 800 && g && window.ScrollTrigger;
  if (!pin) return;
  g.registerPlugin(window.ScrollTrigger);
  root.classList.add('story--scrub');
  const steps = $$('[data-story-step]', root);
  const tl = g.timeline({
    scrollTrigger: { trigger: root, start: 'top top', end: '+=280%', pin: true, scrub: 0.7, anticipatePin: 1 },
  });
  steps.forEach((el, i) => {
    tl.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6 }, i * 0.9)
      .to(el, { opacity: i === steps.length - 1 ? 1 : 0, y: i === steps.length - 1 ? 0 : -20, duration: 0.5 }, i * 0.9 + 0.7);
  });
}
