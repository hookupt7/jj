/* ==========================================================================
   EOS / refine.js — finishing layer.
   Loaded last, after polish.js. Self-contained, no dependencies.
   Every effect is gated on prefers-reduced-motion and safe to fail: if any
   piece throws, the rest of the page keeps working.
   ========================================================================== */
(() => {
  'use strict';

  const reduce = (() => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
  })();
  const canHover = (() => {
    try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (_) { return false; }
  })();
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;

  /* Run each piece in isolation so one failure never takes down the others. */
  const safe = (name, fn) => { try { fn(); } catch (e) { /* refine: <name> skipped */ } };

  /* ------------------------------------------------------------------ 1. hero
     Split the headline into per-letter masks. main.css owns the fallback
     (a single line rise); once `has-split` is set, refine.css takes over. */
  function splitHero() {
    if (reduce) return;
    const title = $('.hero__title');
    if (!title || title.dataset.rfSplit) return;

    let n = 0;
    $$('.hero__line', title).forEach((line, li) => {
      const inner = line.firstElementChild || line;
      const text = inner.textContent;
      if (!text || !text.trim()) return;
      inner.textContent = '';
      const frag = document.createDocumentFragment();
      for (const ch of text) {
        const span = document.createElement('span');
        span.className = 'ltr';
        if (ch === ' ') {
          span.dataset.space = '1';
          span.textContent = '\u00A0';
        } else {
          span.textContent = ch;
        }
        span.style.setProperty('--i', String(n++));
        if (li > 0) span.style.setProperty('--d', '0.1s');
        frag.appendChild(span);
      }
      inner.appendChild(frag);
      inner.style.display = 'inline-block';
    });

    if (!n) return; // nothing to animate, leave the original markup alone
    title.dataset.rfSplit = '1';
    html.classList.add('has-split');
  }

  /* ------------------------------------------------------------------ 2. ticker
     Injected just above the footer. Duplicated once so the track can loop
     seamlessly at -50%. */
  function ticker() {
    if ($('.eos-ticker')) return;
    const footer = $('.site-footer') || $('footer');
    const main = $('main');
    if (!footer || !main) return;

    const items = ['Enemy of Swag', 'Cut once', 'No restocks', 'Hear it first', 'Wear it out', 'Members only'];
    const half = items
      .map((t) => `<span class="eos-ticker__item"><b>${t}</b><span class="eos-ticker__dot"></span></span>`)
      .join('');

    const box = document.createElement('div');
    box.className = 'eos-ticker';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = `<div class="eos-ticker__track">${half}${half}</div>`;

    if (main.parentNode) main.parentNode.insertBefore(box, footer);
    else footer.parentNode.insertBefore(box, footer);
  }

  /* ------------------------------------------------------- 3. scroll-driven
     One rAF-throttled listener drives the hero parallax and the header key. */
  function scrolling() {
    const hero = $('[data-hero]');
    const heroMedia = hero && $('.hero__media', hero);
    let queued = false;
    let lastY = 0;

    const apply = () => {
      queued = false;
      const y = window.scrollY || window.pageYOffset || 0;
      const goingDown = y > lastY + 4;
      lastY = y;

      if (hero && !reduce) {
        const span = Math.max(1, hero.offsetHeight - window.innerHeight);
        const p = Math.min(1, Math.max(0, y / span));
        html.style.setProperty('--rf-p', p.toFixed(4));
      }
      /* a class hook for anything that wants to react to scroll direction */
      html.classList.toggle('rf-down', goingDown);
    };

    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(apply); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    apply();
  }

  /* ----------------------------------------------------- 4. magnetic buttons
     Desktop only. Offsets the control a few pixels toward the cursor. */
  function magnetic() {
    if (reduce || !canHover) return;
    const strength = 7;

    $$('.btn, .icon-btn').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        el.style.setProperty('--rf-mx', `${(dx * strength).toFixed(2)}px`);
        el.style.setProperty('--rf-my', `${(dy * strength).toFixed(2)}px`);
      }, { passive: true });

      const reset = () => {
        el.style.setProperty('--rf-mx', '0px');
        el.style.setProperty('--rf-my', '0px');
      };
      el.addEventListener('pointerleave', reset, { passive: true });
      el.addEventListener('blur', reset);
    });
  }

  /* --------------------------------------------------------- 5. card unveil
     The media clip-path is held closed until the card is first seen. Only
     enabled once the observer exists, and with a failsafe so media can
     never stay hidden. */
  function cardUnveil() {
    if (reduce || !('IntersectionObserver' in window)) return;
    const cards = $$('.card__frame').map((f) => f.closest('.card')).filter(Boolean);
    if (!cards.length) return;

    html.classList.add('rf-ready');

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('eos-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });

    cards.forEach((c) => io.observe(c));

    /* Failsafe: if anything is still clipped after a while, open it. */
    setTimeout(() => cards.forEach((c) => {
      const r = c.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) c.classList.add('eos-in');
    }), 2600);
  }

  /* ------------------------------------------------------------------- boot */
  function init() {
    safe('splitHero', splitHero);
    safe('ticker', ticker);
    safe('scrolling', scrolling);
    safe('magnetic', magnetic);
    safe('cardUnveil', cardUnveil);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
