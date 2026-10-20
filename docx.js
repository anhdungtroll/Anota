// Word (.docx) -> PDF. Reads the document in the browser, lays text, lists, tables and pictures out
// on A4 pages and returns a PDF (one JPEG per page) that the PDF annotator can open.
import { buildPdf } from './pdfout.js';

/* ---------- zip ---------- */
async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function readZip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf), files = new Map();
  let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip');
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const td = new TextDecoder();
  for (let i = 0; i < count; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nl));
    const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true), start = off + 30 + lnl + lxl;
    files.set(name, { method, data: u8.subarray(start, start + csize) });
    p += 46 + nl + xl + cl;
  }
  return {
    has: (n) => files.has(n),
    async get(n) { const f = files.get(n); if (!f) return null; return f.method === 0 ? f.data : inflateRaw(f.data); },
    async text(n) { const b = await this.get(n); return b ? td.decode(b) : null; },
  };
}

/* ---------- xml helpers ---------- */
const parseXml = (t) => new DOMParser().parseFromString(t, 'application/xml');
const kids = (el, name) => (el ? [...el.children].filter((c) => c.localName === name) : []);
const kid = (el, name) => kids(el, name)[0] || null;
const attr = (el, name) => (el ? el.getAttribute('w:' + name) ?? el.getAttribute(name) : null);
const isOn = (el) => !!el && !['0', 'false', 'off', 'none'].includes((attr(el, 'val') || 'true').toLowerCase());
const HL = { yellow: '#fff59d', green: '#b9f6ca', cyan: '#b2ebf2', magenta: '#f8bbd0', red: '#ffcdd2', blue: '#bbdefb', lightGray: '#e0e0e0', darkYellow: '#fbe9a8' };

function fontFamily(name) {
  const n = (name || '').toLowerCase();
  if (/courier|consolas|mono|menlo/.test(n)) return 'ui-monospace,Menlo,Consolas,monospace';
  if (/times|georgia|garamond|cambria|palatino|serif|book/.test(n) && !/sans/.test(n)) return 'Georgia,"Times New Roman",serif';
  return 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
}

export async function docxToPdf(file, onProgress = () => {}) {
  const zip = await readZip(await file.arrayBuffer());
  const docText = await zip.text('word/document.xml');
  if (!docText) throw new Error('no document');
  const doc = parseXml(docText), body = doc.getElementsByTagNameNS('*', 'body')[0];
  const styleDoc = (await zip.text('word/styles.xml')) ? parseXml(await zip.text('word/styles.xml')) : null;
  const numDoc = (await zip.text('word/numbering.xml')) ? parseXml(await zip.text('word/numbering.xml')) : null;
  const relDoc = (await zip.text('word/_rels/document.xml.rels')) ? parseXml(await zip.text('word/_rels/document.xml.rels')) : null;

  // --- relationships -> media
  const rels = new Map();
  if (relDoc) for (const r of relDoc.getElementsByTagNameNS('*', 'Relationship')) rels.set(r.getAttribute('Id'), r.getAttribute('Target'));
  const imgCache = new Map();
  async function loadImage(rid) {
    if (imgCache.has(rid)) return imgCache.get(rid);
    let bmp = null;
    try {
      let t = rels.get(rid); if (t) { t = t.replace(/^\//, ''); const path = t.startsWith('word/') ? t : 'word/' + t; const bytes = await zip.get(path.replace('word/../', '')); if (bytes) bmp = await createImageBitmap(new Blob([bytes])); }
    } catch {}
    imgCache.set(rid, bmp); return bmp;
  }

  // --- styles
  const styles = new Map();
  let defRun = { sz: 22 }, defPar = {};
  const readRun = (rPr) => {
    const o = {}; if (!rPr) return o;
    const b = kid(rPr, 'b'), i = kid(rPr, 'i'), u = kid(rPr, 'u'), st = kid(rPr, 'strike'), c = kid(rPr, 'color'), sz = kid(rPr, 'sz'), hl = kid(rPr, 'highlight'), sh = kid(rPr, 'shd'), f = kid(rPr, 'rFonts'), va = kid(rPr, 'vertAlign'), caps = kid(rPr, 'caps');
    if (b) o.b = isOn(b); if (i) o.i = isOn(i); if (u) o.u = attr(u, 'val') !== 'none'; if (st) o.strike = isOn(st);
    if (c && /^[0-9a-f]{6}$/i.test(attr(c, 'val') || '')) o.color = '#' + attr(c, 'val');
    if (sz) o.sz = +attr(sz, 'val') || undefined;
    if (hl && HL[attr(hl, 'val')]) o.hl = HL[attr(hl, 'val')];
    else if (sh && /^[0-9a-f]{6}$/i.test(attr(sh, 'fill') || '')) o.hl = '#' + attr(sh, 'fill');
    if (f) o.font = attr(f, 'ascii') || attr(f, 'hAnsi');
    if (va) o.va = attr(va, 'val'); if (caps) o.caps = isOn(caps);
    return o;
  };
  const readPar = (pPr) => {
    const o = {}; if (!pPr) return o;
    const jc = kid(pPr, 'jc'), sp = kid(pPr, 'spacing'), ind = kid(pPr, 'ind'), np = kid(pPr, 'numPr'), pb = kid(pPr, 'pageBreakBefore'), ps = kid(pPr, 'pStyle');
    if (jc) o.jc = attr(jc, 'val');
    if (sp) { if (attr(sp, 'before') != null) o.before = +attr(sp, 'before'); if (attr(sp, 'after') != null) o.after = +attr(sp, 'after'); if (attr(sp, 'line') != null) o.line = +attr(sp, 'line'); o.lineRule = attr(sp, 'lineRule'); }
    if (ind) { if (attr(ind, 'left') != null || attr(ind, 'start') != null) o.left = +(attr(ind, 'left') ?? attr(ind, 'start')); if (attr(ind, 'hanging') != null) o.hanging = +attr(ind, 'hanging'); if (attr(ind, 'firstLine') != null) o.first = +attr(ind, 'firstLine'); if (attr(ind, 'right') != null) o.right = +attr(ind, 'right'); }
    if (np) { const id = kid(np, 'numId'), lv = kid(np, 'ilvl'); if (id) o.numId = attr(id, 'val'); o.ilvl = lv ? +attr(lv, 'val') : 0; }
    if (pb && isOn(pb)) o.pageBreakBefore = true;
    if (ps) o.style = attr(ps, 'val');
    return o;
  };
  if (styleDoc) {
    const dd = styleDoc.getElementsByTagNameNS('*', 'docDefaults')[0];
    if (dd) { defRun = { ...defRun, ...readRun(kid(kid(dd, 'rPrDefault'), 'rPr')) }; defPar = readPar(kid(kid(dd, 'pPrDefault'), 'pPr')); }
    for (const s of styleDoc.getElementsByTagNameNS('*', 'style')) {
      const id = attr(s, 'styleId'), based = kid(s, 'basedOn'), name = kid(s, 'name');
      styles.set(id, { based: based ? attr(based, 'val') : null, name: name ? attr(name, 'val') : '', run: readRun(kid(s, 'rPr')), par: readPar(kid(s, 'pPr')) });
    }
  }
  const styleChain = (id) => { const out = []; let g = 0; while (id && styles.has(id) && g++ < 12) { out.unshift(styles.get(id)); id = styles.get(id).based; } return out; };
  const HEAD = { title: 28, subtitle: 15, heading1: 20, heading2: 16, heading3: 14, heading4: 12, heading5: 11, heading6: 11 };
  function resolve(pp, runProps) {
    const chain = styleChain(pp.style);
    let par = { ...defPar }, run = { ...defRun };
    for (const s of chain) { par = { ...par, ...s.par }; run = { ...run, ...s.run }; }
    par = { ...par, ...pp };
    const nm = (chain.length ? chain[chain.length - 1].name : '').toLowerCase().replace(/\s+/g, '');
    if (HEAD[nm] && !chain.some((s) => s.run.sz)) { run.sz = HEAD[nm] * 2; if (run.b == null) run.b = true; }
    return { par, run: { ...run, ...runProps } };
  }

  // --- numbering
  const absFmt = new Map(), numToAbs = new Map();
  if (numDoc) {
    for (const a of numDoc.getElementsByTagNameNS('*', 'abstractNum')) {
      const lv = new Map();
      for (const l of kids(a, 'lvl')) { const f = kid(l, 'numFmt'), t = kid(l, 'lvlText'), pp = readPar(kid(l, 'pPr')); lv.set(+attr(l, 'ilvl'), { fmt: f ? attr(f, 'val') : 'bullet', text: t ? attr(t, 'val') : '', par: pp }); }
      absFmt.set(attr(a, 'abstractNumId'), lv);
    }
    for (const n of kids(numDoc.documentElement, 'num')) { const a = kid(n, 'abstractNumId'); if (a) numToAbs.set(attr(n, 'numId'), attr(a, 'val')); }
  }
  const counters = new Map();
  function listLabel(numId, ilvl) {
    const lv = absFmt.get(numToAbs.get(numId))?.get(ilvl);
    if (!lv) return { label: '•', par: {} };
    if (lv.fmt === 'bullet' || lv.fmt === 'none') return { label: ilvl % 2 ? '◦' : '•', par: lv.par };
    const key = numId; let c = counters.get(key); if (!c) { c = []; counters.set(key, c); }
    c[ilvl] = (c[ilvl] || 0) + 1; c.length = ilvl + 1;
    const n = c[ilvl];
    const txt = lv.fmt === 'lowerLetter' ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : lv.fmt === 'upperLetter' ? String.fromCharCode(64 + ((n - 1) % 26) + 1)
      : lv.fmt === 'lowerRoman' || lv.fmt === 'upperRoman' ? roman(n, lv.fmt === 'upperRoman') : String(n);
    return { label: txt + (lv.text && /\)$/.test(lv.text) ? ')' : '.'), par: lv.par };
  }
  const roman = (n, up) => { const m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let r = ''; for (const [v, s] of m) while (n >= v) { r += s; n -= v; } return up ? r.toUpperCase() : r; };

  // --- page geometry (twips -> px)
  const sect = kid(body, 'sectPr'), pgSz = sect && kid(sect, 'pgSz'), pgMar = sect && kid(sect, 'pgMar');
  const pwTw = pgSz ? +attr(pgSz, 'w') || 11906 : 11906, phTw = pgSz ? +attr(pgSz, 'h') || 16838 : 16838;
  const PW = 800, K = PW / (pwTw / 20), PHx = Math.round(phTw / 20 * K), tw2px = (t) => t / 20 * K;
  const mg = { l: tw2px(pgMar ? +attr(pgMar, 'left') || 1440 : 1440), r: tw2px(pgMar ? +attr(pgMar, 'right') || 1440 : 1440), t: tw2px(pgMar ? +attr(pgMar, 'top') || 1440 : 1440), b: tw2px(pgMar ? +attr(pgMar, 'bottom') || 1440 : 1440) };
  const SC = 1.6;                                   // render at higher density so it stays crisp when zoomed

  const pages = [];
  let cur = null;
  const newPage = () => {
    const cv = document.createElement('canvas'); cv.width = Math.round(PW * SC); cv.height = Math.round(PHx * SC);
    const g = cv.getContext('2d'); g.scale(SC, SC); g.fillStyle = '#fff'; g.fillRect(0, 0, PW, PHx);
    cur = { cv, g, y: mg.t }; pages.push(cur); return cur;
  };
  newPage();
  const bottom = () => PHx - mg.b;

  // --- inline tokens
  function fontOf(rp) {
    const px = Math.max(5, ((rp.sz || 22) / 2) * K * (rp.va ? 0.66 : 1));
    return { px, font: `${rp.i ? 'italic ' : ''}${rp.b ? 'bold ' : ''}${px}px ${fontFamily(rp.font)}` };
  }
  async function collect(node, rp0, out) {
    for (const ch of node.children) {
      const ln = ch.localName;
      if (ln === 'r') {
        const rp = { ...rp0, ...readRun(kid(ch, 'rPr')) };
        const rs = kid(ch, 'rPr') && kid(kid(ch, 'rPr'), 'rStyle');
        if (rs) Object.assign(rp, ...styleChain(attr(rs, 'val')).map((s) => s.run), readRun(kid(ch, 'rPr')));
        for (const c of ch.children) {
          if (c.localName === 't') out.push({ t: 'text', text: rp.caps ? c.textContent.toUpperCase() : c.textContent, rp });
          else if (c.localName === 'tab') out.push({ t: 'text', text: '\t', rp });
          else if (c.localName === 'br') out.push({ t: attr(c, 'type') === 'page' ? 'page' : 'br', rp });
          else if (c.localName === 'drawing') {
            const blip = c.getElementsByTagNameNS('*', 'blip')[0], ext = c.getElementsByTagNameNS('*', 'extent')[0];
            if (blip) {
              const rid = blip.getAttribute('r:embed') || blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed');
              const bmp = await loadImage(rid);
              if (bmp) { const w = ext ? +ext.getAttribute('cx') / 12700 * K : bmp.width * 0.75 * K, hh = ext ? +ext.getAttribute('cy') / 12700 * K : bmp.height * 0.75 * K; out.push({ t: 'img', bmp, w, h: hh }); }
            }
          }
        }
      } else if (['hyperlink', 'smartTag', 'ins', 'sdt', 'sdtContent', 'fldSimple', 'customXml'].includes(ln)) {
        await collect(ln === 'hyperlink' ? ch : ch, ln === 'hyperlink' ? { ...rp0, color: rp0.color || '#1a5fd0', u: true } : rp0, out);
      }
    }
  }

  const meas = document.createElement('canvas').getContext('2d');
  // lay a paragraph's tokens out into lines of the given width
  function layoutLines(tokens, width, firstIndent, align) {
    const lines = []; let line = null;
    const start = (indent) => { line = { items: [], x: indent, w: indent, asc: 0, h: 0, first: !lines.length, indent }; lines.push(line); };
    start(firstIndent);
    const place = (it, w, h, asc) => { line.items.push({ ...it, x: line.w, w }); line.w += w; line.h = Math.max(line.h, h); line.asc = Math.max(line.asc, asc); };
    for (const tk of tokens) {
      if (tk.t === 'br' || tk.t === 'page') { if (!line.h) line.h = fontOf(tk.rp || defRun).px * 1.2; line.hard = true; start(0); if (tk.t === 'page') lines[lines.length - 2].pageBreak = true; continue; }
      if (tk.t === 'img') {
        let w = tk.w, hh = tk.h; const maxW = width - firstIndent, maxH = bottom() - mg.t - 10;
        const k = Math.min(1, maxW / w, maxH / hh); w *= k; hh *= k;
        if (line.items.length) start(0);
        place({ t: 'img', bmp: tk.bmp }, w, hh, hh); line.imgLine = true; start(0); continue;
      }
      const { px, font } = fontOf(tk.rp); meas.font = font;
      const parts = tk.text.split(/(\s+|\t)/).filter((x) => x !== '');
      for (const part of parts) {
        if (part === '\t') { place({ t: 'text', text: '', rp: tk.rp, font, px }, 36, px * 1.2, px * 0.92); continue; }
        const isSpace = /^\s+$/.test(part), text = isSpace ? ' ' : part, w = meas.measureText(text).width;
        if (!isSpace && line.w + w > width + 0.5 && line.items.some((q) => q.text && q.text.trim())) start(0);
        if (isSpace && !line.items.length) continue;
        place({ t: 'text', text, rp: tk.rp, font, px, space: isSpace }, w, px * 1.2, px * 0.92);
        if (!isSpace && w > width) { /* very long word: let it overflow slightly */ }
      }
    }
    if (!line.items.length && lines.length > 1) lines.pop();
    for (const l of lines) { while (l.items.length && l.items[l.items.length - 1].space) { l.w -= l.items.pop().w; } }
    return lines;
  }
  function drawLine(g, line, x0, y, width, align, last) {
    let off = 0, extra = 0;
    if (align === 'center') off = (width - line.w + line.indent) / 2 - line.indent * 0; else if (align === 'right') off = width - line.w;
    if (align === 'both' && !last && !line.hard) { const sp = line.items.filter((q) => q.space).length; if (sp) extra = (width - line.w) / sp; }
    let dx = 0;
    for (const it of line.items) {
      const x = x0 + it.x + off + dx;
      if (it.t === 'img') { try { g.drawImage(it.bmp, x, y, it.w, line.h); } catch {} continue; }
      if (it.space) { dx += extra; }
      const base = y + line.asc + (it.rp.va === 'superscript' ? -it.px * 0.5 : it.rp.va === 'subscript' ? it.px * 0.3 : 0);
      if (it.rp.hl && it.text) { g.fillStyle = it.rp.hl; g.fillRect(x, y, it.w + (it.space ? extra : 0), line.h); }
      if (it.text && it.text.trim()) { g.font = it.font; g.fillStyle = it.rp.color || '#000'; g.textBaseline = 'alphabetic'; g.fillText(it.text, x, base); }
      if (it.rp.u && it.text) { g.fillStyle = it.rp.color || '#000'; g.fillRect(x, base + 1.5, it.w, Math.max(1, it.px / 16)); }
      if (it.rp.strike && it.text) { g.fillStyle = it.rp.color || '#000'; g.fillRect(x, base - it.px * 0.3, it.w, Math.max(1, it.px / 16)); }
    }
  }
  const lineH = (line, par, run) => {
    const base = Math.max(line.h, ((run.sz || 22) / 2) * K * 1.2);
    const f = par.line && (par.lineRule == null || par.lineRule === 'auto') ? par.line / 240 : 1;
    return line.imgLine ? line.h : base * Math.max(0.9, f);
  };

  async function paragraph(p, x0, width, target) {
    const pPr = readPar(kid(p, 'pPr')), ppr0 = kid(p, 'pPr');
    const { par, run } = resolve(pPr, readRun(kid(ppr0, 'rPr')));
    const tokens = []; await collect(p, run, tokens);
    const left = tw2px(par.left || 0), right = tw2px(par.right || 0);
    let first = par.first ? tw2px(par.first) : 0, label = null;
    if (par.hanging) first = -tw2px(par.hanging);
    let avail = width - left - right;
    if (par.numId && par.numId !== '0') {
      const nl = listLabel(par.numId, par.ilvl || 0);
      const lp = nl.par; const L2 = tw2px(par.left != null ? par.left : lp.left || 720 * ((par.ilvl || 0) + 1)), H = tw2px(par.hanging != null ? par.hanging : lp.hanging || 360);
      label = { text: nl.label, x: L2 - H, run };
      return flow(tokens, par, run, x0 + L2, width - L2 - right, 0, label, x0, target);
    }
    return flow(tokens, par, run, x0 + left, avail, first, null, x0, target);
  }
  function flow(tokens, par, run, x, avail, first, label, x0, target) {
    const lines = layoutLines(tokens, avail, Math.max(0, first), par.jc);
    const before = par.before != null ? tw2px(par.before) : 0, after = par.after != null ? tw2px(par.after) : tw2px(0);
    const hasContent = tokens.length > 0;
    const hs = lines.map((l) => lineH(l, par, run));
    if (!hasContent) { return { height: before + ((run.sz || 22) / 2) * K * 1.2 + after, draw: (c, y) => {}, lines: [], par }; }
    const out = { lines, hs, before, after, x, avail, par, label, x0, run };
    return out;
  }
  // place a measured paragraph onto pages
  function emit(m, pageBreakBefore) {
    if (!m) return;
    if (pageBreakBefore && cur.y > mg.t + 1) newPage();
    if (m.draw) { cur.y += m.height; if (cur.y > bottom()) newPage(); return; }
    cur.y += m.before;
    m.lines.forEach((l, i) => {
      const h = m.hs[i];
      if (cur.y + h > bottom() && cur.y > mg.t + 2) newPage();
      if (i === 0 && m.label) { const rp = m.label.run; const { font, px } = fontOf(rp); cur.g.font = font; cur.g.fillStyle = '#000'; cur.g.textBaseline = 'alphabetic'; cur.g.fillText(m.label.text, m.x0 + m.label.x, cur.y + px * 0.92 + (h - px * 1.2) / 2); }
      drawLine(cur.g, l, m.x, cur.y + (l.imgLine ? 0 : (h - l.h) / 2), m.avail, m.par.jc, i === m.lines.length - 1);
      cur.y += h;
      if (l.pageBreak) newPage();
    });
    cur.y += m.after;
  }

  // tables: simple grid with borders; each cell flows its paragraphs
  async function table(tbl) {
    const grid = kids(kid(tbl, 'tblGrid'), 'gridCol').map((g) => tw2px(+attr(g, 'w') || 2000));
    const full = PW - mg.l - mg.r;
    let gsum = grid.reduce((a, b) => a + b, 0) || full;
    const scale = gsum > full ? full / gsum : 1; const cols = grid.length ? grid.map((g) => g * scale) : [full];
    for (const tr of kids(tbl, 'tr')) {
      const cells = []; let ci = 0;
      for (const tc of kids(tr, 'tc')) {
        const span = +(attr(kid(kid(tc, 'tcPr'), 'gridSpan'), 'val') || 1);
        const w = cols.slice(ci, ci + span).reduce((a, b) => a + b, 0) || cols[0]; ci += span;
        const ms = [];
        for (const p of tc.children) if (p.localName === 'p') ms.push(await paragraph(p, 0, w - 10, null));
        const shd = kid(kid(tc, 'tcPr'), 'shd'); const fill = shd && /^[0-9a-f]{6}$/i.test(attr(shd, 'fill') || '') ? '#' + attr(shd, 'fill') : null;
        const hh = ms.reduce((a, m) => a + (m.draw ? m.height : m.before + m.hs.reduce((q, z) => q + z, 0) + m.after), 0) + 8;
        cells.push({ w, ms, fill, h: hh });
      }
      const rowH = Math.max(18, ...cells.map((c) => c.h));
      if (cur.y + rowH > bottom() && cur.y > mg.t + 2) newPage();
      let x = mg.l; const g = cur.g;
      for (const c of cells) {
        if (c.fill) { g.fillStyle = c.fill; g.fillRect(x, cur.y, c.w, rowH); }
        g.strokeStyle = '#8a8d98'; g.lineWidth = 0.8; g.strokeRect(x, cur.y, c.w, rowH);
        let yy = cur.y + 4;
        for (const m of c.ms) {
          if (m.draw) { yy += m.height; continue; }
          yy += m.before;
          m.lines.forEach((l, i) => { drawLine(g, l, x + 5 + (m.x - 0), yy + (l.imgLine ? 0 : (m.hs[i] - l.h) / 2), m.avail, m.par.jc, i === m.lines.length - 1); yy += m.hs[i]; });
          yy += m.after;
        }
        x += c.w;
      }
      cur.y += rowH;
    }
    cur.y += 8;
  }

  // --- walk the body
  const blocks = [...body.children].filter((c) => c.localName === 'p' || c.localName === 'tbl');
  let n = 0;
  for (const b of blocks) {
    if (b.localName === 'tbl') await table(b);
    else {
      const m = await paragraph(b, mg.l, PW - mg.l - mg.r, null);
      const pb = readPar(kid(b, 'pPr')).pageBreakBefore;
      emit(m, pb);
    }
    if (++n % 25 === 0) { onProgress(n / blocks.length); await new Promise((r) => setTimeout(r)); }
    if (pages.length > 400) break;
  }
  // drop a trailing blank page
  const out = [];
  for (const pg of pages) {
    const blob = await new Promise((res) => pg.cv.toBlob(res, 'image/jpeg', 0.9));
    out.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), wpx: pg.cv.width, hpx: pg.cv.height });
  }
  return buildPdf(out);
}
