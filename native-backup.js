// Android app only: keeps a backup file in a folder the user picks (survives uninstall). In a browser everything here is off.
const cap = () => { const C = typeof window !== 'undefined' && window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.nativePromise ? C : null; };
const call = (m, o) => cap().nativePromise('Backup', m, o || {});
export const nbAvail = () => !!cap();
const CH = 393216;                                                   // 384 KB per piece (multiple of 3 so base64 joins cleanly)
const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
export async function nbInfo() { try { return await call('info'); } catch (e) { return { folder: false, err: String((e && e.message) || e) }; } }
export async function nbPick() { return call('pickFolder'); }
export async function nbWrite(blob, onProgress) {
  await call('begin');
  try { for (let o = 0; o < blob.size; o += CH) { await call('chunk', { data: await b64(blob.slice(o, o + CH)) }); onProgress && onProgress(Math.min(1, (o + CH) / blob.size)); } await call('end'); }
  catch (e) { try { await call('abort'); } catch {} throw e; }
}
export async function nbRead(size) {
  const parts = [];
  for (let o = 0; o < size; o += CH) { const r = await call('read', { offset: o, length: CH }); const s = atob(r.data), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); parts.push(u); }
  return new File(parts, 'Anota-backup.anota', { type: 'application/octet-stream' });
}
