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

/** Drop (or unwrap) elements guarded by data-if="{{key}}" once the value is known.
 *  A small balanced-tag scan rather than one greedy regex, so nested elements of the
 *  same tag name cannot leave a stray closing tag behind. */
function conditionals(html, data) {
  const guard = /\sdata-if="\{\{\s*([\w.]+)\s*\}\}"/;
  for (let pass = 0; pass < 200; pass += 1) {
    const hit = guard.exec(html);
    if (!hit) break;
    const at = hit.index;
    const start = html.lastIndexOf('<', at);
    const openEnd = html.indexOf('>', at);
    const name = start >= 0 ? /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(start)) : null;
    if (!name || openEnd < 0) { html = html.slice(0, at) + html.slice(at + hit[0].length); continue; }
    const v = get(data, hit[1]);
    // Keep the element when the value is meaningful; drop it for undefined, null, '', false or 0.
    if (v) { html = html.slice(0, at) + html.slice(at + hit[0].length); continue; }
    const tag = name[1];
    if (html[openEnd - 1] === '/') { html = html.slice(0, start) + html.slice(openEnd + 1); continue; } // self-closing
    const re = new RegExp(`<${tag}(?=[\\s/>])|</${tag}\\s*>`, 'gi');
    re.lastIndex = openEnd + 1;
    let depth = 1; let end = -1; let m;
    while ((m = re.exec(html))) { // eslint-disable-line no-cond-assign
      if (m[0][1] === '/') { depth -= 1; if (!depth) { end = re.lastIndex; break; } } else depth += 1;
    }
    html = end === -1
      ? html.slice(0, start) + html.slice(openEnd + 1)          // unbalanced: drop just the open tag
      : html.slice(0, start) + html.slice(end);
  }
  return html;
}

/** {{a.b}} escaped, {{{a}}} raw, <!--#section x-->..<!--/section x--> removed when data.sections[x] is false. */
function fill(str, data) {
  return conditionals(str, data)
    .replace(/<!--#section (\w+)-->([\s\S]*?)<!--\/section \1-->/g, (m, name, body) => (data.sections && data.sections[name] === false ? '' : body))
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (m, k) => { const v = get(data, k); return v == null ? '' : String(v); })
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => esc(get(data, k) ?? ''));
}

const ngn = (n) => `\u20A6${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const shared = (() => {
  let c = null;
  return () => c || (c = {
    mandala: svg.mandala({ id: 'mp' }), mandalaSmall: svg.mandala({ size: 400, id: 'ms' }), horns: svg.horns(), sigilLine: svg.sigilLine(),
  });
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
    hero: s.hero, featured: s.featured,
    // Every page keeps the footer. Stored settings may still opt out explicitly.
    sections: { footer: true, ...s.sections },
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
