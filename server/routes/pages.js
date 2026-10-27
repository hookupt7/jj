'use strict';
const express = require('express');
const config = require('../config');
const settings = require('../settings');
const catalog = require('../shopify/catalog');
const { render, ngn, baseUrl } = require('../render');
const { esc } = require('../lib/html');
const { ZONE_LABELS } = require('../lib/nigeria');

const router = express.Router();
const safe = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const tryShopify = async (fn) => { try { return await fn(); } catch (_) { return null; } };

const titleLines = (t) => {
  const words = String(t).trim().split(/\s+/);
  const lines = words.length >= 3 ? [words[0], words.slice(1).join(' ')] : words;
  return lines.map((l, i) => `<span class="hero__line hero__line--${i + 1}" aria-hidden="true"><span data-scramble>${esc(l)}</span></span>`).join('');
};

router.get('/', safe(async (req, res) => {
  const s = await settings.get();
  await render(req, res, 'home', { settings: s, data: { heroTitleLines: titleLines(s.hero.title) } });
}));

router.get('/shop', safe(async (req, res) => {
  await render(req, res, 'shop', { title: 'Shop', description: 'Shop EOS streetwear. Tees and pieces for the ones who were never interested in being understood. Delivery anywhere in Nigeria.', data: { heading: 'The shop', kicker: 'Shop', collectionHandle: '', collectionIntro: '' } });
}));

router.get('/collections', safe(async (req, res) => render(req, res, 'collections', { title: 'Collections' })));

router.get('/collections/:handle', safe(async (req, res, next) => {
  const handle = String(req.params.handle).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(handle)) return next();
  const c = config.shopify.configured ? await tryShopify(async () => (await catalog.allCollections()).find((x) => x.handle === handle)) : null;
  if (config.shopify.configured && !c) return next(); // unknown collection -> 404 page
  const title = c ? c.title : handle.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  await render(req, res, 'shop', {
    title: (c && c.seo && c.seo.title) || title,
    description: (c && ((c.seo && c.seo.description) || c.excerpt)) || undefined,
    ogImage: c && c.image ? c.image.src : undefined,
    data: { heading: title, kicker: 'Collection', collectionHandle: handle, collectionIntro: c && c.excerpt ? `<p class="page-hero__lede">${esc(c.excerpt)}</p>` : '' },
  });
}));

router.get('/product/:handle', safe(async (req, res, next) => {
  const handle = String(req.params.handle).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(handle)) return next();
  const p = config.shopify.configured ? await tryShopify(() => catalog.productByHandle(handle)) : null;
  let headExtra = '';
  if (p) {
    const base = baseUrl(req);
    const ld = {
      '@context': 'https://schema.org', '@type': 'Product', name: p.title, description: p.excerpt, image: p.images.map((i) => i.src), sku: p.id,
      brand: { '@type': 'Brand', name: 'EOS' },
      offers: { '@type': 'AggregateOffer', priceCurrency: 'NGN', lowPrice: p.price, highPrice: p.maxPrice, availability: p.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: `${base}/product/${p.handle}` },
    };
    headExtra = `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
    if (p.images[0]) {
      const src = p.images[0].src; const u = (w) => `${src}${src.includes('?') ? '&' : '?'}width=${w}`;
      // Must match the gallery's first <img> exactly so the browser reuses the preload.
      headExtra += `<link rel="preload" as="image" href="${esc(u(1200))}" imagesrcset="${esc([540, 720, 960, 1280, 1600].map((w) => `${u(w)} ${w}w`).join(', '))}" imagesizes="(min-width:1000px) 55vw, 100vw" fetchpriority="high">`;
    }
  }
  await render(req, res, 'product', {
    title: p ? (p.seo.title || p.title) : 'Product',
    description: p ? (p.seo.description || p.excerpt || undefined) : undefined,
    ogImage: p && p.images[0] ? p.images[0].src : undefined,
    ogType: p ? 'product' : 'website',
    status: config.shopify.configured && !p ? 404 : 200,
    robots: p ? 'index, follow' : 'noindex',
    headExtra,
    data: { handle, productTitle: p ? p.title : '' },
  });
}));

router.get('/lookbook', safe(async (req, res) => render(req, res, 'lookbook', { title: 'Lookbook' })));
router.get('/about', safe(async (req, res) => render(req, res, 'about', { title: 'About', description: 'EOS (Enemy of Swag): streetwear from Nigeria. Not a brand, a curse.' })));
router.get('/contact', safe(async (req, res) => render(req, res, 'contact', { title: 'Contact', description: 'Reach EOS on WhatsApp, phone, email or TikTok.' })));

function shippingSummary(s) {
  const set = Object.entries(ZONE_LABELS).filter(([k]) => s.shipping[k] !== null && s.shipping[k] !== undefined);
  if (!set.length) return 'The delivery fee for your address is confirmed on WhatsApp.';
  return set.map(([k, l]) => `${l}: ${ngn(s.shipping[k])}`).join('. ') + '.' + (set.length < 3 ? ' Other zones are confirmed on WhatsApp.' : '');
}
router.get('/faq', safe(async (req, res) => {
  const s = await settings.get();
  await render(req, res, 'faq', { settings: s, title: 'FAQ', data: { payment: s.payment.instructions, returns: s.policies.returns, shippingSummary: shippingSummary(s) } });
}));
router.get('/shipping-returns', safe(async (req, res) => {
  const s = await settings.get();
  const feeRows = Object.entries(ZONE_LABELS).map(([k, l]) => `<tr><td>${esc(l)}</td><td>${s.shipping[k] === null || s.shipping[k] === undefined ? 'Delivery fee confirmed on WhatsApp' : esc(ngn(s.shipping[k]))}</td></tr>`).join('');
  const returnsHtml = s.policies.returns.split(/\n{2,}|\r\n\r\n/).map((p) => `<p>${esc(p)}</p>`).join('');
  await render(req, res, 'shipping-returns', { settings: s, title: 'Shipping & returns', data: { feeRows, returnsHtml, payment: s.payment.instructions, shippingNote: s.shipping.note } });
}));
router.get('/privacy', safe(async (req, res) => render(req, res, 'privacy', { title: 'Privacy' })));
router.get('/terms', safe(async (req, res) => render(req, res, 'terms', { title: 'Terms' })));
router.get('/checkout', safe(async (req, res) => render(req, res, 'checkout', { title: 'Checkout', robots: 'noindex' })));
router.get('/order/success', safe(async (req, res) => render(req, res, 'success', { title: 'Order placed', robots: 'noindex' })));
router.get('/track', safe(async (req, res) => render(req, res, 'track', { title: 'Track your order' })));
router.get('/wishlist', safe(async (req, res) => render(req, res, 'wishlist', { title: 'Wishlist', robots: 'noindex' })));

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /checkout\nDisallow: /order/\nSitemap: ${baseUrl(req)}/sitemap.xml\n`);
});
router.get('/sitemap.xml', safe(async (req, res) => {
  const base = baseUrl(req);
  const urls = ['/', '/shop', '/collections', '/lookbook', '/about', '/contact', '/faq', '/shipping-returns', '/track', '/privacy', '/terms'];
  if (config.shopify.configured) {
    const [ps, cs] = await Promise.all([tryShopify(() => catalog.allProducts()), tryShopify(() => catalog.allCollections())]);
    (ps || []).forEach((p) => urls.push(`/product/${p.handle}`));
    (cs || []).forEach((c) => urls.push(`/collections/${c.handle}`));
  }
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${esc(base + u)}</loc></url>`).join('')}</urlset>`);
}));
router.get('/site.webmanifest', (req, res) => {
  res.type('application/manifest+json').send(JSON.stringify({
    name: 'EOS, Enemy of Swag', short_name: 'EOS', start_url: '/', display: 'standalone', background_color: '#050505', theme_color: '#050505',
    icons: [{ src: '/img/eos-logo-512.png', sizes: '512x512', type: 'image/png' }, { src: '/img/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  }));
});

module.exports = router;
