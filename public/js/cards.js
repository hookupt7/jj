// Product card + empty "summoning" state renderers.
import { esc, ngn, priceRange, imgUrl, srcset } from './core.js';
import { wishlist } from './cart.js';
import { productKind } from './kind.js';
import { stageImg, colourIndex, swatchCss } from './media.js';

const mandalaSvg = () => {
  // Small inline ring (client-side twin of the server mandala, simplified).
  const ticks = Array.from({ length: 36 }, (_, i) => { const a = (i * 10 - 90) * Math.PI / 180; const r1 = i % 3 ? 92 : 86; return `<line x1="${100 + r1 * Math.cos(a)}" y1="${100 + r1 * Math.sin(a)}" x2="${100 + 98 * Math.cos(a)}" y2="${100 + 98 * Math.sin(a)}"/>`; }).join('');
  const pts = [0, 144, 288, 72, 216].map((d) => { const a = (d + 180 - 90) * Math.PI / 180; return `${(100 + 60 * Math.cos(a)).toFixed(2)} ${(100 + 60 * Math.sin(a)).toFixed(2)}`; });
  return `<svg class="mandala" viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="0.8"><circle cx="100" cy="100" r="98"/><circle cx="100" cy="100" r="80" stroke-dasharray="2 5"/><circle cx="100" cy="100" r="60"/><circle cx="100" cy="100" r="24"/>${ticks}<path d="M${pts.join(' L')} Z"/></g></svg>`;
};
export { mandalaSvg };

export function summonState({ title = 'The first drop is coming', copy = 'The first pieces are on their way. When they land they will appear here, and the ones on our list hear first.', actions = true } = {}) {
  return `<div class="summon summon--plain">
    <div>
      <p class="section-index"><span class="num">&#8224;</span><span>Soon</span></p>
      <h3 class="summon__title">${esc(title)}</h3>
      <p class="summon__copy">${esc(copy)}</p>
      ${actions ? `<div class="summon__actions"><a class="btn btn--blood" href="/join"><span>Join the cult</span></a><a class="link-arrow" href="https://www.tiktok.com/@_enemyofswag_" target="_blank" rel="noopener">Watch on TikTok <svg><use href="#i-arrow"/></svg></a></div>` : ''}
    </div>
  </div>`;
}

export function skeletonCards(n = 4) {
  return Array.from({ length: n }, () => '<div class="pc pc--skel" aria-hidden="true"><div class="pc__stage skel"></div><div class="pc__body"><span></span><span></span></div></div>').join('');
}

export const cardData = new Map();

// Base under the piece: tops hang from a hook, bottoms lie on a surface,
// footwear/headwear sit on a plinth, bags stand, jewellery rests on a pedestal.
export function baseHtml(display) {
  if (display === 'hang') return '<span class="pc__hook" aria-hidden="true"><svg viewBox="0 0 120 60"><path d="M60 4c6 0 10 4 10 9s-4 8-10 10v6M8 54 60 29l52 25" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  if (display === 'flat') return '<span class="pc__surface" aria-hidden="true"></span>';
  if (display === 'stand') return '<span class="pc__floor" aria-hidden="true"></span>';
  if (display === 'pedestal') return '<span class="pc__pedestal" aria-hidden="true"><i></i></span>';
  return '<span class="pc__plinth" aria-hidden="true"><i></i></span>';
}

export function swatchesHtml(p, { max = 5, attr = 'data-swatch' } = {}) {
  const cs = p.colours || [];
  if (cs.length < 2) return '';
  const shown = cs.slice(0, max);
  return `<div class="pc__swatches" role="group" aria-label="Colours">${shown.map((c, i) => {
    const bg = swatchCss(c);
    return `<button type="button" class="sw${i === 0 ? ' is-on' : ''}" ${attr}="${esc(c)}" data-handle="${esc(p.handle)}" aria-pressed="${i === 0}" aria-label="${esc(c)}" title="${esc(c)}"><i style="${bg ? `background:${bg}` : ''}">${bg ? '' : esc(c.slice(0, 1))}</i></button>`;
  }).join('')}${cs.length > max ? `<span class="pc__more">+${cs.length - max}</span>` : ''}</div>`;
}

export function productCard(p, { eager = false, index = 0 } = {}) {
  cardData.set(p.handle, p);
  const k = productKind(p);
  const first = (p.colours && p.colours.length) ? colourIndex(p, p.colours[0]) : 0;
  const img = (p.images || [])[first >= 0 ? first : 0];
  const flag = !p.available && !(p.drop && p.drop.preorder) ? '<span class="pc__flag pc__flag--out">Sold out</span>'
    : p.drop && p.drop.preorder ? '<span class="pc__flag">Pre-order</span>'
      : p.onSale ? '<span class="pc__flag pc__flag--sale">Sale</span>' : '';
  const price = p.compareAt ? `<s>${ngn(p.compareAt)}</s> ${ngn(p.price)}` : priceRange(p);
  const wished = wishlist.has(p.handle);
  const ncol = (p.colours || []).length;
  const meta = [p.type || k.label, ncol > 1 ? `${ncol} colours` : ''].filter(Boolean).join(' \u00B7 ');
  return `<article class="pc" data-kind="${k.kind}" data-display="${k.display}" data-handle="${esc(p.handle)}" data-reveal style="--i:${index % 4}">
    <div class="pc__stage">
      <a class="pc__link" href="/product/${esc(p.handle)}" aria-label="${esc(p.title)}">
        <span class="pc__glow" aria-hidden="true"></span>
        ${baseHtml(k.display)}
        <span class="pc__obj"><span class="pc__motion">${img ? stageImg(img, { w: 720, sizes: '(min-width:1100px) 25vw, (min-width:700px) 33vw, 50vw', cls: 'pc__img', lazy: !eager, alt: p.title }) : ''}</span></span>
        <span class="pc__shadow" aria-hidden="true"></span>
      </a>
      ${flag}
      <button class="pc__wish${wished ? ' is-on' : ''}" type="button" data-wish="${esc(p.handle)}" aria-pressed="${wished}" aria-label="${wished ? 'Remove from' : 'Save to'} wishlist"><svg><use href="#i-heart"/></svg></button>
      <button class="pc__qv" type="button" data-quick-view="${esc(p.handle)}" aria-label="Quick view: ${esc(p.title)}"><span>Quick view</span><svg><use href="#i-plus"/></svg></button>
    </div>
    <div class="pc__body">
      <p class="pc__meta">${esc(meta)}</p>
      <h3 class="pc__title"><a href="/product/${esc(p.handle)}">${esc(p.title)}</a></h3>
      <p class="pc__price">${price}</p>
      ${swatchesHtml(p)}
    </div>
  </article>`;
}

/** Card colour swatches swap the card image without leaving the grid. */
let swBound = false;
export function bindCardSwatches() {
  if (swBound) return; swBound = true;
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-swatch]'); if (!b) return;
    e.preventDefault();
    const p = cardData.get(b.dataset.handle); const card = b.closest('.pc'); if (!p || !card) return;
    const i = colourIndex(p, b.dataset.swatch); const im = p.images[i >= 0 ? i : 0];
    card.querySelectorAll('[data-swatch]').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    const host = card.querySelector('.pc__motion'); if (!host || !im) return;
    host.innerHTML = stageImg(im, { w: 720, sizes: '(min-width:1100px) 25vw, (min-width:700px) 33vw, 50vw', cls: 'pc__img is-swap', lazy: false, alt: `${p.title}, ${b.dataset.swatch}` });
    const link = card.querySelectorAll('a[href^="/product/"]');
    link.forEach((a) => { a.href = `/product/${p.handle}?colour=${encodeURIComponent(b.dataset.swatch)}`; });
  });
}

/** Animations only run while a card is on screen (battery, and smoother scroll). */
let io = null;
export function liveCards(root = document) {
  const cards = root.querySelectorAll('.pc:not([data-live])');
  if (!('IntersectionObserver' in window)) { cards.forEach((c) => c.classList.add('is-live')); return; }
  if (!io) io = new IntersectionObserver((ens) => ens.forEach((en) => en.target.classList.toggle('is-live', en.isIntersecting)), { rootMargin: '60px 0px' });
  cards.forEach((c) => {
    c.dataset.live = '1'; io.observe(c);
    c.addEventListener('touchstart', () => { c.classList.remove('is-tap'); void c.offsetWidth; c.classList.add('is-tap'); setTimeout(() => c.classList.remove('is-tap'), 520); }, { passive: true });
  });
}
