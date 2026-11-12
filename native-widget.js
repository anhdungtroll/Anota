// Android app: gives the home-screen widget the pictures it may show.
const cap = () => { const C = typeof window !== 'undefined' && window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.nativePromise ? C : null; };
export const wgAvail = () => !!cap();
export async function wgSet(items) {
  const C = cap(); if (!C) return 0;
  await C.nativePromise('Widget', 'begin', {});
  for (const it of items) await C.nativePromise('Widget', 'add', it);
  const r = await C.nativePromise('Widget', 'commit', {}); return (r && r.count) || 0;
}
