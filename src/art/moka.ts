// Moka, the family chocolate Labrador, as 3D-rendered cut-out sprites (public/assets/moka). The pose is chosen by [data-state];
// idle/happy/concerned/sleepy/walking/jump each swap the image and get their own CSS motion (see "Moka" in style.css).
export type MokaState = 'idle' | 'happy' | 'concerned' | 'sleepy' | 'walking' | 'jump';

const FILE: Record<MokaState, string> = { idle: 'idle', happy: 'happy', concerned: 'concerned', sleepy: 'sleepy', walking: 'walk', jump: 'jump' };
const url = (s: MokaState) => `${import.meta.env.BASE_URL}assets/moka/${FILE[s]}.png`;

/** Create a Moka element in the given pose. Width comes from the parent (the image keeps its aspect ratio). */
export function moka3d(state: MokaState = 'idle'): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'moka'; wrap.dataset.state = state;
  const img = document.createElement('img');
  img.alt = ''; img.draggable = false; img.src = url(state);
  wrap.append(img);
  return wrap;
}

/** Switch pose (the 3rd argument is kept for old call sites and ignored). */
export function setMoka(el: HTMLElement, state: MokaState, _eyes?: 'open' | 'closed') {
  if (el.dataset.state === state) return;
  el.dataset.state = state;
  const img = el.querySelector('img');
  if (img) img.src = url(state);
}

/** Decode all poses once so a pose swap never flashes. */
export function preloadMoka() {
  (Object.keys(FILE) as MokaState[]).forEach((s) => { const i = new Image(); i.src = url(s); i.decode?.().catch(() => {}); });
}
