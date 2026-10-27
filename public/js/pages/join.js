// Join the cult: newsletter form (handled globally by ui.newsletter) + the admin-driven "Next drop" countdown.
import { $, boot } from '../core.js';

export default function join() {
  const S = boot.settings || {};
  const sec = $('[data-drop]'); const d = S.drop || {};
  if (!sec || !d.enabled || !d.dateISO) return;
  const at = new Date(d.dateISO).getTime();
  if (!(at > Date.now())) return;
  $('[data-drop-title]', sec).textContent = d.title || 'The next drop';
  $('[data-drop-note]', sec).textContent = d.note || new Date(at).toLocaleString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }) + ' (WAT)';
  if (d.productHandle) $('[data-drop-link]', sec).href = `/product/${d.productHandle}`;
  const box = $('[data-countdown]', sec);
  const units = [['Days', 864e5], ['Hours', 36e5], ['Minutes', 6e4], ['Seconds', 1e3]];
  box.innerHTML = units.map(([l], i) => `${i ? '<span class="countdown__sep" aria-hidden="true">:</span>' : ''}<div class="countdown__u"><span class="countdown__n" data-u="${i}">00</span><span class="countdown__l">${l}</span></div>`).join('');
  const nums = box.querySelectorAll('[data-u]');
  let t = 0;
  const tick = () => {
    let left = Math.max(0, at - Date.now());
    units.forEach(([, ms], i) => { const v = Math.floor(left / ms); left -= v * ms; nums[i].textContent = String(v).padStart(2, '0'); });
    box.setAttribute('aria-label', `${nums[0].textContent} days ${nums[1].textContent} hours ${nums[2].textContent} minutes left`);
    if (at - Date.now() <= 0) { clearInterval(t); $('[data-drop-title]', sec).textContent = 'The drop is open'; }
  };
  t = setInterval(tick, 1000); tick();
  sec.hidden = false;
}
