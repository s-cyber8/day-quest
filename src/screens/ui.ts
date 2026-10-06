import { h, frag, rand, sleep } from '../core/dom';
import { P } from '../art/props';
import { settings } from '../core/storage';
import { sfx, haptic } from '../core/audio';
import { speak, onCaption } from '../core/speech';
import { Station, imgOf } from '../content/stations';

export const overlay = () => document.getElementById('overlay')!;

// ---------- caption bubble (text is secondary; speech comes first) ----------
let capTimer = 0;
export function initCaption() {
  const cap = document.getElementById('caption')!;
  onCaption((t) => { cap.textContent = t; cap.classList.add('show'); clearTimeout(capTimer); capTimer = window.setTimeout(() => cap.classList.remove('show'), 4500 + t.length * 90); });
}
export function hideCaption() { document.getElementById('caption')?.classList.remove('show'); }
/** speak + caption */
export const say = (...ids: string[]) => speak(...ids);

// ---------- station card (printed-board look) ----------
export function stationCard(s: Station, small = false): HTMLElement {
  return h('div', { class: 'card' + (small ? ' small' : '') },
    h('img', { class: 'pic', src: imgOf(s), alt: s.label, draggable: 'false' }),
    h('div', { class: 'badge' }, String(s.id)));
}

// ---------- confetti-lite (gentle, no flashing) ----------
export function confetti(parent: HTMLElement, n = 26) {
  if (document.body.classList.contains('rm')) return;
  const cols = ['#ffb3c1', '#ffe9a8', '#a8e6cf', '#bfe3f7', '#d6c8f5', '#ffd3b6'];
  for (let i = 0; i < n; i++) {
    const c = h('i', { class: 'confetti' });
    c.style.left = rand(2, 98) + '%'; c.style.background = cols[i % cols.length];
    c.style.animationDuration = rand(3.2, 5.2) + 's'; c.style.animationDelay = rand(0, 1.4) + 's';
    parent.append(c);
  }
}

// ---------- parent gate: hold 3 s (or PIN) ----------
export const HOLD_MS = 3000;
export function pinPad(onOk: () => void, onCancel: () => void) {
  let v = '';
  const dots = h('div', { class: 'dots' }, ...[0, 1, 2, 3].map(() => h('i')));
  const err = h('div', { class: 'err' });
  const render = () => [...dots.children].forEach((d, i) => d.classList.toggle('f', i < v.length));
  const keys = h('div', { class: 'keys' });
  const press = (k: string) => {
    sfx.tap();
    if (k === '⌫') v = v.slice(0, -1); else if (v.length < 4) v += k;
    render();
    if (v.length === 4) {
      if (v === settings.pin) { pad.remove(); onOk(); } else { err.textContent = 'קוד שגוי'; v = ''; setTimeout(render, 250); }
    }
  };
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach((k) =>
    keys.append(k ? h('button', { 'data-testid': 'pin-' + k, onclick: () => press(k) }, k) : h('span')));
  const pad = h('div', { class: 'pad', 'data-testid': 'pinpad' },
    h('div', { class: 'box' }, h('div', { style: 'font-size:22px;font-weight:700' }, 'קוד הורה'), dots, err, keys,
      h('button', { class: 'smallbtn', style: 'margin-top:14px', onclick: () => { pad.remove(); onCancel(); } }, 'ביטול')));
  overlay().append(pad);
}

/** Inline hold-to-confirm button (paw + filling ring). With a PIN set it opens the PIN pad instead. */
export function holdButton(onDone: () => void, opts: { caption?: string; pinInstead?: boolean } = {}): HTMLElement {
  const usePin = (opts.pinInstead ?? true) && !!settings.pin;
  const ring = frag<SVGSVGElement>(`<svg class="ring" viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="54"/><circle class="fg" cx="60" cy="60" r="54"/></svg>`);
  const fg = ring.querySelector('.fg') as SVGCircleElement;
  const btn = h('button', { class: 'hold', 'data-testid': 'hold', 'aria-label': 'אישור הורה' });
  btn.append(ring, frag(P.paw()));
  let raf = 0, t0 = 0, active = false, fin = false;
  const set = (p: number) => fg.style.strokeDashoffset = String(340 * (1 - p));
  const tick = () => {
    const p = Math.min(1, (performance.now() - t0) / HOLD_MS);
    set(p);
    if (p >= 1 && !fin) { fin = true; active = false; btn.classList.remove('on'); haptic(30); sfx.chime(2); onDone(); return; }
    if (active) raf = requestAnimationFrame(tick);
  };
  const stop = () => { active = false; cancelAnimationFrame(raf); btn.classList.remove('on'); if (!fin) set(0); };
  if (usePin) {
    btn.addEventListener('click', () => pinPad(() => { fin = true; onDone(); }, () => {}));
  } else {
    btn.addEventListener('pointerdown', (e) => { if (fin) return; btn.setPointerCapture(e.pointerId); active = true; t0 = performance.now(); btn.classList.add('on'); raf = requestAnimationFrame(tick); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, stop));
  }
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  const wrap = h('div', { style: 'display:flex;flex-direction:column;align-items:center' }, btn,
    opts.caption !== '' ? h('div', { class: 'holdcap' }, opts.caption ?? (usePin ? 'הורה: הקש קוד' : 'הורה: לחיצה ארוכה 3 שניות')) : null);
  return wrap;
}

/** Full-screen parent gate: hold 3 s, then PIN too if one is set. Resolves true on success. */
export function askGate(): Promise<boolean> {
  return new Promise((res) => {
    let box: HTMLElement;
    const close = (ok: boolean) => { box.remove(); res(ok); };
    const hb = holdButton(() => {
      if (settings.pin) pinPad(() => close(true), () => close(false)); else close(true);
    }, { pinInstead: false, caption: 'לחיצה ארוכה 3 שניות' });
    box = h('div', { class: 'pad', 'data-testid': 'gate' },
      h('div', { class: 'box' }, h('div', { style: 'font-size:22px;font-weight:700;margin-bottom:14px' }, 'לאזור ההורים'), hb,
        h('button', { class: 'smallbtn', style: 'margin-top:16px', onclick: () => close(false) }, 'ביטול')));
    overlay().append(box);
  });
}

// ---------- star flying to the map counter ----------
export async function flyStar(from: HTMLElement | { x: number; y: number }, to: { x: number; y: number }) {
  const r = from instanceof HTMLElement ? from.getBoundingClientRect() : null;
  const sx = r ? r.left + r.width / 2 : (from as { x: number }).x, sy = r ? r.top + r.height / 2 : (from as { y: number }).y;
  const s = frag(P.star()); const w = h('div', { class: 'flystar' }); w.append(s);
  w.style.left = sx - 45 + 'px'; w.style.top = sy - 45 + 'px';
  document.body.append(w);
  await sleep(30);
  w.style.transform = `translate(${to.x - sx}px, ${to.y - sy}px) scale(.35)`; w.style.opacity = '.2';
  sfx.whoosh();
  await sleep(1150); w.remove();
}
