// Draggable hanger rail with inertia. Garments hang and sway from a rusted pipe.
import { $, $$, api, esc, imgUrl, ngn, reduced } from './core.js';
import { openPiece } from './piece.js';

function inertia(root, track) {
  let x = 0; let vx = 0; let startX = 0; let startOff = 0; let lastX = 0; let lastT = 0; let down = false; let raf = 0;
  const max = () => Math.max(0, track.scrollWidth - root.clientWidth);

  const apply = (v) => {
    x = Math.max(0, Math.min(max(), v));
    track.style.transform = `translate3d(${-x}px,0,0)`;
  };

  const coast = () => {
    raf = 0;
    if (down) return;
    vx *= 0.94;
    if (Math.abs(vx) < 0.15) { vx = 0; root.classList.remove('is-drag'); return; }
    apply(x + vx);
    raf = requestAnimationFrame(coast);
  };

  let dragged = false;
  const onDown = (e) => {
    down = true; dragged = false;
    const pt = e.touches ? e.touches[0].clientX : e.clientX;
    startX = lastX = pt; startOff = x; lastT = performance.now(); vx = 0;
    cancelAnimationFrame(raf);
  };
  const onMove = (e) => {
    if (!down) return;
    const pt = e.touches ? e.touches[0].clientX : e.clientX;
    const now = performance.now();
    const dx = pt - startX;
    if (Math.abs(dx) > 8) { dragged = true; root.classList.add('is-drag'); }
    apply(startOff - dx);
    const dt = Math.max(8, now - lastT);
    vx = (lastX - pt) / dt * 16.6;
    lastX = pt; lastT = now;
    if (e.cancelable && Math.abs(dx) > 6) e.preventDefault();
  };
  const onUp = () => {
    if (!down) return;
    down = false;
    if (Math.abs(vx) > 0.3 && !reduced()) raf = requestAnimationFrame(coast);
    else root.classList.remove('is-drag');
    if (dragged) {
      $$('[data-open]', track).forEach((b) => { b.dataset.dragged = '1'; setTimeout(() => { delete b.dataset.dragged; }, 80); });
    }
  };

  root.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove, { passive: false });
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  root.addEventListener('touchstart', onDown, { passive: true });
  root.addEventListener('touchmove', onMove, { passive: false });
  root.addEventListener('touchend', onUp);
  addEventListener('resize', () => apply(x), { passive: true });
}

export async function hangerRail(section = $('[data-rail]'), { products, hint } = {}) {
  const root = section && (section.matches('[data-rail]') ? section : $('[data-rail]', section));
  if (!root) return;
  const track = $('[data-rail-track]', root);
  if (!track) return;
  let items = products;
  if (!items) {
    try {
      const r = await api('/api/products?per=12&sort=featured');
      items = r.items || [];
    } catch (_) { items = []; }
  }
  if (!items.length) { root.hidden = true; return; }
  root.hidden = false;
  const wrap = root.closest('[data-shop-rail], [data-rail-section]');
  if (wrap) wrap.hidden = false;

  track.innerHTML = items.map((p, i) => {
    const img = p.images && p.images[0];
    return `<article class="rail__item" data-rail-item="${esc(p.handle)}" style="animation-delay:${(-i * 0.45).toFixed(2)}s">
      <div class="rail__hook" aria-hidden="true"></div>
      <button type="button" class="rail__garment" data-open="${esc(p.handle)}" aria-label="${esc(p.title)}">
        ${img ? `<img src="${esc(imgUrl(img.src, 540))}" alt="${esc(img.alt || p.title)}" width="540" height="420" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async">` : ''}
      </button>
      <div class="rail__meta">
        <span class="rail__name">${esc(p.title)}</span>
        <span class="rail__price">${ngn(p.price)}</span>
      </div>
    </article>`;
  }).join('');

  $$('[data-open]', track).forEach((b) => b.addEventListener('click', (e) => {
    // Ignore a click that was actually a drag.
    if (root.classList.contains('is-drag') && Math.abs) { /* drag class stays during gesture */ }
    if (b.dataset.dragged === '1') { e.preventDefault(); return; }
    openPiece(b.dataset.open);
  }));

  inertia(root, track);
  const note = hint || $('[data-rail-hint]');
  if (note) { note.hidden = false; note.textContent = 'Drag the rail — or swipe — to walk the drop.'; }
}

export async function shopRail() {
  const box = $('[data-shop-rail]');
  if (!box) return;
  await hangerRail($('[data-rail]', box));
}
