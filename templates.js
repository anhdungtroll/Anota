// Page templates. A template is a list of vector drawing ops stored on the page (pg.tpl), drawn under your ink:
// it never gets selected, moved or erased by accident, stays sharp at any zoom, and follows light/dark paper.
// op formats:  ['l', x1, y1, x2, y2, width, colour]   ['r', x, y, w, h, width, colour, radius, fill]
//              ['t', x, y, text, size, colour, align, bold]
const W = 800, H = 1131, M = 40;
const COL = (dark) => ({ g: dark ? '#5d647c' : '#b4bacb', g2: dark ? '#3a4054' : '#dde1ec', m: dark ? '#a6aec8' : '#6b7185', k: dark ? '#eceef7' : '#2a2e3d', a: dark ? '#8aa4ff' : '#3b5bdb', f: dark ? 'rgba(138,164,255,.10)' : 'rgba(59,91,219,.07)' });

export function drawTpl(c, tpl, dark, font = 'system-ui, sans-serif') {
  if (!tpl || !tpl.ops) return;
  const K = COL(dark); c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  for (const o of tpl.ops) {
    if (o[0] === 'l') { c.strokeStyle = K[o[6]] || o[6]; c.lineWidth = o[5]; c.beginPath(); c.moveTo(o[1], o[2]); c.lineTo(o[3], o[4]); c.stroke(); }
    else if (o[0] === 'r') {
      c.beginPath(); c.roundRect(o[1], o[2], o[3], o[4], o[7] || 0);
      if (o[8]) { c.fillStyle = K[o[8]] || o[8]; c.fill(); }
      if (o[5]) { c.strokeStyle = K[o[6]] || o[6]; c.lineWidth = o[5]; c.stroke(); }
    } else if (o[0] === 't') { c.fillStyle = K[o[5]] || o[5]; c.font = `${o[7] ? 700 : 500} ${o[4]}px ${font}`; c.textAlign = o[6] || 'left'; c.textBaseline = 'alphabetic'; c.fillText(o[3], o[1], o[2]); }
  }
  c.restore();
}

/* tiny builders */
const mk = () => { const ops = []; return {
  ops,
  L: (x1, y1, x2, y2, w = 1.2, col = 'g') => ops.push(['l', x1, y1, x2, y2, w, col]),
  R: (x, y, w, h, lw = 1.4, col = 'g', rad = 8, fill = null) => ops.push(['r', x, y, w, h, lw, col, rad, fill]),
  T: (x, y, s, size = 15, col = 'm', align = 'left', bold = false) => ops.push(['t', x, y, s, size, col, align, bold]),
  box: (x, y, s = 20) => ops.push(['r', x, y, s, s, 1.4, 'g', 4, null]),
}; };
const title = (b, s, sub) => { b.T(M, 62, s, 32, 'k', 'left', true); if (sub) b.T(M, 92, sub, 15, 'm'); };
const field = (b, label, x, y, w) => { b.T(x, y, label, 15, 'm'); b.L(x + b.ops.length * 0 + label.length * 8.4 + 10, y + 4, x + w, y + 4, 1.2, 'g'); };

const weekly = () => { const b = mk(); title(b, 'Weekly planner'); field(b, 'Week of', M, 96, 330);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Notes'], cw = 350, rh = 222;
  days.forEach((d, i) => { const x = M + (i % 2) * (cw + 20), y = 124 + Math.floor(i / 2) * (rh + 14);
    b.R(x, y, cw, rh, 1.4, 'g', 12, i === 7 ? 'f' : null); b.T(x + 16, y + 28, d, 17, 'a', 'left', true); b.L(x + 12, y + 40, x + cw - 12, y + 40, 1, 'g');
    for (let k = 0; k < 5; k++) b.L(x + 14, y + 72 + k * 30, x + cw - 14, y + 72 + k * 30, 0.8, 'g2'); });
  return b.ops; };
const daily = () => { const b = mk(); title(b, 'Daily planner'); field(b, 'Date', M, 96, 330);
  b.T(M, 146, 'Schedule', 17, 'a', 'left', true);
  for (let i = 0; i < 16; i++) { const y = 168 + i * 56, h = 6 + i; b.T(M + 46, y + 38, (h > 12 ? h - 12 : h) + (h >= 12 ? ' pm' : ' am'), 13, 'm', 'right'); b.L(M + 58, y + 42, M + 470, y + 42, 1, 'g2'); if (i % 1 === 0) b.L(M + 58, y + 14, M + 470, y + 14, 0.6, 'g2'); }
  b.L(M + 58, 168, M + 58, 168 + 16 * 56, 1.2, 'g');
  const x = M + 500, w = 220; b.T(x, 146, 'Top 3 priorities', 17, 'a', 'left', true);
  for (let i = 0; i < 3; i++) { b.box(x, 164 + i * 44, 22); b.L(x + 32, 184 + i * 44, x + w, 184 + i * 44, 1, 'g2'); }
  b.T(x, 340, 'To-do', 17, 'a', 'left', true);
  for (let i = 0; i < 9; i++) { b.box(x, 358 + i * 40, 20); b.L(x + 30, 376 + i * 40, x + w, 376 + i * 40, 1, 'g2'); }
  b.R(x, 740, w, 330, 1.4, 'g', 12, 'f'); b.T(x + 14, 768, 'Notes', 16, 'a', 'left', true);
  return b.ops; };
const monthly = () => { const b = mk(), d = new Date(), y = d.getFullYear(), mo = d.getMonth(), name = d.toLocaleString('en', { month: 'long' }); b.T(M, 62, name + ' ' + y, 34, 'k', 'left', true);
  const first = (new Date(y, mo, 1).getDay() + 6) % 7, n = new Date(y, mo + 1, 0).getDate(), cw = (W - 2 * M) / 7, ch = 150, y0 = 118;
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((t, i) => b.T(M + cw * i + cw / 2, y0 - 8, t, 14, 'm', 'center', true));
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) { const x = M + c * cw, yy = y0 + r * ch, idx = r * 7 + c - first; b.R(x, yy, cw, ch, 1, 'g', 0, c > 4 ? 'f' : null); if (idx >= 0 && idx < n) b.T(x + 8, yy + 20, String(idx + 1), 14, 'm', 'left', true); }
  return b.ops; };
const meeting = () => { const b = mk(); title(b, 'Meeting notes'); field(b, 'Topic', M, 96, W - M); field(b, 'Date', M, 130, 330); field(b, 'Time', 420, 130, W - M);
  field(b, 'Attendees', M, 164, W - M); b.L(M, 198, W - M, 198, 1.2, 'g');
  b.T(M, 240, 'Agenda', 18, 'a', 'left', true); for (let i = 0; i < 4; i++) { b.R(M, 262 + i * 36, 8, 8, 0, 'g', 4, 'g'); b.L(M + 22, 272 + i * 36, W - M, 272 + i * 36, 1, 'g2'); }
  b.T(M, 440, 'Notes', 18, 'a', 'left', true); b.R(M, 454, W - 2 * M, 330, 1.4, 'g', 12, null);
  for (let i = 0; i < 9; i++) b.L(M + 14, 490 + i * 34, W - M - 14, 490 + i * 34, 0.8, 'g2');
  b.T(M, 828, 'Action items', 18, 'a', 'left', true); b.T(520, 828, 'Owner', 13, 'm'); b.T(660, 828, 'Due', 13, 'm');
  for (let i = 0; i < 6; i++) { b.box(M, 846 + i * 40, 20); b.L(M + 30, 864 + i * 40, 500, 864 + i * 40, 1, 'g2'); b.L(520, 864 + i * 40, 640, 864 + i * 40, 1, 'g2'); b.L(660, 864 + i * 40, W - M, 864 + i * 40, 1, 'g2'); }
  return b.ops; };
const todo = () => { const b = mk(); title(b, 'To-do list'); field(b, 'Date', M, 96, 330);
  for (let i = 0; i < 22; i++) { b.box(M, 130 + i * 44, 24); b.L(M + 38, 152 + i * 44, W - M, 152 + i * 44, 1, 'g2'); }
  return b.ops; };
const kanban = () => { const b = mk(); title(b, 'Board'); const cw = 232, gap = 12;
  ['To do', 'Doing', 'Done'].forEach((t, i) => { const x = M + i * (cw + gap); b.R(x, 112, cw, 960, 1.4, 'g', 14, 'f'); b.R(x, 112, cw, 48, 0, 'a', 14, 'a'); b.T(x + cw / 2, 144, t, 18, '#ffffff', 'center', true); });
  return b.ops; };
const habits = () => { const b = mk(); title(b, 'Habit tracker'); field(b, 'Week of', M, 96, 330);
  const nx = M + 250, cw = 66; ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((t, i) => b.T(nx + cw * i + cw / 2 + 4, 146, t, 15, 'a', 'center', true)); b.T(M, 146, 'Habit', 15, 'a', 'left', true);
  for (let r = 0; r < 14; r++) { const y = 160 + r * 60; b.L(M, y, W - M + 6, y, 1, 'g'); b.L(M, y + 60, W - M + 6, y + 60, 1, 'g'); for (let c = 0; c < 7; c++) b.R(nx + cw * c + 14, y + 14, 32, 32, 1.2, 'g', 16, null); }
  b.L(nx - 4, 160, nx - 4, 160 + 14 * 60, 1.2, 'g');
  return b.ops; };
const study = () => { const b = mk(); title(b, 'Study notes'); field(b, 'Course', M, 96, 400); field(b, 'Date', 440, 96, W - M); field(b, 'Topic', M, 130, W - M);
  b.R(M, 156, 220, 700, 1.4, 'g', 12, 'f'); b.T(M + 14, 184, 'Key terms', 16, 'a', 'left', true);
  b.R(M + 236, 156, W - 2 * M - 236, 700, 1.4, 'g', 12, null); b.T(M + 250, 184, 'Notes', 16, 'a', 'left', true);
  b.R(M, 876, W - 2 * M, 200, 1.4, 'g', 12, 'f'); b.T(M + 14, 904, 'Summary', 16, 'a', 'left', true);
  return b.ops; };
const meal = () => { const b = mk(); title(b, 'Meal planner'); field(b, 'Week of', M, 96, 330);
  const cx = M + 110, cw = 205, cols = ['Breakfast', 'Lunch', 'Dinner']; cols.forEach((t, i) => b.T(cx + cw * i + cw / 2, 140, t, 15, 'a', 'center', true));
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d, r) => { const y = 154 + r * 92; b.T(M + 8, y + 52, d, 16, 'k', 'left', true); for (let c = 0; c < 3; c++) b.R(cx + cw * c + 4, y + 4, cw - 8, 84, 1.2, 'g', 10, null); });
  b.R(M, 810, W - 2 * M, 270, 1.4, 'g', 12, 'f'); b.T(M + 14, 838, 'Groceries', 16, 'a', 'left', true);
  for (let i = 0; i < 6; i++) { b.box(M + 16, 858 + i * 38, 18); b.L(M + 44, 874 + i * 38, W / 2 - 10, 874 + i * 38, 1, 'g2'); b.box(W / 2 + 14, 858 + i * 38, 18); b.L(W / 2 + 42, 874 + i * 38, W - M - 14, 874 + i * 38, 1, 'g2'); }
  return b.ops; };

export const TEMPLATES = [
  { id: 'weekly', name: 'Weekly planner', build: weekly }, { id: 'daily', name: 'Daily planner', build: daily },
  { id: 'monthly', name: 'Monthly calendar', build: monthly }, { id: 'meeting', name: 'Meeting notes', build: meeting },
  { id: 'todo', name: 'To-do list', build: todo }, { id: 'study', name: 'Study notes', build: study },
  { id: 'habits', name: 'Habit tracker', build: habits }, { id: 'meal', name: 'Meal planner', build: meal },
  { id: 'kanban', name: 'Board: to do / doing / done', build: kanban, wide: true },
];

/** your own table / planner: columns, rows, optional tick boxes and row labels */
export function tableTemplate({ title: ttl = '', cols = [], rows = 10, rowLabels = [], checks = false, rowH = 0 }) {
  const b = mk(); if (ttl) b.T(M, 62, ttl, 32, 'k', 'left', true);
  const top = ttl ? 110 : 60, hasLabels = rowLabels.length > 0, nRows = Math.max(1, Math.min(40, hasLabels ? rowLabels.length : rows));
  const rh = rowH || Math.max(34, Math.min(120, Math.floor((H - top - 70) / (nRows + 1))));
  const labelW = hasLabels ? 130 : 0, chkW = checks ? 44 : 0, n = Math.max(1, cols.length), cw = (W - 2 * M - labelW - chkW) / n;
  const x0 = M, hdrY = top, bodyY = top + rh;
  b.R(x0, hdrY, W - 2 * M, rh, 1.4, 'g', 0, 'f');
  if (hasLabels) b.T(x0 + 10, hdrY + rh / 2 + 5, '', 15, 'a');
  cols.forEach((c, i) => b.T(x0 + chkW + labelW + cw * i + cw / 2, hdrY + rh / 2 + 6, c, 16, 'a', 'center', true));
  for (let r = 0; r < nRows; r++) {
    const y = bodyY + r * rh; b.L(x0, y + rh, W - M, y + rh, 1, 'g');
    if (checks) b.box(x0 + 12, y + rh / 2 - 10, 20);
    if (hasLabels) b.T(x0 + chkW + 10, y + rh / 2 + 5, rowLabels[r] || '', 15, 'k', 'left', true);
  }
  const yEnd = bodyY + nRows * rh;
  b.R(x0, hdrY, W - 2 * M, yEnd - hdrY, 1.4, 'g', 0, null);
  if (checks) b.L(x0 + chkW, hdrY, x0 + chkW, yEnd, 1, 'g');
  if (hasLabels) b.L(x0 + chkW + labelW, hdrY, x0 + chkW + labelW, yEnd, 1, 'g');
  for (let i = 1; i < n; i++) b.L(x0 + chkW + labelW + cw * i, hdrY, x0 + chkW + labelW + cw * i, yEnd, 1, 'g');
  return b.ops;
}
/** small preview into a canvas */
export function previewTpl(canvas, ops, dark = false) {
  const c = canvas.getContext('2d'), k = canvas.width / W; canvas.height = Math.round(H * k);
  c.fillStyle = dark ? '#1f2333' : '#ffffff'; c.fillRect(0, 0, canvas.width, canvas.height);
  c.save(); c.scale(k, k); drawTpl(c, { ops }, dark); c.restore();
}
export const TPL_W = W, TPL_H = H;
