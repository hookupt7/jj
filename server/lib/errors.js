'use strict';
class AppError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.code = code; this.status = status; this.details = details;
  }
}
const notConfigured = () => new AppError('SHOPIFY_NOT_CONFIGURED',
  'The store is not connected to Shopify yet. Set SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.', 503);

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500 && err.code !== 'SHOPIFY_NOT_CONFIGURED') console.error('[error]', err.code || '', err.message);
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL',
      message: status >= 500 && !err.code ? 'Something broke in the dark. Try again.' : err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
// Wrap async route handlers.
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => sendError(res, e));
module.exports = { AppError, notConfigured, sendError, ah };
