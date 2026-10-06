// Shared helper for the ElevenLabs scripts. Reads the key from .env; never prints it.
import fs from 'node:fs';
export function key() {
  const env = Object.fromEntries(fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
  if (!env.ELEVENLABS_API_KEY) { console.error('ELEVENLABS_API_KEY missing in .env'); process.exit(1); }
  return env.ELEVENLABS_API_KEY;
}
export const API = 'https://api.elevenlabs.io';
export async function api(path, init = {}) {
  const r = await fetch(API + path, { ...init, headers: { 'xi-api-key': key(), ...(init.headers || {}) } });
  return r;
}
