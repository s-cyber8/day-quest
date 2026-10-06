// Spoken lines. Priority: parent recording -> speechSynthesis he-IL -> caption + soft chime.
import { PHRASES } from '../content/phrases';
import { recGet } from './storage';
import { settings } from './storage';
import { sfx } from './audio';

export type SpeechMode = 'recording' | 'tts' | 'chime';
let current: HTMLAudioElement | null = null;
let token = 0;
let heVoice: SpeechSynthesisVoice | null | undefined;
const captionListeners = new Set<(t: string) => void>();
export const onCaption = (f: (t: string) => void) => { captionListeners.add(f); return () => captionListeners.delete(f); };

function findVoice(): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis?.getVoices?.() ?? [];
  return vs.find((v) => /^he(-|_|$)/i.test(v.lang) || /^iw/i.test(v.lang)) ?? null;
}
export function hasHebrewVoice() { return !!findVoice(); }
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener?.('voiceschanged', () => { heVoice = undefined; });
}

export function stopSpeaking() {
  token++;
  if (current) { current.pause(); current = null; }
  try { speechSynthesis?.cancel(); } catch { /* */ }
}

function setMode(m: SpeechMode) { document.body.dataset.speech = m; }

async function playOne(id: string | null, txt: string, my: number): Promise<void> {
  captionListeners.forEach((f) => f(txt));
  // 1. parent recording
  if (id) {
    const rec = await recGet(id);
    if (my !== token) return;
    if (rec) {
      try {
        const url = URL.createObjectURL(rec.blob);
        const a = new Audio(url); a.volume = settings.volume; current = a;
        setMode('recording');
        await new Promise<void>((res, rej) => {
          a.onended = () => res(); a.onerror = () => rej(new Error('audio'));
          a.play().catch(rej);
        });
        URL.revokeObjectURL(url);
        return;
      } catch { /* fall through to TTS */ }
    }
  }
  if (my !== token) return;
  // 2. speech synthesis
  if (!heVoice) heVoice = findVoice(); // never cache "none": voices load late on some browsers
  if (heVoice && 'speechSynthesis' in window) {
    setMode('tts');
    await new Promise<void>((res) => {
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = 'he-IL'; try { u.voice = heVoice!; } catch { /* lang alone is enough */ } u.rate = 0.88; u.pitch = 1.1; u.volume = settings.volume;
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      u.onend = fin; u.onerror = fin;
      setTimeout(fin, 9000 + txt.length * 120); // safety if the engine never fires onend
      speechSynthesis.speak(u);
    });
    return;
  }
  // 3. fallback: caption (already shown) + soft chime
  setMode('chime'); sfx.soft();
  await new Promise((r) => setTimeout(r, 900 + txt.length * 45));
}

/** Speak phrase ids (or raw text) in sequence. Resolves when finished or interrupted. */
export async function speak(...parts: string[]): Promise<void> {
  stopSpeaking();
  const my = token;
  for (const p of parts) {
    if (my !== token) return;
    const ph = PHRASES[p];
    await playOne(ph ? p : null, ph ? ph.text : p, my);
  }
}
