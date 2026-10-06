import { h, frag, clamp, drag } from '../core/dom';
import { PRAISE_IDS, RETRY_IDS } from '../content/phrases';
import { speak } from '../core/speech';
import { sfx, haptic } from '../core/audio';
import { isPaused } from '../core/pause';
import { reportMiss, reportHit } from '../core/frustration';
import { P } from '../art/props';

export interface GameCtx {
  root: HTMLElement;
  W: number; H: number;
  /** adaptive: >=1, grows after misses (bigger targets) */
  scale: number;
  /** adaptive: <=1, shrinks after misses (slower motion) */
  speed: number;
  say(...ids: string[]): Promise<void>;
  praise(): void;
  hit(): void;
  miss(): void;
  later(fn: () => void, ms: number): void;
  loop(fn: (dt: number) => void): void;
  alive(): boolean;
  finish(): void;
  sparkle(x: number, y: number): void;
  /** px size helper: never below 72, grows with adaptivity */
  size(px: number): number;
}
export type Game = (ctx: GameCtx) => void;

let pi = Math.floor(Math.random() * 5), ri = Math.floor(Math.random() * 3);
export const nextPraise = () => PRAISE_IDS[pi++ % PRAISE_IDS.length];
export const nextRetry = () => RETRY_IDS[ri++ % RETRY_IDS.length];

export function createCtx(root: HTMLElement, onFinish: () => void): GameCtx & { dispose(): void } {
  let alive = true, finished = false, misses = 0, rafId = 0;
  const r = root.getBoundingClientRect();
  const ctx: GameCtx & { dispose(): void } = {
    root, W: r.width, H: r.height, scale: 1, speed: 1,
    say: (...ids) => speak(...ids),
    praise() { sfx.chime(Math.floor(Math.random() * 4)); speak(nextPraise()); },
    hit() { reportHit(); },
    miss() {
      misses++; reportMiss();
      if (misses >= 2) { ctx.scale = Math.min(1.5, 1 + (misses - 1) * 0.15); ctx.speed = Math.max(0.55, 1 - (misses - 1) * 0.12); }
      sfx.soft(); speak(nextRetry());
    },
    later(fn, ms) {
      const run = () => { if (!alive) return; if (isPaused()) { setTimeout(run, 300); return; } fn(); };
      setTimeout(run, ms);
    },
    loop(fn) {
      let last = performance.now();
      const f = (t: number) => {
        if (!alive) return;
        const dt = Math.min(0.05, (t - last) / 1000); last = t;
        if (!isPaused()) fn(dt);
        rafId = requestAnimationFrame(f);
      };
      rafId = requestAnimationFrame(f);
    },
    alive: () => alive,
    finish() { if (finished) return; finished = true; ctx.later(() => onFinish(), 700); },
    sparkle(x, y) {
      const b = root.getBoundingClientRect();
      const s = frag(P.star('#fff3a8')); s.classList.add('sparkle');
      s.style.left = x - b.left - 18 + 'px'; s.style.top = y - b.top - 18 + 'px';
      root.append(s); setTimeout(() => s.remove(), 900);
    },
    size: (px) => Math.max(72, px) * ctx.scale,
    dispose() { alive = false; cancelAnimationFrame(rafId); },
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

export interface SeqItem { html: string; size: number; target: HTMLElement; before?: string; slot?: { x: number; y: number }; onPlace?: () => void }

/** Drag items one at a time onto targets (no fail: wrong drop floats back and the game gets easier). */
export function dragSequence(ctx: GameCtx, items: SeqItem[], tray: { x: number; y: number }, done: () => void) {
  let i = 0;
  const next = () => {
    if (!ctx.alive()) return;
    if (i >= items.length) { done(); return; }
    const it = items[i];
    if (it.before) ctx.say(it.before);
    const w = ctx.size(it.size);
    const e = put(el('abs', it.html), tray.x, tray.y, w);
    e.dataset.t = '1'; e.style.zIndex = '5'; e.style.animation = 'fadeIn .5s ease both';
    it.target.classList.add('glow');
    ctx.root.append(e);
    let ox = 0, oy = 0, ex = 0, ey = 0;
    drag(e, {
      start: (x, y) => { const b = e.getBoundingClientRect(); ex = b.left + b.width / 2; ey = b.top + b.height / 2; ox = x - ex; oy = y - ey; e.style.transition = 'none'; e.style.animation = 'none'; e.style.transform = 'scale(1.1)'; sfx.tap(); },
      move: (x, y) => {
        const rb = ctx.root.getBoundingClientRect();
        e.style.left = x - ox - rb.left - w / 2 + 'px'; e.style.top = y - oy - rb.top - w / 2 + 'px';
      },
      end: (x, y) => {
        const t = it.target.getBoundingClientRect();
        const pad = 46 * ctx.scale; const cx = x - ox, cy = y - oy;
        const ok = cx > t.left - pad && cx < t.right + pad && cy > t.top - pad && cy < t.bottom + pad;
        e.style.transition = 'all .45s cubic-bezier(.3,1.3,.5,1)';
        const rb = ctx.root.getBoundingClientRect();
        if (ok) {
          const c = it.slot ? { x: rb.left + it.slot.x, y: rb.top + it.slot.y } : centerOf(it.target);
          e.style.left = c.x - rb.left - w / 2 + 'px'; e.style.top = c.y - rb.top - w / 2 + 'px';
          e.style.transform = 'scale(.8)'; e.style.pointerEvents = 'none'; delete e.dataset.t;
          it.target.classList.remove('glow');
          sfx.place(); haptic(10); ctx.hit(); ctx.sparkle(c.x, c.y);
          it.onPlace?.();
          i++; ctx.later(next, 900);
        } else {
          e.style.left = tray.x - w / 2 + 'px'; e.style.top = tray.y - w / 2 + 'px'; e.style.transform = 'none';
          ctx.miss();
        }
      },
    });
  };
  next();
}

/** Swipe over targets to pop them. Returns nothing; calls onAll when every target is gone. */
export function swipePop(ctx: GameCtx, area: HTMLElement, targets: HTMLElement[], radius: number, onPop: (t: HTMLElement) => void, onAll: () => void, follow?: HTMLElement) {
  let left = targets.length;
  area.dataset.t = '1';
  const hitTest = (x: number, y: number) => {
    const rad = radius * ctx.scale;
    for (const t of targets) {
      if (t.dataset.popped) continue;
      const c = centerOf(t);
      if (Math.hypot(c.x - x, c.y - y) < rad + t.getBoundingClientRect().width / 3) {
        t.dataset.popped = '1'; left--; onPop(t);
        if (left === 0) onAll();
      }
    }
  };
  drag(area, {
    start: (x, y) => { hitTest(x, y); moveFollow(x, y); },
    move: (x, y) => { hitTest(x, y); moveFollow(x, y); },
    end: () => {},
  });
  const moveFollow = (x: number, y: number) => {
    if (!follow) return;
    const rb = ctx.root.getBoundingClientRect(); const fw = follow.offsetWidth;
    follow.style.left = clamp(x - rb.left - fw / 2, 0, rb.width - fw) + 'px'; follow.style.top = y - rb.top - fw / 2 + 'px'; follow.style.opacity = '1';
  };
}
