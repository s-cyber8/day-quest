import { h, frag, drag } from '../core/dom';
import { PRAISE_IDS, RETRY_IDS } from '../content/phrases';
import { speak } from '../core/speech';
import { sfx, haptic } from '../core/audio';
import { isPaused } from '../core/pause';
import { reportMiss, reportHit } from '../core/frustration';
import { P } from '../art/props';

export type Level = 1 | 2 | 3;
export type Outcome = { result: 'win'; stars: number } | { result: 'lose' };
export interface Pt { x: number; y: number }
export type HandHint = { kind: 'tap'; at: Pt } | { kind: 'drag'; from: Pt; to: Pt } | null;

export interface GameCtx {
  root: HTMLElement;
  W: number; H: number;
  level: Level;
  scale: number; // kept for sizing helpers (always 1: difficulty comes from levels)
  say(...ids: string[]): Promise<void>;
  praise(): void;
  hit(): void;
  /** Allowed mistakes before the attempt is lost. */
  budget(n: number): void;
  /** A real mistake. Returns true if the attempt was lost because of it. */
  mistake(sound?: boolean): boolean;
  mistakes(): number;
  stars(): number;
  win(stars?: number): void;
  lose(): void;
  later(fn: () => void, ms: number): void;
  loop(fn: (dt: number) => void): void;
  alive(): boolean;
  /** compat: finishing = winning with the stars earned so far */
  finish(): void;
  sparkle(x: number, y: number): void;
  size(px: number): number;
  /** Animated hand demonstrating the gesture; shows until the first interaction and again after 6 s idle. */
  hand(provider: (() => HandHint) | null): void;
}
export type Game = (ctx: GameCtx) => void;

let pi = Math.floor(Math.random() * 5), ri = Math.floor(Math.random() * 3);
export const nextPraise = () => PRAISE_IDS[pi++ % PRAISE_IDS.length];
export const nextRetry = () => RETRY_IDS[ri++ % RETRY_IDS.length];

const HAND = `<svg viewBox="0 0 64 80" width="64" height="80" style="display:block;filter:drop-shadow(0 4px 4px rgba(0,0,0,.25))"><path d="M24 6c4 0 7 3 7 7v22l4-2c3-1.5 7 0 8 3l1 2c3-1 7 1 8 4l1 3c3-.5 6 2 6 6 0 12-6 26-20 26H30c-8 0-14-5-18-13L6 44c-1.5-3 0-6 3-7 3-1 6 0 8 3l3 4V13c0-4 3-7 7-7z" fill="#ffd9bf" stroke="#e9a98a" stroke-width="2.5" stroke-linejoin="round"/></svg>`;

export function createCtx(root: HTMLElement, level: Level, onEnd: (o: Outcome) => void): GameCtx & { dispose(): void } {
  let alive = true, ended = false, nMistakes = 0, allowed = Infinity, rafId = 0;
  const r = root.getBoundingClientRect();
  let provider: (() => HandHint) | null = null;
  let idle = 0, anim: Animation | null = null;
  const handEl = h('div', { class: 'handhint', 'data-testid': 'hand' });
  handEl.innerHTML = HAND;
  Object.assign(handEl.style, { position: 'absolute', left: '0', top: '0', zIndex: '30', pointerEvents: 'none', display: 'none', willChange: 'transform' });
  root.append(handEl);
  const T = (p: Pt) => `translate(${p.x - 24}px, ${p.y - 6}px)`;
  const showHand = () => {
    anim?.cancel(); anim = null;
    if (!alive || ended || !provider) { handEl.style.display = 'none'; return; }
    const hh = provider();
    if (!hh) { handEl.style.display = 'none'; return; }
    handEl.style.display = 'block'; root.append(handEl);
    if (hh.kind === 'tap') {
      anim = handEl.animate([{ transform: T(hh.at) + ' scale(1)' }, { transform: T(hh.at) + ' scale(.8)' }, { transform: T(hh.at) + ' scale(1)' }], { duration: 1100, iterations: Infinity, easing: 'ease-in-out' });
    } else {
      anim = handEl.animate([
        { transform: T(hh.from), opacity: 0, offset: 0 }, { transform: T(hh.from), opacity: 1, offset: 0.15 },
        { transform: T(hh.to), opacity: 1, offset: 0.8 }, { transform: T(hh.to), opacity: 0, offset: 1 },
      ], { duration: 2100, iterations: Infinity, easing: 'ease-in-out' });
    }
  };
  const armIdle = () => { clearTimeout(idle); idle = window.setTimeout(() => { if (!isPaused()) showHand(); else armIdle(); }, 6000); };
  root.addEventListener('pointerdown', () => { if (!provider) return; anim?.cancel(); anim = null; handEl.style.display = 'none'; armIdle(); }, true);

  const end = (o: Outcome) => { if (ended) return; ended = true; clearTimeout(idle); anim?.cancel(); handEl.style.display = 'none'; ctx.later(() => onEnd(o), o.result === 'win' ? 700 : 900); };
  const ctx: GameCtx & { dispose(): void } = {
    root, W: r.width, H: r.height, level, scale: 1,
    say: (...ids) => speak(...ids),
    praise() { sfx.chime(Math.floor(Math.random() * 4)); },
    hit() { reportHit(); },
    budget(n) { allowed = n; },
    mistake(sound = true) {
      if (ended) return false;
      nMistakes++; reportMiss(); root.dataset.mistakes = String(nMistakes);
      if (nMistakes > allowed) { ctx.lose(); return true; }
      if (sound) { sfx.soft(); speak(nextRetry()); }
      return false;
    },
    mistakes: () => nMistakes,
    stars() { if (nMistakes === 0) return 3; return allowed === Infinity || nMistakes <= Math.ceil(allowed / 2) ? 2 : 1; },
    win(stars) { end({ result: 'win', stars: stars ?? ctx.stars() }); },
    lose() { sfx.soft(); end({ result: 'lose' }); },
    finish() { ctx.win(); },
    later(fn, ms) {
      const run = () => { if (!alive) return; if (isPaused()) { setTimeout(run, 300); return; } fn(); };
      setTimeout(run, ms);
    },
    loop(fn) {
      let last = performance.now();
      const f = (t: number) => {
        if (!alive) return;
        const dt = Math.min(0.05, (t - last) / 1000); last = t;
        if (!isPaused() && !ended) fn(dt);
        rafId = requestAnimationFrame(f);
      };
      rafId = requestAnimationFrame(f);
    },
    alive: () => alive,
    sparkle(x, y) {
      const b = root.getBoundingClientRect();
      const s = frag(P.star('#fff3a8')); s.classList.add('sparkle');
      s.style.left = x - b.left - 18 + 'px'; s.style.top = y - b.top - 18 + 'px';
      root.append(s); setTimeout(() => s.remove(), 900);
    },
    size: (px) => Math.max(72, px),
    hand(p) { provider = p; clearTimeout(idle); if (p) setTimeout(showHand, 500); else showHand(); },
    dispose() { alive = false; cancelAnimationFrame(rafId); clearTimeout(idle); anim?.cancel(); },
  };
  return ctx;
}

// ---------------- shared helpers ----------------
export function el(cls: string, html = '', style = ''): HTMLElement {
  const e = h('div', { class: cls, style });
  if (html) e.innerHTML = html;
  return e;
}
export function put(e: HTMLElement, cx: number, cy: number, w: number, hh = w) {
  e.style.position = 'absolute'; e.style.width = w + 'px'; e.style.height = hh + 'px';
  e.style.left = cx - w / 2 + 'px'; e.style.top = cy - hh / 2 + 'px';
  return e;
}
export const centerOf = (e: Element) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
/** center of an element in stage-relative coordinates */
export function rel(ctx: GameCtx, e: Element): Pt {
  const b = ctx.root.getBoundingClientRect(), c = centerOf(e); return { x: c.x - b.left, y: c.y - b.top };
}
export const shuffle = <T,>(a: T[]): T[] => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

export interface DragItem {
  id: string; html: string; size: number; home: Pt; hh?: number;
  /** return a snap point (stage-relative) to accept the drop, or null to bounce back */
  onDrop(center: Pt, item: DragItem): Pt | null;
  data?: unknown; el?: HTMLElement; placed?: boolean;
}
/** Make draggable items. Items that are not accepted float back home. Returns a remove-all function. */
export function dragItems(ctx: GameCtx, items: DragItem[], onPlaced?: (it: DragItem) => void) {
  items.forEach((it) => {
    const w = ctx.size(it.size), hh = it.hh ?? w;
    const e = put(el('abs', it.html), it.home.x, it.home.y, w, hh);
    e.dataset.t = '1'; e.dataset.id = it.id; e.style.zIndex = '5'; e.style.animation = 'fadeIn .5s ease both';
    it.el = e; ctx.root.append(e);
    let ox = 0, oy = 0;
    drag(e, {
      start: (x, y) => {
        if (it.placed) return;
        const b = e.getBoundingClientRect(); ox = x - (b.left + b.width / 2); oy = y - (b.top + b.height / 2);
        e.style.transition = 'none'; e.style.animation = 'none'; e.style.transform = 'scale(1.1)'; e.style.zIndex = '8'; sfx.tap();
      },
      move: (x, y) => {
        if (it.placed) return;
        const rb = ctx.root.getBoundingClientRect();
        e.style.left = x - ox - rb.left - w / 2 + 'px'; e.style.top = y - oy - rb.top - hh / 2 + 'px';
      },
      end: (x, y) => {
        if (it.placed) return;
        const rb = ctx.root.getBoundingClientRect();
        const c = { x: x - ox - rb.left, y: y - oy - rb.top };
        e.style.transition = 'all .45s cubic-bezier(.3,1.3,.5,1)'; e.style.zIndex = '5';
        const snap = it.onDrop(c, it);
        if (snap) {
          it.placed = true; e.style.left = snap.x - w / 2 + 'px'; e.style.top = snap.y - hh / 2 + 'px';
          e.style.transform = 'scale(.8)'; e.style.pointerEvents = 'none'; delete e.dataset.t;
          sfx.place(); haptic(10); ctx.hit(); ctx.sparkle(rb.left + snap.x, rb.top + snap.y);
          onPlaced?.(it);
        } else { e.style.left = it.home.x - w / 2 + 'px'; e.style.top = it.home.y - hh / 2 + 'px'; e.style.transform = 'none'; }
      },
    });
  });
}
export const inside = (p: Pt, e: Element, ctx: GameCtx, pad = 30) => {
  const c = rel(ctx, e), b = e.getBoundingClientRect();
  return Math.abs(p.x - c.x) < b.width / 2 + pad && Math.abs(p.y - c.y) < b.height / 2 + pad;
};

/** Swipe over targets to pop them (touch/mouse). */
export function swipePop(ctx: GameCtx, area: HTMLElement, getTargets: () => HTMLElement[], radius: number, onPop: (t: HTMLElement) => void, onSwipeEnd?: (popped: number) => void, follow?: HTMLElement) {
  area.dataset.t = '1';
  let popped = 0;
  const test = (x: number, y: number) => {
    for (const t of getTargets()) {
      if (t.dataset.popped) continue;
      const c = centerOf(t);
      if (Math.hypot(c.x - x, c.y - y) < radius + t.getBoundingClientRect().width / 3) { t.dataset.popped = '1'; popped++; onPop(t); }
    }
  };
  const mf = (x: number, y: number) => {
    if (!follow) return;
    const rb = ctx.root.getBoundingClientRect(), fw = follow.offsetWidth;
    follow.style.left = Math.max(0, Math.min(rb.width - fw, x - rb.left - fw / 2)) + 'px'; follow.style.top = y - rb.top - fw / 2 + 'px'; follow.style.opacity = '1';
  };
  drag(area, {
    start: (x, y) => { popped = 0; test(x, y); mf(x, y); },
    move: (x, y) => { test(x, y); mf(x, y); },
    end: () => { onSwipeEnd?.(popped); },
  });
}

/** Row of small dots showing remaining tries (no numbers: he can't read). */
export function triesBar(ctx: GameCtx, n: number, at = 'top') {
  const b = el('abs'); Object.assign(b.style, { left: '50%', [at]: '6px', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: '4', pointerEvents: 'none' });
  const dots = Array.from({ length: n }, () => { const d = h('i'); Object.assign(d.style, { width: '16px', height: '16px', borderRadius: '50%', background: '#7fd6a0', transition: 'all .4s' }); return d; });
  b.append(...dots); ctx.root.append(b);
  return (left: number) => dots.forEach((d, i) => { d.style.background = i < left ? '#7fd6a0' : '#d5e0e8'; d.style.transform = i < left ? 'none' : 'scale(.7)'; });
}
/** Generous countdown bar (level 3 only). Calls onTimeout when empty. */
export function timerBar(ctx: GameCtx, seconds: number, onTimeout: () => void) {
  const wrap = el('abs'); Object.assign(wrap.style, { left: '12%', right: '12%', top: '4px', height: '12px', borderRadius: '6px', background: 'rgba(255,255,255,.8)', zIndex: '4', overflow: 'hidden', pointerEvents: 'none' });
  const fill = el('abs'); Object.assign(fill.style, { left: '0', top: '0', bottom: '0', width: '100%', background: '#ffb870', borderRadius: '6px' });
  wrap.append(fill); ctx.root.append(wrap);
  let t = seconds, stopped = false;
  ctx.loop((dt) => { if (stopped) return; t -= dt; fill.style.width = Math.max(0, (t / seconds) * 100) + '%'; if (t <= 0) { stopped = true; onTimeout(); } });
  return { stop() { stopped = true; wrap.remove(); }, left: () => t };
}
