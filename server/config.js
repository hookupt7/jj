'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Load .env for local development only. Real environment variables win.
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envFile); } catch (_) { /* ignore malformed .env */ }
}

const env = process.env;
const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const domain = clean(env.SHOPIFY_STORE_DOMAIN).replace(/^https?:\/\//, '').replace(/\/.*$/, '');

const config = {
  isProd: env.NODE_ENV === 'production',
  port: Number(env.PORT) || 3000,
  publicUrl: clean(env.PUBLIC_URL).replace(/\/$/, ''),

  shopify: {
    domain,
    clientId: clean(env.SHOPIFY_CLIENT_ID),
    clientSecret: clean(env.SHOPIFY_CLIENT_SECRET),
    apiVersion: clean(env.SHOPIFY_API_VERSION) || '2026-10',
    storefrontToken: clean(env.SHOPIFY_STOREFRONT_TOKEN),
    currency: 'NGN',
  },

  // Single switch between the WhatsApp/draft-order flow and real Shopify checkout.
  // draft_order: cart -> our checkout form -> Draft Order -> WhatsApp confirmation
  // shopify:     cart -> Storefront API cartCreate -> redirect to cart.checkoutUrl
  checkoutMode: clean(env.CHECKOUT_MODE) === 'shopify' ? 'shopify' : 'draft_order',

  admin: {
    password: env.ADMIN_PASSWORD || '',
    sessionSecret: env.SESSION_SECRET || '',
    sessionHours: 12,
  },

  catalogCacheSeconds: 60,
  settingsCacheSeconds: 60,

  contact: {
    whatsapp: clean(env.WHATSAPP_NUMBER).replace(/\D/g, '') || '2349122318512',
    phoneDisplay: '0912 231 8512',
    phoneTel: '+2349122318512',
    email: 'olaonijoshua@gmail.com',
    tiktok: 'https://www.tiktok.com/@_enemyofswag_',
    tiktokHandle: '@_enemyofswag_',
  },
};

config.shopify.configured = Boolean(
  config.shopify.domain && config.shopify.clientId && config.shopify.clientSecret
);
config.admin.configured = Boolean(config.admin.password && config.admin.sessionSecret.length >= 16);

module.exports = config;
