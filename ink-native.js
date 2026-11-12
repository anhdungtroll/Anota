// Optional: on the Android app, strokes are read by Google ML Kit (on-device). In a browser this does nothing and Anota uses its built-in reader.
const cap = () => { const C = typeof window !== 'undefined' && window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.nativePromise ? C : null; };
export const nativeAvailable = () => !!cap();
let ready = null, failed = 0;
async function ensure() {
  const C = cap(); if (!C || failed > 2) return false;
  ready ||= C.nativePromise('Ink', 'download', { lang: 'en-US' }).then(() => true).catch((e) => { ready = null; failed++; console.warn('ML Kit model', e); return false; });
  return ready;
}
/** strokes: [{p:[x,y,pressure,...]}] -> candidate texts (best first), or null when unavailable */
export async function recognizeNative(strokes, w, h) {
  const C = cap(); if (!C || !(await ensure())) return null;
  try {
    const arr = strokes.map((s) => { const pts = []; for (let i = 0; i < s.p.length; i += 3) pts.push([Math.round(s.p[i] * 10) / 10, Math.round(s.p[i + 1] * 10) / 10]); return pts; });
    const r = await C.nativePromise('Ink', 'recognize', { lang: 'en-US', strokes: arr, width: Math.round(w), height: Math.round(h) });
    return r && r.candidates && r.candidates.length ? r.candidates.map((x) => String(x).trim()).filter(Boolean) : null;
  } catch (e) { console.warn('ML Kit', e); return null; }
}

/** debug: step-by-step check, returns lines of text */
export async function nativeDiag() {
  const L = [], C = typeof window !== 'undefined' && window.Capacitor;
  L.push('Capacitor bridge: ' + (C ? 'found' : 'NOT found (running in a browser)'));
  L.push('Native app: ' + (C && C.isNativePlatform && C.isNativePlatform() ? 'yes' : 'no'));
  if (!cap()) { L.push('Reader in use: Tesseract (built-in)'); return L; }
  try { await C.nativePromise('Ink', 'download', { lang: 'en-US' }); L.push('ML Kit model: ready'); }
  catch (e) { L.push('ML Kit model: FAILED - ' + (e && (e.message || e))); L.push('Reader in use: Tesseract (built-in)'); return L; }
  try {
    const vline = [[[10, 5], [10, 15], [10, 25], [10, 35], [10, 45]]];
    const r = await C.nativePromise('Ink', 'recognize', { lang: 'en-US', strokes: vline, width: 20, height: 50 });
    L.push('Test stroke read as: ' + JSON.stringify(r.candidates));
    L.push('Reader in use: ML Kit (Google, on-device)');
  } catch (e) { L.push('ML Kit read: FAILED - ' + (e && (e.message || e))); L.push('Reader in use: Tesseract (built-in)'); }
  return L;
}

