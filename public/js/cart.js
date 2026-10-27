// Cart (localStorage), drawer, wishlist and recently viewed.
import { $, $$, api, boot, esc, ngn, store, toast, lockScroll, trapFocus, imgUrl } from './core.js';

const KEY = 'eos:cart:v1';
const listeners = new Set();
let lines = store.get(KEY, []).filter((l) => l && l.variantId && l.quantity > 0);

const save = () => { store.set(KEY, lines); listeners.forEach((fn) => fn(lines)); updateBadges(); };
export const cart = {
  get lines() { return lines; },
  count() { return lines.reduce((s, l) => s + l.quantity, 0); },
  subtotal() { return lines.reduce((s, l) => s + l.price * l.quantity, 0); },
  add(item, qty = 1) {
    const max = item.max === null || item.max === undefined ? 20 : Math.min(20, item.max);
    const ex = lines.find((l) => l.variantId === item.variantId);
    if (ex) {
      if (ex.quantity + qty > max) { ex.quantity = max; save(); toast(max ? `Only ${max} available` : 'Sold out', { error: true }); return false; }
      ex.quantity += qty;
    } else lines.push({ ...item, quantity: Math.min(qty, max), max: item.max ?? null });
    save();
    return true;
  },
  setQty(variantId, qty) {
    const l = lines.find((x) => x.variantId === variantId); if (!l) return;
    const max = l.max === null || l.max === undefined ? 20 : Math.min(20, l.max);
    l.quantity = Math.max(0, Math.min(max, qty));
    if (!l.quantity) lines = lines.filter((x) => x !== l);
    save();
  },
  remove(variantId) { lines = lines.filter((l) => l.variantId !== variantId); save(); },
  clear() { lines = []; save(); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  // Refresh prices/stock against Shopify.
  async validate() {
    if (!lines.length || !boot.shopifyConfigured) return;
    try {
      const r = await api('/api/cart/validate', { method: 'POST', body: { lines: lines.map((l) => ({ variantId: l.variantId })) } });
      let changed = false;
      r.lines.forEach((fresh) => {
        const l = lines.find((x) => x.variantId === fresh.variantId); if (!l) return;
        if (fresh.gone) { l.warn = 'No longer available'; l.unavailable = true; changed = true; return; }
        if (fresh.price !== l.price) { l.price = fresh.price; changed = true; }
        l.unavailable = !fresh.available; l.max = fresh.stock;
        l.warn = !fresh.available ? 'Sold out' : (fresh.stock !== null && l.quantity > fresh.stock ? `Only ${fresh.stock} left` : '');
        if (fresh.stock !== null && fresh.stock > 0 && l.quantity > fresh.stock) { l.quantity = fresh.stock; changed = true; }
      });
      save(); if (changed) renderDrawer();
    } catch (_) { /* keep local cart */ }
  },
};

/* ---------- wishlist + recently viewed ---------- */
const WKEY = 'eos:wish:v1';
let wish = store.get(WKEY, []);
export const wishlist = {
  list: () => wish,
  has: (h) => wish.includes(h),
  toggle(h) {
    wish = wish.includes(h) ? wish.filter((x) => x !== h) : [h, ...wish].slice(0, 60);
    store.set(WKEY, wish); updateBadges();
    return wish.includes(h);
  },
};
export const recent = {
  list: () => store.get('eos:recent:v1', []),
  push(h) { store.set('eos:recent:v1', [h, ...recent.list().filter((x) => x !== h)].slice(0, 12)); },
};

function updateBadges() {
  const n = cart.count();
  $$('[data-cart-count]').forEach((b) => { b.textContent = n; b.hidden = !n; });
  $$('[data-cart-count-text]').forEach((b) => { b.textContent = n ? `(${n})` : ''; });
  const w = wish.length;
  $$('[data-wish-count]').forEach((b) => { b.textContent = w; b.hidden = !w; });
}

/* ---------- drawer ---------- */
let release = null;
export function openDrawer() {
  const d = $('#cart-drawer'); if (!d) return;
  renderDrawer();
  d.hidden = false; lockScroll(true);
  requestAnimationFrame(() => d.classList.add('is-open'));
  release = trapFocus($('.drawer__panel', d), closeDrawer);
  cart.validate();
}
export function closeDrawer() {
  const d = $('#cart-drawer'); if (!d || d.hidden) return;
  d.classList.remove('is-open'); lockScroll(false);
  if (release) { release(); release = null; }
  setTimeout(() => { d.hidden = true; }, 560);
}

export function lineItemHtml(l, { editable = true } = {}) {
  return `<div class="line-item" data-line="${esc(l.variantId)}">
    ${l.image ? `<img class="line-item__img" src="${esc(imgUrl(l.image, 240))}" alt="" width="84" height="105" loading="lazy">` : '<div class="line-item__img"></div>'}
    <div>
      <div class="line-item__top"><div><a class="line-item__t" href="/product/${esc(l.handle)}">${esc(l.title)}</a>${l.variantTitle ? `<div class="line-item__v">${esc(l.variantTitle)}</div>` : ''}</div>
      <span class="line-item__p">${ngn(l.price * l.quantity)}</span></div>
      ${editable ? `<div class="line-item__row"><div class="qty"><button type="button" data-qty="-1" aria-label="Decrease"><svg><use href="#i-minus"/></svg></button><output aria-live="polite">${l.quantity}</output><button type="button" data-qty="1" aria-label="Increase"><svg><use href="#i-plus"/></svg></button></div><button class="text-btn" type="button" data-remove>Remove</button></div>` : `<div class="line-item__v">Qty ${l.quantity}</div>`}
      ${l.warn ? `<p class="line-item__warn">${esc(l.warn)}</p>` : ''}
    </div>
  </div>`;
}

export function deliveryNote() {
  const sh = (boot.settings && boot.settings.shipping) || {};
  const set = ['lagos', 'southWest', 'other'].filter((k) => sh[k] !== null && sh[k] !== undefined);
  return set.length ? 'Delivery calculated at checkout by state' : 'Delivery fee confirmed on WhatsApp';
}

export function renderDrawer() {
  const body = $('[data-cart-items]'); const foot = $('[data-cart-foot]');
  if (!body) return;
  updateBadges();
  if (!lines.length) {
    body.innerHTML = `<div class="drawer__empty"><p>Your cart is empty.<br>The realm is not.</p><a class="btn btn--ghost" href="/shop" data-magnetic><span>Enter the shop</span><svg class="btn__arrow"><use href="#i-arrow"/></svg></a></div>`;
    foot.innerHTML = '';
    return;
  }
  body.innerHTML = lines.map((l) => lineItemHtml(l)).join('');
  const blocked = lines.some((l) => l.unavailable);
  foot.innerHTML = `<dl class="totals"><div><dt>Subtotal</dt><dd>${ngn(cart.subtotal())}</dd></div><div class="is-muted"><dt>Delivery</dt><dd>${esc(deliveryNote())}</dd></div></dl>
    <button class="btn btn--blood btn--wide" type="button" data-go-checkout ${blocked ? 'disabled' : ''}><span>${blocked ? 'Remove sold out pieces' : 'Checkout'}</span></button>
    <p class="drawer__note">Discount codes are applied at checkout. ${boot.checkoutMode === 'shopify' ? '' : 'Payment is confirmed with you on WhatsApp.'}</p>`;
}

export async function goCheckout(btn) {
  if (!lines.length) return;
  if (boot.checkoutMode === 'shopify') {
    try {
      if (btn) btn.classList.add('is-busy');
      const r = await api('/api/checkout/shopify', { method: 'POST', body: { lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) } });
      location.href = r.checkoutUrl;
    } catch (e) { toast(e.message, { error: true }); if (btn) btn.classList.remove('is-busy'); }
    return;
  }
  location.href = '/checkout';
}

export function initCart() {
  updateBadges();
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cart-open]')) { e.preventDefault(); openDrawer(); return; }
    if (e.target.closest('[data-cart-close]')) { closeDrawer(); return; }
    const go = e.target.closest('[data-go-checkout]'); if (go) { goCheckout(go); return; }
    const row = e.target.closest('#cart-drawer [data-line]');
    if (row) {
      const id = row.dataset.line;
      const q = e.target.closest('[data-qty]');
      if (q) { const l = lines.find((x) => x.variantId === id); if (l) cart.setQty(id, l.quantity + Number(q.dataset.qty)); renderDrawer(); }
      if (e.target.closest('[data-remove]')) { cart.remove(id); renderDrawer(); }
    }
    const w = e.target.closest('[data-wish]');
    if (w) {
      e.preventDefault();
      const on = wishlist.toggle(w.dataset.wish);
      w.classList.toggle('is-on', on); w.setAttribute('aria-pressed', String(on));
      w.setAttribute('aria-label', `${on ? 'Remove from' : 'Save to'} wishlist`);
      toast(on ? 'Saved to your wishlist' : 'Removed from your wishlist');
    }
  });
  window.addEventListener('storage', (e) => { if (e.key === KEY) { lines = store.get(KEY, []); updateBadges(); renderDrawer(); } });
}
