// Quick view: a side drawer with the drag-to-turn viewer, colours, sizes and add to bag.
import { $, $$, api, esc, ngn, priceRange, toast, lockScroll, trapFocus, notConfigured } from './core.js';
import { cart, openDrawer } from './cart.js';
import { productKind, kindPage } from './kind.js';
import { stageImg, colourIndex, swatchCss } from './media.js';
import { baseHtml } from './cards.js';
import { bindViewer, stageHtml } from './viewer.js';
import { selection } from './variants.js';
import { openModal } from './ui.js';
import { sizeGuideFor } from './buy.js';

let root = null; let release = null; let state = null;

function ensure() {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'qd'; root.id = 'quick-view'; root.hidden = true;
  root.innerHTML = `<div class="qd__scrim" data-qd-close></div>
    <aside class="qd__panel" role="dialog" aria-modal="true" aria-labelledby="qd-title">
      <header class="qd__head"><span class="qd__eyebrow" data-qd-eyebrow>Quick view</span><button class="qd__x" type="button" data-qd-close aria-label="Close"><svg><use href="#i-close"/></svg></button></header>
      <div class="qd__body" data-qd-body></div>
    </aside>`;
  document.body.appendChild(root);
  root.addEventListener('click', onClick);
  return root;
}

function close() {
  if (!root || root.hidden) return;
  root.classList.remove('is-open');
  lockScroll(false);
  if (release) release(); release = null;
  setTimeout(() => { if (!root.classList.contains('is-open')) root.hidden = true; }, 420);
}

function paint() {
  const { p, s, k } = state;
  const body = $('[data-qd-body]', root);
  const c = s.colour();
  const i = c ? colourIndex(p, c) : 0;
  const img = p.images[i >= 0 ? i : 0];
  const v = s.variant();
  const sizes = s.sizeOpt ? s.sizeOpt.values : [];
  const out = !p.available && !s.preorder;
  body.innerHTML = `
    ${stageHtml({ kind: k.kind, display: k.display, base: baseHtml(k.display), img: img ? stageImg(img, { w: 720, sizes: '(min-width:700px) 420px, 90vw', lazy: false, alt: p.title }) : '', cls: 'vw--qd' })}
    <div class="qd__info">
      <p class="qd__type">${esc(p.type || k.label)}</p>
      <h2 class="qd__title" id="qd-title">${esc(p.title)}</h2>
      <p class="qd__price">${v ? ngn(v.price) : priceRange(p)}</p>
      ${s.colourOpt && s.colourOpt.values.length > 1 ? `<div class="opt"><p class="opt__head"><span>Colour</span><b>${esc(c || '')}</b></p><div class="opt__swatches">${s.colourOpt.values.map((x) => { const bg = swatchCss(x); return `<button type="button" class="sw sw--lg${x === c ? ' is-on' : ''}" data-qd-colour="${esc(x)}" aria-pressed="${x === c}" aria-label="${esc(x)}" title="${esc(x)}"><i style="${bg ? `background:${bg}` : ''}"></i></button>`; }).join('')}</div></div>` : ''}
      ${sizes.length ? `<div class="opt"><p class="opt__head"><span>Size</span><b>${esc(s.size() || 'Select')}</b><button type="button" class="opt__guide" data-qd-guide>Size guide</button></p><div class="opt__sizes" role="radiogroup" aria-label="Size">${sizes.map((x) => { const ok = s.canBuy(s.sizeOpt.name, x); return `<button type="button" role="radio" class="sz${ok ? '' : ' is-out'}" data-qd-size="${esc(x)}" aria-checked="${x === s.size()}"${ok ? '' : ' aria-disabled="true"'}>${esc(x)}</button>`; }).join('')}</div></div>` : ''}
      <button class="btn btn--blood qd__add" type="button" data-qd-add ${out ? 'disabled' : ''}><span class="qd__add-label">${out ? 'Sold out' : s.preorder ? 'Pre-order' : 'Add to bag'}</span><span class="spin" aria-hidden="true"></span></button>
      <a class="qd__more" href="/product/${esc(p.handle)}${c ? `?colour=${encodeURIComponent(c)}` : ''}">View full details <svg><use href="#i-arrow"/></svg></a>
    </div>`;
  bindViewer($('[data-viewer]', body), { hint: kindPage(k.kind).hint });
}

function onClick(e) {
  if (e.target.closest('[data-qd-close]')) { close(); return; }
  if (!state) return;
  const { p, s } = state;
  const cb = e.target.closest('[data-qd-colour]');
  if (cb) { s.sel[s.colourOpt.name] = cb.dataset.qdColour; paint(); return; }
  const sb = e.target.closest('[data-qd-size]');
  if (sb) { s.sel[s.sizeOpt.name] = sb.dataset.qdSize; paint(); return; }
  if (e.target.closest('[data-qd-guide]')) { openModal(sizeGuideFor(kindPage(state.k.kind).guide, p)); return; }
  const add = e.target.closest('[data-qd-add]');
  if (add) {
    const v = s.variant();
    if (!v) { toast(s.sizeOpt && !s.size() ? 'Choose a size first' : 'Choose your options', { error: true }); $('.opt__sizes', root)?.classList.add('is-nudge'); setTimeout(() => $('.opt__sizes', root)?.classList.remove('is-nudge'), 600); return; }
    if (!v.available && !s.preorder) { toast('That option is sold out', { error: true }); return; }
    const c = s.colour(); const i = c ? colourIndex(p, c) : 0; const img = p.images[i >= 0 ? i : 0];
    add.classList.add('is-busy'); add.disabled = true;
    setTimeout(() => {
      const ok = cart.add({ variantId: v.id, handle: p.handle, title: p.title, variantTitle: v.title, price: v.price, image: img && img.src, max: s.preorder ? null : v.stock });
      add.classList.remove('is-busy');
      if (ok) { add.classList.add('is-done'); add.querySelector('.qd__add-label').textContent = 'Added to bag'; setTimeout(() => { close(); openDrawer(); }, 650); } else add.disabled = false;
    }, 550);
  }
}

export async function openQuick(handle, trigger) {
  ensure();
  const body = $('[data-qd-body]', root);
  body.innerHTML = '<div class="qd__loading"><span class="spin"></span></div>';
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('is-open'));
  lockScroll(true);
  release = trapFocus($('.qd__panel', root), close);
  try {
    const { product: p } = await api(`/api/products/${encodeURIComponent(handle)}`);
    const k = productKind(p);
    state = { p, k, s: selection(p) };
    $('[data-qd-eyebrow]', root).textContent = k.label;
    paint();
  } catch (err) {
    body.innerHTML = `<div class="qd__info"><p>${notConfigured(err) ? 'The shop is offline for a moment.' : esc(err.message)}</p><a class="qd__more" href="/product/${esc(handle)}">Open the product page</a></div>`;
  }
  if (trigger) trigger.blur();
}

let bound = false;
export function bindQuick() {
  if (bound) return; bound = true;
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-quick-view]'); if (!b) return;
    e.preventDefault(); openQuick(b.dataset.quickView, b);
  });
}
