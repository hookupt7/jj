import { $, api, esc, notConfigured } from '../core.js';
import { wishlist } from '../cart.js';
import { productCard, summonState } from '../cards.js';
import { reveals } from '../fx.js';

export default async function wishlistPage() {
  const grid = $('[data-wishlist]'); const meta = $('[data-wish-meta]');
  const list = wishlist.list();
  const empty = () => { grid.innerHTML = '<div class="empty"><h2>Nothing craved yet</h2><p>Tap the heart on any piece to keep it here. Your wishlist lives on this device.</p><a class="btn btn--ghost" href="/shop"><span>Enter the shop</span><svg class="btn__arrow"><use href="#i-arrow"/></svg></a></div>'; meta.textContent = ''; };
  if (!list.length) { empty(); grid.removeAttribute('aria-busy'); return; }
  try {
    const r = await api(`/api/products?handles=${encodeURIComponent(list.slice(0, 24).join(','))}`);
    if (!r.items.length) empty();
    else { grid.innerHTML = r.items.map((p, i) => productCard(p, { index: i })).join(''); meta.textContent = `${r.items.length} piece${r.items.length === 1 ? '' : 's'} saved on this device`; }
  } catch (e) { grid.innerHTML = notConfigured(e) ? summonState() : `<div class="empty"><h2>The realm is quiet</h2><p>${esc(e.message)}</p></div>`; }
  grid.removeAttribute('aria-busy');
  grid.addEventListener('click', (e) => { const w = e.target.closest('[data-wish]'); if (w && !wishlist.has(w.dataset.wish)) setTimeout(() => { w.closest('.card').remove(); if (!grid.children.length) empty(); }, 250); });
  reveals(grid);
}
