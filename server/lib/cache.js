'use strict';
// Small in-memory TTL cache with in-flight de-duplication.
class TTLCache {
  constructor() { this.store = new Map(); this.inflight = new Map(); }
  get(key) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) { this.store.delete(key); return undefined; }
    return hit.value;
  }
  set(key, value, ttlSeconds) { this.store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 }); return value; }
  del(prefix) { for (const k of this.store.keys()) if (k === prefix || k.startsWith(prefix)) this.store.delete(k); }
  clear() { this.store.clear(); }
  async wrap(key, ttlSeconds, fn) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    if (this.inflight.has(key)) return this.inflight.get(key);
    const p = (async () => {
      try { return this.set(key, await fn(), ttlSeconds); }
      finally { this.inflight.delete(key); }
    })();
    this.inflight.set(key, p);
    return p;
  }
}
module.exports = new TTLCache();
