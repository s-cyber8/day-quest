import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { h, frag, sleep } from './core/dom';
import { P } from './art/props';
import { mokaSvg } from './art/moka';
import { Station, asset, stationById } from './content/stations';
import { settings, day, saveDay, rollDay, logStation, requestPersist } from './core/storage';
import { unlockAudio, sfx, applyVolume } from './core/audio';
import { speak, stopSpeaking } from './core/speech';
import { isPaused } from './core/pause';
import { installRageDetector, onFrustration, setFrustrationEnabled, setGuard } from './core/frustration';
import { initCaption, say, stationCard, holdButton, confetti, flyStar, askGate, overlay, hideCaption } from './screens/ui';
import { renderMap, currentStation, nextAfter, visibleStations } from './screens/map';
import { renderNight } from './screens/night';
import { renderSticker } from './screens/sticker';
import { renderParent } from './screens/parent';
import { offerCalm, openCalm } from './screens/calm';
import { GAMES, createCtx } from './games';
import { text } from './content/phrases';

const app = document.getElementById('app')!;
let calmOpen = false;

function mountChrome() {
  app.after(h('div', { id: 'overlay' }), h('div', { id: 'caption', 'aria-live': 'polite' }));
  const cloud = h('button', { id: 'cloud', 'data-testid': 'cloud', 'aria-label': 'הפינה השקטה של מוקה', onclick: () => requestCalm(false) }, frag(P.cloudBtn()));
  cloud.dataset.t = '1';
  document.body.append(cloud);
  initCaption();
}
const cloudBtn = () => document.getElementById('cloud') as HTMLElement;
function setScreen(el: HTMLElement) {
  app.replaceChildren(el);
  const kind = el.dataset.screen || '';
  document.body.dataset.view = kind;
  cloudBtn().hidden = kind === 'night' || kind === 'parent';
}
const blocked = () => isPaused() || calmOpen || !!document.querySelector('.parent, .pad, .prompt, .calm') || document.body.dataset.view === 'night';

async function requestCalm(auto: boolean) {
  if (calmOpen || document.body.dataset.view === 'night') return;
  calmOpen = true; hideCaption();
  try { await openCalm(auto); } finally { calmOpen = false; }
}

function applyRM() { document.body.classList.toggle('rm', settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches); }

// ---------------- map / day ----------------
function showMap(from?: Station) {
  setFrustrationEnabled(true);
  setScreen(renderMap({ onStation: runStation, onParent: openParent, onBook: openBook }, from));
}
function openBook() { setScreen(renderSticker(() => showMap())); }
async function openParent() {
  if (!(await askGate())) return;
  stopSpeaking(); setFrustrationEnabled(false);
  const prev = document.body.dataset.view;
  const el = renderParent(() => { parent.remove(); cloudBtn().hidden = false; document.body.dataset.view = ''; if (day.night) showNight(false); else showMap(); }, applyRM);
  const parent = el; document.body.append(parent); cloudBtn().hidden = true; document.body.dataset.view = 'parent'; void prev;
}

function showNight(fresh: boolean) {
  setFrustrationEnabled(false);
  day.night = true; saveDay();
  const n = renderNight(fresh, async () => {
    if (!(await askGate())) return;
    day.night = false; saveDay(); showMap();
  });
  setScreen(n);
}

// ---------------- station flow ----------------
function waitClick(btn: HTMLElement) { return new Promise<void>((res) => btn.addEventListener('click', () => res(), { once: true })); }

async function runStation(s: Station) {
  stopSpeaking(); setFrustrationEnabled(true);
  // a. announce
  const go = h('button', { class: 'bigbtn', 'data-testid': 'go', 'aria-label': 'מתחילים' }, frag(P.play()), h('span', {}, 'יאללה'));
  const nxt = nextAfter(s);
  const announce = h('div', { class: 'screen announce', 'data-screen': 'announce', 'data-station': String(s.id) },
    h('div', { class: 'center' }, stationCard(s), h('div', { class: 'station-label' }, s.label)),
    nxt ? h('div', { class: 'next', 'data-testid': 'next' }, h('span', {}, 'ואחר כך:'), h('img', { src: asset(`schedule/${nxt.image}.webp`), alt: '' }), h('span', {}, nxt.label)) : h('div'),
    go);
  setScreen(announce);
  speak(s.announce, ...(nxt ? ['next.prefix', nxt.labelId] : []));
  await waitClick(go); sfx.tap(); stopSpeaking();

  // b. go do it
  const confirmed = new Promise<void>((res) => {
    const moka = mokaSvg('idle');
    const screen = h('div', { class: 'screen godo', 'data-screen': 'godo', 'data-station': String(s.id) },
      stationCard(s, true),
      h('div', { class: 'mokabig' }, moka),
      h('div', { class: 'hint' }, 'עושים את זה באמת. כשמסיימים, ההורה לוחץ על הכפה.'),
      holdButton(res));
    setScreen(screen);
    speak(s.go);
  });
  await confirmed;
  day.done.includes(s.id) || day.done.push(s.id); saveDay(); logStation(s.id);

  // d. celebration with star flying to the map
  await celebrate({ title: text('done.cheer'), star: true, ms: 4200, speakIds: ['done.cheer'] });

  // game
  await playGame(s);
  await celebrate({ title: text('game.end'), ms: 3000, speakIds: [], praise: true });

  // e. back to the map (or Night Mode when the day is complete)
  if (!currentStation()) { showNight(true); return; }
  showMap(s);
}

function celebrate(o: { title: string; star?: boolean; ms: number; speakIds: string[]; praise?: boolean }): Promise<void> {
  return new Promise((res) => {
    setFrustrationEnabled(false);
    const c = h('div', { class: 'celebrate', 'data-testid': 'celebrate', 'data-screen': 'celebrate' });
    const hero = h('img', { class: 'hero2', src: asset('avatar/rafael-football.png'), alt: '', draggable: 'false' });
    const star = o.star ? frag(P.star()) : null; star?.classList.add('bigstar');
    c.append(star ?? '', hero, h('div', { class: 'title' }, o.title), h('div', { class: 'buddy2' }, mokaSvg('happy')));
    confetti(c, 28);
    document.body.append(c); document.body.dataset.view = 'celebrate';
    sfx.big();
    const praiseIds = [`praise.${1 + Math.floor(Math.random() * 5)}`];
    speak(...o.speakIds, ...(o.praise || o.star ? praiseIds : []));
    let done = false;
    const end = async () => {
      if (done) return; done = true;
      if (star) { await flyStar(star as unknown as HTMLElement, { x: 60, y: 60 }); }
      c.classList.add('leaving'); await sleep(250); c.remove(); setFrustrationEnabled(true); res();
    };
    setTimeout(end, o.ms);
  });
}

function playGame(s: Station): Promise<void> {
  return new Promise((res) => {
    const stage = h('div', { class: 'stage', 'data-testid': 'stage' });
    const screen = h('div', { class: 'screen game', 'data-screen': 'game', 'data-game': s.game, 'data-station': String(s.id) }, h('div', { class: 'thumbrow' }, stationCard(s, true)), stage);
    screen.querySelector<HTMLElement>('.thumbrow .card')!.style.maxWidth = '150px';
    setScreen(screen); setFrustrationEnabled(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const ctx = createCtx(stage, () => { ctx.dispose(); res(); });
      (window as unknown as { __dqFinish?: () => void }).__dqFinish = () => ctx.finish();
      GAMES[s.game](ctx);
    }));
  });
}

// ---------------- boot ----------------
async function boot() {
  applyRM(); applyVolume();
  mountChrome();
  const fresh = rollDay();
  installRageDetector();
  setGuard(() => !blocked());
  onFrustration(async () => { if (blocked()) return; calmOpen = true; const yes = await offerCalm(); calmOpen = false; if (yes) await requestCalm(true); });

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
  const tickDay = () => { if (rollDay()) { stopSpeaking(); document.querySelectorAll('.parent,.pad,.celebrate,.calm,.prompt').forEach((n) => n.remove()); showMap(); speak('morning.1'); } };
  setInterval(tickDay, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tickDay(); });

  if (day.night) showNight(false); else showMap();
  void fresh; void visibleStations; void stationById;
  registerSW({ immediate: true });
}
boot();
