'use strict';
// The EOS goat-man: a hand-drawn, Baphomet / Pan style horned figure, built as inline SVG.
// Every shape is authored here (no stock art). Motion lives in main.css (.gm__*):
// a slowly turning mandala ring, a pulsing halo, breathing, a slight head sway, blinking
// goat eyes with a red glow, a flickering crown flame, drifting smoke and rising embers.
// All of it is switched off by prefers-reduced-motion.

const r2 = (n) => Math.round(n * 100) / 100;
const P = (x, y) => `${r2(x)} ${r2(y)}`;
const mx = (x) => 400 - x; // mirror around the centre line (viewBox is 400 wide)
const cubic = (a, b, c, d, t) => {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
};
// Mirror every "x y" pair of a path string.
const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (m, x, y) => `${r2(mx(Number(x)))} ${y}`);

// Deterministic pseudo-random so the server renders the same figure every time.
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function horn() {
  // Outer and inner edge of the left horn, base -> tip.
  const O = [[166, 164], [92, 146], [34, 96], [50, 12]];
  const I = [[197, 147], [128, 118], [78, 72], [50, 12]];
  const shape = `M${P(...O[0])} C${P(...O[1])} ${P(...O[2])} ${P(...O[3])} C${P(...I[2])} ${P(...I[1])} ${P(...I[0])} Z`;
  // Growth ridges across the horn, denser towards the base.
  let ridges = '';
  for (let i = 0; i < 15; i++) {
    const t = 0.05 + Math.pow(i / 15, 1.25) * 0.84;
    const a = cubic(...O, t); const b = cubic(...I, t);
    const cx = (a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.18; const cy = (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.18;
    ridges += `M${P(...a)} Q${P(cx, cy)} ${P(...b)}`;
  }
  // A highlight running along the front of the horn.
  const hl = [0.06, 0.3, 0.6, 0.9].map((t) => { const a = cubic(...O, t); const b = cubic(...I, t); return [a[0] * 0.7 + b[0] * 0.3, a[1] * 0.7 + b[1] * 0.3]; });
  const highlight = `M${P(...hl[0])} C${P(...hl[1])} ${P(...hl[2])} ${P(...hl[3])}`;
  return { shape, ridges, highlight };
}

function ring(id) {
  const c = [200, 236]; const out = [];
  const pt = (r, deg) => [c[0] + r * Math.cos((deg - 90) * Math.PI / 180), c[1] + r * Math.sin((deg - 90) * Math.PI / 180)];
  out.push(`<circle cx="200" cy="236" r="196" stroke-width="0.8"/><circle cx="200" cy="236" r="186" stroke-width="0.5" stroke-dasharray="1.5 5"/><circle cx="200" cy="236" r="150" stroke-width="0.7"/><circle cx="200" cy="236" r="146" stroke-width="0.4"/>`);
  let ticks = '';
  for (let a = 0; a < 360; a += 6) { const long = a % 30 === 0; const p1 = pt(long ? 172 : 180, a); const p2 = pt(196, a); ticks += `M${P(...p1)}L${P(...p2)}`; }
  out.push(`<path d="${ticks}" stroke-width="0.6"/>`);
  const star = [0, 144, 288, 72, 216].map((a) => pt(150, a + 180));
  out.push(`<path d="M${star.map((p) => P(...p)).join(' L')} Z" stroke-width="0.7" opacity="0.8"/>`);
  for (let a = 15; a < 360; a += 30) { const p = pt(166, a); out.push(`<circle cx="${r2(p[0])}" cy="${r2(p[1])}" r="3.2" stroke-width="0.6"/>`); }
  return `<g class="gm__ring" fill="none" stroke="currentColor">${out.join('')}</g>`;
}

/**
 * goatMan({ id, variant }) -> inline SVG string.
 * variant 'lg' (Join page centrepiece: smoke + more embers) or 'sm' (page headers).
 */
function goatMan({ id = 'gm', variant = 'lg', label = '' } = {}) {
  const lg = variant === 'lg';
  const h = horn();
  const rand = rng(lg ? 666 : 13);
  const head = 'M200 136C234 136 260 152 264 178C268 204 258 224 249 242C239 268 232 294 226 320C222 336 212 344 200 344C188 344 178 336 174 320C168 294 161 268 151 242C142 224 132 204 136 178C140 152 166 136 200 136Z';
  const earL = 'M150 192C124 181 94 184 66 203C94 216 126 214 153 208Z';
  const earInL = 'M146 197C126 191 104 194 84 204C106 209 128 208 147 204Z';
  const browL = 'M144 189C160 186 178 192 192 205';
  const socketL = 'M148 197C162 186 182 192 194 207C182 220 160 216 148 197Z';
  const eyeL = 'M155 200C165 193 178 196 188 207C177 212 164 210 155 200Z';
  const bridgeL = 'M191 214C194 252 192 292 188 324';
  const nostrilL = 'M184 327C188 321 194 322 196 329';
  const hatchL = [[154, 228, 164, 238], [156, 244, 167, 254], [160, 262, 171, 270], [164, 280, 174, 287], [168, 298, 177, 304]]
    .map(([a, b, c, d]) => `M${a} ${b}Q${a + 2} ${d} ${c} ${d}`).join('');
  const beard = 'M178 330C178 362 188 398 200 442C212 398 222 362 222 330C212 340 188 340 178 330Z';
  let strands = '';
  for (let i = 0; i < 7; i++) { const x = 184 + i * 5.3; strands += `M${r2(x)} ${340 + (i % 2) * 4}C${r2(x + (200 - x) * 0.2)} 380 ${r2(x + (200 - x) * 0.55)} 404 ${r2(200 + (x - 200) * 0.18)} ${420 + (3 - Math.abs(3 - i)) * 5}`; }
  const cloak = 'M24 500C34 432 88 390 148 372C166 366 178 356 184 344L200 448L216 344C222 356 234 366 252 372C312 390 366 432 376 500Z';
  const hood = 'M200 92C284 96 326 168 330 252C333 310 316 360 300 430L100 430C84 360 67 310 70 252C74 168 116 96 200 92Z';
  const hoodIn = 'M200 112C266 116 300 176 303 248C305 300 292 350 280 420L120 420C108 350 95 300 97 248C100 176 134 116 200 112Z';
  // Shaggy locks of fur hanging from the jaw down to the collar.
  const lock = (x, y, len, bend, w) => `M${P(x - w, y)}C${P(x - w + bend * 0.4, y + len * 0.4)} ${P(x + bend * 0.9 - w * 0.3, y + len * 0.75)} ${P(x + bend, y + len)}C${P(x + bend * 0.7 + w * 0.4, y + len * 0.7)} ${P(x + w + bend * 0.3, y + len * 0.4)} ${P(x + w, y)}Z`;
  const locksL = [[158, 236, 122, -10, 8], [148, 222, 136, -20, 7], [166, 262, 108, -6, 7], [140, 208, 126, -28, 6], [172, 290, 92, -3, 6], [152, 250, 128, -16, 6]]
    .map((a) => lock(...a)).join('');
  const flame = 'M200 54C212 74 218 90 213 104C209 114 191 114 187 104C182 90 188 74 200 54Z';
  const flameCore = 'M200 80C206 90 207 99 204 105C202 109 198 109 196 105C193 99 194 90 200 80Z';
  const pentaPts = [0, 144, 288, 72, 216].map((a) => { const t = (a + 180 - 90) * Math.PI / 180; return P(200 + 10.5 * Math.cos(t), 172 + 10.5 * Math.sin(t)); });

  const embers = Array.from({ length: lg ? 16 : 7 }, () => {
    const x = 110 + rand() * 180; const y = 300 + rand() * 150; const r = 0.7 + rand() * 1.5;
    return `<circle class="gm__ember" cx="${r2(x)}" cy="${r2(y)}" r="${r2(r)}" style="--d:${r2(-rand() * 7)}s;--dur:${r2(5 + rand() * 4)}s;--x:${r2((rand() - 0.5) * 60)}px"/>`;
  }).join('');
  const smoke = lg ? `<g class="gm__smoke" filter="url(#${id}-blur)">${[[120, 440, 80, 26], [270, 452, 92, 30], [200, 470, 120, 34], [90, 480, 70, 24], [320, 486, 70, 24], [200, 420, 70, 22]]
    .map(([x, y, rx, ry], i) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" style="--d:${-i * 2.3}s"/>`).join('')}</g>` : '';

  return `<svg class="goat goat--${variant}" viewBox="0 0 400 500" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} focusable="false">
<defs>
<radialGradient id="${id}-halo" cx="50%" cy="46%" r="50%"><stop offset="0" stop-color="#d61430" stop-opacity="0.55"/><stop offset="0.45" stop-color="#8a0014" stop-opacity="0.22"/><stop offset="1" stop-color="#4d000b" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#231b19"/><stop offset="0.55" stop-color="#110d0c"/><stop offset="1" stop-color="#060505"/></linearGradient>
<linearGradient id="${id}-horn" x1="0.9" y1="1" x2="0.1" y2="0"><stop offset="0" stop-color="#1a1513"/><stop offset="0.55" stop-color="#5a5046"/><stop offset="1" stop-color="#d8cdb9"/></linearGradient>
<linearGradient id="${id}-shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.75"/><stop offset="0.3" stop-color="#000" stop-opacity="0"/><stop offset="0.7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.85"/></linearGradient>
<radialGradient id="${id}-lite" cx="50%" cy="22%" r="45%"><stop offset="0" stop-color="#e9e3d7" stop-opacity="0.13"/><stop offset="1" stop-color="#e9e3d7" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="#ff3a3a" stop-opacity="0.95"/><stop offset="0.5" stop-color="#d61430" stop-opacity="0.35"/><stop offset="1" stop-color="#e9e3d7" stop-opacity="0.45"/></linearGradient>
<linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="0.83" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
<mask id="${id}-mask" maskUnits="userSpaceOnUse" x="-40" y="-40" width="480" height="560"><rect x="-40" y="-40" width="480" height="542" fill="url(#${id}-fade)"/></mask>
<linearGradient id="${id}-cloak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16100f"/><stop offset="1" stop-color="#050505"/></linearGradient>
<radialGradient id="${id}-eye" cx="45%" cy="45%" r="60%"><stop offset="0" stop-color="#fff1c2"/><stop offset="0.35" stop-color="#ff5a1f"/><stop offset="1" stop-color="#9a0012"/></radialGradient>
<radialGradient id="${id}-fire" cx="50%" cy="75%" r="65%"><stop offset="0" stop-color="#fff4cf"/><stop offset="0.35" stop-color="#ffb347"/><stop offset="0.7" stop-color="#ff5a1f"/><stop offset="1" stop-color="#b0001a" stop-opacity="0"/></radialGradient>
<filter id="${id}-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="${id}-aura" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
${lg ? `<filter id="${id}-blur" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="14"/></filter>` : ''}
</defs>
<circle class="gm__halo" cx="200" cy="230" r="200" fill="url(#${id}-halo)"/>
${ring(id)}
${smoke}
<g mask="url(#${id}-mask)"><g class="gm__body">
  <path d="${hood}" fill="#0a0707" stroke="url(#${id}-rim)" stroke-width="1.2"/>
  <path d="${hoodIn}" fill="#020101"/>
  <path d="${cloak}" fill="#b0001a" opacity="0.45" filter="url(#${id}-aura)"/>
  <path d="${cloak}" fill="url(#${id}-cloak)" stroke="url(#${id}-rim)" stroke-width="1"/>
  <path d="M200 448V500M118 428C150 446 176 470 186 500M282 428C250 446 224 470 214 500M70 470C90 440 110 420 140 404M330 470C310 440 290 420 260 404" fill="none" stroke="rgba(233,227,215,0.12)" stroke-width="0.8"/>
  <g class="gm__head">
    <g class="gm__crown"><rect x="196.5" y="108" width="7" height="34" fill="#2a221d" stroke="rgba(233,227,215,0.3)" stroke-width="0.6"/>
      <circle cx="200" cy="96" r="34" fill="url(#${id}-fire)" opacity="0.35" class="gm__flameglow"/>
      <g class="gm__flame"><path d="${flame}" fill="url(#${id}-fire)"/><path d="${flameCore}" fill="#fff4cf" opacity="0.85"/></g></g>
    <path d="${head}" fill="#b0001a" opacity="0.55" filter="url(#${id}-aura)"/>
    <g class="gm__horns">
      <path d="${h.shape}" fill="url(#${id}-horn)" stroke="rgba(10,8,7,0.9)" stroke-width="1"/>
      <path d="${h.ridges}" fill="none" stroke="#0b0908" stroke-width="1.1" opacity="0.75"/>
      <path d="${h.highlight}" fill="none" stroke="#efe6d2" stroke-width="0.8" opacity="0.35"/>
      <path d="${mirror(h.shape)}" fill="url(#${id}-horn)" stroke="rgba(10,8,7,0.9)" stroke-width="1"/>
      <path d="${mirror(h.ridges)}" fill="none" stroke="#0b0908" stroke-width="1.1" opacity="0.75"/>
      <path d="${mirror(h.highlight)}" fill="none" stroke="#efe6d2" stroke-width="0.8" opacity="0.35"/>
    </g>
    <path d="${earL}" fill="url(#${id}-skin)" stroke="rgba(233,227,215,0.4)" stroke-width="0.8"/><path d="${earInL}" fill="#4d000b"/>
    <path d="${mirror(earL)}" fill="url(#${id}-skin)" stroke="rgba(233,227,215,0.4)" stroke-width="0.8"/><path d="${mirror(earInL)}" fill="#4d000b"/>
    <path d="${locksL}" fill="#140f0e" stroke="rgba(233,227,215,0.14)" stroke-width="0.6"/><path d="${mirror(locksL)}" fill="#140f0e" stroke="rgba(233,227,215,0.14)" stroke-width="0.6"/>
    <path d="${head}" fill="url(#${id}-skin)"/>
    <path d="${head}" fill="url(#${id}-shade)"/>
    <path d="${head}" fill="url(#${id}-lite)"/>
    <path d="${head}" fill="none" stroke="url(#${id}-rim)" stroke-width="1.3"/>
    <g fill="none" stroke="rgba(233,227,215,0.32)" stroke-width="0.8" stroke-linecap="round">
      <path d="${bridgeL}"/><path d="${mirror(bridgeL)}"/><path d="${hatchL}"/><path d="${mirror(hatchL)}"/>
      <path d="M176 160C186 154 214 154 224 160M168 150C184 144 216 144 232 150" opacity="0.6"/>
      <path d="${nostrilL}" stroke-width="1.2"/><path d="${mirror(nostrilL)}" stroke-width="1.2"/><path d="M184 338Q200 345 216 338" stroke-width="1"/>
    </g>
    <path class="gm__sigil" d="M${pentaPts.join(' L')} Z" fill="none" stroke="#d61430" stroke-width="1"/>
    <path d="${socketL}" fill="#000" opacity="0.75"/><path d="${mirror(socketL)}" fill="#000" opacity="0.75"/>
    <g class="gm__eyes">
      <g class="gm__eyeglow" filter="url(#${id}-glow)"><path d="${eyeL}" fill="url(#${id}-eye)"/><path d="${mirror(eyeL)}" fill="url(#${id}-eye)"/></g>
      <rect x="164.5" y="201.6" width="14" height="2.8" rx="1.4" fill="#140000" transform="rotate(22 171.5 203)"/>
      <rect x="221.5" y="201.6" width="14" height="2.8" rx="1.4" fill="#140000" transform="rotate(-22 228.5 203)"/>
    </g>
    <path d="${browL}" fill="none" stroke="#e9e3d7" stroke-width="1.6" stroke-linecap="round" opacity="0.75"/><path d="${mirror(browL)}" fill="none" stroke="#e9e3d7" stroke-width="1.6" stroke-linecap="round" opacity="0.75"/>
    <path d="${beard}" fill="url(#${id}-skin)" stroke="rgba(233,227,215,0.4)" stroke-width="0.8"/>
    <path d="${strands}" fill="none" stroke="rgba(233,227,215,0.22)" stroke-width="0.7"/>
  </g>
</g>
</g>
<g class="gm__embers" fill="#ff7a2a">${embers}</g>
</svg>`;
}

module.exports = { goatMan };
