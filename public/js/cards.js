// Product card + empty "summoning" state renderers.
import { esc, ngn, priceRange, imgUrl, srcset } from './core.js';
import { wishlist } from './cart.js';

const mandalaSvg = () => {
  // Small inline ring (client-side twin of the server mandala, simplified).
  const ticks = Array.from({ length: 36 }, (_, i) => { const a = (i * 10 - 90) * Math.PI / 180; const r1 = i % 3 ? 92 : 86; return `<line x1="${100 + r1 * Math.cos(a)}" y1="${100 + r1 * Math.sin(a)}" x2="${100 + 98 * Math.cos(a)}" y2="${100 + 98 * Math.sin(a)}"/>`; }).join('');
  const pts = [0, 144, 288, 72, 216].map((d) => { const a = (d + 180 - 90) * Math.PI / 180; return `${(100 + 60 * Math.cos(a)).toFixed(2)} ${(100 + 60 * Math.sin(a)).toFixed(2)}`; });
  return `<svg class="mandala" viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="0.8"><circle cx="100" cy="100" r="98"/><circle cx="100" cy="100" r="80" stroke-dasharray="2 5"/><circle cx="100" cy="100" r="60"/><circle cx="100" cy="100" r="24"/>${ticks}<path d="M${pts.join(' L')} Z"/></g></svg>`;
};
export { mandalaSvg };

export function summonState({ title = 'The first drop is being summoned', copy = 'Nothing has crossed over yet. When the first pieces arrive they will appear here, and the ones on our list hear first.', actions = true } = {}) {
  return `<div class="summon">
    <div class="summon__ring">${mandalaSvg()}</div>
    <div>
      <p class="section-index"><span class="num">&#8224;</span><span>Soon</span></p>
      <h3 class="summon__title">${esc(title)}</h3>
      <p class="summon__copy">${esc(copy)}</p>
      ${actions ? `<div class="summon__actions"><a class="btn btn--blood" href="/#cult-title" data-magnetic><span>Join the cult</span></a><a class="link-arrow" href="https://www.tiktok.com/@_enemyofswag_" target="_blank" rel="noopener">Watch on TikTok <svg><use href="#i-arrow"/></svg></a></div>` : ''}
    </div>
  </div>`;
}

export function skeletonCards(n = 4) {
  return Array.from({ length: n }, () => '<div class="card card--skel" aria-hidden="true"><div class="card__media skel"></div><div class="card__body"><span></span><span></span></div></div>').join('');
}

const sizeRank = (s) => { const o = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL']; const i = o.indexOf(String(s).toUpperCase()); return i < 0 ? 99 : i; };

export const cardData = new Map();
export function productCard(p, { eager = false, index = 0 } = {}) {
  cardData.set(p.handle, p);
  const [a, b] = p.images || [];
  const sizes = '(min-width: 1200px) 24vw, (min-width: 900px) 31vw, 48vw';
  const imgTag = (img, cls, lazy) => img ? `<img class="${cls}" src="${esc(imgUrl(img.src, 720))}" srcset="${esc(srcset(img.src))}" sizes="${sizes}" alt="${esc(img.alt || p.title)}" ${img.w ? `width="${img.w}" height="${img.h}"` : 'width="800" height="1000"'} loading="${lazy ? 'lazy' : 'eager'}" decoding="async">` : '';
  const flag = !p.available && !(p.drop && p.drop.preorder) ? '<span class="card__flag card__flag--out">Sold out</span>'
    : p.drop && p.drop.preorder ? '<span class="card__flag">Pre-order</span>'
      : p.onSale ? '<span class="card__flag card__flag--sale">Sale</span>' : '';
  const price = p.compareAt ? `<s>${ngn(p.compareAt)}</s>${ngn(p.price)}` : priceRange(p);
  const wished = wishlist.has(p.handle);
  const quick = p.quick
    ? `<button type="button" data-quick-add="${esc(p.quick.id)}" data-handle="${esc(p.handle)}" ${p.quick.available || (p.drop && p.drop.preorder) ? '' : 'disabled'}>Add to cart</button>`
    : (p.sizes && p.sizes.length ? [...p.sizes].sort((x, y) => sizeRank(x) - sizeRank(y)).map((s) => `<a href="/product/${esc(p.handle)}?size=${encodeURIComponent(s)}" aria-label="${esc(p.title)} size ${esc(s)}">${esc(s)}</a>`).join('') : '');
  const meta = [p.type, p.colours && p.colours.length > 1 ? `${p.colours.length} colours` : (p.colours && p.colours[0]) || ''].filter(Boolean).join(' \u2014 ');
  return `<article class="card" data-reveal style="transition-delay:${(index % 4) * 70}ms">
    <div class="card__frame">
      <a class="card__media${a ? '' : ' skel'}" href="/product/${esc(p.handle)}" data-cursor="view" aria-label="${esc(p.title)}">
        ${imgTag(a, 'card__img card__img--1', !eager)}${imgTag(b, 'card__img card__img--2', true)}
      </a>
      ${flag}
      <button class="icon-btn card__wish${wished ? ' is-on' : ''}" type="button" data-wish="${esc(p.handle)}" aria-pressed="${wished}" aria-label="${wished ? 'Remove from' : 'Save to'} wishlist"><svg><use href="#i-heart"/></svg></button>
      ${quick ? `<div class="card__quick">${quick}</div>` : ''}
    </div>
    <div class="card__body">
      <h3 class="card__title"><a href="/product/${esc(p.handle)}">${esc(p.title)}</a></h3>
      <span class="card__price">${price}</span>
      ${meta ? `<span class="card__meta">${esc(meta)}</span>` : ''}
    </div>
  </article>`;
}
