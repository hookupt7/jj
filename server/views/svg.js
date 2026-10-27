'use strict';
// Hand-authored occult line-work, generated as inline SVG so it stays razor sharp.
const r2 = (n) => Math.round(n * 100) / 100;
const pt = (cx, cy, r, deg) => [r2(cx + r * Math.cos((deg - 90) * Math.PI / 180)), r2(cy + r * Math.sin((deg - 90) * Math.PI / 180))];

function pentagramPath(cx, cy, r, rot = 0) {
  const p = [0, 144, 288, 72, 216].map((a) => pt(cx, cy, r, a + rot));
  return `M${p.map((x) => x.join(' ')).join(' L')} Z`;
}

/** Mandala: rings, ticks, inverted pentagram, sigil ring and an inscription on a circle. */
function mandala({ size = 800, text = 'NOT FOR THE WEAK \u2022 SOME LOVE IS CURSED \u2022 IT\u2019S US \u2022 BEING DIFFERENT IS THE POINT \u2022 ', id = 'm' } = {}) {
  const c = size / 2; const R = c - 6;
  const out = [];
  out.push(`<svg class="mandala" viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false">`);
  out.push(`<defs><path id="${id}-ring" d="M ${c} ${c} m -${R * 0.86} 0 a ${R * 0.86} ${R * 0.86} 0 1 1 ${R * 1.72} 0 a ${R * 0.86} ${R * 0.86} 0 1 1 -${R * 1.72} 0"/></defs>`);
  out.push('<g fill="none" stroke="currentColor" vector-effect="non-scaling-stroke">');
  [1, 0.94, 0.79, 0.62, 0.6, 0.36, 0.2].forEach((f, i) => out.push(`<circle cx="${c}" cy="${c}" r="${r2(R * f)}" stroke-width="${i === 3 ? 1.2 : 0.6}"${i === 1 ? ' stroke-dasharray="2 6"' : ''}/>`));
  for (let a = 0; a < 360; a += 5) {
    const long = a % 30 === 0;
    const [x1, y1] = pt(c, c, R * (long ? 0.94 : 0.965), a); const [x2, y2] = pt(c, c, R, a);
    out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${long ? 1 : 0.5}"/>`);
  }
  for (let a = 0; a < 360; a += 30) { const [x1, y1] = pt(c, c, R * 0.2, a); const [x2, y2] = pt(c, c, R * 0.62, a); out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="0.4" stroke-dasharray="1 5"/>`); }
  // Inverted pentagram inside the inner ring
  out.push(`<path d="${pentagramPath(c, c, R * 0.6, 180)}" stroke-width="1"/>`);
  // Small sigil circles at the 5 points
  [0, 72, 144, 216, 288].forEach((a) => { const [x, y] = pt(c, c, R * 0.6, a + 180); out.push(`<circle cx="${x}" cy="${y}" r="${r2(R * 0.035)}" stroke-width="0.8"/><circle cx="${x}" cy="${y}" r="${r2(R * 0.012)}" fill="currentColor"/>`); });
  // Twelve crescents on the 0.79 ring
  for (let a = 15; a < 360; a += 30) { const [x, y] = pt(c, c, R * 0.705, a); out.push(`<circle cx="${x}" cy="${y}" r="${r2(R * 0.022)}" stroke-width="0.6"/>`); }
  out.push('</g>');
  out.push(`<text class="mandala__text" font-size="${r2(size * 0.022)}" fill="currentColor"><textPath href="#${id}-ring" textLength="${r2(2 * Math.PI * R * 0.86 - size * 0.01)}" lengthAdjust="spacing">${text}${text}</textPath></text>`);
  out.push('</svg>');
  return out.join('');
}

/** The crosshair sigil from the sleeve prints: circles with a barred cross. */
function crossSigil(cls = 'xsigil') {
  return `<svg class="${cls}" viewBox="0 0 40 64" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.4">
<circle cx="20" cy="30" r="11"/><circle cx="20" cy="30" r="5.5"/><circle cx="20" cy="30" r="1.4" fill="currentColor"/>
<path d="M20 2V62M6 30H34M15 8H25M15 54H25M9 25L31 35"/></g></svg>`;
}

function pentagram(cls = 'penta') {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.1"><circle cx="12" cy="12" r="10.5"/><path d="${pentagramPath(12, 12, 10.5, 180)}"/></g></svg>`;
}

/** Line-drawn EOS sigil used by the preloader and page transition (stroke animation). */
function sigilLine(cls = 'sigil-line') {
  return `<svg class="${cls}" viewBox="0 0 120 300" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
<path pathLength="1" d="M62 6C58 40 50 62 40 80C31 96 30 106 40 114C52 124 72 126 86 138"/>
<path pathLength="1" d="M60 100C30 108 16 128 16 150C16 178 36 196 60 200C86 196 104 176 104 150C104 126 90 110 70 104"/>
<path pathLength="1" d="M34 162C48 176 70 180 82 190C90 198 88 210 80 226C70 244 64 266 60 294"/>
<path pathLength="1" d="M44 130H78L72 138H52V148H74L68 156H52V168H80L72 176H44Z"/>
</g></svg>`;
}

/** A pair of ram horns over an abstract goat skull, for section crowns. */
function horns(cls = 'horns') {
  const L = 'M108 54C100 36 86 20 66 15C44 10 24 22 22 42C20 60 34 72 50 68C64 64 66 46 54 40C46 36 38 42 40 50';
  const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (m, x, y) => `${240 - Number(x)} ${y}`);
  const ridges = [[96, 34, 90, 42], [84, 24, 80, 33], [70, 18, 68, 28], [54, 16, 56, 26], [38, 22, 44, 30]];
  const rd = ridges.map(([a, b, c, d]) => `M${a} ${b}L${c} ${d}M${240 - a} ${b}L${240 - c} ${d}`).join('');
  return `<svg class="${cls}" viewBox="0 0 240 96" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
<path d="${L}"/><path d="${mirror(L)}"/><path d="${rd}" stroke-width="0.7"/>
<path d="M106 50L134 50L128 72L120 92L112 72Z"/><path d="M111 58L117 61M129 58L123 61" stroke-width="1.4"/><path d="M120 66V84M115 78H125" stroke-width="0.8"/></g></svg>`;
}

module.exports = { mandala, crossSigil, horns, pentagram, sigilLine, pentagramPath };
