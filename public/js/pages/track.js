import { $, api, esc, ngn, setBusy, notConfigured, waLink } from '../core.js';

export default function track() {
  const form = $('[data-track-form]'); const out = $('[data-track-result]');
  if (!form) return;
  const u = new URLSearchParams(location.search);
  if (u.get('o')) form.orderNumber.value = u.get('o');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('[data-form-msg]', form); const btn = $('button[type="submit"]', form);
    msg.className = 'form-msg'; msg.textContent = '';
    if (!form.orderNumber.value.trim() || !form.phone.value.trim()) { msg.textContent = 'Both fields, please.'; msg.classList.add('is-error'); return; }
    setBusy(btn, true);
    try {
      const { order: o } = await api('/api/orders/track', { method: 'POST', body: { orderNumber: form.orderNumber.value.trim(), phone: form.phone.value.trim() } });
      const keys = o.steps.map((s) => s.key);
      const at = keys.indexOf(o.status);
      out.innerHTML = `<div class="track__card">
        <p class="section-index"><span class="num">&#8224;</span><span>Order</span></p>
        <h2>${esc(o.orderNumber)}</h2>
        <p class="page-hero__meta">Placed ${new Date(o.placedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}${o.destination ? ` \u2014 to ${esc(o.destination)}` : ''}</p>
        <span class="track__status${o.status === 'cancelled' ? ' is-cancelled' : ''}">${esc(o.statusLabel)}</span>
        ${o.status === 'cancelled' ? '' : `<ol class="timeline">${o.steps.map((s, i) => `<li class="${i < at ? 'is-done' : i === at ? 'is-now' : ''}">${esc(s.label)}</li>`).join('')}</ol>`}
        <dl class="totals">${o.items.map((it) => `<div><dt>${it.quantity} \u00D7 ${esc(it.title)}${it.variant ? ` (${esc(it.variant)})` : ''}</dt><dd></dd></div>`).join('')}<div class="is-total"><dt>Total</dt><dd>${ngn(o.total)}</dd></div></dl>
        <a class="btn btn--blood" href="${waLink(`Hi EOS, checking on my order ${o.orderNumber}.`)}" target="_blank" rel="noopener"><svg class="btn__icon"><use href="#i-whatsapp"/></svg><span>Ask about this order</span></a>
      </div>`;
    } catch (err) {
      out.innerHTML = '';
      msg.textContent = notConfigured(err) ? 'Tracking opens with the first drop.' : err.message;
      msg.classList.add('is-error');
    } finally { setBusy(btn, false); }
  });
}
