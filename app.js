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
  pen: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
  hl: 'm9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4',
  eraser: 'm7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21M22 21H7M5 11l9 9',
  lasso: 'M7 22a5 2 0 0 1-2-4M3.3 14A6.8 6.8 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-5-1M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  shape: 'M8.3 10a.7.7 0 0 1-.63-1.08L11.4 3a.7.7 0 0 1 1.2-.04L16.3 8.9a.7.7 0 0 1-.57 1.1ZM3 14h7v7H3ZM17.5 14a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  hand: 'M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
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
    h('div', { class: 'dlg-actions' }, actions.map((a) =>
      h('button', { class: 'btn ' + (a.kind || ''), onclick: () => { if (a.fn && a.fn() === false) return; close(); } }, a.label)))
  );
  d.onclose = null;
  d.showModal();
  return close;
}
const ask = (title, value, okLabel = 'Save') => new Promise((res) => {
  const inp = h('input', { class: 'field', value, maxlength: 80, enterkeyhint: 'done' });
  let done = false;
  const fin = (v) => { if (!done) { done = true; res(v); } };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { fin(inp.value.trim() || null); $('#dlg').close(); } });
  modal({ title, body: inp, actions: [
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
const PW = 800;                 // page width in world units
const PH = 1131;                // A4 ratio
const GAP = 22;                 // gap between pages
const ADD_H = 64;               // "add page" pill height
const PAPER = { white: '#ffffff', cream: '#fbf5e4', dark: '#1f2333' };
const PALETTE = ['#1b1b1f', '#e03131', '#f76707', '#f59f00', '#2f9e44', '#1c7ed6', '#7048e8', '#e64980', '#868e96', '#f4f4f6'];
const HL_PALETTE = ['#ffe066', '#ffa94d', '#8ce99a', '#74c0fc', '#da77f2', '#ff8787'];

function newPage(h = PH, extra = {}) { return { id: uid(), h, pdf: null, strokes: [], ...extra }; }
function makeDoc({ type, title, paper }) {
  const d = {
    id: uid(), type, title, paper, created: Date.now(), updated: Date.now(),
    pages: [type === 'whiteboard' ? newPage(0) : newPage()],
  };
  return d;
}
const isInf = (d) => d.type === 'whiteboard';

/* =====================================================================
   State
   ===================================================================== */
const S = {
  doc: null, pdf: null,
  view: { s: 1, x: 0, y: 0 },
  layout: { ys: [], total: 0 },
  tool: 'pen',
  shape: 'rect',
  tools: Object.assign({ pen: { c: PALETTE[0], s: 2.5 }, hl: { c: HL_PALETTE[0], s: 18 }, eraser: { s: 14 } }, prefs.get('tools', {})),
  stylusOnly: prefs.get('stylusOnly', false),
  stylusUserSet: prefs.get('stylusUserSet', false),
  act: null, sel: null, mode: null,
  hist: { u: [], r: [] },
  thumb: null,
};

const cv = $('#cv');
const ctx = cv.getContext('2d', { alpha: false, desynchronized: true });
const base = document.createElement('canvas');
const bctx = base.getContext('2d', { alpha: false });
let vw = 0, vh = 0, dpr = 1;
let baseDirty = true, frameQueued = false;
const bbCache = new WeakMap();

/* =====================================================================
   Geometry
   ===================================================================== */
function relayout() {
  const ys = []; let y = GAP;
  for (const p of S.doc.pages) { ys.push(y); y += p.h + GAP; }
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
  const m = st.s;
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
   Drawing primitives
   ===================================================================== */
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
function drawStroke(c, st, dark) {
  const p = st.p, n = p.length / 3;
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (st.t === 'hl') {
    c.globalCompositeOperation = dark ? 'source-over' : 'multiply';
    c.globalAlpha = dark ? 0.45 : 0.6;
    c.strokeStyle = st.c; c.lineWidth = st.s;
    c.lineCap = 'butt';
    strokePath(c, p, st.sh);
    c.stroke();
  } else if (st.vp && n > 2) {
    c.strokeStyle = st.c;
    let px = p[0], py = p[1], mx = p[0], my = p[1];
    for (let i = 1; i < n; i++) {
      const x = p[3 * i], y = p[3 * i + 1];
      const nx = i < n - 1 ? (x + p[3 * i + 3]) / 2 : x, ny = i < n - 1 ? (y + p[3 * i + 4]) / 2 : y;
      c.lineWidth = st.s * (0.35 + 1.1 * (p[3 * i + 2] + p[3 * i - 1]) / 2);
      c.beginPath(); c.moveTo(mx, my); c.quadraticCurveTo(x, y, nx, ny); c.stroke();
      mx = nx; my = ny;
    }
  } else {
    c.strokeStyle = st.c; c.lineWidth = st.s;
    strokePath(c, p, st.sh);
    c.stroke();
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
    for (let x = 32; x < PW; x += 32) { c.moveTo(x, 0); c.lineTo(x, pg.h); }
    for (let y = 32; y < pg.h; y += 32) { c.moveTo(0, y); c.lineTo(PW, y); }
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
  const sel = o.skipSel && S.sel ? S.sel.set : null;
  for (const st of pg.strokes) {
    if (sel && sel.has(st)) continue;
    if (vis && !hit(bbox(st), vis)) continue;
    drawStroke(c, st, dark || pg.pdf != null && false);
  }
  if (!inf) c.restore();
}

/* =====================================================================
   Render loop
   ===================================================================== */
function resize() {
  const r = $('#stage').getBoundingClientRect();
  if (!r.width) return;
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
function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function frame() {
  frameQueued = false;
  if (!S.doc || !vw) return;
  if (baseDirty) { renderBase(); baseDirty = false; }
  const { s, x, y } = S.view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(base, 0, 0);
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * x, dpr * y);
  const dark = S.doc.paper.color === 'dark';
  const a = S.act;
  if (a && a.kind === 'ink' && a.st) {
    ctx.save(); ctx.translate(0, S.layout.ys[a.pi]);
    if (!isInf(S.doc)) { ctx.beginPath(); ctx.rect(0, 0, PW, S.doc.pages[a.pi].h); ctx.clip(); }
    drawStroke(ctx, a.st, dark); ctx.restore();
  }
  if (a && a.kind === 'erase') {
    ctx.save(); ctx.strokeStyle = 'rgba(224,49,49,.9)'; ctx.fillStyle = 'rgba(224,49,49,.12)'; ctx.lineWidth = 1.5 / s;
    ctx.beginPath(); ctx.arc(a.wx, a.wy, S.tools.eraser.s / s, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  if (a && a.kind === 'lasso' && a.poly.length > 1) {
    ctx.save(); ctx.strokeStyle = '#3b5bdb'; ctx.fillStyle = 'rgba(59,91,219,.08)'; ctx.lineWidth = 2 / s; ctx.setLineDash([8 / s, 6 / s]);
    ctx.beginPath(); ctx.moveTo(a.poly[0][0], a.poly[0][1]); for (const q of a.poly) ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  if (S.sel) {
    const sl = S.sel;
    for (const it of sl.items) {
      ctx.save(); ctx.translate(sl.dx, S.layout.ys[it.pi] + sl.dy);
      drawStroke(ctx, it.st, dark); ctx.restore();
    }
    ctx.save(); ctx.strokeStyle = '#3b5bdb'; ctx.lineWidth = 2 / s; ctx.setLineDash([8 / s, 6 / s]);
    const b = sl.b; ctx.strokeRect(b[0] + sl.dx - 6, b[1] + sl.dy - 6, b[2] - b[0] + 12, b[3] - b[1] + 12);
    ctx.restore();
    placeSelbar();
  }
  updateIndicators();
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
const pdfCache = new Map();   // pdf page index -> {canvas, w}
const pdfPending = new Map(); // idx -> width requested
let pdfTimer = null, pdfBusy = 0;

async function renderPdfBitmap(idx, pxW) {
  const page = await S.pdf.getPage(idx + 1);
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
  if (!S.pdf || !S.doc) return;
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
      pdfQueue.push([pg.pdf, want]);
    }
  });
  // evict far pages
  if (pdfCache.size > 7) for (const k of [...pdfCache.keys()]) if (!visible.includes(k) && pdfCache.size > 7) pdfCache.delete(k);
  pumpPdf();
}
const pdfQueue = [];
async function pumpPdf() {
  while (pdfBusy < 2 && pdfQueue.length) {
    const [idx, w] = pdfQueue.shift();
    pdfBusy++;
    renderPdfBitmap(idx, w).then((canvas) => {
      pdfCache.set(idx, { canvas, w });
      requestFrame(true);
    }).catch((e) => console.warn('pdf page failed', idx, e)).finally(() => {
      pdfBusy--; pdfPending.delete(idx); pumpPdf();
    });
  }
}

/* =====================================================================
   History (undo / redo)
   ===================================================================== */
function commit(a) {
  S.hist.u.push(a); S.hist.r.length = 0;
  if (S.hist.u.length > 300) S.hist.u.shift();
  changed();
}
function undo() { const a = S.hist.u.pop(); if (!a) return; clearSel(); a.undo(); S.hist.r.push(a); changed(); }
function redo() { const a = S.hist.r.pop(); if (!a) return; clearSel(); a.redo(); S.hist.u.push(a); changed(); }
function changed() { baseDirty = true; requestFrame(); updateUR(); scheduleSave(); }
function updateUR() { $('#btnUndo').disabled = !S.hist.u.length; $('#btnRedo').disabled = !S.hist.r.length; }

function actAdd(pg, sts) {
  for (const s of sts) pg.strokes.push(s);
  commit({
    undo() { for (const s of sts) { const i = pg.strokes.indexOf(s); if (i >= 0) pg.strokes.splice(i, 1); } },
    redo() { for (const s of sts) pg.strokes.push(s); },
  });
}
function actRemove(list) { // [{pg, st}]
  const rec = list.map(({ pg, st }) => ({ pg, st, i: pg.strokes.indexOf(st) })).filter((r) => r.i >= 0);
  rec.forEach((r) => r.pg.strokes.splice(r.pg.strokes.indexOf(r.st), 1));
  if (!rec.length) return;
  commit({
    undo() { [...rec].sort((a, b) => a.i - b.i).forEach((r) => r.pg.strokes.splice(Math.min(r.i, r.pg.strokes.length), 0, r.st)); },
    redo() { rec.forEach((r) => { const i = r.pg.strokes.indexOf(r.st); if (i >= 0) r.pg.strokes.splice(i, 1); }); },
  });
}
function translate(st, dx, dy) { for (let i = 0; i < st.p.length; i += 3) { st.p[i] += dx; st.p[i + 1] += dy; } bbCache.delete(st); }

function addPageAt(index, pg, silent) {
  const pages = S.doc.pages;
  pages.splice(index, 0, pg); relayout();
  if (!silent) commit({
    undo() { const i = pages.indexOf(pg); if (i >= 0) pages.splice(i, 1); relayout(); },
    redo() { pages.splice(Math.min(index, pages.length), 0, pg); relayout(); },
  }); else changed();
}
function removePageAt(index) {
  const pages = S.doc.pages;
  if (pages.length < 2) return toast('A notebook needs at least one page');
  const [pg] = pages.splice(index, 1); relayout();
  commit({
    undo() { pages.splice(Math.min(index, pages.length), 0, pg); relayout(); },
    redo() { const i = pages.indexOf(pg); if (i >= 0) pages.splice(i, 1); relayout(); },
  });
  clampView();
}
function blankPageLike(i) {
  const ref = S.doc.pages[i] || S.doc.pages[0];
  return newPage(S.doc.pages.some((p) => p.pdf != null) ? ref.h : PH);
}
function scrollToPage(i) {
  const v = S.view; v.y = -(S.layout.ys[i] - GAP / 2) * v.s; clampView(); requestFrame(true);
}

/* =====================================================================
   Selection
   ===================================================================== */
function clearSel() { if (S.sel) { S.sel = null; $('#selbar').hidden = true; baseDirty = true; requestFrame(); } }
function placeSelbar() {
  const sl = S.sel, bar = $('#selbar'), { s, x, y } = S.view;
  bar.hidden = !!S.act;
  const cx = ((sl.b[0] + sl.b[2]) / 2 + sl.dx) * s + x;
  const ty = (sl.b[1] + sl.dy - 12) * s + y;
  const half = (bar.offsetWidth || 240) / 2 + 8;
  bar.style.left = clamp(cx, half, Math.max(half, vw - half)) + 'px';
  bar.style.top = Math.max(ty, 58) + 'px';
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
      if (tot && inn / tot >= 0.5) items.push({ st, pg, pi });
    }
  });
  if (!items.length) { clearSel(); return; }
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (const it of items) {
    const b = bbox(it.st), top = S.layout.ys[it.pi];
    bx0 = Math.min(bx0, b[0]); bx1 = Math.max(bx1, b[2]); by0 = Math.min(by0, b[1] + top); by1 = Math.max(by1, b[3] + top);
  }
  S.sel = { items, set: new Set(items.map((i) => i.st)), b: [bx0, by0, bx1, by1], dx: 0, dy: 0 };
  baseDirty = true;
}

/* =====================================================================
   Input: pointers, pan / pinch / tools
   ===================================================================== */
const ptr = new Map();
let pan = null, pinch = null, momentum = null;

function local(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button > 1) return;
  closePop(); closeMenu();
  cancelMomentum();
  try { cv.setPointerCapture(e.pointerId); } catch {}
  const [sx, sy] = local(e);
  ptr.set(e.pointerId, { x: sx, y: sy, t: e.pointerType });
  if (e.pointerType === 'pen' && !S.stylusUserSet && !S.stylusOnly) { S.stylusOnly = true; toast('Stylus detected — fingers now pan & zoom'); syncMenu(); }
  if (ptr.size > 1) { cancelAct(); beginPinch(); return; }
  const finger = e.pointerType === 'touch';
  if (e.button === 1 || S.tool === 'hand' || (finger && S.stylusOnly)) { beginPan(sx, sy, finger); return; }
  let tool = S.tool;
  if (e.pointerType === 'pen' && (e.buttons & 32)) tool = 'eraser';
  beginTool(tool, e, sx, sy);
});
cv.addEventListener('pointermove', (e) => {
  const p = ptr.get(e.pointerId);
  if (!p) return;
  const [sx, sy] = local(e);
  p.x = sx; p.y = sy;
  if (S.mode === 'pinch') { movePinch(); return; }
  if (S.mode === 'pan') { movePan(sx, sy, e.timeStamp); return; }
  if (!S.act) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  const list = evs.length ? evs : [e];
  for (const ev of list) { const [lx, ly] = local(ev); feed(ev, lx, ly); }
  requestFrame();
});
const endPtr = (e, cancelled) => {
  if (!ptr.has(e.pointerId)) return;
  ptr.delete(e.pointerId);
  if (S.mode === 'pinch') { if (ptr.size < 2) { S.mode = null; pinch = null; } return; }
  if (S.mode === 'pan') { endPan(); return; }
  if (S.act) { cancelled ? cancelAct() : finishAct(); }
};
cv.addEventListener('pointerup', (e) => endPtr(e, false));
cv.addEventListener('pointercancel', (e) => endPtr(e, true));
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [sx, sy] = local(e);
  if (e.ctrlKey || e.metaKey) zoomAt(sx, sy, Math.exp(-e.deltaY * 0.01));
  else { S.view.x -= e.deltaX; S.view.y -= e.deltaY; clampView(); requestFrame(true); }
}, { passive: false });

function zoomAt(sx, sy, k) {
  const v = S.view, [wx, wy] = toWorld(sx, sy);
  v.s *= k; clampView();
  v.x = sx - wx * v.s; v.y = sy - wy * v.s; clampView();
  requestFrame(true); flashZoom();
}

function beginPan(sx, sy, finger) {
  S.mode = 'pan'; pan = { sx, sy, vx: 0, vy: 0, t: performance.now(), finger };
}
function movePan(sx, sy, ts) {
  const dx = sx - pan.sx, dy = sy - pan.sy;
  const now = performance.now(), dt = Math.max(1, now - pan.t);
  pan.vx = 0.7 * pan.vx + 0.3 * (dx / dt); pan.vy = 0.7 * pan.vy + 0.3 * (dy / dt); pan.t = now;
  pan.sx = sx; pan.sy = sy;
  S.view.x += dx; S.view.y += dy; clampView(); requestFrame(true);
}
function endPan() {
  S.mode = null;
  if (pan && pan.finger && performance.now() - pan.t < 80 && Math.hypot(pan.vx, pan.vy) > 0.15) startMomentum(pan.vx, pan.vy);
  pan = null;
}
function startMomentum(vx, vy) {
  let last = performance.now();
  const step = (t) => {
    const dt = t - last; last = t;
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
  const [a, b] = [...ptr.values()];
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  pinch = { d, s: S.view.s, w: toWorld(cx, cy) };
}
function movePinch() {
  if (!pinch || ptr.size < 2) return;
  const [a, b] = [...ptr.values()];
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const v = S.view;
  v.s = pinch.s * d / pinch.d; clampView();
  v.x = cx - pinch.w[0] * v.s; v.y = cy - pinch.w[1] * v.s; clampView();
  requestFrame(true); flashZoom();
}

/* ---------- tools ---------- */
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
  const pressure = e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5;
  if (tool === 'pen' || tool === 'hl') {
    const T = S.tools[tool];
    const st = { t: tool, c: T.c, s: T.s, vp: e.pointerType === 'pen' && tool === 'pen', p: [wx, wy - top, pressure] };
    S.act = { kind: 'ink', pi, st, last: [wx, wy - top] };
  } else if (tool === 'shape') {
    const T = S.tools.pen;
    S.act = { kind: 'shape', pi, a: [wx, wy - top], b: [wx, wy - top], st: { t: 'pen', c: T.c, s: T.s, sh: 1, vp: false, p: [wx, wy - top, 0.5] } };
  } else if (tool === 'eraser') {
    S.act = { kind: 'erase', wx, wy, removed: new Map() };
    eraseAt(wx, wy);
  } else if (tool === 'lasso') {
    if (S.sel) {
      const b = S.sel.b;
      if (wx > b[0] - 14 && wx < b[2] + 14 && wy > b[1] - 14 && wy < b[3] + 14) { S.act = { kind: 'selmove', ox: wx, oy: wy }; return; }
      clearSel();
    }
    S.act = { kind: 'lasso', poly: [[wx, wy]] };
  }
  requestFrame();
}

function feed(e, sx, sy) {
  const a = S.act; if (!a) return;
  const [wx, wy] = toWorld(sx, sy);
  if (a.kind === 'ink') {
    const top = S.layout.ys[a.pi], lx = wx, ly = wy - top;
    const md = 0.7 / S.view.s;
    if (Math.hypot(lx - a.last[0], ly - a.last[1]) < md) return;
    a.st.p.push(lx, ly, e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5);
    a.last = [lx, ly];
  } else if (a.kind === 'shape') {
    const top = S.layout.ys[a.pi];
    a.b = [wx, wy - top];
    a.st.p = shapePoints(S.shape, a.a, a.b);
    bbCache.delete(a.st);
  } else if (a.kind === 'erase') {
    a.wx = wx; a.wy = wy; eraseAt(wx, wy);
  } else if (a.kind === 'lasso') {
    const l = a.poly[a.poly.length - 1];
    if (Math.hypot(wx - l[0], wy - l[1]) > 2 / S.view.s) a.poly.push([wx, wy]);
  } else if (a.kind === 'selmove') {
    S.sel.dx = wx - a.ox; S.sel.dy = wy - a.oy;
  }
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
  else if (kind === 'ellipse') {
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2;
    for (let i = 0; i <= 72; i++) { const t = i / 72 * Math.PI * 2; P(cx + rx * Math.cos(t), cy + ry * Math.sin(t)); }
  }
  return pts;
}

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return qx * qx + qy * qy;
}
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
        S.act.removed.set(st, { pg, st, i: k });
        baseDirty = true;
      }
    }
  });
}

function cancelAct() {
  const a = S.act;
  if (a && a.kind === 'erase' && a.removed.size) finishAct(); // keep erase already applied
  else if (a && a.kind === 'selmove') { S.sel.dx = S.sel.dy = 0; }
  S.act = null; requestFrame(true);
}
function finishAct() {
  const a = S.act; S.act = null;
  if (!a) return;
  if (a.kind === 'ink') {
    if (a.st.p.length === 3) a.st.p.push(a.st.p[0], a.st.p[1], a.st.p[2]);
    actAdd(S.doc.pages[a.pi], [a.st]);
  } else if (a.kind === 'shape') {
    if (Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]) > 4) actAdd(S.doc.pages[a.pi], [a.st]);
  } else if (a.kind === 'erase') {
    const rec = [...a.removed.values()];
    if (rec.length) {
      commit({
        undo() { [...rec].sort((x, y) => x.i - y.i).forEach((r) => r.pg.strokes.splice(Math.min(r.i, r.pg.strokes.length), 0, r.st)); },
        redo() { rec.forEach((r) => { const i = r.pg.strokes.indexOf(r.st); if (i >= 0) r.pg.strokes.splice(i, 1); }); },
      });
    }
  } else if (a.kind === 'lasso') {
    if (a.poly.length > 3) lassoSelect(a.poly);
    else clearSel();
  } else if (a.kind === 'selmove') {
    const { dx, dy, items } = S.sel;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) {
      items.forEach((it) => translate(it.st, dx, dy));
      const b = S.sel.b; S.sel.b = [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy]; S.sel.dx = S.sel.dy = 0;
      commit({
        undo() { items.forEach((it) => translate(it.st, -dx, -dy)); },
        redo() { items.forEach((it) => translate(it.st, dx, dy)); },
      });
    } else { S.sel.dx = S.sel.dy = 0; }
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
  const meta = { id: d.id, title: d.title, type: d.type, updated: d.updated, pages: d.pages.length, thumb: S.thumb };
  try { await db.saveDoc(d, meta); } catch (e) { console.error(e); toast('Could not save — storage full?'); }
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
async function renderPageCanvas(i, pxW, whole) {
  const doc = S.doc, pg = doc.pages[i];
  if (isInf(doc)) {
    let b = [0, 0, 800, 600];
    const all = pg.strokes;
    if (all.length) {
      b = [1e9, 1e9, -1e9, -1e9];
      for (const st of all) { const q = bbox(st); b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])]; }
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
  if (pg.pdf != null && S.pdf) bmp = await renderPdfBitmap(pg.pdf, Math.round(pxW));
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
   Library UI
   ===================================================================== */
const L = { filter: 'all', q: '', metas: [] };
const FILTERS = [['all', 'All'], ['notebook', 'Notebooks'], ['whiteboard', 'Whiteboards'], ['pdf', 'PDFs']];

async function refreshLibrary() {
  L.metas = (await db.listMeta()).sort((a, b) => b.updated - a.updated);
  renderLibrary();
}
function renderLibrary() {
  const f = $('#filters'); f.innerHTML = '';
  FILTERS.forEach(([k, label]) => f.append(h('button', { class: 'chip' + (L.filter === k ? ' on' : ''), onclick: () => { L.filter = k; renderLibrary(); } }, label)));
  const list = L.metas.filter((m) => (L.filter === 'all' || m.type === L.filter) && (!L.q || m.title.toLowerCase().includes(L.q)));
  const g = $('#grid'); g.innerHTML = '';
  $('#empty').hidden = list.length > 0;
  for (const m of list) {
    const label = { notebook: 'NOTEBOOK', whiteboard: 'BOARD', pdf: 'PDF' }[m.type];
    const card = h('div', { class: 'card', role: 'button', tabindex: 0, onclick: () => openDoc(m.id) },
      h('div', { class: 'thumb' + (m.type === 'whiteboard' ? ' board' : '') },
        m.thumb ? h('img', { src: m.thumb, alt: '', draggable: false }) : icon(m.type === 'whiteboard' ? 'board' : m.type === 'pdf' ? 'pdf' : 'book', 40)),
      h('span', { class: 'badge' }, label),
      h('button', { class: 'more', 'aria-label': 'Options', onclick: (e) => { e.stopPropagation(); cardMenu(m); } }, icon('more', 20)),
      h('div', { class: 'card-title' }, m.title),
      h('div', { class: 'card-sub' }, `${m.type === 'whiteboard' ? 'Infinite canvas' : m.pages + (m.pages === 1 ? ' page' : ' pages')} · ${fmtDate(m.updated)}`));
    g.append(card);
  }
}
function fmtDate(t) {
  const d = new Date(t), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
function cardMenu(m) {
  const close = modal({ title: m.title, body: [
    mi('edit', 'Rename', async () => { close(); const t = await ask('Rename', m.title); if (t) { const d = await db.getDoc(m.id); d.title = t; m.title = t; await db.saveDoc(d, { ...m, title: t }); renderLibrary(); } }),
    mi('copy', 'Duplicate', async () => {
      close();
      const d = await db.getDoc(m.id), nid = uid(), pdf = await db.getPdf(m.id);
      const copy = structuredClone(d); copy.id = nid; copy.title = d.title + ' copy'; copy.updated = Date.now();
      if (pdf) await db.putPdf(nid, pdf.slice(0));
      await db.saveDoc(copy, { ...m, id: nid, title: copy.title, updated: copy.updated }); refreshLibrary();
    }),
    mi('trash', 'Delete', async () => { close(); if (await confirmDlg('Delete “' + m.title + '”?', 'This can’t be undone.')) { await db.remove(m.id); refreshLibrary(); } }, true),
  ], actions: [{ label: 'Close' }] });
}
function mi(ic, label, fn, danger) {
  return h('button', { class: 'mi' + (danger ? ' danger' : ''), onclick: fn }, h('span', { class: 'ico' }, icon(ic, 22)), label);
}

/* ---- create ---- */
function toggleFab(force) {
  const m = $('#fabmenu'), open = force ?? m.hidden;
  m.hidden = !open; $('#fab').classList.toggle('open', open);
  if (open) {
    m.innerHTML = '';
    [['book', 'New notebook', () => newDialog('notebook')], ['board', 'New whiteboard', () => newDialog('whiteboard')], ['pdf', 'Import PDF', () => $('#file').click()]]
      .forEach(([ic, t, fn], i) => m.append(h('button', { class: 'fabitem', style: `animation-delay:${(2 - i) * 40}ms`, onclick: () => { toggleFab(false); fn(); } }, h('span', { class: 'ico' }, icon(ic, 20)), t)));
  }
}
function newDialog(type) {
  let style = type === 'whiteboard' ? 'dots' : 'ruled', color = 'white';
  const title = h('input', { class: 'field', value: type === 'notebook' ? 'Untitled notebook' : 'Whiteboard', maxlength: 80 });
  const styles = [['ruled', 'Ruled'], ['grid', 'Grid'], ['dots', 'Dots'], ['blank', 'Blank']];
  const colors = [['white', 'White'], ['cream', 'Cream'], ['dark', 'Dark']];
  const sRow = h('div', { class: 'opts' }), cRow = h('div', { class: 'opts three' });
  const paint = () => {
    sRow.innerHTML = ''; cRow.innerHTML = '';
    styles.forEach(([k, l]) => sRow.append(h('button', { class: 'opt' + (style === k ? ' on' : ''), onclick: () => { style = k; paint(); } }, paperPreview(k, color), l)));
    colors.forEach(([k, l]) => cRow.append(h('button', { class: 'opt' + (color === k ? ' on' : ''), onclick: () => { color = k; paint(); } }, h('div', { class: 'pv', style: `background:${PAPER[k]}` }), l)));
  };
  paint();
  const body = [h('div', { class: 'lbl' }, 'Name'), title, h('div', { class: 'lbl' }, type === 'whiteboard' ? 'Background' : 'Paper'), sRow, h('div', { class: 'lbl' }, 'Colour'), cRow];
  modal({ title: type === 'notebook' ? 'New notebook' : 'New whiteboard', body, actions: [
    { label: 'Cancel' },
    { label: 'Create', kind: 'primary', fn: async () => {
      const doc = makeDoc({ type, title: title.value.trim() || 'Untitled', paper: { style, color } });
      await db.saveDoc(doc, { id: doc.id, title: doc.title, type, updated: doc.updated, pages: 1, thumb: null });
      openDoc(doc.id);
    } }] });
}
function paperPreview(style, color) {
  const dark = color === 'dark', bg = PAPER[color];
  const ln = dark ? 'rgba(255,255,255,.3)' : 'rgba(40,70,160,.4)';
  let bgi = '';
  if (style === 'ruled') bgi = `repeating-linear-gradient(to bottom,transparent 0 9px,${ln} 9px 10px)`;
  if (style === 'grid') bgi = `linear-gradient(${ln} 1px,transparent 1px),linear-gradient(90deg,${ln} 1px,transparent 1px)`;
  if (style === 'dots') bgi = `radial-gradient(${ln} 1.4px,transparent 1.6px)`;
  const sz = style === 'grid' ? 'background-size:10px 10px' : style === 'dots' ? 'background-size:10px 10px' : '';
  return h('div', { class: 'pv', style: `background-color:${bg};background-image:${bgi};${sz}` });
}

/* ---- import pdf ---- */
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
    await db.saveDoc(doc, { id: doc.id, title: doc.title, type: 'pdf', updated: doc.updated, pages: pages.length, thumb: null });
    task.destroy();
    $('#toast').hidden = true;
    openDoc(doc.id);
  } catch (e) { console.error(e); toast('That PDF couldn’t be opened'); }
}

/* =====================================================================
   Editor UI
   ===================================================================== */
const TOOLS = [['pen', 'Pen'], ['hl', 'Highlighter'], ['eraser', 'Eraser'], ['lasso', 'Select'], ['shape', 'Shapes'], ['hand', 'Move']];

function buildDock() {
  const d = $('#dock'); d.innerHTML = '';
  for (const [k, label] of TOOLS) {
    d.append(h('button', { class: 'tool' + (S.tool === k ? ' on' : ''), 'data-tool': k, 'aria-label': label, title: label, onclick: () => {
      if (S.tool === k && (k === 'pen' || k === 'hl' || k === 'eraser' || k === 'shape')) togglePop(); else { setTool(k); closePop(); }
    } }, icon(k === 'hl' ? 'hl' : k, 24)));
  }
  d.append(h('span', { class: 'sep' }));
  d.append(h('button', { class: 'swatch-btn', id: 'swBtn', 'aria-label': 'Colour and size', onclick: () => { if (S.tool === 'lasso' || S.tool === 'hand') setTool('pen'); togglePop(); } }));
  syncDock();
}
function curTool() { return S.tool === 'shape' ? S.tools.pen : S.tools[S.tool]; }
function setTool(k) {
  S.tool = k; if (S.sel && k !== 'lasso') clearSel();
  syncDock(); requestFrame();
}
function syncDock() {
  document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === S.tool));
  const t = curTool(), sw = $('#swBtn');
  if (!sw) return;
  sw.style.background = t && t.c ? t.c : 'var(--panel2)';
  sw.style.visibility = S.tool === 'hand' || S.tool === 'lasso' ? 'hidden' : 'visible';
  cv.style.cursor = S.tool === 'hand' ? 'grab' : 'crosshair';
}
function savePrefs() { prefs.set('tools', S.tools); }

let popOpen = false;
function closePop() { $('#pop').hidden = true; popOpen = false; }
function togglePop() { if (popOpen) closePop(); else openPop(); }
function openPop() {
  const pop = $('#pop'); pop.innerHTML = ''; popOpen = true; pop.hidden = false;
  const k = S.tool;
  const T = curTool();
  if (k === 'shape') {
    pop.append(h('h4', {}, 'Shape'), h('div', { class: 'segs' }, ['line', 'arrow', 'rect', 'ellipse'].map((n) =>
      h('button', { class: 'seg' + (S.shape === n ? ' on' : ''), 'aria-label': n, onclick: () => { S.shape = n; openPop(); } }, icon(n, 22)))));
  }
  if (k === 'eraser') {
    pop.append(h('p', { class: 'note' }, 'Removes whole strokes you touch.'));
  } else {
    pop.append(h('h4', {}, 'Colour'));
    const pal = k === 'hl' ? HL_PALETTE : PALETTE;
    const row = h('div', { class: 'swatches' });
    pal.forEach((c) => row.append(h('button', { class: 'sw' + (T.c.toLowerCase() === c ? ' on' : ''), style: `background:${c}`, 'aria-label': c, onclick: () => { T.c = c; savePrefs(); syncDock(); openPop(); } })));
    const ci = h('input', { type: 'color', value: T.c, oninput: (e) => { T.c = e.target.value; savePrefs(); syncDock(); prev(); }, onchange: () => openPop() });
    row.append(h('div', { class: 'sw custom' }, ci));
    pop.append(row);
  }
  const [mn, mx, st] = k === 'hl' ? [6, 44, 1] : k === 'eraser' ? [6, 44, 1] : [1, 16, 0.5];
  const prevEl = h('i', {});
  const prev = () => {
    const sz = k === 'eraser' ? T.s * 1 : Math.max(2, T.s * (k === 'hl' ? 1 : 1.6));
    prevEl.style.cssText = k === 'eraser' ? `width:${T.s}px;height:${T.s}px;border:2px solid #e03131;background:rgba(224,49,49,.12)` : `width:${sz}px;height:${sz}px;background:${T.c};${k === 'hl' ? 'border-radius:4px;opacity:.6' : ''}`;
  };
  prev();
  pop.append(h('h4', {}, 'Size'), h('div', { class: 'sizerow' },
    h('input', { type: 'range', min: mn, max: mx, step: st, value: T.s, oninput: (e) => { T.s = +e.target.value; prev(); savePrefs(); }, 'aria-label': 'Size' }),
    h('div', { class: 'sizeprev' }, prevEl)));
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
  item('palm', 'Stylus only', () => { S.stylusOnly = !S.stylusOnly; S.stylusUserSet = true; prefs.set('stylusOnly', S.stylusOnly); prefs.set('stylusUserSet', true); openMenu(); toast(S.stylusOnly ? 'Fingers pan & zoom, stylus draws' : 'Fingers can draw too'); }, { keep: true, val: S.stylusOnly ? 'On' : 'Off' });
  item('edit', 'Rename', renameDoc);
  if (!(d.type === 'pdf')) item('paper', d.type === 'whiteboard' ? 'Background' : 'Paper style', paperDialog);
  if (paged) { item('plus', 'Add page after this', () => { const i = S.curPage || 0; addPageAt(i + 1, blankPageLike(i)); scrollToPage(i + 1); }); }
  m.append(h('div', { class: 'mdiv' }));
  item('down', 'Export as PDF', exportPdf);
  if (paged && d.pages.length > 1) { m.append(h('div', { class: 'mdiv' })); item('trash', 'Delete this page', async () => { const i = S.curPage || 0; if (await confirmDlg('Delete page ' + (i + 1) + '?', 'You can undo this right after.')) removePageAt(i); }, { danger: true }); }
}
async function renameDoc() {
  const t = await ask('Rename', S.doc.title);
  if (t) { S.doc.title = t; $('#docTitle').textContent = t; changed(); }
}
function paperDialog() {
  const d = S.doc; let style = d.paper.style, color = d.paper.color;
  const styles = d.type === 'whiteboard' ? [['dots', 'Dots'], ['grid', 'Grid'], ['blank', 'Blank']] : [['ruled', 'Ruled'], ['grid', 'Grid'], ['dots', 'Dots'], ['blank', 'Blank']];
  const colors = [['white', 'White'], ['cream', 'Cream'], ['dark', 'Dark']];
  const sRow = h('div', { class: 'opts' }), cRow = h('div', { class: 'opts three' });
  const paint = () => {
    sRow.innerHTML = ''; cRow.innerHTML = '';
    styles.forEach(([k, l]) => sRow.append(h('button', { class: 'opt' + (style === k ? ' on' : ''), onclick: () => { style = k; paint(); } }, paperPreview(k, color), l)));
    colors.forEach(([k, l]) => cRow.append(h('button', { class: 'opt' + (color === k ? ' on' : ''), onclick: () => { color = k; paint(); } }, h('div', { class: 'pv', style: `background:${PAPER[k]}` }), l)));
  };
  paint();
  modal({ title: 'Paper', body: [h('div', { class: 'lbl' }, 'Style'), sRow, h('div', { class: 'lbl' }, 'Colour'), cRow], actions: [{ label: 'Cancel' }, { label: 'Apply', kind: 'primary', fn: () => {
    d.paper = { style, color }; adaptInk(); changed();
  } }] });
}
function adaptInk() {
  const dark = S.doc.paper.color === 'dark', pen = S.tools.pen;
  if (dark && pen.c === PALETTE[0]) pen.c = '#f4f4f6';
  if (!dark && pen.c === '#f4f4f6') pen.c = PALETTE[0];
  syncDock();
}

/* ---- pages sheet ---- */
async function openSheet() {
  const sh = $('#sheet'), grid = $('#sheetGrid');
  sh.hidden = false; grid.innerHTML = '';
  const token = (openSheet.tok = (openSheet.tok || 0) + 1);
  const cur = S.curPage || 0;
  const tiles = S.doc.pages.map((pg, i) => {
    const holder = h('div', { class: 'pt' });
    const t = h('div', { class: 'pg' + (i === cur ? ' cur' : ''), onclick: () => { sh.hidden = true; scrollToPage(i); } },
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

/* ---- open / close ---- */
async function openDoc(id) {
  const doc = await db.getDoc(id);
  if (!doc) return toast('Could not open that note');
  const meta = await db.getMeta(id);
  S.doc = doc; S.thumb = meta?.thumb || null; S.pdf = null; pdfCache.clear(); pdfPending.clear(); pdfQueue.length = 0;
  S.hist = { u: [], r: [] }; S.sel = null; S.act = null; S.mode = null; ptr.clear(); S.curPage = 0;
  if (doc.pages.some((p) => p.pdf != null)) {
    const buf = await db.getPdf(id);
    if (buf) { try { S.pdf = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise; } catch (e) { toast('Original PDF is missing'); } }
  }
  $('#library').hidden = true; $('#editor').hidden = false;
  history.pushState({ editor: id }, '');
  $('#docTitle').textContent = doc.title;
  relayout(); adaptInk(); buildDock(); updateUR(); closePop(); closeMenu();
  vw = 0; resize();
  if (!vw) await new Promise((r) => requestAnimationFrame(() => { resize(); r(); }));
  if (doc.view && doc.view.w) {
    const k = vw / doc.view.w; S.restored = true;
    S.view = isInf(doc) ? { ...doc.view } : { s: doc.view.s * k, x: doc.view.x * k, y: doc.view.y * k };
    clampView();
  } else { S.restored = false; fitView(); clampView(); }
  requestFrame(true);
}
async function closeDoc(fromPop) {
  if (!S.doc) return;
  closePop(); closeMenu(); $('#sheet').hidden = true; clearSel();
  S.thumb = await makeThumb() || S.thumb;
  await saveNow();
  S.doc = null; S.pdf = null; pdfCache.clear();
  $('#editor').hidden = true; $('#library').hidden = false;
  if (!fromPop && history.state && history.state.editor) history.back();
  refreshLibrary();
}

/* =====================================================================
   Wiring
   ===================================================================== */
function wire() {
  $('#btnBack').append(icon('back')); $('#btnUndo').append(icon('undo')); $('#btnRedo').append(icon('redo'));
  $('#btnPages').append(icon('pages')); $('#btnMore').append(icon('more'));
  $('#fab').append(icon('plus', 30, 2.4)); $('#searchIcon').append(icon('search', 20));
  $('#emptyArt').append(icon('pen', 52, 1.6));
  $('#sheetAdd').append(icon('plus', 16, 2.4), 'Add page'); $('#sheetClose').append(icon('x'));

  $('#btnBack').onclick = () => closeDoc(false);
  $('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;
  $('#btnPages').onclick = openSheet; $('#pageInd').onclick = openSheet;
  $('#btnMore').onclick = () => (menuOpen ? closeMenu() : (closePop(), openMenu()));
  $('#docTitle').onclick = renameDoc;
  $('#sheetClose').onclick = () => ($('#sheet').hidden = true);
  $('#sheet').onclick = (e) => { if (e.target.id === 'sheet') $('#sheet').hidden = true; };
  $('#sheetAdd').onclick = () => { const i = S.doc.pages.length - 1; addPageAt(i + 1, blankPageLike(i)); openSheet(); };
  $('#fab').onclick = () => toggleFab();
  $('#search').oninput = (e) => { L.q = e.target.value.trim().toLowerCase(); renderLibrary(); };
  $('#file').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importPdf(f); };
  document.addEventListener('click', (e) => { if (!e.target.closest('.fab-wrap')) toggleFab(false); });

  const sb = $('#selbar');
  sb.append(
    h('button', { class: 'del', onclick: () => { const it = S.sel.items; clearSelKeep(); actRemove(it.map((i) => ({ pg: i.pg, st: i.st }))); } }, icon('trash', 18), 'Delete'),
    h('button', { onclick: () => {
      const items = S.sel.items; const off = 24;
      const copies = items.map((it) => { const st = structuredClone(it.st); translate(st, off, off); return { pg: it.pg, st, pi: it.pi }; });
      copies.forEach((c) => c.pg.strokes.push(c.st));
      commit({ undo() { copies.forEach((c) => { const i = c.pg.strokes.indexOf(c.st); if (i >= 0) c.pg.strokes.splice(i, 1); }); }, redo() { copies.forEach((c) => c.pg.strokes.push(c.st)); } });
      const b = S.sel.b;
      S.sel = { items: copies, set: new Set(copies.map((c) => c.st)), b: [b[0] + off, b[1] + off, b[2] + off, b[3] + off], dx: 0, dy: 0 };
      baseDirty = true; requestFrame();
    } }, icon('copy', 18), 'Duplicate'),
    h('button', { onclick: clearSel }, icon('check', 18), 'Done'));
  function clearSelKeep() { S.sel = null; sb.hidden = true; }

  window.addEventListener('keydown', (e) => {
    if (!S.doc || e.target.closest('input,textarea')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (!mod && { p: 'pen', h: 'hl', e: 'eraser', l: 'lasso', s: 'shape', m: 'hand' }[e.key.toLowerCase()]) setTool({ p: 'pen', h: 'hl', e: 'eraser', l: 'lasso', s: 'shape', m: 'hand' }[e.key.toLowerCase()]);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { const it = S.sel.items; S.sel = null; $('#selbar').hidden = true; actRemove(it.map((i) => ({ pg: i.pg, st: i.st }))); }
  });
  window.addEventListener('popstate', () => { if (S.doc) closeDoc(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.doc) saveNow(); });
  window.addEventListener('pagehide', () => { if (S.doc) saveNow(); });
  new ResizeObserver(() => { if (S.doc) { const old = vw; resize(); } }).observe($('#stage'));
  window.addEventListener('click', (e) => {
    if (popOpen && !e.target.closest('#pop,#dock')) closePop();
    if (menuOpen && !e.target.closest('#menu,#btnMore')) closeMenu();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => requestFrame(true));
}

async function boot() {
  wire();
  await refreshLibrary();
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
      }
    } catch (e) { console.warn(e); }
  }
}
boot();

// test hook
window.__ink = { S, db };
