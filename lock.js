// PIN + fingerprint lock. This is a privacy gate for opening notes, not encryption of the stored data.
const cfgGet = () => { try { return JSON.parse(localStorage.getItem('anota.lock') || '{}'); } catch { return {}; } };
const cfgSet = (c) => { try { localStorage.setItem('anota.lock', JSON.stringify(c)); } catch {} };
const cap = () => { const C = typeof window !== 'undefined' && window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.nativePromise ? C : null; };
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function derive(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return b64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, key, 256)));
}
export const lockCfg = () => ({ relock: 60, app: false, bio: false, ...cfgGet() });
export const hasPin = () => !!cfgGet().hash;
export async function setPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  cfgSet({ ...cfgGet(), salt: b64(salt), hash: await derive(pin, salt), len: pin.length, fails: 0, until: 0 });
}
export function clearPin() { const c = cfgGet(); delete c.hash; delete c.salt; delete c.len; delete c.cred; c.bio = false; c.app = false; cfgSet(c); }
export const setOpt = (k, v) => cfgSet({ ...cfgGet(), [k]: v });
export async function checkPin(pin) {
  const c = cfgGet(); if (!c.hash) return true;
  if (c.until && Date.now() < c.until) return 'wait';
  const ok = (await derive(pin, unb64(c.salt))) === c.hash;
  const n = ok ? 0 : (c.fails || 0) + 1;
  cfgSet({ ...c, fails: n, until: !ok && n >= 5 ? Date.now() + Math.min(300000, 15000 * 2 ** (n - 5)) : 0 });
  return ok;
}
export const waitLeft = () => Math.max(0, Math.ceil(((cfgGet().until || 0) - Date.now()) / 1000));

/* ---- fingerprint: the Android app uses BiometricPrompt, browsers use a platform passkey (WebAuthn) ---- */
export async function bioAvailable() {
  const C = cap();
  if (C) { try { const r = await C.nativePromise('Biometric', 'available', {}); return !!(r && r.ok); } catch { return false; } }
  try { return !!(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())); } catch { return false; }
}
export async function bioEnable() {
  const C = cap();
  if (C) { try { const r = await C.nativePromise('Biometric', 'authenticate', { title: 'Turn on fingerprint', subtitle: 'Confirm it is you' }); if (r && r.ok) { setOpt('bio', true); return true; } } catch {} return false; }
  try {
    const cred = await navigator.credentials.create({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'Anota' }, user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'anota', displayName: 'Anota' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' }, timeout: 60000 } });
    setOpt('cred', b64(new Uint8Array(cred.rawId))); setOpt('bio', true); return true;
  } catch { return false; }
}
async function bioAuth() {
  const c = cfgGet(), C = cap(); if (!c.bio) return false;
  if (C) { try { const r = await C.nativePromise('Biometric', 'authenticate', { title: 'Unlock Anota', subtitle: 'Use your fingerprint' }); return !!(r && r.ok); } catch { return false; } }
  if (!c.cred) return false;
  try {
    const a = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64(c.cred) }], userVerification: 'required', timeout: 60000 } });
    return !!a;
  } catch { return false; }
}

/* ---- the PIN pad ---- */
let open = null;
/** gate({title, hint, cancel}) -> Promise<boolean>. One pad at a time. */
export function gate({ title = 'Enter your PIN', hint = '', cancel = true, verify = true, h, icon } = {}) {
  if (open) return open.p;
  const cfg = lockCfg(); let val = '', busy = false, res, done = false;
  const dots = h('div', { class: 'lkdots', 'aria-live': 'polite' });
  const msg = h('div', { class: 'lkmsg' }, hint);
  const paint = () => { dots.innerHTML = ''; const n = Math.max(cfg.len || 4, val.length); for (let i = 0; i < n; i++) dots.append(h('i', { class: i < val.length ? 'on' : '' })); };
  const finish = (ok) => { if (done) return; done = true; document.removeEventListener('keydown', onKey, true); ov.remove(); open = null; res(ok); };
  const submit = async () => {
    if (busy || !val) return; busy = true;
    const r = await checkPin(val); busy = false;
    if (r === true) return finish(true);
    val = ''; paint();
    if (r === 'wait') msg.textContent = 'Too many tries. Wait ' + waitLeft() + ' s.';
    else { msg.textContent = 'Wrong PIN'; ov.classList.remove('shake'); void ov.offsetWidth; ov.classList.add('shake'); }
  };
  const press = (d) => { if (busy) return; if (val.length < 8) val += d; paint(); if (val.length === (cfg.len || 0)) submit(); };
  const back = () => { val = val.slice(0, -1); paint(); };
  function onKey(e) {
    if (/^\d$/.test(e.key)) { press(e.key); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'Backspace') { back(); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'Enter') { submit(); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'Escape' && cancel) { finish(false); e.preventDefault(); e.stopPropagation(); }
  }
  const keys = h('div', { class: 'lkpad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => h('button', { type: 'button', onclick: () => press(d) }, d)),
    cfg.bio ? h('button', { type: 'button', class: 'lkbio', 'aria-label': 'Use fingerprint', onclick: tryBio }, icon('finger', 26)) : h('span'),
    h('button', { type: 'button', onclick: () => press('0') }, '0'),
    h('button', { type: 'button', 'aria-label': 'Delete', onclick: back }, '⌫'));
  const ov = h('div', { class: 'lockov', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'lkbox' }, h('div', { class: 'lkico' }, icon('lock', 30)), h('div', { class: 'lktitle' }, title), dots, msg, keys,
      cancel ? h('button', { type: 'button', class: 'btn lkcancel', onclick: () => finish(false) }, 'Cancel') : null));
  async function tryBio() { if (await bioAuth()) finish(true); }
  document.body.append(ov); document.addEventListener('keydown', onKey, true); paint();
  open = { p: new Promise((r) => { res = r; }) };
  if (cfg.bio && verify) setTimeout(tryBio, 250);
  return open.p;
}
export const isGateOpen = () => !!open;
