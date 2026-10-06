// Detects rage taps and consecutive misses. Never punishes; only offers the calm corner.
import { settings } from './storage';

let enabled = false;
let taps: number[] = [];
let misses = 0;
let lastTrigger = -Infinity;
let guard: () => boolean = () => true;
export const setGuard = (g: () => boolean) => { guard = g; };
let handler: ((reason: 'rage' | 'misses') => void) | null = null;

export function onFrustration(h: (r: 'rage' | 'misses') => void) { handler = h; }
export const setFrustrationEnabled = (on: boolean) => { enabled = on; taps = []; misses = 0; };
export function resetStreak() { misses = 0; }

function fire(r: 'rage' | 'misses') {
  const now = Date.now();
  if (!enabled || !guard() || now - lastTrigger < settings.cooldownMin * 60000) return;
  lastTrigger = now; taps = []; misses = 0;
  handler?.(r);
}
export function reportMiss() { misses++; if (misses >= settings.missStreak) fire('misses'); }
export function reportHit() { misses = 0; }
export const forceCooldown = () => { lastTrigger = Date.now(); };
export const resetCooldown = () => { lastTrigger = -Infinity; };

/** Taps on anything that is not a button / [data-t] interactive target count as "rage" candidates. */
export function installRageDetector() {
  document.addEventListener('pointerdown', (e) => {
    if (!enabled) return;
    const t = e.target as Element | null;
    if (t?.closest('button, [data-t], input, select, textarea, a')) { taps = []; return; }
    const now = performance.now();
    taps.push(now);
    taps = taps.filter((x) => now - x <= settings.rageWindowMs);
    if (taps.length >= settings.rageTaps) fire('rage');
  }, true);
}

/** Ask permission to offer the calm corner (respects enabled/guard/cooldown); consumes the cooldown when granted. */
export function tryOffer(): boolean {
  const now = Date.now();
  if (!guard() || now - lastTrigger < settings.cooldownMin * 60000) return false;
  lastTrigger = now; return true;
}
