import { unlock, WrongPasscode } from './lib/crypto.js?v=49d96dca82';
import * as store from './lib/store.js?v=49d96dca82';
import { h, applyTheme } from './lib/render.js?v=49d96dca82';

const VIEWS = {
  '': () => import('./views/home.js?v=49d96dca82'),
  m: () => import('./views/module.js?v=49d96dca82'),
  practice: () => import('./views/practice.js?v=49d96dca82'),
  memorize: () => import('./views/memorize.js?v=49d96dca82'),
  exam: () => import('./views/exam.js?v=49d96dca82'),
  missed: () => import('./views/missed.js?v=49d96dca82'),
  settings: () => import('./views/settings.js?v=49d96dca82'),
};

const app = document.getElementById('app');
let bundle = null, ctxBase = null, cleanups = [], navEl = null, mainEl = null, routeSeq = 0;

applyTheme(store.get('theme', 'auto'));
window.addEventListener('mcb102:progress', () => refreshNav());

// ---------- gate ----------
function showGate(message = '', busy = false) {
  bundle = null;
  app.replaceChildren();
  document.title = 'MCB 102 Study Hub';
  const input = h('input', { id: 'pass', type: 'password', autocomplete: 'current-password', placeholder: 'Passcode', 'aria-label': 'Passcode', required: true, autofocus: true, disabled: busy });
  const err = h('div', { class: 'gate-err', role: 'alert' }, message);
  const btn = h('button', { class: 'btn primary block', type: 'submit', disabled: busy }, busy ? 'Unlocking…' : 'Unlock');
  const form = h('form', { class: 'gate-card', onsubmit: async (e) => {
    e.preventDefault();
    const p = input.value;
    if (!p) return;
    input.disabled = true; btn.disabled = true; btn.textContent = 'Unlocking…'; err.textContent = '';
    form.classList.add('loading');
    await tryUnlock(p, true);
  } },
  h('img', { class: 'gate-logo', src: 'icon.svg', alt: '', width: 56, height: 56 }),
  h('h1', null, 'MCB 102 Study Hub'),
  h('p', { class: 'muted' }, 'Enter the passcode to open the hub.'),
  h('label', { class: 'sr-only', for: 'pass' }, 'Passcode'), input, btn, err,
  h('div', { class: 'spinner', 'aria-hidden': 'true' }));
  if (busy) form.classList.add('loading');
  app.append(h('main', { class: 'gate' }, form));
  if (!busy) input.focus();
}

async function tryUnlock(passcode, fromForm) {
  try {
    const b = await unlock(passcode);
    store.setPass(passcode);
    bundle = b;
    start();
  } catch (e) {
    if (e instanceof WrongPasscode) {
      if (!fromForm) store.clearPass();
      showGate(fromForm ? 'Wrong passcode. Please try again.' : 'The saved passcode no longer works. Please enter it again.');
    } else {
      console.error(e);
      showGate('Could not open the content: ' + (e.message || e));
    }
  }
}

function lock() {
  store.clearPass();
  cleanup();
  bundle = null;
  showGate('Locked.');
}

// ---------- shell + router ----------
function cleanup() { for (const f of cleanups.splice(0)) { try { f && f(); } catch (e) { console.error(e); } } }

function start() {
  const course = bundle.course;
  ctxBase = {
    bundle, course,
    mods: new Map(bundle.modules.map((m) => [m.id, m])),
    decks: new Map(bundle.decks.map((d) => [d.id, d])),
    exams: new Map(bundle.exams.map((e) => [e.id, e])),
    qIndex: new Map(),
    lock, refreshNav,
  };
  for (const m of bundle.modules) for (const q of m.questions || []) ctxBase.qIndex.set(q.id, { q, mod: m });
  app.replaceChildren();
  navEl = h('nav', { class: 'nav', 'aria-label': 'Main' });
  mainEl = h('main', { id: 'main', tabindex: '-1' });
  app.append(h('header', { class: 'topbar' }, h('div', { class: 'topbar-in' }, h('a', { class: 'brand', href: '#/' }, h('img', { src: 'icon.svg', alt: '', width: 24, height: 24 }), h('span', null, 'MCB 102')), navEl)), mainEl);
  window.removeEventListener('hashchange', route);
  window.addEventListener('hashchange', route);
  route();
}

function refreshNav() {
  if (!navEl || !bundle) return;
  const seg = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  const missed = store.missedItems(bundle).length;
  const link = (href, text, key, extra) => h('a', { href, class: seg === key ? 'active' : '', 'aria-current': seg === key ? 'page' : null }, text, extra);
  navEl.replaceChildren(
    link('#/', 'Home', ''),
    link('#/memorize', 'Memorize', 'memorize'),
    link('#/exam', 'Exams', 'exam'),
    link('#/missed', 'Missed', 'missed', missed ? h('span', { class: 'pill' }, String(missed)) : null),
    link('#/settings', 'Settings', 'settings'));
}

async function route() {
  if (!bundle) return;
  const seq = ++routeSeq;
  cleanup();
  const [path] = location.hash.replace(/^#/, '').split('?');
  const segs = path.split('/').filter(Boolean).map(decodeURIComponent);
  const key = segs[0] || '';
  const loader = VIEWS[key] || VIEWS[''];
  mainEl.replaceChildren();
  window.scrollTo(0, 0);
  refreshNav();
  try {
    const mod = await loader();
    if (seq !== routeSeq) return;
    mod.render({ ...ctxBase, root: mainEl, params: VIEWS[key] ? segs.slice(1) : [], onCleanup: (f) => cleanups.push(f) });
    if (!['practice', 'exam', 'm'].includes(key)) mainEl.focus({ preventScroll: true });
  } catch (e) {
    console.error(e);
    mainEl.replaceChildren(h('div', { class: 'wrap' }, h('h1', null, 'Something went wrong'), h('pre', { class: 'err' }, String(e && e.stack || e)), h('a', { href: '#/' }, 'Back home')));
  }
}

// ---------- boot ----------
const saved = store.getPass();
if (saved) { showGate('', true); tryUnlock(saved, false); } else showGate();
