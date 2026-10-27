'use strict';
// Admin operations. All reads/writes go to Shopify; nothing is stored locally.
const { gql, checkUserErrors, paginate, numericId } = require('./client');
const { AppError } = require('../lib/errors');
const { STATUSES, statusFromTags, amount } = require('./orders');

/* ----------------------------- locations ----------------------------- */
let locationCache = null;
async function primaryLocation() {
  if (locationCache) return locationCache;
  const d = await gql(`{ locations(first: 10, query: "active:true") { nodes { id name isActive fulfillsOnlineOrders } } }`);
  const list = d.locations.nodes;
  const loc = list.find((l) => l.fulfillsOnlineOrders) || list[0];
  if (!loc) throw new AppError('NO_LOCATION', 'Your Shopify store has no active location for stock.', 422);
  locationCache = loc;
  return loc;
}

/* ----------------------------- overview ----------------------------- */
async function overview(lowStockThreshold = 3) {
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const counts = await gql(`{ productsCount { count } customersCount { count } ordersCount { count }
    activeProducts: productsCount(query: "status:active") { count } }`);
  const orders = await paginate(async (after) => (await gql(`query($a:String,$q:String){ orders(first: 100, after: $a, query: $q, sortKey: CREATED_AT, reverse: true) {
      nodes { id name createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus tags totalPriceSet { shopMoney { amount } } customer { displayName } }
      pageInfo { hasNextPage endCursor } } }`, { a: after, q: `created_at:>=${since}` })).orders, { maxPages: 6 });
  const drafts = (await gql(`{ draftOrders(first: 100, query: "status:open OR status:invoice_sent", sortKey: UPDATED_AT, reverse: true) {
      nodes { id name createdAt tags status totalPriceSet { shopMoney { amount } } customer { displayName } } } }`)).draftOrders.nodes;

  // Daily series for the last 30 days (WAT), from real orders only.
  const dayKey = (iso) => new Date(new Date(iso).getTime() + 3600e3).toISOString().slice(0, 10);
  const series = [];
  for (let i = 29; i >= 0; i--) series.push({ date: dayKey(new Date(Date.now() - i * 864e5).toISOString()), revenue: 0, orders: 0 });
  const idx = new Map(series.map((s, i) => [s.date, i]));
  let revenue30 = 0; let orders30 = 0;
  const cutoff = Date.now() - 30 * 864e5;
  for (const o of orders) {
    if (o.cancelledAt) continue;
    const t = new Date(o.createdAt).getTime();
    if (t >= cutoff) { revenue30 += amount(o.totalPriceSet); orders30 += 1; }
    const i = idx.get(dayKey(o.createdAt));
    if (i !== undefined) { series[i].revenue += amount(o.totalPriceSet); series[i].orders += 1; }
  }
  const low = await lowStock(lowStockThreshold);
  const recent = [
    ...orders.slice(0, 8).map((o) => ({ kind: 'order', id: o.id, name: o.name, createdAt: o.createdAt, customer: o.customer && o.customer.displayName, total: amount(o.totalPriceSet), status: statusFromTags(o.tags) || deriveOrderStatus(o) })),
    ...drafts.slice(0, 8).map((o) => ({ kind: 'draft', id: o.id, name: o.name, createdAt: o.createdAt, customer: o.customer && o.customer.displayName, total: amount(o.totalPriceSet), status: statusFromTags(o.tags) || 'pending' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
  return {
    counts: {
      products: counts.productsCount.count, activeProducts: counts.activeProducts.count,
      customers: counts.customersCount.count, orders: counts.ordersCount.count,
      pendingDrafts: drafts.length, pendingValue: drafts.reduce((s, d) => s + amount(d.totalPriceSet), 0),
      revenue30, orders30, lowStock: low.length,
    },
    series, lowStock: low.slice(0, 10), recent,
  };
}
function deriveOrderStatus(o) {
  if (o.cancelledAt) return 'cancelled';
  if (o.displayFulfillmentStatus === 'FULFILLED') return 'shipped';
  if (o.displayFinancialStatus === 'PAID') return 'confirmed';
  return 'pending';
}

async function lowStock(threshold) {
  const nodes = await paginate(async (after) => (await gql(`query($a:String,$q:String){ productVariants(first: 100, after: $a, query: $q) {
      nodes { id title inventoryQuantity inventoryItem { tracked } product { id title handle status } }
      pageInfo { hasNextPage endCursor } } }`, { a: after, q: `inventory_quantity:<=${Number(threshold)}` })).productVariants, { maxPages: 5 });
  return nodes.filter((n) => n.inventoryItem && n.inventoryItem.tracked && n.product.status !== 'ARCHIVED')
    .map((n) => ({ variantId: n.id, variant: n.title === 'Default Title' ? '' : n.title, quantity: n.inventoryQuantity, productId: n.product.id, product: n.product.title, status: n.product.status }))
    .sort((a, b) => a.quantity - b.quantity);
}

/* ----------------------------- products ----------------------------- */
async function listProducts({ q = '', status = '', after = null, first = 50 } = {}) {
  const parts = [];
  if (q) parts.push(`(title:*${q.replace(/[^\w\s-]/g, '')}* OR tag:${q.replace(/[^\w-]/g, '')} OR product_type:${q.replace(/[^\w-]/g, '')})`);
  if (status) parts.push(`status:${status.toLowerCase()}`);
  const d = await gql(`query($a:String,$q:String,$n:Int!){ products(first: $n, after: $a, query: $q, sortKey: UPDATED_AT, reverse: true) {
    nodes { id title handle status productType tags totalInventory tracksInventory updatedAt
      featuredMedia { preview { image { url } } }
      priceRangeV2 { minVariantPrice { amount } maxVariantPrice { amount } }
      compareAtPriceRange { maxVariantCompareAtPrice { amount } }
      variantsCount { count }
      variants(first: 30) { nodes { id title price compareAtPrice inventoryQuantity } }
    } pageInfo { hasNextPage endCursor } } }`, { a: after, q: parts.join(' AND ') || null, n: first });
  return {
    items: d.products.nodes.map((p) => ({
      id: p.id, title: p.title, handle: p.handle, status: p.status, type: p.productType, tags: p.tags,
      inventory: p.tracksInventory ? p.totalInventory : null, updatedAt: p.updatedAt,
      image: p.featuredMedia && p.featuredMedia.preview && p.featuredMedia.preview.image ? p.featuredMedia.preview.image.url : null,
      minPrice: Number(p.priceRangeV2.minVariantPrice.amount), maxPrice: Number(p.priceRangeV2.maxVariantPrice.amount),
      compareAt: p.compareAtPriceRange && p.compareAtPriceRange.maxVariantCompareAtPrice ? Number(p.compareAtPriceRange.maxVariantCompareAtPrice.amount) || null : null,
      variantsCount: p.variantsCount.count,
      variants: p.variants.nodes.map((vr) => ({ id: vr.id, title: vr.title, price: Number(vr.price), compareAt: vr.compareAtPrice ? Number(vr.compareAtPrice) : null, quantity: vr.inventoryQuantity })),
    })),
    pageInfo: d.products.pageInfo,
  };
}

const PRODUCT_ADMIN_FIELDS = `id title handle status descriptionHtml productType tags vendor createdAt updatedAt onlineStorePreviewUrl
  seo { title description }
  options { id name position optionValues { id name } }
  media(first: 30) { nodes { id alt mediaContentType status ... on MediaImage { image { url width height } } preview { image { url } } } }
  variants(first: 100) { nodes { id title sku price compareAtPrice inventoryQuantity inventoryPolicy
    selectedOptions { name value }
    inventoryItem { id tracked inventoryLevels(first: 5) { nodes { location { id name } quantities(names: ["available"]) { name quantity } } } } } }
  collections(first: 20) { nodes { id title handle } }
  drop: metafield(namespace: "eos", key: "drop") { value }`;

async function getProduct(id) {
  const d = await gql(`query($id:ID!){ product(id:$id){ ${PRODUCT_ADMIN_FIELDS} } }`, { id });
  if (!d.product) throw new AppError('NOT_FOUND', 'Product not found', 404);
  const p = d.product;
  let drop = { preorder: false, dropAt: null, note: '' };
  try { if (p.drop && p.drop.value) drop = { ...drop, ...JSON.parse(p.drop.value) }; } catch (_) {}
  return {
    id: p.id, title: p.title, handle: p.handle, status: p.status, descriptionHtml: p.descriptionHtml, type: p.productType,
    tags: p.tags, vendor: p.vendor, createdAt: p.createdAt, updatedAt: p.updatedAt, seo: p.seo,
    options: p.options.filter((o) => o.name !== 'Title').map((o) => ({ id: o.id, name: o.name, values: o.optionValues.map((x) => x.name) })),
    media: p.media.nodes.map((m) => ({ id: m.id, alt: m.alt, status: m.status, url: (m.image && m.image.url) || (m.preview && m.preview.image && m.preview.image.url) || null })),
    variants: p.variants.nodes.map((vr) => {
      const lvl = vr.inventoryItem.inventoryLevels.nodes[0];
      return {
        id: vr.id, title: vr.title, sku: vr.sku, price: Number(vr.price), compareAt: vr.compareAtPrice ? Number(vr.compareAtPrice) : null,
        quantity: vr.inventoryQuantity, policy: vr.inventoryPolicy, tracked: vr.inventoryItem.tracked, inventoryItemId: vr.inventoryItem.id,
        locationId: lvl ? lvl.location.id : null,
        options: Object.fromEntries(vr.selectedOptions.map((o) => [o.name, o.value])),
      };
    }),
    collections: p.collections.nodes,
    drop,
  };
}

function cartesian(options) {
  if (!options.length) return [{}];
  const [first, ...rest] = options;
  const tail = cartesian(rest);
  return first.values.flatMap((val) => tail.map((t) => ({ [first.name]: val, ...t })));
}

/**
 * Declarative variant sync with productSet: options (e.g. Size S-XXL, Colour) -> every combination.
 * rows: [{ options: {Size:'M', Colour:'Black'}, price, compareAt, quantity, sku, id? }]
 */
async function syncVariants(productId, options, rows, defaults = {}) {
  const opts = options.filter((o) => o.name && o.values.length);
  const combos = cartesian(opts);
  const key = (o) => opts.map((x) => `${x.name}=${o[x.name]}`).join('|');
  const byKey = new Map(rows.map((r) => [key(r.options || {}), r]));
  const current = productId ? await getProduct(productId) : null;
  const currentByKey = new Map((current ? current.variants : []).map((vr) => [key(vr.options), vr]));
  const variants = combos.map((combo, i) => {
    const row = byKey.get(key(combo)) || {};
    const existing = currentByKey.get(key(combo));
    const price = row.price ?? (existing ? existing.price : defaults.price);
    if (price === null || price === undefined) throw new AppError('VALIDATION', `Set a price for ${Object.values(combo).join(' / ') || 'the product'}`, 422);
    return {
      ...(existing ? { id: existing.id } : {}),
      position: i + 1,
      optionValues: opts.length ? opts.map((o) => ({ optionName: o.name, name: combo[o.name] })) : [{ optionName: 'Title', name: 'Default Title' }],
      price: String(price),
      compareAtPrice: row.compareAt !== undefined ? (row.compareAt ? String(row.compareAt) : null) : (existing && existing.compareAt ? String(existing.compareAt) : (defaults.compareAt ? String(defaults.compareAt) : null)),
      ...(row.sku !== undefined ? { sku: row.sku || null } : {}),
      inventoryPolicy: row.continueSelling ? 'CONTINUE' : 'DENY',
      inventoryItem: { tracked: true },
    };
  });
  const productOptions = opts.length
    ? opts.map((o, i) => ({ name: o.name, position: i + 1, values: o.values.map((name) => ({ name })) }))
    : [{ name: 'Title', position: 1, values: [{ name: 'Default Title' }] }];
  return { variants, productOptions, wantQty: combos.map((c) => { const r = byKey.get(key(c)); return r && r.quantity !== undefined && r.quantity !== null ? Number(r.quantity) : null; }), key, combos };
}

async function setStock(items) {
  // items: [{ inventoryItemId, quantity, locationId? }]
  const list = items.filter((x) => x.inventoryItemId && Number.isInteger(x.quantity));
  if (!list.length) return;
  const loc = await primaryLocation();
  const d = await gql(`mutation($input: InventorySetQuantitiesInput!, $idempotencyKey: String!){
    inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) { userErrors { field message code } } }`, {
    input: {
      name: 'available', reason: 'correction', referenceDocumentUri: 'gid://eos-site/StockUpdate/admin',
      quantities: list.map((x) => ({ inventoryItemId: x.inventoryItemId, locationId: x.locationId || loc.id, quantity: x.quantity, changeFromQuantity: null })),
    },
  }, { idempotent: true });
  checkUserErrors(d.inventorySetQuantities, 'Stock');
}

async function runProductSet(input) {
  const d = await gql(`mutation($input: ProductSetInput!){ productSet(input: $input, synchronous: true) {
    product { id variants(first: 100) { nodes { id selectedOptions { name value } inventoryItem { id } } } }
    userErrors { field message code } } }`, { input });
  checkUserErrors(d.productSet, 'Product');
  return d.productSet.product;
}

async function applyQuantities(product, sync) {
  const updates = [];
  product.variants.nodes.forEach((vr) => {
    const opts = Object.fromEntries(vr.selectedOptions.map((o) => [o.name, o.value]));
    const i = sync.combos.findIndex((c) => sync.key(c) === sync.key(opts));
    const q = i >= 0 ? sync.wantQty[i] : null;
    if (q !== null && q !== undefined) updates.push({ inventoryItemId: vr.inventoryItem.id, quantity: q });
  });
  await setStock(updates);
}

const dropMetafield = (drop) => ({ namespace: 'eos', key: 'drop', type: 'json', value: JSON.stringify({ preorder: Boolean(drop.preorder), dropAt: drop.dropAt || null, note: drop.note || '' }) });

async function createProduct(data) {
  const sync = await syncVariants(null, data.options, data.variants, { price: data.price, compareAt: data.compareAt });
  const product = await runProductSet({
    title: data.title, descriptionHtml: data.descriptionHtml, productType: data.type, tags: data.tags, status: data.status, vendor: 'EOS',
    seo: data.seo, productOptions: sync.productOptions, variants: sync.variants,
    ...(data.collectionIds.length ? { collections: data.collectionIds } : {}),
    metafields: [dropMetafield(data.drop)],
  });
  await applyQuantities(product, sync);
  return product.id;
}

async function updateProduct(id, data) {
  const input = { id };
  ['title', 'descriptionHtml', 'status', 'tags', 'seo'].forEach((k) => { if (data[k] !== undefined) input[k] = data[k]; });
  if (data.type !== undefined) input.productType = data.type;
  if (data.handle) input.handle = data.handle;
  if (data.collectionIds) {
    const cur = await getProduct(id);
    const curIds = cur.collections.map((c) => c.id);
    input.collectionsToJoin = data.collectionIds.filter((c) => !curIds.includes(c));
    input.collectionsToLeave = curIds.filter((c) => !data.collectionIds.includes(c));
  }
  const d = await gql(`mutation($p: ProductUpdateInput!){ productUpdate(product: $p){ product { id } userErrors { field message } } }`, { p: input });
  checkUserErrors(d.productUpdate, 'Product');
  if (data.drop) {
    const m = await gql(`mutation($m:[MetafieldsSetInput!]!){ metafieldsSet(metafields:$m){ userErrors{ field message } } }`, { m: [{ ownerId: id, ...dropMetafield(data.drop) }] });
    checkUserErrors(m.metafieldsSet, 'Drop settings');
  }
  return id;
}

async function saveVariants(id, options, rows) {
  const sync = await syncVariants(id, options, rows);
  const product = await runProductSet({ id, productOptions: sync.productOptions, variants: sync.variants });
  await applyQuantities(product, sync);
  return id;
}

async function updatePrices(productId, variants) {
  const d = await gql(`mutation($pid: ID!, $v: [ProductVariantsBulkInput!]!){ productVariantsBulkUpdate(productId: $pid, variants: $v){ userErrors { field message } } }`, {
    pid: productId,
    v: variants.map((x) => ({ id: x.id, ...(x.price !== undefined ? { price: String(x.price) } : {}), ...(x.compareAt !== undefined ? { compareAtPrice: x.compareAt ? String(x.compareAt) : null } : {}) })),
  });
  checkUserErrors(d.productVariantsBulkUpdate, 'Prices');
}

/** Bulk price change across products. mode: percent|fixed|sale|endsale. */
async function bulkPrice({ productIds, mode, value, round }) {
  const results = [];
  for (const pid of productIds) {
    const p = await getProduct(pid);
    const r = (n) => { const x = Math.max(0, n); return round ? Math.round(x / round) * round : Math.round(x * 100) / 100; };
    const changes = p.variants.map((vr) => {
      if (mode === 'percent') return { id: vr.id, price: r(vr.price * (1 + value / 100)) };
      if (mode === 'fixed') return { id: vr.id, price: r(vr.price + value) };
      if (mode === 'sale') { const base = vr.compareAt && vr.compareAt > vr.price ? vr.compareAt : vr.price; return { id: vr.id, price: r(base * (1 - value / 100)), compareAt: base }; }
      if (mode === 'endsale') return vr.compareAt ? { id: vr.id, price: vr.compareAt, compareAt: null } : null;
      return null;
    }).filter(Boolean);
    if (changes.some((c) => c.price !== undefined && c.price <= 0)) throw new AppError('VALIDATION', `That change would make ${p.title} free or negative.`, 422);
    if (changes.length) await updatePrices(pid, changes);
    results.push({ id: pid, title: p.title, changed: changes.length });
  }
  return results;
}

async function duplicateProduct(id, newTitle) {
  const d = await gql(`mutation($id: ID!, $t: String!){ productDuplicate(productId: $id, newTitle: $t, newStatus: DRAFT, includeImages: true){
    newProduct { id } userErrors { field message } } }`, { id, t: newTitle });
  checkUserErrors(d.productDuplicate, 'Duplicate');
  return d.productDuplicate.newProduct.id;
}

async function deleteProduct(id) {
  const d = await gql(`mutation($i: ProductDeleteInput!){ productDelete(input: $i){ deletedProductId userErrors { field message } } }`, { i: { id } });
  checkUserErrors(d.productDelete, 'Delete');
}

/* ----------------------------- media ----------------------------- */
async function uploadImages(productId, files) {
  const staged = await gql(`mutation($input: [StagedUploadInput!]!){ stagedUploadsCreate(input: $input){
    stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } } }`, {
    input: files.map((f) => ({ filename: f.originalname.replace(/[^\w.\-]/g, '_'), mimeType: f.mimetype, resource: 'IMAGE', httpMethod: 'POST', fileSize: String(f.size) })),
  });
  checkUserErrors(staged.stagedUploadsCreate, 'Upload');
  const targets = staged.stagedUploadsCreate.stagedTargets;
  await Promise.all(targets.map(async (t, i) => {
    const form = new FormData();
    t.parameters.forEach((p) => form.append(p.name, p.value));
    form.append('file', new Blob([files[i].buffer], { type: files[i].mimetype }), files[i].originalname);
    const res = await fetch(t.url, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new AppError('UPLOAD_FAILED', `Image upload failed (${res.status})`, 502);
  }));
  const d = await gql(`mutation($p: ProductUpdateInput!, $m: [CreateMediaInput!]){ productUpdate(product: $p, media: $m){
    product { id } userErrors { field message } } }`, {
    p: { id: productId },
    m: targets.map((t, i) => ({ originalSource: t.resourceUrl, mediaContentType: 'IMAGE', alt: files[i].alt || '' })),
  });
  checkUserErrors(d.productUpdate, 'Attach images');
  return targets.length;
}

async function deleteMedia(productId, mediaIds) {
  const d = await gql(`mutation($ids: [ID!]!){ fileDelete(fileIds: $ids){ deletedFileIds userErrors { field message } } }`, { ids: mediaIds });
  checkUserErrors(d.fileDelete, 'Delete image');
}

async function reorderMedia(productId, orderedIds) {
  const d = await gql(`mutation($id: ID!, $moves: [MoveInput!]!){ productReorderMedia(id: $id, moves: $moves){ job { id } userErrors { field message } } }`, {
    id: productId, moves: orderedIds.map((mid, i) => ({ id: mid, newPosition: String(i) })),
  });
  checkUserErrors(d.productReorderMedia, 'Reorder');
}

async function updateMediaAlt(productId, mediaId, alt) {
  const d = await gql(`mutation($f: [FileUpdateInput!]!){ fileUpdate(files: $f){ userErrors { field message } } }`, { f: [{ id: mediaId, alt }] });
  checkUserErrors(d.fileUpdate, 'Image alt');
}

/* ----------------------------- inventory ----------------------------- */
async function inventoryList() {
  const nodes = await paginate(async (after) => (await gql(`query($a:String){ productVariants(first: 100, after: $a, query: "product_status:active,draft") {
      nodes { id title sku inventoryQuantity inventoryItem { id tracked } product { id title status featuredMedia { preview { image { url } } } } }
      pageInfo { hasNextPage endCursor } } }`, { a: after })).productVariants, { maxPages: 10 });
  return nodes.map((n) => ({
    variantId: n.id, variant: n.title === 'Default Title' ? '' : n.title, sku: n.sku, quantity: n.inventoryQuantity,
    tracked: n.inventoryItem.tracked, inventoryItemId: n.inventoryItem.id, productId: n.product.id, product: n.product.title, status: n.product.status,
    image: n.product.featuredMedia && n.product.featuredMedia.preview && n.product.featuredMedia.preview.image ? n.product.featuredMedia.preview.image.url : null,
  }));
}

/* ----------------------------- collections ----------------------------- */
async function listCollections() {
  const d = await gql(`{ collections(first: 100, sortKey: TITLE) { nodes { id title handle descriptionHtml updatedAt
    image { url } productsCount { count } ruleSet { appliedDisjunctively } seo { title description } } } }`);
  return d.collections.nodes.map((c) => ({ id: c.id, title: c.title, handle: c.handle, descriptionHtml: c.descriptionHtml, image: c.image && c.image.url, count: c.productsCount.count, smart: Boolean(c.ruleSet), seo: c.seo, updatedAt: c.updatedAt }));
}
async function getCollection(id) {
  const d = await gql(`query($id:ID!){ collection(id:$id){ id title handle descriptionHtml image { url } ruleSet { appliedDisjunctively } seo { title description }
    products(first: 100) { nodes { id title status featuredMedia { preview { image { url } } } } } } }`, { id });
  if (!d.collection) throw new AppError('NOT_FOUND', 'Collection not found', 404);
  const c = d.collection;
  return { ...c, smart: Boolean(c.ruleSet), image: c.image && c.image.url, products: c.products.nodes.map((p) => ({ id: p.id, title: p.title, status: p.status, image: p.featuredMedia && p.featuredMedia.preview && p.featuredMedia.preview.image ? p.featuredMedia.preview.image.url : null })) };
}
async function saveCollection(id, data) {
  const input = { title: data.title, descriptionHtml: data.descriptionHtml, ...(data.seo ? { seo: data.seo } : {}), ...(data.handle ? { handle: data.handle } : {}) };
  if (id) {
    const d = await gql(`mutation($i: CollectionInput!){ collectionUpdate(input: $i){ collection { id } userErrors { field message } } }`, { i: { id, ...input } });
    checkUserErrors(d.collectionUpdate, 'Collection');
    return id;
  }
  const d = await gql(`mutation($i: CollectionInput!){ collectionCreate(input: $i){ collection { id } userErrors { field message } } }`, { i: { ...input, ...(data.productIds && data.productIds.length ? { products: data.productIds } : {}) } });
  checkUserErrors(d.collectionCreate, 'Collection');
  return d.collectionCreate.collection.id;
}
async function setCollectionProducts(id, add, remove) {
  if (add.length) {
    const d = await gql(`mutation($id: ID!, $p: [ID!]!){ collectionAddProducts(id: $id, productIds: $p){ userErrors { field message } } }`, { id, p: add });
    checkUserErrors(d.collectionAddProducts, 'Add to collection');
  }
  if (remove.length) {
    const d = await gql(`mutation($id: ID!, $p: [ID!]!){ collectionRemoveProducts(id: $id, productIds: $p){ job { id } userErrors { field message } } }`, { id, p: remove });
    checkUserErrors(d.collectionRemoveProducts, 'Remove from collection');
  }
}
async function deleteCollection(id) {
  const d = await gql(`mutation($i: CollectionDeleteInput!){ collectionDelete(input: $i){ deletedCollectionId userErrors { field message } } }`, { i: { id } });
  checkUserErrors(d.collectionDelete, 'Delete collection');
}

/* ----------------------------- discounts ----------------------------- */
const DISCOUNT_FIELDS = `
  ... on DiscountCodeBasic { title status startsAt endsAt usageLimit asyncUsageCount summary appliesOncePerCustomer codes(first: 1) { nodes { code } } }
  ... on DiscountCodeFreeShipping { title status startsAt endsAt usageLimit asyncUsageCount summary appliesOncePerCustomer codes(first: 1) { nodes { code } } }
  ... on DiscountCodeBxgy { title status startsAt endsAt usageLimit asyncUsageCount summary codes(first: 1) { nodes { code } } }
  ... on DiscountAutomaticBasic { title status startsAt endsAt summary asyncUsageCount }
  ... on DiscountAutomaticFreeShipping { title status startsAt endsAt summary asyncUsageCount }
  ... on DiscountAutomaticBxgy { title status startsAt endsAt summary asyncUsageCount }`;
async function listDiscounts() {
  const d = await gql(`{ discountNodes(first: 100, reverse: true) { nodes { id discount { __typename ${DISCOUNT_FIELDS} } } } }`);
  return d.discountNodes.nodes.map((n) => {
    const x = n.discount;
    return {
      id: n.id, type: x.__typename, automatic: /Automatic/.test(x.__typename), title: x.title, status: x.status,
      code: x.codes && x.codes.nodes[0] ? x.codes.nodes[0].code : null, summary: x.summary, startsAt: x.startsAt, endsAt: x.endsAt,
      usageLimit: x.usageLimit ?? null, used: x.asyncUsageCount ?? 0,
    };
  });
}

function discountCommon(data) {
  return {
    title: data.title,
    startsAt: data.startsAt || new Date().toISOString(),
    endsAt: data.endsAt || null,
    context: { all: 'ALL' },
    ...(data.minSubtotal ? { minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: String(data.minSubtotal) } } } : {}),
    combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: true },
  };
}
function customerGets(data) {
  const value = data.kind === 'percent' ? { percentage: Math.min(100, data.value) / 100 } : { discountAmount: { amount: String(data.value), appliesOnEachItem: false } };
  return { value, items: { all: true } };
}

async function createDiscount(data) {
  let d; let key;
  if (data.automatic) {
    if (data.kind === 'shipping') {
      key = 'discountAutomaticFreeShippingCreate';
      d = await gql(`mutation($x: DiscountAutomaticFreeShippingInput!){ discountAutomaticFreeShippingCreate(freeShippingAutomaticDiscount: $x){ automaticDiscountNode { id } userErrors { field message } } }`,
        { x: { ...discountCommon(data), destination: { all: true } } });
    } else {
      key = 'discountAutomaticBasicCreate';
      d = await gql(`mutation($x: DiscountAutomaticBasicInput!){ discountAutomaticBasicCreate(automaticBasicDiscount: $x){ automaticDiscountNode { id } userErrors { field message } } }`,
        { x: { ...discountCommon(data), customerGets: customerGets(data) } });
    }
  } else if (data.kind === 'shipping') {
    key = 'discountCodeFreeShippingCreate';
    d = await gql(`mutation($x: DiscountCodeFreeShippingInput!){ discountCodeFreeShippingCreate(freeShippingCodeDiscount: $x){ codeDiscountNode { id } userErrors { field message } } }`,
      { x: { ...discountCommon(data), code: data.code, destination: { all: true }, usageLimit: data.usageLimit, appliesOncePerCustomer: data.oncePerCustomer } });
  } else {
    key = 'discountCodeBasicCreate';
    d = await gql(`mutation($x: DiscountCodeBasicInput!){ discountCodeBasicCreate(basicCodeDiscount: $x){ codeDiscountNode { id } userErrors { field message } } }`,
      { x: { ...discountCommon(data), code: data.code, customerGets: customerGets(data), usageLimit: data.usageLimit, appliesOncePerCustomer: data.oncePerCustomer } });
  }
  checkUserErrors(d[key], 'Discount');
  return (d[key].codeDiscountNode || d[key].automaticDiscountNode).id;
}

async function toggleDiscount(id, automatic, active) {
  const name = automatic ? (active ? 'discountAutomaticActivate' : 'discountAutomaticDeactivate') : (active ? 'discountCodeActivate' : 'discountCodeDeactivate');
  const field = automatic ? 'automaticDiscountNode' : 'codeDiscountNode';
  const d = await gql(`mutation($id: ID!){ ${name}(id: $id){ ${field} { id } userErrors { field message } } }`, { id });
  checkUserErrors(d[name], 'Discount');
}
async function deleteDiscount(id, automatic) {
  const name = automatic ? 'discountAutomaticDelete' : 'discountCodeDelete';
  const field = automatic ? 'deletedAutomaticDiscountId' : 'deletedCodeDiscountId';
  const d = await gql(`mutation($id: ID!){ ${name}(id: $id){ ${field} userErrors { field message } } }`, { id });
  checkUserErrors(d[name], 'Discount');
}

/* ----------------------------- orders ----------------------------- */
const ADDRESS = 'name firstName lastName address1 address2 city province provinceCode zip country phone';
const ORDER_LIST = `id name createdAt tags cancelledAt displayFinancialStatus displayFulfillmentStatus email phone
  totalPriceSet { shopMoney { amount } } subtotalPriceSet { shopMoney { amount } } totalDiscountsSet { shopMoney { amount } } totalShippingPriceSet { shopMoney { amount } }
  customer { id displayName email phone } shippingAddress { ${ADDRESS} } discountCodes note
  lineItems(first: 30) { nodes { title variantTitle quantity sku originalUnitPriceSet { shopMoney { amount } } image { url } } }`;
const DRAFT_LIST = `id name createdAt updatedAt tags status email phone note2 discountCodes
  totalPriceSet { shopMoney { amount } } subtotalPriceSet { shopMoney { amount } } totalDiscountsSet { shopMoney { amount } } totalShippingPriceSet { shopMoney { amount } }
  customer { id displayName email phone } shippingAddress { ${ADDRESS} }
  lineItems(first: 30) { nodes { title variantTitle quantity sku originalUnitPriceSet { shopMoney { amount } } image { url } } }`;

function mapOrder(o, kind) {
  const status = statusFromTags(o.tags) || (kind === 'order' ? deriveOrderStatus(o) : 'pending');
  return {
    kind, id: o.id, name: o.name, createdAt: o.createdAt, tags: o.tags, status,
    financial: o.displayFinancialStatus || (kind === 'draft' ? 'AWAITING PAYMENT' : null), fulfillment: o.displayFulfillmentStatus || null,
    email: o.email || (o.customer && o.customer.email), phone: o.phone || (o.shippingAddress && o.shippingAddress.phone) || (o.customer && o.customer.phone),
    customer: o.customer ? o.customer.displayName : (o.shippingAddress && o.shippingAddress.name) || '',
    customerId: o.customer && o.customer.id,
    address: o.shippingAddress,
    note: o.note2 !== undefined ? o.note2 : o.note,
    discountCodes: o.discountCodes || [],
    subtotal: amount(o.subtotalPriceSet), discount: amount(o.totalDiscountsSet), shipping: amount(o.totalShippingPriceSet), total: amount(o.totalPriceSet),
    items: o.lineItems.nodes.map((li) => ({ title: li.title, variant: li.variantTitle || '', quantity: li.quantity, sku: li.sku, price: amount(li.originalUnitPriceSet), image: li.image && li.image.url })),
  };
}

async function listOrders({ status = '', q = '', limit = 100 } = {}) {
  const search = q ? q.replace(/["\\]/g, '') : '';
  const [drafts, orders] = await Promise.all([
    paginate(async (after) => (await gql(`query($a:String,$q:String){ draftOrders(first: 50, after: $a, query: $q, sortKey: UPDATED_AT, reverse: true){ nodes { ${DRAFT_LIST} } pageInfo { hasNextPage endCursor } } }`,
      { a: after, q: ['(status:open OR status:invoice_sent)', search ? `"${search}"` : ''].filter(Boolean).join(' AND ') })).draftOrders, { maxPages: Math.ceil(limit / 50) }),
    paginate(async (after) => (await gql(`query($a:String,$q:String){ orders(first: 50, after: $a, query: $q, sortKey: CREATED_AT, reverse: true){ nodes { ${ORDER_LIST} } pageInfo { hasNextPage endCursor } } }`,
      { a: after, q: search || null })).orders, { maxPages: Math.ceil(limit / 50) }),
  ]);
  let list = [...drafts.map((o) => mapOrder(o, 'draft')), ...orders.map((o) => mapOrder(o, 'order'))]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (status) list = list.filter((o) => o.status === status);
  return list;
}

async function getOrder(id) {
  if (/DraftOrder/.test(id)) {
    const d = await gql(`query($id: ID!){ draftOrder(id: $id){ ${DRAFT_LIST} order { id name } } }`, { id });
    if (!d.draftOrder) throw new AppError('NOT_FOUND', 'Order not found', 404);
    return { ...mapOrder(d.draftOrder, 'draft'), completedOrder: d.draftOrder.order };
  }
  const d = await gql(`query($id: ID!){ order(id: $id){ ${ORDER_LIST} canMarkAsPaid } }`, { id });
  if (!d.order) throw new AppError('NOT_FOUND', 'Order not found', 404);
  return { ...mapOrder(d.order, 'order'), canMarkAsPaid: d.order.canMarkAsPaid };
}

async function setTags(id, add, remove) {
  if (remove.length) await gql(`mutation($id: ID!, $t: [String!]!){ tagsRemove(id: $id, tags: $t){ userErrors { message } } }`, { id, t: remove });
  if (add.length) {
    const d = await gql(`mutation($id: ID!, $t: [String!]!){ tagsAdd(id: $id, tags: $t){ userErrors { field message } } }`, { id, t: add });
    checkUserErrors(d.tagsAdd, 'Tags');
  }
}

async function setOrderStatus(id, status) {
  if (!STATUSES.includes(status)) throw new AppError('VALIDATION', 'Unknown status', 422);
  const o = await getOrder(id);
  await setTags(id, [`status:${status}`], o.tags.filter((t) => /^status:/i.test(t)));
  return getOrder(id);
}

/** Mark paid. Draft -> draftOrderComplete (creates a real paid order). Order -> orderMarkAsPaid. */
async function markPaid(id) {
  if (/DraftOrder/.test(id)) {
    const draft = await getOrder(id);
    const d = await gql(`mutation($id: ID!){ draftOrderComplete(id: $id){ draftOrder { id order { id name tags } } userErrors { field message } } }`, { id });
    checkUserErrors(d.draftOrderComplete, 'Mark paid');
    const order = d.draftOrderComplete.draftOrder.order;
    if (order) {
      const ref = `order-${draft.name.replace('#', '')}`;
      await setTags(order.id, ['eos-site', 'status:confirmed', ref], (order.tags || []).filter((t) => /^status:/i.test(t)));
    }
    return order ? getOrder(order.id) : getOrder(id);
  }
  const d = await gql(`mutation($i: OrderMarkAsPaidInput!){ orderMarkAsPaid(input: $i){ order { id } userErrors { field message } } }`, { i: { id } });
  checkUserErrors(d.orderMarkAsPaid, 'Mark paid');
  await setOrderStatus(id, 'confirmed');
  return getOrder(id);
}

async function updateOrderNote(id, note) {
  if (/DraftOrder/.test(id)) {
    const d = await gql(`mutation($id: ID!, $i: DraftOrderInput!){ draftOrderUpdate(id: $id, input: $i){ draftOrder { id } userErrors { field message } } }`, { id, i: { note } });
    checkUserErrors(d.draftOrderUpdate, 'Note');
  } else {
    const d = await gql(`mutation($i: OrderInput!){ orderUpdate(input: $i){ order { id } userErrors { field message } } }`, { i: { id, note } });
    checkUserErrors(d.orderUpdate, 'Note');
  }
}

/* ----------------------------- customers ----------------------------- */
async function listCustomers({ q = '', subscribers = false, max = 500 } = {}) {
  const nodes = await paginate(async (after) => (await gql(`query($a:String,$q:String){ customers(first: 100, after: $a, query: $q, sortKey: CREATED_AT, reverse: true){
    nodes { id displayName firstName lastName email phone createdAt numberOfOrders tags note
      amountSpent { amount } emailMarketingConsent { marketingState consentUpdatedAt } defaultAddress { city province } }
    pageInfo { hasNextPage endCursor } } }`, { a: after, q: q ? q.replace(/["\\]/g, '') : null })).customers, { maxPages: Math.ceil(max / 100) });
  let list = nodes.map((c) => ({
    id: c.id, name: c.displayName, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, createdAt: c.createdAt,
    orders: Number(c.numberOfOrders) || 0, spent: c.amountSpent ? Number(c.amountSpent.amount) : 0, tags: c.tags,
    subscribed: Boolean(c.emailMarketingConsent && c.emailMarketingConsent.marketingState === 'SUBSCRIBED'),
    city: c.defaultAddress ? [c.defaultAddress.city, c.defaultAddress.province].filter(Boolean).join(', ') : '',
  }));
  if (subscribers) list = list.filter((c) => c.subscribed);
  return list;
}

module.exports = {
  overview, lowStock, listProducts, getProduct, createProduct, updateProduct, saveVariants, updatePrices, bulkPrice,
  duplicateProduct, deleteProduct, uploadImages, deleteMedia, reorderMedia, updateMediaAlt, inventoryList, setStock,
  listCollections, getCollection, saveCollection, setCollectionProducts, deleteCollection,
  listDiscounts, createDiscount, toggleDiscount, deleteDiscount,
  listOrders, getOrder, setOrderStatus, markPaid, updateOrderNote, listCustomers, primaryLocation, numericId,
};
