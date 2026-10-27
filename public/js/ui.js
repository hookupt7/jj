// Chrome: header, mobile menu, search, modal, newsletter, quick add.
import { $, $$, api, boot, esc, ngn, priceRange, imgUrl, toast, lockScroll, trapFocus, debounce, waLink, setBusy, notConfigured } from './core.js';
import { cart, openDrawer } from './cart.js';
import { cardData } from './cards.js';
import { magnetic } from './fx.js';

export function header() {
  const h = $('.site-header'); if (!h) return;
  const ann = $('.announce');
  const setAnn = () => document.documentElement.style.setProperty('--announce-h', ann ? `${Math.max(0, ann.offsetHeight - scrollY)}px` : '0px');
  let last = scrollY;
  const onScroll = () => {
    const y = scrollY;
    h.classList.toggle('is-solid', y > 40);
    h.classList.toggle('is-hidden', y > 400 && y > last + 4 && !document.body.classList.contains('is-locked'));
    if (y < last - 4) h.classList.remove('is-hidden');
    last = y;
    if (ann) setAnn();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', setAnn);
  setAnn(); onScroll();
  const page = document.documentElement.dataset.page;
  $$('[data-nav]').forEach((a) => { if (a.dataset.nav === page || (page === 'product' && a.dataset.nav === 'shop')) { a.classList.add('is-current'); a.setAttribute('aria-current', 'page'); } });
  $$('[data-scroll-top]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); }));
}

export function mobileMenu() {
  const m = $('#mobile-menu'); const openBtn = $('[data-menu-open]');
  if (!m || !openBtn) return;
  let release = null; let typesLoaded = false;
  const close = () => { m.classList.remove('is-open'); m.hidden = true; lockScroll(false); openBtn.setAttribute('aria-expanded', 'false'); if (release) release(); release = null; };
  openBtn.addEventListener('click', () => {
    m.hidden = false; m.classList.add('is-open'); lockScroll(true); openBtn.setAttribute('aria-expanded', 'true');
    release = trapFocus(m, close);
    if (!typesLoaded && boot.shopifyConfigured) {
      typesLoaded = true;
      api('/api/products?per=1').then((r) => {
        const box = $('[data-mm-types]', m);
        (r.facets && r.facets.types || []).slice(0, 8).forEach((t) => box.insertAdjacentHTML('beforeend', `<a href="/shop?type=${encodeURIComponent(t.name)}">${esc(t.name)}</a>`));
      }).catch(() => {});
    }
  });
  $$('[data-menu-close]', m).forEach((b) => b.addEventListener('click', close));
  $$('a', m).forEach((a) => a.addEventListener('click', () => { if (!a.target) close(); }));
}

export function search() {
  const box = $('#search'); if (!box) return;
  const input = $('#search-input'); const out = $('[data-search-results]');
  let release = null; let ctrl = null;
  const quick = `<p class="search__hint">Search by name, type or colour.</p><div class="search__quick"><a href="/shop">Everything</a><a href="/shop?sort=newest">New</a><a href="/collections">Collections</a><a href="/lookbook">Lookbook</a></div>`;
  const open = () => { box.hidden = false; box.classList.add('is-open'); lockScroll(true); out.innerHTML = quick; input.value = ''; release = trapFocus(box, close); setTimeout(() => input.focus(), 30); };
  const close = () => { box.hidden = true; box.classList.remove('is-open'); lockScroll(false); if (release) release(); release = null; };
  $$('[data-search-open]').forEach((b) => b.addEventListener('click', open));
  $$('[data-search-close]', box).forEach((b) => b.addEventListener('click', close));
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === '/' && box.hidden && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); open(); } });
  const run = debounce(async () => {
    const q = input.value.trim();
    if (!q) { out.innerHTML = quick; return; }
    if (ctrl) ctrl.abort(); ctrl = new AbortController();
    try {
      const r = await api(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
      out.innerHTML = r.items.length
        ? r.items.map((p) => `<a class="search-item" href="/product/${esc(p.handle)}">${p.images[0] ? `<img src="${esc(imgUrl(p.images[0].src, 160))}" alt="" width="64" height="80" loading="lazy">` : '<span class="ph"></span>'}<span><span class="search-item__t">${esc(p.title)}</span><br><span class="search-item__m">${esc(p.type || '')}</span></span><span>${p.compareAt ? `<s>${ngn(p.compareAt)}</s> ` : ''}${priceRange(p)}</span></a>`).join('') + (r.total > r.items.length ? `<p class="search__hint" style="margin-top:20px"><a class="link-arrow" href="/shop?q=${encodeURIComponent(q)}">All ${r.total} results <svg><use href="#i-arrow"/></svg></a></p>` : '')
        : `<p class="search__hint">Nothing answers to \u201C${esc(q)}\u201D.</p>${quick.replace('<p class="search__hint">Search by name, type or colour.</p>', '')}`;
    } catch (e) {
      if (e.name === 'AbortError') return;
      out.innerHTML = notConfigured(e) ? '<p class="search__hint">The first drop is being summoned. Nothing to search yet.</p>' : `<p class="search__hint">${esc(e.message)}</p>`;
    }
  }, 220);
  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) location.href = `/shop?q=${encodeURIComponent(input.value.trim())}`; });
}

/* ---------- modal ---------- */
let modalRelease = null;
export function openModal(htmlStr, { media = false, onClose } = {}) {
  const m = $('#modal'); if (!m) return;
  $('[data-modal-body]', m).innerHTML = htmlStr;
  m.classList.toggle('modal--media', media);
  m.hidden = false; lockScroll(true);
  const close = () => { m.hidden = true; lockScroll(false); $('[data-modal-body]', m).innerHTML = ''; if (modalRelease) modalRelease(); modalRelease = null; onClose && onClose(); };
  m._close = close;
  modalRelease = trapFocus($('.modal__panel', m), close);
  magnetic(m);
  return close;
}
export function initModal() {
  const m = $('#modal'); if (!m) return;
  m.addEventListener('click', (e) => { if (e.target.closest('[data-modal-close]') && m._close) m._close(); });
}

/* ---------- newsletter ---------- */
export function newsletter() {
  $$('[data-newsletter]').forEach((form) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('[data-form-msg]', form); const btn = $('button[type="submit"]', form);
    const email = form.email.value.trim();
    msg.className = 'form-msg';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'That email will not reach us.'; msg.classList.add('is-error'); form.email.focus(); return; }
    setBusy(btn, true);
    try {
      const r = await api('/api/newsletter', { method: 'POST', body: { email, website: form.website.value, source: 'home' } });
      msg.textContent = r.already ? 'You are already one of us.' : 'Sworn in. You will hear first.';
      msg.classList.add('is-ok'); form.reset();
    } catch (err) {
      msg.textContent = notConfigured(err) ? 'The list opens with the first drop. Follow us on TikTok until then.' : err.message;
      msg.classList.add('is-error');
    } finally { setBusy(btn, false); }
  }));
}

/* ---------- contact: compose on WhatsApp ---------- */
export function waCompose() {
  const f = $('[data-wa-compose]'); if (!f) return;
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = $('[data-form-msg]', f);
    if (!f.message.value.trim() || !f.name.value.trim()) { msg.textContent = 'Your name and message, please.'; msg.className = 'form-msg is-error'; return; }
    const text = `Hi EOS, this is ${f.name.value.trim()}.${f.order.value.trim() ? ` Order ${f.order.value.trim()}.` : ''}\n\n${f.message.value.trim()}`;
    window.open(waLink(text), '_blank', 'noopener');
    msg.textContent = 'WhatsApp opened in a new tab.'; msg.className = 'form-msg is-ok';
  });
}

/* ---------- quick add from cards ---------- */
export function quickAdd() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-quick-add]'); if (!b) return;
    e.preventDefault();
    const p = cardData.get(b.dataset.handle); if (!p || !p.quick) return;
    const ok = cart.add({ variantId: p.quick.id, handle: p.handle, title: p.title, variantTitle: '', price: p.price, image: p.images[0] && p.images[0].src, max: p.drop && p.drop.preorder ? null : p.quick.stock });
    if (ok) { toast(`${p.title} added`); openDrawer(); }
  });
}
