'use strict';
// Storefront API, only used when CHECKOUT_MODE=shopify (real Shopify checkout).
const config = require('../config');
const { gql, checkUserErrors } = require('./client');
const { AppError } = require('../lib/errors');

const S = config.shopify;
let sfToken = S.storefrontToken || null;

async function storefrontToken() {
  if (sfToken) return sfToken;
  // Reuse an existing "EOS Site" token so restarts don't mint new ones.
  const d = await gql(`{ shop { storefrontAccessTokens(first: 50) { nodes { title accessToken } } } }`);
  const found = d.shop.storefrontAccessTokens.nodes.find((t) => t.title === 'EOS Site');
  if (found) { sfToken = found.accessToken; return sfToken; }
  const r = await gql(`mutation($input: StorefrontAccessTokenInput!){ storefrontAccessTokenCreate(input:$input){
    storefrontAccessToken{ accessToken } userErrors{ field message } } }`, { input: { title: 'EOS Site' } });
  checkUserErrors(r.storefrontAccessTokenCreate, 'Storefront token');
  sfToken = r.storefrontAccessTokenCreate.storefrontAccessToken.accessToken;
  return sfToken;
}

async function sfql(query, variables) {
  const res = await fetch(`https://${S.domain}/api/${S.apiVersion}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': await storefrontToken() },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json.errors && json.errors.length)) {
    throw new AppError('STOREFRONT_ERROR', `Shopify checkout is unavailable: ${(json.errors && json.errors[0] && json.errors[0].message) || res.status}`, 502);
  }
  return json.data;
}

/** cartCreate -> checkoutUrl. Lines are already validated by orders.resolveLines. */
async function createCheckout(lines, discountCode) {
  const d = await sfql(`mutation($input: CartInput!){ cartCreate(input:$input){ cart{ id checkoutUrl } userErrors{ field message } } }`, {
    input: {
      lines: lines.map((l) => ({ merchandiseId: l.variantId, quantity: l.quantity })),
      ...(discountCode ? { discountCodes: [discountCode] } : {}),
      buyerIdentity: { countryCode: 'NG' },
    },
  });
  const p = d.cartCreate;
  if (p.userErrors && p.userErrors.length) throw new AppError('CHECKOUT_ERROR', p.userErrors.map((e) => e.message).join('; '), 422);
  return p.cart.checkoutUrl;
}

module.exports = { createCheckout };
