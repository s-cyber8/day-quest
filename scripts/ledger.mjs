// Shared credit ledger for this session's ElevenLabs work (audition + generation). The API key has no user_read permission,
// so remaining credits cannot be queried: every call's character-cost is summed here and the run stops before STOP_AT.
import fs from 'node:fs';
const FILE = new URL('../audio-work/ledger-v2.json', import.meta.url).pathname;
export const STOP_AT = 28000;
export const read = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { total: 0, calls: [] });
export function add(label, cost) { const l = read(); l.total += cost; l.calls.push({ label, cost }); fs.writeFileSync(FILE, JSON.stringify(l, null, 1)); return l.total; }
export function guard(chars) { const l = read(); if (l.total + chars > STOP_AT) throw new Error(`credit stop: ${l.total} used, next call (${chars}) would pass ${STOP_AT}`); }
