// Anota OCR worker: runs the Tesseract engine (tesseract.js-core, Apache-2.0) fully offline.
// Messages in : {t:'init', base, langs:['eng','vie']}   {t:'rec', id, buf:ArrayBuffer}
// Messages out: {t:'ready'}  {t:'err', id?, msg}  {t:'res', id, tsv}
let M = null, api = null, langKey = '';
const post = (m) => self.postMessage(m);
const simdOK = () => WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
async function init(base, langs) {
  if (!M) {
    if (!simdOK()) throw new Error('This browser cannot run the text engine (needs WebAssembly SIMD).');
    importScripts(base + 'tesseract-core-simd-lstm.wasm.js');
    M = await self.TesseractCore({});
  }
  const key = langs.join('+');
  if (api && key === langKey) return;
  if (api) { try { api.End(); } catch {} api = null; }
  try { M.FS.mkdir('/tessdata'); } catch {}
  for (const l of langs) {
    let have = false; try { M.FS.stat('/tessdata/' + l + '.traineddata'); have = true; } catch {}
    if (!have) {
      const r = await fetch(base + l + '.traineddata');
      if (!r.ok) throw new Error('Could not load language data: ' + l);
      M.FS.writeFile('/tessdata/' + l + '.traineddata', new Uint8Array(await r.arrayBuffer()));
    }
  }
  api = new M.TessBaseAPI();
  const st = api.Init('/tessdata', key, 1, '');        // 1 = LSTM only
  if (st === -1) throw new Error('Text engine could not start');
  api.SetVariable('tessedit_pageseg_mode', '3');         // fully automatic page layout
  api.SetVariable('user_defined_dpi', '150');
  api.SetVariable('preserve_interword_spaces', '1');
  langKey = key;
}
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.t === 'init') { await init(m.base, m.langs); post({ t: 'ready' }); }
    else if (m.t === 'rec') {
      if (!api) throw new Error('not ready');
      M.FS.writeFile('/input', new Uint8Array(m.buf));
      if (api.SetImageFile(1, 0) === 1) throw new Error('image not readable');
      api.Recognize(null);
      post({ t: 'res', id: m.id, tsv: api.GetTSVText() });
    } else if (m.t === 'end') { try { api && api.End(); } catch {} api = null; M = null; langKey = ''; self.close(); }
  } catch (err) { post({ t: 'err', id: m.id, msg: String(err && err.message || err) }); }
};
