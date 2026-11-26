// CSS 3D motion for a product image. Mode follows the product kind.
// Light enough for a mid-range phone. Respects reduced-motion.
import { reduced, isTouch } from './core.js';

export function bindViewer(root, { mode = 'tilt', hint } = {}) {
  if (!root) return { update() {} };
  root.dataset.viewerMode = mode;
  let layer = root.querySelector('.viewer__spin');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'viewer__spin';
    while (root.firstChild) layer.appendChild(root.firstChild);
    root.appendChild(layer);
  }
  let hintEl = root.querySelector('.viewer__hint');
  if (!hintEl) {
    hintEl = document.createElement('span');
    hintEl.className = 'viewer__hint';
    root.appendChild(hintEl);
  }
  const label = hint || (
    mode === 'spin' ? (isTouch() ? 'Drag to spin' : 'Move to spin')
      : mode === 'macro' ? (isTouch() ? 'Drag for the detail' : 'Move for the detail')
        : (isTouch() ? 'Drag to turn' : 'Move to turn')
  );
  hintEl.textContent = label;

  if (mode === 'macro' && !root.querySelector('.viewer__glint')) {
    const g = document.createElement('span');
    g.className = 'viewer__glint';
    g.setAttribute('aria-hidden', 'true');
    root.appendChild(g);
  }
  if (mode === 'spin' && !root.querySelector('.viewer__halo')) {
    const h = document.createElement('span');
    h.className = 'viewer__halo';
    h.setAttribute('aria-hidden', 'true');
    root.appendChild(h);
  }

  if (reduced()) return { update() {} };

  const range = {
    tilt: { x: 16, y: 28 },
    'tilt-multi': { x: 22, y: 36 },
    spin: { x: 8, y: 48 },
    strap: { x: 18, y: 20 },
    macro: { x: 8, y: 14 },
  }[mode] || { x: 16, y: 28 };

  let rx = 0; let ry = 0; let tx = 0; let ty = 0; let down = false; let raf = 0;
  let auto = 0;
  const t0 = performance.now();

  const apply = (now) => {
    raf = 0;
    if (mode === 'spin' && !down) {
      auto = ((now - t0) / 1000) * 14;
    }
    if (mode === 'strap' && !down) {
      const t = (now - t0) / 1000;
      tx = Math.sin(t * 1.1) * 6;
      ty = 0;
    }
    rx += (tx - rx) * 0.18;
    ry += ((ty + (mode === 'spin' && !down ? auto : 0)) - ry) * (mode === 'spin' && !down ? 0.08 : 0.18);
    const rz = mode === 'tilt-multi' ? ry * -0.12 : (mode === 'strap' ? tx * 0.4 : 0);
    layer.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
    const moving = Math.abs(tx - rx) > 0.05 || Math.abs((ty + auto) - ry) > 0.05 || mode === 'spin' || mode === 'strap';
    if (moving) raf = requestAnimationFrame(apply);
  };
  const start = () => { if (!raf) raf = requestAnimationFrame(apply); };

  const aim = (e) => {
    const r = root.getBoundingClientRect();
    const cx = ('clientX' in e ? e.clientX : e.touches[0].clientX) - r.left;
    const cy = ('clientY' in e ? e.clientY : e.touches[0].clientY) - r.top;
    ty = ((0.5 - cy / r.height) * range.x);
    tx = ((cx / r.width - 0.5) * range.y);
    start();
  };

  if (!isTouch()) {
    root.addEventListener('pointermove', (e) => aim(e), { passive: true });
    root.addEventListener('pointerleave', () => { tx = 0; ty = 0; start(); }, { passive: true });
  } else {
    root.addEventListener('pointerdown', (e) => { down = true; root.classList.add('is-hold'); aim(e); });
    addEventListener('pointermove', (e) => { if (down) aim(e); }, { passive: true });
    addEventListener('pointerup', () => { down = false; root.classList.remove('is-hold'); tx = 0; ty = 0; start(); });
  }
  start();

  return { update() {} };
}
