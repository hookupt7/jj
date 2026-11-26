// CSS 3D tilt/rotate for a garment. Uses the images it is given (front, or more angles).
// No Three.js — light enough for a mid-range phone. No people in the frame.
import { reduced, isTouch } from './core.js';

export function bindViewer(root) {
  if (!root) return { update() {} };
  let layer = root.querySelector('.viewer__spin');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'viewer__spin';
    while (root.firstChild) layer.appendChild(root.firstChild);
    root.appendChild(layer);
    if (!root.querySelector('.viewer__hint')) {
      const h = document.createElement('span');
      h.className = 'viewer__hint';
      h.textContent = isTouch() ? 'Drag to turn' : 'Move to turn';
      root.appendChild(h);
    }
  }

  if (reduced()) return { update() {} };

  let rx = 0; let ry = 0; let tx = 0; let ty = 0; let down = false; let sx = 0; let sy = 0; let raf = 0;

  const apply = () => {
    raf = 0;
    rx += (tx - rx) * 0.18;
    ry += (ty - ry) * 0.18;
    layer.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    if (Math.abs(tx - rx) > 0.05 || Math.abs(ty - ry) > 0.05) raf = requestAnimationFrame(apply);
  };
  const start = () => { if (!raf) raf = requestAnimationFrame(apply); };

  const point = (e, startMode) => {
    const r = root.getBoundingClientRect();
    const cx = ('clientX' in e ? e.clientX : e.touches[0].clientX) - r.left;
    const cy = ('clientY' in e ? e.clientY : e.touches[0].clientY) - r.top;
    if (startMode) return { cx, cy };
    ty = ((0.5 - cy / r.height) * 16);
    tx = ((cx / r.width - 0.5) * 28);
    start();
  };

  if (!isTouch()) {
    root.addEventListener('pointermove', (e) => point(e), { passive: true });
    root.addEventListener('pointerleave', () => { tx = 0; ty = 0; start(); }, { passive: true });
  } else {
    root.addEventListener('pointerdown', (e) => {
      down = true; root.classList.add('is-hold');
      const p = point(e, true); sx = p.cx; sy = p.cy;
    });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const r = root.getBoundingClientRect();
      const cx = e.clientX - r.left; const cy = e.clientY - r.top;
      tx = ((cx - sx) / r.width) * 40 + tx * 0; // set from origin of this gesture
      tx = ((cx / r.width - 0.5) * 32);
      ty = ((0.5 - cy / r.height) * 18);
      start();
    }, { passive: true });
    addEventListener('pointerup', () => { down = false; root.classList.remove('is-hold'); tx = 0; ty = 0; start(); });
  }

  return {
    update() { /* caller replaced inner HTML; wrap again if needed */ },
  };
}
