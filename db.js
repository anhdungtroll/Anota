// Tiny IndexedDB wrapper: meta (library cards), docs (pages + strokes), pdfs (original PDF bytes)
let dbp;
function open() {
  return (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('inknote', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('meta', { keyPath: 'id' });
      d.createObjectStore('docs', { keyPath: 'id' });
      d.createObjectStore('pdfs');
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
  remove: (id) => run(['meta', 'docs', 'pdfs'], 'readwrite', (m, d, p) => { m.delete(id); d.delete(id); return p.delete(id); }),
};
