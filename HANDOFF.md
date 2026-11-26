# EOS storefront: handoff notes

Live: https://eos-store.onrender.com (Render service `eos-store`, auto-deploys from `main` of hookupt7/jj).
Stack: Node/Express server (`server/`), plain ES-module JS + CSS front end (`public/`), admin SPA (`admin/`).
Shopify Admin GraphQL is the source of truth for products.

## Owner requirements (keep these)
- Home page: keep the original design + animations exactly (gate is tap-to-enter, home only). No clothes on home.
- No human models, no "AI-looking" art. Dark / occult / blood-red style. Professional copy, no meta notes.
- Pieces sit the way they would in a real store: only tops hang. Bottoms lie flat, footwear and headwear on a plinth,
  bags stand, jewellery on a pedestal. Never hang slides or shorts.
- Every category has its own animation and its own product page layout, ready for products not yet in Shopify.
- No scrolling marquee anywhere (removed).

## Done (this round)
- Shop is a product grid (`.pc` cards) with per-category base + idle animation (runs only on screen) + intro animation,
  colour swatches that swap the card image, wishlist, and a quick-view side drawer (`public/js/quick.js`) with
  drag-to-turn viewer, colour + size, add to bag with spinner.
- Product page rewritten (`public/js/pages/product.js`, `server/views/pages/product.html`): drag-to-turn 3D viewer,
  floating glass fact cards, per-colour gallery (Front/Back views), colour tiles with photos, size grid, key-facts row,
  accordions, category size guide (`sizeGuideFor` in `public/js/buy.js`), "Every colourway" / "Front and back" panel,
  related + recently viewed. Unknown or hidden handle -> server 404.
- Sticky buy bar: solid background, hidden while the main button or the footer is on screen.
- White studio backgrounds keyed out server-side: `GET /api/img?src=<shopify cdn url>&w=` (`server/lib/cutout.js`, sharp).
  Dark-background photos get a vignette mask on the client (`tagStageImages` in `public/js/media.js`).
- Colour -> image mapping: variant media, else image alt text starting with the colour, else file name
  (`colourImages` in `server/shopify/catalog.js`, client fallback in `public/js/media.js`).
- Marquee ("IT'S US / NO COPIES / SEWN BY HAND / 666") removed from layout + CSS. Hanger rail (`rail.js`) and old
  piece drawer removed. Home-only heartbeat/flicker overlays toned down off the home page.
- Admin: per-product "Show on site" switch (product list column + product editor) and a category override select.
  Stored as Shopify product tags: `eos-hidden`, `eos-kind:<kind>`. Endpoint `PATCH /api/admin/products/:id/site`
  `{ visible, kind }`. Storefront filters hidden products out of `catalog.allProducts()` (shop, collections, search,
  sitemap, related, product URL).

## Category map (`public/js/kind.js`)
kind -> display (base) -> page layout:
tee/hoodie/jacket/shirt -> hang -> apparel; pants/shorts -> flat -> bottoms; slide/sneaker -> plinth -> footwear;
hat/beanie -> plinth -> headwear; bag -> stand -> bag; chain/ring -> pedestal -> jewelry; sock/glove -> flat -> soft;
mask -> plinth -> soft; accessory -> pedestal -> accessory; default -> plinth -> accessory.
Detection order: admin override tag, then product type, then title/handle, then tags.
Idle animations per kind are CSS vars in `public/css/store.css` (`--idle`, keyframes swing, swingHeavy, flutter,
breathe, wave, step, turntable, squash, strap, dangle, ringTurn, floatY).

## Key files
- `public/css/store.css` grid, stages, bases, animations, drawer, product page, buy bar (loaded after main/fx css).
- `public/js/cards.js` card markup, swatches, `liveCards`. `public/js/viewer.js` drag-to-turn + `stageHtml`.
- `public/js/variants.js` option/variant selection. `public/js/media.js` stage images, colour matching, swatch colours.
- `server/routes/api.js` public API (+ `/api/img`). `server/routes/admin-api.js` admin API. `server/shopify/catalog.js`.
- `server/render.js` `VERSION` is the asset cache-buster (changes every deploy; suffix bumped to -g3).

## Env vars (set on Render, never commit values)
SHOPIFY_STORE_DOMAIN, SHOPIFY_API_VERSION (2026-10), SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET (server mints Admin
tokens), ADMIN_PASSWORD, SESSION_SECRET, WHATSAPP_NUMBER, CHECKOUT_MODE (draft_order | shopify), NODE_VERSION 22.
Note: the owner pasted the client secret in chat; rotating it in Shopify and updating Render is recommended.

## How to test
- `npm install && npm start` (port 3000; without Shopify env the catalogue is empty).
- Local preview with real products: a dev wrapper that proxies `GET /api/products*` to the live site and serves
  fixtures `/product/fixture-<kind>` for every kind was used (kept outside the repo, /workspace/eos-tools/devserver.js).
- Playwright (playwright-core + Chrome) at 390x844 with touch: shop, both product pages, drawer, variant switch,
  drag (check `[data-turn]` transform), sticky bar vs footer, and 360/430/1440 widths. All passed with no overlaps
  and no console errors before this commit.

## Remaining / ideas
- Admin toggle + category override are implemented but were not exercised against live Shopify (needs admin login);
  verify on /admin after deploy: toggle a product off, confirm /shop hides it and /product/<handle> 404s.
- Real cutout photos for new categories will look best; the server keys out white backgrounds automatically.
- Optional: per-category hover "action" animations on desktop, image zoom lens on product page.

## IMPORTANT: front-end bundle (added for iPhone)
The browser loads `public/js/app/main.js`, an esbuild bundle (target Safari/iOS 13, hashed chunks) of `public/js/*.js`.
After editing anything in `public/js/` (except `boot.js` and `vendor/`), run `npm run build:js` and commit `public/js/app/` with `git add -A` (new hashed chunk files must be added, `git commit -a` misses them and breaks the site).
`boot.js` (plain ES5) holds the safety net: it reports client errors to `POST /api/client-log` (visible in Render logs as
`[client] {...}`) and shows plain product cards only if the app script really fails (error / load failure, or 25s).

## Product taps (owner request t26u)
Tapping any product card (shop, collections, home, wishlist, related) opens the full page `/product/:handle`.
The small round button on cards is now an arrow link to the same page (no quick-view drawer from cards).
`public/js/quick.js` (drawer) is still bundled for any `[data-quick-view]` trigger; its link reads "Details →".
Mobile product page (<760px) is compacted so colour swatches, sizes, size guide and Add to bag sit above the fold
(stage ~30vh, breadcrumb/kicker hidden, swatches + sizes in one swipeable row, key facts moved below the buy row).
