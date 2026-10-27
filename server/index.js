'use strict';
const path = require('node:path');
const express = require('express');
const compression = require('compression');
const config = require('./config');
const securityHeaders = require('./lib/security');
const settings = require('./settings');
const session = require('./lib/session');
const { render } = require('./render');
const { sendError, AppError } = require('./lib/errors');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render sits behind one proxy
app.use(securityHeaders);
app.use(compression());

app.get('/healthz', (req, res) => res.json({ ok: true, shopify: config.shopify.configured, admin: config.admin.configured }));

// Static assets. Media + images are long-cached; CSS/JS are versioned by query string.
const PUBLIC = path.join(__dirname, '..', 'public');
const ADMIN = path.join(__dirname, '..', 'admin');
const staticOpts = (maxAge) => ({ maxAge, index: false, fallthrough: true, setHeaders: (res, file) => { if (/\.(mp4|webm)$/.test(file)) res.setHeader('Accept-Ranges', 'bytes'); } });
app.use('/media', express.static(path.join(PUBLIC, 'media'), staticOpts('30d')));
app.use('/img', express.static(path.join(PUBLIC, 'img'), staticOpts('30d')));
app.use('/fonts', express.static(path.join(PUBLIC, 'fonts'), { ...staticOpts('365d'), immutable: true }));
app.use('/css', express.static(path.join(PUBLIC, 'css'), staticOpts(config.isProd ? '7d' : 0)));
app.use('/js', express.static(path.join(PUBLIC, 'js'), staticOpts(config.isProd ? '7d' : 0)));
app.get('/favicon.png', (req, res) => res.sendFile(path.join(PUBLIC, 'favicon.png'), { maxAge: '30d' }));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(PUBLIC, 'favicon.png'), { maxAge: '30d' }));
app.use('/admin/assets', express.static(path.join(ADMIN, 'assets'), staticOpts(config.isProd ? '1d' : 0)));

app.use(express.json({ limit: '200kb' }));
app.use((err, req, res, next) => (err && err.type === 'entity.parse.failed' ? sendError(res, new AppError('BAD_JSON', 'Malformed request body.', 400)) : next(err)));

// Admin
app.use('/api/admin', require('./routes/admin-api'));
app.get(['/admin', '/admin/'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(ADMIN, 'index.html'));
});

// Maintenance mode: the storefront closes, admins (signed in) still see it.
app.use(async (req, res, next) => {
  try {
    const s = await settings.get();
    if (!s.maintenance.enabled || session.read(req)) return next();
    if (req.path.startsWith('/api/')) {
      if (req.path === '/api/config') return next();
      return sendError(res, new AppError('STORE_CLOSED', s.maintenance.message, 503));
    }
    if (['/robots.txt', '/site.webmanifest'].includes(req.path)) return next();
    res.setHeader('Retry-After', '3600');
    return render(req, res, 'maintenance', { title: 'Closed', status: 503, robots: 'noindex', settings: s, data: { message: s.maintenance.message, sections: {} } });
  } catch (e) { return next(); }
});

app.use('/api', require('./routes/api'));
app.use('/', require('./routes/pages'));

// 404
app.use((req, res) => {
  if (req.accepts('html')) return render(req, res, '404', { title: 'Lost', status: 404, robots: 'noindex' }).catch(() => res.status(404).send('Not found'));
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
});

// Errors
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[unhandled]', err);
  if (res.headersSent) return;
  if (req.path.startsWith('/api/')) return sendError(res, err);
  res.status(500).type('text/plain').send('Something broke in the dark. Refresh the page.');
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`EOS listening on :${config.port} (${config.isProd ? 'production' : 'development'})`);
    if (!config.shopify.configured) console.log('  Shopify: not configured (set SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET)');
    if (!config.admin.configured) console.log('  Admin: disabled (set ADMIN_PASSWORD and SESSION_SECRET)');
    console.log(`  Checkout mode: ${config.checkoutMode}`);
  });
}
module.exports = app;
