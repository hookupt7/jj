// Entry point. Loaded as a module (deferred by default).
import { html } from './core.js';
import * as fx from './fx.js';
import { initCart } from './cart.js';
import * as ui from './ui.js';

const PAGES = {
  home: () => import('./pages/home.js'),
  shop: () => import('./pages/shop.js'),
  product: () => import('./pages/product.js'),
  collections: () => import('./pages/collections.js'),
  lookbook: () => import('./pages/lookbook.js'),
  join: () => import('./pages/join.js'),
  checkout: () => import('./pages/checkout.js'),
  success: () => import('./pages/success.js'),
  track: () => import('./pages/track.js'),
  wishlist: () => import('./pages/wishlist.js'),
};

fx.preloader();
fx.transitions();
fx.grain();
fx.autoplayVideos();
fx.toTop();
initCart();
ui.header();
ui.mobileMenu();
ui.search();
ui.initModal();
ui.newsletter();
ui.waCompose();
ui.quickAdd();
ui.quickView();

const page = html.dataset.page;
(PAGES[page] ? PAGES[page]().then((m) => m.default && m.default()) : Promise.resolve())
  .catch((e) => console.warn('[eos] page script', e))
  .finally(() => { fx.reveals(); });
