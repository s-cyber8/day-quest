// Global pause (calm corner, parent mode, prompts). Game timers respect it.
let paused = 0;
const subs = new Set<(p: boolean) => void>();
export const isPaused = () => paused > 0;
export function pauseGame(on: boolean) {
  const before = paused > 0;
  paused = Math.max(0, paused + (on ? 1 : -1));
  document.body.classList.toggle('paused', paused > 0);
  if (before !== paused > 0) subs.forEach((f) => f(paused > 0));
}
export const onPause = (f: (p: boolean) => void) => { subs.add(f); return () => subs.delete(f); };
