'use strict';
const config = require('./config');
const cache = require('./lib/cache');
const v = require('./lib/validate');
const { AppError } = require('./lib/errors');
const mo = require('./shopify/metaobjects');

const TYPE = 'eos_site_settings';
const HANDLE = 'site';

// Defaults are real copy only. Money values default to null (unset) on purpose.
const DEFAULTS = Object.freeze({
  announcement: { enabled: false, text: '', link: '' },
  hero: {
    eyebrow: 'Not a brand. A curse.',
    title: 'ENEMY OF SWAG',
    subtitle: 'Not made to fit in.',
    ctaLabel: 'Enter the realm',
    ctaLink: '/shop',
  },
  sections: { marquee: true, manifesto: true, drop: true, featured: true, collections: true, film: true, newsletter: true },
  featured: { title: 'Chosen pieces', productHandles: [], collectionHandle: '' },
  drop: { enabled: false, title: 'The next drop', dateISO: null, productHandle: '', note: '' },
  shipping: { lagos: null, southWest: null, other: null, note: 'Delivery anywhere in Nigeria.' },
  payment: {
    instructions: 'Payment details are confirmed on WhatsApp. Once you place your order, tap "Confirm on WhatsApp" and we will send the account to pay into and confirm your delivery fee. Your order is held for you while we confirm.',
  },
  policies: {
    returns: 'Every piece is checked before it leaves us. If something arrives damaged or in the wrong size, message us on WhatsApp within 48 hours of delivery with your order number and a photo, and we will make it right. Pieces must be unworn, unwashed and with tags attached. Pre-order and limited drop pieces are final sale unless they arrive faulty.',
  },
  sizeGuide: { unit: 'cm', note: '', rows: [] }, // rows: [{ size, chest, length, sleeve }]
  seo: {
    title: 'EOS | Enemy of Swag',
    description: 'EOS (Enemy of Swag) is Nigerian streetwear for the ones who were never interested in being understood. Not made to fit in.',
  },
  maintenance: { enabled: false, message: 'The realm is closed while the next ritual is prepared. Return soon.' },
  inventory: { lowStockThreshold: 3 },
});

const clone = (o) => JSON.parse(JSON.stringify(o));
function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, val] of Object.entries(over)) {
    if (!(k in base)) continue; // ignore unknown keys
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && val && typeof val === 'object' && !Array.isArray(val)) out[k] = merge(base[k], val);
    else out[k] = val;
  }
  return out;
}

// Validate + normalise a full settings object (used on every save).
function normalise(s) {
  const o = merge(clone(DEFAULTS), s);
  const link = (x, f) => {
    const t = v.str(x, f, { max: 300 });
    if (t && !/^(\/[^/]|\/$|https:\/\/)/.test(t)) throw new AppError('VALIDATION', `${f} must start with / or https://`, 422, { field: f });
    return t;
  };
  return {
    announcement: { enabled: v.bool(o.announcement.enabled), text: v.str(o.announcement.text, 'announcement text', { max: 160 }), link: link(o.announcement.link, 'announcement link') },
    hero: {
      eyebrow: v.str(o.hero.eyebrow, 'hero eyebrow', { max: 80 }),
      title: v.str(o.hero.title, 'hero title', { max: 60, required: true }),
      subtitle: v.str(o.hero.subtitle, 'hero subtitle', { max: 160 }),
      ctaLabel: v.str(o.hero.ctaLabel, 'CTA label', { max: 40 }) || DEFAULTS.hero.ctaLabel,
      ctaLink: link(o.hero.ctaLink, 'CTA link') || '/shop',
    },
    sections: Object.fromEntries(Object.keys(DEFAULTS.sections).map((k) => [k, v.bool(o.sections[k])])),
    featured: {
      title: v.str(o.featured.title, 'featured title', { max: 60 }),
      productHandles: v.list(o.featured.productHandles, 'featured products', { max: 12 }).map((h) => v.handle(h)),
      collectionHandle: o.featured.collectionHandle ? v.handle(o.featured.collectionHandle) : '',
    },
    drop: {
      enabled: v.bool(o.drop.enabled),
      title: v.str(o.drop.title, 'drop title', { max: 80 }),
      dateISO: v.date(o.drop.dateISO, 'drop date'),
      productHandle: o.drop.productHandle ? v.handle(o.drop.productHandle) : '',
      note: v.str(o.drop.note, 'drop note', { max: 200 }),
    },
    shipping: {
      lagos: v.money(o.shipping.lagos, 'Lagos fee'),
      southWest: v.money(o.shipping.southWest, 'South West fee'),
      other: v.money(o.shipping.other, 'Other states fee'),
      note: v.str(o.shipping.note, 'shipping note', { max: 300 }),
    },
    payment: { instructions: v.text(o.payment.instructions, 'payment instructions', { max: 1500 }) || DEFAULTS.payment.instructions },
    policies: { returns: v.text(o.policies.returns, 'returns policy', { max: 4000 }) || DEFAULTS.policies.returns },
    sizeGuide: {
      unit: v.oneOf(o.sizeGuide.unit || 'cm', 'size unit', ['cm', 'in']),
      note: v.str(o.sizeGuide.note, 'size guide note', { max: 400 }),
      rows: (Array.isArray(o.sizeGuide.rows) ? o.sizeGuide.rows : []).slice(0, 12).map((r, i) => ({
        size: v.str(r.size, `size row ${i + 1}`, { max: 12, required: true }),
        chest: v.str(r.chest, 'chest', { max: 12 }),
        length: v.str(r.length, 'length', { max: 12 }),
        sleeve: v.str(r.sleeve, 'sleeve', { max: 12 }),
      })),
    },
    seo: { title: v.str(o.seo.title, 'SEO title', { max: 70 }) || DEFAULTS.seo.title, description: v.str(o.seo.description, 'SEO description', { max: 320 }) || DEFAULTS.seo.description },
    maintenance: { enabled: v.bool(o.maintenance.enabled), message: v.str(o.maintenance.message, 'maintenance message', { max: 300 }) || DEFAULTS.maintenance.message },
    inventory: { lowStockThreshold: v.int(o.inventory.lowStockThreshold, 'low stock threshold', { min: 0, max: 1000 }) ?? 3 },
  };
}

let warned = false;
async function get() {
  if (!config.shopify.configured) return clone(DEFAULTS);
  return cache.wrap('settings', config.settingsCacheSeconds, async () => {
    try {
      const stored = await mo.readJson(TYPE, HANDLE);
      return merge(clone(DEFAULTS), stored || {});
    } catch (e) {
      if (!warned) { console.warn('[settings] using defaults:', e.message); warned = true; }
      return clone(DEFAULTS);
    }
  });
}

// Save one section (or several) of settings. Returns the full saved settings.
async function save(patch) {
  const current = await (async () => { cache.del('settings'); return get(); })();
  const next = normalise(merge(current, patch));
  await mo.writeJson(TYPE, HANDLE, next);
  cache.set('settings', next, config.settingsCacheSeconds);
  return next;
}

// What the browser may see (everything in settings is public-safe by design).
function publicView(s) {
  return {
    announcement: s.announcement, hero: s.hero, sections: s.sections, featured: s.featured, drop: s.drop,
    shipping: s.shipping, payment: s.payment, policies: s.policies, sizeGuide: s.sizeGuide, seo: s.seo,
  };
}

module.exports = { get, save, publicView, DEFAULTS };
