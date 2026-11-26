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
    if (!entered && !reduce) d.classList.add('is-gated');
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
