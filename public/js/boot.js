/* Runs before first paint. No inline scripts (CSP).
   First visit: hold-to-enter gate. Later visits: skip the gate.
   Motion follows prefers-reduced-motion only. */
(function () {
  var d = document.documentElement;
  d.classList.remove('no-js');
  d.classList.add('js');
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* old browser */ }
  try {
    localStorage.removeItem('eos:motion');
    localStorage.removeItem('eos:ambience');
    var entered = sessionStorage.getItem('eos:entered');
    var leaving = sessionStorage.getItem('eos:leaving');
    if (!entered && !reduce && d.getAttribute('data-page') === 'home') d.classList.add('is-gated');
    else if (leaving) d.classList.add('is-entering');
    sessionStorage.removeItem('eos:leaving');
  } catch (e) { /* storage blocked */ }
  if (reduce) d.classList.add('reduce-motion');
  d.classList.add('is-loaded');
  // Never trap anyone behind the gate.
  setTimeout(function () {
    if (d.classList.contains('is-gated')) d.classList.add('is-gate-late');
  }, 16000);
})();

/* Failsafe: if the module scripts fail to start (old cached files, an unsupported API on some browser),
   still show the page and the products. Plain ES5 on purpose. */
(function () {
  function showAll() {
    var els = document.querySelectorAll('[data-reveal],[data-reveal-stagger]');
    for (var i = 0; i < els.length; i++) els[i].classList.add('is-in');
    var pre = document.getElementById('preloader'); if (pre) pre.style.display = 'none';
    document.documentElement.classList.remove('is-loading', 'is-gated');
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fillGrid() {
    var grid = document.querySelector('[data-grid]');
    if (!grid || grid.querySelector('.pc') || !window.fetch) return;
    fetch('/api/products?limit=60').then(function (r) { return r.json(); }).then(function (d) {
      var items = (d && (d.items || d.products)) || [];
      if (grid.querySelector('.pc')) return;
      grid.innerHTML = items.map(function (p) {
        var img = p.images && p.images[0] ? p.images[0].src : ''; if (/cdn\.shopify\.com/.test(img)) img = '/api/img?w=540&src=' + encodeURIComponent(img);
        var price = p.price != null ? '\u20A6' + Number(p.price).toLocaleString('en-NG') : '';
        return '<a class="pc pc--plain" href="/product/' + encodeURIComponent(p.handle) + '" style="display:block;opacity:1;transform:none;color:inherit;text-decoration:none">' +
          '<span style="display:block;aspect-ratio:4/5;background:radial-gradient(circle at 50% 55%,#2a0a0e,#0b0b0b 70%);border:1px solid rgba(255,255,255,.1)">' +
          '<img src="' + esc(img) + '" alt="' + esc(p.title) + '" loading="lazy" style="display:block;width:100%;height:100%;object-fit:contain;opacity:1"></span>' +
          '<span style="display:block;margin-top:12px;font-size:14px;line-height:1.35">' + esc(p.title) + '</span>' +
          '<span style="display:block;margin-top:4px;opacity:.7;font-size:13px">' + price + '</span></a>';
      }).join('');
      grid.removeAttribute('aria-busy');
    }).catch(function () {});
  }
  setTimeout(function () { if (!window.__eosBooted) { showAll(); fillGrid(); } }, 5000);
  // Even when scripts run, never leave content hidden forever.
  setTimeout(function () { var els = document.querySelectorAll('[data-reveal]:not(.is-in),[data-reveal-stagger]:not(.is-in)'); for (var i = 0; i < els.length; i++) { var r = els[i].getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) els[i].classList.add('is-in'); } }, 4000);
})();
