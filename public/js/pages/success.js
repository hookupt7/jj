import { $, esc, ngn, waLink, boot } from '../core.js';

export function whatsappMessage(o) {
  const lines = [
    `Hi EOS, I just placed order ${o.orderNumber}.`,
    '',
    ...o.items.map((it) => `- ${it.quantity} x ${it.title}${it.variant ? ` (${it.variant})` : ''}: ${ngn(it.price * it.quantity)}`),
    '',
    `Subtotal: ${ngn(o.subtotal)}`,
    o.discount ? `Discount${o.discountCode ? ` (${o.discountCode})` : ''}: -${ngn(o.discount)}` : null,
    `Delivery (${o.shippingZone || 'my state'}): ${o.shipping === null || o.shipping === undefined ? 'to confirm' : ngn(o.shipping)}`,
    `Total: ${ngn(o.total)}${o.shipping === null || o.shipping === undefined ? ' + delivery' : ''}`,
    '',
    `Name: ${o.customer.name}`,
    `Delivery to: ${o.customer.city}, ${o.customer.state}`,
    '',
    'Please send payment details to confirm.',
  ].filter((x) => x !== null);
  return lines.join('\n');
}

export default function success() {
  const body = $('[data-success-body]');
  let o = null;
  try { o = JSON.parse(sessionStorage.getItem('eos:lastOrder') || 'null'); } catch (_) { /* ignore */ }
  const want = new URLSearchParams(location.search).get('o');
  if (!o || (want && o.orderNumber.replace('#', '') !== want.replace('#', ''))) {
    body.innerHTML = `<p>${want ? `Your order <strong>#${esc(want.replace('#', ''))}</strong> is with us.` : 'Your order is with us.'} Message us on WhatsApp to confirm payment and delivery.</p>
      <div class="success__actions"><a class="btn btn--blood" href="${waLink(`Hi EOS, I placed order ${want ? `#${want.replace('#', '')}` : ''} on the site.`)}" target="_blank" rel="noopener"><svg class="btn__icon"><use href="#i-whatsapp"/></svg><span>Confirm on WhatsApp</span></a><a class="link-arrow" href="/track">Track an order <svg><use href="#i-arrow"/></svg></a></div>`;
    return;
  }
  const pay = (boot.settings.payment && boot.settings.payment.instructions) || '';
  body.innerHTML = `
    <div class="order-no"><span>Order</span><strong>${esc(o.orderNumber)}</strong></div>
    <p class="lede">Thank you, ${esc(o.customer.name.split(' ')[0])}. Your pieces are held for you.</p>
    <p>${esc(pay)}</p>
    <ol class="success__steps">
      <li><span>Tap <strong>Confirm on WhatsApp</strong>. Your order details are already written for you.</span></li>
      <li><span>We reply with payment details${o.shipping === null || o.shipping === undefined ? ' and your delivery fee' : ''}.</span></li>
      <li><span>Once payment is confirmed, your order is packed and sent to ${esc(o.customer.city)}, ${esc(o.customer.state)}.</span></li>
    </ol>
    <dl class="totals">
      ${o.items.map((it) => `<div><dt>${it.quantity} \u00D7 ${esc(it.title)}${it.variant ? ` (${esc(it.variant)})` : ''}</dt><dd>${ngn(it.price * it.quantity)}</dd></div>`).join('')}
      ${o.discount ? `<div><dt>Discount${o.discountCode ? ` (${esc(o.discountCode)})` : ''}</dt><dd>-${ngn(o.discount)}</dd></div>` : ''}
      <div class="${o.shipping === null || o.shipping === undefined ? 'is-muted' : ''}"><dt>Delivery</dt><dd>${o.shipping === null || o.shipping === undefined ? 'Delivery fee confirmed on WhatsApp' : ngn(o.shipping)}</dd></div>
      <div class="is-total"><dt>Total</dt><dd>${ngn(o.total)}</dd></div>
    </dl>
    <div class="success__actions">
      <a class="btn btn--blood" href="${waLink(whatsappMessage(o))}" target="_blank" rel="noopener"><svg class="btn__icon"><use href="#i-whatsapp"/></svg><span>Confirm on WhatsApp</span></a>
      <a class="link-arrow" href="/track?o=${encodeURIComponent(o.orderNumber.replace('#', ''))}">Track this order <svg><use href="#i-arrow"/></svg></a>
    </div>`;
}
