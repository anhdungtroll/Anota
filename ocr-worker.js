// Anota OCR worker: runs the Tesseract engine (tesseract.js-core, Apache-2.0) fully offline.
// Messages in : {t:'init', base, langs:['eng','vie'], dataBase?}   {t:'rec', id, buf:ArrayBuffer, psm?, lang?}
// Messages out: {t:'ready'}  {t:'err', id?, msg}  {t:'res', id, tsv}
// Several engines can be open at once (e.g. English+Vietnamese, and a Vietnamese-only second opinion).
let M = null, main = '', dataRoot = '', baseRoot = '';
const apis = new Map();                 // lang key -> {api, psm}
const post = (m) => self.postMessage(m);
const simdOK = () => WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
async function open(key) {
  if (apis.has(key)) return apis.get(key);
  if (!M) {
    if (!simdOK()) throw new Error('This browser cannot run the text engine (needs WebAssembly SIMD).');
    importScripts(baseRoot + 'tesseract-core-simd-lstm.wasm.js');
    M = await self.TesseractCore({});
  }
  try { M.FS.mkdir('/tessdata'); } catch {}
  for (const l of key.split('+')) {
    const fn = '/tessdata/' + l + '.traineddata'; let have = false; try { M.FS.stat(fn); have = true; } catch {}
    if (!have) {
      const r = await fetch(dataRoot + l + '.traineddata');
      if (!r.ok) throw new Error('Could not load language data: ' + l);
      M.FS.writeFile(fn, new Uint8Array(await r.arrayBuffer()));
    }
  }
  const api = new M.TessBaseAPI();
  if (api.Init('/tessdata', key, 1, '') === -1) throw new Error('Text engine could not start');        // 1 = LSTM only
  api.SetVariable('tessedit_pageseg_mode', '3');
  api.SetVariable('user_defined_dpi', '150');
  api.SetVariable('preserve_interword_spaces', '1');
  const e = { api, psm: '3' }; apis.set(key, e); return e;
}
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.t === 'init') {
      baseRoot = m.base; dataRoot = m.dataBase || m.base; const key = m.langs.join('+');
      if (key !== main) { for (const v of apis.values()) { try { v.api.End(); } catch {} } apis.clear(); main = key; }
      await open(main); post({ t: 'ready' });
    } else if (m.t === 'rec') {
      const en = await open(m.lang || main), psm = String(m.psm || 3);
      if (psm !== en.psm) { en.api.SetVariable('tessedit_pageseg_mode', psm); en.psm = psm; }
      const wl = m.wl || ''; if (wl !== en.wl) { en.api.SetVariable('tessedit_char_whitelist', wl); en.wl = wl; }
      M.FS.writeFile('/input', new Uint8Array(m.buf));
      if (en.api.SetImageFile(1, 0) === 1) throw new Error('image not readable');
      en.api.Recognize(null);
      post({ t: 'res', id: m.id, tsv: en.api.GetTSVText() });
    } else if (m.t === 'end') { for (const v of apis.values()) { try { v.api.End(); } catch {} } apis.clear(); M = null; self.close(); }
  } catch (err) { post({ t: 'err', id: m.id, msg: String(err && err.message || err) }); }
};
