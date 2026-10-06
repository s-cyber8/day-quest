// Spoken lines. Everything plays through the Web Audio context that SFX already use (the one iOS unlocks).
// Priority: parent recording -> bundled voice-over -> speechSynthesis he-IL (last resort) -> caption + soft chime.
import { PHRASES } from '../content/phrases';
import { recGet, settings } from './storage';
import { sfx, audioCtx, playSpeechBuffer, decode, unlockAudio } from './audio';

export type SpeechMode = 'recording' | 'bundled' | 'tts' | 'chime';
let stopCurrent: (() => void) | null = null;
let token = 0;
let heVoice: SpeechSynthesisVoice | null = null;
const captionListeners = new Set<(t: string) => void>();
export const onCaption = (f: (t: string) => void) => { captionListeners.add(f); return () => captionListeners.delete(f); };

const cache = new Map<string, AudioBuffer>();
let manifest: Record<string, { hash: string }> | null | undefined;
const BASE = import.meta.env.BASE_URL;

function findVoice(): SpeechSynthesisVoice | null {
  const vs = (typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices?.()) || [];
  return vs.find((v) => /^he(-|_|$)/i.test(v.lang) || /^iw/i.test(v.lang)) ?? null;
}
export function hasHebrewVoice() { return !!findVoice(); }

export function stopSpeaking() {
  token++;
  stopCurrent?.(); stopCurrent = null;
  try { speechSynthesis?.cancel(); } catch { /* */ }
}
function setMode(m: SpeechMode) { document.body.dataset.speech = m; }

async function loadManifest() {
  if (manifest !== undefined) return manifest;
  try { const r = await fetch(`${BASE}audio/manifest.json`); manifest = r.ok ? (await r.json()).clips ?? null : null; } catch { manifest = null; }
  return manifest;
}
export async function bundledUrl(id: string): Promise<string | null> {
  const m = await loadManifest(); const ph = PHRASES[id];
  if (!m || !ph || !m[id]) return null;
  return `${BASE}audio/${ph.speaker}/${id}.mp3`;
}

async function bufferFor(key: string, get: () => Promise<ArrayBuffer | null>): Promise<AudioBuffer | null> {
  const hit = cache.get(key); if (hit) return hit;
  try {
    const data = await get(); if (!data) return null;
    const b = await decode(data); cache.set(key, b); return b;
  } catch { return null; }
}
const recBuffer = (id: string) => bufferFor('rec:' + id, async () => { const r = await recGet(id); return r ? r.blob.arrayBuffer() : null; });
const bundledBuffer = (id: string) => bufferFor('b:' + id, async () => { const u = await bundledUrl(id); if (!u) return null; const r = await fetch(u); return r.ok ? r.arrayBuffer() : null; });
export const dropRecordingCache = (id: string) => cache.delete('rec:' + id);

/** Preload decoded buffers so the next screen's lines start instantly. */
export function preload(ids: string[]) { ids.forEach((id) => { recBuffer(id).then((b) => b || bundledBuffer(id)); }); }

function play(buf: AudioBuffer): Promise<void> {
  return new Promise((res) => { stopCurrent = playSpeechBuffer(buf, () => { stopCurrent = null; res(); }); });
}

async function playOne(id: string | null, txt: string, my: number): Promise<SpeechMode> {
  captionListeners.forEach((f) => f(txt));
  if (id) {
    const rb = await recBuffer(id);
    if (my !== token) return 'chime';
    if (rb) { setMode('recording'); await play(rb); return 'recording'; }
    const bb = await bundledBuffer(id);
    if (my !== token) return 'chime';
    if (bb) { setMode('bundled'); await play(bb); return 'bundled'; }
  }
  if (my !== token) return 'chime';
  if (!heVoice) heVoice = findVoice(); // never cache "none": voices load late on some browsers
  if (heVoice && 'speechSynthesis' in window) {
    setMode('tts');
    await new Promise<void>((res) => {
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = 'he-IL'; try { u.voice = heVoice!; } catch { /* lang alone is enough */ }
      u.rate = 0.88; u.pitch = 1.1; u.volume = settings.volume;
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      u.onend = fin; u.onerror = fin;
      setTimeout(fin, 9000 + txt.length * 120);
      speechSynthesis.speak(u);
    });
    return 'tts';
  }
  setMode('chime'); sfx.soft();
  await new Promise((r) => setTimeout(r, 900 + txt.length * 45));
  return 'chime';
}

/** Speak phrase ids (or raw text) in sequence. A new call stops the previous line. */
export async function speak(...parts: string[]): Promise<void> {
  stopSpeaking();
  const my = token;
  for (const p of parts) {
    if (my !== token) return;
    const ph = PHRASES[p];
    await playOne(ph ? p : null, ph ? ph.text : p, my);
  }
}

/** Parent mode: play the bundled (ElevenLabs) clip itself, regardless of any parent recording. */
export async function playBundled(id: string): Promise<boolean> {
  unlockAudio(); stopSpeaking();
  const b = await bundledBuffer(id);
  if (!b) return false;
  setMode('bundled'); await play(b); return true;
}

/** Parent-mode "test sound": plays one bundled clip (if any), one SFX, reports which speech path was used. */
export async function testSound(): Promise<string> {
  unlockAudio();
  const c = audioCtx();
  const out: string[] = [`AudioContext: ${c ? c.state : 'none'}`];
  stopSpeaking(); const my = token;
  const url = await bundledUrl('st.2.announce');
  out.push(url ? 'bundled clip: found' : 'bundled clip: none yet');
  sfx.chime(0);
  const mode = await playOne('st.2.announce', PHRASES['st.2.announce'].text, my);
  out.push(`speech path used: ${mode}`);
  return out.join(' · ');
}
