// Shared buying helpers: size guide, WhatsApp order link, notify-me (sold out) form.
// Used by the product page and the shop quick view.
import { $, api, boot, esc, ngn, waLink, setBusy, notConfigured } from './core.js';

const S = () => boot.settings || {};

/** Size guide. Measurements come only from the admin (Shipping & payment > Size guide); never invented here. */
export function sizeGuideHtml() {
  const g = S().sizeGuide || { rows: [] };
  const sleeve = g.rows && g.rows.some((r) => r.sleeve);
  const table = g.rows && g.rows.length
    ? `<div class="sizeguide"><table><thead><tr><th scope="col">Size</th><th scope="col">Chest (${esc(g.unit)})</th><th scope="col">Length (${esc(g.unit)})</th>${sleeve ? `<th scope="col">Sleeve (${esc(g.unit)})</th>` : ''}</tr></thead><tbody>${g.rows.map((r) => `<tr><td>${esc(r.size)}</td><td>${esc(r.chest)}</td><td>${esc(r.length)}</td>${sleeve ? `<td>${esc(r.sleeve)}</td>` : ''}</tr>`).join('')}</tbody></table></div>`
    : `<p>Exact measurements for this piece are confirmed on WhatsApp. Send us your usual size and we will tell you which one to take.</p><a class="btn btn--blood" href="${waLink('Hi EOS, I need help with sizing.')}" target="_blank" rel="noopener"><svg class="btn__icon"><use href="#i-whatsapp"/></svg><span>Ask on WhatsApp</span></a>`;
  return `<h2 id="modal-title">Size guide</h2>${table}${g.note ? `<p class="sizeguide__note">${esc(g.note)}</p>` : ''}
    <div class="sizeguide__how"><p><b>Chest.</b> Lay a tee you love flat. Measure straight across, armpit to armpit.</p><p><b>Length.</b> From the highest point of the shoulder down to the hem.</p><p><b>Between sizes?</b> Size up for a heavier, oversized drop. Size down for a closer fit.</p></div>`;
}

/** Prefilled WhatsApp order message for a product (and the chosen variant, if any). */
export function waOrderHref(p, v, qty = 1) {
  const parts = [`Hi EOS, I want to order: ${p.title}`];
  if (v && v.title && v.title !== 'Default Title') parts.push(`Option: ${v.title}`);
  parts.push(`Quantity: ${qty}`);
  parts.push(`Price: ${ngn(v ? v.price : p.price)}${qty > 1 ? ' each' : ''}`);
  parts.push(`${location.origin}/product/${p.handle}`);
  return waLink(parts.join('\n'));
}

/** "Notify me" form for a sold-out piece or size. Saved as a tagged Shopify customer. */
export function notifyHtml(p, v) {
  const what = v && v.title && v.title !== 'Default Title' ? `${p.title}, ${v.title}` : p.title;
  return `<form class="notify" data-notify novalidate>
    <p class="notify__t">Sold out. Want to know the moment it returns?</p>
    <input type="hidden" name="handle" value="${esc(p.handle)}"><input type="hidden" name="variant" value="${esc(v ? v.title : '')}">
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="notify__row"><label class="sr" for="notify-${esc(p.handle)}">Email for ${esc(what)}</label><input id="notify-${esc(p.handle)}" name="email" type="email" inputmode="email" autocomplete="email" placeholder="Your email" maxlength="254" required><button class="btn btn--line" type="submit"><span>Notify me</span></button></div>
    <p class="form-msg" data-form-msg role="status"></p>
  </form>`;
}

let bound = false;
export function bindNotify() {
  if (bound) return; bound = true;
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-notify]'); if (!form) return;
    e.preventDefault();
    const msg = $('[data-form-msg]', form); const btn = $('button[type="submit"]', form);
    const email = form.email.value.trim();
    msg.className = 'form-msg';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'That email will not reach us.'; msg.classList.add('is-error'); form.email.focus(); return; }
    setBusy(btn, true);
    try {
      await api('/api/notify', { method: 'POST', body: { email, handle: form.handle.value, variant: form.variant.value, website: form.website.value } });
      msg.textContent = 'Noted. You will hear when it returns.'; msg.classList.add('is-ok'); form.email.value = '';
    } catch (err) {
      msg.textContent = notConfigured(err) ? 'Message us on WhatsApp and we will tell you when it returns.' : err.message;
      msg.classList.add('is-error');
    } finally { setBusy(btn, false); }
  });
}
