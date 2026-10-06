#!/usr/bin/env python3
"""CER check of all generated clips (public/audio) against the intended phrase text, local faster-whisper.
   python3 scripts/cer-check.py [--model large-v3] [--ids a,b] [--threshold 0.15]
Writes audio-work/cer-all.json and audio-work/flagged.json (ids above the threshold)."""
import json, os, sys, subprocess, argparse
sys.path.insert(0, os.path.dirname(__file__))
from cer import cer, normalize
ap = argparse.ArgumentParser(); ap.add_argument('--model', default='large-v3'); ap.add_argument('--ids'); ap.add_argument('--threshold', type=float, default=0.15)
a = ap.parse_args()
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(f'{root}/audio-work', exist_ok=True)
subprocess.run(['node', '-e', "import('./src/content/phrases.ts').then(m=>require('fs').writeFileSync('audio-work/phrases.json',JSON.stringify(Object.fromEntries(m.PHRASE_IDS.map(i=>[i,{text:m.PHRASES[i].text,speaker:m.PHRASES[i].speaker}])))))"], cwd=root, check=True)
phr = json.load(open(f'{root}/audio-work/phrases.json'))
man = json.load(open(f'{root}/public/audio/manifest.json'))['clips']
ids = a.ids.split(',') if a.ids else [i for i in phr if i in man]
from faster_whisper import WhisperModel
model = WhisperModel(a.model, device='cpu', compute_type='int8')
prev = {}
if os.path.exists(f'{root}/audio-work/cer-all.json'): prev = {r['id']: r for r in json.load(open(f'{root}/audio-work/cer-all.json'))}
res = dict(prev)
for i in ids:
    f = f"{root}/public/audio/{phr[i]['speaker']}/{i}.mp3"
    segs, _ = model.transcribe(f, language='he', beam_size=5, condition_on_previous_text=False)
    hyp = ' '.join(s.text.strip() for s in segs)
    res[i] = {'id': i, 'speaker': phr[i]['speaker'], 'text': phr[i]['text'], 'hyp': hyp, 'cer': round(cer(phr[i]['text'], hyp), 4), 'hash': man[i]['hash']}
    print(f"{res[i]['cer']*100:5.1f}%  {i}  | {hyp}", flush=True)
    json.dump(list(res.values()), open(f'{root}/audio-work/cer-all.json', 'w'), ensure_ascii=False, indent=1)
flag = [r['id'] for r in res.values() if r['cer'] > a.threshold]
json.dump({'flagged': flag}, open(f'{root}/audio-work/flagged.json', 'w'), indent=1)
allc = [r['cer'] for r in res.values()]
print(f"\n{len(allc)} clips, mean CER {100*sum(allc)/len(allc):.2f}%, flagged (> {a.threshold*100:.0f}%): {len(flag)}")
