'use strict';
const { gql, checkUserErrors, numericId } = require('./client');
const catalog = require('./catalog');
const { AppError } = require('../lib/errors');
const { zoneFor, ZONE_LABELS, byCode } = require('../lib/nigeria');

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
const STATUS_LABELS = { pending: 'Pending', confirmed: 'Confirmed / paid', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
const statusFromTags = (tags = []) => {
  const t = tags.find((x) => /^status:/i.test(x));
  const s = t && t.split(':')[1].toLowerCase();
  return STATUSES.includes(s) ? s : null;
};
const amount = (set) => (set && set.shopMoney ? Number(set.shopMoney.amount) : 0);

/** Re-price the cart against Shopify. Never trusts client prices. */
async function resolveLines(lines) {
  if (!Array.isArray(lines) || !lines.length) throw new AppError('EMPTY_CART', 'Your cart is empty.', 422);
  if (lines.length > 30) throw new AppError('VALIDATION', 'Too many items in one order.', 422);
  const all = await catalog.allProducts();
  const merged = new Map();
  for (const l of lines) {
    const id = String(l.variantId || '');
    const qty = Number(l.quantity);
    if (!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(id) || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      throw new AppError('VALIDATION', 'A cart item is invalid. Remove it and add it again.', 422);
    }
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  const out = [];
  for (const [variantId, quantity] of merged) {
    let product = null; let variant = null;
    for (const p of all) { const vr = p.variants.find((x) => x.id === variantId); if (vr) { product = p; variant = vr; break; } }
    if (!variant) throw new AppError('UNAVAILABLE', 'One of the pieces in your cart is no longer available.', 409, { variantId });
    const preorder = product.drop && product.drop.preorder;
    if (!variant.available && !preorder) throw new AppError('SOLD_OUT', `${product.title}${variant.title ? ` (${variant.title})` : ''} just sold out.`, 409, { variantId });
    if (variant.stock !== null && !preorder && quantity > variant.stock) {
      throw new AppError('LOW_STOCK', `Only ${variant.stock} left of ${product.title}${variant.title ? ` (${variant.title})` : ''}.`, 409, { variantId, stock: variant.stock });
    }
    out.push({
      variantId, quantity, price: variant.price, title: product.title, variantTitle: variant.title,
      handle: product.handle, image: product.images[0] ? product.images[0].src : null, preorder: Boolean(preorder),
    });
  }
  return out;
}

function shippingFor(settings, stateCode) {
  if (!stateCode) return { zone: null, fee: null, label: null };
  const zone = zoneFor(stateCode);
  const fee = settings.shipping[zone];
  return { zone, fee: fee === null || fee === undefined ? null : Number(fee), label: ZONE_LABELS[zone] };
}

function shippingLineInput(ship) {
  if (ship.fee === null) return undefined;
  return { title: `Delivery: ${ship.label}`, priceWithCurrency: { amount: ship.fee.toFixed(2), currencyCode: 'NGN' } };
}

/** Totals preview incl. discount code, via draftOrderCalculate. */
async function quote({ lines, discountCode, stateCode }, settings) {
  const resolved = await resolveLines(lines);
  const ship = shippingFor(settings, stateCode);
  const input = {
    lineItems: resolved.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    presentmentCurrencyCode: 'NGN',
    acceptAutomaticDiscounts: true,
    ...(discountCode ? { discountCodes: [discountCode] } : {}),
    ...(shippingLineInput(ship) ? { shippingLine: shippingLineInput(ship) } : {}),
  };
  const d = await gql(`mutation($input: DraftOrderInput!){ draftOrderCalculate(input:$input){
    calculatedDraftOrder{
      subtotalPriceSet{ shopMoney{ amount } } totalDiscountsSet{ shopMoney{ amount } }
      totalShippingPriceSet{ shopMoney{ amount } } totalPriceSet{ shopMoney{ amount } }
      discountCodes platformDiscounts{ title code totalAmount{ amount } }
      warnings{ message }
    }
    userErrors{ field message } } }`, { input });
  checkUserErrors(d.draftOrderCalculate, 'Totals');
  const c = d.draftOrderCalculate.calculatedDraftOrder;
  const discount = amount(c.totalDiscountsSet);
  const codeApplied = discountCode ? (c.platformDiscounts || []).some((x) => x.code && x.code.toLowerCase() === discountCode.toLowerCase()) || discount > 0 : false;
  return {
    lines: resolved,
    subtotal: amount(c.subtotalPriceSet) + discount,
    discount,
    discountCode: codeApplied ? discountCode : null,
    discountRejected: Boolean(discountCode && !codeApplied),
    discounts: (c.platformDiscounts || []).map((x) => ({ title: x.title, code: x.code, amount: Number(x.totalAmount && x.totalAmount.amount) || 0 })),
    shipping: ship.fee, shippingZone: ship.label,
    total: amount(c.totalPriceSet),
  };
}

async function findOrCreateCustomer({ firstName, lastName, email, phone }) {
  const q = await gql(`query($q:String!){ customers(first:1, query:$q){ nodes{ id } } }`, { q: `email:"${email.replace(/"/g, '')}"` });
  if (q.customers.nodes[0]) return q.customers.nodes[0].id;
  const create = async (input) => (await gql(`mutation($input: CustomerInput!){ customerCreate(input:$input){ customer{ id } userErrors{ field message } } }`, { input })).customerCreate;
  let r = await create({ firstName, lastName, email, phone, tags: ['eos-site'] });
  if (r.userErrors.length && r.userErrors.some((e) => /phone/i.test([].concat(e.field || []).join() + e.message))) {
    r = await create({ firstName, lastName, email, tags: ['eos-site'], note: `Phone: ${phone}` });
  }
  checkUserErrors(r, 'Customer');
  return r.customer.id;
}

const splitName = (full) => {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0], lastName: parts.length > 1 ? parts[parts.length - 1] : '' };
};

/** Create the Draft Order that the owner confirms on WhatsApp. */
async function createDraftOrder(form, settings) {
  const resolved = await resolveLines(form.lines);
  const state = byCode(form.stateCode);
  if (!state) throw new AppError('VALIDATION', 'Choose your state.', 422, { field: 'state' });
  const ship = shippingFor(settings, form.stateCode);
  const { firstName, lastName } = splitName(form.fullName);
  const customerId = await findOrCreateCustomer({ firstName, lastName, email: form.email, phone: form.phone });
  const address = {
    firstName, lastName, address1: form.address, city: form.city, provinceCode: state.code, countryCode: 'NG', phone: form.phone,
  };
  const noteLines = [
    form.note ? `Customer note: ${form.note}` : null,
    ship.fee === null ? `Delivery fee (${ship.label}) to be confirmed on WhatsApp.` : null,
    resolved.some((l) => l.preorder) ? 'Contains pre-order pieces.' : null,
    'Placed on the EOS site. Payment confirmed on WhatsApp.',
  ].filter(Boolean);
  const input = {
    purchasingEntity: { customerId },
    email: form.email,
    phone: form.phone,
    note: noteLines.join('\n'),
    tags: ['eos-site', 'status:pending'],
    lineItems: resolved.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    shippingAddress: address,
    billingAddress: address,
    presentmentCurrencyCode: 'NGN',
    acceptAutomaticDiscounts: true,
    customAttributes: [{ key: 'Source', value: 'EOS site' }, { key: 'Delivery zone', value: ship.label }],
    ...(form.discountCode ? { discountCodes: [form.discountCode] } : {}),
    ...(shippingLineInput(ship) ? { shippingLine: shippingLineInput(ship) } : {}),
  };
  const d = await gql(`mutation($input: DraftOrderInput!){ draftOrderCreate(input:$input){
    draftOrder{ id name createdAt
      subtotalPriceSet{ shopMoney{ amount } } totalDiscountsSet{ shopMoney{ amount } }
      totalShippingPriceSet{ shopMoney{ amount } } totalPriceSet{ shopMoney{ amount } }
      discountCodes
      lineItems(first:50){ nodes{ title variantTitle quantity originalUnitPriceSet{ shopMoney{ amount } } } }
    }
    userErrors{ field message } } }`, { input });
  checkUserErrors(d.draftOrderCreate, 'Order');
  const o = d.draftOrderCreate.draftOrder;
  const ref = o.name.replace('#', '');
  // Searchable reference tag (draft order queries can't filter by name).
  await gql(`mutation($id:ID!,$tags:[String!]!){ tagsAdd(id:$id, tags:$tags){ userErrors{ message } } }`, { id: o.id, tags: [`order-${ref}`] }).catch(() => {});
  const discount = amount(o.totalDiscountsSet);
  return {
    orderNumber: o.name,
    createdAt: o.createdAt,
    items: o.lineItems.nodes.map((li) => ({ title: li.title, variant: li.variantTitle || '', quantity: li.quantity, price: amount(li.originalUnitPriceSet) })),
    subtotal: amount(o.subtotalPriceSet) + discount,
    discount,
    discountCode: (o.discountCodes || [])[0] || null,
    shipping: ship.fee,
    shippingZone: ship.label,
    total: amount(o.totalPriceSet),
    customer: { name: form.fullName, city: form.city, state: state.name },
  };
}

const ORDER_FIELDS = `id name createdAt tags displayFinancialStatus displayFulfillmentStatus cancelledAt phone email
  totalPriceSet{ shopMoney{ amount } } shippingAddress{ city province phone }
  lineItems(first:30){ nodes{ title variantTitle quantity } }`;
const DRAFT_FIELDS = `id name createdAt tags status phone email totalPriceSet{ shopMoney{ amount } }
  shippingAddress{ city province phone }
  lineItems(first:30){ nodes{ title variantTitle quantity } }
  order{ ${ORDER_FIELDS} }`;

const last9 = (p) => String(p || '').replace(/\D/g, '').slice(-9);

/** Public order lookup: order number + phone must match. Returns no personal data beyond city/state. */
async function track(orderNumber, phone) {
  const ref = orderNumber.replace(/^#/, '').toUpperCase();
  if (!/^[A-Z]{0,2}\d{1,10}$/.test(ref)) throw new AppError('VALIDATION', 'Enter the order number from your confirmation, e.g. #D12.', 422);
  let rec = null;
  const drafts = await gql(`query($q:String!){ draftOrders(first:3, query:$q){ nodes{ ${DRAFT_FIELDS} } } }`, { q: `tag:"order-${ref}"` });
  const draft = drafts.draftOrders.nodes.find((x) => x.name.replace('#', '').toUpperCase() === ref);
  if (draft) rec = draft.order ? { ...draft.order, draftName: draft.name, kind: 'order' } : { ...draft, kind: 'draft' };
  if (!rec) {
    const ords = await gql(`query($q:String!){ orders(first:3, query:$q){ nodes{ ${ORDER_FIELDS} } } }`, { q: `name:"#${ref}" OR tag:"order-${ref}"` });
    const o = ords.orders.nodes[0];
    if (o) rec = { ...o, kind: 'order' };
  }
  const phones = rec ? [rec.phone, rec.shippingAddress && rec.shippingAddress.phone].map(last9).filter(Boolean) : [];
  if (!rec || !phones.includes(last9(phone))) {
    throw new AppError('NOT_FOUND', 'No order matches that number and phone. Check both, or message us on WhatsApp.', 404);
  }
  let status = statusFromTags(rec.tags);
  if (!status) {
    if (rec.cancelledAt) status = 'cancelled';
    else if (rec.kind === 'order') status = rec.displayFulfillmentStatus === 'FULFILLED' ? 'shipped' : (rec.displayFinancialStatus === 'PAID' ? 'confirmed' : 'pending');
    else status = 'pending';
  }
  return {
    orderNumber: rec.draftName || rec.name,
    placedAt: rec.createdAt,
    status, statusLabel: STATUS_LABELS[status],
    steps: STATUSES.filter((s) => s !== 'cancelled').map((s) => ({ key: s, label: STATUS_LABELS[s] })),
    total: amount(rec.totalPriceSet),
    items: rec.lineItems.nodes.map((li) => ({ title: li.title, variant: li.variantTitle || '', quantity: li.quantity })),
    destination: rec.shippingAddress ? [rec.shippingAddress.city, rec.shippingAddress.province].filter(Boolean).join(', ') : '',
  };
}

module.exports = { quote, createDraftOrder, track, resolveLines, STATUSES, STATUS_LABELS, statusFromTags, amount, numericId };
