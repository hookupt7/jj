// Drag-to-turn product viewer. Horizontal drag turns the piece in 3D with a
// spring back; vertical scroll still works on touch (touch-action: pan-y).
// Desktop: the piece also follows the pointer. Respects reduced motion.
import { reduced, isTouch } from './core.js';

export function bindViewer(root, { hint = 'Drag to turn' } = {}) {
  if (!root) return { kick() {} };
  const layer = root.querySelector('[data-turn]');
  const hintEl = root.querySelector('[data-turn-hint]');
  if (hintEl) hintEl.textContent = hint;
  if (!layer || reduced()) return { kick() {} };

  let ry = 0; let rx = 0; let vy = 0; let ty = 0; let tx = 0; let down = false; let lastX = 0; let lastY = 0; let raf = 0; let id = null; let moved = 0;
  const MAXY = 38; const MAXX = 12;
  const clamp = (v, m) => Math.max(-m, Math.min(m, v));
  const tick = () => {
    raf = 0;
    if (!down) {
      // spring back to rest with a little overshoot
      vy += (ty - ry) * 0.08; vy *= 0.82; ry += vy;
      rx += (tx - rx) * 0.12;
    }
    layer.style.transform = `rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)`;
    root.style.setProperty('--turn', (ry / MAXY).toFixed(3));
    if (down || Math.abs(ry - ty) > 0.05 || Math.abs(vy) > 0.05 || Math.abs(rx - tx) > 0.05) raf = requestAnimationFrame(tick);
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(tick); };

  root.addEventListener('pointerdown', (e) => {
    if (e.button && e.button !== 0) return;
    if (e.target.closest('button, a')) return;
    down = true; id = e.pointerId; lastX = e.clientX; lastY = e.clientY; moved = 0; vy = 0;
    root.classList.add('is-turning'); root.classList.remove('is-hinting');
    go();
  });
  root.addEventListener('pointermove', (e) => {
    if (down && e.pointerId === id) {
      const dx = e.clientX - lastX; const dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx);
      if (moved > 6 && root.setPointerCapture) { try { root.setPointerCapture(id); } catch (_) { /* gone */ } }
      ry = clamp(ry + dx * 0.45, MAXY + 8); rx = clamp(rx - dy * 0.12, MAXX);
      go();
    } else if (!down && !isTouch()) {
      const r = root.getBoundingClientRect();
      ty = ((e.clientX - r.left) / r.width - 0.5) * 22; tx = (0.5 - (e.clientY - r.top) / r.height) * 8;
      go();
    }
  });
  const up = (e) => {
    if (!down || (e && e.pointerId !== id)) return;
    down = false; root.classList.remove('is-turning');
    if (moved > 6) root.dataset.dragged = String(Date.now());
    ty = 0; tx = 0; go();
  };
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('pointerleave', () => { if (!down && !isTouch()) { ty = 0; tx = 0; go(); } });

  // A short turn on first view shows the piece can be turned.
  const kick = () => { vy = 9; ty = 0; root.classList.add('is-hinting'); go(); };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { setTimeout(kick, 500); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(root);
  }
  return { kick };
}

/** True when a click on the viewer was really the end of a drag. */
export const wasDrag = (root) => root && root.dataset.dragged && Date.now() - Number(root.dataset.dragged) < 350;

/** Stage markup shared by the product page and the quick view. */
export function stageHtml({ kind, display, base = '', img = '', cls = '' }) {
  return `<div class="vw ${cls}" data-kind="${kind}" data-display="${display}" data-viewer>
    <span class="vw__glow" aria-hidden="true"></span>
    ${base}
    <div class="vw__obj"><div class="vw__turn" data-turn><div class="vw__motion" data-motion>${img}</div></div></div>
    <span class="vw__shadow" aria-hidden="true"></span>
    <span class="vw__hint" data-turn-hint aria-hidden="true"></span>
  </div>`;
}
