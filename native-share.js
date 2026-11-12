// Android app: pictures (and PDFs) sent to Anota from other apps via the system Share menu.
const cap = () => { const C = typeof window !== 'undefined' && window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.nativePromise ? C : null; };
export const shAvail = () => !!cap();
export async function shPending() {
  const C = cap(); if (!C) return { files: [], open: null };
  const r = await C.nativePromise('ShareIn', 'pending', {}), out = [];
  for (const f of (r && r.files) || []) {
    const s = atob(f.data), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    out.push(new File([u], f.name || 'Shared', { type: f.type || 'application/octet-stream' }));
  }
  return { files: out, open: (r && r.open) || null };
}
