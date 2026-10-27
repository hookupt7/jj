'use strict';
const crypto = require('node:crypto');
const config = require('../config');
const { AppError, notConfigured } = require('../lib/errors');

const S = config.shopify;
let token = null;
let tokenExpiresAt = 0;
let tokenInflight = null;

// Client credentials grant: exchange the Dev Dashboard app's client ID + secret for
// an Admin API access token. Tokens live ~24h; we refresh 5 minutes early and on 401.
async function mintToken() {
  const res = await fetch(`https://${S.domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: S.clientId, client_secret: S.clientSecret }),
    signal: AbortSignal.timeout(15000),
  }).catch((e) => { throw new AppError('SHOPIFY_UNREACHABLE', `Could not reach Shopify: ${e.message}`, 502); });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 200);
    try { const j = JSON.parse(text); detail = j.error_description || j.error || j.errors || detail; } catch (_) {}
    throw new AppError('SHOPIFY_AUTH', `Shopify rejected the app credentials (${res.status}): ${detail}`, 502);
  }
  const json = JSON.parse(text);
  if (!json.access_token) throw new AppError('SHOPIFY_AUTH', 'Shopify returned no access token', 502);
  token = json.access_token;
  const ttl = Number(json.expires_in) > 0 ? Number(json.expires_in) : 86399;
  tokenExpiresAt = Date.now() + Math.max(60, ttl - 300) * 1000;
  return { token, scope: json.scope || '' };
}
let grantedScope = '';
async function getToken(force = false) {
  if (!S.configured) throw notConfigured();
  if (!force && token && Date.now() < tokenExpiresAt) return token;
  if (!tokenInflight) {
    tokenInflight = mintToken().then((r) => { grantedScope = r.scope; return r.token; }).finally(() => { tokenInflight = null; });
  }
  return tokenInflight;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run an Admin GraphQL operation.
 * opts.idempotent: when true a fresh idempotency key is passed as $idempotencyKey.
 */
async function gql(query, variables = {}, opts = {}) {
  if (!S.configured) throw notConfigured();
  const url = `https://${S.domain}/admin/api/${S.apiVersion}/graphql.json`;
  if (opts.idempotent) variables = { ...variables, idempotencyKey: crypto.randomUUID() };
  let attempt = 0;
  let refreshed = false;
  for (;;) {
    attempt += 1;
    const t = await getToken();
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Shopify-Access-Token': t },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(opts.timeout || 20000),
      });
    } catch (e) {
      if (attempt < 3) { await sleep(400 * attempt); continue; }
      throw new AppError('SHOPIFY_UNREACHABLE', `Could not reach Shopify: ${e.message}`, 502);
    }
    if (res.status === 401 && !refreshed) { refreshed = true; token = null; await getToken(true); continue; }
    if ((res.status === 429 || res.status >= 500) && attempt < 4) { await sleep(600 * attempt); continue; }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (_) { throw new AppError('SHOPIFY_BAD_RESPONSE', `Shopify returned ${res.status}`, 502); }
    if (!res.ok && !json.data) {
      const msg = typeof json.errors === 'string' ? json.errors : JSON.stringify(json.errors || json).slice(0, 300);
      throw new AppError(res.status === 403 ? 'SHOPIFY_FORBIDDEN' : 'SHOPIFY_HTTP', `Shopify ${res.status}: ${msg}`, 502);
    }
    if (json.errors && json.errors.length) {
      const throttled = json.errors.some((e) => e.extensions && e.extensions.code === 'THROTTLED');
      if (throttled && attempt < 4) { await sleep(1000 * attempt); continue; }
      const msg = json.errors.map((e) => e.message).join('; ');
      const denied = json.errors.some((e) => e.extensions && e.extensions.code === 'ACCESS_DENIED');
      throw new AppError(denied ? 'SHOPIFY_ACCESS_DENIED' : 'SHOPIFY_GRAPHQL', msg.slice(0, 500), 502);
    }
    return json.data;
  }
}

// Throw a 422 when a mutation payload has userErrors.
function checkUserErrors(payload, label = 'Shopify') {
  const errs = (payload && (payload.userErrors || payload.mediaUserErrors)) || [];
  if (errs.length) {
    const msg = errs.map((e) => (e.field ? `${[].concat(e.field).join('.')}: ` : '') + e.message).join('; ');
    throw new AppError('SHOPIFY_USER_ERROR', `${label}: ${msg}`, 422, { userErrors: errs });
  }
  return payload;
}

// Paginate a connection: fn(after) must return { nodes, pageInfo: { hasNextPage, endCursor } }.
async function paginate(fn, { maxPages = 20 } = {}) {
  const out = [];
  let after = null;
  for (let i = 0; i < maxPages; i++) {
    const conn = await fn(after);
    out.push(...conn.nodes);
    if (!conn.pageInfo || !conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return out;
}

const numericId = (gid) => String(gid || '').split('/').pop();
module.exports = { gql, checkUserErrors, paginate, numericId, getToken, scopes: () => grantedScope };
