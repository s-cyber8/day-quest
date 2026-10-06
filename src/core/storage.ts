import { dayKeyOf } from './dom';

export interface Settings {
  volume: number; // 0..1
  pin: string; // '' or 4 digits
  unlock: string; // HH:MM morning unlock
  rageTaps: number;
  rageWindowMs: number;
  missStreak: number;
  cooldownMin: number;
  reducedMotion: boolean;
  days: Record<number, number[]>; // weekday (0=Sun) -> active station ids
}
export interface CalmVisit {
  t: number; auto: boolean; activity: string; before: string; after: string; medal: boolean;
}
export interface Medal { id: string; activity: string; t: number }
export interface DayState {
  key: string;
  done: number[];
  skipped: number[];
  medals: Medal[];
  night: boolean;
}
export interface LogDay { key: string; stations: number[]; calm: CalmVisit[] }

const ALL = Array.from({ length: 13 }, (_, i) => i + 1);
export const defaultSettings = (): Settings => ({
  volume: 0.7, pin: '', unlock: '06:00',
  rageTaps: 6, rageWindowMs: 1500, missStreak: 3, cooldownMin: 3,
  reducedMotion: false,
  days: { 0: [...ALL], 1: [...ALL], 2: [...ALL], 3: [...ALL], 4: [...ALL], 5: [...ALL], 6: [...ALL] },
});

const K = { settings: 'dq.settings', day: 'dq.day', log: 'dq.log' };

function read<T>(k: string, fallback: T): T {
  try { const s = localStorage.getItem(k); return s ? { ...fallback, ...JSON.parse(s) } : fallback; } catch { return fallback; }
}
function write(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }

export let settings: Settings = read(K.settings, defaultSettings());
export const saveSettings = () => write(K.settings, settings);

const freshDay = (key: string): DayState => ({ key, done: [], skipped: [], medals: [], night: false });
export let day: DayState = read(K.day, freshDay(''));
export const saveDay = () => write(K.day, day);

export function loadLog(): LogDay[] {
  try { return JSON.parse(localStorage.getItem(K.log) || '[]'); } catch { return []; }
}
function logDay(): LogDay {
  const log = loadLog();
  let d = log.find((l) => l.key === day.key);
  if (!d) { d = { key: day.key, stations: [], calm: [] }; log.push(d); }
  return d;
}
function commitLog(d: LogDay) {
  const log = loadLog().filter((l) => l.key !== d.key);
  log.push(d);
  log.sort((a, b) => a.key.localeCompare(b.key));
  write(K.log, log.slice(-14));
}
export function logStation(id: number) {
  const d = logDay(); if (!d.stations.includes(id)) d.stations.push(id); commitLog(d);
}
export function logCalm(v: CalmVisit) { const d = logDay(); d.calm.push(v); commitLog(d); }

export const currentDayKey = () => dayKeyOf(new Date(), settings.unlock);

/** Returns true if a new day started (state was reset). */
export function rollDay(): boolean {
  const key = currentDayKey();
  if (day.key === key) return false;
  day = freshDay(key);
  saveDay();
  return true;
}
export function resetToday() { day = freshDay(day.key || currentDayKey()); saveDay();
  const log = loadLog().filter((l) => l.key !== day.key); write(K.log, log); }
export function resetEverything() {
  try { localStorage.removeItem(K.settings); localStorage.removeItem(K.day); localStorage.removeItem(K.log); } catch { /* */ }
  settings = defaultSettings(); day = freshDay(currentDayKey()); saveDay(); saveSettings();
  idbClear();
}

// ---------- voice recordings (IndexedDB) ----------
const DB = 'dq-voice';
function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('rec');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((res, rej) => {
    const r = fn(db.transaction('rec', mode).objectStore('rec'));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export interface Rec { blob: Blob; mime: string }
export const recGet = (id: string) => tx<Rec | undefined>('readonly', (s) => s.get(id)).catch(() => undefined);
export const recPut = (id: string, v: Rec) => tx('readwrite', (s) => s.put(v, id));
export const recDel = (id: string) => tx('readwrite', (s) => s.delete(id));
export const recKeys = () => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).catch(() => [] as IDBValidKey[]);
function idbClear() { tx('readwrite', (s) => s.clear()).catch(() => {}); }

export async function requestPersist() {
  try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
}
