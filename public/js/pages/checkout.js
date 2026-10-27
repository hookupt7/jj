import { $, $$, api, boot, esc, ngn, setBusy, notConfigured, debounce } from '../core.js';
import { cart, lineItemHtml, goCheckout } from '../cart.js';

const S = boot.settings || {};
const zoneOf = (code) => (code === 'LA' ? 'lagos' : ['OG', 'OY', 'OS', 'ON', 'EK'].includes(code) ? 'southWest' : 'other');

export default function checkout() {
  const root = $('[data-checkout]'); if (!root) return;
  if (!cart.lines.length) {
    root.querySelector('.checkout__grid').innerHTML = '<div class="empty"><h2>Your cart is empty</h2><p>The pact needs an offering. Choose your pieces first.</p><a class="btn btn--ghost" href="/shop"><span>Enter the shop</span><svg class="btn__arrow"><use href="#i-arrow"/></svg></a></div>';
    return;
  }
  if (boot.checkoutMode === 'shopify') { goCheckout(); return; }

  const form = $('[data-checkout-form]', root); const msg = $('[data-form-msg]', form);
  const codeForm = $('[data-code-form]', root); const codeMsg = $('[data-code-msg]', root);
  const totals = $('[data-summary-totals]', root);
  let code = ''; let quoteCtrl = null;

  $('[data-states]', form).insertAdjacentHTML('beforeend', boot.states.map((s) => `<option value="${s.code}">${esc(s.name)}</option>`).join(''));
  $('[data-payment-text]', form).textContent = (S.payment && S.payment.instructions) || '';
  $('[data-summary-items]', root).innerHTML = cart.lines.map((l) => lineItemHtml(l, { editable: false })).join('');

  const localTotals = () => {
    const st = form.stateCode.value;
    const fee = st ? (S.shipping || {})[zoneOf(st)] : null;
    return { subtotal: cart.subtotal(), discount: 0, shipping: fee ?? null, shippingZone: st ? ({ lagos: 'Lagos', southWest: 'South West', other: 'Other states' })[zoneOf(st)] : null, total: cart.subtotal() + (fee || 0) };
  };
  const renderTotals = (q) => {
    const ship = q.shipping === null || q.shipping === undefined
      ? `<div class="is-muted"><dt>Delivery${q.shippingZone ? ` (${esc(q.shippingZone)})` : ''}</dt><dd>${form.stateCode.value ? 'Delivery fee confirmed on WhatsApp' : 'Choose your state'}</dd></div>`
      : `<div><dt>Delivery (${esc(q.shippingZone)})</dt><dd>${ngn(q.shipping)}</dd></div>`;
    totals.innerHTML = `<div><dt>Subtotal</dt><dd>${ngn(q.subtotal)}</dd></div>
      ${q.discount ? `<div><dt>Discount${q.discountCode ? ` (${esc(q.discountCode)})` : ''}</dt><dd>-${ngn(q.discount)}</dd></div>` : ''}
      ${ship}<div class="is-total"><dt>Total</dt><dd>${ngn(q.total)}${q.shipping === null || q.shipping === undefined ? ' <small>+ delivery</small>' : ''}</dd></div>`;
  };
  const quote = async () => {
    renderTotals(localTotals());
    if (!boot.shopifyConfigured) return;
    if (quoteCtrl) quoteCtrl.abort(); quoteCtrl = new AbortController();
    try {
      const q = await api('/api/checkout/quote', { method: 'POST', signal: quoteCtrl.signal, body: { lines: cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), discountCode: code || undefined, stateCode: form.stateCode.value || undefined } });
      renderTotals(q);
      if (code) {
        codeMsg.className = `form-msg ${q.discountRejected ? 'is-error' : 'is-ok'}`;
        codeMsg.textContent = q.discountRejected ? 'That code does not apply to this order.' : `${code} applied.`;
        if (q.discountRejected) code = '';
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (code) { codeMsg.className = 'form-msg is-error'; codeMsg.textContent = notConfigured(e) ? 'Codes open with the first drop.' : e.message; code = ''; }
      if (e.status === 409) { msg.className = 'form-msg is-error'; msg.textContent = e.message; }
    }
  };
  const quoteSoon = debounce(quote, 250);
  form.stateCode.addEventListener('change', quoteSoon);
  codeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = codeForm.code.value.trim().toUpperCase();
    if (!v) { code = ''; codeMsg.textContent = ''; quote(); return; }
    if (!/^[A-Z0-9_-]+$/.test(v)) { codeMsg.className = 'form-msg is-error'; codeMsg.textContent = 'Codes use letters and numbers only.'; return; }
    code = v; codeMsg.className = 'form-msg'; codeMsg.textContent = 'Checking\u2026'; quote();
  });
  quote();

  const validators = {
    fullName: (v) => (v.trim().split(/\s+/).length >= 2 && v.trim().length >= 3 ? '' : 'Your first and last name'),
    phone: (v) => (/^(\+?234|0)?[789]\d{9}$/.test(v.replace(/[\s()-]/g, '')) ? '' : 'A Nigerian number, e.g. 0803 000 0000'),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'A valid email address'),
    stateCode: (v) => (v ? '' : 'Choose your state'),
    city: (v) => (v.trim() ? '' : 'Your city or town'),
    address: (v) => (v.trim().length >= 6 ? '' : 'Your full street address'),
  };
  const check = (name) => {
    const el = form.elements[name]; const field = el.closest('.field');
    const err = validators[name](el.value);
    field.classList.toggle('is-invalid', Boolean(err));
    let note = $('.field__err', field);
    if (err && !note) { note = document.createElement('span'); note.className = 'field__err'; field.appendChild(note); }
    if (note) note.textContent = err;
    el.setAttribute('aria-invalid', String(Boolean(err)));
    return !err;
  };
  Object.keys(validators).forEach((n) => form.elements[n].addEventListener('blur', () => { if (form.elements[n].value) check(n); }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'form-msg'; msg.textContent = '';
    const bad = Object.keys(validators).filter((n) => !check(n));
    if (bad.length) { form.elements[bad[0]].focus(); msg.className = 'form-msg is-error'; msg.textContent = 'A few details are missing.'; return; }
    const btn = $('[data-place-order]', form); setBusy(btn, true);
    try {
      const fd = Object.fromEntries(new FormData(form));
      const r = await api('/api/checkout', { method: 'POST', body: { ...fd, discountCode: code || undefined, lines: cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) } });
      sessionStorage.setItem('eos:lastOrder', JSON.stringify(r.order));
      cart.clear();
      location.href = `/order/success?o=${encodeURIComponent(r.order.orderNumber.replace('#', ''))}`;
    } catch (err) {
      msg.className = 'form-msg is-error';
      msg.textContent = notConfigured(err) ? 'Orders open with the first drop. Message us on WhatsApp in the meantime.' : err.message;
      if (err.details && err.details.field && form.elements[err.details.field]) form.elements[err.details.field].focus();
      setBusy(btn, false);
    }
  });
  $$('input, select, textarea', form).forEach((el) => el.addEventListener('input', () => { el.closest('.field') && el.closest('.field').classList.remove('is-invalid'); }));
}
