// The calm corner: the key feature. Pauses whatever is underneath, offers slow, regulating activities.
import { h, frag, sleep, clamp } from '../core/dom';
import { P } from '../art/props';
import { mokaSvg, setMoka } from '../art/moka';
import { asset } from '../content/stations';
import { sfx, haptic, openMic, Mic } from '../core/audio';
import { speak, stopSpeaking } from '../core/speech';
import { pauseGame } from '../core/pause';
import { day, saveDay, logCalm, settings } from '../core/storage';
import { confetti, holdButton, overlay } from './ui';
import { text } from '../content/phrases';

export type Feeling = 'calm' | 'meh' | 'upset';
type Activity = 'water' | 'ball' | 'pet' | 'breath';
const ACT_LABEL: Record<Activity, string> = { water: 'לשתות מים', ball: 'ללחוץ כדור', pet: 'ללטף את מוקה', breath: 'לנפח בלון' };

/** Auto-trigger prompt. Resolves true if he wants to go to the calm corner. */
export function offerCalm(): Promise<boolean> {
  return new Promise((res) => {
    pauseGame(true);
    const moka = mokaSvg('concerned');
    const mk = h('div', { class: 'mokaw' }, moka);
    const close = (yes: boolean) => { p.remove(); stopSpeaking(); pauseGame(false); res(yes); };
    const come = h('button', { 'data-testid': 'calm-yes', onclick: () => close(true) }, frag(P.cloudBtn()), h('span', {}, 'בוא עם מוקה'));
    const keep = h('button', { 'data-testid': 'calm-no', onclick: () => close(false) }, frag(P.play()), h('span', {}, 'להמשיך לשחק'));
    (keep.firstChild as SVGElement).style.color = '#7fb9de';
    const p = h('div', { class: 'prompt', 'data-testid': 'calm-prompt' }, h('div', { class: 'say' }, text('calm.offer')), mk, h('div', { class: 'choices' }, come, keep));
    overlay().append(p);
    speak('calm.offer');
  });
}

function feelings(ask = true): Promise<Feeling> {
  return new Promise((res) => {
    const faces = h('div', { class: 'faces' });
    (['calm', 'meh', 'upset'] as Feeling[]).forEach((k) => {
      faces.append(h('button', { 'data-testid': 'feel-' + k, 'aria-label': k, onclick: () => { sfx.soft(); res(k); } }, frag(P.face(k))));
    });
    host.replaceChildren(h('div', { class: 'title' }, text('calm.feel.ask')), faces);
    if (ask) speak('calm.feel.ask');
  });
}

let host: HTMLElement;
let mokaEl: HTMLElement;

const raf = (fn: (dt: number) => boolean | void) => {
  let last = performance.now(), id = 0, stopped = false;
  const f = (t: number) => { if (stopped) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; if (fn(dt) === true) return; id = requestAnimationFrame(f); };
  id = requestAnimationFrame(f);
  return () => { stopped = true; cancelAnimationFrame(id); };
};
const progressBar = () => { const i = h('i'); const b = h('div', { class: 'progress' }, i); return { b, set: (p: number) => (i.style.width = clamp(p, 0, 1) * 100 + '%') }; };
const photo = (p: string) => h('img', { class: 'photo', src: asset(`calm/${p}.webp`), draggable: 'false', alt: '' });

// ---------- activities (each resolves when done) ----------
function water(): Promise<void> {
  return new Promise((res) => {
    const prog = progressBar();
    const box = h('div', { class: 'glassbox', 'data-t': '1', 'data-testid': 'glass' }); box.innerHTML = P.glass(1);
    const wt = () => box.querySelector('.water') as SVGRectElement;
    host.replaceChildren(photo('drink-water'), box, prog.b);
    speak('calm.water.how');
    let level = 1, holding = false, nextGulp = 0, stop = () => {};
    box.addEventListener('pointerdown', (e) => { box.setPointerCapture(e.pointerId); holding = true; setMoka(mokaEl, 'idle'); });
    ['pointerup', 'pointercancel'].forEach((ev) => box.addEventListener(ev, () => (holding = false)));
    stop = raf((dt) => {
      if (!holding) return;
      level = Math.max(0, level - dt / 24); nextGulp -= dt;
      if (nextGulp <= 0) { sfx.gulp(); haptic(12); nextGulp = 1.5; }
      const el = wt(); el.setAttribute('y', String(16 + 72 * (1 - level))); el.setAttribute('height', String(72 * level + 2));
      prog.set(1 - level);
      if (level <= 0) { stop(); setTimeout(res, 600); return true; }
    });
  });
}

function ball(): Promise<void> {
  return new Promise((res) => {
    const prog = progressBar();
    const box = h('div', { class: 'ballbox', 'data-t': '1', 'data-testid': 'ball' }); box.innerHTML = P.ball();
    host.replaceChildren(photo('squeeze-sensory-ball'), box, prog.b);
    speak('calm.ball.how');
    let held = 0, holding = false, count = 0, pulse = 0, stop = () => {};
    box.addEventListener('pointerdown', (e) => { box.setPointerCapture(e.pointerId); holding = true; held = 0; box.style.transition = 'none'; });
    const release = () => {
      if (!holding) return; holding = false;
      box.style.transition = 'transform .9s cubic-bezier(.2,1.8,.4,1)'; box.style.transform = 'none'; sfx.boing();
      if (held >= 1.5) { count++; prog.set(count / 5); sfx.chime(count); if (count >= 5) { stop(); setTimeout(res, 900); } }
      else speak('calm.ball.how');
    };
    ['pointerup', 'pointercancel'].forEach((ev) => box.addEventListener(ev, release));
    stop = raf((dt) => {
      if (!holding) return;
      held += dt; const p = clamp(held / 1.8, 0, 1);
      box.style.transform = `scale(${1 + p * 0.28}, ${1 - p * 0.42})`;
      pulse -= dt; if (pulse <= 0) { haptic(25); sfx.squish(p); pulse = 0.45; }
    });
  });
}

function pet(): Promise<void> {
  return new Promise((res) => {
    const prog = progressBar();
    const m = mokaSvg('idle'); const box = h('div', { style: 'width:min(60vw,250px);touch-action:none', 'data-t': '1', 'data-testid': 'pet' }, m);
    host.replaceChildren(photo('pet-the-dog'), box, prog.b);
    speak('calm.pet.how');
    let calm = 0, lx = 0, ly = 0, lt = 0, speed = 0, down = false, lastSlowAt = 0, lastWarn = -9, slowFor = 0, stop = () => {};
    box.addEventListener('pointerdown', (e) => { box.setPointerCapture(e.pointerId); down = true; lx = e.clientX; ly = e.clientY; lt = performance.now(); });
    box.addEventListener('pointermove', (e) => {
      if (!down) return; const t = performance.now(); const dtm = Math.max(1, t - lt);
      const v = (Math.hypot(e.clientX - lx, e.clientY - ly) / dtm) * 1000; // px/s
      speed = speed * 0.6 + v * 0.4; lx = e.clientX; ly = e.clientY; lt = t;
    });
    ['pointerup', 'pointercancel'].forEach((ev) => box.addEventListener(ev, () => { down = false; speed = 0; }));
    stop = raf((dt) => {
      const now = performance.now() / 1000;
      if (down) speed *= 0.97;
      const moving = down && speed > 15;
      if (moving && speed > 650) { // too fast
        slowFor = 0; setMoka(m, 'concerned', 'open');
        if (now - lastWarn > 5) { lastWarn = now; speak('calm.pet.slow'); }
      } else if (moving) { // slow & gentle
        slowFor += dt; lastSlowAt = now;
        if (slowFor > 0.6) { setMoka(m, 'happy', 'closed'); calm += dt; prog.set(calm / 14); }
      } else if (now - lastSlowAt > 1.2) { slowFor = 0; if (m.dataset.state !== 'idle') setMoka(m, 'idle', 'open'); }
      if (calm >= 14) { stop(); setMoka(m, 'happy', 'closed'); setTimeout(res, 1200); return true; }
    });
  });
}

function breath(): Promise<void> {
  return new Promise(async (res) => {
    const CYCLES = 4;
    const prog = progressBar();
    const ring = h('div', { class: 'breathring' });
    const bal = h('div', { style: 'width:150px;height:190px;transition:transform .3s;transform-origin:50% 100%;position:relative;z-index:2' }); bal.innerHTML = P.balloon('#ff9bb3');
    const label = h('div', { class: 'title', style: 'min-height:44px;margin:0' });
    const box = h('div', { class: 'balloonbox' }, ring, bal);
    const dots = h('div', { style: 'display:flex;gap:10px' }, ...Array.from({ length: CYCLES }, () => h('i', { style: 'width:18px;height:18px;border-radius:50%;background:#fff;opacity:.6' })));
    host.replaceChildren(label, box, dots, prog.b);
    const micP = openMic(); // permission prompt may take a while: the screen is already showing
    const mic: Mic | null = await micP;
    document.body.dataset.mic = mic ? 'mic' : 'fallback';
    const setRing = (p: number) => { const s = 70 + p * 150; ring.style.width = ring.style.height = s + 'px'; };
    setRing(0);
    let done = 0, size = 0;
    const finish = () => { mic?.stop(); setTimeout(res, 900); };
    const cycleDone = () => { (dots.children[done] as HTMLElement).style.cssText += ';background:#7fd6a0;opacity:1'; done++; size = done / CYCLES; bal.style.transform = `scale(${0.55 + size * 0.7})`; prog.set(done / CYCLES); sfx.chime(done); };
    bal.style.transform = 'scale(.55)';
    if (mic) {
      speak('calm.breath.how');
      await sleep(1800);
      for (let c = 0; c < CYCLES; c++) {
        label.textContent = text('calm.breath.in'); speak('calm.breath.in'); sfx.breathe(true, 4);
        for (let t = 0; t < 4; t += 0.05) { setRing(t / 4); await sleep(50); }
        label.textContent = text('calm.breath.out'); speak('calm.breath.out'); sfx.breathe(false, 4);
        let gain = 0;
        for (let t = 0; t < 4; t += 0.05) {
          setRing(1 - t / 4);
          const l = mic.level(); document.body.dataset.miclevel = l.toFixed(3);
          gain += (0.4 + 0.6 * Math.min(1, l / 0.05)) * 0.05 / 4; // blowing inflates more; a soft floor keeps it no-fail
          bal.style.transform = `scale(${0.55 + ((done + gain) / CYCLES) * 0.7})`;
          await sleep(50);
        }
        cycleDone();
      }
      finish();
    } else {
      label.textContent = text('calm.breath.hold'); speak('calm.breath.hold');
      const area = h('div', { style: 'position:absolute;inset:-30px;border-radius:50%;z-index:5', 'data-t': '1', 'data-testid': 'breathhold' }); box.append(area);
      let holding = false, p = 0, filled = false, releasing = false;
      const stop = raf((dt) => {
        if (holding) { p = Math.min(1, p + dt / 4); if (p >= 0.8 && !filled) { filled = true; sfx.chime(0); } }
        else if (releasing) { p = Math.max(0, p - dt / 4); if (p <= 0) { releasing = false; if (filled) { cycleDone(); filled = false; if (done >= CYCLES) { stop(); finish(); return true; } } label.textContent = text('calm.breath.hold'); } }
        setRing(p);
      });
      area.addEventListener('pointerdown', (e) => { area.setPointerCapture(e.pointerId); holding = true; releasing = false; label.textContent = text('calm.breath.in'); sfx.breathe(true, 4); });
      const up = () => { if (!holding) return; holding = false; releasing = true; label.textContent = text('calm.breath.out'); sfx.breathe(false, 4); };
      ['pointerup', 'pointercancel'].forEach((ev) => area.addEventListener(ev, up));
    }
  });
}

const RUN: Record<Activity, () => Promise<void>> = { water, ball, pet, breath };
const BRIDGE: Record<Activity, { id: string; img?: string }> = {
  water: { id: 'calm.bridge.water', img: 'drink-water' }, ball: { id: 'calm.bridge.ball', img: 'squeeze-sensory-ball' },
  pet: { id: 'calm.bridge.pet', img: 'pet-the-dog' }, breath: { id: 'calm.bridge.breath' },
};

function pick(first: boolean): Promise<Activity | 'back'> {
  return new Promise((res) => {
    const tile = (a: Activity, ic: Node) => h('button', { class: 'tile', 'data-testid': 'act-' + a, onclick: () => { sfx.tap(); res(a); } }, h('div', { class: 'ic' }, ic), h('div', {}, ACT_LABEL[a]));
    const thumb = (n: string) => h('img', { src: asset(`calm/${n}.webp`), draggable: 'false', alt: '' });
    const grid = h('div', { class: 'grid2' }, tile('water', thumb('drink-water')), tile('ball', thumb('squeeze-sensory-ball')), tile('pet', thumb('pet-the-dog')), tile('breath', frag(P.balloon())));
    host.replaceChildren(h('div', { class: 'title' }, text(first ? 'calm.pick' : 'calm.feel.more')), grid,
      h('button', { class: 'smallbtn', style: 'margin-top:16px', 'data-testid': 'calm-back', onclick: () => res('back') }, 'חזרה למשחק'));
    speak(first ? 'calm.pick' : 'calm.feel.more');
  });
}

function bridge(a: Activity): Promise<void> {
  return new Promise((res) => {
    const b = BRIDGE[a];
    const done = () => { res(); };
    host.replaceChildren(
      b.img ? photo(b.img) : h('div', { style: 'width:150px' }, frag(P.balloon())),
      h('div', { class: 'title' }, text(b.id)),
      holdButton(done, { caption: 'הורה: לחיצה ארוכה 3 שניות' }),
      h('button', { class: 'smallbtn', 'data-testid': 'bridge-skip', onclick: done }, 'דלג'));
    speak(b.id);
  });
}

async function medalCelebration(a: Activity) {
  const c = h('div', { class: 'celebrate', 'data-testid': 'medal', style: 'z-index:5' });
  const med = frag(P.medal()); med.classList.add('bigstar'); (med as unknown as HTMLElement).style.width = '170px'; (med as unknown as HTMLElement).style.height = '170px';
  c.append(med, h('div', { class: 'title' }, text('calm.medal')), h('div', { style: 'width:150px' }, mokaSvg('happy')));
  confetti(c, 30); host.parentElement!.append(c);
  sfx.big(); haptic([30, 60, 30]); speak('calm.medal');
  day.medals.push({ id: `${Date.now()}`, activity: a, t: Date.now() }); saveDay();
  await sleep(4200);
  c.remove();
}

/** Open the calm corner. Resolves when he returns to where he left off. */
export async function openCalm(auto: boolean): Promise<void> {
  pauseGame(true);
  mokaEl = mokaSvg('idle');
  host = h('div', { class: 'act' });
  const root = h('div', { class: 'calm', 'data-testid': 'calm' }, h('div', { class: 'mokac' }, mokaEl), host);
  document.body.append(root);
  speak('calm.welcome');
  await sleep(500);
  const before = await feelings();
  let after: Feeling | 'left' = 'left'; let medal = false; let first = true; let last: Activity = 'water'; const used: Activity[] = [];
  for (;;) {
    const a = await pick(first); first = false;
    if (a === 'back') break;
    last = a; used.push(a);
    await RUN[a]();
    setMoka(mokaEl, 'happy'); sfx.success(); speak('calm.nice');
    await sleep(1400);
    setMoka(mokaEl, 'idle');
    after = await feelings();
    if (after === 'calm') {
      setMoka(mokaEl, 'happy'); speak('calm.feel.green'); await sleep(1600);
      await bridge(a);
      await medalCelebration(a); medal = true; break;
    }
  }
  logCalm({ t: Date.now(), auto, activity: used.join('+') || last, before, after, medal });
  stopSpeaking();
  root.remove(); pauseGame(false);
  void settings;
}
