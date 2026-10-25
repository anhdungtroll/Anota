// Offline text recognition (Tesseract engine in a Web Worker). Lazy: nothing loads until the first call,
// and the worker (about 100 MB of memory) is shut down again after four minutes of no use (so a burst of writing is read quickly, then the memory is freed).
const BASE = new URL('./vendor/ocr/', import.meta.url).href;
let quality = 'fast', worker = null, ready = null, langs = ['eng', 'vie'], seq = 0, idle = 0;
const pending = new Map();

export const ocrSupported = () => typeof Worker !== 'undefined' && typeof WebAssembly === 'object' &&
  WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
export function setLangs(l) { const n = l.split('+'); if (n.join('+') !== langs.join('+')) { langs = n; stop(); } }
export function setQuality(q) { if (q !== quality) { quality = q; stop(); } }
export const getQuality = () => quality;
export const getLangs = () => langs.join('+');

function start() {
  if (ready) return ready;
  ready = new Promise((res, rej) => {
    worker = new Worker(new URL('./ocr-worker.js', import.meta.url));
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.t === 'ready') res();
      else if (m.t === 'res') { const p = pending.get(m.id); if (p) { pending.delete(m.id); p.res(m.tsv); } }
      else if (m.t === 'err') { if (m.id != null && pending.has(m.id)) { pending.get(m.id).rej(new Error(m.msg)); pending.delete(m.id); } else { rej(new Error(m.msg)); ready = null; } }
    };
    worker.onerror = (e) => { rej(new Error(e.message || 'worker failed')); ready = null; };
    worker.postMessage({ t: 'init', base: BASE, langs, dataBase: quality === 'best' ? new URL('./vendor/ocr-best/', import.meta.url).href : BASE });
  });
  return ready;
}
export function stop() {
  clearTimeout(idle);
  if (worker) { try { worker.terminate(); } catch {} }
  worker = null; ready = null;
  for (const p of pending.values()) p.rej(new Error('stopped'));
  pending.clear();
}
const bump = () => { clearTimeout(idle); idle = setTimeout(stop, 240000); };

function parseTsv(tsv) {
  const out = [];
  for (const line of String(tsv || '').split('\n')) {
    const c = line.split('\t');
    if (c.length < 12 || c[0] !== '5') continue;
    const t = c.slice(11).join('\t').trim(), conf = +c[10];
    if (!t || conf < 8) continue;
    out.push({ t, x: +c[6], y: +c[7], w: +c[8], h: +c[9], c: conf });
  }
  return out;
}
/** canvas (or Blob) -> [{t, x, y, w, h, c}] in pixels of that image */
export async function recognize(src, opt = {}) {
  await start(); bump();
  const blob = src instanceof Blob ? src : await new Promise((r) => src.toBlob(r, 'image/png'));
  const buf = await blob.arrayBuffer();
  const id = ++seq;
  const tsv = await new Promise((res, rej) => { pending.set(id, { res, rej }); worker.postMessage({ t: 'rec', id, buf, psm: opt.psm || 3, lang: opt.lang || '' }, [buf]); });
  bump();
  return parseTsv(tsv);
}
export const ocrBusy = () => pending.size > 0;

/** self-test for Settings: draws known words, reads them back, reports the time */
export async function selfTest() {
  const c = document.createElement('canvas'); c.width = 900; c.height = 190;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 900, 190); g.fillStyle = '#000'; g.font = '46px sans-serif';
  g.fillText('Hello notes 2026', 30, 70); g.fillText('Xin chào Việt Nam', 30, 140);
  const t0 = performance.now(), w = await recognize(c);
  return { ms: Math.round(performance.now() - t0), text: w.map((x) => x.t).join(' ') };
}
