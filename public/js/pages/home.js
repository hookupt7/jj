// Home is one full screen: the original hero film, animated in place.
// No garments on this page.
import { $, reduced } from '../core.js';
import { embers, drips } from '../fx.js';

function splitTitle() {
  const title = $('.hero__title');
  if (!title) return;
  title.querySelectorAll('.hero__line > span').forEach((line, li) => {
    const text = line.textContent;
    line.textContent = '';
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'hero__letter' + (ch === ' ' ? ' hero__letter--space' : '');
      s.textContent = ch === ' ' ? '\u00a0' : ch;
      s.style.animationDelay = `${0.1 + li * 0.18 + i * 0.045}s`;
      if ((i + li * 3) % 8 === 4) s.classList.add('is-glitch');
      line.appendChild(s);
    });
  });
  title.classList.add('is-split');
}

export default function home() {
  document.documentElement.classList.add('is-home-fx');
  embers($('[data-embers]'));
  drips($('[data-drips]'));
  if (!reduced()) splitTitle();
}
