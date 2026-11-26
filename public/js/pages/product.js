// Product page. Layout, stage and the category panel follow the product kind:
// footwear on a plinth, bottoms laid flat, tops on a hanger, bags standing,
// headwear and jewellery on a pedestal.
import { $, $$, api, boot, esc, ngn, toast, notConfigured } from '../core.js';
import { cart, wishlist, recent, openDrawer } from '../cart.js';
import { productCard, summonState, baseHtml, bindCardSwatches, liveCards } from '../cards.js';
import { reveals } from '../fx.js';
import { openModal } from '../ui.js';
import { sizeGuideFor, waOrderHref, notifyHtml, bindNotify } from '../buy.js';
import { bindViewer, stageHtml, wasDrag } from '../viewer.js';
import { productKind, kindPage } from '../kind.js';
import { stageImg, stageUrl, colourIndex, imagesForColour, viewLabel, swatchCss } from '../media.js';
import { selection } from '../variants.js';

const S = boot.settings || {};

function shippingCopy() {
  const sh = S.shipping || {};
  const zones = [['lagos', 'Lagos'], ['southWest', 'South West'], ['other', 'Other states']];
  const rows = zones.map(([k, l]) => `<li><span>${l}</span><span>${sh[k] === null || sh[k] === undefined ? 'Confirmed on WhatsApp' : ngn(sh[k])}</span></li>`).join('');
  return `<p>We deliver anywhere in Nigeria.</p><ul class="pdp__rates">${rows}</ul>${sh.note ? `<p>${esc(sh.note)}</p>` : ''}${S.policies && S.policies.returns ? `<p>${esc(S.policies.returns)}</p>` : ''}<p><a class="u-link" href="/shipping-returns">Shipping &amp; returns policy</a></p>`;
}

const hasTag = (p, re) => (p.tags || []).some((t) => re.test(t));
const sizeSpan = (p) => (p.sizes && p.sizes.length > 1 ? `${p.sizes[0]} \u2013 ${p.sizes[p.sizes.length - 1]}` : (p.sizes && p.sizes[0]) || '');

// Facts for the floating glass cards, taken only from Shopify data.
function facts(p) {
  const out = [];
  if (hasTag(p, /^hand ?made$/i)) out.push(['Handmade', 'Sewn by hand']);
  if (hasTag(p, /made to order/i)) out.push(['Made to order', 'Produced for you']);
  if ((p.colours || []).length > 1) out.push([`${p.colours.length} colourways`, 'Tap a colour to switch']);
  if (sizeSpan(p)) out.push(['Sizes', sizeSpan(p)]);
  return out.slice(0, 3);
}

export default async function product() {
  const root = $('[data-product]'); if (!root) return;
  bindNotify(); bindCardSwatches();
  const handle = root.dataset.product;
  const info = $('[data-pinfo]', root); const box = $('[data-stagebox]', root); const views = $('[data-views]', root);
  let data;
  try { data = await api(`/api/products/${encodeURIComponent(handle)}`); } catch (e) {
    $('.pdp__media', root).hidden = true;
    info.innerHTML = notConfigured(e) ? summonState() : `<div class="empty"><h2>${e.status === 404 ? 'This piece is not available' : 'Something went wrong'}</h2><p>${e.status === 404 ? 'It may have sold out or been removed. The rest of the shop is waiting.' : esc(e.message)}</p><a class="btn btn--ghost" href="/shop"><span>Back to the shop</span></a></div>`;
    info.removeAttribute('aria-busy');
    return;
  }
  const p = data.product;
  const k = productKind(p);
  const page = kindPage(k.kind);
  Object.assign(root.dataset, { kind: k.kind, display: k.display, layout: page.layout });
  recent.push(p.handle);
  const crumb = $('[data-crumb-title]', root); if (crumb) crumb.textContent = p.title;

  const url = new URLSearchParams(location.search);
  const s = selection(p, { colour: url.get('colour'), size: url.get('size') });
  let imgs = []; let at = 0;

  /* ---------- stage ---------- */
  box.innerHTML = `${stageHtml({ kind: k.kind, display: k.display, base: baseHtml(k.display), cls: 'vw--pdp' })}
    <div class="pdp__facts" aria-hidden="true">${facts(p).map(([a, b], i) => `<span class="glass" style="--n:${i}"><b>${esc(a)}</b><small>${esc(b)}</small></span>`).join('')}</div>
    <button class="pdp__nav pdp__nav--prev" type="button" data-step="-1" aria-label="Previous image"><svg><use href="#i-arrow"/></svg></button>
    <button class="pdp__nav pdp__nav--next" type="button" data-step="1" aria-label="Next image"><svg><use href="#i-arrow"/></svg></button>
    <span class="pdp__count" data-count></span>`;
  const vw = $('[data-viewer]', box); const motion = $('[data-motion]', box);
  bindViewer(vw, { hint: page.hint });

  const show = (i, dir = 0) => {
    if (!imgs.length) { motion.innerHTML = ''; return; }
    at = (i + imgs.length) % imgs.length;
    const im = imgs[at];
    const next = document.createElement('div');
    next.className = `vw__img${dir ? ` is-in-${dir > 0 ? 'r' : 'l'}` : ''}`;
    next.innerHTML = stageImg(im, { w: 960, sizes: '(min-width:1000px) 52vw, 100vw', lazy: false, alt: im.alt || p.title, priority: !dir });
    motion.replaceChildren(next);
    $$('[data-view]', views).forEach((b) => b.setAttribute('aria-selected', String(Number(b.dataset.view) === at)));
    const c = $('[data-count]', box); if (c) c.textContent = imgs.length > 1 ? `${String(at + 1).padStart(2, '0')} / ${String(imgs.length).padStart(2, '0')}` : '';
    box.classList.toggle('is-single', imgs.length < 2);
  };
  const paintViews = () => {
    imgs = imagesForColour(p, s.colour());
    // Colour has a single photo: still offer every photo, its own first.
    if (imgs.length === 1 && p.images.length > 1 && !(p.colours || []).length) imgs = p.images.map((im, i) => ({ ...im, i }));
    views.innerHTML = imgs.length > 1 ? `<div class="views" role="tablist" aria-label="Views">${imgs.map((im, n) => `<button type="button" role="tab" class="views__b" data-view="${n}" aria-selected="${n === 0}"><span class="views__t">${stageImg(im, { w: 200, sizes: '80px', alt: '' })}</span><span class="views__l">${esc(viewLabel(im, n + 1))}</span></button>`).join('')}</div>` : '';
    show(0);
  };
  box.addEventListener('click', (e) => {
    const st = e.target.closest('[data-step]'); if (st) { show(at + Number(st.dataset.step), Number(st.dataset.step)); return; }
    if (e.target.closest('[data-viewer]') && !wasDrag(vw) && imgs[at]) zoom(imgs[at]);
  });
  views.addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) show(Number(b.dataset.view), Number(b.dataset.view) > at ? 1 : -1); });

  /* ---------- info ---------- */
  const out = !p.available && !s.preorder;
  const optColour = () => {
    if (!s.colourOpt) return '';
    const vals = s.colourOpt.values;
    if (vals.length < 2) return `<div class="opt"><p class="opt__head"><span>Colour</span><b>${esc(vals[0])}</b></p></div>`;
    return `<div class="opt"><p class="opt__head"><span>Colour</span><b data-sel-colour>${esc(s.colour() || '')}</b></p><div class="opt__colours" role="radiogroup" aria-label="Colour">${vals.map((c) => {
      const i = colourIndex(p, c); const bg = swatchCss(c);
      const inner = i >= 0 ? stageImg(p.images[i], { w: 200, sizes: '64px', alt: '' }) : `<i style="${bg ? `background:${bg}` : ''}"></i>`;
      return `<button type="button" role="radio" class="cw${i >= 0 ? ' cw--img' : ''}${s.canBuy(s.colourOpt.name, c) ? '' : ' is-out'}" data-colour="${esc(c)}" aria-checked="${c === s.colour()}" aria-label="${esc(c)}" title="${esc(c)}">${inner}${i >= 0 && bg ? `<em style="background:${bg}"></em>` : ''}</button>`;
    }).join('')}</div></div>`;
  };
  const optSize = () => (s.sizeOpt ? `<div class="opt"><p class="opt__head"><span>Size</span><b data-sel-size>${esc(s.size() || 'Select a size')}</b><button type="button" class="opt__guide" data-guide>${page.guide === 'headwear' ? 'Fit guide' : page.guide === 'details' ? 'Measurements' : 'Size guide'}</button></p><div class="opt__sizes${page.layout === 'footwear' ? ' opt__sizes--shoe' : ''}" role="radiogroup" aria-label="Size">${s.sizeOpt.values.map((x) => `<button type="button" role="radio" class="sz" data-size="${esc(x)}" aria-checked="${x === s.size()}">${esc(page.layout === 'footwear' ? x.replace(/^EU\s*/i, '') : x)}</button>`).join('')}</div>${page.layout === 'footwear' ? '<p class="opt__note">EU sizes</p>' : ''}</div>` : '');
  const others = s.options.filter((o) => o !== s.sizeOpt && o !== s.colourOpt);
  const wished = () => wishlist.has(p.handle);

  info.innerHTML = `
    <p class="pdp__kicker">${esc(k.label)}${p.type && p.type !== k.label ? ` <span>/</span> ${esc(p.type)}` : ''}</p>
    <h1 class="pdp__title">${esc(p.title)}</h1>
    <p class="pdp__price" data-price aria-live="polite"></p>
    <p class="pdp__stock" data-stock></p>
    ${glance(p, k, page)}
    ${optColour()}
    ${others.map((o) => `<div class="opt"><p class="opt__head"><span>${esc(o.name)}</span></p><div class="opt__sizes" role="radiogroup">${o.values.map((v) => `<button type="button" role="radio" class="sz" data-other="${esc(o.name)}" data-val="${esc(v)}" aria-checked="${s.sel[o.name] === v}">${esc(v)}</button>`).join('')}</div></div>`).join('')}
    ${optSize()}
    <div class="pdp__buy">
      <button class="btn btn--blood pdp__add" type="button" data-add ${out ? 'disabled' : ''}><span class="pdp__add-label">${out ? 'Sold out' : s.preorder ? 'Pre-order' : 'Add to bag'}</span><span class="spin" aria-hidden="true"></span></button>
      <button class="pdp__wish${wished() ? ' is-on' : ''}" type="button" data-pwish aria-pressed="${wished()}" aria-label="Save to wishlist"><svg><use href="#i-heart"/></svg></button>
    </div>
    <a class="btn btn--line pdp__wa" data-wa target="_blank" rel="noopener" href="${waOrderHref(p, null)}"><svg class="btn__icon"><use href="#i-whatsapp"/></svg><span>Order on WhatsApp</span></a>
    <div data-notify-box>${out ? notifyHtml(p, null) : ''}</div>
    <div class="acc">
      <details class="acc__i" open><summary>Description<svg><use href="#i-plus"/></svg></summary><div class="acc__b rte">${p.descriptionHtml || `<p>${esc(p.excerpt || '')}</p>`}</div></details>
      <details class="acc__i"><summary>${esc(page.focusTitle)}<svg><use href="#i-plus"/></svg></summary><div class="acc__b"><p>${esc(page.focusCopy)}</p>${s.sizeOpt ? '<button type="button" class="u-link" data-guide>Open the guide</button>' : ''}</div></details>
      <details class="acc__i"><summary>Delivery &amp; returns<svg><use href="#i-plus"/></svg></summary><div class="acc__b">${shippingCopy()}</div></details>
    </div>`;
  info.removeAttribute('aria-busy');

  const bar = $('[data-buybar]');
  const sync = () => {
    const v = s.variant();
    $('[data-price]', info).innerHTML = `${v && v.compareAt ? `<s>${ngn(v.compareAt)}</s> ` : ''}${ngn(v ? v.price : p.price)}`;
    const st = $('[data-stock]', info);
    st.className = 'pdp__stock';
    if (s.preorder) { st.textContent = 'Pre-order'; st.classList.add('is-pre'); }
    else if (!p.available) { st.textContent = 'Sold out'; st.classList.add('is-out'); }
    else if (v && !v.available) { st.textContent = 'Sold out in this option'; st.classList.add('is-out'); }
    else if (v && v.stock !== null && v.stock <= 3) { st.textContent = `Only ${v.stock} left`; st.classList.add('is-low'); }
    else st.textContent = hasTag(p, /made to order/i) ? 'Available \u00B7 made to order' : 'In stock';
    $$('[data-colour]', info).forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.colour === s.colour())); b.classList.toggle('is-out', !s.canBuy(s.colourOpt.name, b.dataset.colour)); });
    $$('[data-size]', info).forEach((b) => { const ok = s.canBuy(s.sizeOpt.name, b.dataset.size); b.setAttribute('aria-checked', String(b.dataset.size === s.size())); b.classList.toggle('is-out', !ok); b.setAttribute('aria-disabled', String(!ok)); });
    $$('[data-other]', info).forEach((b) => b.setAttribute('aria-checked', String(s.sel[b.dataset.other] === b.dataset.val)));
    const sc = $('[data-sel-colour]', info); if (sc) sc.textContent = s.colour() || '';
    const ss = $('[data-sel-size]', info); if (ss) ss.textContent = s.size() || 'Select a size';
    $('[data-wa]', info).href = waOrderHref(p, v);
    const add = $('[data-add]', info);
    const soldOpt = v && !v.available && !s.preorder;
    if (!add.classList.contains('is-done')) {
      add.disabled = out || Boolean(soldOpt);
      $('.pdp__add-label', add).textContent = out ? 'Sold out' : soldOpt ? 'Sold out in this option' : s.preorder ? 'Pre-order' : 'Add to bag';
    }
    $('[data-notify-box]', info).innerHTML = soldOpt ? notifyHtml(p, v) : (out ? notifyHtml(p, null) : '');
    if (bar) { $('[data-buybar-title]').textContent = p.title; $('[data-buybar-price]').textContent = `${ngn(v ? v.price : p.price)}${s.colour() ? ` \u00B7 ${s.colour()}` : ''}`; $('[data-buybar-add]').disabled = out; }
    const q = new URLSearchParams(location.search);
    if (s.colour() && (p.colours || []).length > 1) q.set('colour', s.colour()); if (s.size()) q.set('size', s.size());
    history.replaceState(null, '', `${location.pathname}${q.toString() ? `?${q}` : ''}`);
  };

  const addToBag = (btn) => {
    const v = s.variant();
    if (!v) {
      toast(s.sizeOpt && !s.size() ? 'Choose a size first' : 'Choose your options', { error: true });
      const g = $('.opt__sizes', info); if (g) { g.classList.add('is-nudge'); g.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => g.classList.remove('is-nudge'), 650); }
      return;
    }
    if (!v.available && !s.preorder) { toast('That option is sold out', { error: true }); return; }
    const i = s.colour() ? colourIndex(p, s.colour()) : 0; const im = p.images[i >= 0 ? i : 0];
    const main = $('[data-add]', info);
    main.classList.add('is-busy'); main.disabled = true; if (btn && btn !== main) btn.disabled = true;
    setTimeout(() => {
      const ok = cart.add({ variantId: v.id, handle: p.handle, title: p.title, variantTitle: v.title, price: v.price, image: im && im.src, max: s.preorder ? null : v.stock });
      main.classList.remove('is-busy');
      if (btn && btn !== main) btn.disabled = false;
      if (ok) {
        main.classList.add('is-done'); $('.pdp__add-label', main).textContent = 'Added to bag';
        openDrawer();
        setTimeout(() => { main.classList.remove('is-done'); sync(); }, 1800);
      } else main.disabled = false;
    }, 500);
  };

  info.addEventListener('click', (e) => {
    const c = e.target.closest('[data-colour]');
    if (c) { s.sel[s.colourOpt.name] = c.dataset.colour; paintViews(); sync(); return; }
    const z = e.target.closest('[data-size]');
    if (z) { if (z.getAttribute('aria-disabled') === 'true') { toast('That size is sold out in this colour', { error: true }); return; } s.sel[s.sizeOpt.name] = z.dataset.size; sync(); return; }
    const o = e.target.closest('[data-other]');
    if (o) { s.sel[o.dataset.other] = o.dataset.val; sync(); return; }
    if (e.target.closest('[data-guide]')) { openModal(sizeGuideFor(page.guide, p)); return; }
    if (e.target.closest('[data-add]')) { addToBag(); return; }
    const w = e.target.closest('[data-pwish]');
    if (w) { const on = wishlist.toggle(p.handle); w.classList.toggle('is-on', on); w.setAttribute('aria-pressed', String(on)); toast(on ? 'Saved to your wishlist' : 'Removed from your wishlist'); }
  });

  paintViews(); sync();

  /* ---------- sticky bar: only when the main button and the footer are both off screen ---------- */
  if (bar) {
    $('[data-buybar-add]').addEventListener('click', (e) => addToBag(e.currentTarget));
    let addVisible = true; let footVisible = false; let above = true;
    const upd = () => { const on = !addVisible && !footVisible && !above; bar.classList.toggle('is-on', on); document.body.classList.toggle('has-buybar', on); };
    bar.hidden = false;
    new IntersectionObserver(([en]) => { addVisible = en.isIntersecting; above = !en.isIntersecting && en.boundingClientRect.top > 0; upd(); }).observe($('.pdp__buy', info));
    const foot = $('.site-footer'); if (foot) new IntersectionObserver(([en]) => { footVisible = en.isIntersecting; upd(); }, { rootMargin: '0px 0px 40px 0px' }).observe(foot);
  }

  /* ---------- category panel ---------- */
  focusPanel(root, p, k, page);

  /* ---------- related + recently viewed ---------- */
  if (data.related && data.related.length) {
    $('[data-related-grid]', root).innerHTML = data.related.map((x, i) => productCard(x, { index: i })).join('');
    $('[data-related]', root).hidden = false;
  }
  const rv = recent.list().filter((h) => h !== p.handle).slice(0, 4);
  if (rv.length) {
    try {
      const r = await api(`/api/products?handles=${encodeURIComponent(rv.join(','))}`);
      if (r.items.length) { $('[data-recent-grid]', root).innerHTML = r.items.map((x, i) => productCard(x, { index: i })).join(''); $('[data-recent]', root).hidden = false; }
    } catch (_) { /* optional */ }
  }
  reveals(root); liveCards(root);
}

// Key facts row, worded for the category. Only data that exists is shown.
function glance(p, k, page) {
  const items = [];
  const ncol = (p.colours || []).length;
  const sizeLabel = { footwear: 'EU sizes', headwear: 'Fit', jewelry: 'Size', bag: 'Size', bottoms: 'Waist sizes', apparel: 'Sizes', soft: 'Sizes', accessory: 'Size' }[page.layout] || 'Sizes';
  items.push(['Category', p.type || k.label]);
  if (sizeSpan(p)) items.push([sizeLabel, page.layout === 'footwear' ? sizeSpan(p).replace(/EU\s*/gi, '') : sizeSpan(p)]);
  if (ncol > 1) items.push(['Colourways', String(ncol)]);
  if (hasTag(p, /^hand ?made$/i)) items.push(['Craft', 'Handmade']);
  else if (hasTag(p, /made to order/i)) items.push(['Made', 'To order']);
  return `<ul class="glance glance--${page.layout}">${items.slice(0, 4).map(([a, b]) => `<li><span>${esc(a)}</span><b>${esc(b)}</b></li>`).join('')}</ul>`;
}

// Category-specific section under the fold.
function focusPanel(root, p, k, page) {
  const sec = $('[data-focus]', root); if (!sec) return;
  const pairs = (p.colours || []).map((c) => ({ c, imgs: imagesForColour(p, c) }));
  let body = '';
  if (page.layout === 'bottoms' || page.layout === 'apparel') {
    const front = p.images.find((im) => /\bfront\b/i.test(im.alt || '')); const back = p.images.find((im) => /\bback\b/i.test(im.alt || ''));
    if (front && back) body = `<div class="fb"><figure class="fb__f">${stageImg(front, { w: 720, sizes: '(min-width:900px) 40vw, 46vw', alt: front.alt })}<figcaption>Front</figcaption></figure><figure class="fb__f">${stageImg(back, { w: 720, sizes: '(min-width:900px) 40vw, 46vw', alt: back.alt })}<figcaption>Back</figcaption></figure></div>`;
  }
  if (!body && pairs.length > 1 && pairs.every((x) => x.imgs.length)) {
    body = `<div class="lineup" data-display="${k.display}">${pairs.map(({ c, imgs }, n) => `<a class="lineup__i" href="?colour=${encodeURIComponent(c)}" data-lineup="${esc(c)}" style="--n:${n}"><span class="lineup__img">${stageImg(imgs[0], { w: 360, sizes: '(min-width:900px) 20vw, 42vw', alt: `${p.title}, ${c}` })}</span><span class="lineup__c">${esc(c)}</span></a>`).join('')}</div>`;
  }
  if (!body) return;
  const title = body.startsWith('<div class="fb"') ? 'Front and back' : 'Every colourway';
  sec.innerHTML = `<header class="section-head"><p class="section-index"><span class="num">&#8224;</span><span>${esc(k.label)}</span></p><h2 class="section-head__title display">${title}</h2></header>${body}`;
  sec.hidden = false;
  sec.addEventListener('click', (e) => {
    const a = e.target.closest('[data-lineup]'); if (!a) return;
    e.preventDefault();
    const b = document.querySelector(`[data-colour="${CSS.escape(a.dataset.lineup)}"]`);
    if (b) { b.click(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
}

function zoom(im) {
  const z = document.createElement('div');
  z.className = 'zoomer'; z.setAttribute('role', 'dialog'); z.setAttribute('aria-label', 'Zoomed image');
  z.innerHTML = `<img src="${esc(stageUrl(im.src, 1280))}" alt="${esc(im.alt || '')}"><button class="icon-btn" type="button" aria-label="Close zoom"><svg><use href="#i-close"/></svg></button>`;
  const close = () => { z.remove(); document.body.classList.remove('is-locked'); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  z.addEventListener('click', close); document.addEventListener('keydown', key);
  document.body.appendChild(z); document.body.classList.add('is-locked');
  z.querySelector('button').focus();
}
