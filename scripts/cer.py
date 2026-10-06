#!/usr/bin/env python3
"""Local pronunciation check: transcribe clips with faster-whisper (language=he) and compute character error rate
against the intended text. Nothing is uploaded. Usage:
  python3 scripts/cer.py items.json out.json [--dir clips] [--model large-v3]
items.json: [{"file": "x.mp3", "text": "intended text (may contain niqqud / [tags])"}, ...]
"""
import json, re, sys, os, argparse, unicodedata

def normalize(s: str) -> str:
    s = re.sub(r'\[[^\]]*\]', ' ', s)                 # audio tags
    s = re.sub(r'[֑-ׇ]', '', s)             # niqqud + cantillation
    s = unicodedata.normalize('NFKC', s)
    s = re.sub(r"[\"'`׳״’‘“”.,!?;:()\-–—־…]", ' ', s)  # punctuation, geresh, maqaf
    s = re.sub(r'\s+', '', s)                         # whitespace
    return s

def lev(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]

def cer(ref: str, hyp: str) -> float:
    r, h = normalize(ref), normalize(hyp)
    return 0.0 if not r else lev(r, h) / len(r)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('items'); ap.add_argument('out')
    ap.add_argument('--dir', default=None); ap.add_argument('--model', default='large-v3')
    a = ap.parse_args()
    from faster_whisper import WhisperModel
    model = WhisperModel(a.model, device='cpu', compute_type='int8')
    items = json.load(open(a.items))
    base = a.dir or os.path.dirname(os.path.abspath(a.items))
    done = {}
    if os.path.exists(a.out):
        done = {r['file']: r for r in json.load(open(a.out))}
    out = []
    for it in items:
        f = it.get('file')
        if not f: continue
        if f in done and done[f].get('text') == it['text']:
            out.append(done[f]); continue
        segs, _ = model.transcribe(os.path.join(base, f), language='he', beam_size=5, vad_filter=False, condition_on_previous_text=False)
        hyp = ' '.join(s.text.strip() for s in segs)
        out.append({**it, 'hyp': hyp, 'cer': round(cer(it['text'], hyp), 4)})
        json.dump(out, open(a.out, 'w'), ensure_ascii=False, indent=1)
        print(f"{out[-1]['cer']*100:5.1f}%  {f}  | {hyp}", flush=True)
    json.dump(out, open(a.out, 'w'), ensure_ascii=False, indent=1)
