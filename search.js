// Search index: typed text, PDF text, recognised handwriting and text inside pictures.
// One index entry per note, kept in IndexedDB ('idx'). Matching ignores case and accents (so "viet" finds "Việt").
import { db } from './db.js';
import * as ocr from './ocr.js';

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
export const tokens = (q) => norm(q).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/* Handwriting is read imperfectly, so a word matches when it is close: letters that look alike are treated as the same,
   and a search word may match a slip-up inside a longer read word (approximate substring match). */
const look = (s) => s.replace(/rn/g, 'm').replace(/cl/g, 'd').replace(/vv/g, 'w').replace(/[1|!i]/g, 'l').replace(/0/g, 'o').replace(/5/g, 's').replace(/v/g, 'u').replace(/q/g, 'g').replace(/[nh]/g, 'n').replace(/[ao]/g, 'o').replace(/[ec]/g, 'e');
const fuzzyMax = (t) => (t.length >= 8 ? 3 : t.length >= 6 ? 2 : t.length >= 4 ? 1 : 0);
function approxSub(t, w, max) {         // smallest edit distance between t and any part of w (Sellers)
  const m = t.length; if (!m) return 0;
  let prev = new Array(m + 1); for (let i = 0; i <= m; i++) prev[i] = i;
  let best = m;
  for (let j = 1; j <= w.length; j++) {
    const cur = [0];
    for (let i = 1; i <= m; i++) cur[i] = Math.min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + (t[i - 1] === w[j - 1] ? 0 : 1));
    if (cur[m] < best) best = cur[m]; prev = cur;
  }
  return best;
}
const fullLev = (a, b) => { let prev = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[b.length]; };
/** does a read word match a search token */
const wordHit = (w, t) => {
  if (w.includes(t)) return true;
  const m = fuzzyMax(t), lw = look(w), lt = look(t);
  if (t.length >= 3 && (lw === lt || (t.length >= 4 && lw.includes(lt)))) return true;
  if (!m) return false;
  if (lw.includes(lt)) return true;
  if (lw.length < lt.length - m) return false;
  if (lw.length <= lt.length + 1) return fullLev(lt, lw) <= m;             // about the same length: compare whole words
  return approxSub(lt, lw, m) <= m;                                          // read word has extra junk around it
};

/* ---------- searching one index entry ---------- */
export function searchEntry(entry, q) {
  const ts = tokens(q); if (!ts.length || !entry) return [];
  const hits = [];
  entry.pages.forEach((pg, pi) => {
    // typed text / PDF text: each entry is a phrase; every search word must be inside it
    for (const [kind, key] of [['text', 'e'], ['pdf', 'f']]) {
      for (const e of pg[key] || []) {
        const n = norm(e[0]);
        if (!ts.every((t) => n.includes(t))) continue;
        const rowHits = (e[5] || []).filter((r) => ts.every((t) => norm(r[0]).includes(t)));
        if (rowHits.length) for (const r of rowHits) hits.push({ pi, kind, t: r[0].trim(), x: e[1], y: e[2] + r[1], w: e[3], h: r[2], fuzzy: false });
        else hits.push({ pi, kind, t: e[0], x: e[1], y: e[2], w: e[3], h: e[4], fuzzy: false });
      }
    }
    // handwriting / pictures / exact PDF words: words with positions; the page counts when every search word is found
    for (const [kind, key] of [['pdf', 'pw'], ['ink', 'i'], ['img', 'm']]) {
      let words = pg[key] || []; if (!words.length) continue;
      let nw = words.map((w) => (w[5] ? [norm(w[0]), ...w[5].map(norm)] : norm(w[0])));
      if (kind !== 'pdf') {                                  // a word split in two by the reader ("bud get") still matches when joined
        const jw = [], jn = [];
        for (let k = 0; k + 1 < words.length; k++) { const a = words[k], b = words[k + 1]; if (Math.abs(a[2] - b[2]) < Math.max(a[4], b[4]) && b[1] - (a[1] + a[3]) < Math.max(a[4], b[4]) * 1.2) { const x = Math.min(a[1], b[1]), y = Math.min(a[2], b[2]); jw.push([a[0] + b[0], x, y, Math.max(a[1] + a[3], b[1] + b[3]) - x, Math.max(a[2] + a[4], b[2] + b[4]) - y]); jn.push(norm(a[0] + b[0])); } }
        words = words.concat(jw); nw = nw.concat(jn);
      }
      const found = ts.map((t) => nw.reduce((a, w, i) => ((kind === 'pdf' ? w.includes(t) : [].concat(w).some((x) => wordHit(x, t))) ? (a.push(i), a) : a), []));
      if (found.some((f) => !f.length)) continue;
      const seen = new Set();
      found.forEach((idxs) => idxs.forEach((i) => {
        if (seen.has(i)) return; seen.add(i);
        const w = words[i], from = Math.max(0, i - 3), to = Math.min(words.length, i + 5);
        hits.push({ pi, kind, t: words.slice(from, to).map((x) => x[0]).join(' '), x: w[1], y: w[2], w: w[3], h: w[4], fuzzy: kind !== 'pdf' });
      }));
    }
  });
  return dedupe(hits);
}
function dedupe(hits) {
  const out = [];
  for (const h of hits) { if (out.some((o) => o.pi === h.pi && o.kind === h.kind && Math.min(o.x + o.w, h.x + h.w) - Math.max(o.x, h.x) > Math.min(o.w, h.w) * 0.5 && Math.min(o.y + o.h, h.y + h.h) - Math.max(o.y, h.y) > Math.min(o.h, h.h) * 0.5)) continue; out.push(h); }
  return out;
}

/* ---------- building an index entry ---------- */
const sigOf = (...parts) => parts.join('|');
export function strokeBox(st) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; const p = st.p; for (let i = 0; i < p.length; i += 3) { if (p[i] < a) a = p[i]; if (p[i] > c) c = p[i]; if (p[i + 1] < b) b = p[i + 1]; if (p[i + 1] > d) d = p[i + 1]; } return [a, b, c, d]; }
const inkStrokes = (pg) => (pg.strokes || []).filter((s) => s.p && s.p.length >= 6 && s.t !== 'hl' && !s.sh);
function inkSig(pg) {
  const st = inkStrokes(pg); let n = 0, h = 0;
  for (const s of st) { n += s.p.length; h = (h * 31 + Math.round(s.p[0] * 3) + Math.round(s.p[1] * 7) + s.p.length) | 0; }
  return sigOf(st.length, n, h);
}
const imgItems = (pg) => (pg.items || []).filter((it) => it.k === 'img' && it.ref && !it.bg);
const plain = (t) => String(t || '').split('\n').map((l) => l.replace(/^\s*(#{1,3}\s+|[-*•]\s+|\[[ xX]\]\s+|\d{1,3}[.)]\s+)/, '').replace(/\*\*|__|~~/g, '').replace(/\[\[([^\]]+)\]\]/g, '$1')).join(' ').replace(/\s+/g, ' ').trim();
export function typedOf(pg, rectOf, rowsOf) {
  const out = [];
  for (const it of pg.items || []) {
    let t = '';
    if (it.k === 'text') t = plain(it.text); else if (it.k === 'comment' || it.k === 'jump') t = plain(it.text); else if (it.k === 'link') t = plain((it.text || '') + ' ' + (it.url || ''));
    if (!t) continue;
    let r; try { r = rectOf(it); } catch { r = [it.x || 0, it.y || 0, (it.x || 0) + (it.w || 100), (it.y || 0) + 30]; }
    let rows = null; try { rows = rowsOf && it.k === 'text' ? rowsOf(it).map((q) => [q[0], Math.round(q[1]), Math.round(q[2])]) : null; } catch {}
    out.push([t, Math.round(r[0]), Math.round(r[1]), Math.round(r[2] - r[0]), Math.round(r[3] - r[1]), rows]);
  }
  return out;
}
export function renderChunk(strokes, ox, oy, w, h, SCALE, opt = {}) {
  const sh = opt.shear || 0, lwf = opt.lw == null ? 0.9 : opt.lw, minLw = opt.minLw == null ? 2.4 : opt.minLw, extra = Math.abs(sh) * h, xo = sh > 0 ? extra : 0, ymid = oy + h / 2;
  const c = document.createElement('canvas'); c.width = Math.max(8, Math.ceil((w + extra) * SCALE)); c.height = Math.max(8, Math.ceil(h * SCALE));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#000'; g.lineCap = g.lineJoin = 'round';
  const X = (x, y) => (x - ox + xo - sh * (y - ymid)) * SCALE, Y = (y) => (y - oy) * SCALE;
  for (const s of strokes) {
    const p = s.p; g.lineWidth = Math.max(minLw, (s.s || 3) * SCALE * lwf); g.beginPath();
    g.moveTo(X(p[0], p[1]), Y(p[1]));
    if (p.length <= 3) g.lineTo(X(p[0], p[1]) + 0.1, Y(p[1]));
    for (let i = 3; i < p.length; i += 3) g.lineTo(X(p[i], p[i + 1]), Y(p[i + 1]));
    g.stroke();
  }
  return c;
}
/** how slanted is this writing? tries shears and picks the one that makes vertical strokes line up best */
export function estimateShear(strokes) {
  const pts = []; for (const s of strokes) { const p = s.p; for (let i = 0; i < p.length; i += 3) pts.push(p[i], p[i + 1]); if (p.length >= 6) for (let i = 3; i < p.length; i += 3) { const x0 = p[i - 3], y0 = p[i - 2], x1 = p[i], y1 = p[i + 1], n = Math.min(12, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 2)); for (let k = 1; k < n; k++) pts.push(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n); } }
  if (pts.length < 40) return 0;
  let best = 0, bs = -1, base = -1;
  for (let sh = -0.5; sh <= 0.8; sh += 0.05) {
    const hist = new Map(); for (let i = 0; i < pts.length; i += 2) { const k = Math.round((pts[i] - sh * pts[i + 1]) / 2); hist.set(k, (hist.get(k) || 0) + 1); }
    let sc = 0; for (const v of hist.values()) sc += v * v;
    if (Math.abs(sh) < 1e-6) base = sc; if (sc > bs) { bs = sc; best = sh; }
  }
  return bs > base * 1.04 ? Math.round(best * 20) / 20 : 0;      // only deslant when it clearly helps
}
/* The engine reads best when letters are about 25-40 px tall; much bigger or smaller and it reads nothing.
   So each page is drawn at a scale chosen from the real size of its strokes. */
export function pickScale(boxes) {
  const hs = boxes.map((b) => b[3] - b[1]).filter((v) => v > 4).sort((a, b) => a - b);
  const med = hs.length ? hs[Math.floor(hs.length / 2)] : 30;
  return Math.min(2.2, Math.max(0.25, 38 / med));
}
const strokeSig = (list) => { let n = 0, h = 0; for (const s of list) { n += s.p.length; h = (h * 31 + Math.round(s.p[0] * 3) + Math.round(s.p[1] * 7) + s.p.length + Math.round(s.p[s.p.length - 3] * 5)) | 0; } return list.length + ':' + n + ':' + h; };
/* Handwriting is read in blocks (a block is a paragraph: lines that sit close together). Only blocks whose strokes
   changed are read again, so writing a new line costs one small read, not a whole page. */
export function segmentBands(st, boxes) {
  const order = st.map((_, i) => i).sort((a, b) => (boxes[a][1] + boxes[a][3]) - (boxes[b][1] + boxes[b][3]));
  const hs = boxes.map((b) => b[3] - b[1]).filter((v) => v > 4).sort((a, b) => a - b), med = hs.length ? hs[hs.length >> 1] : 30, gap = Math.max(10, med * 1.1);
  const bands = []; let cur = null;
  for (const i of order) {
    const b = boxes[i];
    if (cur && b[1] <= cur.y1 + gap) { cur.ix.push(i); cur.y1 = Math.max(cur.y1, b[3]); cur.y0 = Math.min(cur.y0, b[1]); cur.x0 = Math.min(cur.x0, b[0]); cur.x1 = Math.max(cur.x1, b[2]); }
    else { cur = { ix: [i], y0: b[1], y1: b[3], x0: b[0], x1: b[2] }; bands.push(cur); }
  }
  // a wide band (e.g. on a whiteboard, notes far apart on the same row) is split where there is a big empty gap, so each block is read at its own size
  const xgap = Math.max(90, med * 3.4), out = [];
  for (const b of bands) {
    const ix = b.ix.slice().sort((p, q) => boxes[p][0] - boxes[q][0]); let g = null;
    for (const i of ix) {
      const bx = boxes[i];
      if (g && bx[0] <= g.x1 + xgap) { g.ix.push(i); g.x1 = Math.max(g.x1, bx[2]); g.y0 = Math.min(g.y0, bx[1]); g.y1 = Math.max(g.y1, bx[3]); }
      else { g = { ix: [i], x0: bx[0], x1: bx[2], y0: bx[1], y1: bx[3] }; out.push(g); }
    }
  }
  return out.map((b) => ({ ...b, strokes: b.ix.map((i) => st[i]), boxes: b.ix.map((i) => boxes[i]) }));
}
async function readBlock(band, pace) {
  const pad = 14, x0 = band.x0 - pad, y0 = band.y0 - pad, W = band.x1 - band.x0 + 2 * pad, H = band.y1 - band.y0 + 2 * pad;
  const base = Math.min(pickScale(band.boxes), 2300 / Math.max(W, 1));
  const attempt = async (SC) => {
    const TILE = Math.max(160, Math.floor(2300 / SC) - 40), words = [];
    for (let ty = 0; ty < H; ty += TILE) {
      const oy = y0 + ty, h = Math.min(TILE + 40, H - ty);
      const inTile = band.strokes.filter((s, i) => band.boxes[i][3] >= oy && band.boxes[i][1] <= oy + h);
      if (!inTile.length) continue;
      await pace();
      const res = await ocr.recognize(renderChunk(inTile, x0, oy, W, h, SC));
      for (const r of res) { const w = [r.t, Math.round(x0 + r.x / SC), Math.round(oy + r.y / SC), Math.round(r.w / SC), Math.round(r.h / SC)]; w.c = r.c; words.push(w); }
    }
    return words;
  };
  const score = (ws) => ws.reduce((a, w) => a + (w.c || 0) * (w[0].replace(/[^\p{L}\p{N}]/gu, '').length), 0), conf = (ws) => { const n = ws.reduce((a, w) => a + w[0].length, 0); return n ? ws.reduce((a, w) => a + (w.c || 0) * w[0].length, 0) / n : 0; };
  let words = await attempt(base);
  if ((!words.length || conf(words) < 85) && band.strokes.length >= 3) {          // unsure or nothing: try other sizes and keep the most confident reading
    for (const k of [1.3, 0.75, 1.7, 0.55]) { const alt = await attempt(Math.min(2.4, Math.max(0.2, base * k))); if (score(alt) > score(words)) words = alt; if (conf(words) >= 85) break; }
  }
  words = words.map((w) => [w[0], w[1], w[2], w[3], w[4]]);
  return words;
}
export const TUNE = { mode: 'med', target: 38, lw: 0.45, minLw: 1.4, lineGap: 0.62 };
const median = (a) => { const v = a.filter((x) => x > 0).sort((p, q) => p - q); return v.length ? v[v.length >> 1] : 0; };
/** a block of writing -> its lines (each line is read on its own: the engine is far better at one line at a time) */
export function splitLines(band) {
  const med = Math.max(8, median(band.boxes.map((b) => b[3] - b[1]).filter((v) => v > 4)) || 30);
  const big = band.boxes.map((_, i) => i).filter((i) => { const b = band.boxes[i]; return b[3] - b[1] >= med * 0.45 || b[2] - b[0] >= med * 0.9; });
  const main = big.length ? big : band.boxes.map((_, i) => i);
  const order = main.sort((a, b) => (band.boxes[a][1] + band.boxes[a][3]) - (band.boxes[b][1] + band.boxes[b][3]));
  const lines = []; let cur = null;
  for (const i of order) {
    const b = band.boxes[i], cy = (b[1] + b[3]) / 2;
    if (cur && cy - cur.cy <= med * TUNE.lineGap) { cur.ix.push(i); cur.sum += cy; cur.cy = cur.sum / cur.ix.length; }
    else { cur = { ix: [i], sum: cy, cy }; lines.push(cur); }
  }
  if (big.length) {                                 // dots, accents and other small marks go with the nearest line
    const inMain = new Set(main);
    band.boxes.forEach((b, i) => {
      if (inMain.has(i)) return;
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; let bl = null, bd = 1e9;
      for (const l of lines) { const bs = l.ix.map((j) => band.boxes[j]), y0 = Math.min(...bs.map((q) => q[1])), y1 = Math.max(...bs.map((q) => q[3])), x0 = Math.min(...bs.map((q) => q[0])), x1 = Math.max(...bs.map((q) => q[2]));
        const dy = cy < y0 ? y0 - cy : cy > y1 ? cy - y1 : 0, dx = cx < x0 ? x0 - cx : cx > x1 ? cx - x1 : 0, d = Math.hypot(dx, dy * 1.2); if (d < bd) { bd = d; bl = l; } }
      if (bl) bl.ix.push(i);
    });
  }
  return lines.map((l) => {
    const boxes = l.ix.map((i) => band.boxes[i]), strokes = l.ix.map((i) => band.strokes[i]);
    return { strokes, boxes, x0: Math.min(...boxes.map((b) => b[0])), x1: Math.max(...boxes.map((b) => b[2])), y0: Math.min(...boxes.map((b) => b[1])), y1: Math.max(...boxes.map((b) => b[3])) };
  });
}
const wscore = (ws) => ws.reduce((a, w) => a + (w.c || 0) * (w[0].replace(/[^\p{L}\p{N}]/gu, '').length), 0);
const wconf = (ws) => { const n = ws.reduce((a, w) => a + w[0].length, 0); return n ? ws.reduce((a, w) => a + (w.c || 0) * w[0].length, 0) / n : 0; };
/** merge several readings of the same line: the most confident text for each spot is shown, the others stay searchable as alternates */
function mergeReadings(readings) {
  const out = [];
  for (const rd of readings) for (const w of rd) {
    const cx = w[1] + w[3] / 2, cy = w[2] + w[4] / 2;
    const hit = out.find((o) => cx > o[1] - o[3] * 0.15 && cx < o[1] + o[3] * 1.15 && cy > o[2] - o[4] * 0.3 && cy < o[2] + o[4] * 1.3);
    if (!hit) { const n = [w[0], w[1], w[2], w[3], w[4]]; n.c = w.c; n.alts = []; out.push(n); continue; }
    if (w[0] === hit[0]) { hit.c = Math.max(hit.c || 0, w.c || 0); continue; }
    const accent = (t) => /[^\x00-\x7f]/.test(t);
    if ((w.c || 0) > (hit.c || 0) + 3 || (accent(w[0]) && !accent(hit[0]) && (w.c || 0) >= (hit.c || 0) - 12)) { if (!hit.alts.includes(hit[0])) hit.alts.push(hit[0]); hit[0] = w[0]; hit[1] = w[1]; hit[2] = w[2]; hit[3] = w[3]; hit[4] = w[4]; hit.c = w.c; }
    else if (!hit.alts.includes(w[0])) hit.alts.push(w[0]);
  }
  return out.map((w) => (w.alts.length ? [w[0], w[1], w[2], w[3], w[4], w.alts.slice(0, 5)] : [w[0], w[1], w[2], w[3], w[4]]));
}
async function readLine(line, pace, langs) {
  const pad = 12, x0 = line.x0 - pad, y0 = line.y0 - pad, W = line.x1 - line.x0 + 2 * pad, H = line.y1 - line.y0 + 2 * pad;
  const med = median(line.boxes.map((b) => b[3] - b[1]).filter((v) => v > 4)) || (line.y1 - line.y0) || 30;
  const lh = Math.max(8, line.y1 - line.y0), ref = TUNE.mode === 'line' ? lh : TUNE.mode === 'mix' ? Math.sqrt(lh * med) : med;
  const base = Math.min(2.4, Math.max(0.2, TUNE.target / ref), 3000 / Math.max(W, 1));
  const attempt = async (SC, psm, lang) => {
    await pace();
    const res = await ocr.recognize(renderChunk(line.strokes, x0, y0, W, H, SC, { lw: TUNE.lw, minLw: TUNE.minLw }), { psm, lang });
    return res.map((r) => { const w = [r.t, Math.round(x0 + r.x / SC), Math.round(y0 + r.y / SC), Math.round(r.w / SC), Math.round(r.h / SC)]; w.c = r.c; return w; });
  };
  let best = await attempt(base, 7); const all = [best];
  if (/vie/.test(langs || '') && /eng/.test(langs || '')) { const v = await attempt(base, 7, 'vie'); all.push(v); if (wscore(v) > wscore(best) * 1.05) best = v; }      // a Vietnamese-only second opinion: it keeps the accents
  if (!best.length || wconf(best) < 90) {                         // unsure: other sizes and layout modes. Keep every reading: a search can match any of them.
    for (const [k, psm] of [[1.35, 7], [0.75, 7], [1, 8], [1.8, 7], [0.55, 7]]) {
      const alt = await attempt(Math.min(2.4, Math.max(0.2, base * k)), psm); all.push(alt);
      if (wscore(alt) > wscore(best)) best = alt;
      if (wconf(best) >= 90) break;
    }
  }
  return mergeReadings([best, ...all.filter((x) => x !== best)]);
}
export async function readBand(band, pace, langs) {
  if (band.strokes.length < 2) return readBlock(band, pace);
  const words = [];
  for (const ln of splitLines(band)) words.push(...await readLine(ln, pace, langs));
  if (!words.length && band.strokes.length >= 3) return readBlock(band, pace);
  return words;
}
export async function ocrInk(pg, pace, prevBands, langs) {
  const st = inkStrokes(pg); if (!st.length) return { words: [], bands: [] };
  const boxes = st.map(strokeBox), bands = segmentBands(st, boxes), out = [], keep = new Map((prevBands || []).map((b) => [b.sg + '@' + b.langs, b]));
  for (const b of bands) {
    const sg = strokeSig(b.strokes), hit = keep.get(sg + '@' + langs);
    if (hit) { out.push(hit); continue; }
    if (b.y1 - b.y0 < 3 && b.x1 - b.x0 < 24) { out.push({ sg, langs, words: [] }); continue; }       // a dot or a speck
    out.push({ sg, langs, words: await readBand(b, pace, langs) });
  }
  return { words: out.flatMap((b) => b.words), bands: out };
}
async function ocrImage(ref, pace) {
  const blob = await db.getAsset(ref); if (!blob) return [];
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height)), up = bmp.width * k < 900 ? Math.min(2, 1000 / Math.max(bmp.width * k, 1)) : 1;
  const c = document.createElement('canvas'); c.width = Math.max(8, Math.round(bmp.width * k * up)); c.height = Math.max(8, Math.round(bmp.height * k * up));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
  await pace();
  const res = await ocr.recognize(c);
  return res.map((r) => [r.t, +(r.x / c.width).toFixed(4), +(r.y / c.height).toFixed(4), +(r.w / c.width).toFixed(4), +(r.h / c.height).toFixed(4)]);
}

/**
 * Build / refresh the index entry for one note. Cheap parts (typed + PDF text) always; OCR parts only when `doOcr`.
 * opts: { rectOf(item), pace(), openPdf(id), renderPdf(pdf, idx, px), doOcr, langs, onPage(done, total) }
 */
export async function indexDoc(doc, opts) {
  let old = null; try { old = await db.getIdx(doc.id); } catch {}
  const langs = opts.langs || ocr.getLangs();
  const entry = { id: doc.id, v: 2, langs, updated: doc.updated || 0, pages: [] };
  const oldPages = (old && old.v === 2) ? old.pages : [];
  const imgCache = new Map(); for (const pg of oldPages) for (const k of Object.keys(pg.ic || {})) imgCache.set(k, pg.ic[k]);
  let pdf = null, pdfTried = false;
  const total = doc.pages.length; let todo = 0;
  for (let pi = 0; pi < total; pi++) {
    const pg = doc.pages[pi], prev = oldPages.find((o) => o.id === pg.id) || oldPages[pi] || null;
    const ent = { id: pg.id, e: typedOf(pg, opts.rectOf, opts.rowsOf) };
    // PDF text layer
    if (pg.pdf != null) {
      if (prev && prev.f && prev.ps === 'p') { ent.f = prev.f; ent.ps = 'p'; }
      else if (total > (opts.pdfCap == null ? 40 : opts.pdfCap)) { ent.f = (prev && prev.f) || []; }       // big PDFs: read their text only when you search inside them, not in the background
      else {
        if (!pdfTried) { pdfTried = true; try { pdf = await opts.openPdf(doc.id); } catch { pdf = null; } }
        if (pdf) {
          try {
            const page = await pdf.getPage(pg.pdf + 1), v0 = page.getViewport({ scale: 1 }), sc = 800 / v0.width, tc = await page.getTextContent(); const f = [];
            for (const t of tc.items) { if (!t.str || !t.str.trim()) continue; const tr = t.transform, hh = (t.height || Math.abs(tr[3]) || 10) * sc; f.push([t.str.trim(), Math.round(tr[4] * sc), Math.round((v0.height - tr[5]) * sc - hh), Math.round((t.width || 40) * sc), Math.round(hh * 1.2)]); }
            page.cleanup(); ent.f = f; ent.ps = 'p';
            if (f.reduce((a, x) => a + x[0].length, 0) < 12 && opts.doOcr) ent.needScan = true;
          } catch { ent.f = []; }
        }
      }
    }
    // handwriting
    const is = inkSig(pg);
    if (prev && prev.is === is && prev.langs === langs && prev.i) { ent.is = is; ent.i = prev.i; ent.b = prev.b; ent.langs = langs; }
    else if (opts.doOcr && inkStrokes(pg).length) {
      todo++; try { const r = await ocrInk(pg, opts.pace, prev && prev.b, langs); ent.i = r.words; ent.b = r.bands; ent.is = is; ent.langs = langs; } catch (e) { if (String(e.message) === 'stopped') throw e; console.warn('ocr ink', e); ent.i = prev && prev.i || []; ent.is = ''; }
    } else if (!inkStrokes(pg).length) { ent.is = is; ent.i = []; ent.langs = langs; }
    else { ent.is = prev ? prev.is : ''; ent.i = prev && prev.i || []; ent.langs = prev && prev.langs; ent.pending = true; }
    // pictures: words are cached per picture as fractions (0..1), then placed where the picture sits now
    const ims = imgItems(pg); ent.ic = {}; ent.m = [];
    for (const it of ims) {
      const key = it.ref + '@' + langs; let rel = imgCache.get(key);
      if (!rel && opts.doOcr) { todo++; try { rel = await ocrImage(it.ref, opts.pace); } catch (e) { if (String(e.message) === 'stopped') throw e; rel = []; } }
      if (rel) { ent.ic[key] = rel; const iw = it.w, ih = it.w / (it.ar || 1); for (const w of rel) ent.m.push([w[0], Math.round(it.x + w[1] * iw), Math.round(it.y + w[2] * ih), Math.round(w[3] * iw), Math.round(w[4] * ih)]); }
      else ent.pending = true;
    }
    if (ent.needScan && opts.doOcr && pdf) {
      todo++; try {
        await opts.pace(); const c = await opts.renderPdf(pdf, pg.pdf, 1400); const res = await ocr.recognize(c);
        ent.f = res.map((r) => [r.t, Math.round(r.x * 800 / c.width), Math.round(r.y * 800 / c.width), Math.round(r.w * 800 / c.width), Math.round(r.h * 800 / c.width)]);
      } catch (e) { if (String(e.message) === 'stopped') throw e; }
      delete ent.needScan;
    }
    entry.pages.push(ent);
    if (opts.onPage) opts.onPage(pi + 1, total);
  }
  if (pdf) { try { pdf.destroy(); } catch {} }
  entry.pending = entry.pages.some((p) => p.pending);
  await db.putIdx(entry);
  return entry;
}

/* ---------- the background indexer ---------- */
export const Indexer = {
  mem: new Map(),            // id -> entry
  queue: [], running: false, curId: null, urgentUntil: 0, status: { docs: 0, done: 0, page: '', err: '' }, listeners: new Set(),
  opts: null,
  async load() { if (this.loaded) return; this.loaded = true; try { for (const e of await db.listIdx()) this.mem.set(e.id, e); } catch {} },
  emit() { for (const f of this.listeners) try { f(this.status); } catch {} },
  enqueue(id, front = false) { if (!this.queue.includes(id)) front ? this.queue.unshift(id) : this.queue.push(id); this.status.docs = this.queue.length + (this.running ? 1 : 0); this.emit(); this.kick(); },
  kick() { if (this.running || !this.queue.length || !this.opts) return; this.run(); },
  async run() {
    this.running = true;
    try {
      while (this.queue.length) {
        const id = this.queue.shift(); this.curId = id; this.status.docs = this.queue.length + 1; this.emit();
        let doc = null; try { doc = await db.getDoc(id); } catch {}
        if (!doc) { this.mem.delete(id); try { await db.delIdx(id); } catch {} continue; }
        await this.opts.pace();
        try {
          const o = this.opts, doOcr = o.ocrOn();
          const e = await indexDoc(doc, { ...o, doOcr, langs: o.langs(), onPage: (d, t) => { this.status.page = (doc.title || '') + ' ' + d + '/' + t; this.emit(); } });
          this.mem.set(id, e);
        } catch (e) { if (String(e && e.message) === 'stopped') { this.queue.unshift(id); await new Promise((r) => setTimeout(r, 2000)); } else { console.warn('index', e); this.status.err = String(e && e.message || e); } }
        this.status.done++; this.emit();
      }
    } finally { this.running = false; this.curId = null; this.status = { docs: 0, done: 0, page: '', err: this.status.err || '' }; this.emit(); }
  },
  /** every note whose index is missing, outdated or still has handwriting waiting to be read */
  async scanAll(metas) {
    await this.load();
    for (const m of metas) {
      if (m.type === 'folder' || m.trashed) continue;
      const e = this.mem.get(m.id);
      if (!e || e.v !== 2 || e.updated < (m.updated || 0) || e.langs !== this.opts.langs() || (e.pending && this.opts.ocrOn())) this.enqueue(m.id);
    }
  },
  /** read this note right now: skip the usual wait for you to stop writing */
  urgent(id) { this.urgentUntil = Date.now() + 60000; this.status.err = ''; this.enqueue(id, true); },
  forget(id) { this.mem.delete(id); this.queue = this.queue.filter((x) => x !== id); db.delIdx(id).catch(() => {}); },
  search(q) { const out = []; for (const [id, e] of this.mem) { const h = searchEntry(e, q); if (h.length) out.push({ id, hits: h }); } return out; },
};
