/* Runs before first paint: sets motion/preloader state classes. No inline scripts (CSP).
   Motion follows the visitor's system setting (prefers-reduced-motion) only. */
(function () {
  var d = document.documentElement;
  d.classList.remove('no-js');
  d.classList.add('js');
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* old browser */ }
  try {
    // Retired toggles from the first version: clear them so nobody stays stuck on "motion off".
    localStorage.removeItem('eos:motion'); localStorage.removeItem('eos:ambience');
    var first = !sessionStorage.getItem('eos:seen');
    if (first && !reduce) d.classList.add('is-first');
    else if (sessionStorage.getItem('eos:leaving')) { d.classList.add('is-entering'); }
    sessionStorage.removeItem('eos:leaving');
  } catch (e) { /* storage blocked */ }
  if (reduce) d.classList.add('reduce-motion');
  // Never trap anyone behind the preloader.
  setTimeout(function () { d.classList.add('is-loaded'); }, 4200);
})();
