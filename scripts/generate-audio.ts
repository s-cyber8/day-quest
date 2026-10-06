// Voice-over generation (ElevenLabs). Never imported by app code; the API key stays in .env.
//   node scripts/generate-audio.ts                  # generate what is missing or changed
//   node scripts/generate-audio.ts flagged.json     # only the phrase ids listed in flagged.json (forces regeneration)
//   node scripts/generate-audio.ts --normalize      # only re-run ffmpeg on the raw clips (no credits)
// Output: audio-work/raw/<speaker>/<id>.mp3 (git-ignored) -> public/audio/<speaker>/<id>.mp3 + public/audio/manifest.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PHRASES, PHRASE_IDS } from '../src/content/phrases.ts';
import { api } from './lib-eleven.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const RAW = path.join(ROOT, 'audio-work/raw'), OUT = path.join(ROOT, 'public/audio');
const LEDGER = path.join(ROOT, 'audio-work/ledger.json');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/voice-config.json'), 'utf8'));
const NIQQUD: Record<string, string> = fs.existsSync(path.join(ROOT, 'scripts/niqqud.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/niqqud.json'), 'utf8')) : {};
const OVERRIDES: Record<string, string> = fs.existsSync(path.join(ROOT, 'scripts/tts-overrides.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/tts-overrides.json'), 'utf8')) : {};
const STOP = 8500;

fs.mkdirSync(RAW, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : { total: CONFIG.creditsBefore ?? 0, calls: [] };
const saveLedger = () => fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
const manifestPath = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { version: 1, clips: {} };

/** pronunciation text: explicit `tts` field, else the display text with per-word niqqud from scripts/niqqud.json */
export function ttsText(id: string): string {
  const ph = PHRASES[id];
  if (OVERRIDES[id]) return OVERRIDES[id]; // per-phrase pointed text added after the CER check
  if (ph.tts) return ph.tts;
  return ph.text.split(/(\s+)/).map((w) => { const bare = w.replace(/[.,!?:;…]+$/g, ''); const tail = w.slice(bare.length); return (NIQQUD[bare] ?? bare) + tail; }).join('');
}
const voiceFor = (speaker: string) => CONFIG[speaker];
const hashOf = (id: string) => { const v = voiceFor(PHRASES[id].speaker); return crypto.createHash('sha1').update(JSON.stringify([ttsTextFinal(id), v.voice_id, v.model, v.settings, v.tags ?? ''])).digest('hex').slice(0, 12); };
/** text actually sent (adds the speaker's gentle audio tag if configured, v3/v4 only) */
function ttsTextFinal(id: string) { const v = voiceFor(PHRASES[id].speaker); return (v.tags ? v.tags + ' ' : '') + ttsText(id); }

async function synth(id: string) {
  const ph = PHRASES[id]; const v = voiceFor(ph.speaker); const text = ttsTextFinal(id);
  if (ledger.total + text.length > STOP) throw new Error(`credit stop: ${ledger.total} used, next clip would pass ${STOP}`);
  const body = { text, model_id: v.model, voice_settings: v.settings };
  let r: Response | undefined;
  for (let a = 0; a < 5; a++) {
    r = await api(`/v1/text-to-speech/${v.voice_id}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 2000 * (a + 1))); continue; }
    break;
  }
  if (!r!.ok) throw new Error(`${id}: ${r!.status} ${(await r!.text()).slice(0, 160)}`);
  const cost = Number(r!.headers.get('character-cost') ?? text.length);
  const dir = path.join(RAW, ph.speaker); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id + '.mp3'), Buffer.from(await r!.arrayBuffer()));
  ledger.total += cost; ledger.calls.push({ id, cost }); saveLedger();
  return cost;
}

/** trim silence, loudness-normalize (~ -16 LUFS), mono 64 kbps */
function normalize(id: string) {
  const sp = PHRASES[id].speaker; const src = path.join(RAW, sp, id + '.mp3'); const dst = path.join(OUT, sp, id + '.mp3');
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const af = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,loudnorm=I=-16:TP=-1.5:LRA=11';
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-af', af, '-ac', '1', '-ar', '44100', '-b:a', '64k', dst]);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst]).toString().trim());
  return { bytes: fs.statSync(dst).size, dur: Math.round(dur * 100) / 100 };
}

const args = process.argv.slice(2);
const onlyNormalize = args.includes('--normalize');
const flagFile = args.find((a) => a.endsWith('.json'));
let ids = PHRASE_IDS;
let force = false;
if (flagFile) { const f = JSON.parse(fs.readFileSync(flagFile, 'utf8')); ids = (Array.isArray(f) ? f : f.flagged ?? f.ids).map((x: string | { id: string }) => (typeof x === 'string' ? x : x.id)); force = true; }

const todo = ids.filter((id) => force || onlyNormalize || manifest.clips[id]?.hash !== hashOf(id) || !fs.existsSync(path.join(RAW, PHRASES[id].speaker, id + '.mp3')));
console.log(`${todo.length} of ${ids.length} clips to process; credits so far ${ledger.total}`);
let used = 0;
const queue = [...todo];
async function worker() {
  while (queue.length) {
    const id = queue.shift()!;
    try {
      if (!onlyNormalize) used += await synth(id);
      const m = normalize(id);
      manifest.clips[id] = { hash: hashOf(id), speaker: PHRASES[id].speaker, ...m };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));
      process.stdout.write('.');
    } catch (e) { console.error('\nFAIL', id, (e as Error).message); if (String((e as Error).message).startsWith('credit stop')) { queue.length = 0; } }
  }
}
await Promise.all([worker(), worker()]);
// drop manifest entries for phrases that no longer exist
for (const id of Object.keys(manifest.clips)) if (!PHRASES[id]) delete manifest.clips[id];
fs.writeFileSync(manifestPath, JSON.stringify(manifest));
console.log(`\ndone. credits used this run: ${used}; total ledger: ${ledger.total}; clips in manifest: ${Object.keys(manifest.clips).length}`);
