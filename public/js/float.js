// Floating garments for shop, collection and product pages.
// Gentle sine drift, pointer/touch tilt, slow rotation. Paused off-screen and when reduced.
import { $, api, esc, imgUrl, reduced, isTouch } from './core.js';
import { openPiece } from './piece.js';

export async function floatClothes(stage = $('[data-float]')) {
  if (!stage) return;
  let items = [];
  try {
    const r = await api('/api/products?per=8&sort=featured');
    items = r.items || [];
  } catch (_) { items = []; }
  if (!items.length) return;

  const pack = [];
  const page = stage.classList.contains('float-stage--page');
  const mobile = window.innerWidth < 700;
  const slots = page
    ? (mobile
      ? [{ x: 62, y: -8, s: 0.28, z: -20 }, { x: -18, y: 48, s: 0.26, z: -10 }]
      : [{ x: 62, y: -6, s: 0.36, z: -30 }, { x: 78, y: 8, s: 0.34, z: -20 }, { x: -8, y: 42, s: 0.3, z: 10 }])
    : (mobile
      ? [{ x: -10, y: 14, s: 0.4, z: -30 }, { x: 66, y: 12, s: 0.38, z: -20 }, { x: -16, y: 72, s: 0.34, z: 10 }, { x: 74, y: 74, s: 0.36, z: 20 }]
      : [{ x: 4, y: 14, s: 0.46, z: -40 }, { x: 68, y: 10, s: 0.5, z: -20 }, { x: 2, y: 58, s: 0.58, z: 10 }, { x: 70, y: 56, s: 0.64, z: 30 }, { x: 36, y: 8, s: 0.32, z: -60 }]);
  const use = slots;
  use.forEach((slot, i) => {
    const p = items[i % items.length];
    const img = (p.images && p.images[0]) || null;
    if (!img) return;
    pack.push({ p, img, ...slot, phase: i * 1.3, amp: 10 + (i % 3) * 4, spin: 0.12 + (i % 3) * 0.05 });
  });

  const frag = document.createDocumentFragment();
  const nodes = pack.map((it, i) => {
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'float-item';
    a.dataset.floatItem = it.p.handle;
    a.setAttribute('aria-label', it.p.title);
    const w = window.innerWidth < 700 ? 118 + it.s * 60 : 180 + it.s * 140;
    a.style.width = `${Math.round(w)}px`;
    a.innerHTML = `<img src="${esc(imgUrl(it.img.src, 720))}" alt="${esc(it.img.alt || it.p.title)}" width="720" height="560" decoding="async" ${i ? 'loading="lazy"' : 'fetchpriority="low"'}>`;
    a.addEventListener('click', () => openPiece(it.p.handle));
    frag.appendChild(a);
    return { el: a, ...it };
  });
  stage.appendChild(frag);

  if (reduced()) {
    nodes.forEach((n) => { n.el.style.left = `${n.x}%`; n.el.style.top = `${n.y}%`; });
    return;
  }

  let px = 0.5; let py = 0.5; let tx = 0.5; let ty = 0.5;
  let raf = 0; let visible = true; const t0 = performance.now();

  const onMove = (e) => {
    const r = stage.getBoundingClientRect();
    const x = ('clientX' in e ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX)) - r.left;
    const y = ('clientY' in e ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY)) - r.top;
    tx = Math.max(0, Math.min(1, x / r.width));
    ty = Math.max(0, Math.min(1, y / r.height));
  };
  stage.addEventListener('pointermove', onMove, { passive: true });
  // On a phone, tilt only while the finger is on the hero — don't fight the page scroll.
  if (isTouch()) {
    stage.addEventListener('touchmove', (e) => { if (e.touches.length === 1) onMove(e); }, { passive: true });
  }

  const frame = (now) => {
    raf = 0;
    if (!visible || document.hidden) return;
    const t = (now - t0) / 1000;
    px += (tx - px) * 0.06;
    py += (ty - py) * 0.06;
    const tiltY = (px - 0.5) * 12;
    const tiltX = (0.5 - py) * 8;
    stage.style.transform = `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
    for (const n of nodes) {
      const drift = window.innerWidth < 700 ? 0.08 : 0.18;
      const x = n.x + Math.sin(t * n.spin * 1.4 + n.phase) * (n.amp * drift);
      const y = n.y + Math.cos(t * n.spin * 1.1 + n.phase) * (n.amp * drift * 0.7);
      const rot = Math.sin(t * n.spin + n.phase) * 7;
      const z = n.z + Math.sin(t * 0.35 + n.phase) * 8;
      const unit = page ? '%' : 'vw';
      const yUnit = page ? '%' : 'vh';
      n.el.style.transform = `translate3d(${x}${unit}, ${y}${yUnit}, ${z}px) rotate(${rot.toFixed(2)}deg)`;
    }
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf) raf = requestAnimationFrame(frame); };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }).observe(stage);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  start();
}
