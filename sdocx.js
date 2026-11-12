// Samsung Notes (.sdocx) reader. Turns the file into pages of pen strokes and pictures that Anota can open.
// The file layout was worked out by the open-source community (twangodev/sdocx, GPL-3.0; musaab.io write-up). Read-only: Anota never writes .sdocx.
const td16 = new TextDecoder('utf-16le'), td8 = new TextDecoder('utf-8');

class R {                                                              // little-endian reader over a byte range
  constructor(u8, pos = 0, end = u8.length) { this.u = u8; this.dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); this.p = pos; this.end = end; }
  need(n) { if (this.p + n > this.end) throw new Error('truncated'); }
  u8() { this.need(1); return this.u[this.p++]; }
  u16() { this.need(2); const v = this.dv.getUint16(this.p, true); this.p += 2; return v; }
  i16() { this.need(2); const v = this.dv.getInt16(this.p, true); this.p += 2; return v; }
  u32() { this.need(4); const v = this.dv.getUint32(this.p, true); this.p += 4; return v; }
  i32() { this.need(4); const v = this.dv.getInt32(this.p, true); this.p += 4; return v; }
  f32() { this.need(4); const v = this.dv.getFloat32(this.p, true); this.p += 4; return v; }
  f64() { this.need(8); const v = this.dv.getFloat64(this.p, true); this.p += 8; return v; }
  skip(n) { this.need(n); this.p += n; }
  left() { return this.end - this.p; }
  utf16() { const n = this.u16(); this.need(n * 2); const s = td16.decode(this.u.subarray(this.p, this.p + n * 2)); this.p += n * 2; return s; }
  utf8() { const n = this.u16(); this.need(n); const s = td8.decode(this.u.subarray(this.p, this.p + n)); this.p += n; return s; }
  mask() { const n = this.u8(); this.need(n); const m = this.u.subarray(this.p, this.p + n); this.p += n; return m; }
}
const has = (m, bit) => ((m[bit >> 3] || 0) & (1 << (bit & 7))) !== 0;
const maskEmpty = (m) => m.every((b) => b === 0);

/** one typed frame: size, kind, flexible offset, two masks, fixed bytes, flexible bytes */
function frame(r) {
  const size = r.u32(); if (size < 12) throw new Error('bad frame');
  r.need(size - 4); const start = r.p, end = r.p + size - 4; r.p = end;
  const h = new R(r.u, start, end), kind = h.i16(), flexOff = h.u32(), props = h.mask(), fields = h.mask();
  const fixedEnd = (flexOff === 0 && maskEmpty(fields)) ? size : flexOff;
  if (fixedEnd < (h.p - start) + 4 + 4 && fixedEnd !== size) { /* tolerated below */ }
  if (fixedEnd < h.p - start + 4 || fixedEnd > size) throw new Error('bad frame offsets');
  return { kind, props, fields, fixed: new R(r.u, h.p, start + fixedEnd - 4), flex: new R(r.u, start + fixedEnd - 4, end) };
}

/** the common first frame of every object: visibility, bounding box, rotation */
function baseMeta(r) {
  const f = frame(r); if (f.kind !== 0) throw new Error('no base frame');
  const x = f.fixed; x.u32(); x.utf8(); x.skip(8);
  const bbox = [x.f64(), x.f64(), x.f64(), x.f64()];
  const rot = has(f.fields, 0) ? f.flex.f32() : 0;
  return { visible: has(f.props, 3), bbox, rot };
}

const sd = (raw, div) => ((raw & 0x7fff) / div) * ((raw & 0x8000) ? -1 : 1);

function readStroke(payload) {
  const r = new R(payload), base = baseMeta(r), f = frame(r);
  if (f.kind !== 1) throw new Error('not a stroke');
  const x = f.fixed, n = x.u16(), compressed = has(f.props, 0), stylus = has(f.props, 2);
  const bytes = n === 0 ? 0 : compressed ? 16 + (n - 1) * 4 + (2 + (stylus ? 2 : 0)) * (4 + (n - 1) * 2) : n * (24 + (stylus ? 8 : 0));
  if (x.left() !== bytes + 2) throw new Error('stroke size mismatch');
  const xs = new Float64Array(n), ys = new Float64Array(n), pr = new Float64Array(n);
  if (n) {
    if (compressed) {
      let px = Math.fround(x.f64()), py = Math.fround(x.f64()); xs[0] = px; ys[0] = py;
      for (let i = 1; i < n; i++) { px = Math.fround(px + sd(x.u16(), 32)); py = Math.fround(py + sd(x.u16(), 32)); xs[i] = px; ys[i] = py; }
      let v = x.f32(); pr[0] = v; for (let i = 1; i < n; i++) { v = Math.fround(v + sd(x.u16(), 4096)); pr[i] = v; }
    } else {
      for (let i = 0; i < n; i++) { xs[i] = x.f64(); ys[i] = x.f64(); }
      for (let i = 0; i < n; i++) pr[i] = x.f32();
    }
  }
  let argb = null, size = null;                                          // style: colour and pen size come first in the flexible data
  const fl = f.flex;
  if (has(f.fields, 0)) fl.i32();
  if (has(f.fields, 1)) fl.i32();
  if (has(f.fields, 2)) argb = fl.u32();
  if (has(f.fields, 3)) size = fl.f32();
  for (let i = 0; i < n; i++) if (!isFinite(xs[i]) || !isFinite(ys[i])) throw new Error('bad point');
  return { visible: base.visible, n, xs, ys, pr, argb, size };
}

/** one image object: where it sits and which media file it uses */
function readImage(payload) {
  const r = new R(payload), base = baseMeta(r);
  frame(r);                                                              // shape base
  const s = frame(r); if (s.kind !== 7) throw new Error('not an image');
  const x = s.fixed; x.u32(); x.skip(32); x.f32(); x.skip(x.u32()); x.skip(x.u8() * 16);
  const fl = s.flex;
  if (has(s.fields, 0)) fl.skip(fl.u32());
  if (has(s.fields, 1)) fl.u8();
  if (has(s.fields, 2)) fl.i32();
  if (has(s.fields, 3)) throw new Error('unsupported image fill');
  if (has(s.fields, 4)) fl.i32();
  let media = -1;
  if (has(s.fields, 5)) { const size = fl.u32(), kind = fl.u8(), p0 = fl.p; if (kind === 2 && size >= 5) { fl.u8(); media = fl.i32(); } fl.p = p0 + size; }
  return { visible: base.visible, bbox: base.bbox, rot: base.rot, media };
}

function readObject(r, depth = 0) {
  if (depth > 40) throw new Error('too deep');
  const type = r.u8(), kids = r.u16(), size = r.u32();
  if (size < 32) throw new Error('bad object size');
  const start = r.p, end = start + size - 32; r.skip(size);
  const children = []; for (let i = 0; i < kids; i++) children.push(readObject(r, depth + 1));
  return { type, start, end, children };
}

function readPage(u8) {
  const r = new R(u8), layerOff = r.u32(), propOff = r.u32();
  const headEnd = propOff === 0 ? layerOff : propOff;
  if (headEnd > layerOff || layerOff > u8.length) throw new Error('bad page header');
  const h = new R(u8, 8, headEnd); h.mask(); const fmask = h.mask(); h.u32();
  const width = h.u32(), height = h.u32(); h.u32(); h.u32(); h.utf16();
  let ver = null; if (h.left() >= 8) h.skip(8); if (h.left() >= 4) ver = h.u32();
  const bg = { color: null, imageId: null, imageMode: null, templateType: null, templateUri: null, pdf: [] };
  if (propOff) try {                                                     // page flexible fields: background colour, picture, template, PDF paper
    const f = new R(u8, propOff, layerOff);
    for (let bit = 0; bit <= 9; bit++) {
      if (!has(fmask, bit)) continue;
      if (bit === 0) f.skip(32);
      else if (bit === 1) { const c = f.u16(); for (let i = 0; i < c; i++) f.utf16(); }
      else if (bit === 2) bg.templateUri = f.utf16();
      else if (bit === 3) bg.imageId = f.u32();
      else if (bit === 4) bg.imageMode = f.u32();
      else if (bit === 5) bg.color = f.u32();
      else if (bit === 6 || bit === 7) f.u32();
      else if (bit === 8) {
        const c = f.u16();
        for (let i = 0; i < c; i++) {
          const media = f.i32(), index = f.i32(), q = [f.u32(), f.u32(), f.u32(), f.u32()];
          const rect = ver != null && ver >= 2034 ? q.map((v) => v | 0) : q.map((v) => { const b = new DataView(new ArrayBuffer(4)); b.setUint32(0, v); return b.getFloat32(0); });
          bg.pdf.push({ media, index, rect });
        }
      } else if (bit === 9) bg.templateType = f.u32();
    }
  } catch { /* a background we cannot read is skipped; the ink still imports */ }
  const l = new R(u8, layerOff), count = l.u16(); l.u16();
  if (!count) throw new Error('no layers');
  const layers = [];
  for (let i = 0; i < count; i++) {
    const hs = l.u32(); if (hs < 14 || hs > 16384) throw new Error('bad layer');
    const hdr = new R(u8, l.p, l.p + hs - 4); l.skip(hs - 4);
    hdr.u32(); const flags = hdr.mask();
    const nObj = l.u32(), objs = []; for (let k = 0; k < nObj; k++) objs.push(readObject(l));
    l.skip(32);
    layers.push({ hidden: has(flags, 0), objs });
  }
  return { width, height, layers, bg };
}

/* ---- zip (the format Samsung wraps everything in) ---- */
const MAX_ENTRY = 256 * 1024 * 1024;                                       // a note never needs more; stops a zip bomb
async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter();
  w.write(bytes).catch(() => {}); w.close().catch(() => {});
  const rd = ds.readable.getReader(), parts = []; let total = 0;
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    total += value.length; if (total > MAX_ENTRY) { rd.cancel().catch(() => {}); throw new Error('file too large'); }
    parts.push(value);
  }
  const out = new Uint8Array(total); let o = 0; for (const c of parts) { out.set(c, o); o += c.length; }
  return out;
}
async function unzip(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= 0 && i >= u8.length - 70000; i--) {   // Samsung appends a second end tag after the zip: look backwards for the real end record
    if (dv.getUint32(i, true) !== 0x06054b50) continue;
    const cdSize = dv.getUint32(i + 12, true), cdOff = dv.getUint32(i + 16, true);
    if (cdSize > 0 && cdOff + cdSize <= i && dv.getUint32(cdOff, true) === 0x02014b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This is not a Samsung Notes file.');
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const files = new Map();
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('damaged file');
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = td8.decode(u8.subarray(p + 46, p + 46 + nl));
    files.set(name, { method, csize, lo });
    p += 46 + nl + el + cl;
  }
  const read = async (name) => {
    const e = files.get(name); if (!e) return null;
    const ds = e.lo + 30 + dv.getUint16(e.lo + 26, true) + dv.getUint16(e.lo + 28, true), raw = u8.subarray(ds, ds + e.csize);
    return e.method === 0 ? raw : e.method === 8 ? inflateRaw(raw) : null;
  };
  return { names: [...files.keys()], read };
}

const mimeOf = (n) => /\.png$/i.test(n) ? 'image/png' : /\.jpe?g$/i.test(n) ? 'image/jpeg' : /\.webp$/i.test(n) ? 'image/webp' : /\.gif$/i.test(n) ? 'image/gif' : /\.bmp$/i.test(n) ? 'image/bmp' : '';

/**
 * Read a .sdocx. Returns { pages: [{ w, h, strokes: [{ hl, rgb, w, pts: [x, y, pressure, ...] }], images: [{ x, y, w, h, rot, mime, bytes }] }], skipped: { strokes, objects, pdf } }
 * Coordinates are Samsung's own page pixels; the caller scales them to its page.
 */
export async function readSdocx(buf) {
  const z = await unzip(new Uint8Array(buf));
  const names = z.names, pageNames = names.filter((n) => /\.page$/i.test(n));
  if (!pageNames.length) throw new Error('This Samsung Notes file has no pages.');
  let order = null;
  try {                                                                  // pageIdInfo.dat is the real page order
    const m = await z.read('pageIdInfo.dat');
    if (m) { const r = new R(m, 32), c = r.u16(); order = []; for (let i = 0; i < c; i++) { order.push(r.utf16() + '.page'); r.skip(32); } }
  } catch { order = null; }
  const list = order && order.every((n) => names.includes(n)) && order.length ? order : pageNames.slice().sort();
  const mediaById = new Map();
  for (const n of names) { if (!n.startsWith('media/')) continue; const id = parseInt(n.split('/').pop().split('@')[0], 10); if (!isNaN(id)) mediaById.set(id, n); }
  const out = { pages: [], pdf: null, bgImages: new Map(), skipped: { strokes: 0, objects: 0, pdf: false } };
  for (const name of list) {
    const bytes = await z.read(name); if (!bytes) continue;
    const pg = readPage(bytes), page = { w: pg.width || 1080, h: pg.height || 1527, strokes: [], images: [], bg: pg.bg };
    const walk = async (objs) => {
      for (const o of objs) {
        const payload = bytes.subarray(o.start, o.end);
        try {
          if (o.type === 1) {
            const s = readStroke(payload);
            if (s.visible && s.n >= 1) {
              const a = s.argb == null ? 255 : s.argb >>> 24, rgb = s.argb == null ? 0 : s.argb & 0xffffff, pts = new Array(s.n * 3);
              for (let i = 0; i < s.n; i++) { pts[3 * i] = s.xs[i]; pts[3 * i + 1] = s.ys[i]; pts[3 * i + 2] = Math.min(1, Math.max(0.02, s.pr[i] || 0.5)); }
              page.strokes.push({ hl: a < 250, rgb, w: s.size == null ? 0.8 : s.size, pts });
            }
          } else if (o.type === 3) {
            const im = readImage(payload), file = mediaById.get(im.media), mime = file ? mimeOf(file) : '';
            if (im.visible && file && mime) {
              const data = await z.read(file);
              if (data) page.images.push({ x: im.bbox[0], y: im.bbox[1], w: im.bbox[2] - im.bbox[0], h: im.bbox[3] - im.bbox[1], rot: im.rot, mime, bytes: data });
            } else if (im.visible) out.skipped.objects++;
          } else if (o.type !== 4) out.skipped.objects++;               // text boxes, shapes, tables and the like are not brought over yet
        } catch { if (o.type === 1) out.skipped.strokes++; else out.skipped.objects++; }
        if (o.children.length) await walk(o.children);
      }
    };
    for (const layer of pg.layers) if (!layer.hidden) await walk(layer.objs);
    out.pages.push(page);
  }
  // pictures and PDFs used as page backgrounds
  const wantPdf = out.pages.flatMap((p) => p.bg.pdf).find((r) => r.index >= 0 && mediaById.has(r.media));
  if (wantPdf) { const f = mediaById.get(wantPdf.media); if (/\.pdf$/i.test(f)) { out.pdf = { media: wantPdf.media, bytes: await z.read(f) }; } }
  for (const p of out.pages) {
    p.bg.pdf = p.bg.pdf.filter((r) => out.pdf && r.media === out.pdf.media && r.index >= 0);
    const id = p.bg.imageId, f = id != null && id !== 0xffffffff ? mediaById.get(id) : null;
    if (f && mimeOf(f) && !out.bgImages.has(id)) { const d = await z.read(f); if (d) out.bgImages.set(id, { mime: mimeOf(f), bytes: d }); }
  }
  out.skipped.pdf = names.some((n) => /\.pdf$/i.test(n)) && !out.pdf;
  return out;
}

/**
 * Samsung page colour and built-in line / dot paper as Anota template ops, scaled by k (Samsung pixels to Anota pixels).
 * Types 1-3 are ruled lines (small, medium, large), 7-9 are dot grids; sizes follow the app's own formulas. Other types are not drawn.
 * Returns { ops, tint } or null when the page is plain white.
 */
export function samsungPaper(bg, w, h, k, pageH) {
  const ops = [];
  const argb = bg && bg.color != null ? bg.color >>> 0 : 0xffffffff, a = argb >>> 24, r = (argb >> 16) & 255, g = (argb >> 8) & 255, b = argb & 255;
  const dark = (0.299 * r + 0.587 * g + 0.114 * b) < 100;
  const tint = a > 0 && argb !== 0xffffffff;
  const W = 800, H = pageH;
  if (tint) ops.push(['r', 0, 0, W, H, 0, '#000000', 0, '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')]);
  const t = bg ? bg.templateType : null;
  if (t != null && ((t >= 1 && t <= 3) || (t >= 7 && t <= 9))) {
    const density = Math.min(w, h) / 360, ruled = t <= 3, size = [12, 17, 28][(t - (ruled ? 1 : 7))];
    const pitch = size * 1.35 * density, tile = Math.ceil(pitch), top = 10 * density * (pitch / tile);
    const col = dark ? '#5d647c' : '#c3c9d8';
    if (ruled) {
      const lw = Math.max(0.5 * density, 1) * (pitch / tile) * k;
      for (let y = top; y < h && ops.length < 400; y += pitch) ops.push(['l', 0, y * k, W, y * k, Math.max(0.6, lw), col]);
    } else {
      const px = tile + 1.5 * density, rad = Math.max(2 * density, 1) / 2 * k, rr = Math.max(0.7, rad);
      for (let y = top; y < h; y += pitch) for (let x = px / 2; x < w && ops.length < 6000; x += px) ops.push(['r', x * k - rr, y * k - rr, rr * 2, rr * 2, 0, col, rr, col]);
    }
  }
  return ops.length ? { ops, tint, dark } : null;
}
