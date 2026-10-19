import './polyfills.js';
import * as pdfjs from './vendor/pdf.min.mjs';
import { db } from './db.js';
import { buildPdf } from './pdfout.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;

/* =====================================================================
   Helpers
   ===================================================================== */
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const now = () => performance.now();
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(c)); }
  return e;
}

const IC = {
  back: 'M19 12H5M12 19l-7-7 7-7',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  ball: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
  fountain: 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.6 7.6M11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  brush: 'm9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z',
  pencil: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5ZM15 5l4 4',
  marker: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3M3 21h6',
  hl: 'm9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4',
  eraser: 'm7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9',
  lasso: 'M7 22a5 2 0 0 1-2-4M3.3 14A6.8 6.8 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-5-1M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  shape: 'M8.3 10a.7.7 0 0 1-.63-1.08L11.4 3a.7.7 0 0 1 1.2-.04L16.3 8.9a.7.7 0 0 1-.57 1.1ZM3 14h7v7H3ZM17.5 14a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  hand: 'M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
  text: 'M4 7V4h16v3M9 20h6M12 4v16',
  insert: 'M12 5v14M5 12h14',
  image: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  pages: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  plus: 'M12 5v14M5 12h14',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  pdf: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6',
  board: 'M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3m4 18 5-5 5 5',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  down: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  search: 'M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
  edit: 'M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
  copy: 'M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  palm: 'M12 22a8 8 0 0 0 8-8V8a2 2 0 0 0-4 0M16 8V5a2 2 0 0 0-4 0v3M12 8V4a2 2 0 0 0-4 0v8l-1.5-1.5a2 2 0 0 0-2.8 2.8L8 18',
  paper: 'M4 4h16v16H4zM4 9h16M4 14h16M4 19h16',
  line: 'M5 19 19 5',
  arrow: 'M5 19 19 5M9 5h10v10',
  rect: 'M4 6h16v12H4z',
  ellipse: 'M12 5c5 0 9 3 9 7s-4 7-9 7-9-3-9-7 4-7 9-7z',
  triangle: 'M12 4l9 16H3z',
  home: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  folderPlus: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 11v6M9 14h6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  focus: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
  move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
  open: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  palette: 'M12 22a10 10 0 1 1 10-10c0 3-2 4-4 4h-2a2 2 0 0 0-1 3.7c.6.5.5 2.3-3 2.3zM7.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM16.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  fit: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
};
function icon(name, size = 24, sw = 1.9) {
  const d = IC[name] || '';
  const w = name === 'more' ? 3.2 : sw;
  const s = h('span', { class: 'svg', style: 'display:grid;place-items:center' });
  s.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  return s;
}

function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), ms);
}
const buzz = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };

const prefs = (() => {
  let p = {};
  try { p = JSON.parse(localStorage.getItem('inknote.prefs') || '{}'); } catch {}
  return { get: (k, d) => (k in p ? p[k] : d), set(k, v) { p[k] = v; try { localStorage.setItem('inknote.prefs', JSON.stringify(p)); } catch {} } };
})();

/* ---------- modal dialog ---------- */
function modal({ title, body, actions }) {
  const d = $('#dlg');
  d.innerHTML = '';
  const close = () => { try { d.close(); } catch {} };
  d.append(
    h('h3', {}, title), ...[].concat(body || []),
    h('div', { class: 'dlg-actions' }, (actions || []).map((a) =>
      h('button', { class: 'btn ' + (a.kind || ''), onclick: () => { if (a.fn && a.fn() === false) return; close(); } }, a.label)))
  );
  d.onclose = null;
  d.showModal();
  return close;
}
const ask = (title, value, okLabel = 'Save', extra) => new Promise((res) => {
  const inp = h('input', { class: 'field', value, maxlength: 200, enterkeyhint: 'done' });
  let done = false;
  const fin = (v) => { if (!done) { done = true; res(v); } };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { fin(inp.value.trim() || null); $('#dlg').close(); } });
  modal({ title, body: [inp, extra], actions: [
    { label: 'Cancel', fn: () => fin(null) },
    { label: okLabel, kind: 'primary', fn: () => fin(inp.value.trim() || null) }] });
  $('#dlg').onclose = () => fin(null);
  setTimeout(() => { inp.focus(); inp.select(); }, 60);
});
const confirmDlg = (title, text, okLabel = 'Delete') => new Promise((res) => {
  let done = false;
  const fin = (v) => { if (!done) { done = true; res(v); } };
  modal({ title, body: h('p', {}, text), actions: [
    { label: 'Cancel', fn: () => fin(false) },
    { label: okLabel, kind: 'danger', fn: () => fin(true) }] });
  $('#dlg').onclose = () => fin(false);
});

/* =====================================================================
   Constants & model
   ===================================================================== */
const PW = 800, PH = 1131, GAP = 22, ADD_H = 64;
const PAPER = { white: '#ffffff', cream: '#fbf5e4', dark: '#1f2333' };
const PALETTE = ['#1b1b1f', '#e03131', '#f76707', '#f59f00', '#2f9e44', '#1c7ed6', '#7048e8', '#e64980', '#868e96', '#f4f4f6'];
const HL_PALETTE = ['#ffe066', '#ffa94d', '#8ce99a', '#74c0fc', '#da77f2', '#ff8787'];
const FOLDER_COLORS = ['#3b5bdb', '#e03131', '#f76707', '#2f9e44', '#7048e8', '#e64980'];
const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const TP = 8; // text padding

// pen families. w(p) maps pressure 0..1 to a width multiplier
const PEN = {
  ball:     { label: 'Ballpoint', range: [1, 12, 0.5], w: (p) => 0.82 + 0.36 * p },
  fountain: { label: 'Fountain',  range: [1, 14, 0.5], w: (p) => 0.22 + 1.5 * p, sim: true },
  brush:    { label: 'Brush',     range: [2, 30, 1],   w: (p) => 0.1 + 2.1 * p, sim: true, taper: true },
  pencil:   { label: 'Pencil',    range: [1, 12, 0.5], w: (p) => 0.7 + 0.6 * p, grain: true },
  marker:   { label: 'Marker',    range: [4, 36, 1],   w: () => 1, flat: true },
};
const PEN_ORDER = ['ball', 'fountain', 'brush', 'pencil', 'marker'];
const DEF_TOOLS = {
  ball: { c: '#1b1b1f', s: 2.5 }, fountain: { c: '#1c3d8f', s: 3.5 }, brush: { c: '#1b1b1f', s: 8 },
  pencil: { c: '#4a4a52', s: 3.5 }, marker: { c: '#e64980', s: 12 }, hl: { c: '#ffe066', s: 18 },
  eraser: { s: 14 }, shape: { c: '#1b1b1f', s: 2.5 }, text: { c: '#1b1b1f', s: 26 },
};
const SHAPES = ['line', 'arrow', 'rect', 'ellipse', 'triangle'];

function newPage(h = PH, extra = {}) { return { id: uid(), h, pdf: null, strokes: [], items: [], ...extra }; }
function makeDoc({ type, title, paper, parent }) {
  return {
    id: uid(), type, title, paper, created: Date.now(), updated: Date.now(),
    pages: [type === 'whiteboard' ? newPage(0) : newPage()],
  };
}
const isInf = (d) => d.type === 'whiteboard';

/* =====================================================================
   State
   ===================================================================== */
function loadTools() {
  const saved = prefs.get('tools2', {}), out = {};
  for (const k of Object.keys(DEF_TOOLS)) out[k] = Object.assign({}, DEF_TOOLS[k], saved[k] || {});
  return out;
}
const S = {
  tabs: [], tab: null,            // open documents; tab === null means the Home screen
  doc: null, pdf: null,
  view: { s: 1, x: 0, y: 0 },
  layout: { ys: [], total: 0 },
  tool: 'pen', penType: prefs.get('penType', 'ball'), shape: prefs.get('shape', 'rect'),
  tools: loadTools(),
  stylusOnly: prefs.get('stylusOnly', false), stylusUserSet: prefs.get('stylusUserSet', false),
  gest: Object.assign({ two: 'undo', three: 'redo', hold: 'eraser', click: 'toggle' }, prefs.get('gest', {})),
  holdShape: prefs.get('holdShape', true),
  act: null, sel: null, mode: null, hover: null, ghosts: [],
  hist: { u: [], r: [] }, thumb: null, curPage: 0, editing: null,
};

const cv = $('#cv');
const ctx = cv.getContext('2d', { alpha: false, desynchronized: true });
const base = document.createElement('canvas');
const bctx = base.getContext('2d', { alpha: false });
let vw = 0, vh = 0, dpr = 1;
let baseDirty = true, frameQueued = false;
const bbCache = new WeakMap();
const pageBorn = new WeakMap();
let pdfCache = new Map(), pdfPending = new Map();

/* =====================================================================
   Geometry
   ===================================================================== */
function relayout() {
  const ys = []; let y = GAP;
  for (const p of S.doc.pages) { p.items ||= []; ys.push(y); y += p.h + GAP; }
  S.layout = { ys, total: isInf(S.doc) ? 0 : y + ADD_H + 90, endY: y };
}
const fitScale = () => Math.max(0.1, (vw - 16) / PW);
function toWorld(sx, sy) { const v = S.view; return [(sx - v.x) / v.s, (sy - v.y) / v.s]; }
function pageAt(wy) {
  const { ys } = S.layout, pages = S.doc.pages;
  for (let i = pages.length - 1; i >= 0; i--) if (wy >= ys[i] - GAP / 2) return i;
  return 0;
}
function bbox(st) {
  let b = bbCache.get(st);
  if (b) return b;
  const p = st.p; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < p.length; i += 3) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1]; }
  const m = st.s * 1.6;
  b = [x0 - m, y0 - m, x1 + m, y1 + m];
  bbCache.set(st, b);
  return b;
}
const hit = (a, b) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
function clampView() {
  const v = S.view;
  if (isInf(S.doc)) { v.s = clamp(v.s, 0.08, 10); return; }
  const f = fitScale();
  v.s = clamp(v.s, f * 0.55, f * 6);
  const cw = PW * v.s;
  v.x = cw <= vw - 12 ? (vw - cw) / 2 : clamp(v.x, vw - cw - 8, 8);
  const th = S.layout.total * v.s;
  v.y = th <= vh ? 0 : clamp(v.y, vh - th, 0);
}

/* =====================================================================
   Page items: text boxes, images, links
   ===================================================================== */
const tlCache = new WeakMap();
const imgCache = new Map();   // ref -> ImageBitmap | 'loading' | 'error'

function wrapLine(c, text, maxW, out) {
  // breaks a paragraph into lines that fit maxW; splits over-long words by characters
  let line = '';
  for (const word of text.split(/(\s+)/)) {
    if (!word) continue;
    const t = line + word;
    if (c.measureText(t).width > maxW && line.trim()) { out.push(line.trimEnd()); line = word.trimStart(); } else line = t;
    while (c.measureText(line).width > maxW && line.length > 1) {
      let k = line.length - 1;
      while (k > 1 && c.measureText(line.slice(0, k)).width > maxW) k--;
      out.push(line.slice(0, k)); line = line.slice(k);
    }
  }
  out.push(line);
}
function textLayout(it) {
  const sig = it.text + '|' + it.w + '|' + it.s;
  let c = tlCache.get(it);
  if (c && c.sig === sig) return c;
  bctx.save(); bctx.font = `${it.s}px ${FONT}`;
  const lines = [];
  for (const para of (it.text || '').split('\n')) { if (!para) lines.push(''); else wrapLine(bctx, para, it.w - 2 * TP, lines); }
  bctx.restore();
  const lh = it.s * 1.3;
  c = { sig, lines, lh, h: Math.max(lines.length, 1) * lh + 2 * TP };
  tlCache.set(it, c);
  return c;
}
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
function linkLabel(it) { return it.text || hostOf(it.url); }
function linkLayout(it) {
  bctx.save(); bctx.font = `600 ${it.s}px ${FONT}`;
  const w = Math.min(560, bctx.measureText(linkLabel(it)).width + it.s * 2.6);
  bctx.restore();
  it.w = w; return { w, h: it.s * 1.9 };
}
function itemRect(it) {
  if (it.k === 'text') return [it.x, it.y, it.x + it.w, it.y + textLayout(it).h];
  if (it.k === 'link') { const l = linkLayout(it); return [it.x, it.y, it.x + l.w, it.y + l.h]; }
  return [it.x, it.y, it.x + it.w, it.y + it.w / (it.ar || 1)];
}
function loadImg(ref) {
  if (imgCache.has(ref)) return imgCache.get(ref);
  imgCache.set(ref, 'loading');
  db.getAsset(ref).then(async (blob) => {
    if (!blob) throw new Error('missing');
    imgCache.set(ref, await createImageBitmap(blob));
  }).catch(() => imgCache.set(ref, 'error')).finally(() => requestFrame(true));
  return 'loading';
}
function drawItem(c, it, o) {
  const dark = S.doc.paper.color === 'dark';
  const r = itemRect(it);
  if (it.k === 'text') {
    if (S.editing === it) return;
    const l = textLayout(it);
    c.save(); c.fillStyle = it.c; c.font = `${it.s}px ${FONT}`; c.textBaseline = 'top';
    l.lines.forEach((ln, i) => c.fillText(ln, it.x + TP, it.y + TP + i * l.lh + (l.lh - it.s) / 2));
    c.restore();
  } else if (it.k === 'link') {
    const w = r[2] - r[0], hh = r[3] - r[1];
    c.save();
    c.fillStyle = dark ? 'rgba(138,164,255,.2)' : 'rgba(59,91,219,.12)';
    c.strokeStyle = dark ? 'rgba(138,164,255,.6)' : 'rgba(59,91,219,.5)'; c.lineWidth = 1.5;
    roundRect(c, r[0], r[1], w, hh, hh / 2); c.fill(); c.stroke();
    c.fillStyle = dark ? '#9db2ff' : '#2c49b8'; c.font = `600 ${it.s}px ${FONT}`; c.textBaseline = 'middle'; c.textAlign = 'left';
    const label = linkLabel(it);
    let t = label; while (t.length > 3 && c.measureText(t).width > w - it.s * 2.3) t = t.slice(0, -2);
    if (t !== label) t += '…';
    c.fillText(t, r[0] + it.s * 0.9, r[1] + hh / 2 + 1);
    const tw = c.measureText(t).width;
    c.fillRect(r[0] + it.s * 0.9, r[1] + hh / 2 + it.s * 0.42, tw, 1.5);
    c.textAlign = 'right'; c.fillText('↗', r[2] - it.s * 0.6, r[1] + hh / 2 + 1);
    c.restore();
  } else {
    const bmp = loadImg(it.ref);
    c.save();
    if (bmp && bmp !== 'loading' && bmp !== 'error') c.drawImage(bmp, r[0], r[1], r[2] - r[0], r[3] - r[1]);
    else {
      c.fillStyle = dark ? '#2b3047' : '#e7e9f2'; c.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
      c.fillStyle = '#8a90a8'; c.font = `600 18px ${FONT}`; c.textAlign = 'center';
      c.fillText(bmp === 'error' ? 'Image missing' : 'Loading…', (r[0] + r[2]) / 2, (r[1] + r[3]) / 2);
    }
    c.restore();
  }
}

/* =====================================================================
   Drawing primitives
   ===================================================================== */
function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function strokePath(c, p, sharp) {
  const n = p.length / 3;
  c.beginPath(); c.moveTo(p[0], p[1]);
  if (n === 1) { c.lineTo(p[0] + 0.01, p[1]); return; }
  if (sharp || n < 3) { for (let i = 1; i < n; i++) c.lineTo(p[3 * i], p[3 * i + 1]); return; }
  for (let i = 1; i < n - 1; i++) {
    c.quadraticCurveTo(p[3 * i], p[3 * i + 1], (p[3 * i] + p[3 * i + 3]) / 2, (p[3 * i + 1] + p[3 * i + 4]) / 2);
  }
  c.lineTo(p[3 * (n - 1)], p[3 * (n - 1) + 1]);
}
const grainCache = new Map();
function grainPattern(c, color) {
  let pat = grainCache.get(color);
  if (pat) return pat;
  const t = document.createElement('canvas'); t.width = t.height = 96;
  const g = t.getContext('2d'), img = g.createImageData(96, 96);
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(color) || [0, '30', '30', '30'];
  const r = parseInt(m[1], 16), gr = parseInt(m[2], 16), b = parseInt(m[3], 16);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 96 * 96; i++) {
    const v = rnd();
    img.data[i * 4] = r; img.data[i * 4 + 1] = gr; img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = v < 0.3 ? 0 : v < 0.55 ? 120 : 215;
  }
  g.putImageData(img, 0, 0);
  pat = c.createPattern(t, 'repeat'); grainCache.set(color, pat);
  return pat;
}
function drawStroke(c, st, dark) {
  const p = st.p, n = p.length / 3;
  const kind = st.t === 'pen' ? 'ball' : st.t;
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (kind === 'hl') {
    c.globalCompositeOperation = dark ? 'source-over' : 'multiply';
    c.globalAlpha = dark ? 0.45 : 0.6;
    c.strokeStyle = st.c; c.lineWidth = st.s; c.lineCap = 'butt';
    strokePath(c, p, st.sh); c.stroke();
    c.restore(); return;
  }
  const T = PEN[kind] || PEN.ball;
  if (kind === 'marker') c.globalAlpha = 0.86;
  c.strokeStyle = T.grain ? grainPattern(c, st.c) : st.c;
  if (st.sh || !(st.vp && n > 2) || kind === 'marker') {
    c.lineWidth = st.s * (kind === 'marker' ? 1 : T.w(0.5));
    if (T.grain) c.lineWidth = st.s * 1.15;
    strokePath(c, p, st.sh); c.stroke();
  } else {
    let mx = p[0], my = p[1];
    for (let i = 1; i < n; i++) {
      const x = p[3 * i], y = p[3 * i + 1];
      const nx = i < n - 1 ? (x + p[3 * i + 3]) / 2 : x, ny = i < n - 1 ? (y + p[3 * i + 4]) / 2 : y;
      let k = T.w((p[3 * i + 2] + p[3 * i - 1]) / 2);
      if (T.taper) k *= Math.min(1, 0.3 + 0.7 * i / 5, 0.25 + 0.75 * (n - 1 - i) / 7);
      c.lineWidth = Math.max(0.2, st.s * k);
      c.beginPath(); c.moveTo(mx, my); c.quadraticCurveTo(x, y, nx, ny); c.stroke();
      mx = nx; my = ny;
    }
  }
  c.restore();
}

function paperPattern(c, pg, style, dark, vis, inf, scale) {
  const col = dark ? 'rgba(255,255,255,.10)' : style === 'ruled' ? 'rgba(52,96,190,.24)' : 'rgba(30,40,80,.13)';
  c.save();
  c.strokeStyle = col; c.fillStyle = dark ? 'rgba(255,255,255,.22)' : 'rgba(30,40,80,.28)';
  c.lineWidth = Math.max(1 / scale, 1);
  if (style === 'ruled') {
    c.beginPath();
    for (let y = 110; y < pg.h - 20; y += 36) { c.moveTo(0, y); c.lineTo(PW, y); }
    c.stroke();
    c.strokeStyle = dark ? 'rgba(255,120,120,.28)' : 'rgba(224,49,49,.3)';
    c.beginPath(); c.moveTo(90, 0); c.lineTo(90, pg.h); c.stroke();
  } else if (style === 'grid') {
    c.beginPath();
    if (inf) {
      const [x0, y0, x1, y1] = vis; let step = 32; while (step * scale < 12) step *= 2;
      for (let x = Math.ceil(x0 / step) * step; x < x1; x += step) { c.moveTo(x, y0); c.lineTo(x, y1); }
      for (let y = Math.ceil(y0 / step) * step; y < y1; y += step) { c.moveTo(x0, y); c.lineTo(x1, y); }
    } else {
      for (let x = 32; x < PW; x += 32) { c.moveTo(x, 0); c.lineTo(x, pg.h); }
      for (let y = 32; y < pg.h; y += 32) { c.moveTo(0, y); c.lineTo(PW, y); }
    }
    c.stroke();
  } else if (style === 'dots') {
    let step = 32; while (step * scale < 14) step *= 2;
    const [x0, y0, x1, y1] = inf ? vis : [0, 0, PW, pg.h];
    const r = Math.max(1.5, 1.1 / scale * 1.2);
    c.beginPath();
    for (let x = Math.ceil(x0 / step) * step; x < x1; x += step)
      for (let y = Math.ceil(y0 / step) * step; y < y1; y += step) { c.moveTo(x + r, y); c.arc(x, y, r, 0, 6.2832); }
    c.fill();
  }
  c.restore();
}

// Draws one page in page-local coordinates (ctx already translated to page origin)
function drawPage(c, pg, o) {
  const doc = S.doc, inf = isInf(doc);
  const pcol = doc.paper.color, dark = pcol === 'dark', scale = o.scale || 1;
  const vis = o.vis;
  if (inf) {
    c.fillStyle = PAPER[pcol]; c.fillRect(vis[0] - 2, vis[1] - 2, vis[2] - vis[0] + 4, vis[3] - vis[1] + 4);
    paperPattern(c, pg, doc.paper.style, dark, vis, true, scale);
  } else {
    c.save();
    if (!o.flat) { c.shadowColor = 'rgba(10,15,40,.28)'; c.shadowBlur = 14; c.shadowOffsetY = 2; }
    c.fillStyle = PAPER[pg.pdf != null ? 'white' : pcol];
    c.fillRect(0, 0, PW, pg.h);
    c.restore();
    c.save(); c.beginPath(); c.rect(0, 0, PW, pg.h); c.clip();
    if (pg.pdf != null) {
      const bmp = o.pdfBitmap || pdfCache.get(pg.pdf)?.canvas;
      if (bmp) c.drawImage(bmp, 0, 0, PW, pg.h);
      else { c.fillStyle = '#9aa0b8'; c.font = '600 22px system-ui'; c.textAlign = 'center'; c.fillText('Rendering…', PW / 2, 60); }
    } else paperPattern(c, pg, doc.paper.style, dark, vis, false, scale);
  }
  const sel = o.skipSel && S.sel ? S.sel : null;
  for (const it of pg.items || []) {
    if (sel && sel.oset.has(it)) continue;
    if (vis && !hit(itemRect(it), vis)) continue;
    drawItem(c, it, o);
  }
  for (const st of pg.strokes) {
    if (sel && sel.set.has(st)) continue;
    if (vis && !hit(bbox(st), vis)) continue;
    drawStroke(c, st, dark);
  }
  if (!inf) c.restore();
}

/* =====================================================================
   Render loop
   ===================================================================== */
function resize() {
  const r = $('#stage').getBoundingClientRect();
  if (!r.width || !r.height) return;
  const first = !vw;
  vw = r.width; vh = r.height; dpr = Math.min(window.devicePixelRatio || 1, 3);
  for (const c of [cv, base]) { c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr); }
  if (S.doc) { if (first && !S.restored) fitView(); clampView(); }
  requestFrame(true);
}
function fitView() {
  const f = fitScale();
  if (isInf(S.doc)) S.view = { s: 1, x: vw / 2 - 400, y: vh / 2 - 300 };
  else S.view = { s: f, x: (vw - PW * f) / 2, y: 0 };
}
function requestFrame(dirty) {
  if (dirty) baseDirty = true;
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(frame);
}
const pagesAnimating = () => S.doc && S.doc.pages.some((p) => { const t = pageBorn.get(p); return t && now() - t < 320; });

function animateView(to, ms = 260) {
  S.viewAnim = { from: { ...S.view }, to, t0: now(), ms };
  requestFrame();
}
function stepViewAnim() {
  const a = S.viewAnim; if (!a) return;
  const k = ease((now() - a.t0) / a.ms), v = S.view;
  v.s = a.from.s + (a.to.s - a.from.s) * k; v.x = a.from.x + (a.to.x - a.from.x) * k; v.y = a.from.y + (a.to.y - a.from.y) * k;
  clampView();
  if (now() - a.t0 >= a.ms) S.viewAnim = null;
  baseDirty = true;
}

function renderBase() {
  const doc = S.doc, { s, x, y } = S.view;
  const c = bctx, inf = isInf(doc);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim() || '#dfe2ec';
  c.fillRect(0, 0, base.width, base.height);
  c.setTransform(dpr * s, 0, 0, dpr * s, dpr * x, dpr * y);
  const wx0 = -x / s, wy0 = -y / s, wx1 = (vw - x) / s, wy1 = (vh - y) / s;
  doc.pages.forEach((pg, i) => {
    const top = S.layout.ys[i];
    if (!inf && (top > wy1 || top + pg.h < wy0)) return;
    c.save(); c.translate(0, top);
    const born = pageBorn.get(pg);
    if (born) { const k = ease((now() - born) / 300); if (k < 1) { c.globalAlpha = k; c.translate(0, (1 - k) * 36); } }
    drawPage(c, pg, { vis: [wx0, wy0 - top, wx1, wy1 - top], scale: s * dpr, skipSel: true });
    c.restore();
  });
  if (!inf) {
    const by = S.layout.endY + 10;
    if (by < wy1 && by + ADD_H > wy0) {
      c.fillStyle = 'rgba(59,91,219,.92)';
      roundRect(c, PW / 2 - 130, by, 260, ADD_H, 22); c.fill();
      c.fillStyle = '#fff'; c.font = '700 26px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('＋  Add page', PW / 2, by + ADD_H / 2 + 1);
    }
  }
  schedulePdf();
}

function frame() {
  frameQueued = false;
  if (!S.doc || !vw) return;
  if (S.viewAnim) stepViewAnim();
  const a = S.act;
  if (a && a.snap) stepSnap(a);
  const anim = pagesAnimating();
  if (baseDirty || anim) { renderBase(); baseDirty = false; }
  const { s, x, y } = S.view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(base, 0, 0);
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * x, dpr * y);
  const dark = S.doc.paper.color === 'dark';
  const inf = isInf(S.doc);

  // fading ghosts of erased strokes
  if (S.ghosts.length) {
    const t = now();
    S.ghosts = S.ghosts.filter((g) => t - g.t0 < 220);
    for (const g of S.ghosts) {
      ctx.save(); ctx.translate(0, S.layout.ys[g.pi] || 0); ctx.globalAlpha = 1 - ease((t - g.t0) / 220);
      drawStroke(ctx, g.st, dark); ctx.restore();
    }
  }
  if (a && a.kind === 'ink' && a.st) {
    ctx.save(); ctx.translate(0, S.layout.ys[a.pi]);
    if (!inf) { ctx.beginPath(); ctx.rect(0, 0, PW, S.doc.pages[a.pi].h); ctx.clip(); }
    drawStroke(ctx, a.st, dark); ctx.restore();
  }
  if (a && a.kind === 'shape') {
    const top = S.layout.ys[a.pi];
    ctx.save(); ctx.translate(0, top);
    drawStroke(ctx, a.st, dark);
    // guide: anchor, dashed bounds, size read-out
    ctx.setLineDash([6 / s, 5 / s]); ctx.lineWidth = 1.4 / s; ctx.strokeStyle = 'rgba(59,91,219,.85)';
    ctx.strokeRect(Math.min(a.a[0], a.b[0]), Math.min(a.a[1], a.b[1]), Math.abs(a.b[0] - a.a[0]), Math.abs(a.b[1] - a.a[1]));
    ctx.setLineDash([]); ctx.fillStyle = '#3b5bdb';
    ctx.beginPath(); ctx.arc(a.a[0], a.a[1], 5 / s, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(a.b[0], a.b[1], 7 / s, 0, 6.2832); ctx.fillStyle = 'rgba(59,91,219,.25)'; ctx.fill(); ctx.stroke();
    ctx.font = `700 ${13 / s}px ${FONT}`; ctx.fillStyle = '#3b5bdb'; ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(Math.abs(a.b[0] - a.a[0]))} × ${Math.round(Math.abs(a.b[1] - a.a[1]))}`, a.b[0] + 12 / s, a.b[1] - 10 / s);
    ctx.restore();
  }
  if (a && a.kind === 'erase') {
    ctx.save(); ctx.strokeStyle = 'rgba(224,49,49,.9)'; ctx.fillStyle = 'rgba(224,49,49,.12)'; ctx.lineWidth = 1.5 / s;
    ctx.beginPath(); ctx.arc(a.wx, a.wy, S.tools.eraser.s / s, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  if (a && a.kind === 'lasso' && a.poly.length > 1) {
    ctx.save(); ctx.strokeStyle = '#3b5bdb'; ctx.fillStyle = 'rgba(59,91,219,.08)'; ctx.lineWidth = 2 / s; ctx.setLineDash([8 / s, 6 / s]);
    ctx.beginPath(); ctx.moveTo(a.poly[0][0], a.poly[0][1]); for (const q of a.poly) ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  // pen hover cursor (S Pen)
  if (S.hover && !a && !S.mode) {
    const [hx, hy] = toWorld(S.hover.x, S.hover.y);
    const r = S.tool === 'eraser' ? S.tools.eraser.s / s : Math.max(2.5 / s, (curTool()?.s || 3) * 0.5);
    ctx.save(); ctx.lineWidth = 1.4 / s; ctx.strokeStyle = S.tool === 'eraser' ? 'rgba(224,49,49,.9)' : 'rgba(59,91,219,.9)';
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(hx, hy, r, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  if (S.sel) {
    const sl = S.sel;
    for (const it of sl.items) {
      ctx.save(); ctx.translate(sl.dx, S.layout.ys[it.pi] + sl.dy);
      if (it.o.p) drawStroke(ctx, it.o, dark); else drawItem(ctx, it.o, {});
      ctx.restore();
    }
    ctx.save(); ctx.strokeStyle = '#3b5bdb'; ctx.lineWidth = 2 / s; ctx.setLineDash([8 / s, 6 / s]);
    const b = sl.b; ctx.strokeRect(b[0] + sl.dx - 6, b[1] + sl.dy - 6, b[2] - b[0] + 12, b[3] - b[1] + 12);
    if (resizable()) {
      ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.lineWidth = 2.5 / s;
      ctx.beginPath(); ctx.arc(b[2] + sl.dx + 6, b[3] + sl.dy + 6, 11 / s, 0, 6.2832); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    placeSelbar();
  }
  if (editor) syncEditor();
  updateIndicators();
  if (anim || S.ghosts.length || S.viewAnim || (a && a.snap && !a.snap.done)) requestFrame();
}

function updateIndicators() {
  const pi = $('#pageInd');
  if (S.doc.type === 'whiteboard') { pi.hidden = true; return; }
  const wy = (vh * 0.4 - S.view.y) / S.view.s;
  const i = pageAt(wy);
  pi.hidden = false;
  const t = `${i + 1} / ${S.doc.pages.length}`;
  if (pi.textContent !== t) pi.textContent = t;
  S.curPage = i;
}
let zoomTimer;
function flashZoom() {
  const z = $('#zoomInd');
  const rel = isInf(S.doc) ? S.view.s : S.view.s / fitScale();
  z.textContent = Math.round(rel * 100) + '%';
  z.classList.add('show'); clearTimeout(zoomTimer); zoomTimer = setTimeout(() => z.classList.remove('show'), 900);
}

/* =====================================================================
   PDF handling
   ===================================================================== */
const pdfQueue = [];
let pdfTimer = null, pdfBusy = 0;
async function renderPdfBitmap(pdf, idx, pxW) {
  const page = await pdf.getPage(idx + 1);
  const v0 = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: pxW / v0.width });
  const c = document.createElement('canvas');
  c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  await page.render({ canvasContext: c.getContext('2d'), canvas: c, viewport: vp }).promise;
  return c;
}
function schedulePdf() {
  if (!S.pdf) return;
  clearTimeout(pdfTimer);
  pdfTimer = setTimeout(ensurePdf, 90);
}
function ensurePdf() {
  const T = S.tab;
  if (!S.pdf || !S.doc || !T) return;
  const { s, y } = S.view;
  const wy0 = -y / s, wy1 = (vh - y) / s;
  const want = clamp(Math.round(PW * s * dpr * 1.15), 500, 3200);
  const visible = [];
  S.doc.pages.forEach((pg, i) => {
    if (pg.pdf == null) return;
    const top = S.layout.ys[i];
    if (top > wy1 + 400 || top + pg.h < wy0 - 400) return;
    visible.push(pg.pdf);
    const have = pdfCache.get(pg.pdf);
    const pend = pdfPending.get(pg.pdf) || 0;
    if ((!have || have.w < want * 0.75) && pend < want * 0.75) {
      pdfPending.set(pg.pdf, want);
      pdfQueue.push({ T, idx: pg.pdf, w: want });
    }
  });
  if (pdfCache.size > 7) for (const k of [...pdfCache.keys()]) if (!visible.includes(k) && pdfCache.size > 7) pdfCache.delete(k);
  pumpPdf();
}
function pumpPdf() {
  while (pdfBusy < 2 && pdfQueue.length) {
    const { T, idx, w } = pdfQueue.shift();
    if (!T.pdf) continue;
    pdfBusy++;
    renderPdfBitmap(T.pdf, idx, w).then((canvas) => {
      T.pdfCache.set(idx, { canvas, w });
      if (S.tab === T) requestFrame(true);
    }).catch((e) => console.warn('pdf page failed', idx, e)).finally(() => {
      pdfBusy--; T.pdfPending.delete(idx); pumpPdf();
    });
  }
}

/* =====================================================================
   History (undo / redo) and object actions
   ===================================================================== */
function commit(a) {
  S.hist.u.push(a); S.hist.r.length = 0;
  if (S.hist.u.length > 300) S.hist.u.shift();
  changed();
}
function undo(silent) { const a = S.hist.u.pop(); if (!a) return false; clearSel(); a.undo(); S.hist.r.push(a); changed(); if (!silent) flashAction('undo'); return true; }
function redo(silent) { const a = S.hist.r.pop(); if (!a) return false; clearSel(); a.redo(); S.hist.u.push(a); changed(); if (!silent) flashAction('redo'); return true; }
function changed() { baseDirty = true; requestFrame(); updateUR(); scheduleSave(); }
function updateUR() { $('#btnUndo').disabled = !S.hist.u.length; $('#btnRedo').disabled = !S.hist.r.length; }
let flashT;
function flashAction(kind) {
  const f = $('#flash'); if (!f) return;
  f.replaceChildren(icon(kind, 30, 2.2)); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  clearTimeout(flashT); flashT = setTimeout(() => f.classList.remove('go'), 700);
}

const arrOf = (pg, o) => (o.p ? pg.strokes : pg.items);
const pageIndex = (pg) => S.doc.pages.indexOf(pg);
function ghost(st, pi) { S.ghosts.push({ st, pi, t0: now() }); }

function actAddObjs(pg, objs) {
  for (const o of objs) arrOf(pg, o).push(o);
  commit({
    undo() { for (const o of objs) { const a = arrOf(pg, o), i = a.indexOf(o); if (i >= 0) a.splice(i, 1); } },
    redo() { for (const o of objs) { const a = arrOf(pg, o); if (!a.includes(o)) a.push(o); } },
  });
}
function actRemoveObjs(list, fade = true) { // [{pg, o}]
  const rec = list.map(({ pg, o }) => ({ pg, o, i: arrOf(pg, o).indexOf(o) })).filter((r) => r.i >= 0);
  if (!rec.length) return;
  rec.forEach((r) => { const a = arrOf(r.pg, r.o); a.splice(a.indexOf(r.o), 1); if (fade && r.o.p) ghost(r.o, pageIndex(r.pg)); });
  commit({
    undo() { [...rec].sort((a, b) => a.i - b.i).forEach((r) => { const a = arrOf(r.pg, r.o); a.splice(Math.min(r.i, a.length), 0, r.o); }); },
    redo() { rec.forEach((r) => { const a = arrOf(r.pg, r.o), i = a.indexOf(r.o); if (i >= 0) a.splice(i, 1); }); },
  });
}
function translate(st, dx, dy) { for (let i = 0; i < st.p.length; i += 3) { st.p[i] += dx; st.p[i + 1] += dy; } bbCache.delete(st); }
function moveObj(o, dx, dy) { if (o.p) translate(o, dx, dy); else { o.x += dx; o.y += dy; } }
function actProp(objs, key, from, to) {
  objs.forEach((o, i) => { o[key] = to[i]; if (o.p) bbCache.delete(o); });
  commit({
    undo() { objs.forEach((o, i) => { o[key] = from[i]; }); },
    redo() { objs.forEach((o, i) => { o[key] = to[i]; }); },
  });
}

function addPageAt(index, pg, silent) {
  const pages = S.doc.pages;
  pageBorn.set(pg, now());
  pages.splice(index, 0, pg); relayout();
  if (!silent) commit({
    undo() { const i = pages.indexOf(pg); if (i >= 0) pages.splice(i, 1); relayout(); },
    redo() { pageBorn.set(pg, now()); pages.splice(Math.min(index, pages.length), 0, pg); relayout(); },
  }); else changed();
}
function removePageAt(index) {
  const pages = S.doc.pages;
  if (pages.length < 2) return toast('A notebook needs at least one page');
  const [pg] = pages.splice(index, 1); relayout();
  commit({
    undo() { pageBorn.set(pg, now()); pages.splice(Math.min(index, pages.length), 0, pg); relayout(); },
    redo() { const i = pages.indexOf(pg); if (i >= 0) pages.splice(i, 1); relayout(); },
  });
  clampView();
}
function blankPageLike(i) {
  const ref = S.doc.pages[i] || S.doc.pages[0];
  return newPage(S.doc.pages.some((p) => p.pdf != null) ? ref.h : PH);
}
function scrollToPage(i) {
  const v = S.view, y = -(S.layout.ys[i] - GAP / 2) * v.s;
  const keep = { ...S.view };
  S.view.y = y; clampView(); const to = { ...S.view }; S.view = keep;
  animateView(to, 280);
}

/* =====================================================================
   Selection (strokes + text / image / link items)
   ===================================================================== */
const objRect = (o) => (o.p ? bbox(o) : itemRect(o));
function makeSel(items) {
  if (!items.length) { clearSel(); return; }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const it of items) {
    const r = objRect(it.o), top = S.layout.ys[it.pi];
    x0 = Math.min(x0, r[0]); x1 = Math.max(x1, r[2]); y0 = Math.min(y0, r[1] + top); y1 = Math.max(y1, r[3] + top);
  }
  S.sel = {
    items, b: [x0, y0, x1, y1], dx: 0, dy: 0,
    set: new Set(items.filter((i) => i.o.p).map((i) => i.o)), oset: new Set(items.filter((i) => !i.o.p).map((i) => i.o)),
  };
  baseDirty = true; renderSelbar(); requestFrame();
}
function clearSel() {
  if (S.sel) { S.sel = null; $('#selbar').hidden = true; baseDirty = true; requestFrame(); }
}
function resizable() {
  const sl = S.sel; if (!sl || sl.items.length !== 1) return false;
  const o = sl.items[0].o; return o.k === 'img' || o.k === 'text';
}
function placeSelbar() {
  const sl = S.sel, bar = $('#selbar'), { s, x, y } = S.view;
  bar.hidden = !!S.act;
  const cx = ((sl.b[0] + sl.b[2]) / 2 + sl.dx) * s + x;
  const half = (bar.offsetWidth || 240) / 2 + 8;
  bar.style.left = clamp(cx, half, Math.max(half, vw - half)) + 'px';
  const ty = (sl.b[1] + sl.dy - 14) * s + y;
  bar.style.top = (ty < 56 ? (sl.b[3] + sl.dy + 14) * s + y + 46 : ty) + 'px';
}
function renderSelbar() {
  const bar = $('#selbar'); bar.innerHTML = '';
  const sl = S.sel; if (!sl) return;
  const one = sl.items.length === 1 ? sl.items[0].o : null;
  const B = (label, ic, fn, cls) => bar.append(h('button', { class: cls || '', onclick: fn }, icon(ic, 18), label));
  B('Delete', 'trash', () => { const list = sl.items.map((i) => ({ pg: i.pg, o: i.o })); S.sel = null; bar.hidden = true; actRemoveObjs(list); }, 'del');
  B('Copy', 'copy', duplicateSel);
  B('Colour', 'palette', openColourPop);
  if (one && one.k === 'link') B('Open', 'open', () => openLink(one.url));
  if (one && one.k === 'text') {
    B('Edit', 'edit', () => { const it = sl.items[0]; clearSel(); openTextEditor(it.o, it.pg, it.pi, false); });
    bar.append(h('button', { onclick: () => scaleText(one, 1 / 1.18) }, 'A−'), h('button', { onclick: () => scaleText(one, 1.18) }, 'A+'));
  }
  B('Done', 'check', clearSel);
  bar.hidden = false;
}
function scaleText(it, k) {
  const from = it.s, to = Math.round(clamp(it.s * k, 10, 140));
  actProp([it], 's', [from], [to]);
  makeSelAgain();
}
function makeSelAgain() { const items = S.sel ? S.sel.items : []; if (items.length) makeSel(items); }
function duplicateSel() {
  const sl = S.sel; if (!sl) return;
  const off = 28, copies = [];
  for (const it of sl.items) {
    const c = structuredClone(it.o); if (c.id) c.id = uid(); moveObj(c, off, off);
    copies.push({ o: c, pg: it.pg, pi: it.pi });
  }
  copies.forEach((c) => arrOf(c.pg, c.o).push(c.o));
  commit({
    undo() { copies.forEach((c) => { const a = arrOf(c.pg, c.o), i = a.indexOf(c.o); if (i >= 0) a.splice(i, 1); }); },
    redo() { copies.forEach((c) => { const a = arrOf(c.pg, c.o); if (!a.includes(c.o)) a.push(c.o); }); },
  });
  makeSel(copies);
}
function openColourPop() {
  const sl = S.sel; if (!sl) return;
  const pop = $('#pop'); pop.innerHTML = ''; pop.hidden = false; popOpen = true; pop.dataset.kind = 'sel';
  pop.append(h('h4', {}, 'Recolour selection'));
  const row = h('div', { class: 'swatches' });
  const apply = (c) => {
    const targets = sl.items.map((i) => i.o).filter((o) => o.p || o.k === 'text');
    if (!targets.length) return;
    actProp(targets, 'c', targets.map((o) => o.c), targets.map(() => c));
    closePop();
  };
  PALETTE.forEach((c) => row.append(h('button', { class: 'sw', style: `background:${c}`, 'aria-label': c, onclick: () => apply(c) })));
  pop.append(row);
}
function openLink(u) {
  try { const w = window.open(u, '_blank', 'noopener'); if (!w) location.href = u; } catch { toast('Could not open link'); }
}

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function lassoSelect(poly) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const items = [];
  S.doc.pages.forEach((pg, pi) => {
    const top = S.layout.ys[pi];
    for (const st of pg.strokes) {
      const b = bbox(st);
      if (!hit([b[0], b[1] + top, b[2], b[3] + top], [x0, y0, x1, y1])) continue;
      const p = st.p; let inn = 0, tot = 0;
      const step = Math.max(1, Math.floor(p.length / 3 / 24));
      for (let i = 0; i < p.length; i += 3 * step) { tot++; if (pointInPoly(p[i], p[i + 1] + top, poly)) inn++; }
      if (tot && inn / tot >= 0.5) items.push({ o: st, pg, pi });
    }
    for (const it of pg.items) {
      const r = itemRect(it);
      if (pointInPoly((r[0] + r[2]) / 2, (r[1] + r[3]) / 2 + top, poly)) items.push({ o: it, pg, pi });
    }
  });
  makeSel(items);
}
function hitItem(wx, wy) {
  const m = 6 / S.view.s;
  for (let pi = S.doc.pages.length - 1; pi >= 0; pi--) {
    const pg = S.doc.pages[pi], top = S.layout.ys[pi];
    for (let k = pg.items.length - 1; k >= 0; k--) {
      const r = itemRect(pg.items[k]);
      if (wx >= r[0] - m && wx <= r[2] + m && wy - top >= r[1] - m && wy - top <= r[3] + m) return { o: pg.items[k], pg, pi };
    }
  }
  return null;
}
function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return qx * qx + qy * qy;
}
function strokeAt(wx, wy) {
  const r = 9 / S.view.s;
  for (let pi = S.doc.pages.length - 1; pi >= 0; pi--) {
    const pg = S.doc.pages[pi], ly = wy - S.layout.ys[pi];
    for (let k = pg.strokes.length - 1; k >= 0; k--) {
      const st = pg.strokes[k], p = st.p, rr = r + st.s / 2;
      for (let i = 0; i + 5 < p.length; i += 3) if (segDist2(wx, ly, p[i], p[i + 1], p[i + 3], p[i + 4]) <= rr * rr) return { o: st, pg, pi };
      if (p.length === 3 && (p[0] - wx) ** 2 + (p[1] - ly) ** 2 <= rr * rr) return { o: st, pg, pi };
    }
  }
  return null;
}

/* =====================================================================
   Text box editor (HTML textarea laid over the canvas)
   ===================================================================== */
let editor = null;
function openTextEditor(it, pg, pi, isNew) {
  commitEditor();
  const el = h('textarea', { class: 'txtedit', spellcheck: 'false', 'aria-label': 'Text box', rows: 1 });
  el.value = it.text || '';
  $('#stage').append(el);
  editor = { el, it, pg, pi, isNew, old: it.text || '' };
  S.editing = it;
  el.addEventListener('input', () => { it.text = el.value; syncEditor(); requestFrame(true); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') commitEditor(); });
  el.addEventListener('blur', () => setTimeout(() => { if (editor && editor.el === el) commitEditor(); }, 150));
  requestFrame(true);
  syncEditor();
  setTimeout(() => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); revealRect(it, pi); }, 30);
}
function syncEditor() {
  if (!editor) return;
  const { el, it, pi } = editor, v = S.view;
  const x = it.x * v.s + v.x, y = (S.layout.ys[pi] + it.y) * v.s + v.y;
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = it.w * v.s + 'px';
  el.style.fontSize = it.s * v.s + 'px'; el.style.color = it.c; el.style.padding = TP * v.s + 'px';
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, it.s * 1.3 * v.s + 2 * TP * v.s) + 'px';
}
function revealRect(it, pi) {
  const r = itemRect(it), top = S.layout.ys[pi], v = S.view;
  const sy = (top + r[3]) * v.s + v.y;
  if (sy > vh - 24) { v.y -= sy - (vh - 40); clampView(); requestFrame(true); }
  else if ((top + r[1]) * v.s + v.y < 20) { v.y += 20 - ((top + r[1]) * v.s + v.y); clampView(); requestFrame(true); }
}
function commitEditor() {
  if (!editor) return;
  const { el, it, pg, isNew, old } = editor;
  editor = null; S.editing = null;
  const text = el.value; el.remove();
  it.text = text;
  const empty = text.trim() === '';
  if (isNew) {
    if (empty) { const i = pg.items.indexOf(it); if (i >= 0) pg.items.splice(i, 1); }
    else commit({
      undo() { const i = pg.items.indexOf(it); if (i >= 0) pg.items.splice(i, 1); },
      redo() { if (!pg.items.includes(it)) pg.items.push(it); },
    });
  } else if (empty) {
    it.text = old; actRemoveObjs([{ pg, o: it }]);
  } else if (text !== old) {
    commit({ undo() { it.text = old; }, redo() { it.text = text; } });
  }
  baseDirty = true; requestFrame();
}
function newTextAt(wx, wy) {
  const pi = isInf(S.doc) ? 0 : pageAt(wy), pg = S.doc.pages[pi], top = S.layout.ys[pi];
  const T = S.tools.text;
  const it = { id: uid(), k: 'text', x: wx - 10, y: wy - top - T.s * 0.7, w: 340, text: '', c: T.c, s: T.s };
  if (!isInf(S.doc)) it.x = clamp(it.x, 10, PW - it.w - 10);
  pg.items.push(it);
  openTextEditor(it, pg, pi, true);
}

/* =====================================================================
   Input: pointers, pan / pinch / multi-finger taps, S Pen button
   ===================================================================== */
const ptr = new Map();
let pan = null, pinch = null, momentum = null, tg = null, barrel = { on: false, t: 0 };
const touches = () => [...ptr.values()].filter((p) => p.t === 'touch');

function local(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  if (!S.doc) return;
  e.preventDefault();
  const finger = e.pointerType === 'touch';
  // palm rejection: ignore touches while the pen is writing
  if (finger && S.act && S.act.pt === 'pen') return;
  commitEditor();
  closePop(); closeMenu(); cancelMomentum(); S.viewAnim = null; S.hover = null;
  try { cv.setPointerCapture(e.pointerId); } catch {}
  const [sx, sy] = local(e);
  ptr.set(e.pointerId, { x: sx, y: sy, t: e.pointerType });
  if (e.pointerType === 'pen' && !S.stylusUserSet && !S.stylusOnly) { S.stylusOnly = true; toast('Stylus detected: fingers now pan and zoom'); syncMenu(); }

  if (finger) {
    const n = touches().length;
    if (n === 1) tg = { t0: e.timeStamp, max: 1, moved: false, start: new Map() };
    if (tg) { tg.max = Math.max(tg.max, n); tg.start.set(e.pointerId, [sx, sy]); }
    if (n >= 2) { cancelAct(); if (S.mode === 'pan') { pan = null; } beginPinch(); return; }
  } else if (S.mode === 'pan' || S.mode === 'pinch') { S.mode = null; pan = null; pinch = null; }

  if (e.button === 1 || S.tool === 'hand' || (finger && S.stylusOnly)) { beginPan(e.pointerId, sx, sy, finger); return; }
  let tool = S.tool;
  if (e.pointerType === 'pen' || e.pointerType === 'mouse') {
    if (e.buttons & 32) tool = 'eraser';                       // eraser end of the pen
    else if (e.buttons & 2) {                                  // S Pen button held while writing
      if (S.gest.hold === 'eraser') tool = 'eraser';
      else if (S.gest.hold === 'lasso') tool = 'lasso';
    }
  }
  beginTool(tool, e, sx, sy);
});

cv.addEventListener('pointermove', (e) => {
  if (!S.doc) return;
  const p = ptr.get(e.pointerId);
  const [sx, sy] = local(e);
  if (!p) {
    if (e.pointerType === 'pen' || e.pointerType === 'mouse') {
      S.hover = { x: sx, y: sy }; requestFrame();
      if (e.pointerType === 'pen') {
        const b = e.buttons & 2;
        if (b && !barrel.on) { barrel.on = true; barrel.t = e.timeStamp; }
        else if (!b && barrel.on) { barrel.on = false; if (e.timeStamp - barrel.t < 900) barrelClick(); }
      }
    }
    return;
  }
  p.x = sx; p.y = sy;
  if (tg && e.pointerType === 'touch') { const s0 = tg.start.get(e.pointerId); if (s0 && Math.hypot(sx - s0[0], sy - s0[1]) > 16) tg.moved = true; }
  if (S.mode === 'pinch') { if (e.pointerType === 'touch') movePinch(); return; }
  if (S.mode === 'pan' && pan && pan.pid === e.pointerId) { movePan(sx, sy); return; }
  if (!S.act || S.act.pid !== e.pointerId) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  const list = evs.length ? evs : [e];
  for (const ev of list) { const [lx, ly] = local(ev); feed(ev, lx, ly); }
  requestFrame();
});
const endPtr = (e, cancelled) => {
  if (!ptr.has(e.pointerId)) return;
  ptr.delete(e.pointerId);
  if (e.pointerType === 'touch' && tg && touches().length === 0) {
    const g = tg; tg = null;
    if (!cancelled && !g.moved && g.max >= 2 && e.timeStamp - g.t0 < 420) { fireTapGesture(g.max); return; }
  }
  if (S.mode === 'pinch') { if (touches().length < 2) { S.mode = null; pinch = null; } return; }
  if (S.mode === 'pan' && pan && pan.pid === e.pointerId) { endPan(cancelled); return; }
  if (S.act && S.act.pid === e.pointerId) { cancelled ? cancelAct() : finishAct(); }
};
cv.addEventListener('pointerup', (e) => endPtr(e, false));
cv.addEventListener('pointercancel', (e) => endPtr(e, true));
cv.addEventListener('pointerleave', (e) => { if (!ptr.has(e.pointerId)) { S.hover = null; requestFrame(); } });
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [sx, sy] = local(e);
  if (e.ctrlKey || e.metaKey) zoomAt(sx, sy, Math.exp(-e.deltaY * 0.01));
  else { S.view.x -= e.deltaX; S.view.y -= e.deltaY; clampView(); requestFrame(true); }
}, { passive: false });

function runAction(a) {
  if (a === 'undo') { if (!undo()) toast('Nothing to undo', 900); }
  else if (a === 'redo') { if (!redo()) toast('Nothing to redo', 900); }
}
function fireTapGesture(n) {
  const a = n >= 3 ? S.gest.three : S.gest.two;
  if (a && a !== 'none') { buzz(10); runAction(a); }
}
function barrelClick() {
  const a = S.gest.click;
  if (a === 'toggle') {
    if (S.tool === 'eraser') setTool(S.prevTool && S.prevTool !== 'eraser' ? S.prevTool : 'pen');
    else { S.prevTool = S.tool; setTool('eraser'); }
    buzz(15); toast(S.tool === 'eraser' ? 'Eraser' : 'Back to ' + toolLabel(S.tool), 900);
  } else if (a === 'undo') { buzz(10); runAction('undo'); }
  else if (a === 'redo') { buzz(10); runAction('redo'); }
}

function zoomAt(sx, sy, k) {
  const v = S.view, [wx, wy] = toWorld(sx, sy);
  v.s *= k; clampView();
  v.x = sx - wx * v.s; v.y = sy - wy * v.s; clampView();
  requestFrame(true); flashZoom();
}
function beginPan(pid, sx, sy, finger) {
  S.mode = 'pan'; pan = { pid, sx, sy, x0: sx, y0: sy, vx: 0, vy: 0, t: now(), t00: now(), dist: 0, finger };
}
function movePan(sx, sy) {
  const dx = sx - pan.sx, dy = sy - pan.sy;
  const t = now(), dt = Math.max(1, t - pan.t);
  pan.vx = 0.7 * pan.vx + 0.3 * (dx / dt); pan.vy = 0.7 * pan.vy + 0.3 * (dy / dt); pan.t = t;
  pan.dist += Math.hypot(dx, dy);
  pan.sx = sx; pan.sy = sy;
  S.view.x += dx; S.view.y += dy; clampView(); requestFrame(true);
}
function endPan(cancelled) {
  S.mode = null;
  const p = pan; pan = null;
  if (!p || cancelled) return;
  if (p.dist < 8 && now() - p.t00 < 450) {            // a tap: open links
    const [wx, wy] = toWorld(p.sx, p.sy), h = hitItem(wx, wy);
    if (h && h.o.k === 'link') { buzz(10); openLink(h.o.url); return; }
  }
  if (p.finger && now() - p.t < 80 && Math.hypot(p.vx, p.vy) > 0.15) startMomentum(p.vx, p.vy);
}
function startMomentum(vx, vy) {
  let last = now();
  const step = () => {
    const t = now(), dt = t - last; last = t;
    S.view.x += vx * dt; S.view.y += vy * dt;
    const k = Math.pow(0.94, dt / 16); vx *= k; vy *= k;
    clampView(); requestFrame(true);
    if (Math.hypot(vx, vy) > 0.03) momentum = requestAnimationFrame(step); else momentum = null;
  };
  momentum = requestAnimationFrame(step);
}
function cancelMomentum() { if (momentum) cancelAnimationFrame(momentum); momentum = null; }

function beginPinch() {
  S.mode = 'pinch'; pan = null;
  const [a, b] = touches();
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  pinch = { d, s: S.view.s, w: toWorld(cx, cy) };
}
function movePinch() {
  const t = touches();
  if (!pinch || t.length < 2) return;
  const [a, b] = t;
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const v = S.view;
  v.s = pinch.s * d / pinch.d; clampView();
  v.x = cx - pinch.w[0] * v.s; v.y = cy - pinch.w[1] * v.s; clampView();
  requestFrame(true); flashZoom();
}

/* =====================================================================
   Tools
   ===================================================================== */
function beginTool(tool, e, sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  const inf = isInf(S.doc);
  if (S.sel && tool !== 'lasso') clearSel();
  if (!inf && wy > S.layout.endY && wy < S.layout.endY + ADD_H + 40 && Math.abs(wx - PW / 2) < 150) {
    addPageAt(S.doc.pages.length, blankPageLike(S.doc.pages.length - 1));
    scrollToPage(S.doc.pages.length - 1);
    return;
  }
  const pi = inf ? 0 : pageAt(wy);
  const top = S.layout.ys[pi];
  const isPen = e.pointerType === 'pen';
  const pressure = isPen ? e.pressure || 0.5 : 0.5;
  const base = { pid: e.pointerId, pt: e.pointerType };
  if (tool === 'pen' || tool === 'hl') {
    const kind = tool === 'hl' ? 'hl' : S.penType, T = S.tools[kind], spec = PEN[kind];
    const vp = !!spec && (!!spec.sim || (isPen && (kind === 'ball' || kind === 'pencil')));
    const st = { t: kind, c: T.c, s: T.s, vp, p: [wx, wy - top, spec && spec.sim && !isPen ? 0.6 : pressure] };
    S.act = { ...base, kind: 'ink', pi, st, last: [wx, wy - top], sim: !!spec && !!spec.sim, pr: 0.6, lt: e.timeStamp, lsx: sx, lsy: sy };
    armHold(S.act);
  } else if (tool === 'shape') {
    const T = S.tools.shape;
    S.act = { ...base, kind: 'shape', pi, a: [wx, wy - top], b: [wx, wy - top], st: { t: 'ball', c: T.c, s: T.s, sh: 1, vp: false, p: [wx, wy - top, 0.5] } };
  } else if (tool === 'eraser') {
    S.act = { ...base, kind: 'erase', wx, wy, removed: new Map() };
    eraseAt(wx, wy);
  } else if (tool === 'text') {
    S.act = { ...base, kind: 'text', wx, wy, sx, sy, moved: false };
  } else if (tool === 'lasso') {
    if (S.sel) {
      const b = S.sel.b;
      if (resizable() && Math.hypot(wx - (b[2] + 6), wy - (b[3] + 6)) < 20 / S.view.s) {
        const o = S.sel.items[0].o;
        S.act = { ...base, kind: 'resize', o, from: o.w };
        return;
      }
      if (wx > b[0] - 14 && wx < b[2] + 14 && wy > b[1] - 14 && wy < b[3] + 14) { S.act = { ...base, kind: 'selmove', ox: wx, oy: wy }; return; }
      clearSel();
    }
    S.act = { ...base, kind: 'lasso', poly: [[wx, wy]], wx, wy };
  }
  requestFrame();
}

function feed(e, sx, sy) {
  const a = S.act; if (!a) return;
  const [wx, wy] = toWorld(sx, sy);
  if (a.kind === 'ink') {
    const top = S.layout.ys[a.pi], lx = wx, ly = wy - top;
    if (a.snap) {                      // shape already perfected: a line keeps following the pen
      if (a.snap.done && a.snap.kind === 'line') {
        const f = a.snap.final; a.st.p = [f[0], f[1], 0.5, lx, ly, 0.5]; bbCache.delete(a.st);
      }
      return;
    }
    if (Math.hypot(lx - a.last[0], ly - a.last[1]) < 0.7 / S.view.s) return;
    let pr = e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5;
    if (a.sim && e.pointerType !== 'pen') {
      const dt = Math.max(1, e.timeStamp - a.lt), sp = Math.hypot(sx - a.lsx, sy - a.lsy) / dt;
      a.pr = a.pr * 0.72 + clamp(1.05 - sp * 0.5, 0.28, 1) * 0.28; pr = a.pr;
    }
    a.st.p.push(lx, ly, pr); a.last = [lx, ly]; a.lt = e.timeStamp; a.lsx = sx; a.lsy = sy;
    armHold(a);
  } else if (a.kind === 'shape') {
    const top = S.layout.ys[a.pi];
    a.b = [wx, wy - top];
    a.st.p = shapePoints(S.shape, a.a, a.b);
    bbCache.delete(a.st);
  } else if (a.kind === 'erase') {
    a.wx = wx; a.wy = wy; eraseAt(wx, wy);
  } else if (a.kind === 'text') {
    if (Math.hypot(sx - a.sx, sy - a.sy) > 12) a.moved = true;
  } else if (a.kind === 'lasso') {
    a.wx = wx; a.wy = wy;
    const l = a.poly[a.poly.length - 1];
    if (Math.hypot(wx - l[0], wy - l[1]) > 2 / S.view.s) a.poly.push([wx, wy]);
  } else if (a.kind === 'selmove') {
    S.sel.dx = wx - a.ox; S.sel.dy = wy - a.oy;
  } else if (a.kind === 'resize') {
    const o = a.o;
    o.w = Math.max(o.k === 'img' ? 40 : 110, wx - o.x);
    boundsOfSel();
  }
}
function boundsOfSel() {
  const sl = S.sel; if (!sl) return;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const it of sl.items) {
    const r = objRect(it.o), top = S.layout.ys[it.pi];
    x0 = Math.min(x0, r[0]); x1 = Math.max(x1, r[2]); y0 = Math.min(y0, r[1] + top); y1 = Math.max(y1, r[3] + top);
  }
  sl.b = [x0, y0, x1, y1]; baseDirty = true;
}

function shapePoints(kind, a, b) {
  const pts = [];
  const P = (x, y) => pts.push(x, y, 0.5);
  if (kind === 'line') { P(...a); P(...b); }
  else if (kind === 'arrow') {
    P(...a); P(...b);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = Math.min(40, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.4);
    P(b[0] - L * Math.cos(ang - 0.45), b[1] - L * Math.sin(ang - 0.45)); P(...b);
    P(b[0] - L * Math.cos(ang + 0.45), b[1] - L * Math.sin(ang + 0.45));
  } else if (kind === 'rect') { P(a[0], a[1]); P(b[0], a[1]); P(b[0], b[1]); P(a[0], b[1]); P(a[0], a[1]); }
  else if (kind === 'triangle') { P((a[0] + b[0]) / 2, a[1]); P(b[0], b[1]); P(a[0], b[1]); P((a[0] + b[0]) / 2, a[1]); }
  else if (kind === 'ellipse') {
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2;
    for (let i = 0; i <= 72; i++) { const t = i / 72 * Math.PI * 2; P(cx + rx * Math.cos(t), cy + ry * Math.sin(t)); }
  }
  return pts;
}

/* ---------- hold to perfect a shape (like Samsung Notes) ---------- */
function armHold(a) {
  clearTimeout(a.hold);
  if (S.holdShape && !a.snap) a.hold = setTimeout(() => trySnap(a), 520);
}
const dist2p = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function distToLine(p, a, b) {
  const l = dist2p(a, b) || 1;
  return Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / l;
}
function douglas(P, eps) {
  if (P.length < 3) return P.slice();
  let dmax = 0, idx = 0;
  for (let i = 1; i < P.length - 1; i++) { const d = distToLine(P[i], P[0], P[P.length - 1]); if (d > dmax) { dmax = d; idx = i; } }
  if (dmax > eps) { const l = douglas(P.slice(0, idx + 1), eps), r = douglas(P.slice(idx), eps); return l.slice(0, -1).concat(r); }
  return [P[0], P[P.length - 1]];
}
function cleanPoly(poly, minTurn = 0.49) { // radians (~28°); removes near-collinear vertices of a closed polygon
  const P = poly.slice();
  for (;;) {
    if (P.length <= 3) return P;
    let worst = -1, wv = 9;
    for (let i = 0; i < P.length; i++) {
      const a = P[(i + P.length - 1) % P.length], b = P[i], c = P[(i + 1) % P.length];
      const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let t = Math.abs(a2 - a1); if (t > Math.PI) t = 2 * Math.PI - t;
      if (t < wv) { wv = t; worst = i; }
    }
    if (wv < minTurn) P.splice(worst, 1); else return P;
  }
}
function recognize(P) {
  const n = P.length; if (n < 8) return null;
  let len = 0; for (let i = 1; i < n; i++) len += dist2p(P[i - 1], P[i]);
  if (len < 50) return null;
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
  const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const w = bb[2] - bb[0], hh = bb[3] - bb[1], diag = Math.hypot(w, hh);
  const a = P[0], b = P[n - 1], gap = dist2p(a, b);
  if (gap > 0.22 * len) {
    if (gap < 40) return null;
    let dev = 0; for (const p of P) dev = Math.max(dev, distToLine(p, a, b));
    return dev < 0.07 * gap ? { kind: 'line', a, b } : null;
  }
  if (diag < 40) return null;
  let simp = douglas(P, 0.075 * diag);
  if (simp.length > 2 && dist2p(simp[0], simp[simp.length - 1]) < 0.22 * len) simp = simp.slice(0, -1);
  const poly = cleanPoly(simp);
  if (poly.length === 3) return { kind: 'poly', pts: poly };
  if (poly.length === 4) {
    let axis = true;
    for (let i = 0; i < 4; i++) {
      const p = poly[i], q = poly[(i + 1) % 4];
      let ang = Math.abs(Math.atan2(q[1] - p[1], q[0] - p[0])) % (Math.PI / 2);
      ang = Math.min(ang, Math.PI / 2 - ang);
      if (ang > 0.25) axis = false;
    }
    return axis ? { kind: 'rect', bb } : { kind: 'poly', pts: poly };
  }
  let cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, rx = w / 2, ry = hh / 2;
  if (rx < 14 || ry < 14) return null;
  let s1 = 0, s2 = 0;
  for (const p of P) { const v = Math.sqrt(((p[0] - cx) / rx) ** 2 + ((p[1] - cy) / ry) ** 2); s1 += v; s2 += v * v; }
  const mean = s1 / n, sd = Math.sqrt(Math.max(0, s2 / n - mean * mean));
  if (Math.abs(mean - 1) < 0.16 && sd < 0.15) {
    if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.14) rx = ry = (rx + ry) / 2;
    return { kind: 'ellipse', cx, cy, rx, ry };
  }
  return null;
}
function outline(sh) {
  if (sh.kind === 'line') return [sh.a, sh.b];
  if (sh.kind === 'rect') { const [x0, y0, x1, y1] = sh.bb; return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]; }
  if (sh.kind === 'poly') return [...sh.pts, sh.pts[0]];
  const o = []; for (let i = 0; i <= 72; i++) { const t = i / 72 * Math.PI * 2; o.push([sh.cx + sh.rx * Math.cos(t), sh.cy + sh.ry * Math.sin(t)]); }
  return o;
}
function resample(P, N) {
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + dist2p(P[i - 1], P[i]));
  const L = cum[cum.length - 1] || 1, out = []; let j = 1;
  for (let k = 0; k < N; k++) {
    const d = L * k / (N - 1);
    while (j < P.length - 1 && cum[j] < d) j++;
    const seg = cum[j] - cum[j - 1] || 1, t = clamp((d - cum[j - 1]) / seg, 0, 1);
    out.push([P[j - 1][0] + (P[j][0] - P[j - 1][0]) * t, P[j - 1][1] + (P[j][1] - P[j - 1][1]) * t]);
  }
  return out;
}
function alignTo(from, to) { // rotate / reverse a closed outline so the morph is smooth
  const N = from.length - 1; let best = 1e18, bt = to;
  for (const dir of [1, -1]) {
    const seq = dir === 1 ? to.slice(0, N) : to.slice(0, N).reverse();
    for (let r = 0; r < N; r += 2) {
      let s = 0; for (let i = 0; i < N; i += 4) { const q = seq[(i + r) % N], f = from[i]; s += (q[0] - f[0]) ** 2 + (q[1] - f[1]) ** 2; }
      if (s < best) { best = s; bt = seq.map((_, i) => seq[(i + r) % N]); bt = bt.concat([bt[0]]); }
    }
  }
  return bt;
}
function trySnap(a) {
  if (S.act !== a || a.snap || a.kind !== 'ink') return;
  const p = a.st.p, P = []; for (let i = 0; i < p.length; i += 3) P.push([p[i], p[i + 1]]);
  const sh = recognize(P); if (!sh) return;
  const N = 72, from = resample(P, N);
  let to = resample(outline(sh), N);
  if (sh.kind !== 'line') to = alignTo(from, to);
  const fin = outline(sh);
  a.snap = { t0: now(), from, to, kind: sh.kind, final: sh.kind === 'line' ? [sh.a[0], sh.a[1], sh.b[0], sh.b[1]] : null, finalPts: fin, done: false };
  a.st.sh = 1; a.st.vp = false; buzz(18);
  requestFrame();
}
function stepSnap(a) {
  const sn = a.snap; if (!sn || sn.done) return;
  const k = ease((now() - sn.t0) / 230), out = [];
  for (let i = 0; i < sn.from.length; i++) out.push(sn.from[i][0] + (sn.to[i][0] - sn.from[i][0]) * k, sn.from[i][1] + (sn.to[i][1] - sn.from[i][1]) * k, 0.5);
  a.st.p = out;
  if (k >= 1) {
    sn.done = true;
    a.st.p = sn.finalPts.flatMap((q) => [q[0], q[1], 0.5]);
  }
  bbCache.delete(a.st);
}

/* ---------- eraser ---------- */
function eraseAt(wx, wy) {
  const r = S.tools.eraser.s / S.view.s;
  const inf = isInf(S.doc);
  S.doc.pages.forEach((pg, pi) => {
    const top = S.layout.ys[pi], lx = wx, ly = wy - top;
    if (!inf && (ly < -r - 30 || ly > pg.h + r + 30)) return;
    for (let k = pg.strokes.length - 1; k >= 0; k--) {
      const st = pg.strokes[k], b = bbox(st), rr = r + st.s / 2;
      if (lx < b[0] - rr || lx > b[2] + rr || ly < b[1] - rr || ly > b[3] + rr) continue;
      const p = st.p; let hitIt = false;
      if (p.length === 3) hitIt = (p[0] - lx) ** 2 + (p[1] - ly) ** 2 <= rr * rr;
      for (let i = 0; i + 5 < p.length && !hitIt; i += 3) hitIt = segDist2(lx, ly, p[i], p[i + 1], p[i + 3], p[i + 4]) <= rr * rr;
      if (hitIt) {
        pg.strokes.splice(k, 1);
        S.act.removed.set(st, { pg, o: st, i: k });
        ghost(st, pi);
        baseDirty = true;
      }
    }
  });
}

function cancelAct() {
  const a = S.act;
  if (a) clearTimeout(a.hold);
  if (a && a.kind === 'erase' && a.removed.size) finishAct();
  else if (a && a.kind === 'selmove') { S.sel.dx = S.sel.dy = 0; }
  else if (a && a.kind === 'resize') { a.o.w = a.from; boundsOfSel(); }
  S.act = null; requestFrame(true);
}
function finishAct() {
  const a = S.act; S.act = null;
  if (!a) return;
  clearTimeout(a.hold);
  if (a.kind === 'ink') {
    if (a.snap && !a.snap.done) { a.st.p = a.snap.finalPts.flatMap((q) => [q[0], q[1], 0.5]); a.snap.done = true; }
    if (a.st.p.length === 3) a.st.p.push(a.st.p[0], a.st.p[1], a.st.p[2]);
    bbCache.delete(a.st);
    actAddObjs(S.doc.pages[a.pi], [a.st]);
  } else if (a.kind === 'shape') {
    if (Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]) > 4) actAddObjs(S.doc.pages[a.pi], [a.st]);
  } else if (a.kind === 'erase') {
    const rec = [...a.removed.values()];
    if (rec.length) {
      commit({
        undo() { [...rec].sort((x, y) => x.i - y.i).forEach((r) => r.pg.strokes.splice(Math.min(r.i, r.pg.strokes.length), 0, r.o)); },
        redo() { rec.forEach((r) => { const i = r.pg.strokes.indexOf(r.o); if (i >= 0) r.pg.strokes.splice(i, 1); }); },
      });
    }
  } else if (a.kind === 'text') {
    if (!a.moved) {
      const h = hitItem(a.wx, a.wy);
      if (h && h.o.k === 'text') openTextEditor(h.o, h.pg, h.pi, false);
      else newTextAt(a.wx, a.wy);
    }
  } else if (a.kind === 'lasso') {
    const ext = a.poly.reduce((m, q) => Math.max(m, Math.hypot(q[0] - a.poly[0][0], q[1] - a.poly[0][1])), 0);
    if (a.poly.length > 3 && ext * S.view.s > 14) lassoSelect(a.poly);
    else {
      const hh = hitItem(a.poly[0][0], a.poly[0][1]) || strokeAt(a.poly[0][0], a.poly[0][1]);
      if (hh) makeSel([hh]); else clearSel();
    }
  } else if (a.kind === 'selmove') {
    const { dx, dy, items } = S.sel;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) {
      items.forEach((it) => moveObj(it.o, dx, dy));
      const b = S.sel.b; S.sel.b = [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy]; S.sel.dx = S.sel.dy = 0;
      commit({
        undo() { items.forEach((it) => moveObj(it.o, -dx, -dy)); },
        redo() { items.forEach((it) => moveObj(it.o, dx, dy)); },
      });
    } else { S.sel.dx = S.sel.dy = 0; }
  } else if (a.kind === 'resize') {
    const o = a.o, from = a.from, to = o.w;
    if (Math.abs(to - from) > 0.5) commit({ undo() { o.w = from; }, redo() { o.w = to; } });
    boundsOfSel();
  }
  requestFrame(true);
}

/* =====================================================================
   Persistence
   ===================================================================== */
let saveTimer = null;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 900); }
async function saveNow() {
  clearTimeout(saveTimer);
  const d = S.doc; if (!d) return;
  d.updated = Date.now();
  d.view = { ...S.view, w: vw };
  let old = null;
  try { old = await db.getMeta(d.id); } catch {}
  const meta = { id: d.id, title: d.title, type: d.type, updated: d.updated, pages: d.pages.length, thumb: S.thumb, parent: old ? old.parent ?? null : null };
  try { await db.saveDoc(d, meta); } catch (e) { console.error(e); toast('Could not save. Storage may be full.'); }
}
async function makeThumb() {
  try {
    const c = await renderPageCanvas(0, 360);
    return c.toDataURL('image/jpeg', 0.72);
  } catch (e) { console.warn(e); return null; }
}

/* =====================================================================
   Export / thumbnails
   ===================================================================== */
async function preloadImages(pg) {
  for (const it of pg.items || []) {
    if (it.k !== 'img') continue;
    let v = loadImg(it.ref), n = 0;
    while (v === 'loading' && n++ < 100) { await new Promise((r) => setTimeout(r, 30)); v = imgCache.get(it.ref); }
  }
}
async function renderPageCanvas(i, pxW) {
  const doc = S.doc, pg = doc.pages[i];
  await preloadImages(pg);
  if (isInf(doc)) {
    let b = [0, 0, 800, 600];
    const rects = [...pg.strokes.map(bbox), ...pg.items.map(itemRect)];
    if (rects.length) {
      b = [1e9, 1e9, -1e9, -1e9];
      for (const q of rects) b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])];
      b = [b[0] - 40, b[1] - 40, b[2] + 40, b[3] + 40];
    }
    const w = b[2] - b[0], hh = b[3] - b[1];
    const k = pxW / w;
    const c = document.createElement('canvas'); c.width = Math.round(pxW); c.height = Math.max(1, Math.round(hh * k));
    const g = c.getContext('2d'); g.scale(k, k); g.translate(-b[0], -b[1]);
    drawPage(g, pg, { vis: b, scale: k, flat: true });
    return c;
  }
  const k = pxW / PW;
  const c = document.createElement('canvas'); c.width = Math.round(pxW); c.height = Math.round(pg.h * k);
  const g = c.getContext('2d'); g.scale(k, k);
  let bmp = null;
  if (pg.pdf != null && S.pdf) bmp = await renderPdfBitmap(S.pdf, pg.pdf, Math.round(pxW));
  drawPage(g, pg, { pdfBitmap: bmp, scale: k, flat: true });
  return c;
}
async function exportPdf() {
  const doc = S.doc;
  toast('Building PDF…', 8000);
  try {
    const out = [];
    for (let i = 0; i < doc.pages.length; i++) {
      const c = await renderPageCanvas(i, isInf(doc) ? 1800 : 1240);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      out.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), wpx: c.width, hpx: c.height });
    }
    const pdf = buildPdf(out);
    const name = (doc.title || 'note').replace(/[^\w\- ]+/g, '').trim() || 'note';
    const file = new File([pdf], name + '.pdf', { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: doc.title }); $('#toast').hidden = true; return; } catch (e) { if (e && e.name === 'AbortError') { $('#toast').hidden = true; return; } }
    }
    const a = h('a', { href: URL.createObjectURL(pdf), download: name + '.pdf' });
    document.body.append(a); a.click(); a.remove();
    toast('PDF saved to your downloads');
  } catch (e) { console.error(e); toast('Export failed'); }
}

/* =====================================================================
   Library: folders, cards, create, import
   ===================================================================== */
const L = { filter: 'all', q: '', metas: [], folder: null };
const FILTERS = [['all', 'All'], ['notebook', 'Notebooks'], ['whiteboard', 'Whiteboards'], ['pdf', 'PDFs']];
const byId = (id) => L.metas.find((m) => m.id === id);
const childrenOf = (fid) => L.metas.filter((m) => (m.parent || null) === fid);
const isFolder = (m) => m.type === 'folder';

async function refreshLibrary() {
  L.metas = await db.listMeta();
  if (L.folder && !byId(L.folder)) L.folder = null;
  renderLibrary();
}
function folderPath(id) {
  const out = []; let m = byId(id), guard = 0;
  while (m && guard++ < 20) { out.unshift(m); m = m.parent ? byId(m.parent) : null; }
  return out;
}
function renderLibrary(animate = false) {
  const f = $('#filters'); f.innerHTML = '';
  FILTERS.forEach(([k, label]) => f.append(h('button', { class: 'chip' + (L.filter === k ? ' on' : ''), onclick: () => { L.filter = k; renderLibrary(true); } }, label)));

  // breadcrumbs
  const cr = $('#crumbs'); cr.innerHTML = '';
  const browsing = !L.q && L.filter === 'all';
  cr.hidden = !(browsing && L.folder);
  if (!cr.hidden) {
    cr.append(h('button', { class: 'crumb', onclick: () => goFolder(null) }, icon('home', 16), 'Home'));
    for (const m of folderPath(L.folder)) {
      cr.append(h('span', { class: 'sepc' }, '›'), h('button', { class: 'crumb' + (m.id === L.folder ? ' cur' : ''), onclick: () => goFolder(m.id) }, m.title));
    }
  }

  let list;
  if (L.q) list = L.metas.filter((m) => m.title.toLowerCase().includes(L.q) && (L.filter === 'all' || m.type === L.filter));
  else if (L.filter !== 'all') list = L.metas.filter((m) => m.type === L.filter);
  else list = childrenOf(L.folder);
  list = [...list].sort((a, b) => (isFolder(b) - isFolder(a)) || (isFolder(a) ? a.title.localeCompare(b.title) : b.updated - a.updated));

  const g = $('#grid'); g.innerHTML = '';
  g.classList.toggle('swap', animate);
  $('#empty').hidden = list.length > 0;
  $('#emptyTitle').textContent = L.q ? 'No matches' : L.folder ? 'This folder is empty' : 'Nothing here yet';
  list.forEach((m, i) => {
    const sty = `--i:${Math.min(i, 14)}`;
    if (isFolder(m)) {
      const kids = childrenOf(m.id), docs = kids.filter((k) => !isFolder(k)).slice(0, 4);
      g.append(h('div', { class: 'card', role: 'button', tabindex: 0, style: sty, onclick: () => goFolder(m.id) },
        h('div', { class: 'thumb folder', style: `--fc:${m.color || FOLDER_COLORS[0]}` },
          h('div', { class: 'ftab' }),
          h('div', { class: 'fgrid' }, [0, 1, 2, 3].map((k) => (docs[k] && docs[k].thumb ? h('img', { src: docs[k].thumb, alt: '', draggable: false }) : h('span', { class: docs[k] ? 'ph' : '' }))))),
        h('button', { class: 'more', 'aria-label': 'Folder options', onclick: (e) => { e.stopPropagation(); cardMenu(m); } }, icon('more', 20)),
        h('div', { class: 'card-title' }, m.title),
        h('div', { class: 'card-sub' }, kids.length === 1 ? '1 item' : `${kids.length} items`)));
      return;
    }
    const label = { notebook: 'NOTEBOOK', whiteboard: 'BOARD', pdf: 'PDF' }[m.type];
    const inFolder = (L.q || L.filter !== 'all') && m.parent && byId(m.parent);
    g.append(h('div', { class: 'card', role: 'button', tabindex: 0, style: sty, onclick: () => openDoc(m.id) },
      h('div', { class: 'thumb' + (m.type === 'whiteboard' ? ' board' : '') },
        m.thumb ? h('img', { src: m.thumb, alt: '', draggable: false }) : icon(m.type === 'whiteboard' ? 'board' : m.type === 'pdf' ? 'pdf' : 'book', 40)),
      h('span', { class: 'badge' }, label),
      h('button', { class: 'more', 'aria-label': 'Options', onclick: (e) => { e.stopPropagation(); cardMenu(m); } }, icon('more', 20)),
      h('div', { class: 'card-title' }, m.title),
      h('div', { class: 'card-sub' }, (inFolder ? byId(m.parent).title + ' · ' : '') + `${m.type === 'whiteboard' ? 'Infinite canvas' : m.pages + (m.pages === 1 ? ' page' : ' pages')} · ${fmtDate(m.updated)}`)));
  });
}
function goFolder(id, push = true) {
  if (L.folder === id) return;
  L.folder = id; L.q = ''; $('#search').value = '';
  if (push && id) history.pushState({ folder: id }, '');
  renderLibrary(true);
}
function fmtDate(t) {
  const d = new Date(t), n = new Date();
  if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === n.getFullYear() ? undefined : 'numeric' });
}
function mi(ic, label, fn, danger) {
  return h('button', { class: 'mi' + (danger ? ' danger' : ''), onclick: fn }, h('span', { class: 'ico' }, icon(ic, 22)), label);
}
function descendants(id) {
  const out = new Set([id]); let grew = true;
  while (grew) { grew = false; for (const m of L.metas) if (m.parent && out.has(m.parent) && !out.has(m.id)) { out.add(m.id); grew = true; } }
  return out;
}
async function setParent(m, parent) {
  m.parent = parent || null;
  const fresh = (await db.getMeta(m.id)) || m;
  fresh.parent = m.parent;
  await db.saveMeta(fresh);
}
function moveDialog(m) {
  const banned = isFolder(m) ? descendants(m.id) : new Set();
  const folders = [];
  const walk = (pid, depth) => {
    for (const f of L.metas.filter((x) => isFolder(x) && (x.parent || null) === pid && !banned.has(x.id)).sort((a, b) => a.title.localeCompare(b.title))) {
      folders.push({ f, depth }); walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  const cur = m.parent || null;
  const row = (id, label, depth, ic) => h('button', { class: 'mi' + (cur === id ? ' on' : ''), style: `padding-left:${12 + depth * 22}px`, onclick: async () => {
    close(); await setParent(m, id); await refreshLibrary(); toast(`Moved to ${id ? byId(id).title : 'Home'}`);
  } }, h('span', { class: 'ico' }, icon(ic, 22)), label, cur === id ? h('span', { class: 'val' }, 'Here') : null);
  const close = modal({ title: `Move “${m.title}”`, body: h('div', { class: 'movelist' }, row(null, 'Home', 0, 'home'), folders.map(({ f, depth }) => row(f.id, f.title, depth + 1, 'folder'))), actions: [{ label: 'Cancel' }] });
}
function cardMenu(m) {
  const close = modal({ title: m.title, body: [
    mi('edit', 'Rename', async () => {
      close(); const t = await ask('Rename', m.title);
      if (!t) return;
      const fresh = await db.getMeta(m.id); fresh.title = t;
      if (!isFolder(m)) { const d = await db.getDoc(m.id); d.title = t; await db.saveDoc(d, fresh); } else await db.saveMeta(fresh);
      const T = S.tabs.find((x) => x.id === m.id); if (T) { T.title = t; if (T.doc) T.doc.title = t; renderTabs(); }
      refreshLibrary();
    }),
    mi('move', 'Move to…', () => { close(); moveDialog(m); }),
    !isFolder(m) && mi('copy', 'Duplicate', async () => { close(); await duplicateDoc(m); refreshLibrary(); }),
    mi('trash', 'Delete', async () => {
      close();
      if (isFolder(m)) {
        const n = childrenOf(m.id).length;
        if (await confirmDlg(`Delete folder “${m.title}”?`, n ? `Its ${n} item${n > 1 ? 's' : ''} will move up one level.` : 'This folder is empty.')) {
          for (const k of childrenOf(m.id)) await setParent(k, m.parent || null);
          await db.removeMeta(m.id); refreshLibrary();
        }
      } else if (await confirmDlg('Delete “' + m.title + '”?', 'This can’t be undone.')) {
        const ti = S.tabs.findIndex((x) => x.id === m.id); if (ti >= 0) { S.tabs.splice(ti, 1); renderTabs(); persistTabs(); }
        await removeDocFully(m.id); refreshLibrary();
      }
    }, true),
  ], actions: [{ label: 'Close' }] });
}
async function removeDocFully(id) {
  const d = await db.getDoc(id);
  const assets = [];
  if (d) for (const pg of d.pages) for (const it of pg.items || []) if (it.k === 'img') assets.push(it.ref);
  await db.removeDoc(id, assets);
}
async function duplicateDoc(m) {
  const d = await db.getDoc(m.id), nid = uid(), pdf = await db.getPdf(m.id);
  const copy = structuredClone(d); copy.id = nid; copy.title = d.title + ' copy'; copy.updated = Date.now();
  for (const pg of copy.pages) for (const it of pg.items || []) if (it.k === 'img') {
    const blob = await db.getAsset(it.ref); const ref = 'img:' + uid();
    if (blob) await db.putAsset(ref, blob); it.ref = ref;
  }
  if (pdf) await db.putPdf(nid, pdf.slice(0));
  await db.saveDoc(copy, { ...m, id: nid, title: copy.title, updated: copy.updated });
}

/* ---- create ---- */
function toggleFab(force) {
  const m = $('#fabmenu'), open = force ?? m.hidden;
  m.hidden = !open; $('#fab').classList.toggle('open', open);
  if (open) {
    m.innerHTML = '';
    [['book', 'New notebook', () => newDialog('notebook')], ['board', 'New whiteboard', () => newDialog('whiteboard')], ['pdf', 'Import PDF', () => $('#file').click()], ['folderPlus', 'New folder', () => folderDialog()]]
      .forEach(([ic, t, fn], i) => m.append(h('button', { class: 'fabitem', style: `animation-delay:${(3 - i) * 40}ms`, onclick: () => { toggleFab(false); fn(); } }, h('span', { class: 'ico' }, icon(ic, 20)), t)));
  }
}
function folderDialog() {
  let color = FOLDER_COLORS[0];
  const name = h('input', { class: 'field', value: 'New folder', maxlength: 60 });
  const row = h('div', { class: 'swatches' });
  const paint = () => { row.innerHTML = ''; FOLDER_COLORS.forEach((c) => row.append(h('button', { class: 'sw' + (c === color ? ' on' : ''), style: `background:${c}`, 'aria-label': c, onclick: () => { color = c; paint(); } }))); };
  paint();
  modal({ title: 'New folder', body: [h('div', { class: 'lbl' }, 'Name'), name, h('div', { class: 'lbl' }, 'Colour'), row], actions: [
    { label: 'Cancel' },
    { label: 'Create', kind: 'primary', fn: async () => {
      const f = { id: uid(), type: 'folder', title: name.value.trim() || 'Folder', updated: Date.now(), parent: L.folder, color };
      await db.saveMeta(f); await refreshLibrary();
    } }] });
  setTimeout(() => { name.focus(); name.select(); }, 60);
}
function paperPreview(style, color) {
  const dark = color === 'dark', bg = PAPER[color];
  const ln = dark ? 'rgba(255,255,255,.3)' : 'rgba(40,70,160,.4)';
  let bgi = '';
  if (style === 'ruled') bgi = `repeating-linear-gradient(to bottom,transparent 0 9px,${ln} 9px 10px)`;
  if (style === 'grid') bgi = `linear-gradient(${ln} 1px,transparent 1px),linear-gradient(90deg,${ln} 1px,transparent 1px)`;
  if (style === 'dots') bgi = `radial-gradient(${ln} 1.4px,transparent 1.6px)`;
  const sz = style === 'grid' || style === 'dots' ? 'background-size:10px 10px' : '';
  return h('div', { class: 'pv', style: `background-color:${bg};background-image:${bgi};${sz}` });
}
function paperPicker(initial, styles, withName) {
  const st = { style: initial.style, color: initial.color };
  const sRow = h('div', { class: 'opts' }), cRow = h('div', { class: 'opts three' });
  const colors = [['white', 'White'], ['cream', 'Cream'], ['dark', 'Dark']];
  const paint = () => {
    sRow.innerHTML = ''; cRow.innerHTML = '';
    styles.forEach(([k, l]) => sRow.append(h('button', { class: 'opt' + (st.style === k ? ' on' : ''), onclick: () => { st.style = k; paint(); } }, paperPreview(k, st.color), l)));
    colors.forEach(([k, l]) => cRow.append(h('button', { class: 'opt' + (st.color === k ? ' on' : ''), onclick: () => { st.color = k; paint(); } }, h('div', { class: 'pv', style: `background:${PAPER[k]}` }), l)));
  };
  paint();
  return { st, nodes: [h('div', { class: 'lbl' }, 'Paper'), sRow, h('div', { class: 'lbl' }, 'Colour'), cRow] };
}
function newDialog(type) {
  const styles = type === 'whiteboard' ? [['dots', 'Dots'], ['grid', 'Grid'], ['blank', 'Blank']] : [['ruled', 'Ruled'], ['grid', 'Grid'], ['dots', 'Dots'], ['blank', 'Blank']];
  const title = h('input', { class: 'field', value: type === 'notebook' ? 'Untitled notebook' : 'Whiteboard', maxlength: 80 });
  const pk = paperPicker({ style: type === 'whiteboard' ? 'dots' : 'ruled', color: 'white' }, styles);
  modal({ title: type === 'notebook' ? 'New notebook' : 'New whiteboard', body: [h('div', { class: 'lbl' }, 'Name'), title, ...pk.nodes], actions: [
    { label: 'Cancel' },
    { label: 'Create', kind: 'primary', fn: async () => {
      const doc = makeDoc({ type, title: title.value.trim() || 'Untitled', paper: { style: pk.st.style, color: pk.st.color } });
      await db.saveDoc(doc, { id: doc.id, title: doc.title, type, updated: doc.updated, pages: 1, thumb: null, parent: L.folder });
      await refreshLibrary(); openDoc(doc.id);
    } }] });
}
async function importPdf(file) {
  toast('Importing PDF…', 10000);
  try {
    const buf = await file.arrayBuffer();
    const task = pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) });
    const pdf = await task.promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i); const v = pg.getViewport({ scale: 1 });
      pages.push(newPage(Math.round(PW * v.height / v.width), { pdf: i - 1 }));
    }
    const doc = makeDoc({ type: 'pdf', title: file.name.replace(/\.pdf$/i, '') || 'PDF', paper: { style: 'blank', color: 'white' } });
    doc.pages = pages;
    await db.putPdf(doc.id, buf);
    await db.saveDoc(doc, { id: doc.id, title: doc.title, type: 'pdf', updated: doc.updated, pages: pages.length, thumb: null, parent: L.folder });
    task.destroy();
    $('#toast').hidden = true;
    await refreshLibrary(); openDoc(doc.id);
  } catch (e) { console.error(e); toast('That PDF couldn’t be opened'); }
}

/* =====================================================================
   Tabs: several notes open at once
   ===================================================================== */
function renderTabs() {
  const el = $('#tabs'); el.innerHTML = '';
  document.body.classList.toggle('at-home', !S.tab);
  el.append(h('button', { class: 'tab home' + (S.tab ? '' : ' on'), 'aria-label': 'Home', onclick: () => switchTo(null) }, icon('home', 20), h('span', { class: 'tlabel' }, 'Home')));
  for (const t of S.tabs) {
    const on = S.tab === t;
    el.append(h('div', { class: 'tab' + (on ? ' on' : '') + (t.isNew ? ' fresh' : ''), role: 'button', tabindex: 0, 'data-id': t.id, onclick: () => switchTo(t.id) },
      icon(t.type === 'whiteboard' ? 'board' : t.type === 'pdf' ? 'pdf' : 'book', 17),
      h('span', { class: 'tlabel' }, t.title),
      h('button', { class: 'tx', 'aria-label': 'Close ' + t.title, onclick: (e) => { e.stopPropagation(); closeTab(t.id); } }, icon('x', 14, 2.4))));
    t.isNew = false;
  }
  el.append(h('button', { class: 'tab add', 'aria-label': 'Open another note', onclick: () => switchTo(null) }, icon('plus', 18, 2.2)));
  const act = el.querySelector('.tab.on'); if (act && act.scrollIntoView) act.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}
function persistTabs() { prefs.set('tabs', S.tabs.map((t) => t.id)); prefs.set('activeTab', S.tab ? S.tab.id : null); }

async function loadTab(T) {
  if (T.loaded) return;
  const doc = await db.getDoc(T.id);
  if (!doc) throw new Error('missing');
  T.doc = doc; T.title = doc.title;
  const meta = await db.getMeta(T.id); T.thumb = meta ? meta.thumb : null;
  T.pdf = null;
  if (doc.pages.some((p) => p.pdf != null)) {
    const buf = await db.getPdf(T.id);
    if (buf) { try { T.pdf = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise; } catch { toast('The original PDF could not be loaded'); } }
  }
  T.hist = { u: [], r: [] }; T.curPage = 0; T.pdfCache = new Map(); T.pdfPending = new Map(); T.loaded = true;
}
async function leaveTab() {
  const T = S.tab; if (!T) return;
  commitEditor(); closePop(); closeMenu(); $('#sheet').hidden = true; clearSel();
  T.view = { ...S.view }; T.vw = vw; T.hist = S.hist; T.curPage = S.curPage;
  S.thumb = (await makeThumb()) || S.thumb; T.thumb = S.thumb;
  await saveNow();
  S.tab = null; S.doc = null; S.pdf = null; S.act = null; S.mode = null; ptr.clear();
}
async function showEditor(T) {
  S.tab = T; S.doc = T.doc; S.pdf = T.pdf; S.hist = T.hist; S.thumb = T.thumb; S.curPage = T.curPage || 0;
  pdfCache = T.pdfCache; pdfPending = T.pdfPending; pdfQueue.length = 0;
  S.sel = null; S.act = null; S.mode = null; S.ghosts = []; S.viewAnim = null;
  $('#library').hidden = true;
  const ed = $('#editor'); ed.hidden = false; ed.classList.remove('enter'); void ed.offsetWidth; ed.classList.add('enter');
  $('#docTitle').textContent = T.doc.title;
  relayout(); adaptInk(); buildDock(); updateUR(); closePop(); closeMenu();
  S.restored = !!(T.view || (T.doc.view && T.doc.view.w));
  vw = 0; resize();
  if (!vw) await new Promise((r) => requestAnimationFrame(() => { resize(); r(); }));
  if (T.view && T.vw) {
    const k = vw / T.vw; S.view = isInf(T.doc) ? { ...T.view } : { s: T.view.s * k, x: T.view.x * k, y: T.view.y * k };
  } else if (T.doc.view && T.doc.view.w) {
    const d = T.doc.view, k = vw / d.w; S.view = isInf(T.doc) ? { s: d.s, x: d.x, y: d.y } : { s: d.s * k, x: d.x * k, y: d.y * k };
  } else fitView();
  clampView();
  if (!history.state || !history.state.editor) history.pushState({ editor: T.id }, '');
  requestFrame(true);
}
function showHome() {
  $('#editor').hidden = true; $('#library').hidden = false;
  const lib = $('#library'); lib.classList.remove('enter'); void lib.offsetWidth; lib.classList.add('enter');
  document.body.classList.remove('focus');
  refreshLibrary();
}
let switching = false;
async function switchTo(id) {
  if (switching) return;
  if (id != null && S.tab && S.tab.id === id) return;
  if (id == null && !S.tab) return;
  switching = true;
  try {
    if (S.tab) await leaveTab();
    if (id == null) showHome();
    else {
      const T = S.tabs.find((t) => t.id === id);
      try { await loadTab(T); } catch { toast('Could not open that note'); S.tabs.splice(S.tabs.indexOf(T), 1); showHome(); return; }
      await showEditor(T);
    }
  } finally { switching = false; renderTabs(); persistTabs(); }
}
async function openDoc(id) {
  let T = S.tabs.find((t) => t.id === id);
  if (!T) {
    const m = byId(id) || (await db.getMeta(id));
    if (!m) return toast('Could not open that note');
    T = { id, title: m.title, type: m.type, loaded: false, isNew: true };
    S.tabs.push(T);
  }
  await switchTo(id);
}
async function closeTab(id) {
  const T = S.tabs.find((t) => t.id === id); if (!T || switching) return;
  const idx = S.tabs.indexOf(T);
  if (S.tab === T) {
    switching = true;
    try {
      const next = S.tabs[idx + 1] || S.tabs[idx - 1] || null;
      await leaveTab(); S.tabs.splice(idx, 1);
      if (next) { try { await loadTab(next); await showEditor(next); } catch { showHome(); } } else showHome();
    } finally { switching = false; }
  } else S.tabs.splice(idx, 1);
  renderTabs(); persistTabs();
}

/* =====================================================================
   Editor UI: dock, popovers, menu, settings
   ===================================================================== */
const TOOLS = [['pen', 'Pen'], ['hl', 'Highlighter'], ['eraser', 'Eraser'], ['lasso', 'Select'], ['shape', 'Shapes'], ['text', 'Text'], ['insert', 'Insert'], ['hand', 'Move']];
const toolLabel = (k) => (TOOLS.find((t) => t[0] === k) || [k, k])[1];
const popTools = ['pen', 'hl', 'eraser', 'shape', 'text', 'insert'];

function buildDock() {
  const d = $('#dock'); d.innerHTML = '';
  for (const [k, label] of TOOLS) {
    d.append(h('button', { class: 'tool' + (S.tool === k ? ' on' : ''), 'data-tool': k, 'aria-label': label, title: label, onclick: () => {
      if (k === 'insert') { togglePop('insert'); return; }
      if (S.tool === k && popTools.includes(k)) togglePop(); else { setTool(k); closePop(); }
    } }, icon(k === 'pen' ? S.penType : k, 24)));
  }
  d.append(h('span', { class: 'sep' }));
  d.append(h('button', { class: 'swatch-btn', id: 'swBtn', 'aria-label': 'Colour and size', onclick: () => { if (S.tool === 'lasso' || S.tool === 'hand') setTool('pen'); togglePop(); } }));
  syncDock();
}
function curTool() {
  if (S.tool === 'pen') return S.tools[S.penType];
  return S.tools[S.tool] || null;
}
function setTool(k) {
  if (S.tool !== k && k !== 'eraser') S.prevTool = null;
  commitEditor();
  S.tool = k; if (S.sel && k !== 'lasso') clearSel();
  syncDock(); requestFrame();
}
function syncDock() {
  document.querySelectorAll('.tool').forEach((b) => {
    b.classList.toggle('on', b.dataset.tool === S.tool);
    if (b.dataset.tool === 'pen') { const sp = b.querySelector('.svg'); if (sp) sp.replaceWith(icon(S.penType, 24)); }
  });
  const t = curTool(), sw = $('#swBtn');
  if (!sw) return;
  sw.style.background = t && t.c ? t.c : 'var(--panel2)';
  sw.style.visibility = ['hand', 'lasso', 'insert'].includes(S.tool) ? 'hidden' : 'visible';
  cv.style.cursor = S.tool === 'hand' ? 'grab' : S.tool === 'text' ? 'text' : 'crosshair';
}
function savePrefs() { prefs.set('tools2', S.tools); }
function adaptInk() {
  const dark = S.doc && S.doc.paper.color === 'dark';
  for (const k of ['ball', 'brush', 'shape', 'text']) {
    const t = S.tools[k];
    if (dark && t.c === '#1b1b1f') t.c = '#f4f4f6';
    if (!dark && t.c === '#f4f4f6') t.c = '#1b1b1f';
  }
  syncDock();
}

let popOpen = false;
function closePop() { $('#pop').hidden = true; popOpen = false; }
function togglePop(kind) { if (popOpen && (!kind || $('#pop').dataset.kind === kind)) closePop(); else openPop(kind); }
function drawPreview(cvs, kind, T) {
  const g = cvs.getContext('2d'), W = 300, H = 62;
  g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, W, H);
  const dark = S.doc && S.doc.paper.color === 'dark';
  g.fillStyle = dark ? PAPER.dark : '#fff'; g.fillRect(0, 0, W, H);
  if (kind === 'text') {
    g.fillStyle = T.c; g.font = `${Math.min(T.s, 52)}px ${FONT}`; g.textBaseline = 'middle'; g.fillText('Aa Notes', 16, H / 2 + 2); return;
  }
  const p = [];
  for (let i = 0; i < 44; i++) {
    const t = i / 43, x = 22 + t * (W - 44), y = H / 2 + Math.sin(t * Math.PI * 2) * 13;
    p.push(x, y, 0.2 + 0.8 * Math.sin(Math.PI * t));
  }
  const spec = PEN[kind];
  const st = { t: kind === 'shape' ? 'ball' : kind, c: T.c, s: T.s, vp: !!spec && kind !== 'marker', p };
  if (kind === 'shape') st.vp = false;
  drawStroke(g, st, dark);
}
function openPop(kind) {
  const pop = $('#pop'); pop.innerHTML = ''; popOpen = true; pop.hidden = false;
  const k = kind || S.tool;
  pop.dataset.kind = k;
  if (k === 'insert') {
    pop.append(h('div', { class: 'insgrid' },
      insBtn('image', 'Image', () => { closePop(); $('#imgfile').click(); }),
      insBtn('camera', 'Photo', () => { closePop(); $('#camfile').click(); }),
      insBtn('text', 'Text box', () => { closePop(); setTool('text'); toast('Tap the page to add text'); }),
      insBtn('link', 'Link', () => { closePop(); linkDialog(); }),
      insBtn('plus', 'Page', () => { closePop(); if (isInf(S.doc)) return toast('Whiteboards are one endless page'); const i = S.curPage || 0; addPageAt(i + 1, blankPageLike(i)); scrollToPage(i + 1); })));
    return;
  }
  const T = k === 'pen' ? S.tools[S.penType] : S.tools[k];
  if (!T) return;
  const prevKind = k === 'pen' ? S.penType : k;
  const prev = h('canvas', { class: 'prevcv', width: 600, height: 124 });
  const redraw = () => drawPreview(prev, prevKind, T);
  if (k === 'pen') {
    pop.append(h('div', { class: 'ptypes' }, PEN_ORDER.map((t) => h('button', { class: 'ptype' + (S.penType === t ? ' on' : ''), onclick: () => { S.penType = t; prefs.set('penType', t); setTool('pen'); syncDock(); openPop('pen'); } }, icon(t, 22), h('span', {}, PEN[t].label)))));
  }
  if (k === 'shape') {
    pop.append(h('div', { class: 'segs' }, SHAPES.map((n) => h('button', { class: 'seg' + (S.shape === n ? ' on' : ''), 'aria-label': n, onclick: () => { S.shape = n; prefs.set('shape', n); openPop('shape'); } }, icon(n, 22)))));
  }
  if (k === 'eraser') {
    pop.append(h('p', { class: 'note' }, 'Removes whole strokes you touch. Hold the S Pen button to erase while writing.'));
  } else {
    pop.append(prev);
    const pal = k === 'hl' ? HL_PALETTE : PALETTE;
    const row = h('div', { class: 'swatches' });
    const setC = (c, remember) => { T.c = c; savePrefs(); syncDock(); redraw(); if (remember) rememberColor(c); };
    const paint = () => row.querySelectorAll('.sw[data-c]').forEach((b) => b.classList.toggle('on', b.dataset.c.toLowerCase() === T.c.toLowerCase()));
    pal.forEach((c) => row.append(h('button', { class: 'sw', 'data-c': c, style: `background:${c}`, 'aria-label': c, onclick: () => { setC(c); paint(); } })));
    const ci = h('input', { type: 'color', value: T.c.length === 7 ? T.c : '#000000', oninput: (e) => { setC(e.target.value); paint(); }, onchange: (e) => { rememberColor(e.target.value); } });
    row.append(h('div', { class: 'sw custom' }, ci));
    pop.append(row);
    const rec = prefs.get('recent', []);
    if (rec.length) pop.append(h('div', { class: 'swatches small' }, h('span', { class: 'rl' }, 'Recent'), rec.map((c) => h('button', { class: 'sw', style: `background:${c}`, 'aria-label': c, onclick: () => { setC(c); paint(); } }))));
    paint();
  }
  const [mn, mx, st] = k === 'hl' ? [6, 44, 1] : k === 'eraser' ? [6, 44, 1] : k === 'text' ? [12, 80, 1] : k === 'shape' ? [1, 14, 0.5] : PEN[S.penType].range;
  pop.append(h('div', { class: 'sizerow' }, h('span', { class: 'rl' }, k === 'text' ? 'Font' : 'Size'),
    h('input', { type: 'range', min: mn, max: mx, step: st, value: T.s, 'aria-label': 'Size', oninput: (e) => { T.s = +e.target.value; savePrefs(); if (k !== 'eraser') redraw(); else eraserPrev.style.cssText = `width:${T.s * 2}px;height:${T.s * 2}px`; } }),
    h('span', { class: 'sizeval' }, '')));
  let eraserPrev = null;
  if (k === 'eraser') {
    eraserPrev = h('i', { class: 'eprev', style: `width:${T.s * 2}px;height:${T.s * 2}px` });
    pop.append(h('div', { class: 'sizeprev' }, eraserPrev),
      h('button', { class: 'btn small danger wide', onclick: () => {
        const pg = S.doc.pages[isInf(S.doc) ? 0 : S.curPage || 0];
        const list = [...pg.strokes, ...pg.items].map((o) => ({ pg, o }));
        if (!list.length) return toast('This page is already clear');
        closePop(); actRemoveObjs(list); toast('Page cleared. Undo brings it back.');
      } }, icon('trash', 16), 'Clear page'));
  } else redraw();
}
const insBtn = (ic, label, fn) => h('button', { class: 'ins', onclick: fn }, h('span', { class: 'ico' }, icon(ic, 26)), label);
function rememberColor(c) {
  if (PALETTE.includes(c) || HL_PALETTE.includes(c)) return;
  const r = [c, ...prefs.get('recent', []).filter((x) => x !== c)].slice(0, 8); prefs.set('recent', r);
}

/* ---- insert: image, link ---- */
function viewCentre() {
  const [wx, wy] = toWorld(vw / 2, vh / 2);
  const pi = isInf(S.doc) ? 0 : pageAt(wy), top = S.layout.ys[pi];
  return { pi, pg: S.doc.pages[pi], x: wx, y: isInf(S.doc) ? wy : clamp(wy - top, 40, S.doc.pages[pi].h - 40) };
}
function afterInsert(pg, pi, it) {
  actAddObjs(pg, [it]);
  setTool('lasso'); makeSel([{ o: it, pg, pi }]);
}
async function insertImage(file) {
  if (!file || !S.doc) return;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    let blob = null;
    if (/png|webp|gif/.test(file.type)) blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    if (!blob || blob.size > 1.6e6) blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
    const ref = 'img:' + uid();
    await db.putAsset(ref, blob);
    imgCache.set(ref, await createImageBitmap(c));
    const cc = viewCentre(), w = Math.min(isInf(S.doc) ? 360 : PW * 0.6, c.width), ar = c.width / c.height;
    const it = { id: uid(), k: 'img', ref, ar, w, x: cc.x - w / 2, y: cc.y - w / ar / 2 };
    if (!isInf(S.doc)) it.x = clamp(it.x, 10, PW - w - 10);
    afterInsert(cc.pg, cc.pi, it);
    toast('Drag to move, pull the corner to resize', 2600);
  } catch (e) { console.error(e); toast('That image could not be added'); }
}
function normalizeUrl(u) {
  u = u.trim(); if (!u) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u) ? 'mailto:' + u : 'https://' + u;
  return /^(https?:|mailto:|tel:)/i.test(u) ? u : null;
}
function linkDialog(existing) {
  const url = h('input', { class: 'field', value: existing ? existing.url : '', placeholder: 'https://example.com', inputmode: 'url', autocapitalize: 'off', autocorrect: 'off' });
  const label = h('input', { class: 'field', value: existing ? existing.text || '' : '', placeholder: 'Label (optional)', maxlength: 80 });
  modal({ title: 'Add a link', body: [h('div', { class: 'lbl' }, 'Address'), url, h('div', { class: 'lbl' }, 'Label'), label], actions: [
    { label: 'Cancel' },
    { label: 'Add', kind: 'primary', fn: () => {
      const u = normalizeUrl(url.value);
      if (!u) { toast('Enter a web address like example.com'); return false; }
      const cc = viewCentre();
      const it = { id: uid(), k: 'link', url: u, text: label.value.trim(), s: 24, w: 240, x: cc.x - 120, y: cc.y - 22 };
      if (!isInf(S.doc)) it.x = clamp(it.x, 10, PW - 260);
      afterInsert(cc.pg, cc.pi, it);
      toast('Tap the link with the Move tool or Select › Open', 2600);
    } }] });
  setTimeout(() => url.focus(), 60);
}

/* ---- more menu ---- */
let menuOpen = false;
function closeMenu() { $('#menu').hidden = true; menuOpen = false; }
function syncMenu() { if (menuOpen) openMenu(); }
function openMenu() {
  const m = $('#menu'); m.innerHTML = ''; m.hidden = false; menuOpen = true;
  const d = S.doc, paged = !isInf(d);
  const item = (ic, label, fn, opts = {}) => m.append(h('button', { class: 'mi' + (opts.danger ? ' danger' : ''), onclick: () => { if (!opts.keep) closeMenu(); fn(); } },
    h('span', { class: 'ico' }, icon(ic, 22)), label, opts.val ? h('span', { class: 'val' }, opts.val) : null));
  item('palm', 'Stylus only', () => { S.stylusOnly = !S.stylusOnly; S.stylusUserSet = true; prefs.set('stylusOnly', S.stylusOnly); prefs.set('stylusUserSet', true); openMenu(); toast(S.stylusOnly ? 'Fingers pan and zoom, stylus draws' : 'Fingers can draw too'); }, { keep: true, val: S.stylusOnly ? 'On' : 'Off' });
  item('settings', 'Gestures and pen', settingsDialog);
  item('edit', 'Rename', renameDoc);
  if (d.type !== 'pdf') item('paper', d.type === 'whiteboard' ? 'Background' : 'Paper style', paperDialog);
  if (paged) item('plus', 'Add page after this', () => { const i = S.curPage || 0; addPageAt(i + 1, blankPageLike(i)); scrollToPage(i + 1); });
  item('fit', 'Fit to screen', () => { const t = {}; const keep = { ...S.view }; fitView(); Object.assign(t, S.view); S.view = keep; animateView(t, 280); });
  item('focus', 'Focus mode', () => { document.body.classList.add('focus'); setTimeout(resize, 30); toast('Tap the corner button to leave focus mode', 2200); });
  m.append(h('div', { class: 'mdiv' }));
  item('down', 'Export as PDF', exportPdf);
  if (paged && d.pages.length > 1) { m.append(h('div', { class: 'mdiv' })); item('trash', 'Delete this page', async () => { const i = S.curPage || 0; if (await confirmDlg('Delete page ' + (i + 1) + '?', 'You can undo this right after.')) removePageAt(i); }, { danger: true }); }
}
async function renameDoc() {
  const t = await ask('Rename', S.doc.title);
  if (t) { S.doc.title = t; S.tab.title = t; $('#docTitle').textContent = t; renderTabs(); changed(); }
}
function paperDialog() {
  const d = S.doc;
  const styles = d.type === 'whiteboard' ? [['dots', 'Dots'], ['grid', 'Grid'], ['blank', 'Blank']] : [['ruled', 'Ruled'], ['grid', 'Grid'], ['dots', 'Dots'], ['blank', 'Blank']];
  const pk = paperPicker(d.paper, styles);
  modal({ title: 'Paper', body: pk.nodes, actions: [{ label: 'Cancel' }, { label: 'Apply', kind: 'primary', fn: () => {
    d.paper = { style: pk.st.style, color: pk.st.color }; adaptInk(); changed();
  } }] });
}

/* ---- settings: gestures & S Pen ---- */
function settingsDialog() {
  const body = h('div', { class: 'settings' });
  const save = () => prefs.set('gest', S.gest);
  const row = (label, hint, opts, get, set) => h('div', { class: 'srow' },
    h('div', { class: 'slabel' }, label, hint ? h('small', {}, hint) : null),
    h('div', { class: 'segs mini' }, opts.map(([v, l]) => h('button', { class: 'seg' + (get() === v ? ' on' : ''), onclick: () => { set(v); save(); paint(); } }, l))));
  const paint = () => {
    body.innerHTML = '';
    body.append(
      h('div', { class: 'lbl' }, 'Finger gestures'),
      row('Two-finger tap', 'Tap the page with two fingers', [['undo', 'Undo'], ['redo', 'Redo'], ['none', 'Off']], () => S.gest.two, (v) => (S.gest.two = v)),
      row('Three-finger tap', 'Tap the page with three fingers', [['redo', 'Redo'], ['undo', 'Undo'], ['none', 'Off']], () => S.gest.three, (v) => (S.gest.three = v)),
      row('Finger input', 'Palm rejection', [[false, 'Draw'], [true, 'Pan only']], () => S.stylusOnly, (v) => { S.stylusOnly = v; S.stylusUserSet = true; prefs.set('stylusOnly', v); prefs.set('stylusUserSet', true); }),
      h('div', { class: 'lbl', style: 'margin-top:14px' }, 'S Pen'),
      row('Hold the pen button while writing', 'Works like the eraser end', [['eraser', 'Eraser'], ['lasso', 'Select'], ['none', 'Off']], () => S.gest.hold, (v) => (S.gest.hold = v)),
      row('Click the pen button (hovering)', 'Quick action without touching the screen', [['toggle', 'Eraser on/off'], ['undo', 'Undo'], ['none', 'Off']], () => S.gest.click, (v) => (S.gest.click = v)),
      row('Hold still to perfect a shape', 'Draw a line, circle, box or triangle and pause', [[true, 'On'], [false, 'Off']], () => S.holdShape, (v) => { S.holdShape = v; prefs.set('holdShape', v); }));
  };
  paint();
  modal({ title: 'Gestures and pen', body, actions: [{ label: 'Done', kind: 'primary' }] });
}

/* ---- pages sheet ---- */
async function openSheet() {
  const sh = $('#sheet'), grid = $('#sheetGrid');
  sh.hidden = false; grid.innerHTML = '';
  const token = (openSheet.tok = (openSheet.tok || 0) + 1);
  const cur = S.curPage || 0;
  const tiles = S.doc.pages.map((pg, i) => {
    const holder = h('div', { class: 'pt' });
    const t = h('div', { class: 'pg' + (i === cur ? ' cur' : ''), style: `--i:${Math.min(i, 12)}`, onclick: () => { sh.hidden = true; scrollToPage(i); } },
      holder, `${i + 1}`,
      S.doc.pages.length > 1 ? h('button', { class: 'x', 'aria-label': 'Delete page', onclick: async (e) => { e.stopPropagation(); removePageAt(i); openSheet(); } }, icon('trash', 15, 2.2)) : null);
    grid.append(t); return holder;
  });
  for (let i = 0; i < tiles.length; i++) {
    if (token !== openSheet.tok || sh.hidden) return;
    try { const c = await renderPageCanvas(i, 220); tiles[i].append(c); } catch {}
    await new Promise((r) => setTimeout(r, 0));
  }
}

/* =====================================================================
   Wiring
   ===================================================================== */
function wire() {
  $('#btnBack').append(icon('home')); $('#btnUndo').append(icon('undo')); $('#btnRedo').append(icon('redo'));
  $('#btnPages').append(icon('pages')); $('#btnMore').append(icon('more'));
  $('#fab').append(icon('plus', 30, 2.4)); $('#searchIcon').append(icon('search', 20));
  $('#emptyArt').append(icon('ball', 52, 1.6)); $('#btnSettings').append(icon('settings', 22));
  $('#sheetAdd').append(icon('plus', 16, 2.4), 'Add page'); $('#sheetClose').append(icon('x'));
  $('#focusExit').append(icon('focus', 20));

  $('#btnBack').onclick = () => switchTo(null);
  $('#btnUndo').onclick = () => undo(); $('#btnRedo').onclick = () => redo();
  $('#btnPages').onclick = openSheet; $('#pageInd').onclick = openSheet;
  $('#btnMore').onclick = () => (menuOpen ? closeMenu() : (closePop(), openMenu()));
  $('#btnSettings').onclick = settingsDialog;
  $('#docTitle').onclick = renameDoc;
  $('#focusExit').onclick = () => { document.body.classList.remove('focus'); setTimeout(resize, 30); };
  $('#sheetClose').onclick = () => ($('#sheet').hidden = true);
  $('#sheet').onclick = (e) => { if (e.target.id === 'sheet') $('#sheet').hidden = true; };
  $('#sheetAdd').onclick = () => { const i = S.doc.pages.length - 1; addPageAt(i + 1, blankPageLike(i)); openSheet(); };
  $('#fab').onclick = () => toggleFab();
  $('#search').oninput = (e) => { L.q = e.target.value.trim().toLowerCase(); renderLibrary(); };
  $('#file').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importPdf(f); };
  for (const id of ['#imgfile', '#camfile']) $(id).onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) insertImage(f); };
  document.addEventListener('click', (e) => { if (!e.target.closest('.fab-wrap')) toggleFab(false); });

  window.addEventListener('keydown', (e) => {
    if (!S.doc || e.target.closest('input,textarea')) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && k === 'y') { e.preventDefault(); redo(); }
    else if (!mod && { p: 'pen', h: 'hl', e: 'eraser', l: 'lasso', s: 'shape', t: 'text', m: 'hand' }[k]) setTool({ p: 'pen', h: 'hl', e: 'eraser', l: 'lasso', s: 'shape', t: 'text', m: 'hand' }[k]);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { const list = S.sel.items.map((i) => ({ pg: i.pg, o: i.o })); S.sel = null; $('#selbar').hidden = true; actRemoveObjs(list); }
  });
  window.addEventListener('paste', (e) => {
    if (!S.doc || e.target.closest('input,textarea')) return;
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); insertImage(f); }
  });
  window.addEventListener('dragover', (e) => { if (S.doc) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!S.doc) return;
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); insertImage(f); }
  });
  window.addEventListener('popstate', () => {
    if (S.tab) switchTo(null);
    else if (L.folder) { const m = byId(L.folder); goFolder(m ? m.parent || null : null, false); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.doc) saveNow(); });
  window.addEventListener('pagehide', () => { if (S.doc) saveNow(); });
  new ResizeObserver(() => { if (S.doc) resize(); }).observe($('#stage'));
  window.addEventListener('click', (e) => {
    if (popOpen && !e.target.closest('#pop,#dock,#selbar')) closePop();
    if (menuOpen && !e.target.closest('#menu,#btnMore')) closeMenu();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => requestFrame(true));
}

async function boot() {
  wire();
  await refreshLibrary();
  renderTabs();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('SW', e); }
  }
  // PDF shared to the installed app from another Android app
  if (new URLSearchParams(location.search).has('shared')) {
    try {
      const cache = await caches.open('inknote-inbox');
      const res = await cache.match('shared-file');
      if (res) {
        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get('x-name') || 'Shared PDF.pdf');
        await cache.delete('shared-file');
        history.replaceState(null, '', location.pathname);
        await importPdf(new File([blob], name, { type: 'application/pdf' }));
        return;
      }
    } catch (e) { console.warn(e); }
  }
  // restore the notes that were open last time
  const ids = prefs.get('tabs', []);
  for (const id of ids) {
    const m = byId(id);
    if (m && !isFolder(m) && !S.tabs.find((t) => t.id === id)) S.tabs.push({ id, title: m.title, type: m.type, loaded: false });
  }
  renderTabs();
  const active = prefs.get('activeTab', null);
  if (active && S.tabs.find((t) => t.id === active)) switchTo(active);
}
boot();

// test hook
window.__ink = { S, db, L };
