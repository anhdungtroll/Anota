// Tiny IndexedDB wrapper.
//  meta   : library cards + folders
//  docs   : pages, strokes, objects
//  pdfs   : original PDF bytes
//  assets : images attached to notes
let dbp;
function open() {
  return (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('inknote', 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const n of ['meta', 'docs']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: 'id' });
      for (const n of ['pdfs', 'assets']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

async function run(names, mode, fn) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(names, mode);
    const stores = names.map((n) => t.objectStore(n));
    let out;
    try { out = fn(...stores); } catch (e) { rej(e); return; }
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

export const db = {
  listMeta: () => run(['meta'], 'readonly', (m) => m.getAll()),
  getDoc: (id) => run(['docs'], 'readonly', (d) => d.get(id)),
  saveDoc: (doc, meta) => run(['meta', 'docs'], 'readwrite', (m, d) => { m.put(meta); return d.put(doc); }),
  saveMeta: (meta) => run(['meta'], 'readwrite', (m) => m.put(meta)),
  getMeta: (id) => run(['meta'], 'readonly', (m) => m.get(id)),
  putPdf: (id, buf) => run(['pdfs'], 'readwrite', (p) => p.put(buf, id)),
  getPdf: (id) => run(['pdfs'], 'readonly', (p) => p.get(id)),
  putAsset: (id, blob) => run(['assets'], 'readwrite', (a) => a.put(blob, id)),
  getAsset: (id) => run(['assets'], 'readonly', (a) => a.get(id)),
  removeDoc: (id, assetIds = []) => run(['meta', 'docs', 'pdfs', 'assets'], 'readwrite', (m, d, p, a) => {
    for (const x of assetIds) a.delete(x);
    m.delete(id); d.delete(id); return p.delete(id);
  }),
  removeMeta: (id) => run(['meta'], 'readwrite', (m) => m.delete(id)),
};
