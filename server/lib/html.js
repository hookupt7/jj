'use strict';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Conservative sanitiser for Shopify descriptionHtml (owner-authored, but still).
function sanitize(html) {
  let s = String(html || '');
  s = s.replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta|base|svg|math)[\s\S]*?(<\s*\/\s*\1\s*>|\/?>)/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/\s(style|class|id)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/(href|src)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, '$1="#"');
  // keep only a small allow-list of tags
  s = s.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (m, tag, attrs) => {
    const t = tag.toLowerCase();
    const ok = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'h5', 'blockquote', 'a', 'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th'];
    if (!ok.includes(t)) return '';
    if (t === 'a' && !m.startsWith('</')) {
      const href = (attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[2] || '';
      return `<a href="${esc(href)}" rel="noopener nofollow" target="_blank">`;
    }
    return m.startsWith('</') ? `</${t}>` : `<${t}>`;
  });
  return s.trim();
}
const stripTags = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
module.exports = { esc, sanitize, stripTags };
