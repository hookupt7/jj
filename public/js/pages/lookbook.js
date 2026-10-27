import { $, api, esc, imgUrl, srcset, notConfigured } from '../core.js';
import { summonState } from '../cards.js';
import { reveals } from '../fx.js';

const roman = (n) => { const m = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let out = ''; let x = n; if (x >= 40) return String(n); for (const [v, s] of m) while (x >= v) { out += s; x -= v; } return out; };

export default async function lookbook() {
  const root = $('[data-lookbook]'); if (!root) return;
  try {
    const r = await api('/api/lookbook');
    root.innerHTML = r.items.length ? r.items.map((f, i) => `
      <a class="look" href="/product/${esc(f.handle)}" data-reveal>
        <img src="${esc(imgUrl(f.src, 1100))}" srcset="${esc(srcset(f.src, [540, 720, 960, 1280, 1600]))}" sizes="(min-width:700px) 60vw, 100vw" alt="${esc(f.alt || f.title)}" ${f.w ? `width="${f.w}" height="${f.h}"` : ''} loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async">
        <span class="look__cap"><span class="look__n">${roman(i + 1)}</span><span class="look__t">${esc(f.title)}<small>${esc(f.type || 'EOS')}</small></span></span>
      </a>`).join('') : summonState({ title: 'The lookbook is being summoned', copy: 'Frames appear here as soon as the first pieces cross over.' });
  } catch (e) {
    root.innerHTML = notConfigured(e) ? summonState() : `<div class="empty"><h2>The realm is quiet</h2><p>${esc(e.message)}</p></div>`;
  }
  root.removeAttribute('aria-busy');
  reveals(root);
}
