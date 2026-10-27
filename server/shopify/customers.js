'use strict';
const { gql, checkUserErrors } = require('./client');

/** Newsletter: save the email as a Shopify customer with email marketing consent. */
async function subscribe(email, source = 'newsletter') {
  const consent = { marketingState: 'SUBSCRIBED', marketingOptInLevel: 'SINGLE_OPT_IN', consentUpdatedAt: new Date().toISOString() };
  const q = await gql(`query($q:String!){ customers(first:1, query:$q){ nodes{ id tags emailMarketingConsent{ marketingState } } } }`,
    { q: `email:"${email.replace(/"/g, '')}"` });
  const existing = q.customers.nodes[0];
  if (existing) {
    if (existing.emailMarketingConsent && existing.emailMarketingConsent.marketingState === 'SUBSCRIBED') return { already: true };
    const r = await gql(`mutation($input: CustomerEmailMarketingConsentUpdateInput!){ customerEmailMarketingConsentUpdate(input:$input){
      customer{ id } userErrors{ field message } } }`, { input: { customerId: existing.id, emailMarketingConsent: consent } });
    checkUserErrors(r.customerEmailMarketingConsentUpdate, 'Subscribe');
    await gql(`mutation($id:ID!,$t:[String!]!){ tagsAdd(id:$id, tags:$t){ userErrors{ message } } }`, { id: existing.id, t: ['newsletter', 'cult'] }).catch(() => {});
    return { already: false };
  }
  const r = await gql(`mutation($input: CustomerInput!){ customerCreate(input:$input){ customer{ id } userErrors{ field message } } }`, {
    input: { email, emailMarketingConsent: consent, tags: ['newsletter', 'cult', `source:${source}`] },
  });
  checkUserErrors(r.customerCreate, 'Subscribe');
  return { already: false };
}

/** Notify me: a sold-out piece. Stored as a Shopify customer tagged notify-me + notify:<handle> (no marketing consent implied). */
async function notify(email, handle, variant = '') {
  const tags = ['notify-me', `notify:${handle}`.slice(0, 250)];
  const q = await gql(`query($q:String!){ customers(first:1, query:$q){ nodes{ id } } }`, { q: `email:"${email.replace(/"/g, '')}"` });
  const existing = q.customers.nodes[0];
  if (existing) {
    const r = await gql(`mutation($id:ID!,$t:[String!]!){ tagsAdd(id:$id, tags:$t){ userErrors{ message } } }`, { id: existing.id, t: tags });
    checkUserErrors(r.tagsAdd, 'Notify me');
    return { ok: true };
  }
  const r = await gql(`mutation($input: CustomerInput!){ customerCreate(input:$input){ customer{ id } userErrors{ field message } } }`, {
    input: { email, tags, note: `Asked to be notified when ${handle}${variant ? ` (${variant})` : ''} is back.`.slice(0, 500) },
  });
  checkUserErrors(r.customerCreate, 'Notify me');
  return { ok: true };
}

module.exports = { subscribe, notify };
