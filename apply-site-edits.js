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
           '$1\n<link rel="stylesheet" href="/css/polish.css?v={{v}}">')
  .replace(/(<link rel="stylesheet" href="\/css\/polish\.css\?v=\{\{v\}\}">)(?!\s*<link rel="stylesheet" href="\/css\/motion)/,
           '$1\n<link rel="stylesheet" href="/css/motion.css?v={{v}}">\n<script src="/js/polish.js?v={{v}}" defer></script>')
  .replace(/(<link rel="stylesheet" href="\/css\/motion\.css\?v=\{\{v\}\}">)(?!\s*<link rel="stylesheet" href="\/css\/refine)/,
           '$1\n<link rel="stylesheet" href="/css/refine.css?v={{v}}">\n<script src="/js/refine.js?v={{v}}" defer></script>'));

for (const f of ['about', 'contact', 'shop', '404', 'success']) {
  edit(`server/views/pages/${f}.html`, (s) => s.replace(goatDiv, '').replace(' page-hero--goat', ''));
}
edit('server/views/pages/about.html', (s) => s.replace(/<section class="itsus-band"[\s\S]*?<\/section>\n?\n?/, ''));
edit('server/views/pages/home.html', (s) => s.replace(/[ \t]*<img class="hero__mark"[^>]*>\n?/, ''));
edit('server/views/pages/join.html', (s) => s.replace(/[ \t]*<div class="cult__figure"[^>]*>\{\{\{goatLg\}\}\}<\/div>\n?/, ''));
edit('server/render.js', (s) => s.replace(
  /^const \{ goatMan \} = require\('\.\/views\/goat'\);\n/m, ''
));

// "Lookbook" is retired everywhere the customer can see it. The /lookbook route still resolves for old
// links, but it is no longer linked from the nav, the footer, the search panel or the sitemap.
edit('public/js/ui.js', (s) => s.replace(
  '<a href="/collections">Collections</a><a href="/lookbook">Lookbook</a>',
  '<a href="/collections">Collections</a>'
));
edit('server/routes/pages.js', (s) => s
  .replace(/router\.get\('\/its-us'[^\n]*\n/, "router.get('/its-us', (req, res) => res.redirect(301, '/'));\n")
  .replace("'/about', '/its-us', '/join'", "'/about', '/join'")
  .replace("router.get('/lookbook', safe(async (req, res) => render(req, res, 'lookbook', { title: 'Lookbook & film', description: 'The EOS film and lookbook. She looked into the mirror. Something looked back.' })));\n", '')
  .replace("router.get(['/film'], (req, res) => res.redirect(301, '/lookbook'));\n", "router.get(['/lookbook', '/film'], (req, res) => res.redirect(301, '/'));\n")
  .replace("'/collections', '/lookbook', '/about'", "'/collections', '/about'"));

// "Summoned" wording -> plain, professional copy
const words = [
  ['The first drop is being summoned', 'The first drop is coming'],
  ['Nothing has crossed over yet. When the first pieces arrive they will appear here, and the ones on our list hear first.', 'The first pieces are on their way. When they land they will appear here, and the ones on our list hear first.'],
  ['The first collection is being summoned. When it crosses over, it will appear here.', 'The first collection is coming. When it lands, it will appear here.'],
  ['The lookbook is being summoned', 'Coming soon'],
  ['Frames appear here as soon as the first pieces cross over.', 'Frames appear here as soon as the first pieces land.'],
];
for (const f of ['cards.js', 'ui.js', 'pages/collections.js']) {
  edit(`public/js/${f}`, (s) => words.reduce((acc, [a, b]) => acc.split(a).join(b), s));
}
