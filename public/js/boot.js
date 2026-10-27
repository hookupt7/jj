/* Runs before first paint: sets motion/ambience/preloader state classes. No inline scripts (CSP). */
(function () {
  var d = document.documentElement;
  d.classList.remove('no-js');
  d.classList.add('js');
  var reduce = false;
  try {
    var m = localStorage.getItem('eos:motion');
    reduce = m ? m === 'off' : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (m === 'on') d.classList.add('motion-forced');
    d.setAttribute('data-ambience', localStorage.getItem('eos:ambience') || 'lit');
    var first = !sessionStorage.getItem('eos:seen');
    if (first && !reduce) d.classList.add('is-first');
    else if (sessionStorage.getItem('eos:leaving')) { d.classList.add('is-entering'); }
    sessionStorage.removeItem('eos:leaving');
  } catch (e) { /* storage blocked */ }
  if (reduce) d.classList.add('reduce-motion');
  // Never trap anyone behind the preloader.
  setTimeout(function () { d.classList.add('is-loaded'); }, 4200);
})();
