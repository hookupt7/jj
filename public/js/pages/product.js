import { $, $$, api, boot, esc, ngn, imgUrl, srcset, colourCss, toast, isTouch, notConfigured, waLink } from '../core.js';
import { cart, wishlist, recent, openDrawer } from '../cart.js';
import { productCard, summonState } from '../cards.js';
import { reveals, magnetic } from '../fx.js';
import { openModal } from '../ui.js';

const S = boot.settings || {};
const isSize = (n) => /^size$/i.test(n);
const isColour = (n) => /^colou?r$/i.test(n);

function shippingCopy() {
  const sh = S.shipping || {};
  const zones = [['lagos', 'Lagos'], ['southWest', 'South West'], ['other', 'Other states']];
  const rows = zones.map(([k, l]) => `<li>${l}: ${sh[k] === null || sh[k] === undefined ? 'delivery fee confirmed on WhatsApp' : ngn(sh[k])}</li>`).join('');
  return `<p>We deliver anywhere in Nigeria.</p><ul>${rows}</ul>${sh.note ? `<p>${esc(sh.note)}</p>` : ''}<p>${esc((S.policies && S.policies.returns) || '')}</p><p><a href="/shipping-returns">Shipping &amp; returns policy</a></p>`;
}

function sizeGuideHtml() {
  const g = S.sizeGuide || { rows: [] };
  const table = g.rows && g.rows.length
    ? `<div class="sizeguide"><table><thead><tr><th scope="col">Size</th><th scope="col">Chest (${esc(g.unit)})</th><th scope="col">Length (${esc(g.unit)})</th>${g.rows.some((r) => r.sleeve) ? `<th scope="col">Sleeve (${esc(g.unit)})</th>` : ''}</tr></thead><tbody>${g.rows.map((r) => `<tr><td>${esc(r.size)}</td><td>${esc(r.chest)}</td><td>${esc(r.length)}</td>${g.rows.some((x) => x.sleeve) ? `<td>${esc(r.sleeve)}</td>` : ''}</tr>`).join('')}</tbody></table></div>`
    : `<p>Exact measurements for this piece are confirmed on WhatsApp. Send us your usual size and we will tell you which one to take.</p><a class="btn btn--blood" href="${waLink('Hi EOS, I need help with sizing.')}" target="_blank" rel="noopener"><svg class="btn__icon"><use href="#i-whatsapp"/></svg><span>Ask on WhatsApp</span></a>`;
  return `<h2 id="modal-title">Size guide</h2>${table}${g.note ? `<p style="margin-top:16px">${esc(g.note)}</p>` : ''}
    <div class="sizeguide__how"><p><b>Chest.</b> Lay a tee you love flat. Measure straight across, armpit to armpit.</p><p><b>Length.</b> From the highest point of the shoulder down to the hem.</p><p><b>Between sizes?</b> Size up for a heavier, oversized drop. Size down for a closer fit.</p></div>`;
}

export default async function product() {
  const root = $('[data-product]'); if (!root) return;
  const handle = root.dataset.product;
  const info = $('[data-pinfo]', root); const gallery = $('[data-gallery]', root);
  let data;
  try { data = await api(`/api/products/${encodeURIComponent(handle)}`); } catch (e) {
    gallery.hidden = true;
    info.innerHTML = notConfigured(e) ? summonState() : `<div class="empty"><h2>${e.status === 404 ? 'This piece does not exist' : 'The realm is quiet'}</h2><p>${e.status === 404 ? 'Or it no longer does. The shop has others waiting.' : esc(e.message)}</p><a class="btn btn--ghost" href="/shop"><span>Enter the shop</span><svg class="btn__arrow"><use href="#i-arrow"/></svg></a></div>`;
    root.querySelector('.product__grid').style.display = 'block';
    return;
  }
  const p = data.product;
  recent.push(p.handle);

  /* ---------- gallery ---------- */
  const images = p.images.length ? p.images : [];
  let idx = 0;
  const main = $('[data-main-image]', root); const thumbs = $('[data-thumbs]', root);
  const showImage = (i) => {
    if (!images.length) return;
    idx = (i + images.length) % images.length;
    const im = images[idx];
    main.innerHTML = `<img src="${esc(imgUrl(im.src, 1200))}" srcset="${esc(srcset(im.src, [540, 720, 960, 1280, 1600]))}" sizes="(min-width:1000px) 55vw, 100vw" alt="${esc(im.alt)}" ${im.w ? `width="${im.w}" height="${im.h}"` : ''} ${idx ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">
      <div class="gallery__lens" aria-hidden="true"></div>
      <span class="gallery__count">${String(idx + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}</span>
      <button class="icon-btn gallery__zoombtn" type="button" data-zoom aria-label="Zoom image"><svg><use href="#i-zoom"/></svg></button>`;
    $$('button', thumbs).forEach((b, j) => b.setAttribute('aria-selected', String(j === idx)));
    const lens = $('.gallery__lens', main);
    lens.style.backgroundImage = `url("${imgUrl(im.src, 2000)}")`;
  };
  if (images.length) {
    thumbs.innerHTML = images.length > 1 ? images.map((im, i) => `<button type="button" role="tab" aria-label="Image ${i + 1}" aria-selected="${i === 0}" data-i="${i}"><img src="${esc(imgUrl(im.src, 200))}" alt="" width="76" height="95" loading="lazy"></button>`).join('') : '';
    showImage(0);
  } else main.innerHTML = '<div class="gallery__ph skel"></div>';
  gallery.removeAttribute('aria-busy');
  thumbs.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) showImage(Number(b.dataset.i)); });
  if (!isTouch()) {
    main.addEventListener('pointermove', (e) => {
      const lens = $('.gallery__lens', main); if (!lens) return;
      const r = main.getBoundingClientRect();
      lens.style.backgroundPosition = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
      main.classList.add('is-zoom');
    });
    main.addEventListener('pointerleave', () => main.classList.remove('is-zoom'));
  }
  const openZoom = () => {
    if (!images.length) return;
    const z = document.createElement('div');
    z.className = 'zoomer'; z.setAttribute('role', 'dialog'); z.setAttribute('aria-label', 'Zoomed image');
    z.innerHTML = `<img src="${esc(imgUrl(images[idx].src, 2400))}" alt="${esc(images[idx].alt)}"><button class="icon-btn" type="button" aria-label="Close zoom"><svg><use href="#i-close"/></svg></button>`;
    const close = () => { z.remove(); document.body.classList.remove('is-locked'); document.removeEventListener('keydown', key); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    z.addEventListener('click', close); document.addEventListener('keydown', key);
    document.body.appendChild(z); document.body.classList.add('is-locked');
    requestAnimationFrame(() => { z.scrollLeft = (z.scrollWidth - z.clientWidth) / 2; z.scrollTop = (z.scrollHeight - z.clientHeight) / 3; });
    z.querySelector('button').focus();
  };
  main.addEventListener('click', openZoom);
  let sx = 0;
  main.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  main.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) { showImage(idx + (dx < 0 ? 1 : -1)); } }, { passive: true });

  /* ---------- options + variant state ---------- */
  const options = p.options || [];
  const sizeOpt = options.find((o) => isSize(o.name));
  const colourOpt = options.find((o) => isColour(o.name));
  const otherOpts = options.filter((o) => o !== sizeOpt && o !== colourOpt);
  const url = new URLSearchParams(location.search);
  const sel = {};
  const firstAvail = p.variants.find((v) => v.available) || p.variants[0];
  options.forEach((o) => { sel[o.name] = (firstAvail && firstAvail.options[o.name]) || o.values[0]; });
  if (sizeOpt) { const want = url.get('size'); sel[sizeOpt.name] = want && sizeOpt.values.includes(want) ? want : (p.variants.length > 1 ? null : sel[sizeOpt.name]); }
  const preorder = Boolean(p.drop && p.drop.preorder);
  const match = (s) => p.variants.find((v) => Object.entries(s).every(([k, val]) => val === null || v.options[k] === val));
  const exact = () => (options.every((o) => sel[o.name]) ? p.variants.find((v) => options.every((o) => v.options[o.name] === sel[o.name])) : (options.length ? null : p.variants[0]));
  const availFor = (name, value) => { const v = match({ ...sel, [name]: value, ...(isSize(name) ? {} : sizeOpt ? { [sizeOpt.name]: null } : {}) }); return v && (v.available || preorder); };

  const priceHtml = (v) => {
    const price = v ? v.price : p.price; const cmp = v ? v.compareAt : p.compareAt;
    return `${cmp ? `<s>${ngn(cmp)}</s>` : ''}<span>${!v && p.maxPrice > p.price ? 'From ' : ''}${ngn(price)}</span>${cmp ? `<span class="tag">-${Math.round((1 - price / cmp) * 100)}%</span>` : ''}`;
  };
  const stockHtml = (v) => {
    if (preorder) return '<p class="pinfo__stock is-pre"><i></i>Pre-order</p>';
    if (!p.available) return '<p class="pinfo__stock is-out"><i></i>Sold out</p>';
    if (!v) return '<p class="pinfo__stock"><i></i>In stock</p>';
    if (!v.available) return '<p class="pinfo__stock is-out"><i></i>Sold out in this size</p>';
    if (v.stock !== null && v.stock <= 3) return `<p class="pinfo__stock is-low"><i></i>Only ${v.stock} left</p>`;
    return '<p class="pinfo__stock"><i></i>In stock</p>';
  };
  const dropHtml = () => {
    const d = p.drop || {};
    if (!d.preorder && !d.dropAt) return '';
    const when = d.dropAt ? new Date(d.dropAt).toLocaleString('en-NG', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }) + ' WAT' : '';
    return `<div class="pinfo__drop"><strong>${d.preorder ? 'Pre-order' : 'Drop'}</strong>${d.note ? esc(d.note) + ' ' : ''}${when ? `${d.preorder ? 'Ships after' : 'Drops'} ${esc(when)}.` : 'We confirm the ship date with you on WhatsApp.'}</div>`;
  };

  const wished = () => wishlist.has(p.handle);
  info.innerHTML = `
    ${p.type ? `<p class="pinfo__type">${esc(p.type)}</p>` : ''}
    <h1 class="pinfo__title">${esc(p.title)}</h1>
    <p class="pinfo__price price" data-price aria-live="polite"></p>
    <div data-stock></div>
    ${dropHtml()}
    ${colourOpt ? `<div class="pinfo__opt"><div class="pinfo__opt-head"><span>Colour<b data-sel-colour></b></span></div><div class="swatches" role="radiogroup" aria-label="Colour">${colourOpt.values.map((c) => `<button type="button" class="swatch" role="radio" data-opt="${esc(colourOpt.name)}" data-val="${esc(c)}">${colourCss(c) ? `<i style="background:${colourCss(c)}"></i>` : ''}${esc(c)}</button>`).join('')}</div></div>` : ''}
    ${otherOpts.map((o) => `<div class="pinfo__opt"><div class="pinfo__opt-head"><span>${esc(o.name)}</span></div><div class="sizes" role="radiogroup" aria-label="${esc(o.name)}">${o.values.map((val) => `<button type="button" class="size" role="radio" data-opt="${esc(o.name)}" data-val="${esc(val)}">${esc(val)}</button>`).join('')}</div></div>`).join('')}
    ${sizeOpt ? `<div class="pinfo__opt"><div class="pinfo__opt-head"><span>Size<b data-sel-size></b></span><button class="text-btn" type="button" data-size-guide>Size guide</button></div><div class="sizes" role="radiogroup" aria-label="Size">${sizeOpt.values.map((s) => `<button type="button" class="size" role="radio" data-opt="${esc(sizeOpt.name)}" data-val="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>` : ''}
    <div class="pinfo__actions">
      <div class="qty"><button type="button" data-q="-1" aria-label="Decrease quantity"><svg><use href="#i-minus"/></svg></button><output data-qv aria-live="polite">1</output><button type="button" data-q="1" aria-label="Increase quantity"><svg><use href="#i-plus"/></svg></button></div>
      <button class="btn btn--blood" type="button" data-add data-magnetic><span>Add to cart</span></button>
      <button class="btn btn--ghost" type="button" data-buy><span>Buy now</span></button>
    </div>
    <button class="text-btn pinfo__wish${wished() ? ' is-on' : ''}" type="button" data-pwish aria-pressed="${wished()}"><svg><use href="#i-heart"/></svg><span>${wished() ? 'Saved to wishlist' : 'Save to wishlist'}</span></button>
    ${p.descriptionHtml ? `<div class="pinfo__desc">${p.descriptionHtml}</div>` : ''}
    <div class="accordion">
      <details><summary><span>Shipping &amp; returns</span><svg><use href="#i-plus"/></svg></summary><div class="accordion__body">${shippingCopy()}</div></details>
      <details><summary><span>Payment</span><svg><use href="#i-plus"/></svg></summary><div class="accordion__body"><p>${esc((S.payment && S.payment.instructions) || '')}</p></div></details>
      <details><summary><span>Need help?</span><svg><use href="#i-plus"/></svg></summary><div class="accordion__body"><p>Questions about fit, colour or delivery? <a href="${waLink(`Hi EOS, I have a question about ${p.title}.`)}" target="_blank" rel="noopener">Ask us on WhatsApp</a>.</p></div></details>
    </div>`;

  let qty = 1;
  const sticky = $('[data-sticky-buy]');
  const update = () => {
    const v = exact();
    $('[data-price]', info).innerHTML = priceHtml(v);
    $('[data-stock]', info).innerHTML = stockHtml(v);
    $$('[data-opt]', info).forEach((b) => {
      const on = sel[b.dataset.opt] === b.dataset.val;
      b.setAttribute('aria-checked', String(on));
      const ok = availFor(b.dataset.opt, b.dataset.val);
      b.classList.toggle('is-out', !ok);
      b.setAttribute('aria-label', `${b.dataset.val}${ok ? '' : ', sold out'}`);
    });
    if (sizeOpt) $('[data-sel-size]', info).textContent = sel[sizeOpt.name] ? ` \u2014 ${sel[sizeOpt.name]}` : '';
    if (colourOpt) $('[data-sel-colour]', info).textContent = sel[colourOpt.name] ? ` \u2014 ${sel[colourOpt.name]}` : '';
    const add = $('[data-add]', info); const buy = $('[data-buy]', info);
    const can = v ? (v.available || preorder) : options.some((o) => !sel[o.name]);
    add.disabled = !can; buy.disabled = !can;
    add.querySelector('span').textContent = !p.available && !preorder ? 'Sold out' : v && !v.available && !preorder ? 'Sold out' : preorder ? 'Pre-order' : 'Add to cart';
    const max = v && v.stock !== null && !preorder ? v.stock : 20;
    if (qty > max) qty = Math.max(1, max);
    $('[data-qv]', info).textContent = qty;
    if (sticky) { $('[data-sticky-title]').textContent = p.title; $('[data-sticky-price]').textContent = ngn(v ? v.price : p.price); $('[data-sticky-add]').disabled = !can; }
  };
  update();

  const addToCart = () => {
    const v = exact();
    if (!v) {
      const missing = options.find((o) => !sel[o.name]);
      toast(`Choose a ${missing ? missing.name.toLowerCase() : 'size'} first`, { error: true });
      const group = missing && $(`[data-opt="${CSS.escape(missing.name)}"]`, info);
      if (group) group.closest('.pinfo__opt').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    if (!v.available && !preorder) { toast('Sold out in this size', { error: true }); return false; }
    const ok = cart.add({ variantId: v.id, handle: p.handle, title: p.title, variantTitle: v.title, price: v.price, image: images[0] && images[0].src, max: preorder ? null : v.stock }, qty);
    return ok;
  };
  info.addEventListener('click', (e) => {
    const o = e.target.closest('[data-opt]');
    if (o) { sel[o.dataset.opt] = o.dataset.val; update(); return; }
    const q = e.target.closest('[data-q]');
    if (q) { qty = Math.max(1, Math.min(20, qty + Number(q.dataset.q))); update(); return; }
    if (e.target.closest('[data-add]')) { if (addToCart()) { toast(`${p.title} added`); openDrawer(); } return; }
    if (e.target.closest('[data-buy]')) { if (addToCart()) location.href = boot.checkoutMode === 'shopify' ? '/checkout?go=shopify' : '/checkout'; return; }
    if (e.target.closest('[data-size-guide]')) { openModal(sizeGuideHtml()); return; }
    const w = e.target.closest('[data-pwish]');
    if (w) { const on = wishlist.toggle(p.handle); w.classList.toggle('is-on', on); w.setAttribute('aria-pressed', String(on)); w.querySelector('span').textContent = on ? 'Saved to wishlist' : 'Save to wishlist'; toast(on ? 'Saved to your wishlist' : 'Removed from your wishlist'); }
  });
  if (sticky) {
    $('[data-sticky-add]').addEventListener('click', () => { if (addToCart()) { toast(`${p.title} added`); openDrawer(); } });
    const addBtn = $('[data-add]', info);
    new IntersectionObserver(([en]) => { sticky.hidden = false; sticky.classList.toggle('is-on', !en.isIntersecting && en.boundingClientRect.top < 0); }).observe(addBtn);
  }
  magnetic(info);

  /* ---------- related + recently viewed ---------- */
  if (data.related.length) {
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
  reveals(root); magnetic(root);
}
