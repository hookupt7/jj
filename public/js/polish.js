/* EOS polish: menus never linger, scroll reveals, smart header, progress line, cursor light. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* A menu, cart or search never stays open behind the next page */
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    [['#mobile-menu', '[data-menu-close]'], ['#cart-drawer', '[data-cart-close]'], ['#search', '[data-search-close]']].forEach(([box, btn]) => {
      const el = $(box);
      if (el && a.closest(box)) { const b = $(btn, el); if (b) b.click(); }
    });
  }, true);
  /* Coming back with the browser's Back button starts from a clean page */
  window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

  if (reduced) return;

  /* Scroll reveals */
  if ('IntersectionObserver' in window) {
    const sel = '.section-head, .page-hero__text > *, .products-grid > *, .collection-card, .prose > *, .faq details, .contact > *, .site-footer__grid > *, .cult__copy > *';
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('eos-in'); io.unobserve(x.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    const tag = (root) => $$(sel, root).forEach((el) => {
      if (el.dataset.eos || el.closest('[data-reveal], .drawer, .mobile-menu, .search, .modal, .preloader')) return;
      el.dataset.eos = '1'; el.classList.add('eos-reveal');
      const i = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.style.setProperty('--eos-d', Math.min(i, 8) * 70 + 'ms');
      io.observe(el);
    });
    tag(document);
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.parentNode) tag(n.parentNode); })))
      .observe($('main') || document.body, { childList: true, subtree: true });
  }

  /* Header hides while reading down, returns on the way up; progress line on top */
  const hd = $('.site-header');
  const bar = document.createElement('div'); bar.id = 'eos-progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
  let last = scrollY, busy = false;
  addEventListener('scroll', () => {
    if (busy) return; busy = true;
    requestAnimationFrame(() => {
      const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      if (hd) {
        hd.classList.toggle('eos-solid', y > 40);
        if (y > last + 6 && y > 220 && !document.body.classList.contains('is-locked')) hd.classList.add('eos-hide');
        else if (y < last - 6 || y < 220) hd.classList.remove('eos-hide');
      }
      last = y; busy = false;
    });
  }, { passive: true });

  /* A faint red light follows the cursor on desktop */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const g = document.createElement('div'); g.id = 'eos-glow'; g.setAttribute('aria-hidden', 'true'); document.body.appendChild(g);
    let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty;
    addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; g.classList.add('on'); }, { passive: true });
    document.addEventListener('mouseleave', () => g.classList.remove('on'));
    (function loop() { x += (tx - x) * 0.12; y += (ty - y) * 0.12; g.style.transform = `translate(${x}px, ${y}px)`; requestAnimationFrame(loop); })();
  }
})();
