import { $, api, esc, imgUrl, srcset, notConfigured } from '../core.js';
import { summonState, mandalaSvg } from '../cards.js';
import { reveals } from '../fx.js';

export default async function collections() {
  const grid = $('[data-collections]'); if (!grid) return;
  grid.innerHTML = '<div class="coll skel"></div><div class="coll skel"></div><div class="coll skel"></div>';
  try {
    const r = await api('/api/collections');
    grid.innerHTML = r.items.length ? r.items.map((c, i) => `
      <a class="coll${c.image ? '' : ' coll--noimg'}" href="/collections/${esc(c.handle)}" data-cursor="view" data-reveal>
        ${c.image ? `<img src="${esc(imgUrl(c.image.src, 900))}" srcset="${esc(srcset(c.image.src, [480, 720, 960, 1280]))}" sizes="(min-width:1100px) 31vw, (min-width:700px) 48vw, 100vw" alt="" width="900" height="1200" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async">` : mandalaSvg()}
        <div class="coll__body"><span class="coll__n">${String(i + 1).padStart(2, '0')}</span><h2 class="coll__t">${esc(c.title)}</h2><span class="coll__c">${c.count} piece${c.count === 1 ? '' : 's'}</span></div>
      </a>`).join('') : summonState({ title: 'No collections yet', copy: 'The first collection is being summoned. When it crosses over, it will appear here.' });
  } catch (e) {
    grid.innerHTML = notConfigured(e) ? summonState() : `<div class="empty"><h2>The realm is quiet</h2><p>${esc(e.message)}</p></div>`;
  }
  grid.removeAttribute('aria-busy');
  reveals(grid);
}
