'use strict';
const express = require('express');
const multer = require('multer');
const config = require('../config');
const settings = require('../settings');
const catalog = require('../shopify/catalog');
const A = require('../shopify/admin');
const { STATUSES } = require('../shopify/orders');
const activity = require('../activity');
const session = require('../lib/session');
const rateLimit = require('../lib/rateLimit');
const v = require('../lib/validate');
const { ah, AppError, sendError } = require('../lib/errors');
const { scopes } = require('../shopify/client');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Too many sign-in attempts. Wait 15 minutes.' });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => cb(/^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype) ? null : new AppError('VALIDATION', 'Images only (JPG, PNG, WebP, GIF, AVIF).', 422), true),
});

router.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

/* ------------------------------ auth ------------------------------ */
router.post('/login', loginLimiter, (req, res) => {
  if (!config.admin.configured) return sendError(res, new AppError('ADMIN_NOT_CONFIGURED', 'Set ADMIN_PASSWORD and SESSION_SECRET on the server first.', 503));
  const pw = req.body && req.body.password;
  if (!session.checkPassword(pw)) return sendError(res, new AppError('BAD_PASSWORD', 'Wrong password.', 401));
  loginLimiter.reset(req);
  session.issue(res);
  activity.log(req, 'Signed in');
  res.json({ ok: true });
});
router.post('/logout', (req, res) => { session.clear(res); res.json({ ok: true }); });
router.get('/session', (req, res) => res.json({ authenticated: Boolean(session.read(req)), adminConfigured: config.admin.configured }));

router.use(session.requireAdmin);

const invalidate = () => catalog.invalidate();
const gidP = (type) => (req) => v.gid(req.params.id, type);

/* ------------------------------ status ------------------------------ */
router.get('/status', ah(async (req, res) => {
  const out = { shopifyConfigured: config.shopify.configured, domain: config.shopify.domain, apiVersion: config.shopify.apiVersion, checkoutMode: config.checkoutMode, scopes: '' };
  if (config.shopify.configured) {
    try {
      const { gql } = require('../shopify/client');
      const d = await gql('{ shop { name currencyCode myshopifyDomain plan { displayName } } }');
      out.shop = d.shop; out.scopes = scopes();
    } catch (e) { out.error = e.message; }
  }
  res.json(out);
}));

/* ------------------------------ overview ------------------------------ */
router.get('/overview', ah(async (req, res) => {
  const s = await settings.get();
  res.json(await A.overview(s.inventory.lowStockThreshold));
}));

/* ------------------------------ products ------------------------------ */
router.get('/products', ah(async (req, res) => {
  res.json(await A.listProducts({
    q: v.str(req.query.q, 'q', { max: 80 }),
    status: v.oneOf(req.query.status || '', 'status', ['', 'active', 'draft', 'archived']),
    after: v.str(req.query.after, 'cursor', { max: 300 }) || null,
  }));
}));
router.get('/products/:id', ah(async (req, res) => res.json({ product: await A.getProduct(gidP('Product')(req)) })));

function productInput(b, { partial = false } = {}) {
  const out = {};
  if (!partial || b.title !== undefined) out.title = v.str(b.title, 'title', { required: true, max: 255 });
  if (!partial || b.descriptionHtml !== undefined) out.descriptionHtml = v.text(b.descriptionHtml, 'description', { max: 20000 });
  if (!partial || b.type !== undefined) out.type = v.str(b.type, 'type', { max: 80 });
  if (!partial || b.tags !== undefined) out.tags = v.list(b.tags, 'tags', { max: 60 }).map((t) => t.slice(0, 40));
  if (!partial || b.status !== undefined) out.status = v.oneOf(String(b.status || 'DRAFT').toUpperCase(), 'status', ['ACTIVE', 'DRAFT', 'ARCHIVED']);
  if (b.handle) out.handle = v.handle(b.handle);
  if (!partial || b.seo !== undefined) out.seo = { title: v.str(b.seo && b.seo.title, 'meta title', { max: 70 }), description: v.str(b.seo && b.seo.description, 'meta description', { max: 320 }) };
  if (!partial || b.collectionIds !== undefined) out.collectionIds = v.list(b.collectionIds, 'collections', { max: 30 }).map((x) => v.gid(x, 'Collection'));
  if (!partial || b.drop !== undefined) out.drop = { preorder: v.bool(b.drop && b.drop.preorder), dropAt: v.date(b.drop && b.drop.dropAt, 'drop date'), note: v.str(b.drop && b.drop.note, 'drop note', { max: 200 }) };
  return out;
}
function optionsInput(list) {
  const opts = (Array.isArray(list) ? list : []).slice(0, 3).map((o) => ({
    name: v.str(o.name, 'option name', { required: true, max: 30 }),
    values: [...new Set(v.list(o.values, 'option values', { max: 30 }).map((x) => x.slice(0, 40)))],
  })).filter((o) => o.values.length);
  if (new Set(opts.map((o) => o.name.toLowerCase())).size !== opts.length) throw new AppError('VALIDATION', 'Option names must be different.', 422);
  return opts;
}
function variantRows(list) {
  return (Array.isArray(list) ? list : []).slice(0, 100).map((r) => ({
    options: Object.fromEntries(Object.entries(r.options || {}).map(([k, val]) => [String(k).slice(0, 30), String(val).slice(0, 40)])),
    price: v.money(r.price, 'price'),
    compareAt: r.compareAt === undefined ? undefined : v.money(r.compareAt, 'compare-at price'),
    quantity: v.int(r.quantity, 'stock', { min: 0, max: 1000000 }),
    sku: r.sku === undefined ? undefined : v.str(r.sku, 'SKU', { max: 60 }),
    continueSelling: v.bool(r.continueSelling),
  }));
}

router.post('/products', ah(async (req, res) => {
  const b = req.body || {};
  const data = { ...productInput(b), options: optionsInput(b.options), variants: variantRows(b.variants), price: v.money(b.price, 'price'), compareAt: v.money(b.compareAt, 'compare-at price') };
  const id = await A.createProduct(data);
  invalidate(); activity.log(req, 'Created product', `${data.title} (${data.status})`);
  res.status(201).json({ id });
}));
router.patch('/products/:id', ah(async (req, res) => {
  const id = gidP('Product')(req);
  const data = productInput(req.body || {}, { partial: true });
  await A.updateProduct(id, data);
  invalidate(); activity.log(req, 'Edited product', `${data.title || id}: ${Object.keys(data).join(', ')}`);
  res.json({ product: await A.getProduct(id) });
}));
router.put('/products/:id/variants', ah(async (req, res) => {
  const id = gidP('Product')(req);
  await A.saveVariants(id, optionsInput(req.body.options), variantRows(req.body.variants));
  invalidate(); activity.log(req, 'Saved variants', id);
  res.json({ product: await A.getProduct(id) });
}));
router.patch('/products/:id/prices', ah(async (req, res) => {
  const id = gidP('Product')(req);
  const list = (Array.isArray(req.body.variants) ? req.body.variants : []).slice(0, 100).map((x) => ({
    id: v.gid(x.id, 'ProductVariant'),
    ...(x.price !== undefined ? { price: v.money(x.price, 'price', { required: true }) } : {}),
    ...(x.compareAt !== undefined ? { compareAt: v.money(x.compareAt, 'compare-at price') } : {}),
  }));
  if (list.some((x) => x.price !== undefined && x.price <= 0)) throw new AppError('VALIDATION', 'Price must be above zero.', 422);
  await A.updatePrices(id, list);
  invalidate(); activity.log(req, 'Changed prices', `${id}: ${list.length} variant(s)`);
  res.json({ ok: true });
}));
router.post('/products/bulk-price', ah(async (req, res) => {
  const b = req.body || {};
  const mode = v.oneOf(b.mode, 'mode', ['percent', 'fixed', 'sale', 'endsale']);
  const value = mode === 'endsale' ? 0 : Number(b.value);
  if (!Number.isFinite(value) || (mode === 'sale' && (value <= 0 || value >= 100)) || Math.abs(value) > 1e7) throw new AppError('VALIDATION', 'Enter a valid amount.', 422);
  const productIds = v.list(b.productIds, 'products', { max: 100 }).map((x) => v.gid(x, 'Product'));
  if (!productIds.length) throw new AppError('VALIDATION', 'Select at least one product.', 422);
  const round = v.int(b.round, 'rounding', { min: 0, max: 10000 }) || 0;
  const results = await A.bulkPrice({ productIds, mode, value, round });
  invalidate(); activity.log(req, 'Bulk price change', `${mode} ${value} on ${productIds.length} product(s)`);
  res.json({ results });
}));
router.post('/products/:id/duplicate', ah(async (req, res) => {
  const id = gidP('Product')(req);
  const p = await A.getProduct(id);
  const newId = await A.duplicateProduct(id, v.str(req.body.title, 'title', { max: 255 }) || `${p.title} (copy)`);
  invalidate(); activity.log(req, 'Duplicated product', p.title);
  res.status(201).json({ id: newId });
}));
router.delete('/products/:id', ah(async (req, res) => {
  const id = gidP('Product')(req);
  const p = await A.getProduct(id);
  await A.deleteProduct(id);
  invalidate(); activity.log(req, 'Deleted product', p.title);
  res.json({ ok: true });
}));

/* ------------------------------ media ------------------------------ */
router.post('/products/:id/images', (req, res, next) => upload.array('images', 10)(req, res, (err) => (err ? sendError(res, err.code === 'LIMIT_FILE_SIZE' ? new AppError('VALIDATION', 'Each image must be under 20 MB.', 422) : err) : next())),
  ah(async (req, res) => {
    const id = gidP('Product')(req);
    if (!req.files || !req.files.length) throw new AppError('VALIDATION', 'Choose at least one image.', 422);
    const alt = v.str(req.body.alt, 'alt', { max: 200 });
    req.files.forEach((f) => { f.alt = alt; });
    const n = await A.uploadImages(id, req.files);
    invalidate(); activity.log(req, 'Uploaded images', `${n} image(s) to ${id}`);
    res.status(201).json({ uploaded: n, product: await A.getProduct(id) });
  }));
router.delete('/products/:id/images/:mediaId', ah(async (req, res) => {
  const id = gidP('Product')(req);
  const mid = v.gid(req.params.mediaId, 'MediaImage', 'media id');
  await A.deleteMedia(id, [mid]);
  invalidate(); activity.log(req, 'Deleted image', id);
  res.json({ ok: true });
}));
router.put('/products/:id/images/order', ah(async (req, res) => {
  const id = gidP('Product')(req);
  const ids = v.list(req.body.mediaIds, 'media', { max: 50 }).map((x) => v.gid(x, 'MediaImage', 'media id'));
  await A.reorderMedia(id, ids);
  invalidate(); activity.log(req, 'Reordered images', id);
  res.json({ ok: true });
}));
router.patch('/products/:id/images/:mediaId', ah(async (req, res) => {
  await A.updateMediaAlt(gidP('Product')(req), v.gid(req.params.mediaId, 'MediaImage', 'media id'), v.str(req.body.alt, 'alt', { max: 200 }));
  invalidate(); res.json({ ok: true });
}));

/* ------------------------------ inventory ------------------------------ */
router.get('/inventory', ah(async (req, res) => {
  const s = await settings.get();
  res.json({ items: await A.inventoryList(), threshold: s.inventory.lowStockThreshold });
}));
router.post('/inventory', ah(async (req, res) => {
  const items = (Array.isArray(req.body.items) ? req.body.items : []).slice(0, 250).map((x) => ({
    inventoryItemId: v.gid(x.inventoryItemId, 'InventoryItem'), quantity: v.int(x.quantity, 'stock', { min: 0, max: 1000000, required: true }),
  }));
  await A.setStock(items);
  invalidate(); activity.log(req, 'Adjusted stock', `${items.length} item(s)`);
  res.json({ ok: true });
}));

/* ------------------------------ collections ------------------------------ */
router.get('/collections', ah(async (req, res) => res.json({ items: await A.listCollections() })));
router.get('/collections/:id', ah(async (req, res) => res.json({ collection: await A.getCollection(gidP('Collection')(req)) })));
const collectionInput = (b) => ({
  title: v.str(b.title, 'title', { required: true, max: 255 }),
  descriptionHtml: v.text(b.descriptionHtml, 'description', { max: 10000 }),
  handle: b.handle ? v.handle(b.handle) : undefined,
  seo: b.seo ? { title: v.str(b.seo.title, 'meta title', { max: 70 }), description: v.str(b.seo.description, 'meta description', { max: 320 }) } : undefined,
  productIds: v.list(b.productIds, 'products', { max: 250 }).map((x) => v.gid(x, 'Product')),
});
router.post('/collections', ah(async (req, res) => {
  const data = collectionInput(req.body || {});
  const id = await A.saveCollection(null, data);
  invalidate(); activity.log(req, 'Created collection', data.title);
  res.status(201).json({ id });
}));
router.patch('/collections/:id', ah(async (req, res) => {
  const id = gidP('Collection')(req);
  const data = collectionInput(req.body || {});
  await A.saveCollection(id, data);
  if (req.body.add || req.body.remove) {
    await A.setCollectionProducts(id, v.list(req.body.add, 'add', { max: 250 }).map((x) => v.gid(x, 'Product')), v.list(req.body.remove, 'remove', { max: 250 }).map((x) => v.gid(x, 'Product')));
  }
  invalidate(); activity.log(req, 'Edited collection', data.title);
  res.json({ collection: await A.getCollection(id) });
}));
router.delete('/collections/:id', ah(async (req, res) => {
  await A.deleteCollection(gidP('Collection')(req));
  invalidate(); activity.log(req, 'Deleted collection', req.params.id);
  res.json({ ok: true });
}));

/* ------------------------------ discounts ------------------------------ */
router.get('/discounts', ah(async (req, res) => res.json({ items: await A.listDiscounts() })));
router.post('/discounts', ah(async (req, res) => {
  const b = req.body || {};
  const automatic = v.bool(b.automatic);
  const kind = v.oneOf(b.kind, 'type', ['percent', 'fixed', 'shipping']);
  const data = {
    automatic, kind,
    title: v.str(b.title, 'title', { required: true, max: 120 }),
    code: automatic ? null : v.str(b.code, 'code', { required: true, max: 40, pattern: /^[A-Za-z0-9_\-]+$/ }).toUpperCase(),
    value: kind === 'shipping' ? 0 : v.money(b.value, 'value', { required: true }),
    minSubtotal: v.money(b.minSubtotal, 'minimum order'),
    usageLimit: v.int(b.usageLimit, 'usage limit', { min: 1, max: 1000000 }),
    oncePerCustomer: v.bool(b.oncePerCustomer),
    startsAt: v.date(b.startsAt, 'start date'),
    endsAt: v.date(b.endsAt, 'end date'),
  };
  if (kind === 'percent' && (data.value <= 0 || data.value > 100)) throw new AppError('VALIDATION', 'Percent must be between 1 and 100.', 422);
  if (kind === 'fixed' && data.value <= 0) throw new AppError('VALIDATION', 'Amount must be above zero.', 422);
  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) throw new AppError('VALIDATION', 'End date must be after the start date.', 422);
  const id = await A.createDiscount(data);
  activity.log(req, automatic ? 'Created automatic promo' : 'Created discount code', `${data.title}${data.code ? ` (${data.code})` : ''}`);
  res.status(201).json({ id });
}));
router.post('/discounts/:id/:action(activate|deactivate)', ah(async (req, res) => {
  const id = v.str(req.params.id, 'id', { max: 120, pattern: /^\d+$/ });
  const automatic = v.bool(req.query.automatic);
  const gid = `gid://shopify/Discount${automatic ? 'Automatic' : 'Code'}Node/${id}`;
  await A.toggleDiscount(gid, automatic, req.params.action === 'activate');
  activity.log(req, `Discount ${req.params.action}d`, gid);
  res.json({ ok: true });
}));
router.delete('/discounts/:id', ah(async (req, res) => {
  const id = v.str(req.params.id, 'id', { max: 120, pattern: /^\d+$/ });
  const automatic = v.bool(req.query.automatic);
  await A.deleteDiscount(`gid://shopify/Discount${automatic ? 'Automatic' : 'Code'}Node/${id}`, automatic);
  activity.log(req, 'Deleted discount', id);
  res.json({ ok: true });
}));

/* ------------------------------ orders ------------------------------ */
const orderId = (raw) => {
  const s = v.str(raw, 'id', { required: true, max: 120 });
  if (!/^gid:\/\/shopify\/(DraftOrder|Order)\/\d+$/.test(s)) throw new AppError('VALIDATION', 'Invalid order id', 422);
  return s;
};
router.get('/orders', ah(async (req, res) => {
  res.json({ items: await A.listOrders({ status: v.oneOf(req.query.status || '', 'status', ['', ...STATUSES]), q: v.str(req.query.q, 'q', { max: 80 }) }) });
}));
router.get('/orders/export.csv', ah(async (req, res) => {
  const list = await A.listOrders({ limit: 500 });
  const rows = [['Order', 'Kind', 'Date', 'Status', 'Customer', 'Email', 'Phone', 'Address', 'City', 'State', 'Items', 'Subtotal (NGN)', 'Discount (NGN)', 'Delivery (NGN)', 'Total (NGN)', 'Discount codes', 'Note']];
  list.forEach((o) => rows.push([o.name, o.kind, o.createdAt, o.status, o.customer, o.email, o.phone,
    o.address ? [o.address.address1, o.address.address2].filter(Boolean).join(', ') : '', o.address ? o.address.city : '', o.address ? o.address.province : '',
    o.items.map((i) => `${i.quantity} x ${i.title}${i.variant ? ` (${i.variant})` : ''}`).join('; '), o.subtotal, o.discount, o.shipping, o.total, o.discountCodes.join(' '), (o.note || '').replace(/\n/g, ' ')]));
  activity.log(req, 'Exported orders CSV', `${list.length} rows`);
  sendCsv(res, `eos-orders-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}));
router.get('/orders/:id', ah(async (req, res) => res.json({ order: await A.getOrder(orderId(decodeURIComponent(req.params.id))) })));
router.post('/orders/:id/status', ah(async (req, res) => {
  const id = orderId(decodeURIComponent(req.params.id));
  const status = v.oneOf(req.body.status, 'status', STATUSES);
  const order = await A.setOrderStatus(id, status);
  activity.log(req, 'Order status', `${order.name} -> ${status}`);
  res.json({ order });
}));
router.post('/orders/:id/paid', ah(async (req, res) => {
  const id = orderId(decodeURIComponent(req.params.id));
  const order = await A.markPaid(id);
  invalidate(); activity.log(req, 'Marked paid', order.name);
  res.json({ order });
}));
router.patch('/orders/:id/note', ah(async (req, res) => {
  const id = orderId(decodeURIComponent(req.params.id));
  await A.updateOrderNote(id, v.text(req.body.note, 'note', { max: 5000 }));
  activity.log(req, 'Order note', id);
  res.json({ order: await A.getOrder(id) });
}));

/* ------------------------------ customers ------------------------------ */
router.get('/customers', ah(async (req, res) => {
  res.json({ items: await A.listCustomers({ q: v.str(req.query.q, 'q', { max: 80 }), subscribers: v.bool(req.query.subscribers) }) });
}));
router.get('/customers/export.csv', ah(async (req, res) => {
  const subscribers = v.bool(req.query.subscribers);
  const list = await A.listCustomers({ subscribers, max: 2500 });
  const rows = [['Name', 'Email', 'Phone', 'Subscribed', 'Orders', 'Spent (NGN)', 'City', 'Tags', 'Created']];
  list.forEach((c) => rows.push([c.name, c.email, c.phone, c.subscribed ? 'yes' : 'no', c.orders, c.spent, c.city, c.tags.join(' '), c.createdAt]));
  activity.log(req, 'Exported customers CSV', `${list.length} rows${subscribers ? ' (subscribers)' : ''}`);
  sendCsv(res, `eos-${subscribers ? 'subscribers' : 'customers'}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}));

function sendCsv(res, name, rows) {
  const cell = (x) => {
    let s = String(x ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send('\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n'));
}

/* ------------------------------ settings ------------------------------ */
router.get('/settings', ah(async (req, res) => res.json({ settings: await settings.get() })));
router.patch('/settings', ah(async (req, res) => {
  const patch = req.body && req.body.settings;
  if (!patch || typeof patch !== 'object') throw new AppError('VALIDATION', 'Nothing to save.', 422);
  const saved = await settings.save(patch);
  activity.log(req, 'Updated site settings', Object.keys(patch).join(', '));
  res.json({ settings: saved });
}));

/* ------------------------------ activity ------------------------------ */
router.get('/activity', ah(async (req, res) => res.json(await activity.list(v.str(req.query.after, 'cursor', { max: 300 }) || null))));

router.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown admin endpoint' } }));
module.exports = router;
