import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { h, frag, sleep } from './core/dom';
import { P } from './art/props';
import { mokaSvg } from './art/moka';
import { Station, asset } from './content/stations';
import { settings, day, saveDay, rollDay, logStation, requestPersist, getProg, saveProg, logCalm } from './core/storage';
import { unlockAudio, sfx, applyVolume } from './core/audio';
import { speak, stopSpeaking, preload } from './core/speech';
import { isPaused } from './core/pause';
import { installRageDetector, onFrustration, setFrustrationEnabled, setGuard, tryOffer } from './core/frustration';
import { setBase, goBack, onBackVisible } from './core/back';
import { setWake } from './core/wake';
import { initCaption, stationCard, holdButton, confetti, askGate, hideCaption } from './screens/ui';
import { renderMap, nextAfter, visibleStations } from './screens/map';
import { renderNight } from './screens/night';
import { renderSticker } from './screens/sticker';
import { renderParent } from './screens/parent';
import { offerCalm, openCalm } from './screens/calm';
import { GAMES } from './games';
import { createCtx, Level, Outcome } from './games/engine';
import { text, PHRASES, PHRASE_IDS } from './content/phrases';

const app = document.getElementById('app')!;
let calmOpen = false;

function mountChrome() {
  app.after(h('div', { id: 'overlay' }), h('div', { id: 'caption', 'aria-live': 'polite' }));
  const back = h('button', { id: 'back', 'data-testid': 'back', 'aria-label': 'חזרה', hidden: true, onclick: () => { sfx.tap(); goBack(); } }, frag(P.arrow()));
  const cloud = h('button', { id: 'cloud', 'data-testid': 'cloud', 'aria-label': 'הפינה השקטה של מוקה', onclick: () => requestCalm(false, 'self') }, frag(P.cloudBtn()));
  cloud.dataset.t = '1'; back.dataset.t = '1';
  document.body.append(back, cloud);
  onBackVisible((v) => { back.hidden = !v; });
  initCaption();
}
const cloudBtn = () => document.getElementById('cloud') as HTMLElement;
const VIEWS_WITH_WAKE = new Set(['announce', 'godo', 'game', 'celebrate', 'retry']);
function setScreen(el: HTMLElement, back: (() => void) | null = null) {
  app.replaceChildren(el);
  const kind = el.dataset.screen || '';
  document.body.dataset.view = kind;
  cloudBtn().hidden = kind === 'night' || kind === 'parent';
  setBase(back);
  setWake(VIEWS_WITH_WAKE.has(kind));
}
const blocked = () => isPaused() || calmOpen || !!document.querySelector('.parent, .pad, .prompt, .calm') || document.body.dataset.view === 'night';

async function requestCalm(auto: boolean, source: 'rage' | 'misses' | 'fails' | 'self') {
  if (calmOpen || document.body.dataset.view === 'night') return;
  calmOpen = true; hideCaption(); setWake(true);
  try { await openCalm(auto, source); } finally { calmOpen = false; setWake(VIEWS_WITH_WAKE.has(document.body.dataset.view || '')); }
}

function applyRM() { document.body.classList.toggle('rm', settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches); }

// ---------------- map / day ----------------
function showMap(from?: Station) {
  setFrustrationEnabled(true);
  setScreen(renderMap({ onStation: runStation, onParent: openParent, onBook: openBook }, from), null);
}
function openBook() { setScreen(renderSticker(() => showMap()), () => showMap()); }
async function openParent() {
  if (!(await askGate())) return;
  stopSpeaking(); setFrustrationEnabled(false);
  let popped = false;
  const close = () => { if (popped) return; popped = true; parent.remove(); cloudBtn().hidden = false; document.body.dataset.view = ''; if (day.night) showNight(false); else showMap(); };
  const parent = renderParent(close, applyRM);
  document.body.append(parent); cloudBtn().hidden = true; document.body.dataset.view = 'parent'; setBase(close);
}

function showNight(fresh: boolean) {
  setFrustrationEnabled(false);
  day.night = true; saveDay();
  setScreen(renderNight(fresh, async () => {
    if (!(await askGate())) return;
    day.night = false; saveDay(); showMap();
  }), null);
}

// ---------------- station flow (cancellable: the back button leaves at any moment) ----------------
interface Flow { cancelled: boolean; dispose?: () => void }
let flow: Flow = { cancelled: true };
function cancelFlow() {
  flow.cancelled = true; flow.dispose?.(); stopSpeaking();
  document.querySelectorAll('.celebrate, .prompt, .retry').forEach((n) => n.remove());
  showMap();
}
const waitClick = (btn: HTMLElement) => new Promise<void>((res) => btn.addEventListener('click', () => res(), { once: true }));

async function runStation(s: Station) {
  stopSpeaking(); setFrustrationEnabled(true);
  flow.cancelled = true; flow.dispose?.();
  const my: Flow = (flow = { cancelled: false });
  const alive = () => !my.cancelled;
  const nxt = nextAfter(s);
  // decode this station's lines (and the shared praise / retry lines) ahead of time so speech starts instantly
  preload([s.announce, s.go, s.labelId, ...(nxt ? [nxt.labelId] : []), 'next.prefix', 'done.cheer', 'game.intro', 'lvl.up', 'star.1', 'star.2', 'star.3',
    ...PHRASE_IDS.filter((i) => i.startsWith(`g.${s.id}.`) || i.startsWith('praise.') || i.startsWith('retry.')), ...(nxt ? [nxt.announce] : [])]);

  // The real-life task + parent confirm completes the station. The game only earns stars and can be left at any time.
  const replay = day.done.includes(s.id);
  if (!replay) {
    // a. announce
    const go = h('button', { class: 'bigbtn', 'data-testid': 'go', 'aria-label': 'מתחילים' }, frag(P.play()), h('span', {}, 'יאללה'));
    const announce = h('div', { class: 'screen announce', 'data-screen': 'announce', 'data-station': String(s.id) },
      h('div', { class: 'center' }, stationCard(s), h('div', { class: 'station-label' }, s.label)),
      nxt ? h('div', { class: 'next', 'data-testid': 'next' }, h('span', {}, 'ואחר כך:'), h('img', { src: asset(`schedule/${nxt.image}.webp`), alt: '' }), h('span', {}, nxt.label)) : h('div'),
      go);
    setScreen(announce, cancelFlow);
    speak(s.announce, ...(nxt ? ['next.prefix', nxt.labelId] : []));
    await waitClick(go); if (!alive()) return; sfx.tap(); stopSpeaking();

    // b. go do it
    await new Promise<void>((res) => {
      const screen = h('div', { class: 'screen godo', 'data-screen': 'godo', 'data-station': String(s.id) },
        stationCard(s, true), h('div', { class: 'mokabig' }, mokaSvg('idle')),
        h('div', { class: 'hint' }, 'עושים את זה באמת. כשמסיימים, ההורה לוחץ על הכפה.'), holdButton(res));
      setScreen(screen, cancelFlow);
      speak(s.go);
    });
    if (!alive()) return;
    day.done.push(s.id); day.confirmed.push(s.id); saveDay();
    logStation(s.id);
    await celebrate({ title: text('done.cheer'), ms: 3800, speakIds: ['done.cheer'] }, my);
    if (!alive()) return;
  } else { speak('game.intro'); }

  // optional game: levels, real wins and losses (never blocks the day)
  const res = await gameLoop(s, my);
  if (!alive() || !res) return;
  day.stars[s.id] = Math.max(day.stars[s.id] ?? 0, res.stars); saveDay();
  await celebrate({ title: text('game.end'), ms: 4200, speakIds: [], stars: res.stars, levelUp: res.levelUp }, my);
  if (!alive()) return;
  const last = visibleStations().at(-1);
  if (last && last.id === s.id) { showNight(true); return; } // winning the bedtime game starts Night Mode
  showMap(replay ? undefined : s);
}

function celebrate(o: { title: string; ms: number; speakIds: string[]; stars?: number; levelUp?: boolean }, my: Flow): Promise<void> {
  return new Promise((res) => {
    setFrustrationEnabled(false);
    const c = h('div', { class: 'celebrate', 'data-testid': 'celebrate', 'data-screen': 'celebrate' });
    const hero = h('img', { class: 'hero2', src: asset('avatar/rafael-football.png'), alt: '', draggable: 'false' });
    const row = o.stars != null ? h('div', { class: 'starrow', 'data-testid': 'starrow', 'data-stars': String(o.stars) }, ...[1, 2, 3].map((i) => { const st = frag(P.star(i <= o.stars! ? '#ffd966' : '#dfe6ec')); st.classList.add('bigstar'); if (i > o.stars!) st.classList.add('dim'); return st; })) : null;
    c.append(row ?? '', hero, h('div', { class: 'title' }, o.levelUp ? text('lvl.up') : o.title), h('div', { class: 'buddy2' }, mokaSvg('happy')));
    confetti(c, 28);
    document.body.append(c); document.body.dataset.view = 'celebrate';
    sfx.big();
    const ids = [...o.speakIds];
    if (o.stars != null) ids.push(`star.${o.stars}`);
    if (o.levelUp) ids.push('lvl.up'); else ids.push(`praise.${1 + Math.floor(Math.random() * 5)}`);
    speak(...ids);
    let done = false;
    const end = async () => {
      if (done) return; done = true;
      if (my.cancelled) { res(); return; }
      c.classList.add('leaving'); await sleep(250); c.remove(); setFrustrationEnabled(true); res();
    };
    setTimeout(end, o.ms);
    const iv = setInterval(() => { if (my.cancelled) { clearInterval(iv); c.remove(); end(); } }, 200);
  });
}

type GameResult = { stars: number; levelUp: boolean } | null;
async function gameLoop(s: Station, my: Flow): Promise<GameResult> {
  const prog = getProg(s.game);
  for (;;) {
    if (my.cancelled) return null;
    const out = await attempt(s, prog.level as Level, my);
    if (my.cancelled || !out) return null;
    if (out.result === 'win') {
      prog.fails = 0; prog.wins++;
      let levelUp = false;
      if (prog.wins >= 2 && prog.level < 3) { prog.level++; prog.wins = 0; levelUp = true; }
      saveProg(s.game, prog);
      return { stars: out.stars, levelUp };
    }
    // lost: never punishing; after 2 fails in a row: easier level + Moka offers a quiet break
    prog.wins = 0; prog.fails++;
    let offerBreak = false;
    if (prog.fails >= 2) { prog.fails = 0; if (prog.level > 1) prog.level--; offerBreak = true; }
    saveProg(s.game, prog);
    const choice = await retryOverlay(my, offerBreak && tryOffer());
    if (my.cancelled) return null;
    if (choice === 'back') { cancelFlow(); return null; }
    if (choice === 'calm') { await requestCalm(true, 'fails'); if (my.cancelled) return null; }
  }
}

function attempt(s: Station, level: Level, my: Flow): Promise<Outcome | null> {
  return new Promise((res) => {
    const stage = h('div', { class: 'stage', 'data-testid': 'stage', 'data-level': String(level) });
    const screen = h('div', { class: 'screen game', 'data-screen': 'game', 'data-game': s.game, 'data-level': String(level), 'data-station': String(s.id) }, h('div', { class: 'thumbrow' }, stationCard(s, true)), stage);
    screen.querySelector<HTMLElement>('.thumbrow .card')!.style.maxWidth = '120px';
    setScreen(screen, cancelFlow); setFrustrationEnabled(true);
    let ctx: ReturnType<typeof createCtx> | null = null;
    my.dispose = () => { ctx?.dispose(); res(null); };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (my.cancelled) return;
      ctx = createCtx(stage, level, (o) => { ctx?.dispose(); my.dispose = undefined; res(o); });
      (window as unknown as { __dqEnd?: (o: Outcome) => void }).__dqEnd = (o) => (o.result === 'win' ? ctx!.win(o.stars) : ctx!.lose());
      GAMES[s.game](ctx);
    }));
  });
}

/** Gentle "almost!" screen: Retry or Back to map. After 2 fails Moka also offers a quiet break. */
function retryOverlay(my: Flow, offerBreak: boolean): Promise<'retry' | 'back' | 'calm'> {
  return new Promise(async (res) => {
    setFrustrationEnabled(false);
    if (offerBreak) {
      const yes = await offerCalm({ id: 'fail.break', keepLabel: 'עוד פעם' });
      setFrustrationEnabled(true);
      res(yes ? 'calm' : 'retry'); return;
    }
    const id = `retry.${1 + Math.floor(Math.random() * 3)}`;
    const o = h('div', { class: 'retry', 'data-testid': 'retry', 'data-screen': 'retry' },
      h('div', { class: 'say' }, text(id)), h('div', { class: 'mokaw' }, mokaSvg('concerned')),
      h('div', { class: 'choices' },
        h('button', { 'data-testid': 'retry-again', onclick: () => fin('retry') }, frag(P.retry()), h('span', {}, 'עוד פעם')),
        h('button', { 'data-testid': 'retry-back', onclick: () => fin('back') }, frag(P.arrow()), h('span', {}, 'למפה'))));
    const fin = (c: 'retry' | 'back') => { o.remove(); stopSpeaking(); setFrustrationEnabled(true); res(c); };
    document.body.dataset.view = 'retry';
    document.body.append(o); speak(id);
    const iv = setInterval(() => { if (my.cancelled) { clearInterval(iv); o.remove(); res('back'); } }, 200);
  });
}

// ---------------- boot ----------------
async function boot() {
  applyRM(); applyVolume();
  mountChrome();
  rollDay();
  installRageDetector();
  setGuard(() => !blocked());
  onFrustration(async (reason) => {
    if (blocked()) return;
    calmOpen = true; const yes = await offerCalm(); calmOpen = false;
    if (yes) await requestCalm(true, reason);
  });

  let unlocked = false;
  document.addEventListener('pointerdown', () => {
    if (unlocked) return; unlocked = true; unlockAudio(); requestPersist();
    try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch { /* */ }
  }, { capture: true });
  // iOS: no pinch / double-tap zoom, no rubber-band scroll outside the scrollable areas
  ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));
  document.addEventListener('touchmove', (e) => { if (!(e.target as Element).closest?.('.mapscroll, .parent, .sticker')) e.preventDefault(); }, { passive: false });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', applyRM);

  // new day (morning unlock)
  const tickDay = () => { if (rollDay()) { stopSpeaking(); flow.cancelled = true; document.querySelectorAll('.parent,.pad,.celebrate,.calm,.prompt,.retry').forEach((n) => n.remove()); showMap(); speak('morning.1'); } };
  setInterval(tickDay, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tickDay(); });

  if (day.night) showNight(false); else showMap();
  registerSW({ immediate: true });
  void logCalm; void PHRASES;
}
boot();
