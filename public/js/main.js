// Entry point. Loaded as a module (deferred by default).
import { html } from './core.js';
import * as fx from './fx.js';
import { initCart } from './cart.js';
import * as ui from './ui.js';
import { tagStageImages } from './media.js';

const PAGES = {
  home: () => import('./pages/home.js'),
  shop: () => import('./pages/shop.js'),
  product: () => import('./pages/product.js'),
  collections: () => import('./pages/collections.js'),
  join: () => import('./pages/join.js'),
  checkout: () => import('./pages/checkout.js'),
  success: () => import('./pages/success.js'),
  track: () => import('./pages/track.js'),
  wishlist: () => import('./pages/wishlist.js'),
};

// One failing effect must never stop the page (products must always render).
const safe = (fn) => { try { fn(); } catch (e) { console.warn('[eos] init', e); } };
safe(() => tagStageImages());
safe(() => fx.gate());
safe(() => fx.transitions());
safe(() => fx.grain());
safe(() => fx.autoplayVideos());
safe(() => fx.toTop());
safe(() => fx.cursor());
safe(() => fx.progress());
safe(() => fx.magnetic());
safe(() => fx.smoothScroll());
safe(() => initCart());
safe(() => ui.header());
safe(() => ui.mobileMenu());
safe(() => ui.search());
safe(() => ui.initModal());
safe(() => ui.newsletter());
safe(() => ui.waCompose());
safe(() => ui.quickAdd());
safe(() => ui.quickView());

const page = html.dataset.page;
(PAGES[page] ? PAGES[page]().then((m) => m.default && m.default()) : Promise.resolve())
  .catch((e) => { console.warn('[eos] page script', e); if (window.__eosReport) window.__eosReport('page', e && e.message, page); if (window.__eosFallback) window.__eosFallback('page ' + page); })
  .finally(() => { safe(() => fx.reveals()); window.__eosBooted = true; });
