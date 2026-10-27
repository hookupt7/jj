# EOS / Enemy of Swag

Storefront and admin for **EOS (Enemy of Swag)**, a Nigerian streetwear brand.

- **Frontend:** plain JavaScript (ES modules) + hand-written CSS. No framework, no UI kit.
- **Backend:** Node.js + Express. Three dependencies: `express`, `compression`, `multer`.
- **Data:** Shopify is the source of truth for products, prices, images, collections, inventory, discounts, customers and orders, through the **Shopify Admin GraphQL API**, server side only. The access token never reaches the browser.
- **Settings:** site settings (announcement bar, homepage, delivery fees, payment copy, size guide, SEO, maintenance mode) are stored **in Shopify** as a metaobject, so the app needs no database or disk (Render free tier friendly).
- **Checkout:** cart → checkout form → Shopify **Draft Order** → success page → "Confirm on WhatsApp". One env var switches to real Shopify checkout later.

---

## 1. Run locally

Requires Node 20.12+ (22 recommended).

```bash
cp .env.example .env      # then fill in the values
npm install
npm start                 # http://localhost:3000   (admin: http://localhost:3000/admin)
```

Without Shopify credentials the site still runs: the shop shows "The first drop is being summoned", and every API route answers with a clean `503 SHOPIFY_NOT_CONFIGURED` JSON error. Without `ADMIN_PASSWORD` + `SESSION_SECRET` the admin stays locked.

## 2. Environment variables

| Variable | Required | What it is |
|---|---|---|
| `SHOPIFY_STORE_DOMAIN` | yes | `d5gdhb-up.myshopify.com` |
| `SHOPIFY_CLIENT_ID` | yes | Client ID of the Dev Dashboard app **EOS Site** |
| `SHOPIFY_CLIENT_SECRET` | yes | Client secret of that app |
| `SHOPIFY_API_VERSION` | yes | `2026-10` (default if unset) |
| `ADMIN_PASSWORD` | yes | Password for `/admin`. Long and unique. Changing it signs out every admin session. |
| `SESSION_SECRET` | yes | Random string, 32+ characters, signs the admin cookie. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `WHATSAPP_NUMBER` | yes | `2349122318512` (digits only) |
| `CHECKOUT_MODE` | no | `draft_order` (default) or `shopify` |
| `SHOPIFY_STOREFRONT_TOKEN` | no | Only for `CHECKOUT_MODE=shopify`. If empty, the server creates/reuses one called "EOS Site" via `storefrontAccessTokenCreate`. |
| `PUBLIC_URL` | no | e.g. `https://eos.onrender.com`, used for canonical URLs and the sitemap |

**Never commit `.env`.** It is in `.gitignore`.

### How Shopify auth works

The store's app was created in the Shopify **Dev Dashboard**, which issues a client ID + secret rather than a static Admin token. The server uses the **client credentials grant**:

```
POST https://{SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token
Content-Type: application/x-www-form-urlencoded
grant_type=client_credentials&client_id=...&client_secret=...
```

The returned token (about 24 h) is cached in memory, refreshed 5 minutes before `expires_in` runs out, and refreshed immediately on any `401`. See `server/shopify/client.js`.

Scopes the app needs (already granted): products, product_listings, inventory, discounts, price_rules, orders, draft_orders, customers, files, online_store_pages, metaobjects, metaobject_definitions (read + write), plus Storefront `unauthenticated_read_product_listings` and `unauthenticated_read_checkouts`.

On first use the server creates two metaobject definitions in Shopify: `eos_site_settings` (one entry, handle `site`, a JSON field) and `eos_activity` (the admin activity log).

## 3. Deploy on Render (free)

1. Push this folder to a **public GitHub repo** (secrets live only in Render, never in the repo).
2. Render → **New** → **Blueprint** → pick the repo. `render.yaml` creates a Node web service (`npm install` / `npm start`, health check `/healthz`).
3. Fill in the env vars marked `sync: false` (`SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_API_VERSION=2026-10`, `ADMIN_PASSWORD`, `SESSION_SECRET`). `WHATSAPP_NUMBER` and `CHECKOUT_MODE` are prefilled.
4. Deploy. Open `/admin`, sign in, check **Account** shows "Connected".

Free instances sleep after ~15 minutes idle; the first visit after that takes a few seconds to wake. In-memory caches and the login rate limiter reset on each wake, which is fine. Nothing is lost because nothing is stored on the server.

## 4. Owner workflow

1. **Products** → Add product: title, description, type, tags, sizes (S–XXL, plus custom), colours, price / compare-at / stock per variant, collections, status. Upload images (drag to reorder, first is the cover).
2. **Shipping & payment** → set delivery fees for Lagos, South West and other states (leave empty to say "Delivery fee confirmed on WhatsApp"), edit payment instructions, returns policy, size guide.
3. **Homepage & banner** → hero text, which sections show, featured pieces, the "Next drop" countdown, the announcement bar.
4. A customer orders → it appears in **Orders** as a draft order with status *Pending*. Confirm payment on WhatsApp → **Mark as paid** (completes the draft, creates a real paid order, deducts stock) → move it through *Processing → Shipped → Delivered*. The customer can follow it on `/track` with their order number + phone.

## 5. Switching to real Shopify checkout later

Once a payment gateway (e.g. Paystack) is set up in Shopify:

1. In Shopify, make sure products are available to the **EOS Site** app's sales channel (Storefront API only sees products published to it).
2. Set `CHECKOUT_MODE=shopify` on Render and redeploy.

The cart then calls `POST /api/checkout/shopify` → Storefront API `cartCreate` → redirect to Shopify's `checkoutUrl`. Nothing else changes. The code lives in `server/shopify/storefront.js` and `public/js/cart.js` (`goCheckout`).

## 6. Project structure

```
server/
  index.js            Express app: headers, static files, routes, maintenance mode, 404/errors
  config.js           Env vars and flags (CHECKOUT_MODE etc.)
  settings.js         Site settings stored in a Shopify metaobject (defaults, validation, cache)
  render.js           Tiny HTML template renderer + SEO meta
  activity.js         Admin activity log (Shopify metaobject entries)
  lib/                cache, errors, validation, rate limiting, security headers, session cookie, html sanitiser, Nigerian states/zones
  shopify/            client (client-credentials token + GraphQL), catalog, orders/draft orders, customers, admin ops, metaobjects, storefront (cartCreate)
  routes/             api.js (public), admin-api.js (protected), pages.js (HTML pages, sitemap, robots)
  views/              layout.html, pages/*.html, svg.js (hand-drawn sigils, mandala, horns)
public/
  css/                fonts.css (self-hosted, OFL), main.css
  js/                 boot.js (pre-paint flags), main.js, core, fx (motion), cart, cards, ui, pages/*
  fonts/ img/ media/  self-hosted fonts, sigil + icons, the hero film
admin/                index.html + assets/admin.css + assets/admin.js (vanilla SPA)
render.yaml, .env.example, package.json
```

## 7. Security notes

- Admin: password login (timing-safe compare), 5 attempts / 15 min per IP, signed `HttpOnly; SameSite=Strict; Secure` session cookie (12 h), every `/api/admin/*` route protected, writes also require a same-origin `X-EOS-Admin` header.
- CSP with no inline scripts, `frame-ancestors 'none'`, nosniff, strict referrer, HSTS in production.
- All input validated server side; prices and stock are re-read from Shopify on every quote and order; HTML from Shopify descriptions is sanitised; CSV exports are guarded against formula injection.
- Public form endpoints are rate limited and have a honeypot field.

## 8. Fonts

Archivo, Cinzel, Cormorant Garamond and UnifrakturCook are self-hosted under the SIL Open Font License (license files in `public/fonts/`).
