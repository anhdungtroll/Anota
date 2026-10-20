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
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  rotate: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  present: 'M3 4h18v12H3zM8 21l4-5 4 5',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  line: 'M5 19 19 5',
  arrow: 'M5 19 19 5M9 5h10v10',
  rect: 'M4 6h16v12H4z',
  ellipse: 'M12 5c5 0 9 3 9 7s-4 7-9 7-9-3-9-7 4-7 9-7z',
  triangle: 'M12 4l9 16H3z',
  diamond: 'M12 3l9 9-9 9-9-9z',
  pentagon: 'M12 3l9 6.5-3.5 10.5h-11L3 9.5z',
  hexagon: 'M7 4h10l5 8-5 8H7l-5-8z',
  star: 'M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.3 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z',
  ruler: 'M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  fill: 'M19 11 11 3 3 11l8 8zM21 15s2 2.2 2 3.5a2 2 0 0 1-4 0c0-1.3 2-3.5 2-3.5z',
  home: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  folderPlus: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 11v6M9 14h6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  focus: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
  move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
  open: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  palette: 'M12 22a10 10 0 1 1 10-10c0 3-2 4-4 4h-2a2 2 0 0 0-1 3.7c.6.5.5 2.3-3 2.3zM7.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM16.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  fit: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  laser: 'M12 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 3v3M12 17v3M3 11.5h3M18 11.5h3M5.6 5.1l2.1 2.1M16.3 15.8l2.1 2.1M18.4 5.1l-2.1 2.1M7.7 15.8l-2.1 2.1',
  jump: 'M5 12h13M13 6l6 6-6 6M4 5v14',
  comment: 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  split: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 3v18',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 3v3M12 18v3M3 12h3M18 12h3',
  bold: 'M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
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
  const reload = () => { try { p = JSON.parse(localStorage.getItem('inknote.prefs') || '{}'); } catch {} };
  return { reload, get: (k, d) => (k in p ? p[k] : d), set(k, v) { reload(); p[k] = v; try { localStorage.setItem('inknote.prefs', JSON.stringify(p)); } catch {} } };
})();

/* fires on pointerup (pen, finger or mouse) and falls back to click; never twice */
function tapify(el, fn) {
  let down = false, last = 0;
  const go = (e) => { const t = performance.now(); if (t - last < 450) return; last = t; e.preventDefault?.(); e.stopPropagation?.(); fn(e); };
  el.addEventListener('pointerdown', (e) => { down = true; e.stopPropagation(); });
  el.addEventListener('pointerup', (e) => { if (down) { down = false; go(e); } });
  el.addEventListener('pointercancel', () => { down = false; });
  el.addEventListener('click', go);
}

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
  $('#dlg').onclose = () => { if (!$('#dlg').open) fin(null); };
  setTimeout(() => { inp.focus(); inp.select(); }, 60);
});
const confirmDlg = (title, text, okLabel = 'Delete') => new Promise((res) => {
  let done = false;
  const fin = (v) => { if (!done) { done = true; res(v); } };
  modal({ title, body: h('p', {}, text), actions: [
    { label: 'Cancel', fn: () => fin(false) },
    { label: okLabel, kind: 'danger', fn: () => fin(true) }] });
  $('#dlg').onclose = () => { if (!$('#dlg').open) fin(false); };
});

/* =====================================================================
   Constants & model
   ===================================================================== */
const APP_VERSION = '3.2 (build 1)';
const PANE = new URLSearchParams(location.search).has('pane');
const STYLES = [['glass', 'Glass'], ['clay', 'Clay'], ['og', 'Classic'], ['custom', 'Custom']];
const CUSTOM_DEF = { bg: '#fdf6e3', ac: '#d9480f' };
const CUSTOM_VARS = ['--bg', '--panel', '--panel2', '--ink', '--muted', '--accent', '--accent-soft', '--line', '--stage', '--tabbar'];
const hex2 = (h) => { const n = parseInt((/^#[0-9a-f]{6}$/i.test(h) ? h : '#888888').slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mixc = (a, b, t) => { const A = hex2(a), B = hex2(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const lumOf = (h) => { const [r, g, b] = hex2(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
function applyStyle(n) {
  if (!STYLES.some((x) => x[0] === n)) n = 'glass';
  const root = document.documentElement;
  root.dataset.style = n;
  for (const v of CUSTOM_VARS) root.style.removeProperty(v);
  root.style.removeProperty('color-scheme');
  if (n === 'custom') {
    const c = Object.assign({}, CUSTOM_DEF, prefs.get('custom', {})), dark = lumOf(c.bg) < 0.5, ink = dark ? '#f1f2f8' : '#1b1d29', edge = dark ? '#ffffff' : '#000000';
    const set = { '--bg': c.bg, '--panel': mixc(c.bg, dark ? '#ffffff' : '#ffffff', dark ? 0.08 : 0.55), '--panel2': mixc(c.bg, edge, 0.07), '--ink': ink, '--muted': mixc(ink, c.bg, 0.45),
      '--accent': c.ac, '--accent-soft': `rgba(${hex2(c.ac).join(',')},.16)`, '--line': `rgba(${hex2(ink).join(',')},.12)`, '--stage': mixc(c.bg, edge, 0.1), '--tabbar': mixc(c.bg, edge, dark ? 0.25 : 0.06) };
    for (const k in set) root.style.setProperty(k, set[k]);
    root.style.setProperty('color-scheme', dark ? 'dark' : 'light');
  }
  return n;
}
applyStyle(prefs.get('style', 'glass'));
if (PANE) document.body.classList.add('pane');
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
  eraser: { s: 14 }, laser: { s: 1 }, shape: { c: '#1b1b1f', s: 2.5 }, text: { c: '#1b1b1f', s: 26 },
};
const SHAPES = ['line', 'arrow', 'rect', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star'];

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
  shapeFill: prefs.get('shapeFill', false),
  eraserMode: prefs.get('eraserMode', 'stroke'),
  scribble: prefs.get('scribble', true),
  loopSel: prefs.get('loopSel', 'shape'),
  ruler: null,
  act: null, sel: null, mode: null, hover: null, ghosts: [], laser: [], pulse: null, pick: null,
  laserC: prefs.get('laserC', '#ff2d2d'), laserMs: prefs.get('laserMs', 1400), laserRaw: null,
  hist: { u: [], r: [] }, thumb: null, curPage: 0, editing: null,
};

const cv = $('#cv');
const ctx = cv.getContext('2d', { alpha: false });
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

/* Rich text: lines starting with # / ## / ### are headings, "- " is a bullet;
   **bold**, __underline__ and ~~strike~~ work inside a line. The editor has buttons for all of it. */
const HSZ = [1, 1.8, 1.5, 1.25];
function parseLine(raw) {
  let lvl = 0, bullet = false, t = raw;
  const m = /^(#{1,3})\s+/.exec(t);
  if (m) { lvl = m[1].length; t = t.slice(m[0].length); }
  else if (/^[-*\u2022]\s+/.test(t)) { bullet = true; t = t.replace(/^[-*\u2022]\s+/, ''); }
  const toks = []; let b = false, u = false, st = false, buf = '';
  const flush = () => { if (buf) { toks.push({ t: buf, b, u, s: st }); buf = ''; } };
  for (let i = 0; i < t.length;) {
    const two = t.substr(i, 2);
    if (two === '**') { flush(); b = !b; i += 2; }
    else if (two === '__') { flush(); u = !u; i += 2; }
    else if (two === '~~') { flush(); st = !st; i += 2; }
    else { buf += t[i]; i++; }
  }
  flush();
  return { lvl, bullet, toks };
}
const fontFor = (size, bold) => `${bold ? '700 ' : ''}${size}px ${FONT}`;
function textLayout(it) {
  const sig = it.text + '|' + it.w + '|' + it.s;
  let c = tlCache.get(it);
  if (c && c.sig === sig) return c;
  bctx.save();
  const rows = []; let y = 0;
  for (const raw of (it.text || '').split('\n')) {
    const P = parseLine(raw), size = it.s * HSZ[P.lvl], lh = size * 1.3, ind = P.bullet ? size * 0.95 : 0;
    const maxW = Math.max(30, it.w - 2 * TP - ind), headBold = P.lvl > 0;
    const lines = []; let row = null;
    const newRow = () => (row = { parts: [], x: 0 }, lines.push(row), row);
    newRow();
    const put = (t, st) => {
      if (!t) return;
      bctx.font = fontFor(size, st.b || headBold);
      const w = bctx.measureText(t).width, vw = bctx.measureText(t.trimEnd()).width;
      row.parts.push({ t, x: row.x, w, vw, b: st.b || headBold, u: st.u, s: st.s }); row.x += w;
    };
    const place = (t, st) => {
      bctx.font = fontFor(size, st.b || headBold);
      let w = bctx.measureText(t).width;
      if (row.x + w > maxW && row.x > 0 && t.trim()) { newRow(); t = t.trimStart(); w = bctx.measureText(t).width; }
      while (w > maxW && t.length > 1) {
        let k = t.length - 1; while (k > 1 && bctx.measureText(t.slice(0, k)).width > maxW) k--;
        put(t.slice(0, k), st); newRow(); t = t.slice(k); w = bctx.measureText(t).width;
      }
      put(t, st);
    };
    for (const tk of P.toks) for (const piece of tk.t.split(/(\s+)/)) if (piece) place(piece, tk);
    if (P.lvl && y > 0) y += size * 0.22;
    lines.forEach((r, i) => { rows.push({ y, lh, size, parts: r.parts, bullet: P.bullet && i === 0, ind, lvl: P.lvl }); y += lh; });
  }
  bctx.restore();
  c = { sig, rows, h: Math.max(y, it.s * 1.3) + 2 * TP };
  tlCache.set(it, c);
  return c;
}
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
function linkLabel(it) { return it.k === 'jump' ? (it.text || 'Jump') : (it.text || hostOf(it.url)); }
const CM = (it) => (it.s || 24) * 1.45;   // comment marker size
function linkLayout(it) {
  bctx.save(); bctx.font = `600 ${it.s}px ${FONT}`;
  const w = Math.min(560, bctx.measureText(linkLabel(it)).width + it.s * 2.6);
  bctx.restore();
  it.w = w; return { w, h: it.s * 1.9 };
}
function itemRect(it) {
  if (it.k === 'text') return [it.x, it.y, it.x + it.w, it.y + textLayout(it).h];
  if (it.k === 'link' || it.k === 'jump') { const l = linkLayout(it); return [it.x, it.y, it.x + l.w, it.y + l.h]; }
  if (it.k === 'comment') return [it.x, it.y, it.x + CM(it), it.y + CM(it)];
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
  if (it.r && ROT_KINDS.has(it.k)) {
    const r = itemRect(it), cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2;
    c.save(); c.translate(cx, cy); c.rotate(it.r); c.translate(-cx, -cy); drawItem0(c, it, o); c.restore();
  } else drawItem0(c, it, o);
}
function drawItem0(c, it, o) {
  const dark = S.doc.paper.color === 'dark';
  const r = itemRect(it);
  if (it.k === 'text') {
    if (S.editing === it) return;
    const l = textLayout(it);
    c.save(); c.fillStyle = it.c; c.textBaseline = 'top';
    for (const r of l.rows) {
      const y0 = it.y + TP + r.y + (r.lh - r.size) / 2, x0 = it.x + TP + r.ind, lw = Math.max(1, r.size / 15);
      if (r.bullet) { c.beginPath(); c.arc(it.x + TP + r.size * 0.3, y0 + r.size * 0.56, r.size * 0.11, 0, 6.2832); c.fill(); }
      for (const p of r.parts) {
        c.font = fontFor(r.size, p.b); c.fillText(p.t, x0 + p.x, y0);
        if (p.u) c.fillRect(x0 + p.x, y0 + r.size * 1.04, p.vw, lw);
        if (p.s) c.fillRect(x0 + p.x, y0 + r.size * 0.57, p.vw, lw);
      }
      if (r.lvl === 1) { c.globalAlpha = 0.22; c.fillRect(it.x + TP, y0 + r.size * 1.18, it.w - 2 * TP, 1.5); c.globalAlpha = 1; }
    }
    c.restore();
  } else if (it.k === 'comment') {
    const z = CM(it);
    c.save();
    c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
    c.fillStyle = it.c || '#ffd43b'; roundRect(c, it.x, it.y, z, z * 0.82, z * 0.26); c.fill();
    c.beginPath(); c.moveTo(it.x + z * 0.2, it.y + z * 0.8); c.lineTo(it.x + z * 0.16, it.y + z * 1.02); c.lineTo(it.x + z * 0.46, it.y + z * 0.8); c.closePath(); c.fill();
    c.shadowColor = 'transparent';
    c.fillStyle = 'rgba(60,40,0,.62)';
    for (let i = 0; i < 3; i++) c.fillRect(it.x + z * 0.2, it.y + z * (0.2 + i * 0.17), z * (i === 2 ? 0.36 : 0.6), Math.max(1.5, z * 0.055));
    c.restore();
  } else if (it.k === 'video') {
    const w = r[2] - r[0], hh = r[3] - r[1], pr = Math.min(w, hh) * 0.16;
    c.save(); c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 10; c.shadowOffsetY = 3;
    const g = c.createLinearGradient(r[0], r[1], r[2], r[3]); g.addColorStop(0, '#2b2f45'); g.addColorStop(1, '#0f111c');
    c.fillStyle = g; roundRect(c, r[0], r[1], w, hh, 14); c.fill(); c.shadowColor = 'transparent';
    c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.arc(r[0] + w / 2, r[1] + hh / 2, pr, 0, 6.2832); c.fill();
    c.fillStyle = '#1b1d29'; c.beginPath(); c.moveTo(r[0] + w / 2 - pr * 0.28, r[1] + hh / 2 - pr * 0.5); c.lineTo(r[0] + w / 2 + pr * 0.52, r[1] + hh / 2); c.lineTo(r[0] + w / 2 - pr * 0.28, r[1] + hh / 2 + pr * 0.5); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = `600 ${Math.max(11, Math.min(15, w / 22))}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    let t = it.title || ''; while (t.length > 3 && c.measureText(t).width > w - 24) t = t.slice(0, -2);
    c.fillText(t === (it.title || '') ? t : t + '…', r[0] + 12, r[3] - 12);
    c.restore();
  } else if (it.k === 'link' || it.k === 'jump') {
    const J = it.k === 'jump';
    const w = r[2] - r[0], hh = r[3] - r[1];
    c.save();
    c.fillStyle = J ? (dark ? 'rgba(94,234,190,.2)' : 'rgba(18,160,120,.13)') : dark ? 'rgba(138,164,255,.2)' : 'rgba(59,91,219,.12)';
    c.strokeStyle = J ? (dark ? 'rgba(94,234,190,.65)' : 'rgba(18,160,120,.6)') : dark ? 'rgba(138,164,255,.6)' : 'rgba(59,91,219,.5)'; c.lineWidth = 1.5;
    roundRect(c, r[0], r[1], w, hh, hh / 2); c.fill(); c.stroke();
    c.fillStyle = J ? (dark ? '#7ff0cf' : '#0b7a59') : dark ? '#9db2ff' : '#2c49b8'; c.font = `600 ${it.s}px ${FONT}`; c.textBaseline = 'middle'; c.textAlign = 'left';
    const label = linkLabel(it);
    let t = label; while (t.length > 3 && c.measureText(t).width > w - it.s * 2.3) t = t.slice(0, -2);
    if (t !== label) t += '…';
    c.fillText(t, r[0] + it.s * 0.9, r[1] + hh / 2 + 1);
    const tw = c.measureText(t).width;
    c.fillRect(r[0] + it.s * 0.9, r[1] + hh / 2 + it.s * 0.42, tw, 1.5);
    c.textAlign = 'right'; c.fillText(J ? '➜' : '↗', r[2] - it.s * 0.6, r[1] + hh / 2 + 1);
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
  if (st.fl && st.sh && n > 3) {
    c.save(); c.globalAlpha = 0.22; c.fillStyle = st.c; strokePath(c, p, true); c.closePath(); c.fill(); c.restore();
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
  const pp = S.doc.paper, SP = pp.sp || 0, lc = pp.lc;
  const rgba = (hx, a) => { const n = parseInt(hx.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const col = lc ? rgba(lc, 0.38) : dark ? 'rgba(255,255,255,.10)' : (style === 'ruled' || style === 'cornell' || style === 'music') ? 'rgba(52,96,190,.24)' : 'rgba(30,40,80,.13)';
  c.save();
  c.strokeStyle = col; c.fillStyle = dark ? 'rgba(255,255,255,.22)' : 'rgba(30,40,80,.28)';
  c.lineWidth = Math.max(1 / scale, 1);
  if (style === 'ruled') {
    c.beginPath();
    for (let y = 110; y < pg.h - 20; y += SP || 36) { c.moveTo(0, y); c.lineTo(PW, y); }
    c.stroke();
    c.strokeStyle = dark ? 'rgba(255,120,120,.28)' : 'rgba(224,49,49,.3)';
    c.beginPath(); c.moveTo(90, 0); c.lineTo(90, pg.h); c.stroke();
  } else if (style === 'cornell') {
    const sy = pg.h - 200;
    c.beginPath();
    for (let y = 130; y < sy - 10; y += SP || 36) { c.moveTo(0, y); c.lineTo(PW, y); }
    c.stroke();
    c.strokeStyle = dark ? 'rgba(255,255,255,.35)' : 'rgba(40,60,120,.5)'; c.lineWidth *= 1.6;
    c.beginPath(); c.moveTo(0, 100); c.lineTo(PW, 100); c.moveTo(210, 100); c.lineTo(210, sy); c.moveTo(0, sy); c.lineTo(PW, sy); c.stroke();
    c.fillStyle = dark ? 'rgba(255,255,255,.4)' : 'rgba(40,60,120,.5)'; c.font = '600 15px system-ui'; c.textAlign = 'left';
    c.fillText('CUES', 16, 124); c.fillText('NOTES', 226, 124); c.fillText('SUMMARY', 16, sy + 26);
  } else if (style === 'music') {
    const gap = SP ? SP / 3 : 11;
    c.beginPath();
    for (let y = 110; y + gap * 4 < pg.h - 30; y += gap * 4 + 70) for (let k = 0; k < 5; k++) { c.moveTo(40, y + k * gap); c.lineTo(PW - 40, y + k * gap); }
    c.stroke();
  } else if (style === 'grid') {
    c.beginPath();
    if (inf) {
      const [x0, y0, x1, y1] = vis; let step = SP || 32; while (step * scale < 12) step *= 2;
      for (let x = Math.ceil(x0 / step) * step; x < x1; x += step) { c.moveTo(x, y0); c.lineTo(x, y1); }
      for (let y = Math.ceil(y0 / step) * step; y < y1; y += step) { c.moveTo(x0, y); c.lineTo(x1, y); }
    } else {
      const g = SP || 32; for (let x = g; x < PW; x += g) { c.moveTo(x, 0); c.lineTo(x, pg.h); }
      for (let y = g; y < pg.h; y += g) { c.moveTo(0, y); c.lineTo(PW, y); }
    }
    c.stroke();
  } else if (style === 'dots') {
    let step = SP || 32; while (step * scale < 14) step *= 2;
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
  if (pg.bm && !o.flat && !inf) { c.fillStyle = '#e8590c'; c.beginPath(); c.moveTo(PW - 66, 0); c.lineTo(PW - 30, 0); c.lineTo(PW - 30, 46); c.lineTo(PW - 48, 34); c.lineTo(PW - 66, 46); c.closePath(); c.fill(); }
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
  if (S.hover && !a && !S.mode && S.tool !== 'laser') {
    const [hx, hy] = toWorld(S.hover.x, S.hover.y);
    const r = S.tool === 'eraser' ? S.tools.eraser.s / s : Math.max(2.5 / s, (curTool()?.s || 3) * 0.5);
    ctx.save(); ctx.lineWidth = 1.4 / s; ctx.strokeStyle = S.tool === 'eraser' ? 'rgba(224,49,49,.9)' : 'rgba(59,91,219,.9)';
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(hx, hy, r, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  if (S.ruler) drawRuler(ctx, s);
  drawMinimap();
  if (S.laser.length || S.tool === 'laser') drawLaser(ctx, s);
  if (S.pulse) drawPulse(ctx, s);
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
      const [rx, ry] = rotHandle(); ctx.setLineDash([]); ctx.lineWidth = 1.6 / s;
      ctx.beginPath(); ctx.moveTo(rx, ry + 12 / s); ctx.lineTo(rx, b[1] + sl.dy - 6); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.lineWidth = 2.5 / s; ctx.beginPath(); ctx.arc(rx, ry, 12 / s, 0, 6.2832); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 2 / s; ctx.beginPath(); ctx.arc(rx, ry, 5 / s, -0.4, 4.4); ctx.stroke();
      if (S.act && S.act.kind === 'rot') {
        ctx.font = `700 ${14 / s}px ${FONT}`; ctx.fillStyle = '#3b5bdb'; ctx.textAlign = 'left';
        ctx.fillText(Math.round(((S.act.d * 180 / Math.PI) % 360 + 360) % 360) + '°', rx + 18 / s, ry + 5 / s);
      }
    }
    if (resizable()) {
      ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.lineWidth = 2.5 / s;
      ctx.beginPath(); ctx.arc(b[2] + sl.dx + 6, b[3] + sl.dy + 6, 12 / s, 0, 6.2832); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 2 / s; ctx.beginPath();
      const hx = b[2] + sl.dx + 6, hy = b[3] + sl.dy + 6, q = 4.5 / s;
      ctx.moveTo(hx - q, hy + q); ctx.lineTo(hx + q, hy - q); ctx.moveTo(hx + q * 0.2, hy - q); ctx.lineTo(hx + q, hy - q); ctx.lineTo(hx + q, hy - q * 0.2); ctx.stroke();
    }
    ctx.restore();
    placeSelbar();
  }
  if (editor) syncEditor();
  if (S.zw) renderZoom();
  if (S.video) syncVideo();
  updateIndicators();
  if (cpop) placeCpop();
  if (anim || S.ghosts.length || S.laser.length || S.pulse || S.viewAnim || (a && a.snap && !a.snap.done)) requestFrame();
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
function duplicatePage(i) {
  const src = S.doc.pages[i], cp = structuredClone(src); cp.id = uid();
  cp.strokes.forEach((st) => { delete st.ts; }); cp.items.forEach((it) => { if (it.id) it.id = uid(); }); cp.bm = false;
  addPageAt(i + 1, cp);
}
function movePage(i, d) {
  const pages = S.doc.pages, j = i + d; if (j < 0 || j >= pages.length) return;
  const swap = () => { [pages[i], pages[j]] = [pages[j], pages[i]]; relayout(); };
  swap(); commit({ undo: swap, redo: swap });
}
function toggleBookmark(i) {
  const pg = S.doc.pages[i], f = () => { pg.bm = !pg.bm; baseDirty = true; requestFrame(true); };
  f(); commit({ undo: f, redo: f });
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
const ROT_KINDS = new Set(['img', 'text', 'video']);
function rotBox(it) {
  const r = itemRect(it); if (!it.r || !ROT_KINDS.has(it.k)) return r;
  const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2, hw = (r[2] - r[0]) / 2, hh = (r[3] - r[1]) / 2, co = Math.abs(Math.cos(it.r)), si = Math.abs(Math.sin(it.r));
  const w = hw * co + hh * si, h2 = hw * si + hh * co;
  return [cx - w, cy - h2, cx + w, cy + h2];
}
const objRect = (o) => (o.p ? bbox(o) : rotBox(o));
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
/* ---- elements: reusable drawings, text and stamps ---- */
const STAMPS = '⭐ ✅ ❌ ❓ ❗ 💡 📌 🔥 ❤️ 👍 👎 😀 😎 🤔 🎯 📖 ✏️ 📝 🔔 ⚠️ 🚩 🏆 🎉 💯 ➡️ ⬅️ ⬆️ ⬇️ 🔴 🟢 🔵 🟡 ☀️ 🌙 ☕ 🧠 🔍 🔑 📎 🗓️'.split(' ');
function saveElement() {
  const sl = S.sel; if (!sl) return;
  const b = sl.b, objs = sl.items.map((i) => { const c = structuredClone(i.o); if (c.id) c.id = uid(); moveObj(c, -b[0], -(b[1] - S.layout.ys[i.pi])); return c; });
  const list = prefs.get('elements', []);
  list.unshift({ id: uid(), w: b[2] - b[0], h: b[3] - b[1], objs });
  prefs.set('elements', list.slice(0, 40));
  toast('Saved to Elements', 1600);
}
function elementThumb(el) {
  const cv = h('canvas', { width: 160, height: 160 }), c = cv.getContext('2d'), k = Math.min(140 / Math.max(el.w, 1), 140 / Math.max(el.h, 1), 1.4);
  c.translate(80 - el.w * k / 2, 80 - el.h * k / 2); c.scale(k, k);
  for (const o of el.objs) { if (o.p) drawStroke(c, o, false); else drawItem(c, o, {}); }
  return cv;
}
function placeElement(el) {
  const cc = viewCentre(), objs = structuredClone(el.objs);
  objs.forEach((o) => { if (o.id) o.id = uid(); moveObj(o, cc.x - el.w / 2, cc.y - el.h / 2); });
  const pg = cc.pg;
  for (const o of objs) arrOf(pg, o).push(o);
  commit({
    undo() { for (const o of objs) { const a = arrOf(pg, o), i = a.indexOf(o); if (i >= 0) a.splice(i, 1); } },
    redo() { for (const o of objs) { const a = arrOf(pg, o); if (!a.includes(o)) a.push(o); } },
  });
  objs.forEach((o) => o.p && bbCache.delete(o));
  setTool('lasso'); makeSel(objs.map((o) => ({ o, pg, pi: cc.pi })));
}
function elementsDialog() {
  const body = h('div', {}), tabs = h('div', { class: 'segs' });
  let tab = 'saved';
  const paint = () => {
    tabs.innerHTML = ''; body.innerHTML = '';
    [['saved', 'Saved'], ['emoji', 'Stamps']].forEach(([k, l]) => tabs.append(h('button', { class: 'seg' + (tab === k ? ' on' : ''), onclick: () => { tab = k; paint(); } }, l)));
    if (tab === 'emoji') {
      body.append(h('div', { class: 'emojirow stamps' }, STAMPS.map((e) => h('button', { type: 'button', class: 'em', onclick: () => {
        $('#dlg').close(); const cc = viewCentre();
        const it = { id: uid(), k: 'text', x: cc.x - 30, y: cc.y - 40, w: 90, text: e, c: '#000000', s: 64 };
        afterInsert(cc.pg, cc.pi, it);
      } }, e))));
    } else {
      const list = prefs.get('elements', []);
      if (!list.length) body.append(h('p', { class: 'note' }, 'Nothing saved yet. Select some ink or text, then tap Save to keep it here for reuse.'));
      body.append(h('div', { class: 'elgrid' }, list.map((el) => h('div', { class: 'el' },
        h('button', { type: 'button', onclick: () => { $('#dlg').close(); placeElement(el); } }, elementThumb(el)),
        h('button', { class: 'x', type: 'button', 'aria-label': 'Remove', onclick: () => { prefs.set('elements', prefs.get('elements', []).filter((q) => q.id !== el.id)); paint(); } }, icon('x', 14, 2.4))))));
    }
  };
  paint();
  modal({ title: 'Elements', body: [tabs, body], actions: [{ label: 'Close' }] });
}
function rotHandle() { const sl = S.sel, b = sl.b; return [(b[0] + b[2]) / 2 + sl.dx, b[1] + sl.dy - 6 - 34 / S.view.s]; }
function rotState() {
  return S.sel.items.map((it) => {
    const o = it.o, top = S.layout.ys[it.pi];
    if (o.p) return { o, top, p: o.p.slice() };
    const r = itemRect(o);
    return { o, top, x: o.x, y: o.y, r: o.r || 0, cx: (r[0] + r[2]) / 2, cy: (r[1] + r[3]) / 2 };
  });
}
function applyRot(st, d, pcx, pcy) {
  const co = Math.cos(d), si = Math.sin(d);
  for (const q of st) {
    const o = q.o;
    if (q.p) {
      for (let i = 0; i < q.p.length; i += 3) {
        const dx = q.p[i] - pcx, dy = q.p[i + 1] + q.top - pcy;
        o.p[i] = pcx + dx * co - dy * si; o.p[i + 1] = pcy + dx * si + dy * co - q.top;
      }
      bbCache.delete(o);
    } else {
      const dx = q.cx - pcx, dy = q.cy + q.top - pcy;
      o.x = q.x + (pcx + dx * co - dy * si - q.cx); o.y = q.y + (pcy + dx * si + dy * co - q.top - q.cy);
      if (ROT_KINDS.has(o.k)) o.r = q.r + d;
    }
  }
  baseDirty = true;
}
function setRotState(st) {
  for (const q of st) { if (q.p) { q.o.p = q.p.slice(); bbCache.delete(q.o); } else { q.o.x = q.x; q.o.y = q.y; if (ROT_KINDS.has(q.o.k)) q.o.r = q.r; } }
  baseDirty = true; if (S.sel) boundsOfSel();
}
function rotateSel(d) {
  const sl = S.sel; if (!sl) return;
  const before = rotState(), b = sl.b, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  applyRot(before, d, cx, cy); boundsOfSel();
  const after = rotState();
  commit({ undo() { setRotState(before); }, redo() { setRotState(after); } });
  renderSelbar(); requestFrame(true);
}
function resizable() { return !!(S.sel && S.sel.items.length); }
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
  const B = (label, ic, fn, cls) => { const b = h('button', { class: cls || '', type: 'button' }, ic ? icon(ic, 18) : null, label); tapify(b, fn); bar.append(b); };
  B('Delete', 'trash', () => { const list = sl.items.map((i) => ({ pg: i.pg, o: i.o })); S.sel = null; bar.hidden = true; actRemoveObjs(list); }, 'del');
  B('Copy', 'copy', duplicateSel);
  B('Rotate', 'rotate', () => rotateSel(Math.PI / 2));
  if (sl.items.every((i) => i.o.p || i.o.k === 'text')) B('Save', 'bookmark', saveElement);
  B('Colour', 'palette', openColourPop);
  if (one && one.k === 'link') B('Open', 'open', () => openLink(one.url));
  if (one && one.k === 'video') { B('Play', 'present', () => playVideo(one, sl.items[0].pg, sl.items[0].pi)); B('Open', 'open', () => openLink(one.url)); }
  if (one && one.k === 'jump') {
    B('Go', 'jump', () => goTarget(one.target));
    B('Re-aim', 'target', () => startPick({ edit: one }));
    B('Label', 'edit', async () => { const t = await ask('Button label', one.text || '', 'Save'); if (t != null) { actProp([one], 'text', [one.text || ''], [t]); makeSelAgain(); } });
  }
  if (one && one.k === 'comment') B('Open', 'comment', () => openComment(sl.items[0], false));
  if (one && one.k === 'text') {
    B('Edit', 'edit', () => { const it = sl.items[0]; clearSel(); openTextEditor(it.o, it.pg, it.pi, false); });
    B('A−', null, () => scaleText(one, 1 / 1.18)); B('A+', null, () => scaleText(one, 1.18));
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
function activateItem(hh) {
  const o = hh.o;
  if (o.k === 'link') { buzz(10); openLink(o.url); return true; }
  if (o.k === 'jump') { buzz(10); goTarget(o.target); return true; }
  if (o.k === 'comment') { openComment(hh, false); return true; }
  return false;
}
/* ---- video links: a card on the page that plays in place ---- */
function parseVideo(u) {
  u = normalizeUrl(u); if (!u || !/^https?:/i.test(u)) return null;
  let m;
  if ((m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/i.exec(u))) return { kind: 'yt', src: u, embed: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0&playsinline=1`, title: 'YouTube video' };
  if ((m = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(u))) return { kind: 'vimeo', src: u, embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, title: 'Vimeo video' };
  let host = ''; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch {}
  return { kind: 'file', src: u, embed: u, title: (u.split('?')[0].split('/').pop() || host) };
}
function videoDialog() {
  const url = h('input', { class: 'field', placeholder: 'YouTube, Vimeo or a video file link', inputmode: 'url', autocapitalize: 'off', autocorrect: 'off' });
  modal({ title: 'Add a video', body: [h('div', { class: 'lbl' }, 'Link'), url, h('p', { class: 'note' }, 'Plays on the page. Needs an internet connection.')], actions: [
    { label: 'Cancel' },
    { label: 'Add', kind: 'primary', fn: () => {
      const v = parseVideo(url.value); if (!v) { toast('Paste a web link to a video'); return false; }
      const cc = viewCentre(), w = isInf(S.doc) ? 420 : PW * 0.7;
      const it = { id: uid(), k: 'video', vk: v.kind, url: v.src, title: v.title, x: cc.x - w / 2, y: cc.y - w * 0.28, w, ar: 16 / 9 };
      if (!isInf(S.doc)) it.x = clamp(it.x, 10, PW - w - 10);
      afterInsert(cc.pg, cc.pi, it); toast('Tap the play button to watch', 2200);
    } }] });
  setTimeout(() => url.focus(), 60);
}
function playVideo(it, pg, pi) {
  stopVideo();
  const v = parseVideo(it.url); if (!v) return toast('That video link is not valid');
  const box = h('div', { class: 'vidbox' });
  const close = h('button', { class: 'vidx', type: 'button', 'aria-label': 'Close video', onclick: stopVideo }, icon('x', 16, 2.6));
  let media;
  if (v.kind === 'file') {
    media = h('video', { src: v.embed, controls: true, autoplay: true, playsinline: true });
    media.addEventListener('error', () => { toast('This link could not be played. Opening it in the browser.'); openLink(it.url); stopVideo(); });
  } else media = h('iframe', { src: v.embed, allow: 'autoplay; fullscreen; picture-in-picture; encrypted-media', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin', title: it.title || 'Video' });
  box.append(media, close); $('#stage').append(box);
  S.video = { it, pg, pi, box }; syncVideo();
}
function stopVideo() { if (S.video) { S.video.box.remove(); S.video = null; } }
function syncVideo() {
  const V = S.video; if (!V) return;
  if (!V.pg.items.includes(V.it) || V.pi >= S.doc.pages.length) return stopVideo();
  const v = S.view, r = itemRect(V.it), top = S.layout.ys[V.pi], st = V.box.style;
  st.left = (r[0] * v.s + v.x) + 'px'; st.top = ((r[1] + top) * v.s + v.y) + 'px';
  st.width = (r[2] - r[0]) * v.s + 'px'; st.height = (r[3] - r[1]) * v.s + 'px';
  st.transform = V.it.r ? `rotate(${V.it.r}rad)` : '';
}
function videoPlayHit(wx, wy) {
  const hh = hitItem(wx, wy); if (!hh || hh.o.k !== 'video') return null;
  const r = itemRect(hh.o), top = S.layout.ys[hh.pi], cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2 + top;
  let px = wx, py = wy;
  if (hh.o.r) { const co = Math.cos(-hh.o.r), si = Math.sin(-hh.o.r); px = cx + (wx - cx) * co - (wy - cy) * si; py = cy + (wx - cx) * si + (wy - cy) * co; }
  return Math.hypot(px - cx, py - cy) < Math.max(Math.min(r[2] - r[0], r[3] - r[1]) * 0.2, 30 / S.view.s) ? hh : null;
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
      const it = pg.items[k], r = itemRect(it);
      let px = wx, py = wy - top;
      if (it.r && ROT_KINDS.has(it.k)) {     // undo the item's rotation on the point
        const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2, co = Math.cos(-it.r), si = Math.sin(-it.r);
        px = cx + (wx - cx) * co - (py - cy) * si; py = cy + (wx - cx) * si + (py - cy) * co;
      }
      if (px >= r[0] - m && px <= r[2] + m && py >= r[1] - m && py <= r[3] + m) return { o: it, pg, pi };
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
  const bar = buildTextBar(); $('#stage').append(bar);
  editor = { el, bar, it, pg, pi, isNew, old: it.text || '', oldS: it.s };
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
  el.style.transformOrigin = '50% 50%'; el.style.transform = it.r ? `rotate(${it.r}rad)` : '';
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, it.s * 1.3 * v.s + 2 * TP * v.s) + 'px';
  const bar = editor.bar;
  if (bar) {
    const bw = bar.offsetWidth || 340, hgt = parseFloat(el.style.height);
    bar.style.left = clamp(x, 8, Math.max(8, vw - bw - 8)) + 'px';
    bar.style.top = (y - 54 > 6 ? y - 54 : Math.min(y + hgt + 8, vh - 54)) + 'px';
  }
}
function revealRect(it, pi) {
  const r = itemRect(it), top = S.layout.ys[pi], v = S.view;
  const sy = (top + r[3]) * v.s + v.y;
  if (sy > vh - 24) { v.y -= sy - (vh - 40); clampView(); requestFrame(true); }
  else if ((top + r[1]) * v.s + v.y < 20) { v.y += 20 - ((top + r[1]) * v.s + v.y); clampView(); requestFrame(true); }
}
function commitEditor() {
  if (!editor) return;
  const { el, bar, it, pg, isNew, old, oldS } = editor;
  editor = null; S.editing = null;
  const text = el.value; el.remove(); if (bar) bar.remove();
  const newS = it.s;
  if (newS !== oldS && !isNew) commit({ undo() { it.s = oldS; }, redo() { it.s = newS; } });
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
let pan = null, pinch = null, momentum = null, tg = null, barrel = { on: false, t: 0, fired: false, ctxT: 0, pid: null };
const touches = () => [...ptr.values()].filter((p) => p.t === 'touch');

function local(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

cv.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  // some tablets report the S Pen button as a long-press / right-click
  const pt = e.pointerType, stylus = pt === 'pen' || pt === '' || pt === undefined;
  if (stylus && S.doc) {
    if (S.act && (S.act.kind === 'ink' || S.act.kind === 'shape') && !S.act.btn && S.gest.hold !== 'none') {   // button pressed while writing
      const t2 = S.gest.hold === 'lasso' ? 'lasso' : 'eraser', pid = S.act.pid;
      clearTimeout(S.act.hold); S.act = null; baseDirty = true; buzz(12);
      const last = ptr.get(pid); if (last) { beginTool(t2, { pointerId: pid, pointerType: 'pen', pressure: 0.5 }, last.x, last.y); if (S.act) S.act.btn = true; }
      requestFrame(true); return;
    }
    if (S.act && S.act.pt === 'pen') return;
    if (barrel.on) { if (!barrel.fired) { barrel.fired = true; barrelClick(); } }
    else { barrel.ctxT = performance.now(); barrelClick(); }
  }
});
cv.addEventListener('pointerdown', (e) => {
  if (!S.doc) return;
  e.preventDefault();
  // S Pen button pressed while hovering (no tip contact) arrives as a bare 'right button' down
  if (e.pointerType !== 'touch' && e.pointerType !== 'mouse' && (e.buttons & 1) === 0 && (e.buttons & 6)) { barrelPress(e); barrel.pid = e.pointerId; return; }
  const finger = e.pointerType === 'touch';
  // palm rejection: ignore touches while the pen is writing
  if (finger && S.act && S.act.pt === 'pen') return;
  commitEditor(); closeComment();
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

  { const [vx, vy] = toWorld(sx, sy), vh = videoPlayHit(vx, vy); if (vh && !S.pick) { playVideo(vh.o, vh.pg, vh.pi); return; } }
  if (S.zw && S.zw.pick && e.pointerId < 1000) { S.zw.pick = false; const zb = document.querySelector('#zw .zwctl button:nth-child(5)'); if (zb) zb.classList.remove('on'); const [px, py] = local(e); S.zw.x = clamp(px - S.zw.w * 0.15, 0, vw - S.zw.w); S.zw.y = clamp(py - S.zw.h * 0.4, 40, vh - S.zw.h); requestFrame(); return; }
  if (S.ruler && !S.pick && e.button !== 1) { const [rx, ry] = toWorld(sx, sy); if (rulerDown(e, rx, ry, finger)) return; }
  if (e.button === 1 || S.tool === 'hand' || S.pick || (finger && S.stylusOnly)) { beginPan(e.pointerId, sx, sy, finger); return; }
  let tool = S.tool;
  if (e.pointerType !== 'touch') {
    if (e.buttons & 32) tool = 'eraser';                       // eraser end of the pen
    else if (e.buttons & 6 || e.button === 2 || e.button === 5) {                                  // S Pen button held while writing
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
      if (e.pointerType !== 'mouse') {
        const b = e.buttons & 6;
        if (b && !barrel.on) barrelPress(e);
        else if (!b && barrel.on) barrelRelease(e, false);
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
  if (e.pointerType !== 'touch' && (S.act.kind === 'ink' || S.act.kind === 'shape') && S.gest.hold !== 'none' && list.some((ev) => ev.buttons & 38) && !(S.act.btn)) {
    const t2 = S.gest.hold === 'lasso' ? 'lasso' : 'eraser';
    clearTimeout(S.act.hold); S.act = null; baseDirty = true;
    buzz(12); beginTool(t2, e, sx, sy); if (S.act) S.act.btn = true; requestFrame(true); return;
  }
  for (const ev of list) { const [lx, ly] = local(ev); feed(ev, lx, ly); }
  requestFrame();
});
const endPtr = (e, cancelled) => {
  if (barrel.pid === e.pointerId && !ptr.has(e.pointerId)) { barrel.pid = null; barrelRelease(e, cancelled); return; }
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
/* The S Pen button can arrive as a hover 'buttons' change, a bare right-button press, or a contextmenu.
   One physical click must fire the action once, whichever of those the tablet sends. */
function barrelPress(e) { barrel.on = true; barrel.t = e.timeStamp; barrel.fired = performance.now() - barrel.ctxT < 300; }
function barrelRelease(e, cancelled) {
  const wasOn = barrel.on, fired = barrel.fired;
  barrel.on = false; barrel.fired = false;
  if (wasOn && !fired && !cancelled && e.timeStamp - barrel.t < 900) barrelClick();
}
function barrelClick() {
  const tNow = performance.now();
  if (tNow - (barrelClick.last || 0) < 40) return;
  barrelClick.last = tNow;
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
    if (S.pick) { pickAt(p.sx, p.sy); return; }
    if (h && activateItem(h)) return;
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
    if (S.ruler) {
      const hi = rulerHitInfo(wx, wy);
      if (hi && hi.part === 'edge') {
        clearTimeout(S.act.hold);
        const g = rulerGeo(), pt = rulerAt(clamp(hi.t, -RL.len / 2, RL.len / 2), hi.sign * RL.hw);
        S.act.rl = { sign: hi.sign, p0: pt };
        S.act.st.p = [pt[0], pt[1] - top, 0.5, pt[0], pt[1] - top, 0.5]; S.act.st.sh = 1; S.act.st.vp = false;
      }
    }
  } else if (tool === 'shape') {
    const T = S.tools.shape;
    S.act = { ...base, kind: 'shape', pi, a: [wx, wy - top], b: [wx, wy - top], st: { t: 'ball', c: T.c, s: T.s, sh: 1, vp: false, p: [wx, wy - top, 0.5], ...(S.shapeFill ? { fl: 1 } : {}) } };
  } else if (tool === 'eraser') {
    S.act = { ...base, kind: 'erase', wx, wy, edits: [] };
    eraseAt(wx, wy);
  } else if (tool === 'text' || tool === 'comment') {
    S.act = { ...base, kind: tool, wx, wy, sx, sy, moved: false };
  } else if (tool === 'laser') {
    S.act = { ...base, kind: 'laser' }; pushLaser(wx, wy, true);
  } else if (tool === 'lasso') {
    if (S.sel) {
      const b = S.sel.b;
      if (resizable()) {
        const [rx, ry] = rotHandle();
        if (Math.hypot(wx - rx, wy - ry) < 24 / S.view.s) {
          const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
          S.act = { ...base, kind: 'rot', cx, cy, a0: Math.atan2(wy - cy, wx - cx), sn: rotState(), d: 0 };
          return;
        }
      }
      if (resizable() && Math.hypot(wx - (b[2] + 6), wy - (b[3] + 6)) < 22 / S.view.s) {
        const one = S.sel.items.length === 1 ? S.sel.items[0].o : null;
        if (one && one.k === 'text') S.act = { ...base, kind: 'resize', mode: 'w', o: one, from: one.w };
        else S.act = { ...base, kind: 'resize', mode: 'k', sn: snapSel(), ax: b[0], ay: b[1], d0: Math.max(20, Math.hypot(b[2] + 6 - b[0], b[3] + 6 - b[1])), k: 1 };
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
  if (a.kind === 'rot') {
    let d = Math.atan2(wy - a.cy, wx - a.cx) - a.a0;
    const q = Math.PI / 12, n = Math.round(d / q);
    if (Math.abs(d - n * q) < 0.05) d = n * q;
    a.d = d; applyRot(a.sn, d, a.cx, a.cy); return;
  }
  if (a.kind === 'rmove') { S.ruler.x = a.sx + wx - a.ox; S.ruler.y = a.sy + wy - a.oy; return; }
  if (a.kind === 'rrot') {
    let ang = Math.atan2(wy - S.ruler.y, wx - S.ruler.x);
    const q = Math.PI / 4, n = Math.round(ang / q); if (Math.abs(ang - n * q) < 0.026) ang = n * q;
    S.ruler.a = ang; return;
  }
  if (a.kind === 'ink') {
    const top = S.layout.ys[a.pi], lx = wx, ly = wy - top;
    if (a.rl) {
      const [t] = rulerGeo().rel(wx, wy), pt = rulerAt(clamp(t, -RL.len / 2, RL.len / 2), a.rl.sign * RL.hw);
      a.st.p = [a.rl.p0[0], a.rl.p0[1] - top, 0.5, pt[0], pt[1] - top, 0.5]; bbCache.delete(a.st); return;
    }
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
  } else if (a.kind === 'text' || a.kind === 'comment') {
    if (Math.hypot(sx - a.sx, sy - a.sy) > 12) a.moved = true;
  } else if (a.kind === 'laser') {
    pushLaser(wx, wy);
  } else if (a.kind === 'lasso') {
    a.wx = wx; a.wy = wy;
    const l = a.poly[a.poly.length - 1];
    if (Math.hypot(wx - l[0], wy - l[1]) > 2 / S.view.s) a.poly.push([wx, wy]);
  } else if (a.kind === 'selmove') {
    S.sel.dx = wx - a.ox; S.sel.dy = wy - a.oy;
  } else if (a.kind === 'resize') {
    if (a.mode === 'w') { a.o.w = Math.max(110, wx - a.o.x); }
    else { a.k = clamp(Math.hypot(wx - a.ax, wy - a.ay) / a.d0, 0.15, 8); applyScale(a.sn, a.k, a.ax, a.ay); }
    boundsOfSel();
  }
}
/* uniform scale of the whole selection about a world-space anchor */
function snapSel() {
  return S.sel.items.map((it) => {
    const o = it.o, top = S.layout.ys[it.pi];
    return o.p ? { o, top, p: o.p.slice(), s: o.s } : { o, top, x: o.x, y: o.y, w: o.w, s: o.s };
  });
}
function applyScale(snap, k, ax, ay) {
  for (const r of snap) {
    const o = r.o;
    if (o.p) {
      for (let i = 0; i < r.p.length; i += 3) { o.p[i] = ax + (r.p[i] - ax) * k; o.p[i + 1] = ay + (r.p[i + 1] + r.top - ay) * k - r.top; }
      o.s = r.s * k; bbCache.delete(o);
    } else {
      o.x = ax + (r.x - ax) * k; o.y = ay + (r.y + r.top - ay) * k - r.top;
      if (r.w != null && o.k !== 'link' && o.k !== 'jump') o.w = r.w * k;
      if (r.s != null) o.s = r.s * k;
    }
  }
  baseDirty = true;
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
  else if (kind === 'diamond') { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; P(mx, a[1]); P(b[0], my); P(mx, b[1]); P(a[0], my); P(mx, a[1]); }
  else if (kind === 'pentagon' || kind === 'hexagon' || kind === 'star') {
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2;
    const n = kind === 'pentagon' ? 5 : kind === 'hexagon' ? 6 : 10, off = kind === 'hexagon' ? 0 : -Math.PI / 2;
    for (let i = 0; i <= n; i++) {
      const t = off + i / n * Math.PI * 2, k = kind === 'star' && i % 2 ? 0.42 : 1;
      P(cx + rx * k * Math.cos(t), cy + ry * k * Math.sin(t));
    }
  }
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
  if (poly.length >= 5 && poly.length <= 8) {   // straight sides (pentagon, hexagon...) vs. a round loop
    let tot = 0;
    for (const q of P) { let best = 1e9; for (let i = 0; i < poly.length; i++) { const a2 = poly[i], b2 = poly[(i + 1) % poly.length]; best = Math.min(best, Math.sqrt(segDist2(q[0], q[1], a2[0], a2[1], b2[0], b2[1]))); } tot += best; }
    if (tot / n < (poly.length >= 7 ? 0.009 : 0.018) * diag) return { kind: 'poly', pts: poly };
  }
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
  if (poly.length >= 5 && poly.length <= 8) return { kind: 'poly', pts: poly };
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
  if (S.loopSel === 'select' && sh.kind !== 'line') {
    S.act = null; baseDirty = true; buzz(18);
    setTool('lasso'); lassoSelect(P);
    if (!S.sel) toast('Nothing inside that loop');
    requestFrame(true); return;
  }
  if (S.shapeFill && sh.kind !== 'line') a.st.fl = 1;
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

/* ---------- digital ruler ---------- */
const RL = { len: 640, hw: 36 };
function rulerGeo() {
  const r = S.ruler, u = [Math.cos(r.a), Math.sin(r.a)], n = [-u[1], u[0]];
  return { r, u, n, rel: (wx, wy) => { const dx = wx - r.x, dy = wy - r.y; return [dx * u[0] + dy * u[1], dx * n[0] + dy * n[1]]; } };
}
function rulerAt(t, p) { const g = rulerGeo(); return [g.r.x + g.u[0] * t + g.n[0] * p, g.r.y + g.u[1] * t + g.n[1] * p]; }
function rulerHitInfo(wx, wy) {
  const g = rulerGeo(), [t, p] = g.rel(wx, wy), s = S.view.s, m = Math.max(RL.hw * 0.5, 18 / s);
  const cl = rulerAt(-RL.len / 2 + 26, 0), hd = rulerAt(RL.len / 2 - 26, 0);
  if (Math.hypot(wx - cl[0], wy - cl[1]) < m) return { part: 'close' };
  if (Math.hypot(wx - hd[0], wy - hd[1]) < m) return { part: 'rot' };
  const sign = p >= 0 ? 1 : -1;
  if (Math.abs(t) <= RL.len / 2 + 10 / s && Math.abs(Math.abs(p) - RL.hw) < 24 / s) return { part: 'edge', sign, t, p };
  if (Math.abs(t) <= RL.len / 2 && Math.abs(p) <= RL.hw) return { part: 'body' };
  return null;
}
// returns true if the ruler took this touch
function rulerDown(e, wx, wy, finger) {
  const hi = rulerHitInfo(wx, wy); if (!hi) return false;
  if (hi.part === 'close') { S.ruler = null; requestFrame(); return true; }
  const base = { pid: e.pointerId, pt: e.pointerType };
  if (hi.part === 'rot') { S.act = { ...base, kind: 'rrot' }; return true; }
  const inkTool = S.tool === 'pen' || S.tool === 'hl';
  if (hi.part === 'edge' && inkTool && !finger) return false;
  S.act = { ...base, kind: 'rmove', ox: wx, oy: wy, sx: S.ruler.x, sy: S.ruler.y };
  return true;
}
let mmT = 0, mmInfo = null;
/* ---- zoom window: write big, it lands small ---- */
function openZoom() {
  if (S.zw) return closeZoom();
  const pw = Math.min(vw - 24, 760), ph = 150, z = 2.5;
  S.zw = { z, pw, ph, w: pw / z, h: ph / z, x: Math.max(8, vw * 0.1), y: Math.max(60, vh * 0.3), auto: true, pick: false };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let box = $('#zwbox'), panel = $('#zw');
  if (!box) { box = h('div', { id: 'zwbox', class: 'zwbox' }); $('#stage').append(box); }
  if (panel) panel.remove();
  const zc = h('canvas', { id: 'zcv', width: Math.round(pw * dpr), height: Math.round(ph * dpr), style: `width:${pw}px;height:${ph}px` });
  const B = (lab, fn, cls) => h('button', { type: 'button', class: cls || '', onclick: fn }, lab);
  const step = (dx, dy) => { const w = S.zw; w.x = clamp(w.x + dx * w.w, 0, vw - w.w); w.y = clamp(w.y + dy * w.h, 40, vh - w.h); requestFrame(); };
  const ctl = h('div', { class: 'zwctl' },
    B('◀', () => step(-0.6, 0)), B('▶', () => step(0.6, 0)), B('▲', () => step(0, -0.8)), B('▼', () => step(0, 0.8)),
    B('Place', (e) => { S.zw.pick = !S.zw.pick; e.currentTarget.classList.toggle('on', S.zw.pick); if (S.zw.pick) toast('Tap where you want to write', 1800); }),
    B('Auto', (e) => { S.zw.auto = !S.zw.auto; e.currentTarget.classList.toggle('on', S.zw.auto); }, 'on'),
    B('2×', (e) => { const w = S.zw; w.z = w.z >= 4 ? 2 : w.z + 1; w.w = w.pw / w.z; w.h = w.ph / w.z; e.currentTarget.textContent = w.z + '×'; requestFrame(); }),
    B('✕', closeZoom, 'ex'));
  ctl.children[6].textContent = '2.5×'; ctl.children[6].onclick = (e) => { const w = S.zw; w.z = w.z >= 4 ? 2 : w.z + 0.5; w.w = w.pw / w.z; w.h = w.ph / w.z; e.currentTarget.textContent = w.z + '×'; requestFrame(); };
  panel = h('div', { id: 'zw', class: 'zw' }, zc, ctl);
  $('#stage').append(panel);
  // forward pen/finger input on the panel to the main canvas, scaled down
  const fwd = (type, e, ev) => {
    const w = S.zw; if (!w) return;
    const r = zc.getBoundingClientRect(), c0 = cv.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const cx = c0.left + w.x + px / r.width * w.w, cy = c0.top + w.y + py / r.height * w.h;
    cv.dispatchEvent(new PointerEvent(type, { pointerId: e.pointerId + 1000, pointerType: e.pointerType, isPrimary: true, bubbles: true, cancelable: true, clientX: cx, clientY: cy, pressure: e.pressure, buttons: e.buttons, button: e.button }));
    return px / r.width;
  };
  let last = 0;
  zc.addEventListener('pointerdown', (e) => { e.preventDefault(); try { zc.setPointerCapture(e.pointerId); } catch {} last = fwd('pointerdown', e); });
  zc.addEventListener('pointermove', (e) => {
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of list.length ? list : [e]) { const q = fwd('pointermove', ev); if (q != null) last = q; }
  });
  const up = (type) => (e) => {
    fwd(type, e);
    const w = S.zw;
    if (w && w.auto && last > 0.72) {                 // finished near the right edge: slide the window on
      const page = S.view.x + PW * S.view.s;
      if (w.x + w.w * 1.7 > page) { w.x = Math.max(0, S.view.x + 6); w.y = clamp(w.y + w.h * 0.9, 40, vh - w.h); }
      else w.x = clamp(w.x + w.w * 0.7, 0, vw - w.w);
      requestFrame();
    }
    last = 0;
  };
  zc.addEventListener('pointerup', up('pointerup')); zc.addEventListener('pointercancel', up('pointercancel'));
  requestFrame();
}
function closeZoom() { S.zw = null; const p = $('#zw'), b = $('#zwbox'); if (p) p.remove(); if (b) b.remove(); requestFrame(); }
function renderZoom() {
  const w = S.zw, zc = $('#zcv'), box = $('#zwbox'); if (!zc || !box) return;
  const c = zc.getContext('2d'), dpr = devicePixelRatio || 1, k = cv.width / vw;
  c.fillStyle = '#fff'; c.fillRect(0, 0, zc.width, zc.height);
  c.drawImage(cv, w.x * k, w.y * k, w.w * k, w.h * k, 0, 0, zc.width, zc.height);
  box.style.cssText = `left:${w.x}px;top:${w.y}px;width:${w.w}px;height:${w.h}px`;
}
function drawMinimap() {
  const mm = $('#minimap'); if (!mm) return;
  if (!S.doc || !isInf(S.doc) || document.body.classList.contains('focus')) { mm.hidden = true; return; }
  const t = now();
  if (t - mmT < 120 && mmInfo) return; mmT = t;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const pg = S.doc.pages[0];
  for (const st of pg.strokes) { const b = bbox(st); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
  for (const it of pg.items) { const r = itemRect(it); x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[2]); y1 = Math.max(y1, r[3]); }
  const v = S.view, vx0 = -v.x / v.s, vy0 = -v.y / v.s, vx1 = vx0 + vw / v.s, vy1 = vy0 + vh / v.s;
  if (x0 > x1 || (x0 > vx0 && x1 < vx1 && y0 > vy0 && y1 < vy1)) { mm.hidden = true; mmInfo = null; return; }
  x0 = Math.min(x0, vx0); y0 = Math.min(y0, vy0); x1 = Math.max(x1, vx1); y1 = Math.max(y1, vy1);
  const W = 150, H = 100, k = Math.min(W / (x1 - x0), H / (y1 - y0)), ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
  mm.hidden = false; const c = mm.getContext('2d'); c.clearRect(0, 0, mm.width, mm.height);
  c.setTransform(2, 0, 0, 2, 0, 0);
  c.fillStyle = 'rgba(40,50,100,.55)';
  for (const st of pg.strokes) { const b = bbox(st); c.fillRect(ox + (b[0] - x0) * k, oy + (b[1] - y0) * k, Math.max(1.5, (b[2] - b[0]) * k), Math.max(1.5, (b[3] - b[1]) * k)); }
  for (const it of pg.items) { const r = itemRect(it); c.fillRect(ox + (r[0] - x0) * k, oy + (r[1] - y0) * k, Math.max(2, (r[2] - r[0]) * k), Math.max(2, (r[3] - r[1]) * k)); }
  c.strokeStyle = '#e8590c'; c.lineWidth = 1.6; c.strokeRect(ox + (vx0 - x0) * k, oy + (vy0 - y0) * k, (vx1 - vx0) * k, (vy1 - vy0) * k);
  mmInfo = { x0, y0, k, ox, oy };
}
function wireMinimap() {
  const mm = $('#minimap'); if (!mm) return;
  const go = (e) => {
    if (!mmInfo) return; const r = mm.getBoundingClientRect();
    const wx = mmInfo.x0 + ((e.clientX - r.left) - mmInfo.ox) / mmInfo.k, wy = mmInfo.y0 + ((e.clientY - r.top) - mmInfo.oy) / mmInfo.k;
    S.view.x = vw / 2 - wx * S.view.s; S.view.y = vh / 2 - wy * S.view.s; mmT = 0; requestFrame(true);
  };
  mm.addEventListener('pointerdown', (e) => { e.stopPropagation(); mm.setPointerCapture(e.pointerId); go(e); mm._d = true; });
  mm.addEventListener('pointermove', (e) => { if (mm._d) go(e); });
  mm.addEventListener('pointerup', () => { mm._d = false; });
}
function drawRuler(c, s) {
  const r = S.ruler; if (!r) return;
  const ps = Math.max(1, 1 / s), L = RL.len, H = RL.hw;
  c.save(); c.translate(r.x, r.y); c.rotate(r.a);
  c.fillStyle = 'rgba(255,205,70,.26)'; c.strokeStyle = 'rgba(176,120,0,.85)'; c.lineWidth = 1.4 * ps;
  c.beginPath(); c.roundRect(-L / 2, -H, L, H * 2, 8); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(120,80,0,.8)'; c.fillStyle = 'rgba(100,66,0,.9)'; c.font = `600 ${10 * ps}px ${FONT}`; c.textAlign = 'center';
  c.beginPath();
  for (let t = -L / 2 + 40, i = 0; t <= L / 2 - 40; t += 10, i++) {
    const long = i % 5 === 0, len = long ? 12 : 6;
    c.moveTo(t, H); c.lineTo(t, H - len); c.moveTo(t, -H); c.lineTo(t, -H + len);
  }
  c.stroke();
  // degree read-out (flipped so it is always upright)
  let deg = ((r.a * 180 / Math.PI) % 180 + 180) % 180;
  c.save(); if (Math.cos(r.a) < 0) c.rotate(Math.PI);
  c.font = `700 ${15 * ps}px ${FONT}`; c.fillStyle = 'rgba(90,60,0,.95)'; c.textBaseline = 'middle';
  c.fillText(deg.toFixed(1) + '°', 0, 0); c.restore();
  // handles
  const hr = 13 * ps;
  c.fillStyle = 'rgba(255,255,255,.9)'; c.strokeStyle = 'rgba(176,120,0,.95)'; c.lineWidth = 1.6 * ps;
  c.beginPath(); c.arc(L / 2 - 26, 0, hr, 0, 6.2832); c.fill(); c.stroke();
  c.beginPath(); c.arc(-L / 2 + 26, 0, hr, 0, 6.2832); c.fill(); c.stroke();
  c.beginPath(); c.arc(L / 2 - 26, 0, hr * 0.5, 0.5, 5.3); c.stroke();
  const x0 = -L / 2 + 26, q = hr * 0.42; c.beginPath(); c.moveTo(x0 - q, -q); c.lineTo(x0 + q, q); c.moveTo(x0 + q, -q); c.lineTo(x0 - q, q); c.stroke();
  c.restore();
}

/* ---------- eraser ---------- */
function eraseAt(wx, wy) {
  const r = S.tools.eraser.s / S.view.s;
  const inf = isInf(S.doc), mode = S.eraserMode;
  S.doc.pages.forEach((pg, pi) => {
    const top = S.layout.ys[pi], lx = wx, ly = wy - top;
    if (!inf && (ly < -r - 30 || ly > pg.h + r + 30)) return;
    for (let k = pg.strokes.length - 1; k >= 0; k--) {
      const st = pg.strokes[k], b = bbox(st), rr = r + st.s / 2;
      if (mode === 'hl' && st.t !== 'hl') continue;
      if (lx < b[0] - rr || lx > b[2] + rr || ly < b[1] - rr || ly > b[3] + rr) continue;
      const p = st.p; let hitIt = false;
      if (p.length === 3) hitIt = (p[0] - lx) ** 2 + (p[1] - ly) ** 2 <= rr * rr;
      for (let i = 0; i + 5 < p.length && !hitIt; i += 3) hitIt = segDist2(lx, ly, p[i], p[i + 1], p[i + 3], p[i + 4]) <= rr * rr;
      if (!hitIt) continue;
      let news = [];
      if (mode === 'area' && !st.sh) news = cutStroke(st, lx, ly, r * 0.8 + st.s / 2);
      pg.strokes.splice(k, 1, ...news);
      news.forEach((n) => bbCache.delete(n));
      S.act.edits.push({ pg, o: st, i: k, news });
      ghost(st, pi);
      baseDirty = true;
    }
  });
}
// area eraser: split a stroke where the eraser circle passes over it
function cutStroke(st, cx, cy, rr) {
  const p = st.p, step = Math.max(2, rr * 0.5), pts = [];
  for (let i = 0; i < p.length; i += 3) {
    if (i) {
      const d = Math.hypot(p[i] - p[i - 3], p[i + 1] - p[i - 2]), n = Math.floor(d / step);
      for (let q = 1; q <= n; q++) { const t = q / (n + 1); pts.push([p[i - 3] + (p[i] - p[i - 3]) * t, p[i - 2] + (p[i + 1] - p[i - 2]) * t, p[i - 1] + (p[i + 2] - p[i - 1]) * t]); }
    }
    pts.push([p[i], p[i + 1], p[i + 2]]);
  }
  const out = []; let cur = [];
  const flush = () => { if (cur.length) { if (cur.length === 1) cur.push(cur[0]); out.push({ ...st, p: cur.flat() }); } cur = []; };
  for (const q of pts) { if ((q[0] - cx) ** 2 + (q[1] - cy) ** 2 <= rr * rr) flush(); else cur.push(q); }
  flush();
  return out;
}

function scribbleErase(a) {
  const p = a.st.p, n = p.length / 3; if (n < 14 || a.st.t === 'hl') return false;
  let len = 0, rev = 0, pa = null;
  const P = [];
  for (let i = 0; i < n; i++) { const q = [p[3 * i], p[3 * i + 1]]; if (!P.length || dist2p(q, P[P.length - 1]) > 5) P.push(q); }
  for (let i = 1; i < P.length; i++) {
    len += dist2p(P[i], P[i - 1]);
    const ang = Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0]);
    if (pa !== null) { let d = Math.abs(ang - pa); if (d > Math.PI) d = 2 * Math.PI - d; if (d > 2.2) rev++; }
    pa = ang;
  }
  const b = bbox(a.st), m = a.st.s * 1.6, w = b[2] - b[0] - 2 * m, hh = b[3] - b[1] - 2 * m, diag = Math.hypot(w, hh);
  if (rev < 4 || diag < 18 || diag > 260 || len < diag * 4.5) return false;
  const pg = S.doc.pages[a.pi], box = [b[0] + m - 4, b[1] + m - 4, b[2] - m + 4, b[3] - m + 4];
  const gone = [];
  for (const st of pg.strokes) {
    const q = st.p, k = Math.max(1, Math.floor(q.length / 3 / 30)); let inn = 0, tot = 0;
    for (let i = 0; i < q.length; i += 3 * k) { tot++; if (q[i] >= box[0] && q[i] <= box[2] && q[i + 1] >= box[1] && q[i + 1] <= box[3]) inn++; }
    if (tot && inn / tot >= 0.3) gone.push({ pg, o: st });
  }
  if (!gone.length) return false;
  gone.forEach((g) => ghost(g.o, a.pi));
  actRemoveObjs(gone); buzz(14); toast('Scribbled out. Undo brings it back.', 1500);
  return true;
}
function cancelAct() {
  const a = S.act;
  if (a) clearTimeout(a.hold);
  if (a && a.kind === 'erase' && a.edits.length) finishAct();
  else if (a && a.kind === 'selmove') { S.sel.dx = S.sel.dy = 0; }
  else if (a && a.kind === 'rot') { setRotState(a.sn); }
  else if (a && a.kind === 'resize') { if (a.mode === 'w') a.o.w = a.from; else applyScale(a.sn, 1, a.ax, a.ay); boundsOfSel(); }
  S.act = null; requestFrame(true);
}
function finishAct() {
  const a = S.act; S.act = null;
  if (!a) return;
  clearTimeout(a.hold);
  if (a.kind === 'laser') { flushLaser(); requestFrame(); return; }
  if (a.kind === 'ink') {
    if (a.snap && !a.snap.done) { a.st.p = a.snap.finalPts.flatMap((q) => [q[0], q[1], 0.5]); a.snap.done = true; }
    if (a.st.p.length === 3) a.st.p.push(a.st.p[0], a.st.p[1], a.st.p[2]);
    bbCache.delete(a.st);
    if (S.scribble && !a.snap && scribbleErase(a)) return;
    actAddObjs(S.doc.pages[a.pi], [a.st]);
  } else if (a.kind === 'shape') {
    if (Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]) > 4) actAddObjs(S.doc.pages[a.pi], [a.st]);
  } else if (a.kind === 'erase') {
    const rec = a.edits;
    if (rec.length) {
      commit({
        undo() { for (let k = rec.length - 1; k >= 0; k--) { const r = rec[k]; r.news.forEach((n) => { const i = r.pg.strokes.indexOf(n); if (i >= 0) r.pg.strokes.splice(i, 1); }); r.pg.strokes.splice(Math.min(r.i, r.pg.strokes.length), 0, r.o); } },
        redo() { for (const r of rec) { const i = r.pg.strokes.indexOf(r.o); if (i >= 0) r.pg.strokes.splice(i, 1, ...r.news); } },
      });
    }
  } else if (a.kind === 'comment') {
    if (!a.moved) {
      const hh = hitItem(a.wx, a.wy);
      if (hh && hh.o.k === 'comment') openComment(hh, false); else newCommentAt(a.wx, a.wy);
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
  } else if (a.kind === 'rot') {
    if (Math.abs(a.d) > 0.01) {
      const before = a.sn, after = rotState();
      commit({ undo() { setRotState(before); }, redo() { setRotState(after); } });
    }
    boundsOfSel();
  } else if (a.kind === 'resize') {
    if (a.mode === 'w') {
      const o = a.o, from = a.from, to = o.w;
      if (Math.abs(to - from) > 0.5) commit({ undo() { o.w = from; }, redo() { o.w = to; } });
    } else if (Math.abs(a.k - 1) > 0.01) {
      const snap = a.sn, k = a.k, ax = a.ax, ay = a.ay;
      commit({ undo() { applyScale(snap, 1, ax, ay); }, redo() { applyScale(snap, k, ax, ay); } });
    }
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
  try { await db.saveDoc(d, meta); } catch (e) { console.error(e); toast('Could not save. Storage may be full.'); return; }
  try { if (syncBc) syncBc.postMessage({ id: d.id, from: SELF }); } catch {}
}
const SELF = uid();
const syncBc = 'BroadcastChannel' in window ? new BroadcastChannel('anota-sync') : null;
if (syncBc) syncBc.onmessage = async (e) => {
  const m = e.data || {}; if (!m.id || m.from === SELF) return;
  for (const T of S.tabs) if (T.id === m.id && T !== S.tab) T.loaded = false;
  if (!S.doc || S.doc.id !== m.id) return;
  if (S.act || editor || cpop) { setTimeout(() => syncBc.onmessage(e), 700); return; }
  const d = await db.getDoc(m.id); if (!d || !S.doc || S.doc.id !== m.id) return;
  Object.assign(S.doc, d); relayout(); S.hist = { u: [], r: [] }; if (S.tab) S.tab.hist = S.hist;
  clearSel(); updateUR(); clampView(); requestFrame(true);
};
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
          h('div', { class: 'ftab' }), m.emoji ? h('div', { class: 'femoji' }, m.emoji) : null,
          h('div', { class: 'fgrid' }, [0, 1, 2, 3].map((k) => (docs[k] && docs[k].thumb ? h('img', { src: docs[k].thumb, alt: '', draggable: false }) : h('span', { class: docs[k] ? 'ph' : '' }))))),
        h('button', { class: 'more', 'aria-label': 'Folder options', onclick: (e) => { e.stopPropagation(); cardMenu(m); } }, icon('more', 20)),
        h('div', { class: 'card-title' }, m.title),
        h('div', { class: 'card-sub' }, kids.length === 1 ? '1 item' : `${kids.length} items`)));
      return;
    }
    const label = { notebook: 'NOTEBOOK', whiteboard: 'BOARD', pdf: 'PDF' }[m.type];
    const inFolder = (L.q || L.filter !== 'all') && m.parent && byId(m.parent);
    const cardEl = h('div', { class: 'card', role: 'button', tabindex: 0, style: sty, onclick: () => { if (cardEl._swallow) return; openDoc(m.id); } },
      h('div', { class: 'thumb' + (m.type === 'whiteboard' ? ' board' : '') },
        m.thumb ? h('img', { src: m.thumb, alt: '', draggable: false }) : icon(m.type === 'whiteboard' ? 'board' : m.type === 'pdf' ? 'pdf' : 'book', 40)),
      h('span', { class: 'badge' }, label),
      h('button', { class: 'more', 'aria-label': 'Options', onclick: (e) => { e.stopPropagation(); cardMenu(m); } }, icon('more', 20)),
      h('div', { class: 'card-title' }, m.title),
      h('div', { class: 'card-sub' }, (inFolder ? byId(m.parent).title + ' · ' : '') + `${m.type === 'whiteboard' ? 'Infinite canvas' : m.pages + (m.pages === 1 ? ' page' : ' pages')} · ${fmtDate(m.updated)}`));
    dragToSplit(cardEl, () => ({ id: m.id, title: m.title, type: m.type }), { delay: 480 });
    g.append(cardEl);
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
    !PANE && !isFolder(m) && mi('split', 'Open in split screen', () => { close(); openSplit(m.id); }),
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
    [['book', 'New notebook', () => newDialog('notebook')], ['board', 'New whiteboard', () => newDialog('whiteboard')], ['pdf', 'Import PDF / Word', () => $('#file').click()], ['folderPlus', 'New folder', () => folderDialog()], ['bolt', 'Quick note', quickNote]]
      .forEach(([ic, t, fn], i) => m.append(h('button', { class: 'fabitem', style: `animation-delay:${(3 - i) * 40}ms`, onclick: () => { toggleFab(false); fn(); } }, h('span', { class: 'ico' }, icon(ic, 20)), t)));
  }
}
async function quickNote() {
  const d = new Date(), t = 'Quick note ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const doc = makeDoc({ type: 'notebook', title: t, paper: { style: 'blank', color: 'white' } });
  await db.saveDoc(doc, { id: doc.id, title: doc.title, type: 'notebook', updated: doc.updated, pages: 1, thumb: null, parent: null });
  await refreshLibrary(); openDoc(doc.id);
}
function folderDialog() {
  let color = FOLDER_COLORS[0], emoji = '';
  const name = h('input', { class: 'field', value: 'New folder', maxlength: 60 });
  const eRow = h('div', { class: 'emojirow' });
  const paintE = () => { eRow.innerHTML = ''; ['', '📚', '🎓', '🧪', '💼', '🏠', '✈️', '🎨', '🎵', '💡', '⭐', '❤️', '🔥', '🌱', '🧠', '📅'].forEach((e) => eRow.append(h('button', { type: 'button', class: 'em' + (e === emoji ? ' on' : ''), onclick: () => { emoji = e; paintE(); } }, e || '∅'))); };
  paintE();
  const row = h('div', { class: 'swatches' });
  const paint = () => { row.innerHTML = ''; FOLDER_COLORS.forEach((c) => row.append(h('button', { class: 'sw' + (c === color ? ' on' : ''), style: `background:${c}`, 'aria-label': c, onclick: () => { color = c; paint(); } }))); };
  paint();
  modal({ title: 'New folder', body: [h('div', { class: 'lbl' }, 'Name'), name, h('div', { class: 'lbl' }, 'Colour'), row, h('div', { class: 'lbl' }, 'Icon'), eRow], actions: [
    { label: 'Cancel' },
    { label: 'Create', kind: 'primary', fn: async () => {
      const f = { id: uid(), type: 'folder', title: name.value.trim() || 'Folder', updated: Date.now(), parent: L.folder, color, emoji };
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
  if (style === 'cornell') bgi = `linear-gradient(90deg,transparent 28%,${ln} 28% 30%,transparent 30%),repeating-linear-gradient(to bottom,transparent 0 9px,${ln} 9px 10px)`;
  if (style === 'music') bgi = `repeating-linear-gradient(to bottom,transparent 0 3px,${ln} 3px 4px,transparent 4px 14px)`;
  if (style === 'dots') bgi = `radial-gradient(${ln} 1.4px,transparent 1.6px)`;
  const sz = style === 'grid' || style === 'dots' ? 'background-size:10px 10px' : '';
  return h('div', { class: 'pv', style: `background-color:${bg};background-image:${bgi};${sz}` });
}
function paperPicker(initial, styles, withName) {
  const st = { style: initial.style, color: initial.color, sp: initial.sp || 0, lc: initial.lc || '' };
  const spRow = h('div', { class: 'segs mini' }), lcRow = h('div', { class: 'swatches small' });
  const sRow = h('div', { class: 'opts' }), cRow = h('div', { class: 'opts three' });
  const colors = [['white', 'White'], ['cream', 'Cream'], ['dark', 'Dark']];
  const paint = () => {
    sRow.innerHTML = ''; cRow.innerHTML = '';
    styles.forEach(([k, l]) => sRow.append(h('button', { class: 'opt' + (st.style === k ? ' on' : ''), onclick: () => { st.style = k; paint(); } }, paperPreview(k, st.color), l)));
    colors.forEach(([k, l]) => cRow.append(h('button', { class: 'opt' + (st.color === k ? ' on' : ''), onclick: () => { st.color = k; paint(); } }, h('div', { class: 'pv', style: `background:${PAPER[k]}` }), l)));
    spRow.innerHTML = ''; lcRow.innerHTML = '';
    [[0, 'Default'], [24, 'Tight'], [44, 'Wide'], [60, 'Extra wide']].forEach(([v, l]) => spRow.append(h('button', { class: 'seg' + (st.sp === v ? ' on' : ''), onclick: () => { st.sp = v; paint(); } }, l)));
    lcRow.append(h('button', { class: 'sw' + (!st.lc ? ' on' : ''), style: 'background:linear-gradient(135deg,#fff 45%,#bbb 45%)', 'aria-label': 'Default lines', onclick: () => { st.lc = ''; paint(); } }));
    ['#3b5bdb', '#12b886', '#e8590c', '#7048e8', '#868e96'].forEach((c) => lcRow.append(h('button', { class: 'sw' + (st.lc === c ? ' on' : ''), style: `background:${c}`, 'aria-label': c, onclick: () => { st.lc = c; paint(); } })));
    lcRow.append(h('div', { class: 'sw custom' }, h('input', { type: 'color', value: st.lc || '#3b5bdb', onchange: (e) => { st.lc = e.target.value; paint(); } })));
  };
  paint();
  return { st, nodes: [h('div', { class: 'lbl' }, 'Paper'), sRow, h('div', { class: 'lbl' }, 'Line spacing'), spRow, h('div', { class: 'lbl' }, 'Line colour'), lcRow, h('div', { class: 'lbl' }, 'Colour'), cRow] };
}
function newDialog(type) {
  const styles = type === 'whiteboard' ? [['dots', 'Dots'], ['grid', 'Grid'], ['blank', 'Blank']] : [['ruled', 'Ruled'], ['grid', 'Grid'], ['dots', 'Dots'], ['cornell', 'Cornell'], ['music', 'Music'], ['blank', 'Blank']];
  const title = h('input', { class: 'field', value: type === 'notebook' ? 'Untitled notebook' : 'Whiteboard', maxlength: 80 });
  const pk = paperPicker({ style: type === 'whiteboard' ? 'dots' : 'ruled', color: 'white' }, styles);
  modal({ title: type === 'notebook' ? 'New notebook' : 'New whiteboard', body: [h('div', { class: 'lbl' }, 'Name'), title, ...pk.nodes], actions: [
    { label: 'Cancel' },
    { label: 'Create', kind: 'primary', fn: async () => {
      const doc = makeDoc({ type, title: title.value.trim() || 'Untitled', paper: { style: pk.st.style, color: pk.st.color, sp: pk.st.sp, lc: pk.st.lc } });
      await db.saveDoc(doc, { id: doc.id, title: doc.title, type, updated: doc.updated, pages: 1, thumb: null, parent: L.folder });
      await refreshLibrary(); openDoc(doc.id);
    } }] });
}
async function importDocx(file) {
  toast('Converting Word document…', 60000);
  try {
    const { docxToPdf } = await import('./docx.js');
    const pdf = await docxToPdf(file);
    await importPdf(new File([pdf], file.name.replace(/\.docx$/i, '') + '.pdf', { type: 'application/pdf' }));
  } catch (e) { console.error(e); toast('That Word file could not be converted'); }
}
function importDocument(file) {
  if (/\.docx$/i.test(file.name) || /wordprocessingml/.test(file.type)) importDocx(file);
  else if (/\.doc$/i.test(file.name)) toast('Old .doc files are not supported. In Word, use Save As > .docx first.', 4200);
  else importPdf(file);
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
    const tabEl = h('div', { class: 'tab' + (on ? ' on' : '') + (t.isNew ? ' fresh' : ''), role: 'button', tabindex: 0, 'data-id': t.id, onclick: () => { if (tabEl._swallow) return; switchTo(t.id); } },
      icon(t.type === 'whiteboard' ? 'board' : t.type === 'pdf' ? 'pdf' : 'book', 17),
      h('span', { class: 'tlabel' }, t.title),
      h('button', { class: 'tx', 'aria-label': 'Close ' + t.title, onclick: (e) => { e.stopPropagation(); closeTab(t.id); } }, icon('x', 14, 2.4)));
    dragToSplit(tabEl, () => ({ id: t.id, title: t.title, type: t.type }), { onHold: () => tabMenu(t) });
    tabEl.addEventListener('contextmenu', (e) => { e.preventDefault(); });
    el.append(tabEl);
    t.isNew = false;
  }
  el.append(h('button', { class: 'tab add', 'aria-label': 'Open another note', onclick: () => switchTo(null) }, icon('plus', 18, 2.2)));
  el.append(h('span', { class: 'grow' }),
    h('button', { class: 'tab split' + (panes.length ? ' on' : ''), 'aria-label': PANE ? 'Close this split pane' : 'Split screen', title: PANE ? 'Close this split pane' : 'Split screen', onclick: toggleSplit }, icon(PANE ? 'x' : 'split', 19, 2.1), h('span', { class: 'tlabel' }, PANE ? 'Close' : panes.length ? 'Split ' + (panes.length + 1) : 'Split')));
  const act = el.querySelector('.tab.on'); if (act && act.scrollIntoView) act.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}
function tabMenu(t) {
  const close = modal({ title: t.title, body: [
    PANE ? null : mi('split', 'Open in split screen', () => { close(); openSplit(t.id); }),
    mi('x', 'Close tab', () => { close(); closeTab(t.id); }, true)], actions: [{ label: 'Cancel' }] });
}
/* ---- split screen: up to three full Anotas side by side, sharing the same notes ---- */
const MAX_PANES = 2;                       // extra panes beside the main one (3 screens in total)
const panes = [];                          // { wrap, frame, div }
let splitFr = prefs.get('splitFr', [1, 1, 1]);
const isPortrait = () => matchMedia('(orientation:portrait)').matches;
function applyFractions() {
  document.body.classList.toggle('split', panes.length > 0);
  const items = [$('#main'), ...panes.map((p) => p.wrap)];
  items.forEach((el, i) => { el.style.flex = `${splitFr[i] || 1} 1 0%`; });
  setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
}
function makePane(id) {
  const frame = h('iframe', { title: 'Split screen ' + (panes.length + 2), allow: 'microphone' });
  const wrap = h('aside', { class: 'pane-wrap' }, frame);
  const div = h('div', { class: 'divider', role: 'separator', 'aria-label': 'Resize screens' }, h('i'));
  const P = { wrap, frame, div };
  frame.src = './?pane=1' + (id ? '&open=' + encodeURIComponent(id) : '');
  $('#wrap').append(div, wrap);
  wireDivider(P);
  return P;
}
function wireDivider(P) {
  const dv = P.div;
  let st = null;
  dv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); try { dv.setPointerCapture(e.pointerId); } catch {}
    const k = panes.indexOf(P), items = [$('#main'), ...panes.map((p) => p.wrap)], port = isPortrait();
    const a = items[k].getBoundingClientRect(), b = items[k + 1].getBoundingClientRect();
    st = { k, port, start: port ? a.top : a.left, total: port ? a.height + b.height : a.width + b.width };
    document.body.classList.add('dragging');
  });
  dv.addEventListener('pointermove', (e) => {
    if (!st) return;
    const pos = st.port ? e.clientY : e.clientX, minPx = 170;
    const left = clamp(pos - st.start, minPx, st.total - minPx), sum = (splitFr[st.k] || 1) + (splitFr[st.k + 1] || 1);
    splitFr[st.k] = sum * left / st.total; splitFr[st.k + 1] = sum - splitFr[st.k];
    applyFractions();
  });
  const end = () => { if (st) { st = null; document.body.classList.remove('dragging'); prefs.set('splitFr', splitFr); } };
  dv.addEventListener('pointerup', end); dv.addEventListener('pointercancel', end);
  dv.addEventListener('dblclick', () => { splitFr = [1, 1, 1]; prefs.set('splitFr', splitFr); applyFractions(); });
}
function openSplit(id, replaceIdx) {
  if (PANE) return;
  if (replaceIdx != null && panes[replaceIdx]) {
    try { panes[replaceIdx].frame.contentWindow.postMessage({ anota: 'open', id }, location.origin); } catch {}
    return;
  }
  if (panes.length >= MAX_PANES) {
    const last = panes[panes.length - 1];
    if (id) { try { last.frame.contentWindow.postMessage({ anota: 'open', id }, location.origin); } catch {} }
    else toast('You can have up to three screens');
    return;
  }
  panes.push(makePane(id));
  splitFr = [1, 1, 1]; applyFractions(); renderTabs();
}
function closePane(i) {
  const P = panes[i]; if (!P) return;
  P.frame.src = 'about:blank'; P.div.remove(); P.wrap.remove(); panes.splice(i, 1);
  splitFr = [1, 1, 1]; applyFractions(); renderTabs();
}
function closeAllPanes() { while (panes.length) closePane(panes.length - 1); }
function toggleSplit() {
  if (PANE) { try { parent.postMessage({ anota: 'closeSplit' }, location.origin); } catch {} return; }
  if (!panes.length) { openSplit(null); return; }
  const close = modal({ title: 'Split screen', body: [
    panes.length < MAX_PANES ? mi('plus', 'Add another screen', () => { close(); openSplit(null); }) : null,
    mi('x', panes.length > 1 ? 'Close all split screens' : 'Close split screen', () => { close(); closeAllPanes(); }, true)], actions: [{ label: 'Cancel' }] });
}

/* ---- drag a tab or a note onto the screen edge to open it side by side ---- */
function dragToSplit(el, info, opts = {}) {
  if (PANE) return;
  let timer = null, ready = false, drag = null, sx = 0, sy = 0;
  const zonesFor = () => {
    const W = innerWidth, H = innerHeight, port = isPortrait(), zs = [];
    panes.forEach((P, i) => { const r = P.wrap.getBoundingClientRect(); zs.push({ kind: 'replace', idx: i, r, label: 'Open here' }); });
    if (panes.length < MAX_PANES) zs.unshift({ kind: 'add', r: port ? { left: 0, top: H * 0.72, width: W, height: H * 0.28 } : { left: W * 0.74, top: 0, width: W * 0.26, height: H }, label: 'Drop to open beside' });
    return zs;
  };
  const inR = (r, x, y) => x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;
  const begin = (e) => {
    const layer = h('div', { class: 'dropzones' }), ghost = h('div', { class: 'dragghost' }, icon(info().type === 'whiteboard' ? 'board' : info().type === 'pdf' ? 'pdf' : 'book', 18), info().title);
    const zs = zonesFor().map((z) => ({ ...z, el: h('div', { class: 'dz', style: `left:${z.r.left}px;top:${z.r.top}px;width:${z.r.width}px;height:${z.r.height}px` }, h('span', {}, z.label)) }));
    zs.forEach((z) => layer.append(z.el));
    document.body.append(layer, ghost);
    drag = { layer, ghost, zs };
    document.body.classList.add('dragging');
  };
  const move = (x, y) => {
    if (!drag) return;
    drag.ghost.style.transform = `translate(${x + 12}px,${y + 12}px)`;
    drag.hit = drag.zs.find((z) => inR(z.r, x, y)) || null;
    drag.zs.forEach((z) => z.el.classList.toggle('hot', z === drag.hit));
  };
  const finish = (cancel) => {
    clearTimeout(timer);
    const d = drag, wasReady = ready; drag = null; ready = false;
    document.body.classList.remove('dragging');
    if (d) {
      d.layer.remove(); d.ghost.remove();
      if (!cancel && d.hit) { el._swallow = true; setTimeout(() => (el._swallow = false), 400); openSplit(info().id, d.hit.kind === 'replace' ? d.hit.idx : null); return; }
      el._swallow = true; setTimeout(() => (el._swallow = false), 400);
    } else if (wasReady && !cancel && opts.onHold) { el._swallow = true; setTimeout(() => (el._swallow = false), 400); opts.onHold(); }
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.tx,.more')) return;
    sx = e.clientX; sy = e.clientY; ready = false;
    clearTimeout(timer);
    const pid = e.pointerId;
    timer = setTimeout(() => { ready = true; buzz(18); el.classList.add('lifted'); try { el.setPointerCapture(pid); } catch {} }, opts.delay || 420);
  });
  el.addEventListener('pointermove', (e) => {
    if (!ready && !drag) { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clearTimeout(timer); return; }
    if (ready && !drag && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) { try { el.setPointerCapture(e.pointerId); } catch {} begin(e); }
    move(e.clientX, e.clientY);
  });
  el.addEventListener('touchmove', (e) => { if (ready || drag) e.preventDefault(); }, { passive: false });
  el.addEventListener('contextmenu', (e) => { if (ready || drag) e.preventDefault(); });
  el.addEventListener('pointerup', () => { el.classList.remove('lifted'); finish(false); });
  el.addEventListener('pointercancel', () => { el.classList.remove('lifted'); finish(true); });
}
function persistTabs() { if (PANE) return; prefs.set('tabs', S.tabs.map((t) => t.id)); prefs.set('activeTab', S.tab ? S.tab.id : null); }

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
  commitEditor(); closeComment(); closePop(); closeMenu(); $("#sheet").hidden = true; clearSel(); exitPresent(); closeZoom(); stopVideo();
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
  if (!PANE && (!history.state || !history.state.editor)) history.pushState({ editor: T.id }, '');
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
const TOOLS = [['pen', 'Pen'], ['hl', 'Highlighter'], ['eraser', 'Eraser'], ['lasso', 'Select'], ['shape', 'Shapes'], ['text', 'Text'], ['insert', 'Insert'], ['laser', 'Laser'], ['hand', 'Move']];
const toolLabel = (k) => (TOOLS.find((t) => t[0] === k) || [k, k])[1];
const popTools = ['pen', 'hl', 'eraser', 'shape', 'text', 'insert', 'laser'];

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
  d.append(h('button', { class: 'qs-btn', id: 'qsBtn', 'aria-label': 'Quick brush size', title: 'Quick brush size', onclick: () => { if ($('#pop').dataset.kind === 'qsize' && popOpen) closePop(); else openQuick(); } }, h('i', { id: 'qsDot' })));
  syncDock();
}
const sizeRange = (k) => k === 'laser' ? [0.4, 4, 0.1] : (k === 'hl' || k === 'eraser') ? [6, 44, 1] : k === 'text' ? [12, 80, 1] : k === 'shape' ? [1, 14, 0.5] : PEN[S.penType].range;
function curTool() {
  if (S.tool === 'pen') return S.tools[S.penType];
  return S.tools[S.tool] || null;
}
function setTool(k) {
  if (S.tool !== k && k !== 'eraser') S.prevTool = null;
  commitEditor(); closeComment();
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
  const noSize = ['hand', 'lasso', 'insert', 'comment'].includes(S.tool);
  sw.style.visibility = ['hand', 'lasso', 'insert', 'comment'].includes(S.tool) ? 'hidden' : 'visible';
  if (S.tool === 'laser') sw.style.background = S.laserC;
  const qs = $('#qsBtn'), dot = $('#qsDot');
  if (qs && dot) {
    qs.style.display = noSize || !t || t.s == null ? 'none' : '';
    if (t && t.s != null) {
      const [mn, mx] = sizeRange(S.tool), px = 4 + clamp((t.s - mn) / (mx - mn), 0, 1) * 20;
      dot.style.cssText = `width:${px}px;height:${px}px;background:${S.tool === 'eraser' ? '#e03131' : t.c || 'currentColor'}`;
    }
  }
  cv.style.cursor = S.tool === 'hand' ? 'grab' : S.tool === 'text' ? 'text' : S.tool === 'laser' ? 'none' : 'crosshair';
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
function closePop() { const p = $('#pop'); p.hidden = true; p.classList.remove('qpop'); popOpen = false; }
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
  if (k === 'laser') {
    pop.append(h('h4', {}, 'Laser pointer'));
    const row = h('div', { class: 'swatches' });
    ['#ff2d2d', '#12b886', '#228be6', '#fab005', '#be4bdb'].forEach((c) => row.append(h('button', { class: 'sw' + (S.laserC === c ? ' on' : ''), style: `background:${c}`, 'aria-label': c, onclick: () => { S.laserC = c; prefs.set('laserC', c); syncDock(); openPop('laser'); } })));
    pop.append(row, h('div', { class: 'lbl' }, 'Trail length'),
      h('div', { class: 'segs' }, [[700, 'Short'], [1400, 'Medium'], [2600, 'Long']].map(([v, l]) => h('button', { class: 'seg' + (S.laserMs === v ? ' on' : ''), onclick: () => { S.laserMs = v; prefs.set('laserMs', v); openPop('laser'); } }, l))),
      h('div', { class: 'sizerow' }, h('span', { class: 'rl' }, 'Size'),
        h('input', { type: 'range', min: 0.4, max: 4, step: 0.1, value: S.tools.laser.s, 'aria-label': 'Laser size', oninput: (e) => { S.tools.laser.s = +e.target.value; savePrefs(); syncDock(); requestFrame(); } })),
      h('p', { class: 'note' }, 'Draw to point things out. Nothing is saved; the trail fades away.'));
    return;
  }
  if (k === 'insert') {
    pop.append(h('div', { class: 'insgrid' },
      insBtn('image', 'Image', () => { closePop(); $('#imgfile').click(); }),
      insBtn('camera', 'Photo', () => { closePop(); $('#camfile').click(); }),
      insBtn('text', 'Text box', () => { closePop(); setTool('text'); toast('Tap the page to add text'); }),
      insBtn('link', 'Link', () => { closePop(); linkDialog(); }),
      insBtn('present', 'Video', () => { closePop(); videoDialog(); }),
      insBtn('jump', 'Jump', () => { closePop(); jumpDialog(); }),
      insBtn('comment', 'Comment', () => { closePop(); S.cmtPrev = S.tool; setTool('comment'); toast('Tap anywhere to leave a comment'); }),
      insBtn('search', S.zw ? 'Close zoom' : 'Zoom', () => { closePop(); openZoom(); }),
      insBtn('ruler', S.ruler ? 'Hide ruler' : 'Ruler', () => { closePop(); if (S.ruler) S.ruler = null; else { const cc = viewCentre(); const [wx, wy] = toWorld(vw / 2, vh / 2); S.ruler = { x: wx, y: wy, a: 0 }; toast('Draw along the edge for straight lines. Drag the ruler to move it.', 2800); } requestFrame(); }),
      insBtn('bookmark', 'Elements', () => { closePop(); elementsDialog(); }),
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
    pop.append(h('div', { class: 'segs shapes' }, SHAPES.map((n) => h('button', { class: 'seg' + (S.shape === n ? ' on' : ''), 'aria-label': n, onclick: () => { S.shape = n; prefs.set('shape', n); openPop('shape'); } }, icon(n, 22)))),
      h('div', { class: 'segs' }, [[false, 'Outline'], [true, 'Filled']].map(([v, l]) => h('button', { class: 'seg' + (S.shapeFill === v ? ' on' : ''), onclick: () => { S.shapeFill = v; prefs.set('shapeFill', v); openPop('shape'); } }, l))));
  }
  if (k === 'eraser') {
    pop.append(h('div', { class: 'lbl' }, 'Mode'),
      h('div', { class: 'segs' }, [['stroke', 'Stroke'], ['area', 'Area'], ['hl', 'Highlighter']].map(([v, l]) => h('button', { class: 'seg' + (S.eraserMode === v ? ' on' : ''), onclick: () => { S.eraserMode = v; prefs.set('eraserMode', v); openPop('eraser'); } }, l))),
      h('p', { class: 'note' }, S.eraserMode === 'stroke' ? 'Removes whole strokes you touch.' : S.eraserMode === 'area' ? 'Rubs out only the part under the eraser.' : 'Only erases highlighter, your pen ink stays.'));
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


/* ---- laser pointer ---- */
const hexRgb = (hex) => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(hex) || [0, 'ff', '2d', '2d']; return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`; };
const LR = [];   // raw samples of the stroke in progress
function emitSpline(p0, p1, p2, p3) {
  const d = Math.hypot(p2.x - p1.x, p2.y - p1.y), n = clamp(Math.ceil(d * S.view.s / 3), 1, 28);
  for (let i = 1; i <= n; i++) {
    const t = i / n, t2 = t * t, t3 = t2 * t;
    const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    S.laser.push({ x, y, t: p1.t + (p2.t - p1.t) * t, b: false });
  }
  if (S.laser.length > 1500) S.laser.splice(0, S.laser.length - 1500);
}
function pushLaser(wx, wy, brk) {
  const t = now();
  S.laserRaw = { x: wx, y: wy, t };
  if (brk) { LR.length = 0; S.laser.push({ x: wx, y: wy, t, b: true }); }
  const last = LR[LR.length - 1];
  if (last && Math.hypot(wx - last.x, wy - last.y) * S.view.s < 0.8) return;
  LR.push({ x: wx, y: wy, t });
  const n = LR.length;
  if (n >= 3) emitSpline(LR[n - 4] || LR[n - 3], LR[n - 3], LR[n - 2], LR[n - 1]);
  if (n > 4) LR.shift();
}
function flushLaser() {
  const n = LR.length;
  if (n >= 2) emitSpline(LR[n - 3] || LR[n - 2], LR[n - 2], LR[n - 1], LR[n - 1]);
  LR.length = 0;
}
let laserLayer = null;
function drawLaser(c, s) {
  const t = now(), L = S.laser, ms = S.laserMs, rgb = hexRgb(S.laserC), z = (S.tools.laser && S.tools.laser.s) || 1;
  while (L.length && t - L[0].t > ms) L.shift();
  const active = S.act && S.act.kind === 'laser';
  const pts = L.filter((q, i) => i && !q.b && 1 - (t - q.t) / ms > 0);
  if (pts.length) {
    // each layer is drawn opaque into an offscreen canvas and composited once, so soft joints never show
    if (!laserLayer) laserLayer = document.createElement('canvas');
    if (laserLayer.width !== c.canvas.width || laserLayer.height !== c.canvas.height) { laserLayer.width = c.canvas.width; laserLayer.height = c.canvas.height; }
    const g = laserLayer.getContext('2d');
    const layers = [[`rgb(${rgb})`, 0.26, 15, 5], [`rgb(${rgb})`, 0.85, 4.5, 1.4], ['#fff', 0.95, 1.7, 0.6]];
    for (const [col, alpha, wa, wb] of layers) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, laserLayer.width, laserLayer.height);
      g.setTransform(c.getTransform()); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col;
      for (let i = 1; i < L.length; i++) {
        if (L[i].b) continue;
        const k = 1 - (t - L[i].t) / ms; if (k <= 0) continue;
        g.lineWidth = (wa * k + wb) * z / s;
        g.beginPath(); g.moveTo(L[i - 1].x, L[i - 1].y); g.lineTo(L[i].x, L[i].y); g.stroke();
      }
      if (active && S.laserRaw && L.length && !L[L.length - 1].b) { g.lineWidth = (wa + wb) * z / s; g.beginPath(); g.moveTo(L[L.length - 1].x, L[L.length - 1].y); g.lineTo(S.laserRaw.x, S.laserRaw.y); g.stroke(); }
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = alpha; c.drawImage(laserLayer, 0, 0); c.restore();
    }
  }
  let head = null;
  if (active && S.laserRaw) head = S.laserRaw;
  else if (S.tool === 'laser' && S.hover) { const [hx, hy] = toWorld(S.hover.x, S.hover.y); head = { x: hx, y: hy }; }
  if (head) {
    const R = 24 * z / s, g = c.createRadialGradient(head.x, head.y, 0, head.x, head.y, R);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.16, `rgba(${rgb},.95)`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.save(); c.fillStyle = g; c.beginPath(); c.arc(head.x, head.y, R, 0, 6.2832); c.fill(); c.restore();
  }
}
function drawPulse(c, s) {
  const p = S.pulse, k = (now() - p.t0) / 1500;
  if (k >= 1) { S.pulse = null; return; }
  if (k < 0) return;
  const top = S.layout.ys[p.pi] || 0;
  c.save();
  for (let i = 0; i < 3; i++) {
    const kk = k * 1.6 - i * 0.28; if (kk <= 0 || kk >= 1) continue;
    c.strokeStyle = `rgba(18,160,120,${0.85 * (1 - kk)})`; c.lineWidth = 3.5 / s;
    c.beginPath(); c.arc(p.x, top + p.y, (12 + 80 * kk) / s, 0, 6.2832); c.stroke();
  }
  c.fillStyle = `rgba(18,160,120,${0.9 * (1 - k)})`; c.beginPath(); c.arc(p.x, top + p.y, 5 / s, 0, 6.2832); c.fill();
  c.restore();
}

/* ---- jump buttons ---- */
function focusPoint(t) {
  const n = S.doc.pages.length, pi = clamp(t.pg || 0, 0, n - 1), top = S.layout.ys[pi], inf = isInf(S.doc);
  const keep = S.view, to = { ...S.view };
  to.s = inf ? (t.s || to.s) : fitScale() * (t.rs || 1);
  S.view = to;
  to.x = vw / 2 - t.x * to.s; to.y = (inf ? vh / 2 : vh * 0.4) - (top + t.y) * to.s;
  clampView(); const fin = { ...S.view }; S.view = keep;
  animateView(fin, 380);
  S.pulse = { pi, x: t.x, y: t.y, t0: now() + 260 };
  requestFrame();
}
async function goTarget(t) {
  if (!t) return toast('This button has no destination yet');
  if (t.doc && (!S.tab || S.tab.id !== t.doc)) {
    const m = byId(t.doc) || (await db.getMeta(t.doc));
    if (!m) return toast('That note no longer exists');
    await openDoc(t.doc);
    if (!S.doc || !S.tab || S.tab.id !== t.doc) return;
    setTimeout(() => focusPoint(t), 60);
    return;
  }
  focusPoint(t);
}
function ensurePickBar() {
  let b = $('#pickbar'); if (b) return b;
  b = h('div', { id: 'pickbar', class: 'pickbar' }, icon('target', 20), h('span', { class: 'pt' }), h('button', { class: 'btn small', onclick: () => cancelPick() }, 'Cancel'));
  ($('#main') || document.body).append(b); return b;
}
function startPick(opts) {
  const cc = viewCentre();
  S.pick = { ...opts, src: S.tab.id, pos: { pi: cc.pi, x: cc.x, y: cc.y } };
  clearSel(); closePop(); closeMenu();
  const b = ensurePickBar(); b.hidden = false;
  b.querySelector('.pt').textContent = opts.edit ? 'Move around, then tap the new spot' : 'Move around, then tap the spot to jump to';
  cv.style.cursor = 'crosshair';
  if (opts.dest && opts.dest !== S.tab.id) openDoc(opts.dest);
}
function cancelPick() { if (S.pick) { S.pick = null; } const b = $('#pickbar'); if (b) b.hidden = true; syncDock(); }
async function pickAt(sx, sy) {
  const P = S.pick; if (!P) return;
  const [wx, wy] = toWorld(sx, sy), inf = isInf(S.doc), pi = inf ? 0 : pageAt(wy), top = S.layout.ys[pi];
  const other = S.tab.id !== P.src;
  const target = { doc: other ? S.tab.id : null, pg: pi, x: +wx.toFixed(1), y: +(wy - top).toFixed(1), s: S.view.s, rs: +(S.view.s / fitScale()).toFixed(3) };
  const label = P.label || ((inf ? 'Whiteboard spot' : 'Page ' + (pi + 1)) + (other ? ' · ' + S.tab.title : ''));
  cancelPick(); buzz(14);
  if (other) await switchTo(P.src);
  if (!S.doc) return;
  if (P.edit) {
    const o = P.edit, old = o.target; o.target = target;
    commit({ undo() { o.target = old; }, redo() { o.target = target; } });
    toast('Button now jumps to the new spot'); return;
  }
  const pg2 = S.doc.pages[clamp(P.pos.pi, 0, S.doc.pages.length - 1)], pi2 = S.doc.pages.indexOf(pg2);
  const it = { id: uid(), k: 'jump', text: label, s: 24, w: 200, x: P.pos.x - 100, y: P.pos.y - 22, target };
  if (!isInf(S.doc)) it.x = clamp(it.x, 10, PW - 230);
  afterInsert(pg2, pi2, it);
  toast('Jump button added. Tap it with a finger or the Move tool.', 3200);
}
async function jumpDialog() {
  let metas = [];
  try { metas = (await db.listMeta()).filter((m) => m.type !== 'folder' && m.id !== S.tab.id).sort((a, b) => (b.updated || 0) - (a.updated || 0)); } catch {}
  const label = h('input', { class: 'field', placeholder: 'e.g. “See the diagram”', maxlength: 60 });
  const sel = h('select', { class: 'field' }, h('option', { value: '' }, 'This note (' + S.tab.title + ')'), metas.map((m) => h('option', { value: m.id }, m.title)));
  modal({ title: 'Add a jump button', body: [h('p', {}, 'A button that takes you to another page, a spot on a whiteboard, or a different note.'),
    h('div', { class: 'lbl' }, 'Label'), label, h('div', { class: 'lbl' }, 'Jump to'), sel], actions: [
    { label: 'Cancel' },
    { label: 'Choose spot', kind: 'primary', fn: () => { startPick({ label: label.value.trim(), dest: sel.value || null }); } }] });
}

/* ---- comments ---- */
let cpop = null;
function newCommentAt(wx, wy) {
  const pi = isInf(S.doc) ? 0 : pageAt(wy), pg = S.doc.pages[pi], top = S.layout.ys[pi];
  const o = { id: uid(), k: 'comment', x: wx - 14, y: wy - top - 14, s: 24, c: '#ffd43b', text: '', t: Date.now() };
  if (!isInf(S.doc)) o.x = clamp(o.x, 6, PW - 46);
  pg.items.push(o); baseDirty = true;
  const back = S.cmtPrev && S.cmtPrev !== 'comment' ? S.cmtPrev : 'pen';
  setTool(back);
  openComment({ o, pg, pi }, true);
}
function openComment(hh, isNew) {
  closeComment();
  const { o, pg, pi } = hh;
  const ta = h('textarea', { class: 'ctext', rows: 4, placeholder: 'Write a comment…', spellcheck: 'false' });
  ta.value = o.text || '';
  const when = o.t ? new Date(o.t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const cols = h('div', { class: 'ccols' }, ['#ffd43b', '#ff8787', '#69db7c', '#74c0fc', '#da77f2'].map((c) =>
    h('button', { class: 'sw' + ((o.c || '#ffd43b') === c ? ' on' : ''), type: 'button', 'data-c': c, style: `background:${c}`, 'aria-label': c, onclick: () => {
      o.c = c; baseDirty = true; requestFrame(true); cols.querySelectorAll('.sw').forEach((b) => b.classList.toggle('on', b.dataset.c === c)); } })));
  const del = h('button', { class: 'btn small danger', type: 'button' }, icon('trash', 15), 'Delete');
  const done = h('button', { class: 'btn small primary', type: 'button' }, 'Done');
  const el = h('div', { class: 'cpop' }, h('div', { class: 'chead' }, icon('comment', 16), h('span', {}, 'Comment'), h('small', {}, when)), ta, cols, h('div', { class: 'cact' }, del, h('span', { class: 'grow' }), done));
  $('#stage').append(el);
  const cp = { el, ta, o, pg, pi, isNew, old: o.text || '', oldC: o.c || '#ffd43b' };
  cpop = cp;
  tapify(done, () => closeComment());
  tapify(del, () => closeComment(true));
  ta.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeComment(); });
  placeCpop(); setTimeout(() => ta.focus(), 40);
}
function placeCpop() {
  if (!cpop) return;
  const { el, o, pi } = cpop, v = S.view, z = CM(o) * v.s;
  const x = o.x * v.s + v.x, y = (S.layout.ys[pi] + o.y) * v.s + v.y, w = el.offsetWidth || 260, hh = el.offsetHeight || 190;
  el.style.left = clamp(x + z / 2 - w / 2, 8, Math.max(8, vw - w - 8)) + 'px';
  const below = y + z + 12, above = y - hh - 12;
  el.style.top = clamp(below + hh < vh - 8 ? below : above > 8 ? above : 8, 8, Math.max(8, vh - hh - 8)) + 'px';
}
function closeComment(discard) {
  if (!cpop) return;
  const { el, ta, o, pg, isNew, old, oldC } = cpop;
  cpop = null;
  const text = ta.value.trim(); el.remove();
  if (discard) {
    if (isNew) { const i = pg.items.indexOf(o); if (i >= 0) pg.items.splice(i, 1); }
    else { o.c = oldC; actRemoveObjs([{ pg, o }], false); }
  } else if (isNew) {
    if (!text) { const i = pg.items.indexOf(o); if (i >= 0) pg.items.splice(i, 1); }
    else { o.text = text; commit({ undo() { const i = pg.items.indexOf(o); if (i >= 0) pg.items.splice(i, 1); }, redo() { if (!pg.items.includes(o)) pg.items.push(o); } }); }
  } else {
    const nc = o.c, changedC = nc !== oldC;
    if (text !== old || changedC) {
      o.text = text;
      commit({ undo() { o.text = old; o.c = oldC; }, redo() { o.text = text; o.c = nc; } });
    }
  }
  baseDirty = true; requestFrame(true);
}

/* ---- quick brush size ---- */
function openQuick() {
  const k = S.tool, T = curTool();
  if (!T || T.s == null) return;
  closeMenu();
  const pop = $('#pop'); pop.innerHTML = ''; pop.hidden = false; popOpen = true; pop.dataset.kind = 'qsize';
  const [mn, mx, st] = sizeRange(k);
  const presets = [0, 0.14, 0.32, 0.58, 1].map((f) => +(Math.round((mn + (mx - mn) * f) / st) * st).toFixed(1));
  const px = (v) => 4 + ((v - mn) / (mx - mn)) * 28;
  const val = h('span', { class: 'sizeval' }, String(T.s));
  pop.append(h('h4', {}, 'Brush size'),
    h('div', { class: 'qdots' }, presets.map((v) => h('button', { class: 'qd' + (Math.abs(T.s - v) <= st * 0.51 ? ' on' : ''), 'aria-label': 'Size ' + v, onclick: () => { T.s = v; savePrefs(); syncDock(); openQuick(); } },
      h('i', { style: `width:${px(v)}px;height:${px(v)}px;background:${k === 'eraser' ? '#e03131' : T.c || 'currentColor'}` })))),
    h('div', { class: 'sizerow' },
      h('input', { type: 'range', min: mn, max: mx, step: st, value: T.s, 'aria-label': 'Size', oninput: (e) => { T.s = +e.target.value; savePrefs(); syncDock(); val.textContent = T.s; } }), val));
  pop.classList.add('qpop');
}

/* ---- text editor toolbar ---- */
function editLines(fn) {
  if (!editor) return;
  const el = editor.el, v = el.value, a = el.selectionStart, b = el.selectionEnd;
  const ls = v.lastIndexOf('\n', a - 1) + 1; let le = v.indexOf('\n', b); if (le < 0) le = v.length;
  const block = v.slice(ls, le).split('\n').map(fn).join('\n');
  el.value = v.slice(0, ls) + block + v.slice(le);
  el.setSelectionRange(ls + block.length, ls + block.length);
  el.dispatchEvent(new Event('input')); el.focus();
}
const lineMark = (n) => (line) => {
  const m = /^(#{1,3}\s+|[-*•]\s+)/.exec(line), cur = m ? m[1].trim() : '', body = m ? line.slice(m[0].length) : line;
  const want = n === 0 ? '' : n > 0 ? '#'.repeat(n) : '-';
  return cur === want ? body : (want ? want + ' ' : '') + body;
};
function wrapSel(mark) {
  if (!editor) return;
  const el = editor.el, v = el.value, a = el.selectionStart, b = el.selectionEnd, sel = v.slice(a, b), L = mark.length;
  if (sel.length >= 2 * L && sel.startsWith(mark) && sel.endsWith(mark)) {
    el.value = v.slice(0, a) + sel.slice(L, -L) + v.slice(b); el.setSelectionRange(a, b - 2 * L);
  } else if (v.slice(a - L, a) === mark && v.slice(b, b + L) === mark) {
    el.value = v.slice(0, a - L) + sel + v.slice(b + L); el.setSelectionRange(a - L, b - L);
  } else {
    el.value = v.slice(0, a) + mark + sel + mark + v.slice(b);
    if (sel) el.setSelectionRange(a, b + 2 * L); else el.setSelectionRange(a + L, a + L);
  }
  el.dispatchEvent(new Event('input')); el.focus();
}
function buildTextBar() {
  const mk = (label, title, fn, cls) => { const b = h('button', { type: 'button', class: cls || '', title, 'aria-label': title }, label); b.addEventListener('pointerdown', (e) => { e.preventDefault(); }); b.addEventListener('click', (e) => { e.preventDefault(); fn(); }); return b; };
  return h('div', { class: 'txtbar', onpointerdown: (e) => e.preventDefault() },
    mk('H1', 'Big heading', () => editLines(lineMark(1)), 'tb-h'), mk('H2', 'Heading', () => editLines(lineMark(2)), 'tb-h'), mk('H3', 'Small heading', () => editLines(lineMark(3)), 'tb-h'),
    mk('•', 'Bullet', () => editLines(lineMark(-1))), h('i', { class: 'tsep' }),
    mk('B', 'Bold', () => wrapSel('**'), 'tb-b'), mk('U', 'Underline', () => wrapSel('__'), 'tb-u'), mk('S', 'Strikethrough', () => wrapSel('~~'), 'tb-s'),
    h('i', { class: 'tsep' }), mk('Aa−', 'Smaller', () => editorScale(1 / 1.15)), mk('Aa+', 'Bigger', () => editorScale(1.15)),
    mk('✓', 'Done', () => commitEditor(), 'tb-done'));
}
function editorScale(k) { if (!editor) return; editor.it.s = Math.round(clamp(editor.it.s * k, 10, 140)); syncEditor(); requestFrame(true); }

/* ---- more menu ---- */
let menuOpen = false;
function closeMenu() { $('#menu').hidden = true; menuOpen = false; }
function syncMenu() { if (menuOpen) openMenu(); }
function exitPresent() {
  if (!document.body.classList.contains('present')) return;
  document.body.classList.remove('focus', 'present');
  const bar = $('#presbar'); if (bar) bar.remove();
  if (S.tool === 'laser') setTool(S.presentPrev || 'pen');
  setTimeout(resize, 30);
}
function startPresent() {
  S.presentPrev = S.tool === 'laser' ? 'pen' : S.tool;
  document.body.classList.add('focus', 'present'); setTimeout(resize, 30);
  setTool('laser'); closePop();
  let bar = $('#presbar');
  if (!bar) { bar = h('div', { id: 'presbar', class: 'presbar' }); document.body.append(bar); }
  bar.innerHTML = ''; bar.append(h('button', { class: 'ex', onclick: exitPresent }, 'Exit presentation'));
  toast('Presenting. Draw to point things out.', 1800);
}
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
  item('present', 'Present', startPresent);
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
  const styles = d.type === 'whiteboard' ? [['dots', 'Dots'], ['grid', 'Grid'], ['blank', 'Blank']] : [['ruled', 'Ruled'], ['grid', 'Grid'], ['dots', 'Dots'], ['cornell', 'Cornell'], ['music', 'Music'], ['blank', 'Blank']];
  const pk = paperPicker(d.paper, styles);
  modal({ title: 'Paper', body: pk.nodes, actions: [{ label: 'Cancel' }, { label: 'Apply', kind: 'primary', fn: () => {
    d.paper = { style: pk.st.style, color: pk.st.color, sp: pk.st.sp, lc: pk.st.lc }; adaptInk(); baseDirty = true; requestFrame(true); changed();
  } }] });
}

/* ---- settings: gestures & S Pen ---- */
function customPreview() {
  const c = Object.assign({}, CUSTOM_DEF, prefs.get('custom', {}));
  return `--cb:${c.bg};--cp:${mixc(c.bg, '#ffffff', 0.55)};--ca:${c.ac}`;
}
function customRow(repaint) {
  const c = Object.assign({}, CUSTOM_DEF, prefs.get('custom', {}));
  const pick = (key, label) => {
    const inp = h('input', { type: 'color', value: c[key], 'aria-label': label });
    inp.addEventListener('input', () => { c[key] = inp.value; prefs.set('custom', c); applyStyle('custom'); requestFrame(true); const sp = document.querySelector('.sprev.custom'); if (sp) sp.style.cssText = customPreview(); });
    return h('label', { class: 'cpick' }, inp, h('span', {}, label));
  };
  return h('div', { class: 'srow customrow' }, pick('bg', 'Background'), pick('ac', 'Accent'),
    h('button', { class: 'seg', onclick: () => { prefs.set('custom', { ...CUSTOM_DEF }); applyStyle('custom'); requestFrame(true); repaint(); } }, 'Reset'));
}
function settingsDialog() {
  const body = h('div', { class: 'settings' });
  const save = () => prefs.set('gest', S.gest);
  const row = (label, hint, opts, get, set) => h('div', { class: 'srow' },
    h('div', { class: 'slabel' }, label, hint ? h('small', {}, hint) : null),
    h('div', { class: 'segs mini' }, opts.map(([v, l]) => h('button', { class: 'seg' + (get() === v ? ' on' : ''), onclick: () => { set(v); save(); paint(); } }, l))));
  const paint = () => {
    body.innerHTML = '';
    const cur = document.documentElement.dataset.style;
    body.append(
      h('div', { class: 'lbl' }, 'Look'),
      h('div', { class: 'stylecards' }, STYLES.map(([id, label]) => h('button', { class: 'scard' + (cur === id ? ' on' : ''), onclick: () => { prefs.set('style', id); applyStyle(id); requestFrame(true); paint(); } },
        h('span', { class: 'sprev ' + id, style: id === 'custom' ? customPreview() : '' }, h('i'), h('i'), h('i')), label,
        h('small', {}, id === 'glass' ? 'Frosted and airy' : id === 'clay' ? 'Soft and puffy' : id === 'custom' ? 'Your own colours' : 'The original')))),
      cur === 'custom' ? customRow(paint) : null,
      h('div', { class: 'lbl', style: 'margin-top:14px' }, 'Finger gestures'),
      row('Two-finger tap', 'Tap the page with two fingers', [['undo', 'Undo'], ['redo', 'Redo'], ['none', 'Off']], () => S.gest.two, (v) => (S.gest.two = v)),
      row('Three-finger tap', 'Tap the page with three fingers', [['redo', 'Redo'], ['undo', 'Undo'], ['none', 'Off']], () => S.gest.three, (v) => (S.gest.three = v)),
      row('Finger input', 'Palm rejection', [[false, 'Draw'], [true, 'Pen only']], () => S.stylusOnly, (v) => { S.stylusOnly = v; S.stylusUserSet = true; prefs.set('stylusOnly', v); prefs.set('stylusUserSet', true); }),
      h('div', { class: 'lbl', style: 'margin-top:14px' }, 'S Pen'),
      row('Hold the pen button while writing', 'Works like the eraser end', [['eraser', 'Eraser'], ['lasso', 'Select'], ['none', 'Off']], () => S.gest.hold, (v) => (S.gest.hold = v)),
      row('Click the pen button (hovering)', 'Quick action without touching the screen', [['toggle', 'Eraser on/off'], ['undo', 'Undo'], ['none', 'Off']], () => S.gest.click, (v) => (S.gest.click = v)),
      row('Hold still to perfect a shape', 'Draw a line, circle, box or triangle and pause', [[true, 'On'], [false, 'Off']], () => S.holdShape, (v) => { S.holdShape = v; prefs.set('holdShape', v); }),
      row('Scribble to erase', 'Scratch back and forth over ink to rub it out', [[true, 'On'], [false, 'Off']], () => S.scribble, (v) => { S.scribble = v; prefs.set('scribble', v); }),
      row('Hold on a closed loop', 'Choose what happens when you pause after circling something', [['shape', 'Perfect shape'], ['select', 'Select inside']], () => S.loopSel, (v) => { S.loopSel = v; prefs.set('loopSel', v); }),
      h('div', { class: 'srow' }, h('div', { class: 'slabel' }, 'S Pen button test', h('small', {}, 'Shows exactly what your tablet reports when you press the button')),
        h('div', { class: 'segs mini' }, h('button', { class: 'seg', onclick: () => { $('#dlg').close(); setTimeout(penTestDialog, 80); } }, 'Open test'))));
  };
  paint();
  body.append(h('p', { class: 'note', style: 'margin-top:12px' }, 'Anota ' + APP_VERSION));
  modal({ title: 'Settings', body, actions: [{ label: 'Done', kind: 'primary' }] });
}
function penTestDialog() {
  const log = h('div', { class: 'pentest-log' });
  const state = h('div', { class: 'pen-state' }, 'Button: not pressed');
  const pad = h('div', { class: 'pentest' }, 'Hover the S Pen here, click its button, then press and hold the button while touching the screen');
  const line = (t) => { log.prepend(h('div', {}, t)); while (log.childNodes.length > 12) log.lastChild.remove(); };
  const fmt = (e) => `${e.type} · ${e.pointerType || 'key'} · button ${e.button} · buttons ${e.buttons} · pressure ${(e.pressure || 0).toFixed(2)}`;
  let last = '';
  const upd = (e) => { const held = (e.buttons & 6) || (e.buttons & 32) || e.button === 2 || e.button === 5; state.textContent = held ? 'Button: PRESSED (reported as buttons ' + e.buttons + ')' : 'Button: not pressed'; state.classList.toggle('on', !!held); };
  for (const t of ['pointerdown', 'pointerup', 'contextmenu', 'auxclick', 'pointercancel']) pad.addEventListener(t, (e) => { if (e.type === 'contextmenu') e.preventDefault(); upd(e); line(fmt(e)); });
  pad.addEventListener('pointermove', (e) => { upd(e); const sig = e.pointerType + ':' + e.buttons; if (sig !== last) { last = sig; line(fmt(e)); } });
  modal({ title: 'Test the S Pen button', body: [h('p', {}, 'Each line is something your tablet reported. The green badge lights up while the app sees the button held.'), state, pad, log], actions: [{ label: 'Done', kind: 'primary' }] });
}
/* ---- pages sheet ---- */
async function openSheet() {
  const sh = $('#sheet'), grid = $('#sheetGrid');
  sh.hidden = false; grid.innerHTML = '';
  const bmBtn = $('#sheetBm'); if (bmBtn) { bmBtn.classList.toggle('on', !!openSheet.only); bmBtn.onclick = () => { openSheet.only = !openSheet.only; openSheet(); }; }
  const token = (openSheet.tok = (openSheet.tok || 0) + 1);
  const cur = S.curPage || 0;
  const tiles = S.doc.pages.map((pg, i) => {
    if (openSheet.only && !pg.bm) return null;
    const holder = h('div', { class: 'pt' });
    const t = h('div', { class: 'pg' + (i === cur ? ' cur' : ''), style: `--i:${Math.min(i, 12)}`, onclick: () => { sh.hidden = true; scrollToPage(i); } },
      holder, `${i + 1}`,
      S.doc.pages.length > 1 ? h('button', { class: 'x', 'aria-label': 'Delete page', onclick: async (e) => { e.stopPropagation(); removePageAt(i); openSheet(); } }, icon('trash', 15, 2.2)) : null,
      h('div', { class: 'pgtools' },
        h('button', { 'aria-label': 'Bookmark', class: pg.bm ? 'on' : '', onclick: (e) => { e.stopPropagation(); toggleBookmark(i); openSheet(); } }, icon('bookmark', 15, 2.2)),
        h('button', { 'aria-label': 'Duplicate page', onclick: (e) => { e.stopPropagation(); duplicatePage(i); openSheet(); } }, icon('copy', 15, 2.2)),
        i > 0 ? h('button', { 'aria-label': 'Move earlier', onclick: (e) => { e.stopPropagation(); movePage(i, -1); openSheet(); } }, icon('back', 15, 2.4)) : null,
        i < S.doc.pages.length - 1 ? h('button', { 'aria-label': 'Move later', class: 'flip', onclick: (e) => { e.stopPropagation(); movePage(i, 1); openSheet(); } }, icon('back', 15, 2.4)) : null));
    grid.append(t); return holder;
  });
  for (let i = 0; i < tiles.length; i++) {
    if (!tiles[i]) continue;
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
  document.title = 'Anota'; wireMinimap();
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
  $('#file').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importDocument(f); };
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
    const files = [...(e.dataTransfer?.files || [])];
    const f = files.find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); insertImage(f); }
  });
  window.addEventListener('drop', (e) => {
    const f = [...(e.dataTransfer?.files || [])].find((x) => /\.(pdf|docx)$/i.test(x.name));
    if (f && !S.doc) { e.preventDefault(); importDocument(f); }
  });
  window.addEventListener('dragover', (e) => { if (!S.doc) e.preventDefault(); });
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    const m = e.data || {};
    if (m.anota === 'open' && m.id) openDoc(m.id);
    else if (m.anota === 'closeSplit') { const i = panes.findIndex((p) => p.frame.contentWindow === e.source); if (i >= 0) closePane(i); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) exitPresent(); });
  window.addEventListener('popstate', exitPresent);
  window.addEventListener('storage', (e) => { if (e.key === 'inknote.prefs') { prefs.reload(); applyStyle(prefs.get('style', 'glass')); requestFrame(true); } });
  window.addEventListener('popstate', () => {
    if (PANE) return;
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
  if (!PANE && new URLSearchParams(location.search).has('shared')) {
    try {
      const cache = await caches.open('inknote-inbox');
      const res = await cache.match('shared-file');
      if (res) {
        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get('x-name') || 'Shared PDF.pdf');
        await cache.delete('shared-file');
        history.replaceState(null, '', location.pathname);
        await importDocument(new File([blob], name, { type: blob.type || 'application/pdf' }));
        return;
      }
    } catch (e) { console.warn(e); }
  }
  const openId = new URLSearchParams(location.search).get('open');
  if (PANE) { if (openId) openDoc(openId); return; }
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
window.__ink = { S, db, L, recognize, quickNote, openZoom };
