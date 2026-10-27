'use strict';
const express = require('express');
const config = require('../config');
const settings = require('../settings');
const catalog = require('../shopify/catalog');
const orders = require('../shopify/orders');
const customers = require('../shopify/customers');
const storefront = require('../shopify/storefront');
const v = require('../lib/validate');
const { ah, AppError } = require('../lib/errors');
const rateLimit = require('../lib/rateLimit');
const { STATES } = require('../lib/nigeria');

const router = express.Router();
const formLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30 });
const checkoutLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 12, message: 'Too many orders from this device. Message us on WhatsApp.' });
const trackLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20 });

const publicCache = (res, seconds = 30) => res.setHeader('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=60`);
const listParam = (q) => v.list(q, 'filter', { max: 20 }).map((s) => s.slice(0, 60));

router.get('/config', ah(async (req, res) => {
  const s = await settings.get();
  res.setHeader('Cache-Control', 'no-cache');
  res.json({
    shopifyConfigured: config.shopify.configured,
    checkoutMode: config.checkoutMode,
    currency: 'NGN',
    contact: config.contact,
    states: STATES,
    settings: settings.publicView(s),
  });
}));

router.get('/products', ah(async (req, res) => {
  const q = req.query;
  const s = await settings.get();
  const params = {
    q: v.str(q.q, 'q', { max: 80 }),
    type: listParam(q.type), size: listParam(q.size), colour: listParam(q.colour),
    min: q.min ? v.money(q.min, 'min') : null, max: q.max ? v.money(q.max, 'max') : null,
    sort: v.oneOf(q.sort || 'featured', 'sort', ['featured', 'newest', 'price-asc', 'price-desc', 'title']),
    page: v.int(q.page, 'page', { min: 1, max: 1000 }) || 1,
    per: v.int(q.per, 'per', { min: 1, max: 48 }) || 12,
    collection: q.collection ? v.handle(q.collection, 'collection') : '',
    handles: q.handles ? v.list(q.handles, 'handles', { max: 24 }) : null,
    available: v.bool(q.available), sale: v.bool(q.sale),
  };
  const r = await catalog.query(params, s.featured.productHandles);
  publicCache(res);
  res.json({ ...r, items: r.items.map(catalog.card) });
}));

router.get('/products/:handle', ah(async (req, res) => {
  const handle = v.handle(req.params.handle);
  const p = await catalog.productByHandle(handle);
  if (!p) throw new AppError('NOT_FOUND', 'This piece does not exist, or no longer does.', 404);
  const all = await catalog.allProducts();
  publicCache(res);
  const { gid, ...pub } = p;
  res.json({ product: pub, related: catalog.related(all, p).map(catalog.card) });
}));

router.get('/collections', ah(async (req, res) => {
  const list = await catalog.allCollections();
  publicCache(res);
  res.json({ items: list.map(({ gid, ...c }) => c) });
}));

router.get('/collections/:handle', ah(async (req, res) => {
  const handle = v.handle(req.params.handle);
  const c = (await catalog.allCollections()).find((x) => x.handle === handle);
  if (!c) throw new AppError('NOT_FOUND', 'No such collection.', 404);
  const { gid, ...pub } = c;
  publicCache(res);
  res.json({ collection: pub });
}));

router.get('/search', ah(async (req, res) => {
  const q = v.str(req.query.q, 'q', { max: 80 });
  if (!q) return res.json({ items: [] });
  const r = await catalog.query({ q, per: 8, sort: 'featured' });
  publicCache(res, 20);
  res.json({ items: r.items.map(catalog.card), total: r.total });
}));

router.get('/lookbook', ah(async (req, res) => {
  const all = await catalog.allProducts();
  const frames = [];
  for (const p of all) p.images.forEach((img, i) => frames.push({ ...img, handle: p.handle, title: p.title, type: p.type, index: i }));
  publicCache(res, 60);
  res.json({ items: frames.slice(0, 60) });
}));

// Fresh price + stock for cart lines (drawer refresh).
router.post('/cart/validate', formLimiter, ah(async (req, res) => {
  const lines = Array.isArray(req.body.lines) ? req.body.lines.slice(0, 30) : [];
  const all = await catalog.allProducts();
  const out = lines.map((l) => {
    for (const p of all) {
      const vr = p.variants.find((x) => x.id === l.variantId);
      if (vr) return { variantId: vr.id, price: vr.price, available: vr.available || Boolean(p.drop && p.drop.preorder), stock: p.drop && p.drop.preorder ? null : vr.stock };
    }
    return { variantId: l.variantId, gone: true };
  });
  res.json({ lines: out });
}));

const discountParam = (x) => v.str(x, 'discount code', { max: 60, pattern: /^[A-Za-z0-9_\-]+$/ });

router.post('/checkout/quote', formLimiter, ah(async (req, res) => {
  const s = await settings.get();
  const b = req.body || {};
  const stateCode = b.stateCode ? v.oneOf(b.stateCode, 'state', STATES.map((x) => x.code)) : null;
  res.json(await orders.quote({ lines: b.lines, discountCode: discountParam(b.discountCode), stateCode }, s));
}));

router.post('/checkout', checkoutLimiter, ah(async (req, res) => {
  if (config.checkoutMode !== 'draft_order') throw new AppError('WRONG_MODE', 'Use Shopify checkout.', 400);
  const s = await settings.get();
  const b = req.body || {};
  if (b.website) throw new AppError('VALIDATION', 'Rejected.', 422); // honeypot
  const form = {
    fullName: v.str(b.fullName, 'full name', { required: true, min: 3, max: 80 }),
    phone: v.phoneNG(b.phone),
    email: v.email(b.email),
    stateCode: v.oneOf(b.stateCode, 'state', STATES.map((x) => x.code)),
    city: v.str(b.city, 'city', { required: true, max: 60 }),
    address: v.str(b.address, 'address', { required: true, min: 6, max: 200 }),
    note: v.str(b.note, 'note', { max: 500 }),
    discountCode: discountParam(b.discountCode),
    lines: b.lines,
  };
  const order = await orders.createDraftOrder(form, s);
  catalog.invalidate();
  res.status(201).json({ order });
}));

router.post('/checkout/shopify', checkoutLimiter, ah(async (req, res) => {
  if (config.checkoutMode !== 'shopify') throw new AppError('WRONG_MODE', 'Shopify checkout is not enabled.', 400);
  const lines = await orders.resolveLines((req.body || {}).lines);
  const url = await storefront.createCheckout(lines, discountParam((req.body || {}).discountCode));
  res.json({ checkoutUrl: url });
}));

router.post('/newsletter', formLimiter, ah(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true });
  const email = v.email(b.email);
  const r = await customers.subscribe(email, v.str(b.source, 'source', { max: 30 }) || 'site');
  res.json({ ok: true, already: r.already });
}));

router.post('/notify', formLimiter, ah(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true });
  const email = v.email(b.email);
  const handle = v.handle(b.handle);
  const variant = v.str(b.variant, 'variant', { max: 60 });
  await customers.notify(email, handle, variant);
  res.json({ ok: true });
}));

router.post('/orders/track', trackLimiter, ah(async (req, res) => {
  const b = req.body || {};
  const num = v.str(b.orderNumber, 'order number', { required: true, max: 20 });
  const phone = v.phoneNG(b.phone);
  res.json({ order: await orders.track(num, phone) });
}));

router.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown endpoint' } }));
module.exports = router;
