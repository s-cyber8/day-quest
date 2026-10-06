// All sound is synthesised with Web Audio. Everything is soft: slow attacks, low gain, never harsh.
import { settings } from './storage';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.connect(comp); comp.connect(ctx.destination);
    applyVolume();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
  return ctx;
}
export function applyVolume() { if (master) master.gain.value = settings.volume * 0.9; }

/** Call on the first user gesture (iOS needs this). */
export function unlockAudio() {
  const c = ensure(); if (!c) return;
  if (c.state !== 'running') c.resume().catch(() => {});
  try { const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch { /* */ }
}

function tone(f: number, t0: number, dur: number, type: OscillatorType = 'sine', gain = 0.12, f2?: number) {
  const c = ensure(); if (!c || !master) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.03, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(t0: number, dur: number, f0: number, f1: number, gain = 0.08, q = 1.2) {
  const c = ensure(); if (!c || !master || !noiseBuf) return;
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t0); bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.4);
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  s.connect(bp); bp.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.05);
}
const now = () => ensure()?.currentTime ?? 0;
const N = (semi: number, base = 523.25) => base * Math.pow(2, semi / 12);

export const sfx = {
  tap() { const t = now(); tone(660, t, 0.12, 'sine', 0.05); },
  pop() { const t = now(); tone(420, t, 0.12, 'sine', 0.1, 900); },
  chime(i = 0) { const t = now(); const n = [0, 4, 7, 12][i % 4]; tone(N(n), t, 0.7, 'sine', 0.1); tone(N(n + 12), t, 0.5, 'sine', 0.03); },
  success() { const t = now(); [0, 4, 7, 12].forEach((n, i) => { tone(N(n), t + i * 0.12, 0.8, 'sine', 0.1); tone(N(n) * 2, t + i * 0.12, 0.5, 'triangle', 0.02); }); },
  big() { const t = now(); [0, 4, 7, 12, 16, 19].forEach((n, i) => { tone(N(n, 392), t + i * 0.11, 1.0, 'sine', 0.1); tone(N(n, 392) * 2, t + i * 0.11, 0.6, 'triangle', 0.025); }); },
  soft() { const t = now(); tone(N(0, 440), t, 0.5, 'sine', 0.07); tone(N(7, 440), t + 0.15, 0.6, 'sine', 0.06); },
  whoosh() { const t = now(); noise(t, 0.5, 300, 1800, 0.05); },
  place() { const t = now(); tone(300, t, 0.15, 'sine', 0.1, 180); },
  flip() { const t = now(); noise(t, 0.12, 900, 2200, 0.04, 2); },
  step() { const t = now(); tone(200, t, 0.1, 'sine', 0.08, 120); },
  gulp() { const t = now(); tone(240, t, 0.18, 'sine', 0.12, 120); tone(180, t + 0.12, 0.2, 'sine', 0.08, 90); },
  squish(p = 0) { const t = now(); tone(180 - p * 60, t, 0.35, 'sine', 0.07, 130 - p * 40); },
  boing() { const t = now(); tone(200, t, 0.35, 'sine', 0.1, 420); },
  sparkle() { const t = now(); [0, 7, 12, 16].forEach((n, i) => tone(N(n, 880), t + i * 0.06, 0.4, 'sine', 0.04)); },
  breathe(inh: boolean, dur: number) { const t = now(); tone(inh ? 196 : 262, t, dur, 'sine', 0.05, inh ? 262 : 196); },
  kick() { const t = now(); noise(t, 0.15, 500, 200, 0.12, 0.8); tone(120, t, 0.12, 'sine', 0.12, 70); },
  /** ~10 s music-box lullaby (Brahms-style phrase), then silence. */
  lullaby() {
    const t = now() + 0.1;
    const seq: [number, number][] = [ // [semitone from C5, beats]
      [4, 1], [4, 1], [7, 2], [4, 1], [4, 1], [7, 2], [4, 1], [7, 1], [12, 1.5], [11, 0.5], [9, 1], [9, 1],
      [7, 2], [2, 1], [4, 1], [5, 1.5], [2, 0.5], [4, 1], [5, 1], [2, 1], [4, 1], [5, 1], [7, 3],
    ];
    let at = t; const beat = 0.42;
    seq.forEach(([n, b], i) => {
      const fade = Math.max(0.05, 1 - (at - t) / 10.5);
      tone(N(n), at, 1.4, 'sine', 0.08 * fade);
      tone(N(n) * 2, at, 0.7, 'triangle', 0.02 * fade);
      if (i % 3 === 0) tone(N(n - 12), at, 1.8, 'sine', 0.035 * fade);
      at += b * beat;
    });
  },
};

export function haptic(ms: number | number[] = 15) {
  try { navigator.vibrate?.(ms); } catch { /* iOS: silently skip */ }
}

// ---- microphone level meter (balloon breathing) ----
export interface Mic { level(): number; stop(): void }
export async function openMic(): Promise<Mic | null> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return null;
    try { // already denied? go straight to the fallback
      const st = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
      if (st?.state === 'denied') return null;
    } catch { /* Safari: no permission query for the mic */ }
    let late = false;
    const req = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
    const stream = await Promise.race([req, new Promise<null>((r) => setTimeout(() => { late = true; r(null); }, 10000))]);
    if (!stream) { req.then((s) => late && s.getTracks().forEach((t) => t.stop())).catch(() => {}); return null; }
    const c = ensure(); if (!c) { stream.getTracks().forEach((t) => t.stop()); return null; }
    const src = c.createMediaStreamSource(stream);
    const an = c.createAnalyser(); an.fftSize = 512;
    src.connect(an); // not connected to destination: never plays back
    const buf = new Uint8Array(an.fftSize);
    return {
      level() {
        an.getByteTimeDomainData(buf);
        let s = 0; for (const v of buf) { const x = (v - 128) / 128; s += x * x; }
        return Math.sqrt(s / buf.length);
      },
      stop() { src.disconnect(); stream.getTracks().forEach((t) => t.stop()); },
    };
  } catch { return null; }
}
