import { $, $$, api, esc, ngn, colourCss, debounce, lockScroll, trapFocus, notConfigured } from '../core.js';
import { productCard, summonState, skeletonCards } from '../cards.js';
import { reveals } from '../fx.js';
import { recent } from '../cart.js';

const LIST_KEYS = ['type', 'size', 'colour'];
const parse = () => {
  const u = new URLSearchParams(location.search);
  return {
    q: u.get('q') || '', type: u.getAll('type').flatMap((x) => x.split(',')).filter(Boolean),
    size: u.getAll('size').flatMap((x) => x.split(',')).filter(Boolean), colour: u.getAll('colour').flatMap((x) => x.split(',')).filter(Boolean),
    min: u.get('min') || '', max: u.get('max') || '', sort: u.get('sort') || 'featured', page: Number(u.get('page')) || 1,
    available: u.get('available') === '1', sale: u.get('sale') === '1',
  };
};
const toQuery = (st, extra = {}) => {
  const u = new URLSearchParams();
  if (st.q) u.set('q', st.q);
  LIST_KEYS.forEach((k) => { if (st[k].length) u.set(k, st[k].join(',')); });
  if (st.min) u.set('min', st.min); if (st.max) u.set('max', st.max);
  if (st.sort && st.sort !== 'featured') u.set('sort', st.sort);
  if (st.page > 1) u.set('page', st.page);
  if (st.available) u.set('available', '1'); if (st.sale) u.set('sale', '1');
  Object.entries(extra).forEach(([k, v]) => u.set(k, v));
  return u.toString();
};

async function recentlyViewed() {
  const sec = $('[data-recent]'); if (!sec) return;
  const handles = recent.list().slice(0, 4);
  if (!handles.length) return;
  try {
    const r = await api(`/api/products?handles=${encodeURIComponent(handles.join(','))}`);
    if (!r.items.length) return;
    $('[data-recent-grid]', sec).innerHTML = r.items.map((x, i) => productCard(x, { index: i })).join('');
    sec.hidden = false; reveals(sec);
  } catch (_) { /* optional row */ }
}

export default function shop() {
  recentlyViewed();
  const root = $('[data-shop]'); if (!root) return;
  const collection = root.dataset.collection || '';
  const grid = $('[data-grid]', root); const pag = $('[data-pagination]', root);
  const fbody = $('[data-filters-body]', root); const filters = $('[data-filters]', root);
  const sortSel = $('[data-sort]', root); const count = $('[data-result-count]');
  let st = parse(); let facets = null; let ctrl = null; let release = null;
  sortSel.value = st.sort;

  const renderFilters = () => {
    if (!facets) { fbody.innerHTML = ''; return; }
    const group = (title, key, values, opts = {}) => (values.length ? `<div class="fgroup"><h3>${title}</h3><div class="fopts">${values.map((v) => {
      const name = typeof v === 'string' ? v : v.name; const c = opts.colour ? colourCss(name) : null;
      return `<label class="fopt${opts.size ? ' fopt--size' : ''}"><input type="checkbox" data-f="${key}" value="${esc(name)}" ${st[key].includes(name) ? 'checked' : ''}><span>${c ? `<i style="background:${c}"></i>` : ''}${esc(name)}${v.count ? ` <small>${v.count}</small>` : ''}</span></label>`;
    }).join('')}</div></div>` : '');
    const pmin = facets.price.min; const pmax = facets.price.max;
    fbody.innerHTML = [
      group('Category', 'type', facets.types),
      group('Size', 'size', facets.sizes, { size: true }),
      group('Colour', 'colour', facets.colours, { colour: true }),
      pmax > 0 ? `<div class="fgroup"><h3>Price (\u20A6)</h3><div class="frange"><input type="number" inputmode="numeric" min="0" placeholder="${pmin}" value="${esc(st.min)}" data-price="min" aria-label="Minimum price"><span>to</span><input type="number" inputmode="numeric" min="0" placeholder="${pmax}" value="${esc(st.max)}" data-price="max" aria-label="Maximum price"></div>
        <div class="fslider"><input type="range" min="${pmin}" max="${pmax}" step="500" value="${st.min || pmin}" data-range="min" aria-label="Minimum price"><input type="range" min="${pmin}" max="${pmax}" step="500" value="${st.max || pmax}" data-range="max" aria-label="Maximum price"></div></div>` : '',
      `<div class="fgroup"><label class="fcheck"><input type="checkbox" data-flag="available" ${st.available ? 'checked' : ''}> In stock only</label><label class="fcheck"><input type="checkbox" data-flag="sale" ${st.sale ? 'checked' : ''}> On sale</label>
       <button type="button" class="btn btn--line filters__clear-inline" data-filters-clear>Clear all</button></div>`,
    ].join('');
  };

  const renderTabs = () => {
    const nav = $('[data-type-tabs]', root);
    if (!facets || facets.types.length < 2) { nav.hidden = true; return; }
    const cur = st.type.length === 1 ? st.type[0] : '';
    nav.innerHTML = [['', 'All'], ...facets.types.map((t) => [t.name, t.name])].map(([val, label]) => `<button type="button" data-tab="${esc(val)}" aria-pressed="${Boolean(val === cur && (val || !st.type.length))}">${esc(label)}</button>`).join('');
    nav.hidden = false;
  };

  const renderChips = () => {
    const chips = [];
    if (st.q) chips.push(['q', st.q, `\u201C${st.q}\u201D`]);
    LIST_KEYS.forEach((k) => st[k].forEach((v) => chips.push([k, v, v])));
    if (st.min || st.max) chips.push(['price', '', `${st.min ? ngn(st.min) : ngn(0)} \u2013 ${st.max ? ngn(st.max) : 'max'}`]);
    if (st.available) chips.push(['available', '', 'In stock']);
    if (st.sale) chips.push(['sale', '', 'On sale']);
    $('[data-active-filters]', root).innerHTML = chips.map(([k, v, l]) => `<button type="button" class="chip" data-chip="${k}" data-v="${esc(v)}">${esc(l)}<svg><use href="#i-close"/></svg></button>`).join('');
    const n = chips.length; const b = $('[data-filter-count]', root); b.textContent = n; b.hidden = !n;
  };

  const renderPagination = (r) => {
    if (r.pages <= 1) { pag.innerHTML = ''; return; }
    const link = (p, label = p, cur = false) => (cur ? `<span aria-current="page">${label}</span>` : `<a href="?${toQuery({ ...st, page: p })}" data-page="${p}" data-no-transition>${label}</a>`);
    const parts = [];
    if (r.page > 1) parts.push(link(r.page - 1, '\u2190'));
    for (let p = 1; p <= r.pages; p++) {
      if (p === 1 || p === r.pages || Math.abs(p - r.page) <= 1) parts.push(link(p, p, p === r.page));
      else if (Math.abs(p - r.page) === 2) parts.push('<span aria-hidden="true">\u2026</span>');
    }
    if (r.page < r.pages) parts.push(link(r.page + 1, '\u2192'));
    pag.innerHTML = parts.join('');
  };

  const load = async ({ push = true, scroll = false } = {}) => {
    if (push) history.replaceState(null, '', `${location.pathname}${toQuery(st) ? `?${toQuery(st)}` : ''}`);
    renderChips();
    grid.setAttribute('aria-busy', 'true');
    if (!grid.children.length || grid.querySelector('.summon')) grid.innerHTML = skeletonCards(6);
    else grid.style.opacity = '0.4';
    if (ctrl) ctrl.abort(); ctrl = new AbortController();
    try {
      const r = await api(`/api/products?${toQuery(st, { per: 12, ...(collection ? { collection } : {}) })}`, { signal: ctrl.signal });
      if (!facets || push === 'facets') { facets = r.facets; renderFilters(); }
      renderTabs();
      const any = facets && (facets.types.length || facets.sizes.length || facets.price.max > 0);
      root.classList.toggle('is-empty', !r.total && !any);
      if (!r.total && !any) grid.innerHTML = summonState();
      else if (!r.total) grid.innerHTML = '<div class="empty"><h2>Nothing answers</h2><p>No piece matches these filters. Loosen the ritual.</p><button type="button" class="btn btn--line" data-filters-clear>Clear filters</button></div>';
      else grid.innerHTML = r.items.map((p, i) => productCard(p, { eager: i < 3, index: i })).join('');
      if (count) count.textContent = r.total ? `${r.total} piece${r.total === 1 ? '' : 's'}` : '';
      renderPagination(r);
      reveals(grid);
      if (scroll) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      if (e.name === 'AbortError') return;
      root.classList.toggle('is-empty', notConfigured(e));
      grid.innerHTML = notConfigured(e) ? summonState() : `<div class="empty"><h2>The realm is quiet</h2><p>${esc(e.message)}</p></div>`;
      if (count) count.textContent = '';
    } finally { grid.style.opacity = ''; grid.removeAttribute('aria-busy'); }
  };

  const reset = () => { st = { ...st, q: '', type: [], size: [], colour: [], min: '', max: '', page: 1, available: false, sale: false }; renderFilters(); load(); };
  const priceDebounced = debounce(() => { st.page = 1; load(); }, 500);

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.f) { const k = t.dataset.f; st[k] = t.checked ? [...new Set([...st[k], t.value])] : st[k].filter((x) => x !== t.value); st.page = 1; load(); }
    if (t.dataset.flag) { st[t.dataset.flag] = t.checked; st.page = 1; load(); }
    if (t === sortSel) { st.sort = sortSel.value; st.page = 1; load(); }
  });
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.price) { st[t.dataset.price] = t.value.replace(/\D/g, ''); priceDebounced(); }
    if (t.dataset.range) {
      const other = $(`[data-range="${t.dataset.range === 'min' ? 'max' : 'min'}"]`, root);
      if (t.dataset.range === 'min' && Number(t.value) > Number(other.value)) t.value = other.value;
      if (t.dataset.range === 'max' && Number(t.value) < Number(other.value)) t.value = other.value;
      st[t.dataset.range] = t.value; const box = $(`[data-price="${t.dataset.range}"]`, root); if (box) box.value = t.value; priceDebounced();
    }
  });
  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { st.type = tab.dataset.tab ? [tab.dataset.tab] : []; st.page = 1; renderFilters(); load(); return; }
    const chip = e.target.closest('[data-chip]');
    if (chip) {
      const k = chip.dataset.chip;
      if (LIST_KEYS.includes(k)) st[k] = st[k].filter((x) => x !== chip.dataset.v);
      else if (k === 'price') { st.min = ''; st.max = ''; } else if (k === 'q') st.q = ''; else st[k] = false;
      st.page = 1; renderFilters(); load();
    }
    if (e.target.closest('[data-filters-clear]')) reset();
    const pg = e.target.closest('[data-page]');
    if (pg) { e.preventDefault(); st.page = Number(pg.dataset.page); load({ scroll: true }); }
    if (e.target.closest('[data-filters-open]')) { filters.classList.add('is-open'); lockScroll(true); release = trapFocus(filters, closeF); }
    if (e.target.closest('[data-filters-close]')) closeF();
  });
  function closeF() { if (!filters.classList.contains('is-open')) return; filters.classList.remove('is-open'); lockScroll(false); if (release) release(); release = null; }
  load({ push: false });
}
