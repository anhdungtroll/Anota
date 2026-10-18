// pdf.js 6 uses a few very new built-ins. Older Android WebViews / Chrome builds lack them.
for (const C of [Map, WeakMap]) {
  const P = C.prototype;
  if (!P.getOrInsert) Object.defineProperty(P, 'getOrInsert', { configurable: true, writable: true, value(k, v) { if (!this.has(k)) this.set(k, v); return this.get(k); } });
  if (!P.getOrInsertComputed) Object.defineProperty(P, 'getOrInsertComputed', { configurable: true, writable: true, value(k, f) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); } });
}
if (!Promise.withResolvers) Promise.withResolvers = function () { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
if (!Promise.try) Promise.try = function (fn, ...args) { return new Promise((res) => res(fn(...args))); };
if (!Uint8Array.prototype.toHex) Object.defineProperty(Uint8Array.prototype, 'toHex', { configurable: true, writable: true, value() { return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join(''); } });
if (!Uint8Array.fromBase64) Uint8Array.fromBase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
if (!Array.prototype.at) Object.defineProperty(Array.prototype, 'at', { configurable: true, writable: true, value(i) { return this[i < 0 ? this.length + i : i]; } });
