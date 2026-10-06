// Screen Wake Lock while a station or the calm corner is active. Silent no-op where unsupported.
let want = false;
let lock: { release(): Promise<void>; addEventListener(t: string, f: () => void): void } | null = null;

async function acquire() {
  const wl = (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<NonNullable<typeof lock>> } }).wakeLock;
  if (!wl || lock || document.hidden) return;
  try {
    lock = await wl.request('screen');
    document.body.dataset.wake = 'on';
    lock.addEventListener('release', () => { lock = null; document.body.dataset.wake = 'off'; });
  } catch { lock = null; }
}
export function setWake(on: boolean) {
  want = on;
  if (on) acquire();
  else { const l = lock; lock = null; document.body.dataset.wake = 'off'; l?.release().catch(() => {}); }
}
document.addEventListener('visibilitychange', () => { if (want && !document.hidden) acquire(); });
