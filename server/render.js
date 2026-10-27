'use strict';
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const settings = require('./settings');
const svg = require('./views/svg');
const { esc } = require('./lib/html');
const { STATES } = require('./lib/nigeria');

const VIEWS = path.join(__dirname, 'views');
const VERSION = Date.now().toString(36);
const tplCache = new Map();
function tpl(file) {
  if (config.isProd && tplCache.has(file)) return tplCache.get(file);
  const s = fs.readFileSync(path.join(VIEWS, file), 'utf8');
  tplCache.set(file, s);
  return s;
}

const get = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
/** {{a.b}} escaped, {{{a}}} raw, <!--#section x-->..<!--/section x--> removed when data.sections[x] is false. */
function fill(str, data) {
  return str
    .replace(/<!--#section (\w+)-->([\s\S]*?)<!--\/section \1-->/g, (m, name, body) => (data.sections && data.sections[name] === false ? '' : body))
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (m, k) => { const v = get(data, k); return v == null ? '' : String(v); })
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => esc(get(data, k) ?? ''));
}

const LINES = ['Not for the weak', 'Not a brand, a curse', 'Some love is cursed', 'Kill or be killed', 'Join the cult', 'Not made to fit in', 'Being different is the point'];
const marqueeLine = () => {
  const one = LINES.map((l) => `<span>${esc(l)}</span><svg class="marquee__sep"><use href="#i-penta"/></svg>`).join('');
  return `<div class="marquee__group">${one}</div><div class="marquee__group">${one}</div>`;
};

const ngn = (n) => `\u20A6${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const shared = (() => {
  let c = null;
  return () => c || (c = { mandala: svg.mandala({ id: 'mp' }), mandalaSmall: svg.mandala({ size: 400, id: 'ms' }), horns: svg.horns(), sigilLine: svg.sigilLine(), marqueeLine: marqueeLine() });
})();

function baseUrl(req) {
  if (config.publicUrl) return config.publicUrl;
  const proto = req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : req.protocol;
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

/**
 * Render a page inside the layout.
 * opts: { title, description, data, status, ogImage, ogType, headExtra, robots, settings }
 */
async function render(req, res, page, opts = {}) {
  const s = opts.settings || (await settings.get());
  const base = baseUrl(req);
  const c = config.contact;
  const data = {
    ...shared(),
    ...c,
    hero: s.hero, featured: s.featured, sections: s.sections,
    year: new Date().getFullYear(),
    ...(opts.data || {}),
  };
  const content = fill(tpl(`pages/${page}.html`), data);
  const title = opts.title ? `${opts.title} | EOS` : s.seo.title;
  const announcement = s.announcement.enabled && s.announcement.text
    ? `<div class="announce" role="region" aria-label="Announcement">${s.announcement.link ? `<a href="${esc(s.announcement.link)}">` : '<div class="announce__in">'}<span>${esc(s.announcement.text)}</span>${s.announcement.link ? '</a>' : '</div>'}</div>`
    : '';
  const boot = {
    page, checkoutMode: config.checkoutMode, shopifyConfigured: config.shopify.configured,
    contact: c, states: STATES, settings: settings.publicView(s), ...(opts.boot || {}),
  };
  const html = fill(tpl('layout.html'), {
    ...data,
    page,
    title,
    description: opts.description || s.seo.description,
    canonical: base + (opts.canonicalPath || req.path),
    ogImage: opts.ogImage || `${base}/img/og.jpg`,
    ogType: opts.ogType || 'website',
    robots: opts.robots || 'index, follow',
    headExtra: opts.headExtra || '',
    announcement,
    content,
    v: VERSION,
    boot: JSON.stringify(boot).replace(/</g, '\\u003c'),
  });
  res.status(opts.status || 200);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(html);
}

module.exports = { render, fill, ngn, baseUrl, VERSION };
