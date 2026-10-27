// EOS admin. Vanilla JS single page app; every number comes from Shopify through /api/admin.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 });
const ngn = (n) => (n === null || n === undefined || n === '' ? '\u2014' : '\u20A6' + nf.format(Number(n)));
const dt = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => (iso ? new Date(iso).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', ...opts }) : '\u2014');
const dtt = (iso) => (iso ? new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '\u2014');
const sz = (u, w) => (u ? u + (u.includes('?') ? '&' : '?') + 'width=' + w : '');
const num = (gid) => String(gid || '').split('/').pop();
// datetime-local <-> ISO, always in WAT (UTC+1, no DST)
const toWat = (iso) => (iso ? new Date(new Date(iso).getTime() + 3600e3).toISOString().slice(0, 16) : '');
const fromWat = (local) => (local ? new Date(`${local}:00+01:00`).toISOString() : null);
const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
const STATUS_LABEL = { pending: 'Pending', confirmed: 'Confirmed / paid', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const app = $('#app');

const I = {
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7.5L12 4l8 3.5v9L12 20l-8-3.5z"/><path d="M4 7.5l8 3.5 8-3.5M12 11v9"/></svg>',
  stack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 8l8-4 8 4-8 4zM4 12l8 4 8-4M4 16l8 4 8-4"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16v16H4zM4 10h16M10 10v10"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 12.5l9-9H20.5v8l-9 9z"/><circle cx="16" cy="8" r="1.5"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.5 8h15l-1.2 13H5.7z"/><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/></svg>',
  log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3.5h12v17H6zM9 8h6M9 12h6M9 16h4"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 5v14M5 12h14"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.2 19.8l1.1-3.9A8.2 8.2 0 1 1 8.4 19l-4.2.8z"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 4h6v16h-6M10 8l-4 4 4 4M6 12h10"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
};

/* ------------------------------ api ------------------------------ */
class ApiError extends Error { constructor(status, body) { super((body && body.error && body.error.message) || `Request failed (${status})`); this.status = status; this.code = body && body.error && body.error.code; } }
async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { Accept: 'application/json', 'X-EOS-Admin': '1' };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api/admin${path}`, { method, headers, credentials: 'same-origin', body: form || (body ? JSON.stringify(body) : undefined) });
  let data = null; try { data = await res.json(); } catch (_) { /* empty */ }
  if (res.status === 401 && path !== '/login') { renderLogin(); throw new ApiError(401, data); }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

/* ------------------------------ ui helpers ------------------------------ */
function toast(msg, err = false) {
  const t = document.createElement('div'); t.className = `toast${err ? ' toast--err' : ''}`; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), err ? 6000 : 3200);
}
const fail = (e) => { if (e.status !== 401) toast(e.message, true); };
function busy(btn, on) { if (btn) { btn.classList.toggle('is-busy', on); btn.disabled = on; } }
async function run(btn, fn, okMsg) { busy(btn, true); try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { fail(e); return undefined; } finally { busy(btn, false); } }
function dialog(html, onMount) {
  const d = $('#dialog'); const p = $('.dialog__panel', d);
  p.innerHTML = html; d.hidden = false;
  const close = () => { d.hidden = true; p.innerHTML = ''; document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  $$('[data-close]', d).forEach((b) => { b.onclick = close; });
  const f = $('input, select, textarea, button', p); if (f) f.focus();
  if (onMount) onMount(p, close);
  return close;
}
function confirmDialog(title, text, { danger = true, ok = 'Confirm' } = {}) {
  return new Promise((resolve) => {
    dialog(`<h2 id="dialog-title">${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="dialog__actions"><button class="btn btn--ghost" data-close>Cancel</button><button class="btn ${danger ? 'btn--danger' : 'btn--red'}" data-ok>${esc(ok)}</button></div>`, (p, close) => {
      $('[data-close]', p).onclick = () => { close(); resolve(false); };
      $('[data-ok]', p).onclick = () => { close(); resolve(true); };
    });
  });
}
const chip = (s, label) => `<span class="chip chip--${esc(String(s).toLowerCase())}">${esc(label || STATUS_LABEL[s] || s)}</span>`;
const sw = (name, checked, label) => `<label class="switch"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><i></i><span>${esc(label)}</span></label>`;
const skel = (rows = 4) => `<div class="card">${Array.from({ length: rows }, () => '<div class="skel" style="height:18px;margin:10px 0"></div>').join('')}</div>`;
const shopHandle = () => (state.status && state.status.domain ? state.status.domain.replace('.myshopify.com', '') : '');
const shopifyAdminUrl = (gid) => {
  const h = shopHandle(); if (!h) return null;
  const t = /DraftOrder/.test(gid) ? 'draft_orders' : /Order/.test(gid) ? 'orders' : /Product/.test(gid) ? 'products' : /Collection/.test(gid) ? 'collections' : /Customer/.test(gid) ? 'customers' : null;
  return t ? `https://admin.shopify.com/store/${h}/${t}/${num(gid)}` : null;
};
const waDigits = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0')) d = `234${d.slice(1)}`; return d; };
const charCount = (el, max) => { const c = document.createElement('small'); const upd = () => { c.textContent = `${el.value.length} / ${max}`; }; el.addEventListener('input', upd); upd(); el.after(c); };

function connectPanel() {
  return `<div class="card connect"><h2>Connect Shopify</h2>
    <p class="muted">This section reads and writes your Shopify store. Set these environment variables on Render, then redeploy:</p>
    <ul class="muted"><li><code>SHOPIFY_STORE_DOMAIN</code> = d5gdhb-up.myshopify.com</li><li><code>SHOPIFY_CLIENT_ID</code> and <code>SHOPIFY_CLIENT_SECRET</code> from the Dev Dashboard app</li><li><code>SHOPIFY_API_VERSION</code> = 2026-10</li></ul>
    <p class="muted">Nothing is shown here until real data is available.</p></div>`;
}
const needsShopify = () => !(state.status && state.status.shopifyConfigured);

/* ------------------------------ state + router ------------------------------ */
const state = { status: null, settings: null, products: null };
const NAV = [
  ['Store', [['#/', 'Dashboard', I.dash], ['#/orders', 'Orders', I.bag], ['#/products', 'Products', I.box], ['#/inventory', 'Inventory', I.stack], ['#/collections', 'Collections', I.grid], ['#/discounts', 'Discounts & promos', I.tag], ['#/customers', 'Customers', I.user]]],
  ['Site', [['#/storefront', 'Homepage & banner', I.home], ['#/shipping', 'Shipping & payment', I.truck], ['#/seo', 'SEO & store status', I.globe]]],
  ['System', [['#/activity', 'Activity log', I.log], ['#/account', 'Account', I.key]]],
];
const ROUTES = [
  [/^#?\/?$/, viewDashboard], [/^#\/products$/, viewProducts], [/^#\/products\/new$/, () => viewProduct(null)], [/^#\/products\/(\d+)$/, (m) => viewProduct(`gid://shopify/Product/${m[1]}`)],
  [/^#\/inventory$/, viewInventory], [/^#\/collections$/, viewCollections], [/^#\/collections\/new$/, () => viewCollection(null)], [/^#\/collections\/(\d+)$/, (m) => viewCollection(`gid://shopify/Collection/${m[1]}`)],
  [/^#\/discounts$/, viewDiscounts], [/^#\/orders$/, viewOrders], [/^#\/orders\/(draft|order)\/(\d+)$/, (m) => viewOrder(`gid://shopify/${m[1] === 'draft' ? 'DraftOrder' : 'Order'}/${m[2]}`)],
  [/^#\/customers$/, viewCustomers], [/^#\/storefront$/, viewStorefront], [/^#\/shipping$/, viewShipping], [/^#\/seo$/, viewSeo], [/^#\/activity$/, viewActivity], [/^#\/account$/, viewAccount],
];

function renderShell() {
  app.innerHTML = `<div class="shell">
    <aside class="side" id="side">
      <a class="side__brand" href="#/"><img src="/img/eos-sigil.webp" alt="" width="13" height="33"><span>EOS ADMIN</span></a>
      <nav class="side__nav" aria-label="Admin">${NAV.map(([g, items]) => `<div class="side__group">${g}</div>${items.map(([h, l, ic]) => `<a href="${h}" data-nav="${h}">${ic}<span>${l}</span></a>`).join('')}`).join('')}</nav>
      <div class="side__foot"><a href="/" target="_blank" rel="noopener">View the store \u2197</a><a href="#" data-logout>Log out</a></div>
    </aside>
    <div class="scrim" id="scrim" hidden></div>
    <div class="content">
      <header class="top"><button class="btn btn--ghost btn--sm" type="button" data-menu aria-label="Menu">${I.menu}</button><span class="top__title">EOS ADMIN</span><span class="spacer"></span><a class="btn btn--ghost btn--sm" href="#/orders">${I.bag}</a></header>
      <main class="main" id="view"></main>
    </div></div>`;
  const side = $('#side'); const scrim = $('#scrim');
  const closeMenu = () => { side.classList.remove('is-open'); scrim.hidden = true; };
  $('[data-menu]').onclick = () => { side.classList.add('is-open'); scrim.hidden = false; };
  scrim.onclick = closeMenu;
  $$('.side__nav a').forEach((a) => a.addEventListener('click', closeMenu));
  $('[data-logout]').onclick = async (e) => { e.preventDefault(); await api('/logout', { method: 'POST' }).catch(() => {}); renderLogin(); };
}

async function route() {
  if (!$('#view')) return;
  const hash = location.hash || '#/';
  $$('.side__nav a').forEach((a) => { const h = a.dataset.nav; a.classList.toggle('is-on', h === '#/' ? hash === '#/' || hash === '' : hash.startsWith(h)); });
  // Fresh element per view so listeners from the previous view never stack up.
  const old = $('#view'); const view = old.cloneNode(false); old.replaceWith(view);
  for (const [re, fn] of ROUTES) {
    const m = hash.match(re);
    if (m) { view.innerHTML = skel(); window.scrollTo(0, 0); try { await fn(m, view); } catch (e) { if (e.status !== 401) view.innerHTML = `<div class="note note--warn"><b>Could not load this page.</b> ${esc(e.message)}</div>`; } return; }
  }
  view.innerHTML = '<div class="note">Unknown page. <a href="#/">Back to the dashboard</a>.</div>';
}
const V = () => $('#view');
const header = (title, sub = '', actions = '', crumb = '') => `${crumb}<div class="ph"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="ph__actions">${actions}</div></div>`;

/* ------------------------------ login ------------------------------ */
function renderLogin(msg = '') {
  app.innerHTML = `<div class="login"><form class="login__card" novalidate>
    <img src="/img/eos-sigil.webp" alt="" width="22" height="55"><h1>ADMIN ACCESS</h1><p>Enter your password to continue</p>
    <label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>
    <button class="btn btn--red" type="submit">Log in</button><p class="muted" data-msg style="margin:14px 0 0">${esc(msg)}</p></form></div>`;
  const f = $('form', app); f.password.focus();
  f.onsubmit = async (e) => {
    e.preventDefault(); const btn = $('button', f);
    busy(btn, true);
    try { await api('/login', { method: 'POST', body: { password: f.password.value } }); await start(); }
    catch (err) { $('[data-msg]', f).textContent = err.message; f.password.select(); }
    finally { busy(btn, false); }
  };
}

/* ------------------------------ dashboard ------------------------------ */
function chartSvg(series) {
  const W = 700; const H = 220; const P = { l: 46, r: 10, t: 12, b: 26 };
  const maxR = Math.max(1, ...series.map((s) => s.revenue)); const maxO = Math.max(1, ...series.map((s) => s.orders));
  const x = (i) => P.l + (i * (W - P.l - P.r)) / Math.max(1, series.length - 1);
  const y = (v) => H - P.b - (v / maxR) * (H - P.t - P.b);
  const bw = Math.max(2, (W - P.l - P.r) / series.length - 4);
  const line = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s.revenue).toFixed(1)}`).join(' ');
  const area = `${line} L${x(series.length - 1)} ${H - P.b} L${x(0)} ${H - P.b} Z`;
  const ticks = [0, 0.5, 1].map((f) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(maxR * f)}" y2="${y(maxR * f)}" stroke="rgba(233,227,215,.08)"/><text x="${P.l - 8}" y="${y(maxR * f) + 4}" fill="#6d685f" font-size="10" text-anchor="end">${maxR * f >= 1000 ? `${Math.round((maxR * f) / 1000)}k` : Math.round(maxR * f)}</text>`).join('');
  const labels = series.map((s, i) => (i % 5 === 0 || i === series.length - 1 ? `<text x="${x(i)}" y="${H - 6}" fill="#6d685f" font-size="10" text-anchor="middle">${new Date(`${s.date}T12:00:00Z`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</text>` : '')).join('');
  const bars = series.map((s, i) => `<rect x="${x(i) - bw / 2}" y="${H - P.b - (s.orders / maxO) * (H - P.t - P.b) * 0.5}" width="${bw}" height="${(s.orders / maxO) * (H - P.t - P.b) * 0.5}" fill="rgba(233,227,215,.14)"/>`).join('');
  const hits = series.map((s, i) => `<rect x="${x(i) - (W - P.l - P.r) / series.length / 2}" y="${P.t}" width="${(W - P.l - P.r) / series.length}" height="${H - P.t - P.b}" fill="transparent" data-i="${i}"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue and orders, last 30 days">
    <defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d61430" stop-opacity=".35"/><stop offset="1" stop-color="#d61430" stop-opacity="0"/></linearGradient></defs>
    ${ticks}${bars}<path d="${area}" fill="url(#ga)"/><path d="${line}" fill="none" stroke="#d61430" stroke-width="1.6"/>${labels}${hits}</svg>`;
}

async function viewDashboard() {
  const v = V();
  if (needsShopify()) { v.innerHTML = header('Dashboard', 'Your store at a glance.') + connectPanel(); return; }
  const d = await api('/overview');
  const c = d.counts;
  const hasSales = d.series.some((s) => s.orders);
  v.innerHTML = header('Dashboard', `Live from Shopify \u2014 ${esc(state.status.shop ? state.status.shop.name : '')}`, `<a class="btn btn--red" href="#/products/new">${I.plus}Add product</a>`) + `
    <div class="grid grid--kpi">
      <a class="card kpi" href="#/orders" style="text-decoration:none"><span>Orders</span><strong class="mono">${nf.format(c.orders)}</strong><small>${c.orders30} in the last 30 days</small></a>
      <div class="card kpi"><span>Revenue, 30 days</span><strong class="mono">${ngn(c.revenue30)}</strong><small>Completed orders, not cancelled</small></div>
      <a class="card kpi" href="#/orders?status=pending" style="text-decoration:none"><span>Awaiting confirmation</span><strong class="mono">${c.pendingDrafts}</strong><small>${ngn(c.pendingValue)} in draft orders</small></a>
      <a class="card kpi" href="#/customers" style="text-decoration:none"><span>Customers</span><strong class="mono">${nf.format(c.customers)}</strong><small>Incl. newsletter sign-ups</small></a>
      <a class="card kpi" href="#/products" style="text-decoration:none"><span>Products</span><strong class="mono">${c.products}</strong><small>${c.activeProducts} active</small></a>
      <a class="card kpi${c.lowStock ? ' kpi--alert' : ''}" href="#/inventory" style="text-decoration:none"><span>Low stock</span><strong class="mono">${c.lowStock}</strong><small>Variants at or below ${state.settings ? state.settings.inventory.lowStockThreshold : 3}</small></a>
    </div>
    <div class="grid grid--2" style="margin-top:14px">
      <div class="card"><div class="card__h"><h2>Sales, last 30 days</h2></div>
        ${hasSales ? `<div class="chart" data-chart>${chartSvg(d.series)}<div class="chart__tip" hidden></div></div><div class="chart__legend"><span><i></i>Revenue</span><span><i class="b"></i>Orders</span></div>` : '<p class="muted">No completed orders in the last 30 days yet. Draft orders count once you mark them paid.</p>'}
      </div>
      <div class="card"><div class="card__h"><h2>Quick actions</h2></div><div class="quick">
        <a href="#/products/new">${I.plus}Add product</a><a href="#/storefront">${I.home}Edit homepage</a><a href="#/collections">${I.grid}Manage collections</a><a href="#/discounts">${I.tag}Create a discount</a><a href="#/orders">${I.bag}View orders</a></div></div>
    </div>
    <div class="grid grid--2" style="margin-top:14px">
      <div class="card"><div class="card__h"><h2>Recent orders</h2><a href="#/orders">All orders</a></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Order</th><th class="hide-sm">Date</th><th>Customer</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
        ${d.recent.length ? d.recent.map((o) => `<tr><td><a href="#/orders/${o.kind}/${num(o.id)}">${esc(o.name)}</a></td><td class="hide-sm">${dt(o.createdAt)}</td><td>${esc(o.customer || '\u2014')}</td><td class="num">${ngn(o.total)}</td><td>${chip(o.status)}</td></tr>`).join('') : '<tr class="empty-row"><td colspan="5">No orders yet.</td></tr>'}
        </tbody></table></div></div>
      <div class="card"><div class="card__h"><h2>Low stock</h2><a href="#/inventory">Inventory</a></div>
        <div class="list">${d.lowStock.length ? d.lowStock.map((l) => `<a href="#/products/${num(l.productId)}"><span>${esc(l.product)}${l.variant ? ` <span class="muted">/ ${esc(l.variant)}</span>` : ''}</span><span class="chip chip--low">${l.quantity}</span></a>`).join('') : '<p class="muted">Every tracked variant is above the threshold.</p>'}</div></div>
    </div>`;
  const ch = $('[data-chart]', v);
  if (ch) {
    const tip = $('.chart__tip', ch);
    ch.addEventListener('pointermove', (e) => {
      const r = e.target.closest('[data-i]'); if (!r) { tip.hidden = true; return; }
      const s = d.series[Number(r.dataset.i)]; const box = ch.getBoundingClientRect();
      tip.hidden = false; tip.style.left = `${e.clientX - box.left}px`; tip.style.top = `${e.clientY - box.top}px`;
      tip.textContent = `${new Date(`${s.date}T12:00:00Z`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}: ${ngn(s.revenue)} \u00B7 ${s.orders} order${s.orders === 1 ? '' : 's'}`;
    });
    ch.addEventListener('pointerleave', () => { tip.hidden = true; });
  }
}

/* ------------------------------ products ------------------------------ */
async function viewProducts() {
  const v = V();
  if (needsShopify()) { v.innerHTML = header('Products') + connectPanel(); return; }
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  let q = qs.get('q') || ''; let status = qs.get('status') || ''; let after = null; let items = [];
  v.innerHTML = header('Products', 'Everything here is your Shopify catalogue.', `<button class="btn" data-bulk disabled>Bulk price</button><a class="btn btn--red" href="#/products/new">${I.plus}Add product</a>`) + `
    <div class="card"><div class="toolbar"><input class="input" type="search" placeholder="Search title, tag or type" value="${esc(q)}" data-q><select class="input" data-status><option value="">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></div>
    <div class="table-wrap"><table class="t"><thead><tr><th><input type="checkbox" data-all aria-label="Select all"></th><th>Product</th><th>Status</th><th class="hide-sm">Type</th><th class="num">Stock</th><th class="num">Price</th><th></th></tr></thead><tbody data-rows></tbody></table></div>
    <div class="pager" data-more></div></div>`;
  $('[data-status]', v).value = status;
  const rows = $('[data-rows]', v);
  const selected = new Set();
  const rowHtml = (p) => `<tr data-id="${esc(p.id)}"><td><input type="checkbox" data-sel value="${esc(p.id)}" ${selected.has(p.id) ? 'checked' : ''} aria-label="Select ${esc(p.title)}"></td>
    <td><a class="cell-title" href="#/products/${num(p.id)}">${p.image ? `<img class="thumb" src="${esc(sz(p.image, 100))}" alt="" loading="lazy">` : '<span class="thumb thumb--ph"></span>'}<span><b>${esc(p.title)}</b><small>${p.variantsCount} variant${p.variantsCount === 1 ? '' : 's'}</small></span></a></td>
    <td>${chip(p.status.toLowerCase(), p.status)}</td><td class="hide-sm">${esc(p.type || '\u2014')}</td>
    <td class="num">${p.inventory === null ? '<span class="muted">untracked</span>' : p.inventory <= (state.settings ? state.settings.inventory.lowStockThreshold : 3) ? `<span class="chip chip--low">${p.inventory}</span>` : p.inventory}</td>
    <td class="num">${p.compareAt ? `<s class="muted">${ngn(p.compareAt)}</s> ` : ''}${p.minPrice === p.maxPrice ? ngn(p.minPrice) : `${ngn(p.minPrice)}\u2013${ngn(p.maxPrice)}`}</td>
    <td class="num"><button class="btn btn--sm" data-prices>Prices</button></td></tr>`;
  const load = async (append = false) => {
    if (!append) { rows.innerHTML = '<tr><td colspan="7"><div class="skel"></div></td></tr>'; after = null; items = []; }
    const r = await api(`/products?${new URLSearchParams({ q, status, ...(after ? { after } : {}) })}`);
    items = append ? items.concat(r.items) : r.items;
    after = r.pageInfo.hasNextPage ? r.pageInfo.endCursor : null;
    rows.innerHTML = items.length ? items.map(rowHtml).join('') : `<tr class="empty-row"><td colspan="7">${q || status ? 'No product matches.' : 'No products yet. <a href="#/products/new">Add the first one</a>.'}</td></tr>`;
    $('[data-more]', v).innerHTML = after ? '<button class="btn" data-load-more>Load more</button>' : '';
  };
  const upd = () => { $('[data-bulk]', v).disabled = !selected.size; $('[data-bulk]', v).textContent = selected.size ? `Bulk price (${selected.size})` : 'Bulk price'; };
  let t; $('[data-q]', v).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value.trim(); load().catch(fail); }, 300); });
  $('[data-status]', v).addEventListener('change', (e) => { status = e.target.value; load().catch(fail); });
  v.addEventListener('change', (e) => {
    if (e.target.matches('[data-sel]')) { if (e.target.checked) selected.add(e.target.value); else selected.delete(e.target.value); upd(); }
    if (e.target.matches('[data-all]')) { $$('[data-sel]', v).forEach((c) => { c.checked = e.target.checked; if (c.checked) selected.add(c.value); else selected.delete(c.value); }); upd(); }
  });
  v.addEventListener('click', async (e) => {
    if (e.target.closest('[data-load-more]')) { load(true).catch(fail); return; }
    const pb = e.target.closest('[data-prices]');
    if (pb) {
      const tr = pb.closest('tr'); const p = items.find((x) => x.id === tr.dataset.id);
      const next = tr.nextElementSibling;
      if (next && next.classList.contains('price-row')) { next.remove(); return; }
      tr.insertAdjacentHTML('afterend', `<tr class="price-row"><td></td><td colspan="6"><div class="table-wrap"><table class="t vt"><thead><tr><th>Variant</th><th>Price (\u20A6)</th><th>Compare-at / was (\u20A6)</th></tr></thead><tbody>
        ${p.variants.map((x) => `<tr data-v="${esc(x.id)}"><td>${esc(x.title === 'Default Title' ? 'Default' : x.title)}</td><td><input class="input" inputmode="decimal" data-price value="${x.price}"></td><td><input class="input" inputmode="decimal" data-cmp value="${x.compareAt ?? ''}" placeholder="none"></td></tr>`).join('')}
        </tbody></table></div><div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn--red btn--sm" data-save-prices>Save prices</button><span class="muted" style="align-self:center;font-size:12px">A compare-at price above the price shows the piece as on sale.</span></div></td></tr>`);
      return;
    }
    const sp = e.target.closest('[data-save-prices]');
    if (sp) {
      const box = sp.closest('.price-row'); const pid = box.previousElementSibling.dataset.id;
      const variants = $$('[data-v]', box).map((r) => ({ id: r.dataset.v, price: $('[data-price]', r).value, compareAt: $('[data-cmp]', r).value }));
      await run(sp, () => api(`/products/${num(pid)}/prices`, { method: 'PATCH', body: { variants } }), 'Prices saved');
      load().catch(fail);
    }
    if (e.target.closest('[data-bulk]')) bulkPriceDialog([...selected], () => { selected.clear(); upd(); load().catch(fail); });
  });
  await load();
}

function bulkPriceDialog(ids, done) {
  dialog(`<h2 id="dialog-title">Bulk price change</h2><p class="muted">${ids.length} product${ids.length === 1 ? '' : 's'} selected. Applies to every variant.</p>
    <form novalidate><label class="field"><span>Change</span><select name="mode"><option value="percent">Raise / lower by %</option><option value="fixed">Raise / lower by fixed \u20A6</option><option value="sale">Start a sale: % off, keep the old price as compare-at</option><option value="endsale">End sale: restore compare-at price</option></select></label>
    <label class="field" data-val><span>Amount</span><input name="value" inputmode="decimal" placeholder="e.g. 10 or -10"><small>Use a minus sign to lower prices.</small></label>
    <label class="field"><span>Round to nearest</span><select name="round"><option value="0">No rounding</option><option value="100">\u20A6100</option><option value="500">\u20A6500</option><option value="1000">\u20A61,000</option></select></label>
    <div class="dialog__actions"><button type="button" class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--red" type="submit">Apply</button></div></form>`, (p, close) => {
    const f = $('form', p);
    f.mode.onchange = () => { $('[data-val]', p).hidden = f.mode.value === 'endsale'; $('[data-val] small', p).textContent = f.mode.value === 'sale' ? 'Percent off, e.g. 20 for 20% off.' : 'Use a minus sign to lower prices.'; };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const r = await run($('[type="submit"]', f), () => api('/products/bulk-price', { method: 'POST', body: { productIds: ids, mode: f.mode.value, value: f.value.value, round: f.round.value } }));
      if (r) { toast(`Updated ${r.results.reduce((s, x) => s + x.changed, 0)} variant prices`); close(); done(); }
    };
  });
}

/* ------------------------------ product editor ------------------------------ */
// Simple <p>/<br> HTML is edited as plain text; anything richer is left as HTML.
function htmlToText(html) {
  const h = String(html || '').trim();
  if (!h) return '';
  if (/<(?!\/?(p|br)\b)[a-z]/i.test(h)) return h;
  const tmp = document.createElement('div');
  return h.split(/<\/p>\s*/i).map((part) => { tmp.innerHTML = part.replace(/<br\s*\/?>/gi, '\n').replace(/<p[^>]*>/gi, ''); return tmp.textContent.trim(); }).filter(Boolean).join('\n\n');
}
async function viewProduct(id) {
  const v = V();
  if (needsShopify()) { v.innerHTML = header(id ? 'Edit product' : 'New product') + connectPanel(); return; }
  const [p, cols] = await Promise.all([id ? api(`/products/${num(id)}`).then((r) => r.product) : null, api('/collections').then((r) => r.items).catch(() => [])]);
  const isNew = !p;
  const P = p || { title: '', descriptionHtml: '', type: '', tags: [], status: 'DRAFT', seo: { title: '', description: '' }, options: [], variants: [], media: [], collections: [], drop: { preorder: false, dropAt: null, note: '' } };
  const sizeOpt = P.options.find((o) => /^size$/i.test(o.name));
  const colourOpt = P.options.find((o) => /^colou?r$/i.test(o.name));
  const extraOpts = P.options.filter((o) => o !== sizeOpt && o !== colourOpt);
  let sizes = sizeOpt ? [...sizeOpt.values] : (isNew ? ['S', 'M', 'L', 'XL', 'XXL'] : []);
  let colours = colourOpt ? [...colourOpt.values] : [];
  const colourName = colourOpt ? colourOpt.name : 'Color';
  const rowsByKey = new Map(P.variants.map((x) => [JSON.stringify(x.options), x]));
  const store = state.status && state.status.domain;

  v.innerHTML = header(isNew ? 'New product' : P.title, isNew ? 'Creates the product in Shopify.' : `Updated ${dtt(P.updatedAt)}`,
    isNew ? '' : `<a class="btn btn--ghost" href="/product/${esc(P.handle)}" target="_blank" rel="noopener">${I.ext}View</a>${shopifyAdminUrl(P.id) ? `<a class="btn btn--ghost" href="${shopifyAdminUrl(P.id)}" target="_blank" rel="noopener">Shopify</a>` : ''}<button class="btn" data-dup>Duplicate</button><button class="btn btn--danger" data-del>Delete</button>`,
    '<a class="crumb" href="#/products">\u2190 Products</a>') + `
  <form class="detail" novalidate data-form>
    <div>
      <div class="card"><div class="card__h"><h2>Basics</h2></div>
        <label class="field"><span>Title</span><input name="title" required maxlength="255" value="${esc(P.title)}"></label>
        <label class="field"><span>Description</span><textarea name="descriptionHtml" rows="7" placeholder="Fabric, fit, print, care. Plain text is fine: blank lines become paragraphs.">${esc(htmlToText(P.descriptionHtml))}</textarea></label>
        <div class="row row--2"><label class="field"><span>Type / category</span><input name="type" list="types" maxlength="80" value="${esc(P.type)}" placeholder="e.g. T-Shirt"><datalist id="types"><option value="T-Shirt"><option value="Hoodie"><option value="Cropped Tee"><option value="Pants"><option value="Accessory"></datalist></label>
        <label class="field"><span>Tags</span><input name="tags" value="${esc(P.tags.join(', '))}" placeholder="comma separated"></label></div>
      </div>
      <div class="card"><div class="card__h"><h2>Images</h2>${isNew ? '<span class="muted" style="font-size:12px">Uploaded right after the product is created</span>' : '<span class="muted" style="font-size:12px">Drag to reorder. First image is the cover.</span>'}</div>
        <div class="media" data-media>${P.media.map((m, i) => `<div class="media__item" draggable="true" data-mid="${esc(m.id)}">${m.url ? `<img src="${esc(sz(m.url, 300))}" alt="${esc(m.alt || '')}">` : '<div class="skel" style="height:100%"></div>'}<span class="n">${i + 1}</span><button type="button" class="x" data-del-media aria-label="Delete image">${I.x}</button></div>`).join('')}
          <label class="drop-zone" data-drop>${I.plus}<span>Add images<br>JPG, PNG, WebP</span><input type="file" accept="image/*" multiple data-files></label></div>
        <div data-pending class="muted" style="font-size:12px;margin-top:8px"></div>
      </div>
      <div class="card"><div class="card__h"><h2>Sizes, colours &amp; variants</h2></div>
        <div class="opt-row"><span class="label">Sizes</span><div><div class="checks" data-sizes>${[...new Set([...SIZES, ...sizes])].map((s) => `<label class="check"><input type="checkbox" value="${esc(s)}" ${sizes.includes(s) ? 'checked' : ''}><span>${esc(s)}</span></label>`).join('')}</div></div><input class="input" placeholder="Other size" data-size-add style="max-width:140px"></div>
        <div class="opt-row"><span class="label">Colours</span><div><input class="input" data-colours value="${esc(colours.join(', '))}" placeholder="e.g. Black, Acid wash (leave empty for one colour)"></div><span></span></div>
        ${extraOpts.length ? `<div class="note note--warn">This product also has the option${extraOpts.length > 1 ? 's' : ''} ${extraOpts.map((o) => `<b>${esc(o.name)}</b>`).join(', ')}, kept as they are.</div>` : ''}
        <div class="row row--3" style="margin-top:14px"><label class="field"><span>Price for all (\u20A6)</span><input data-base-price inputmode="decimal" placeholder="fills empty rows"></label><label class="field"><span>Compare-at for all (\u20A6)</span><input data-base-cmp inputmode="decimal" placeholder="optional"></label><label class="field"><span>Stock for all</span><input data-base-qty inputmode="numeric" placeholder="optional"></label></div>
        <button type="button" class="btn btn--sm" data-apply-all>Apply to all rows</button>
        <div class="table-wrap" style="margin-top:12px"><table class="t vt"><thead><tr><th>Variant</th><th>Price (\u20A6)</th><th>Compare-at (\u20A6)</th><th>Stock</th><th class="hide-sm">SKU</th></tr></thead><tbody data-variants></tbody></table></div>
        ${isNew ? '' : '<div style="margin-top:12px;display:flex;gap:8px;align-items:center"><button type="button" class="btn btn--red btn--sm" data-save-variants>Save variants</button><span class="muted" style="font-size:12px">Removing a size or colour deletes those variants.</span></div>'}
      </div>
      <div class="card"><div class="card__h"><h2>Search engine listing</h2></div>
        <label class="field"><span>Meta title</span><input name="seoTitle" maxlength="70" value="${esc(P.seo.title || '')}" placeholder="${esc(P.title || 'Defaults to the product title')}"></label>
        <label class="field"><span>Meta description</span><textarea name="seoDescription" maxlength="320" rows="3" placeholder="Defaults to the start of the description">${esc(P.seo.description || '')}</textarea></label>
      </div>
    </div>
    <div>
      <div class="card"><div class="card__h"><h2>Status</h2></div>
        <label class="field"><span>Visibility</span><select name="status"><option value="ACTIVE">Active: live on the site</option><option value="DRAFT">Draft: hidden</option><option value="ARCHIVED">Archived</option></select></label>
      </div>
      <div class="card"><div class="card__h"><h2>Collections</h2></div>
        ${cols.length ? `<div class="switches">${cols.filter((c) => !c.smart).map((c) => `<label class="switch"><input type="checkbox" name="col" value="${esc(c.id)}" ${P.collections.some((x) => x.id === c.id) ? 'checked' : ''}><i></i><span>${esc(c.title)}</span></label>`).join('')}</div>` : '<p class="muted">No collections yet. <a href="#/collections/new">Create one</a>.</p>'}
      </div>
      <div class="card"><div class="card__h"><h2>Drop &amp; pre-order</h2></div>
        <div class="switches">${sw('preorder', P.drop.preorder, 'Pre-order (sell before stock arrives)')}</div>
        <label class="field" style="margin-top:14px"><span>Drop / ship date (WAT)</span><input type="datetime-local" name="dropAt" value="${toWat(P.drop.dropAt)}"></label>
        <label class="field"><span>Note shown on the product</span><input name="dropNote" maxlength="200" value="${esc(P.drop.note || '')}" placeholder="e.g. Made to order. Ships in the second week of the drop."></label>
      </div>
    </div>
    <div class="save-bar"><a class="btn btn--ghost" href="#/products">Cancel</a><button class="btn btn--red" type="submit">${isNew ? 'Create product' : 'Save changes'}</button></div>
  </form>`;
  const f = $('[data-form]', v);
  f.status.value = P.status;
  charCount(f.seoTitle, 70); charCount(f.seoDescription, 320);

  // ----- variants table -----
  const vbody = $('[data-variants]', v);
  const currentOptions = () => {
    sizes = $$('[data-sizes] input:checked', v).map((x) => x.value);
    colours = $('[data-colours]', v).value.split(',').map((x) => x.trim()).filter(Boolean);
    const opts = [];
    if (sizes.length) opts.push({ name: sizeOpt ? sizeOpt.name : 'Size', values: sizes });
    if (colours.length) opts.push({ name: colourName, values: colours });
    extraOpts.forEach((o) => opts.push({ name: o.name, values: o.values }));
    return opts;
  };
  const combos = (opts) => opts.reduce((acc, o) => acc.flatMap((a) => o.values.map((val) => ({ ...a, [o.name]: val }))), [{}]);
  const drawVariants = () => {
    const keep = Object.fromEntries($$('tr[data-key]', vbody).map((tr) => [tr.dataset.key, { price: $('[data-p]', tr).value, cmp: $('[data-c]', tr).value, qty: $('[data-q]', tr).value, sku: $('[data-s]', tr).value }]));
    const opts = currentOptions();
    const list = combos(opts);
    vbody.innerHTML = list.map((o) => {
      const key = JSON.stringify(o);
      const ex = [...rowsByKey.values()].find((x) => opts.every((op) => x.options[op.name] === o[op.name]) && Object.keys(x.options).length === opts.length) || (opts.length === 0 ? P.variants[0] : null);
      const k = keep[key] || {};
      const label = Object.values(o).join(' / ') || 'Default';
      return `<tr data-key="${esc(key)}"><td>${esc(label)}${ex ? '' : ' <span class="chip chip--draft">new</span>'}</td>
        <td><input class="input" inputmode="decimal" data-p value="${esc(k.price ?? (ex ? ex.price : ''))}"></td>
        <td><input class="input" inputmode="decimal" data-c value="${esc(k.cmp ?? (ex && ex.compareAt ? ex.compareAt : ''))}" placeholder="none"></td>
        <td><input class="input" inputmode="numeric" data-q value="${esc(k.qty ?? (ex && ex.tracked ? ex.quantity : ''))}" placeholder="0"></td>
        <td class="hide-sm"><input class="input" data-s value="${esc(k.sku ?? (ex ? ex.sku || '' : ''))}"></td></tr>`;
    }).join('');
  };
  drawVariants();
  v.addEventListener('change', (e) => { if (e.target.closest('[data-sizes]')) drawVariants(); });
  $('[data-colours]', v).addEventListener('change', drawVariants);
  $('[data-size-add]', v).addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return; e.preventDefault();
    const val = e.target.value.trim().toUpperCase(); if (!val) return;
    if (!$$('[data-sizes] input', v).some((x) => x.value === val)) $('[data-sizes]', v).insertAdjacentHTML('beforeend', `<label class="check"><input type="checkbox" value="${esc(val)}" checked><span>${esc(val)}</span></label>`);
    e.target.value = ''; drawVariants();
  });
  $('[data-apply-all]', v).addEventListener('click', () => {
    const bp = $('[data-base-price]', v).value; const bc = $('[data-base-cmp]', v).value; const bq = $('[data-base-qty]', v).value;
    $$('tr[data-key]', vbody).forEach((tr) => { if (bp) $('[data-p]', tr).value = bp; if (bc) $('[data-c]', tr).value = bc; if (bq) $('[data-q]', tr).value = bq; });
  });
  const variantPayload = () => {
    const opts = currentOptions();
    const rows = $$('tr[data-key]', vbody).map((tr) => ({ options: JSON.parse(tr.dataset.key), price: $('[data-p]', tr).value, compareAt: $('[data-c]', tr).value, quantity: $('[data-q]', tr).value, sku: $('[data-s]', tr).value }));
    const missing = rows.find((r) => !r.price);
    if (missing) throw new Error(`Set a price for ${Object.values(missing.options).join(' / ') || 'the product'}.`);
    return { options: opts, variants: rows };
  };
  const saveVariants = $('[data-save-variants]', v);
  if (saveVariants) saveVariants.addEventListener('click', async () => {
    let body; try { body = variantPayload(); } catch (e) { toast(e.message, true); return; }
    const r = await run(saveVariants, () => api(`/products/${num(P.id)}/variants`, { method: 'PUT', body }), 'Variants saved');
    if (r) route();
  });

  // ----- media -----
  const pendingFiles = [];
  const mediaBox = $('[data-media]', v);
  const upload = async (files) => {
    const list = [...files].filter((x) => /^image\//.test(x.type));
    if (!list.length) return;
    if (isNew) { pendingFiles.push(...list); $('[data-pending]', v).textContent = `${pendingFiles.length} image${pendingFiles.length === 1 ? '' : 's'} ready to upload`; return; }
    const fd = new FormData(); list.forEach((x) => fd.append('images', x));
    $('[data-pending]', v).textContent = `Uploading ${list.length} image${list.length === 1 ? '' : 's'} to Shopify\u2026`;
    try { await api(`/products/${num(P.id)}/images`, { method: 'POST', form: fd }); toast('Images uploaded. Shopify may take a few seconds to process them.'); route(); }
    catch (e) { fail(e); $('[data-pending]', v).textContent = ''; }
  };
  $('[data-files]', v).addEventListener('change', (e) => upload(e.target.files));
  const dz = $('[data-drop]', v);
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); dz.classList.add('is-over'); } }));
  dz.addEventListener('dragleave', () => dz.classList.remove('is-over'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('is-over'); upload(e.dataTransfer.files); });
  let dragEl = null;
  mediaBox.addEventListener('dragstart', (e) => { dragEl = e.target.closest('.media__item'); if (dragEl) dragEl.classList.add('is-drag'); });
  mediaBox.addEventListener('dragover', (e) => { const over = e.target.closest('.media__item'); if (dragEl && over && over !== dragEl) { e.preventDefault(); $$('.media__item', mediaBox).forEach((x) => x.classList.toggle('is-over', x === over)); } });
  mediaBox.addEventListener('drop', async (e) => {
    const over = e.target.closest('.media__item'); if (!dragEl || !over || over === dragEl) return;
    e.preventDefault();
    const items = $$('.media__item', mediaBox);
    if (items.indexOf(dragEl) < items.indexOf(over)) over.after(dragEl); else over.before(dragEl);
    $$('.media__item', mediaBox).forEach((x, i) => { x.classList.remove('is-over'); $('.n', x).textContent = i + 1; });
    try { await api(`/products/${num(P.id)}/images/order`, { method: 'PUT', body: { mediaIds: $$('.media__item', mediaBox).map((x) => x.dataset.mid) } }); toast('Image order saved'); } catch (err) { fail(err); }
  });
  mediaBox.addEventListener('dragend', () => { if (dragEl) dragEl.classList.remove('is-drag'); dragEl = null; $$('.media__item', mediaBox).forEach((x) => x.classList.remove('is-over')); });
  mediaBox.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del-media]'); if (!b) return;
    const item = b.closest('.media__item');
    if (!(await confirmDialog('Delete image?', 'It is removed from Shopify for good.'))) return;
    try { await api(`/products/${num(P.id)}/images/${num(item.dataset.mid)}`, { method: 'DELETE' }); item.remove(); toast('Image deleted'); } catch (err) { fail(err); }
  });

  // ----- save -----
  const toHtml = (s) => (/<[a-z][\s\S]*>/i.test(s) ? s : s.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join(''));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!f.title.value.trim()) { toast('A title is required.', true); f.title.focus(); return; }
    const body = {
      title: f.title.value.trim(), descriptionHtml: toHtml(f.descriptionHtml.value), type: f.type.value.trim(), tags: f.tags.value,
      status: f.status.value, seo: { title: f.seoTitle.value.trim(), description: f.seoDescription.value.trim() },
      collectionIds: $$('[name="col"]:checked', f).map((x) => x.value),
      drop: { preorder: f.preorder.checked, dropAt: fromWat(f.dropAt.value), note: f.dropNote.value.trim() },
    };
    const btn = $('[type="submit"]', f);
    if (isNew) {
      let vp; try { vp = variantPayload(); } catch (err) { toast(err.message, true); return; }
      const r = await run(btn, () => api('/products', { method: 'POST', body: { ...body, ...vp } }));
      if (!r) return;
      if (pendingFiles.length) {
        const fd = new FormData(); pendingFiles.forEach((x) => fd.append('images', x));
        try { await api(`/products/${num(r.id)}/images`, { method: 'POST', form: fd }); } catch (err) { toast(`Product created, but images failed: ${err.message}`, true); }
      }
      toast('Product created'); location.hash = `#/products/${num(r.id)}`;
    } else {
      const r = await run(btn, () => api(`/products/${num(P.id)}`, { method: 'PATCH', body }), 'Saved');
      if (r) { $('.ph h1', v).textContent = r.product.title; }
    }
  });
  if (!isNew) {
    $('[data-dup]', v).addEventListener('click', async (e) => {
      const r = await run(e.currentTarget, () => api(`/products/${num(P.id)}/duplicate`, { method: 'POST', body: { title: `${P.title} (copy)` } }));
      if (r) { toast('Duplicated as a draft'); location.hash = `#/products/${num(r.id)}`; }
    });
    $('[data-del]', v).addEventListener('click', async () => {
      if (!(await confirmDialog('Delete this product?', `${P.title} is deleted from Shopify with its images and variants. Past orders keep their records.`, { ok: 'Delete' }))) return;
      try { await api(`/products/${num(P.id)}`, { method: 'DELETE' }); toast('Product deleted'); location.hash = '#/products'; } catch (err) { fail(err); }
    });
  }
  void store;
}

/* ------------------------------ inventory ------------------------------ */
async function viewInventory() {
  const v = V();
  if (needsShopify()) { v.innerHTML = header('Inventory') + connectPanel(); return; }
  const r = await api('/inventory');
  let lowOnly = false;
  const draw = () => {
    const list = r.items.filter((x) => !lowOnly || (x.tracked && x.quantity <= r.threshold));
    $('[data-rows]', v).innerHTML = list.length ? list.map((x) => `<tr data-item="${esc(x.inventoryItemId)}" data-orig="${x.quantity}">
      <td><a class="cell-title" href="#/products/${num(x.productId)}">${x.image ? `<img class="thumb" src="${esc(sz(x.image, 100))}" alt="" loading="lazy">` : '<span class="thumb thumb--ph"></span>'}<span><b>${esc(x.product)}</b><small>${esc(x.variant || 'Default')}${x.sku ? ` \u00B7 ${esc(x.sku)}` : ''}</small></span></a></td>
      <td>${chip(x.status.toLowerCase(), x.status)}</td>
      <td>${!x.tracked ? '<span class="muted">untracked</span>' : x.quantity <= r.threshold ? '<span class="chip chip--low">Low</span>' : ''}</td>
      <td class="num"><input class="input" inputmode="numeric" value="${x.quantity}" data-qty ${x.tracked ? '' : 'disabled'} aria-label="Stock"></td></tr>`).join('') : '<tr class="empty-row"><td colspan="4">Nothing here.</td></tr>';
  };
  v.innerHTML = header('Inventory', `Low stock means ${r.threshold} or fewer. Change the threshold under SEO &amp; store status.`, '<button class="btn btn--red" data-save disabled>Save stock</button>') + `
    <div class="card"><div class="toolbar"><label class="switch"><input type="checkbox" data-low><i></i><span>Low stock only</span></label></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Variant</th><th>Status</th><th>Alert</th><th class="num">Available</th></tr></thead><tbody data-rows></tbody></table></div></div>`;
  draw();
  const changed = () => $$('tr[data-item]', v).filter((tr) => $('[data-qty]', tr).value !== tr.dataset.orig);
  v.addEventListener('input', (e) => { if (e.target.matches('[data-qty]')) { const n = changed().length; $('[data-save]', v).disabled = !n; $('[data-save]', v).textContent = n ? `Save stock (${n})` : 'Save stock'; } });
  $('[data-low]', v).addEventListener('change', (e) => { lowOnly = e.target.checked; draw(); });
  $('[data-save]', v).addEventListener('click', async (e) => {
    const items = changed().map((tr) => ({ inventoryItemId: tr.dataset.item, quantity: Number($('[data-qty]', tr).value) }));
    if (items.some((x) => !Number.isInteger(x.quantity) || x.quantity < 0)) { toast('Stock must be a whole number, 0 or more.', true); return; }
    const ok = await run(e.currentTarget, () => api('/inventory', { method: 'POST', body: { items } }), 'Stock saved');
    if (ok) route();
  });
}

/* ------------------------------ collections ------------------------------ */
async function viewCollections() {
  const v = V();
  if (needsShopify()) { v.innerHTML = header('Collections') + connectPanel(); return; }
  const r = await api('/collections');
  v.innerHTML = header('Collections', 'Group pieces into drops and rituals.', `<a class="btn btn--red" href="#/collections/new">${I.plus}New collection</a>`) + `
    <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Collection</th><th>Type</th><th class="num">Products</th><th class="hide-sm">Updated</th></tr></thead><tbody>
    ${r.items.length ? r.items.map((c) => `<tr><td><a class="cell-title" href="#/collections/${num(c.id)}">${c.image ? `<img class="thumb" src="${esc(sz(c.image, 100))}" alt="">` : '<span class="thumb thumb--ph"></span>'}<span><b>${esc(c.title)}</b><small>/collections/${esc(c.handle)}</small></span></a></td><td>${c.smart ? chip('draft', 'Automatic') : chip('active', 'Manual')}</td><td class="num">${c.count}</td><td class="hide-sm">${dt(c.updatedAt)}</td></tr>`).join('') : '<tr class="empty-row"><td colspan="4">No collections yet.</td></tr>'}
    </tbody></table></div></div>`;
}

async function viewCollection(id) {
  const v = V();
  if (needsShopify()) { v.innerHTML = header('Collection') + connectPanel(); return; }
  const [c, prods] = await Promise.all([id ? api(`/collections/${num(id)}`).then((x) => x.collection) : null, api('/products').then((x) => x.items)]);
  const C = c || { title: '', descriptionHtml: '', seo: { title: '', description: '' }, products: [], smart: false };
  const inSet = new Set(C.products.map((p) => p.id));
  v.innerHTML = header(c ? C.title : 'New collection', c ? `/collections/${esc(C.handle)}` : '', c ? `<a class="btn btn--ghost" href="/collections/${esc(C.handle)}" target="_blank" rel="noopener">${I.ext}View</a><button class="btn btn--danger" data-del>Delete</button>` : '', '<a class="crumb" href="#/collections">\u2190 Collections</a>') + `
    <form class="detail" novalidate>
      <div><div class="card"><label class="field"><span>Title</span><input name="title" required maxlength="255" value="${esc(C.title)}"></label>
        <label class="field"><span>Description</span><textarea name="descriptionHtml" rows="4">${esc(C.descriptionHtml)}</textarea></label>
        <div class="row row--2"><label class="field"><span>Meta title</span><input name="seoTitle" maxlength="70" value="${esc(C.seo ? C.seo.title || '' : '')}"></label><label class="field"><span>Meta description</span><input name="seoDescription" maxlength="320" value="${esc(C.seo ? C.seo.description || '' : '')}"></label></div></div></div>
      <div><div class="card"><div class="card__h"><h2>Products</h2></div>
        ${C.smart ? '<p class="muted">This is an automatic collection; Shopify assigns products by its rules.</p>' : prods.length ? `<div class="switches">${prods.map((p) => `<label class="switch"><input type="checkbox" name="p" value="${esc(p.id)}" ${inSet.has(p.id) ? 'checked' : ''}><i></i><span>${esc(p.title)} <span class="muted">${esc(p.status.toLowerCase())}</span></span></label>`).join('')}</div>` : '<p class="muted">No products yet.</p>'}
      </div></div>
      <div class="save-bar"><a class="btn btn--ghost" href="#/collections">Cancel</a><button class="btn btn--red" type="submit">${c ? 'Save' : 'Create collection'}</button></div>
    </form>`;
  const f = $('form', v);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const picked = $$('[name="p"]:checked', f).map((x) => x.value);
    const body = { title: f.title.value.trim(), descriptionHtml: f.descriptionHtml.value, seo: { title: f.seoTitle.value, description: f.seoDescription.value } };
    if (!body.title) { toast('A title is required.', true); return; }
    const btn = $('[type="submit"]', f);
    if (c) {
      const add = picked.filter((x) => !inSet.has(x)); const remove = [...inSet].filter((x) => !picked.includes(x));
      const r = await run(btn, () => api(`/collections/${num(C.id)}`, { method: 'PATCH', body: { ...body, add, remove } }), 'Collection saved');
      if (r) route();
    } else {
      const r = await run(btn, () => api('/collections', { method: 'POST', body: { ...body, productIds: picked } }), 'Collection created');
      if (r) location.hash = `#/collections/${num(r.id)}`;
    }
  });
  if (c) $('[data-del]', v).addEventListener('click', async () => {
    if (!(await confirmDialog('Delete collection?', 'The products stay; only the grouping is removed.', { ok: 'Delete' }))) return;
    try { await api(`/collections/${num(C.id)}`, { method: 'DELETE' }); toast('Collection deleted'); location.hash = '#/collections'; } catch (err) { fail(err); }
  });
}

/* ------------------------------ discounts ------------------------------ */
async function viewDiscounts() {
  const v = V();
  if (needsShopify()) { v.innerHTML = header('Discounts & promos') + connectPanel(); return; }
  const r = await api('/discounts');
  const codes = r.items.filter((x) => !x.automatic); const autos = r.items.filter((x) => x.automatic);
  const table = (list, empty) => `<div class="table-wrap"><table class="t"><thead><tr><th>Discount</th><th>Status</th><th class="hide-sm">Runs</th><th class="num">Used</th><th></th></tr></thead><tbody>
    ${list.length ? list.map((d) => `<tr data-id="${num(d.id)}" data-auto="${d.automatic}"><td><b>${esc(d.code || d.title)}</b><br><small class="muted">${esc(d.summary || d.title)}</small></td><td>${chip(String(d.status).toLowerCase(), d.status)}</td>
      <td class="hide-sm">${dt(d.startsAt)}${d.endsAt ? ` \u2192 ${dt(d.endsAt)}` : ' \u2192 open'}</td><td class="num">${d.used}${d.usageLimit ? ` / ${d.usageLimit}` : ''}</td>
      <td class="num"><button class="btn btn--sm" data-toggle="${d.status === 'ACTIVE' ? 'deactivate' : 'activate'}">${d.status === 'ACTIVE' ? 'Pause' : 'Activate'}</button> <button class="btn btn--sm btn--danger" data-remove>Delete</button></td></tr>`).join('') : `<tr class="empty-row"><td colspan="5">${empty}</td></tr>`}
    </tbody></table></div>`;
  v.innerHTML = header('Discounts & promos', 'Codes customers type at checkout, and automatic promos that apply by themselves. For a storewide sale on prices, use Bulk price in Products.', `<button class="btn" data-new-auto>${I.plus}Automatic promo</button><button class="btn btn--red" data-new-code>${I.plus}Discount code</button>`) + `
    <div class="card"><div class="card__h"><h2>Discount codes</h2></div>${table(codes, 'No codes yet.')}</div>
    <div class="card"><div class="card__h"><h2>Automatic promos</h2></div>${table(autos, 'No automatic promos.')}</div>`;
  v.addEventListener('click', async (e) => {
    if (e.target.closest('[data-new-code]')) discountDialog(false);
    if (e.target.closest('[data-new-auto]')) discountDialog(true);
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    const t = e.target.closest('[data-toggle]');
    if (t) { const ok = await run(t, () => api(`/discounts/${tr.dataset.id}/${t.dataset.toggle}?automatic=${tr.dataset.auto}`, { method: 'POST' }), 'Updated'); if (ok) route(); }
    if (e.target.closest('[data-remove]')) {
      if (!(await confirmDialog('Delete discount?', 'Customers can no longer use it.', { ok: 'Delete' }))) return;
      try { await api(`/discounts/${tr.dataset.id}?automatic=${tr.dataset.auto}`, { method: 'DELETE' }); toast('Discount deleted'); route(); } catch (err) { fail(err); }
    }
  });
}
function discountDialog(automatic) {
  dialog(`<h2 id="dialog-title">${automatic ? 'New automatic promo' : 'New discount code'}</h2><form novalidate>
    <label class="field"><span>Title (shown to customers)</span><input name="title" required maxlength="120" placeholder="${automatic ? 'e.g. Drop week: 10% off' : 'e.g. Cult members 15%'}"></label>
    ${automatic ? '' : '<label class="field"><span>Code</span><input name="code" required maxlength="40" placeholder="e.g. CULT15" style="text-transform:uppercase"></label>'}
    <div class="row row--2"><label class="field"><span>Type</span><select name="kind"><option value="percent">Percentage off</option><option value="fixed">Fixed amount off (\u20A6)</option><option value="shipping">Free delivery</option></select></label>
    <label class="field" data-value><span>Value</span><input name="value" inputmode="decimal" placeholder="e.g. 15"></label></div>
    <div class="row row--2"><label class="field"><span>Minimum order (\u20A6)</span><input name="minSubtotal" inputmode="decimal" placeholder="none"></label>
    ${automatic ? '<span></span>' : '<label class="field"><span>Total usage limit</span><input name="usageLimit" inputmode="numeric" placeholder="unlimited"></label>'}</div>
    <div class="row row--2"><label class="field"><span>Starts (WAT)</span><input type="datetime-local" name="startsAt" value="${toWat(new Date().toISOString())}"></label><label class="field"><span>Ends (WAT)</span><input type="datetime-local" name="endsAt"></label></div>
    ${automatic ? '' : sw('oncePerCustomer', false, 'One use per customer')}
    <p class="muted" style="font-size:12px;margin-top:12px">Free delivery only applies when a delivery fee is on the order.</p>
    <div class="dialog__actions"><button type="button" class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--red" type="submit">Create</button></div></form>`, (p, close) => {
    const f = $('form', p);
    f.kind.onchange = () => { $('[data-value]', p).hidden = f.kind.value === 'shipping'; };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const body = { automatic, title: f.title.value.trim(), code: f.code ? f.code.value.trim().toUpperCase() : undefined, kind: f.kind.value, value: f.value.value, minSubtotal: f.minSubtotal.value, usageLimit: f.usageLimit ? f.usageLimit.value : undefined, oncePerCustomer: f.oncePerCustomer ? f.oncePerCustomer.checked : false, startsAt: fromWat(f.startsAt.value), endsAt: fromWat(f.endsAt.value) };
      const r = await run($('[type="submit"]', f), () => api('/discounts', { method: 'POST', body }));
      if (r) { toast(automatic ? 'Promo created' : `Code ${body.code} created`); close(); route(); }
    };
  });
}

/* ------------------------------ orders ------------------------------ */
async function viewOrders() {
  const v = V();
  if (needsShopify()) { v.innerHTML = header('Orders') + connectPanel(); return; }
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  let status = qs.get('status') || ''; let q = '';
  v.innerHTML = header('Orders', 'Site orders arrive as draft orders. Mark them paid once payment is confirmed on WhatsApp.', `<a class="btn" href="/api/admin/orders/export.csv" download>${I.dl}Export CSV</a>`) + `
    <div class="card"><div class="toolbar"><input class="input" type="search" placeholder="Search name, email, number" data-q><select class="input" data-status><option value="">All statuses</option>${STATUSES.map((s) => `<option value="${s}">${STATUS_LABEL[s]}</option>`).join('')}</select></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Order</th><th class="hide-sm">Date</th><th>Customer</th><th class="hide-sm">Items</th><th class="num">Total</th><th>Status</th></tr></thead><tbody data-rows></tbody></table></div></div>`;
  $('[data-status]', v).value = status;
  const load = async () => {
    $('[data-rows]', v).innerHTML = '<tr><td colspan="6"><div class="skel"></div></td></tr>';
    const r = await api(`/orders?${new URLSearchParams({ status, q })}`);
    $('[data-rows]', v).innerHTML = r.items.length ? r.items.map((o) => `<tr><td><a href="#/orders/${o.kind}/${num(o.id)}"><b>${esc(o.name)}</b></a> ${o.kind === 'draft' ? '<span class="chip chip--draftorder">Draft</span>' : ''}</td><td class="hide-sm">${dtt(o.createdAt)}</td><td>${esc(o.customer || '\u2014')}<br><small class="muted">${esc(o.address ? [o.address.city, o.address.province].filter(Boolean).join(', ') : '')}</small></td><td class="hide-sm">${o.items.reduce((s, i) => s + i.quantity, 0)}</td><td class="num">${ngn(o.total)}</td><td>${chip(o.status)}</td></tr>`).join('') : '<tr class="empty-row"><td colspan="6">No orders here yet.</td></tr>';
  };
  let t; $('[data-q]', v).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value.trim(); load().catch(fail); }, 350); });
  $('[data-status]', v).addEventListener('change', (e) => { status = e.target.value; load().catch(fail); });
  await load();
}

async function viewOrder(id) {
  const v = V();
  if (needsShopify()) { v.innerHTML = header('Order') + connectPanel(); return; }
  const { order: o } = await api(`/orders/${encodeURIComponent(id)}`);
  const first = (o.customer || '').split(' ')[0];
  const waMsg = `Hi ${first || 'there'}, this is EOS about your order ${o.name}.`;
  const a = o.address || {};
  v.innerHTML = header(o.name, `${o.kind === 'draft' ? 'Draft order' : 'Order'} \u00B7 ${dtt(o.createdAt)}`,
    `${o.phone ? `<a class="btn" href="https://wa.me/${waDigits(o.phone)}?text=${encodeURIComponent(waMsg)}" target="_blank" rel="noopener">${I.wa}WhatsApp customer</a>` : ''}${shopifyAdminUrl(o.id) ? `<a class="btn btn--ghost" href="${shopifyAdminUrl(o.id)}" target="_blank" rel="noopener">${I.ext}Shopify</a>` : ''}`,
    '<a class="crumb" href="#/orders">\u2190 Orders</a>') + `
    <div class="detail">
      <div>
        <div class="card"><div class="card__h"><h2>Status</h2>${chip(o.status)}</div>
          <div class="status-pick">${STATUSES.map((s) => `<button type="button" data-status="${s}" aria-pressed="${o.status === s}">${STATUS_LABEL[s]}</button>`).join('')}</div>
          ${o.kind === 'draft' ? `<div class="note" style="margin-top:14px">Payment confirmed? <b>Mark as paid</b> completes the draft in Shopify and creates a real paid order (stock is deducted then).<div style="margin-top:10px"><button class="btn btn--red btn--sm" data-paid>Mark as paid</button></div></div>` : o.canMarkAsPaid ? '<div style="margin-top:14px"><button class="btn btn--red btn--sm" data-paid>Mark as paid</button></div>' : `<p class="muted" style="margin:14px 0 0;font-size:12px">Payment: ${esc(o.financial || '')} \u00B7 Fulfilment: ${esc(o.fulfillment || '')}</p>`}
        </div>
        <div class="card"><div class="card__h"><h2>Items</h2></div><div class="items">
          ${o.items.map((i) => `<div>${i.image ? `<img class="thumb" src="${esc(sz(i.image, 100))}" alt="">` : '<span class="thumb thumb--ph"></span>'}<span><b>${esc(i.title)}</b><br><small class="muted">${esc(i.variant)}${i.sku ? ` \u00B7 ${esc(i.sku)}` : ''}</small></span><span class="mono">${i.quantity} \u00D7 ${ngn(i.price)}</span></div>`).join('')}
        </div>
        <dl class="kv" style="margin-top:14px"><dt>Subtotal</dt><dd class="mono">${ngn(o.subtotal)}</dd>${o.discount ? `<dt>Discount</dt><dd class="mono">-${ngn(o.discount)} ${esc(o.discountCodes.join(', '))}</dd>` : ''}<dt>Delivery</dt><dd class="mono">${o.shipping ? ngn(o.shipping) : '<span class="muted">not set, confirm with the customer</span>'}</dd><dt><b>Total</b></dt><dd class="mono"><b>${ngn(o.total)}</b></dd></dl></div>
        <div class="card"><div class="card__h"><h2>Notes</h2></div><textarea class="input" rows="5" data-note>${esc(o.note || '')}</textarea><div style="margin-top:8px"><button class="btn btn--sm" data-save-note>Save note</button></div></div>
      </div>
      <div>
        <div class="card"><div class="card__h"><h2>Customer</h2></div><dl class="kv"><dt>Name</dt><dd>${esc(o.customer || '\u2014')}</dd><dt>Phone</dt><dd>${o.phone ? `<a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>` : '\u2014'}</dd><dt>Email</dt><dd>${o.email ? `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>` : '\u2014'}</dd></dl></div>
        <div class="card"><div class="card__h"><h2>Deliver to</h2></div><p style="margin:0">${[a.name, a.address1, a.address2, a.city, a.province, a.country].filter(Boolean).map(esc).join('<br>') || '\u2014'}</p></div>
        <div class="card"><div class="card__h"><h2>Tags</h2></div><p class="muted" style="margin:0;font-size:12px">${esc((o.tags || []).join(', ') || 'none')}</p></div>
      </div>
    </div>`;
  v.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-status]');
    if (s) { const r = await run(s, () => api(`/orders/${encodeURIComponent(o.id)}/status`, { method: 'POST', body: { status: s.dataset.status } }), `Marked ${STATUS_LABEL[s.dataset.status].toLowerCase()}`); if (r) route(); }
    const p = e.target.closest('[data-paid]');
    if (p) {
      if (!(await confirmDialog('Mark as paid?', o.kind === 'draft' ? 'This completes the draft order in Shopify. It cannot be turned back into a draft.' : 'Records the payment on this order in Shopify.', { danger: false, ok: 'Mark paid' }))) return;
      const r = await run(p, () => api(`/orders/${encodeURIComponent(o.id)}/paid`, { method: 'POST' }), 'Marked as paid');
      if (r) location.hash = `#/orders/${r.order.kind}/${num(r.order.id)}`;
    }
    const n = e.target.closest('[data-save-note]');
    if (n) await run(n, () => api(`/orders/${encodeURIComponent(o.id)}/note`, { method: 'PATCH', body: { note: $('[data-note]', v).value } }), 'Note saved');
  });
}

/* ------------------------------ customers ------------------------------ */
async function viewCustomers() {
  const v = V();
  if (needsShopify()) { v.innerHTML = header('Customers') + connectPanel(); return; }
  let subs = false; let q = '';
  v.innerHTML = header('Customers', 'Buyers and everyone who joined the cult.', `<a class="btn" data-export href="/api/admin/customers/export.csv" download>${I.dl}Export CSV</a>`) + `
    <div class="card"><div class="toolbar"><input class="input" type="search" placeholder="Search name, email, phone" data-q><label class="switch"><input type="checkbox" data-subs><i></i><span>Newsletter subscribers only</span></label></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Customer</th><th class="hide-sm">Phone</th><th>Newsletter</th><th class="num">Orders</th><th class="num">Spent</th><th class="hide-sm">Joined</th></tr></thead><tbody data-rows></tbody></table></div><p class="muted" data-count style="font-size:12px;margin:10px 0 0"></p></div>`;
  const load = async () => {
    $('[data-rows]', v).innerHTML = '<tr><td colspan="6"><div class="skel"></div></td></tr>';
    const r = await api(`/customers?${new URLSearchParams({ q, subscribers: subs ? '1' : '' })}`);
    $('[data-rows]', v).innerHTML = r.items.length ? r.items.map((c) => `<tr><td><b>${esc(c.name || c.email || '\u2014')}</b><br><small class="muted">${esc(c.email || '')}</small></td><td class="hide-sm">${esc(c.phone || '\u2014')}</td><td>${c.subscribed ? chip('active', 'Subscribed') : '<span class="muted">\u2014</span>'}</td><td class="num">${c.orders}</td><td class="num">${ngn(c.spent)}</td><td class="hide-sm">${dt(c.createdAt)}</td></tr>`).join('') : '<tr class="empty-row"><td colspan="6">No customers yet.</td></tr>';
    $('[data-count]', v).textContent = `${r.items.length} shown`;
    $('[data-export]', v).href = `/api/admin/customers/export.csv${subs ? '?subscribers=1' : ''}`;
  };
  let t; $('[data-q]', v).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value.trim(); load().catch(fail); }, 350); });
  $('[data-subs]', v).addEventListener('change', (e) => { subs = e.target.checked; load().catch(fail); });
  await load();
}

/* ------------------------------ site settings ------------------------------ */
async function loadSettings() { const r = await api('/settings'); state.settings = r.settings; return r.settings; }
async function saveSettings(patch, btn, msg = 'Saved. The site updates within a minute.') {
  const r = await run(btn, () => api('/settings', { method: 'PATCH', body: { settings: patch } }), msg);
  if (r) state.settings = r.settings;
  return r;
}
const settingsNote = () => (needsShopify() ? '<div class="note note--warn"><b>Read only.</b> Site settings are stored in Shopify (a metaobject). Connect Shopify to save changes; the site uses these defaults until then.</div>' : '');

async function viewStorefront() {
  const v = V();
  const s = await loadSettings();
  const prods = needsShopify() ? [] : await api('/products?status=active').then((r) => r.items).catch(() => []);
  const cols = needsShopify() ? [] : await api('/collections').then((r) => r.items).catch(() => []);
  v.innerHTML = header('Homepage & banner', 'What visitors see first.', `<a class="btn btn--ghost" href="/" target="_blank" rel="noopener">${I.ext}Preview</a>`) + settingsNote() + `
  <form novalidate data-f>
    <div class="grid grid--half">
      <div class="card"><div class="card__h"><h2>Announcement bar</h2></div>
        <div class="switches">${sw('annOn', s.announcement.enabled, 'Show the announcement bar')}</div>
        <label class="field" style="margin-top:14px"><span>Text</span><input name="annText" maxlength="160" value="${esc(s.announcement.text)}" placeholder="e.g. The second drop opens Friday, 8pm"></label>
        <label class="field"><span>Link (optional)</span><input name="annLink" maxlength="300" value="${esc(s.announcement.link)}" placeholder="/shop or https://..."></label></div>
      <div class="card"><div class="card__h"><h2>Hero</h2></div>
        <label class="field"><span>Small line above the title (optional, leave empty for none)</span><input name="heroEyebrow" maxlength="80" value="${esc(s.hero.eyebrow)}"></label>
        <label class="field"><span>Title</span><input name="heroTitle" maxlength="60" value="${esc(s.hero.title)}"></label>
        <label class="field"><span>Subtitle</span><input name="heroSub" maxlength="160" value="${esc(s.hero.subtitle)}"></label>
        <div class="row row--2"><label class="field"><span>Button label</span><input name="ctaLabel" maxlength="40" value="${esc(s.hero.ctaLabel)}"></label><label class="field"><span>Button link</span><input name="ctaLink" maxlength="300" value="${esc(s.hero.ctaLink)}"></label></div></div>
    </div>
    <div class="grid grid--half" style="margin-top:14px">
      <div class="card"><div class="card__h"><h2>Home page layout</h2></div>
        <p class="muted" style="margin-top:0;font-size:13px">The home page is one full screen: the film, the title, the subtitle and the button. The manifesto lives on About, the film on Lookbook, the newsletter on Join the cult, and products in the Shop.</p></div>
      <div class="card"><div class="card__h"><h2>Featured order (shop)</h2></div>
        <p class="muted" style="margin-top:0;font-size:12px">These pieces come first when the shop is sorted by "Featured".</p>
        <input type="hidden" name="featTitle" value="${esc(s.featured.title)}">
        <label class="field"><span>Show pieces from a collection</span><select name="featCol"><option value="">Newest active products</option>${cols.map((c) => `<option value="${esc(c.handle)}" ${s.featured.collectionHandle === c.handle ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select></label>
        <div class="field"><span>Or hand-pick (in this order wins over the collection)</span>${prods.length ? `<div class="switches">${prods.map((p) => `<label class="switch"><input type="checkbox" name="feat" value="${esc(p.handle)}" ${s.featured.productHandles.includes(p.handle) ? 'checked' : ''}><i></i><span>${esc(p.title)}</span></label>`).join('')}</div>` : '<small>Active products appear here.</small>'}</div></div>
    </div>
    <div class="card" style="margin-top:14px"><div class="card__h"><h2>Next drop countdown</h2></div>
      <div class="switches">${sw('dropOn', s.drop.enabled, 'Show the "Next drop" timer on the Join the cult page')}</div>
      <div class="row row--3" style="margin-top:14px"><label class="field"><span>Title</span><input name="dropTitle" maxlength="80" value="${esc(s.drop.title)}"></label><label class="field"><span>Opens (WAT)</span><input type="datetime-local" name="dropAt" value="${toWat(s.drop.dateISO)}"></label>
      <label class="field"><span>Links to product</span><select name="dropProduct"><option value="">The shop</option>${prods.map((p) => `<option value="${esc(p.handle)}" ${s.drop.productHandle === p.handle ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></label></div>
      <label class="field"><span>Note (optional)</span><input name="dropNote" maxlength="200" value="${esc(s.drop.note)}"></label>
      <small class="muted">Per-product pre-order switches live on each product.</small></div>
    <div class="save-bar"><button class="btn btn--red" type="submit">Save homepage</button></div>
  </form>`;
  const f = $('[data-f]', v);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const order = s.featured.productHandles.filter((h) => $$('[name="feat"]:checked', f).some((x) => x.value === h));
    $$('[name="feat"]:checked', f).forEach((x) => { if (!order.includes(x.value)) order.push(x.value); });
    saveSettings({
      announcement: { enabled: f.annOn.checked, text: f.annText.value, link: f.annLink.value },
      hero: { eyebrow: f.heroEyebrow.value, title: f.heroTitle.value, subtitle: f.heroSub.value, ctaLabel: f.ctaLabel.value, ctaLink: f.ctaLink.value },
      featured: { title: f.featTitle.value, collectionHandle: f.featCol.value, productHandles: order },
      drop: { enabled: f.dropOn.checked, title: f.dropTitle.value, dateISO: fromWat(f.dropAt.value), productHandle: f.dropProduct.value, note: f.dropNote.value },
    }, $('[type="submit"]', f));
  });
}

async function viewShipping() {
  const v = V();
  const s = await loadSettings();
  const g = s.sizeGuide;
  const fee = (x) => (x === null || x === undefined ? '' : x);
  v.innerHTML = header('Shipping & payment', 'Delivery fees, payment instructions, returns and the size guide.') + settingsNote() + `
  <form novalidate data-f>
    <div class="grid grid--half">
      <div class="card"><div class="card__h"><h2>Delivery fee by zone</h2></div>
        <p class="muted" style="margin-top:0;font-size:12px">Leave a zone empty to show "Delivery fee confirmed on WhatsApp" for it.</p>
        <label class="field"><span>Lagos (\u20A6)</span><input name="lagos" inputmode="decimal" value="${fee(s.shipping.lagos)}" placeholder="not set"></label>
        <label class="field"><span>South West: Ogun, Oyo, Osun, Ondo, Ekiti (\u20A6)</span><input name="southWest" inputmode="decimal" value="${fee(s.shipping.southWest)}" placeholder="not set"></label>
        <label class="field"><span>All other states + FCT (\u20A6)</span><input name="other" inputmode="decimal" value="${fee(s.shipping.other)}" placeholder="not set"></label>
        <label class="field"><span>Delivery note</span><input name="shipNote" maxlength="300" value="${esc(s.shipping.note)}"></label></div>
      <div class="card"><div class="card__h"><h2>Payment instructions</h2></div>
        <label class="field"><span>Shown at checkout, on the success page and in the FAQ</span><textarea name="payment" rows="6" maxlength="1500">${esc(s.payment.instructions)}</textarea></label>
        <div class="card__h" style="margin-top:8px"><h2>Returns policy</h2></div>
        <label class="field"><span>Shown on Shipping &amp; returns, product pages and FAQ</span><textarea name="returns" rows="7" maxlength="4000">${esc(s.policies.returns)}</textarea></label></div>
    </div>
    <div class="card" style="margin-top:14px"><div class="card__h"><h2>Size guide</h2><button type="button" class="btn btn--sm" data-add-row>${I.plus}Add size</button></div>
      <div class="row row--2"><label class="field"><span>Unit</span><select name="unit"><option value="cm">Centimetres</option><option value="in">Inches</option></select></label><label class="field"><span>Note</span><input name="sgNote" maxlength="400" value="${esc(g.note)}" placeholder="e.g. Oversized fit. Measurements are of the garment laid flat."></label></div>
      <div class="table-wrap"><table class="t vt"><thead><tr><th>Size</th><th>Chest</th><th>Length</th><th>Sleeve</th><th></th></tr></thead><tbody data-sg></tbody></table></div>
      <small class="muted">Until you add sizes, the size guide asks customers to confirm their size on WhatsApp. Measure your real garments before filling this in.</small></div>
    <div class="save-bar"><button class="btn btn--red" type="submit">Save</button></div>
  </form>`;
  const f = $('[data-f]', v); f.unit.value = g.unit;
  const sg = $('[data-sg]', v);
  const row = (r = {}) => `<tr><td><input class="input" data-k="size" value="${esc(r.size || '')}" maxlength="12"></td><td><input class="input" data-k="chest" value="${esc(r.chest || '')}" maxlength="12"></td><td><input class="input" data-k="length" value="${esc(r.length || '')}" maxlength="12"></td><td><input class="input" data-k="sleeve" value="${esc(r.sleeve || '')}" maxlength="12"></td><td><button type="button" class="btn btn--sm btn--ghost" data-rm aria-label="Remove">${I.x}</button></td></tr>`;
  sg.innerHTML = g.rows.map(row).join('');
  $('[data-add-row]', v).onclick = () => sg.insertAdjacentHTML('beforeend', row());
  sg.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) b.closest('tr').remove(); });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const rows = $$('tr', sg).map((tr) => Object.fromEntries($$('[data-k]', tr).map((i) => [i.dataset.k, i.value.trim()]))).filter((r) => r.size);
    saveSettings({
      shipping: { lagos: f.lagos.value, southWest: f.southWest.value, other: f.other.value, note: f.shipNote.value },
      payment: { instructions: f.payment.value }, policies: { returns: f.returns.value },
      sizeGuide: { unit: f.unit.value, note: f.sgNote.value, rows },
    }, $('[type="submit"]', f));
  });
}

async function viewSeo() {
  const v = V();
  const s = await loadSettings();
  v.innerHTML = header('SEO & store status', 'How the site appears in search, and whether it is open.') + settingsNote() + `
  <form novalidate data-f>
    <div class="grid grid--half">
      <div class="card"><div class="card__h"><h2>Search engines</h2></div>
        <label class="field"><span>Site title</span><input name="seoTitle" maxlength="70" value="${esc(s.seo.title)}"></label>
        <label class="field"><span>Site description</span><textarea name="seoDesc" maxlength="320" rows="4">${esc(s.seo.description)}</textarea></label>
        <small class="muted">Each product has its own meta title and description in its editor.</small></div>
      <div class="card"><div class="card__h"><h2>Store status</h2></div>
        <div class="switches">${sw('maint', s.maintenance.enabled, 'Close the store (maintenance mode)')}</div>
        <label class="field" style="margin-top:14px"><span>Message shown while closed</span><textarea name="maintMsg" maxlength="300" rows="3">${esc(s.maintenance.message)}</textarea></label>
        <small class="muted">While closed, visitors see this message and checkout is off. You stay able to browse the store while signed in here.</small>
        <div class="card__h" style="margin-top:18px"><h2>Low stock alert</h2></div>
        <label class="field"><span>Warn at or below</span><input name="low" inputmode="numeric" value="${s.inventory.lowStockThreshold}"></label></div>
    </div>
    <div class="save-bar"><button class="btn btn--red" type="submit">Save</button></div>
  </form>`;
  const f = $('[data-f]', v);
  charCount(f.seoTitle, 70); charCount(f.seoDesc, 320);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (f.maint.checked && !s.maintenance.enabled && !(await confirmDialog('Close the store?', 'Visitors will see the closed page until you switch it off.', { ok: 'Close the store' }))) return;
    saveSettings({ seo: { title: f.seoTitle.value, description: f.seoDesc.value }, maintenance: { enabled: f.maint.checked, message: f.maintMsg.value }, inventory: { lowStockThreshold: f.low.value } }, $('[type="submit"]', f));
  });
}

/* ------------------------------ activity + account ------------------------------ */
async function viewActivity() {
  const v = V();
  if (needsShopify()) { v.innerHTML = header('Activity log') + connectPanel(); return; }
  let after = null; let items = [];
  v.innerHTML = header('Activity log', 'Every change made from this admin, stored in Shopify.') + '<div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>When</th><th>Action</th><th>Detail</th><th class="hide-sm">IP</th></tr></thead><tbody data-rows></tbody></table></div><div class="pager" data-more></div></div>';
  const load = async () => {
    const r = await api(`/activity${after ? `?after=${encodeURIComponent(after)}` : ''}`);
    items = items.concat(r.items); after = r.pageInfo && r.pageInfo.hasNextPage ? r.pageInfo.endCursor : null;
    $('[data-rows]', v).innerHTML = items.length ? items.map((a) => `<tr><td>${dtt(a.at)}</td><td><b>${esc(a.action)}</b></td><td class="muted">${esc(a.detail)}</td><td class="hide-sm muted">${esc(a.ip)}</td></tr>`).join('') : '<tr class="empty-row"><td colspan="4">Nothing recorded yet.</td></tr>';
    $('[data-more]', v).innerHTML = after ? '<button class="btn" data-m>Older</button>' : '';
  };
  v.addEventListener('click', (e) => { if (e.target.closest('[data-m]')) load().catch(fail); });
  await load();
}

async function viewAccount() {
  const v = V();
  const st = await api('/status').catch(() => state.status);
  state.status = st;
  v.innerHTML = header('Account') + `
    <div class="grid grid--half">
      <div class="card"><div class="card__h"><h2>Admin password</h2></div>
        <p class="muted" style="margin-top:0">The password is the <code>ADMIN_PASSWORD</code> environment variable on Render. To change it: Render dashboard \u2192 this service \u2192 Environment \u2192 edit <code>ADMIN_PASSWORD</code> \u2192 Save. The service restarts and every open admin session is signed out.</p>
        <p class="muted">Sessions last 12 hours. Five wrong attempts lock sign-in for 15 minutes.</p>
        <button class="btn btn--danger" data-logout2>${I.out}Log out</button></div>
      <div class="card"><div class="card__h"><h2>Shopify connection</h2>${st.shopifyConfigured && !st.error ? chip('active', 'Connected') : chip('cancelled', st.shopifyConfigured ? 'Error' : 'Not connected')}</div>
        <dl class="kv"><dt>Store</dt><dd>${esc(st.shop ? st.shop.name : '\u2014')}</dd><dt>Domain</dt><dd>${esc(st.domain || '\u2014')}</dd><dt>Currency</dt><dd>${esc(st.shop ? st.shop.currencyCode : '\u2014')}</dd><dt>API version</dt><dd>${esc(st.apiVersion)}</dd><dt>Checkout</dt><dd>${st.checkoutMode === 'shopify' ? 'Shopify checkout' : 'Draft order + WhatsApp'}</dd><dt>Scopes</dt><dd class="muted" style="font-size:11px">${esc(st.scopes || '\u2014')}</dd></dl>
        ${st.error ? `<div class="note note--warn" style="margin-top:12px">${esc(st.error)}</div>` : ''}</div>
    </div>`;
  $('[data-logout2]', v).onclick = async () => { await api('/logout', { method: 'POST' }).catch(() => {}); renderLogin(); };
}

/* ------------------------------ boot ------------------------------ */
async function start() {
  try { state.status = await api('/status'); } catch (e) {
    if (e.status === 401) return;
    if (e.code === 'ADMIN_NOT_CONFIGURED') { app.innerHTML = `<div class="login"><div class="login__card"><img src="/img/eos-sigil.webp" alt="" width="22" height="55"><h1>ADMIN LOCKED</h1><p>Set <b>ADMIN_PASSWORD</b> and <b>SESSION_SECRET</b> (16+ characters) on the server, then restart.</p></div></div>`; return; }
    app.innerHTML = `<div class="login"><div class="login__card"><h1>UNREACHABLE</h1><p>${esc(e.message)}</p></div></div>`; return;
  }
  loadSettings().catch(() => {});
  renderShell();
  route();
}
window.addEventListener('hashchange', route);
(async () => {
  try {
    const s = await fetch('/api/admin/session', { headers: { Accept: 'application/json' } }).then((r) => r.json());
    if (!s.adminConfigured) { await start(); return; }
    if (s.authenticated) await start(); else renderLogin();
  } catch (_) { renderLogin('Could not reach the server.'); }
})();
