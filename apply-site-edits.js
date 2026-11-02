'use strict';
/*
 * EOS site edits. Runs each time the server starts and is safe to run repeatedly.
 * Removes: Everything / Lookbook / Film / Tracking / Returns / Reach us links, the It's Us page + menu +
 * tee photos, every goat-man drawing, the home-screen logo, and the "Summoning" loader text.
 * Adds: polish.css (scarier, smoother motion, cleaner finish) and the Join the cult background.
 */
const fs = require('node:fs');
const path = require('node:path');

function edit(rel, fn) {
  const file = path.join(__dirname, rel);
  if (!fs.existsSync(file)) { console.warn('[edits] file not found:', rel); return; }
  const before = fs.readFileSync(file, 'utf8');
  const after = fn(before);
  if (after !== before) { fs.writeFileSync(file, after); console.log('[edits] updated', rel); }
}
const goatDiv = /[ \t]*<div class="(?:page-hero__goat|lost__goat|success__goat)"[^>]*>\{\{\{goatSm\}\}\}<\/div>\n?/;

edit('server/views/layout.html', (s) => s
  .replace(/[ \t]*<a href="\/lookbook"[^>]*>Lookbook(?: &amp; film)?<\/a>\n?/g, '')
  .replace(/[ \t]*<a href="\/its-us"[^>]*>It&rsquo;s Us<\/a>\n?/g, '')
  .replace(/<a href="\/shop">Everything<\/a>/g, '')
  .replace(/<a href="\/track">Track an order<\/a>/g, '')
  .replace(/<a href="\/shipping-returns">Shipping &amp; returns<\/a>/g, '')
  .replace(/[ \t]*<div class="site-footer__col">\s*<h3>Reach us<\/h3>[\s\S]*?<\/div>\n?/, '')
  .replace('<span>Summoning</span>', '<span>Loading</span>')
  .replace(/(<link rel="stylesheet" href="\/css\/main\.css\?v=\{\{v\}\}">)(?!\s*<link rel="stylesheet" href="\/css\/polish)/,
           '$1\n<link rel="stylesheet" href="/css/polish.css?v={{v}}">'));

for (const f of ['about', 'contact', 'shop', 'lookbook', '404', 'success']) {
  edit(`server/views/pages/${f}.html`, (s) => s.replace(goatDiv, '').replace(' page-hero--goat', ''));
}
edit('server/views/pages/about.html', (s) => s.replace(/<section class="itsus-band"[\s\S]*?<\/section>\n?\n?/, ''));
edit('server/views/pages/home.html', (s) => s.replace(/[ \t]*<img class="hero__mark"[^>]*>\n?/, ''));
edit('server/views/pages/join.html', (s) => s.replace(/[ \t]*<div class="cult__figure"[^>]*>\{\{\{goatLg\}\}\}<\/div>\n?/, ''));
edit('server/render.js', (s) => s.replace(/goatLg:\s*goatMan\(\{[^}]*\}\),\s*goatSm:\s*goatMan\(\{[^}]*\}\),?/, ''));
edit('server/routes/pages.js', (s) => s
  .replace(/router\.get\('\/its-us'[^\n]*\n/, "router.get('/its-us', (req, res) => res.redirect(301, '/'));\n")
  .replace("'/about', '/its-us', '/join'", "'/about', '/join'"));
