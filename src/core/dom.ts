export type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Attrs = {}, ...kids: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (k === 'style') e.setAttribute('style', String(v));
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
}

/** Build an element from an SVG/HTML string. */
export function frag<T extends Element = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as unknown as T;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (t: number) => t * t * (3 - 2 * t);

export function dayKeyOf(d: Date, unlock: string): string {
  const [hh, mm] = unlock.split(':').map(Number);
  const s = new Date(d.getTime() - ((hh || 0) * 60 + (mm || 0)) * 60000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())}`;
}
export const weekdayOfKey = (k: string) => new Date(`${k}T12:00:00`).getDay();

/** Drag helper (Pointer Events). Coordinates are viewport client coords. */
export function drag(
  el: HTMLElement,
  h: {
    start?: (x: number, y: number, e: PointerEvent) => void;
    move?: (x: number, y: number, dx: number, dy: number, e: PointerEvent) => void;
    end?: (x: number, y: number, e: PointerEvent, cancelled: boolean) => void;
  },
) {
  let id = -1, sx = 0, sy = 0;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    if (id !== -1) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY;
    el.setPointerCapture(id);
    h.start?.(e.clientX, e.clientY, e);
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    h.move?.(e.clientX, e.clientY, e.clientX - sx, e.clientY - sy, e);
  });
  const up = (cancelled: boolean) => (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    h.end?.(e.clientX, e.clientY, e, cancelled);
  };
  el.addEventListener('pointerup', up(false));
  el.addEventListener('pointercancel', up(true));
}
