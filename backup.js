// One-file backup and restore of everything in Anota (notes, PDFs, pictures, audio, folders, trash, settings).
// File layout: "ANOTABK1\n" then records: [u32 header length][header JSON][payload bytes]. Records stream in and out,
// so big PDFs never have to sit in memory twice. Pictures and PDFs are copied byte for byte: nothing is re-compressed.
import { db } from './db.js';
const MAGIC = 'ANOTABK1\n', enc = new TextEncoder(), dec = new TextDecoder();

function rec(parts, hdr, payload) {
  const body = payload == null ? new Uint8Array(0) : typeof payload === 'string' ? enc.encode(payload) : payload;
  const n = body.size != null ? body.size : body.byteLength;
  const h = enc.encode(JSON.stringify({ ...hdr, n }));
  const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, h.length, true);
  parts.push(len, h, body);
}
const refsOf = (doc) => { const out = new Set(); for (const pg of doc.pages || []) for (const it of pg.items || []) if (it.ref && (it.k === 'img' || it.k === 'audio')) out.add(it.ref); return out; };

export async function exportAll({ onProgress, prefsText } = {}) {
  const parts = [enc.encode(MAGIC)], metas = await db.listMeta(), done = new Set();
  let i = 0, notes = 0, files = 0;
  rec(parts, { t: 'info', app: 'anota', made: Date.now(), count: metas.length });
  for (const m of metas) {
    onProgress && onProgress(i++, metas.length, m.title);
    rec(parts, { t: 'meta', k: m.id }, JSON.stringify(m));
    if (m.type === 'folder') continue;
    const doc = await db.getDoc(m.id); if (!doc) continue;
    notes++;
    rec(parts, { t: 'doc', k: m.id }, JSON.stringify(doc));
    if ((doc.pages || []).some((p) => p.pdf != null)) { const buf = await db.getPdf(m.id); if (buf) { rec(parts, { t: 'pdf', k: m.id }, new Uint8Array(buf)); files++; } }
    for (const ref of refsOf(doc)) {
      if (done.has(ref)) continue; done.add(ref);
      const b = await db.getAsset(ref); if (b) { rec(parts, { t: 'asset', k: ref, ct: b.type || '' }, b); files++; }
    }
    if (parts.length > 400) { const blob = new Blob(parts); parts.length = 0; parts.push(blob); }      // let the browser keep big chunks on disk
  }
  for (const t of await db.listTpl().catch(() => [])) {
    rec(parts, { t: 'tpl', k: t.id }, JSON.stringify(t));
    for (const ref of refsOf({ pages: [t] })) { if (done.has(ref)) continue; done.add(ref); const b = await db.getAsset(ref); if (b) { rec(parts, { t: 'asset', k: ref, ct: b.type || '' }, b); files++; } }
  }
  if (prefsText) rec(parts, { t: 'prefs' }, prefsText);
  rec(parts, { t: 'end' });
  return { blob: new Blob(parts, { type: 'application/octet-stream' }), notes, files };
}

async function* records(file) {
  const head = dec.decode(await file.slice(0, MAGIC.length).arrayBuffer());
  if (head !== MAGIC) throw new Error('This is not an Anota backup file.');
  let pos = MAGIC.length;
  while (pos + 4 <= file.size) {
    const hl = new DataView(await file.slice(pos, pos + 4).arrayBuffer()).getUint32(0, true);
    if (hl > 1e6 || pos + 4 + hl > file.size) throw new Error('The backup file is damaged or incomplete.');
    const h = JSON.parse(dec.decode(await file.slice(pos + 4, pos + 4 + hl).arrayBuffer()));
    const start = pos + 4 + hl, end = start + (h.n || 0);
    if (end > file.size) throw new Error('The backup file is damaged or incomplete.');
    yield { h, start, end };
    pos = end;
    if (h.t === 'end') return;
  }
  throw new Error('The backup file is incomplete (no end marker).');
}

/** quick look inside a backup: what is in it, without restoring anything */
export async function inspect(file) {
  const s = { notes: 0, folders: 0, files: 0, made: 0, titles: [] };
  for await (const { h, start, end } of records(file)) {
    if (h.t === 'info') s.made = h.made;
    else if (h.t === 'meta') { const m = JSON.parse(dec.decode(await file.slice(start, end).arrayBuffer())); if (m.type === 'folder') s.folders++; else { s.notes++; if (s.titles.length < 4) s.titles.push(m.title); } }
    else if (h.t === 'pdf' || h.t === 'asset') s.files++;
  }
  return s;
}

/** mode: 'merge' keeps whichever copy of a note was edited last; 'replace' wipes first. Returns counts. */
export async function restore(file, { mode = 'merge', onProgress, prefs = true } = {}) {
  const out = { added: 0, updated: 0, skipped: 0, files: 0 }, existing = new Map();
  if (mode === 'replace') await db.clearAll(); else for (const m of await db.listMeta()) existing.set(m.id, m);
  let skip = null, n = 0, prefsText = null;
  const text = async (r) => dec.decode(await file.slice(r.start, r.end).arrayBuffer());
  for await (const r of records(file)) {
    const { h } = r;
    if (h.t === 'meta') {
      const m = JSON.parse(await text(r)); skip = null; onProgress && onProgress(++n, m.title);
      const have = existing.get(m.id);
      if (have && (have.updated || 0) >= (m.updated || 0) && !have.trashed === !m.trashed && mode === 'merge') { skip = m.id; out.skipped++; continue; }
      await db.putRaw('meta', null, m); have ? out.updated++ : out.added++;
    } else if (h.t === 'doc') { if (skip === h.k) continue; await db.putRaw('docs', null, JSON.parse(await text(r))); }
    else if (h.t === 'pdf') { if (skip === h.k) continue; await db.putRaw('pdfs', h.k, await file.slice(r.start, r.end).arrayBuffer()); out.files++; }
    else if (h.t === 'asset') { if (mode === 'merge' && await db.getAsset(h.k)) continue; await db.putRaw('assets', h.k, file.slice(r.start, r.end, h.ct || '')); out.files++; }
    else if (h.t === 'tpl') await db.putRaw('tpl', null, JSON.parse(await text(r)));
    else if (h.t === 'prefs') prefsText = await text(r);
  }
  if (prefs && prefsText) { try { localStorage.setItem('inknote.prefs', prefsText); } catch {} }
  try { await db.clearIdx(); } catch {}                      // the search index is rebuilt from the restored notes
  return out;
}
