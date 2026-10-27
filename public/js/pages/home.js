import { $, api, boot, esc, imgUrl, srcset, reduced, notConfigured } from '../core.js';
import { productCard, summonState, skeletonCards, mandalaSvg } from '../cards.js';
import { embers, reveals, magnetic } from '../fx.js';
import { openModal } from '../ui.js';

const S = boot.settings || {};

async function featured() {
  const grid = $('[data-featured]'); if (!grid) return;
  grid.innerHTML = skeletonCards(4);
  const f = S.featured || {};
  const q = f.productHandles && f.productHandles.length ? `handles=${encodeURIComponent(f.productHandles.join(','))}`
    : f.collectionHandle ? `collection=${encodeURIComponent(f.collectionHandle)}&per=8` : 'per=8';
  try {
    const r = await api(`/api/products?${q}`);
    grid.innerHTML = r.items.length ? r.items.slice(0, 8).map((p, i) => productCard(p, { index: i })).join('') : summonState();
  } catch (e) {
    grid.innerHTML = summonState(notConfigured(e) ? {} : { title: 'The realm is quiet', copy: 'The pieces could not be fetched just now. Refresh in a moment.' });
  }
  grid.removeAttribute('aria-busy');
  reveals(grid); magnetic(grid);
}

async function collections() {
  const sec = $('[data-home-collections]'); if (!sec) return;
  try {
    const r = await api('/api/collections');
    if (!r.items.length) return;
    $('[data-collections-rail]', sec).innerHTML = r.items.slice(0, 6).map((c, i) => `
      <a class="coll${c.image ? '' : ' coll--noimg'}" href="/collections/${esc(c.handle)}" data-cursor="view">
        ${c.image ? `<img src="${esc(imgUrl(c.image.src, 900))}" srcset="${esc(srcset(c.image.src, [480, 720, 960, 1280]))}" sizes="(min-width:900px) 31vw, 72vw" alt="" width="900" height="1200" loading="lazy" decoding="async">` : mandalaSvg()}
        <div class="coll__body"><span class="coll__n">${String(i + 1).padStart(2, '0')}</span><h3 class="coll__t">${esc(c.title)}</h3><span class="coll__c">${c.count} piece${c.count === 1 ? '' : 's'}</span></div>
      </a>`).join('');
    sec.hidden = false;
    reveals(sec);
  } catch (_) { /* section stays hidden */ }
}

function drop() {
  const sec = $('[data-drop]'); const d = S.drop || {};
  if (!sec || !d.enabled || !d.dateISO) return;
  const at = new Date(d.dateISO).getTime();
  if (!(at > Date.now())) return;
  $('[data-drop-title]', sec).textContent = d.title || 'The next drop';
  $('[data-drop-note]', sec).textContent = d.note || new Date(at).toLocaleString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }) + ' (WAT)';
  if (d.productHandle) $('[data-drop-link]', sec).href = `/product/${d.productHandle}`;
  const box = $('[data-countdown]', sec);
  const units = [['Days', 864e5], ['Hours', 36e5], ['Minutes', 6e4], ['Seconds', 1e3]];
  box.innerHTML = units.map(([l], i) => `${i ? '<span class="countdown__sep" aria-hidden="true">:</span>' : ''}<div class="countdown__u"><span class="countdown__n" data-u="${i}">00</span><span class="countdown__l">${l}</span></div>`).join('');
  const nums = box.querySelectorAll('[data-u]');
  const tick = () => {
    let left = Math.max(0, at - Date.now());
    units.forEach(([, ms], i) => { const v = Math.floor(left / ms); left -= v * ms; nums[i].textContent = String(v).padStart(2, '0'); });
    box.setAttribute('aria-label', `${nums[0].textContent} days ${nums[1].textContent} hours ${nums[2].textContent} minutes left`);
    if (at - Date.now() <= 0) { clearInterval(t); $('[data-drop-title]', sec).textContent = 'The drop is open'; }
  };
  const t = setInterval(tick, 1000); tick();
  sec.hidden = false;
}

function videos() {
  const hero = $('[data-hero-video]');
  if (hero) {
    if (reduced()) hero.pause();
    else hero.play().catch(() => { /* autoplay blocked: poster shows */ });
  }
  const film = $('[data-film-video]');
  if (film) {
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !reduced()) { film.preload = 'auto'; film.play().catch(() => {}); } else film.pause();
    }, { threshold: 0.2 }).observe(film);
  }
  const play = $('[data-film-play]');
  if (play) play.addEventListener('click', () => {
    if (hero) hero.pause();
    openModal('<h2 class="sr" id="modal-title">EOS film</h2><video class="film-player" src="/media/eos-film.mp4" poster="/media/eos-film-poster.jpg" controls autoplay playsinline></video>', {
      media: true, onClose: () => { if (hero && !reduced()) hero.play().catch(() => {}); },
    });
  });
}

export default function home() {
  embers($('[data-embers]'));
  videos();
  drop();
  featured();
  collections();
}
