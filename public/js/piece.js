// Slide-in product drawer: garment viewer, sizes, add to bag.
// Shared by the floating clothes, the hanger rail, and quick view.
import { $, $$, api, esc, ngn, imgUrl, srcset, toast, lockScroll, trapFocus, setBusy, notConfigured } from './core.js';
import { cart, openDrawer } from './cart.js';
import { bindViewer } from './viewer.js';

let root; let release = null; let current = null; let chosen = null; let viewer = null;

function ensure() {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'piece';
  root.id = 'piece-drawer';
  root.innerHTML = `<div class="piece__scrim" data-piece-close></div>
    <div class="piece__panel" role="dialog" aria-modal="true" aria-labelledby="piece-title">
      <div class="piece__top"><span class="eyebrow">The piece</span>
        <button class="icon-btn" type="button" data-piece-close aria-label="Close"><svg><use href="#i-close"/></svg></button>
      </div>
      <div class="piece__viewer viewer" data-piece-viewer></div>
      <div class="piece__info" data-piece-info></div>
    </div>`;
  document.body.appendChild(root);
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-piece-close]')) closePiece();
    const sz = e.target.closest('[data-piece-size]');
    if (sz && current) pickSize(sz.dataset.pieceSize);
    if (e.target.closest('[data-piece-add]')) add();
  });
  return root;
}

function pickSize(size) {
  if (!current) return;
  const sizeOpt = (current.options || []).find((o) => /^size$/i.test(o.name));
  const name = sizeOpt ? sizeOpt.name : 'Size';
  chosen = current.variants.find((v) => v.options[name] === size) || current.variants.find((v) => v.title === size) || null;
  $$('[data-piece-size]', root).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.pieceSize === size)));
  const add = $('[data-piece-add]', root);
  if (add) {
    const out = chosen && !chosen.available && !(current.drop && current.drop.preorder);
    add.disabled = Boolean(out) || (!current.available && !(current.drop && current.drop.preorder));
    const label = add.querySelector('span');
    if (label) label.textContent = out ? 'Sold out in this size' : (current.drop && current.drop.preorder ? 'Pre-order' : 'Add to bag');
  }
}

function add() {
  if (!current) return;
  if ((current.sizes || []).length && !chosen) { toast('Choose a size first', { error: true }); return; }
  const v = chosen || current.variants[0];
  if (!v) return;
  const img = current.images && current.images[0];
  const ok = cart.add({
    variantId: v.id, handle: current.handle, title: current.title, variantTitle: v.title,
    price: v.price, image: img && img.src, max: (current.drop && current.drop.preorder) ? null : v.stock,
  });
  if (ok) { toast(`${current.title} added`); closePiece(); openDrawer(); }
}

export function closePiece() {
  if (!root) return;
  root.classList.remove('is-open');
  lockScroll(false);
  if (release) release();
  release = null;
  current = null; chosen = null;
}

export async function openPiece(handle) {
  if (!handle) return;
  const box = ensure();
  const info = $('[data-piece-info]', box);
  const view = $('[data-piece-viewer]', box);
  info.innerHTML = '<p class="eyebrow">Loading…</p>';
  view.innerHTML = '';
  box.classList.add('is-open');
  lockScroll(true);
  release = trapFocus($('.piece__panel', box), closePiece);

  let data;
  try { data = await api(`/api/products/${encodeURIComponent(handle)}`); }
  catch (e) {
    if (notConfigured(e)) { info.innerHTML = '<p>The shop is not connected yet.</p>'; return; }
    info.innerHTML = `<p>${esc(e.message)}</p><a class="link-arrow" href="/product/${esc(handle)}">Open the page</a>`;
    return;
  }
  const p = data.product;
  current = p; chosen = null;
  const img = (p.images && p.images[0]) || null;
  view.innerHTML = img
    ? `<img src="${esc(imgUrl(img.src, 900))}" srcset="${esc(srcset(img.src, [540, 720, 960]))}" sizes="(min-width:880px) 360px, 80vw" alt="${esc(img.alt || p.title)}" width="900" height="700" decoding="async">`
    : '';
  viewer = bindViewer(view);

  const sizes = p.sizes || [];
  info.innerHTML = `
    <h2 class="piece__title" id="piece-title">${esc(p.title)}</h2>
    <p class="piece__price">${ngn(p.price)}</p>
    ${p.excerpt ? `<p>${esc(p.excerpt)}</p>` : ''}
    ${sizes.length ? `<div class="piece__sizes" role="radiogroup" aria-label="Size">${sizes.map((s) => `<button type="button" data-piece-size="${esc(s)}" role="radio" aria-checked="false">${esc(s)}</button>`).join('')}</div>` : ''}
    <button class="btn btn--blood" type="button" data-piece-add><span>Add to bag</span></button>
    <a class="link-arrow piece__more" href="/product/${esc(p.handle)}">Full details</a>`;
}
