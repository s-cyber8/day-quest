// Story-world progress (permanent: stickers are never removed) and the local play log behind the parent "What we're learning" screen.
import type { FeelKey } from '../content/stories';

export interface StoryProg { done: boolean; plays: number; bestHearts: number; golden: boolean }
export interface PlayLog {
  id: string; t: number; story: string; feeling: FeelKey; intensity: 'little' | 'lot';
  /** first choice: good / bad / third (third = ignoring in s02 = bad, saying the feeling in words in s10 = good) */
  choice: 'good' | 'bad' | 'third'; third?: 'ignore' | 'words'; good: boolean;
  repaired: boolean; rewinds: number; ms: number; finished: boolean;
}
const K = { prog: 'dq.stories', log: 'dq.storylog', meta: 'dq.storymeta' };
const rd = <T,>(k: string, f: T): T => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : f; } catch { return f; } };
const wr = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

export const allProg = (): Record<string, StoryProg> => rd(K.prog, {});
export const progOf = (sid: string): StoryProg => allProg()[sid] ?? { done: false, plays: 0, bestHearts: 0, golden: false };
export function saveProg(sid: string, patch: Partial<StoryProg>) { const m = allProg(); m[sid] = { ...progOf(sid), ...patch }; wr(K.prog, m); }

export const introSeen = (): boolean => !!rd<{ intro?: boolean }>(K.meta, {}).intro;
export const markIntroSeen = () => wr(K.meta, { ...rd(K.meta, {}), intro: true });

export const loadPlays = (): PlayLog[] => rd(K.log, [] as PlayLog[]);
export function upsertPlay(p: PlayLog) {
  const l = loadPlays(); const i = l.findIndex((x) => x.id === p.id);
  if (i >= 0) l[i] = p; else l.push(p);
  wr(K.log, l.slice(-500));
}
export const resetStories = () => { try { [K.prog, K.log, K.meta].forEach((k) => localStorage.removeItem(k)); } catch { /* */ } };
