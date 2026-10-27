'use strict';
// Storefront reads. Everything comes from the Admin API server-side and is cached.
const config = require('../config');
const cache = require('../lib/cache');
const { gql, paginate, numericId } = require('./client');
const { sanitize, stripTags } = require('../lib/html');

const TTL = config.catalogCacheSeconds;

const PRODUCT_FIELDS = `
  id handle title descriptionHtml productType tags vendor status createdAt publishedAt updatedAt
  totalInventory tracksInventory
  seo { title description }
  options { name optionValues { name } }
  media(first: 10) { nodes { ... on MediaImage { id alt image { url width height altText } } } }
  variants(first: 30) { nodes {
    id title price compareAtPrice availableForSale inventoryQuantity inventoryPolicy
    selectedOptions { name value }
    inventoryItem { tracked }
  } }
  collections(first: 8) { nodes { handle title } }
  drop: metafield(namespace: "eos", key: "drop") { value }
`;

const isSize = (n) => /^size$/i.test(n || '');
const isColour = (n) => /^colou?r$/i.test(n || '');
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', 'OS', 'ONE SIZE'];
const sizeRank = (s) => { const i = SIZE_ORDER.indexOf(String(s).toUpperCase()); return i === -1 ? 99 : i; };

function parseDrop(raw) {
  if (!raw) return { preorder: false, dropAt: null };
  try {
    const j = JSON.parse(raw);
    return { preorder: Boolean(j.preorder), dropAt: j.dropAt || null, note: j.note || '' };
  } catch (_) { return { preorder: false, dropAt: null }; }
}

function mapProduct(p) {
  const variants = p.variants.nodes.map((vr) => {
    const opts = Object.fromEntries(vr.selectedOptions.map((o) => [o.name, o.value]));
    const tracked = Boolean(vr.inventoryItem && vr.inventoryItem.tracked) && vr.inventoryPolicy === 'DENY';
    return {
      id: vr.id,
      title: vr.title === 'Default Title' ? '' : vr.title,
      price: Number(vr.price),
      compareAt: vr.compareAtPrice && Number(vr.compareAtPrice) > Number(vr.price) ? Number(vr.compareAtPrice) : null,
      available: Boolean(vr.availableForSale),
      stock: tracked ? Math.max(0, vr.inventoryQuantity || 0) : null,
      options: opts,
    };
  });
  const images = p.media.nodes.filter((m) => m && m.image).map((m) => ({
    src: m.image.url, alt: m.alt || m.image.altText || p.title, w: m.image.width || null, h: m.image.height || null,
  }));
  const options = p.options.filter((o) => !(o.name === 'Title' && o.optionValues.length === 1 && o.optionValues[0].name === 'Default Title'))
    .map((o) => ({ name: o.name, values: o.optionValues.map((x) => x.name) }));
  const sizeOpt = options.find((o) => isSize(o.name));
  const colourOpt = options.find((o) => isColour(o.name));
  const prices = variants.map((x) => x.price);
  const price = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const compareAt = variants.reduce((m, x) => (x.compareAt && x.compareAt > m ? x.compareAt : m), 0) || null;
  const totalStock = variants.every((x) => x.stock === null) ? null : variants.reduce((s, x) => s + (x.stock || 0), 0);
  const drop = parseDrop(p.drop && p.drop.value);
  return {
    id: numericId(p.id),
    gid: p.id,
    handle: p.handle,
    title: p.title,
    descriptionHtml: sanitize(p.descriptionHtml),
    excerpt: stripTags(p.descriptionHtml).slice(0, 220),
    type: p.productType || '',
    tags: p.tags || [],
    createdAt: p.createdAt,
    price, maxPrice,
    compareAt: compareAt && compareAt > price ? compareAt : null,
    onSale: variants.some((x) => x.compareAt),
    available: variants.some((x) => x.available),
    totalStock,
    images,
    options,
    sizes: sizeOpt ? [...sizeOpt.values].sort((a, b) => sizeRank(a) - sizeRank(b)) : [],
    colours: colourOpt ? colourOpt.values : [],
    variants,
    collections: p.collections.nodes.map((c) => c.handle),
    seo: { title: (p.seo && p.seo.title) || '', description: (p.seo && p.seo.description) || '' },
    drop,
  };
}

async function allProducts() {
  return cache.wrap('catalog:products', TTL, async () => {
    const nodes = await paginate(async (after) => {
      const d = await gql(`query($after:String){ products(first: 20, after: $after, query: "status:active", sortKey: CREATED_AT, reverse: true) {
        nodes { ${PRODUCT_FIELDS} } pageInfo { hasNextPage endCursor } } }`, { after });
      return d.products;
    }, { maxPages: 15 });
    return nodes.map(mapProduct);
  });
}

async function productByHandle(handle) {
  const all = await allProducts();
  return all.find((p) => p.handle === handle) || null;
}

async function allCollections() {
  return cache.wrap('catalog:collections', TTL, async () => {
    const [d, products] = await Promise.all([
      gql(`{ collections(first: 100, sortKey: TITLE) { nodes {
        id handle title descriptionHtml updatedAt image { url altText width height }
        seo { title description } sortOrder
      } } }`),
      allProducts(),
    ]);
    return d.collections.nodes.map((c) => {
      const items = products.filter((p) => p.collections.includes(c.handle));
      const fallback = items.find((p) => p.images.length);
      return {
        id: numericId(c.id), gid: c.id, handle: c.handle, title: c.title,
        descriptionHtml: sanitize(c.descriptionHtml), excerpt: stripTags(c.descriptionHtml).slice(0, 200),
        image: c.image ? { src: c.image.url, alt: c.image.altText || c.title, w: c.image.width, h: c.image.height }
          : fallback ? fallback.images[0] : null,
        count: items.length,
        seo: c.seo,
      };
    }).filter((c) => c.count > 0);
  });
}

const norm = (s) => String(s || '').toLowerCase().trim();

function facetsFor(list) {
  const types = new Map(); const sizes = new Set(); const colours = new Set();
  let min = Infinity; let max = 0;
  for (const p of list) {
    if (p.type) types.set(p.type, (types.get(p.type) || 0) + 1);
    p.sizes.forEach((s) => sizes.add(s));
    p.colours.forEach((c) => colours.add(c));
    min = Math.min(min, p.price); max = Math.max(max, p.maxPrice);
  }
  return {
    types: [...types.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
    sizes: [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b)),
    colours: [...colours].sort(),
    price: list.length ? { min: Math.floor(min), max: Math.ceil(max) } : { min: 0, max: 0 },
  };
}

function search(list, q) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return list;
  return list.map((p) => {
    const hay = norm([p.title, p.type, p.tags.join(' '), p.colours.join(' '), p.excerpt].join(' '));
    const title = norm(p.title);
    let score = 0;
    for (const t of terms) { if (!hay.includes(t)) return null; score += title.includes(t) ? 3 : 1; }
    return { p, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score).map((x) => x.p);
}

/** Filter, sort and paginate the cached catalog. */
async function query(params = {}, featuredHandles = []) {
  const all = await allProducts();
  let list = all;
  if (params.collection) list = list.filter((p) => p.collections.includes(params.collection));
  if (params.handles) {
    const hs = params.handles;
    return { items: hs.map((h) => all.find((p) => p.handle === h)).filter(Boolean), total: hs.length, page: 1, pages: 1, facets: null };
  }
  const facets = facetsFor(list);
  if (params.q) list = search(list, params.q);
  if (params.type && params.type.length) list = list.filter((p) => params.type.map(norm).includes(norm(p.type)));
  if (params.size && params.size.length) {
    const want = params.size.map(norm);
    list = list.filter((p) => p.variants.some((vr) => vr.available && Object.entries(vr.options).some(([k, val]) => isSize(k) && want.includes(norm(val)))));
  }
  if (params.colour && params.colour.length) {
    const want = params.colour.map(norm);
    list = list.filter((p) => p.colours.some((c) => want.includes(norm(c))));
  }
  if (params.min != null) list = list.filter((p) => p.maxPrice >= params.min);
  if (params.max != null) list = list.filter((p) => p.price <= params.max);
  if (params.available) list = list.filter((p) => p.available);
  if (params.sale) list = list.filter((p) => p.onSale);

  const sort = params.sort || 'featured';
  const byNew = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
  const sorted = [...list];
  if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
  else if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === 'newest') sorted.sort(byNew);
  else if (!params.q) {
    const rank = (p) => { const i = featuredHandles.indexOf(p.handle); return i === -1 ? 1e6 : i; };
    sorted.sort((a, b) => rank(a) - rank(b) || (b.available - a.available) || byNew(a, b));
  }
  const per = Math.min(Math.max(params.per || 12, 1), 48);
  const pages = Math.max(1, Math.ceil(sorted.length / per));
  const page = Math.min(Math.max(params.page || 1, 1), pages);
  return { items: sorted.slice((page - 1) * per, page * per), total: sorted.length, page, pages, per, facets };
}

function related(all, product, n = 4) {
  return all.filter((p) => p.handle !== product.handle)
    .map((p) => ({ p, s: (p.type && p.type === product.type ? 2 : 0) + p.collections.filter((c) => product.collections.includes(c)).length + p.tags.filter((t) => product.tags.includes(t)).length * 0.5 }))
    .sort((a, b) => b.s - a.s || new Date(b.p.createdAt) - new Date(a.p.createdAt)).slice(0, n).map((x) => x.p);
}

// Lean card shape for grids.
function card(p) {
  return {
    handle: p.handle, title: p.title, type: p.type, price: p.price, maxPrice: p.maxPrice, compareAt: p.compareAt,
    onSale: p.onSale, available: p.available, images: p.images.slice(0, 2), sizes: p.sizes, colours: p.colours,
    drop: p.drop, createdAt: p.createdAt,
    quick: p.variants.length === 1 ? { id: p.variants[0].id, available: p.variants[0].available, stock: p.variants[0].stock } : null,
  };
}

const invalidate = () => cache.del('catalog:');
module.exports = { allProducts, productByHandle, allCollections, query, related, card, invalidate, isSize, isColour, sizeRank };
