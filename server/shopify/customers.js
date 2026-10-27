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

module.exports = { subscribe };
