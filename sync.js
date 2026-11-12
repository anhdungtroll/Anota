// One sync file (for example inside Google Drive) that this device keeps up to date. Android: a file chosen in the system picker. Chrome on a computer: a file chosen with the file picker.
const cap = () => { const C = typeof window !== 'undefined' && window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.nativePromise ? C : null; };
const call = (m, o) => cap().nativePromise('Sync', m, o || {});
const CH = 393216;
const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
export const syAvail = () => !!cap() || (typeof window !== 'undefined' && 'showSaveFilePicker' in window);
export const syNative = () => !!cap();
/* browser: the file handle lives in IndexedDB */
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('anota-sync', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const hGet = async () => { const d = await idb(); return new Promise((res) => { const q = d.transaction('h').objectStore('h').get('file'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); };
const hPut = async (v) => { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('h', 'readwrite'); v ? t.objectStore('h').put(v, 'file') : t.objectStore('h').delete('file'); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
async function perm(h, ask) {
  const o = { mode: 'readwrite' };
  if ((await h.queryPermission(o)) === 'granted') return true;
  return ask ? (await h.requestPermission(o)) === 'granted' : false;
}
export async function syInfo(ask) {
  if (cap()) { try { return await call('info'); } catch (e) { return { set: false, err: String((e && e.message) || e) }; } }
  const h = await hGet(); if (!h) return { set: false };
  if (!(await perm(h, ask))) return { set: true, name: h.name, needsPerm: true };
  const f = await h.getFile(); return { set: true, name: h.name, size: f.size, modified: f.lastModified };
}
/** how: 'create' (a new file) or 'open' (one that already exists, from another device) */
export async function syPick(how) {
  if (cap()) return call(how === 'create' ? 'create' : 'open');
  const types = [{ description: 'Anota sync file', accept: { 'application/octet-stream': ['.anota'] } }];
  const h = how === 'create' ? await showSaveFilePicker({ suggestedName: 'Anota-sync.anota', types }) : (await showOpenFilePicker({ types }))[0];
  if (!(await perm(h, true))) throw new Error('no permission');
  await hPut(h); return syInfo();
}
export async function syForget() { if (cap()) return call('forget'); await hPut(null); }
export async function syWrite(blob) {
  if (cap()) {
    await call('begin');
    try { for (let o = 0; o < blob.size; o += CH) await call('chunk', { data: await b64(blob.slice(o, o + CH)) }); await call('end'); }
    catch (e) { try { await call('abort'); } catch {} throw e; }
    return;
  }
  const h = await hGet(); if (!h || !(await perm(h, false))) throw new Error('Tap Sync now to allow access again');
  const w = await h.createWritable(); await w.write(blob); await w.close();
}
export async function syRead(size) {
  if (cap()) {
    const parts = [];
    for (let o = 0; o < size; o += CH) { const r = await call('read', { offset: o, length: CH }); const s = atob(r.data), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); parts.push(u); }
    return new File(parts, 'Anota-sync.anota', { type: 'application/octet-stream' });
  }
  const h = await hGet(); if (!h || !(await perm(h, false))) throw new Error('no permission');
  return h.getFile();
}
