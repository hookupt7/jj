'use strict';
const config = require('./config');
const mo = require('./shopify/metaobjects');

// Admin activity log, stored as Shopify metaobject entries (type eos_activity).
function log(req, action, detail = '') {
  if (!config.shopify.configured) return;
  const ip = String(req.ip || '').replace(/^::ffff:/, '');
  mo.create('eos_activity', { action: String(action).slice(0, 250), detail: String(detail).slice(0, 2000), at: new Date().toISOString(), ip: ip.slice(0, 60) })
    .catch((e) => console.warn('[activity] not recorded:', e.message));
}

async function list(after) {
  const r = await mo.list('eos_activity', 50, after || null).catch((e) => {
    if (/definition|not exist|No metaobject/i.test(e.message)) return { nodes: [], pageInfo: { hasNextPage: false } };
    throw e;
  });
  return {
    items: r.nodes.map((n) => {
      const f = Object.fromEntries(n.fields.map((x) => [x.key, x.value]));
      return { id: n.id, action: f.action, detail: f.detail, at: f.at || n.updatedAt, ip: f.ip };
    }),
    pageInfo: r.pageInfo,
  };
}
module.exports = { log, list };
