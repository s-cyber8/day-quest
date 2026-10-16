// "Rafael's Stories": picker + the story flow (situation → feeling check → choice → outcome → repair/rewind → lesson → parent card).
// Rules: every feeling is accepted; bad outcomes are calm and muted (no sting, no fun animation); a good ending is always reachable;
// hearts live inside the story only and stars/stickers are never removed.
import { h, frag, sleep, rand } from '../core/dom';
import { P } from '../art/props';
import { moka3d, setMoka } from '../art/moka';
import { speak, stopSpeaking, onCaption } from '../core/speech';
import { sfx, haptic } from '../core/audio';
import { text } from '../content/phrases';
import { STORIES, Story, FEELINGS, FeelKey, sceneUrl, faceUrl } from '../content/stories';
import { progOf, saveProg, upsertPlay, PlayLog, introSeen, markIntroSeen } from '../core/stories-store';
import { guidedBreath } from './breath';
import { runCalmBreath } from './calm';
import { confetti } from './ui';
import { setFrustrationEnabled } from '../core/frustration';
import { spr } from '../art/sprites';

export interface StoryEnv {
  setScreen(el: HTMLElement, back: (() => void) | null): void;
  goHome(): void;
}

const BIG: FeelKey[] = ['angry', 'sad', 'scared'];
let flow: { cancelled: boolean } = { cancelled: true };
let offCaption: (() => void) | null = null;

const heartImg = (cls = '') => frag<HTMLElement>(spr('rewards', 'heart', 'heart ' + cls));
const shuffled = <T,>(a: T[]): T[] => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

// ---------------------------------------------------------------- picker
export function showPicker(env: StoryEnv) {
  flow.cancelled = true; stopSpeaking(); offCaption?.(); offCaption = null;
  setFrustrationEnabled(false);
  const first = !introSeen();
  const grid = h('div', { class: 'storygrid' });
  STORIES.forEach((s) => {
    const p = progOf(s.id);
    const hearts = h('div', { class: 'hrow', 'data-hearts': String(p.bestHearts) }, ...[0, 1, 2].map((i) => heartImg(i < p.bestHearts ? '' : 'off')));
    const card = h('button', { class: 'scard' + (p.done ? ' done' : ''), 'data-testid': 'story-' + s.id, 'data-t': '1', 'aria-label': s.title, onclick: () => { sfx.pop(); playStory(env, s); } },
      h('img', { class: 'pic', src: sceneUrl(s.id, '1-situation'), alt: '', draggable: 'false' }),
      h('div', { class: 'ttl' }, s.title), hearts,
      p.golden ? h('div', { class: 'gold', 'data-testid': 'golden-' + s.id }, heartImg('gold')) : null,
      p.done ? h('div', { class: 'stk', 'data-testid': 'sticker-' + s.id }, frag(P.star())) : null);
    grid.append(card);
  });
  const mk = moka3d('happy');
  const bubble = h('div', { class: 'sline', 'data-testid': 'pick-line' }, text(first ? 'story.intro' : 'story.pick'));
  const screen = h('div', { class: 'screen storypick', 'data-screen': 'storypick', 'data-testid': 'storypick' },
    h('div', { class: 'pickhead' }, h('div', { class: 'pickmoka' }, mk), bubble), grid);
  env.setScreen(screen, () => { stopSpeaking(); env.goHome(); });
  speak(first ? 'story.intro' : 'story.pick');
  if (first) markIntroSeen();
}

// ---------------------------------------------------------------- one story
interface View {
  screen: HTMLElement; fig: HTMLElement; body: HTMLElement; meter: HTMLElement; line: HTMLElement;
}
function buildView(s: Story): View {
  const line = h('div', { class: 'sline', 'data-testid': 'sline' });
  const fig = h('div', { class: 'sfig' });
  const body = h('div', { class: 'sbody' });
  const meter = h('div', { class: 'meter', 'data-testid': 'meter', 'data-hearts': '2' }, ...[0, 1, 2].map(() => heartImg()));
  const screen = h('div', { class: 'screen story', 'data-screen': 'story', 'data-story': s.id, 'data-step': 'situation', 'data-testid': 'story' }, meter, fig, line, body);
  return { screen, fig, body, meter, line };
}
const setFig = (v: View, url: string | null, cls = '') => {
  v.fig.className = 'sfig ' + cls; v.fig.hidden = !url;
  v.fig.replaceChildren(...(url ? [h('img', { src: url, alt: '', draggable: 'false' })] : []));
  if (url) v.screen.style.setProperty('--bg', `url(${url})`);
};
const setBody = (v: View, step: string, ...kids: (Node | null)[]) => { v.screen.dataset.step = step; v.body.replaceChildren(...(kids.filter(Boolean) as Node[])); };
const nextBtn = (label = 'המשך') => h('button', { class: 'bigbtn', 'data-testid': 'next', 'data-t': '1', 'aria-label': label }, frag(P.play()), h('span', {}, label));
const waitTap = (b: HTMLElement) => new Promise<void>((res) => b.addEventListener('click', () => { sfx.tap(); res(); }, { once: true }));

export async function playStory(env: StoryEnv, s: Story) {
  stopSpeaking(); offCaption?.();
  const my: { cancelled: boolean } = (flow = { cancelled: false });
  const alive = () => !my.cancelled;
  const v = buildView(s);
  offCaption = onCaption((t) => { v.line.textContent = t; v.line.classList.add('show'); });
  const quit = () => { my.cancelled = true; stopSpeaking(); showPicker(env); };
  env.setScreen(v.screen, quit);
  setFrustrationEnabled(false);
  const id = (k: string) => `${s.id}.${k}`;
  let hearts = 2;
  const setHearts = (n: number) => { hearts = Math.max(0, Math.min(3, n)); v.meter.dataset.hearts = String(hearts); [...v.meter.children].forEach((c, i) => c.classList.toggle('off', i >= hearts)); };
  setHearts(2);
  const mood = (st: Parameters<typeof setMoka>[1]) => { const m = v.screen.querySelector<HTMLElement>('.moka'); if (m) setMoka(m, st); };
  const flyHeart = async (dir: 'up' | 'down') => {
    if (document.body.classList.contains('rm')) return;
    const f = v.fig.getBoundingClientRect(), t = v.meter.getBoundingClientRect(), sr = v.screen.getBoundingClientRect();
    const el = heartImg('fly'); el.style.left = (dir === 'up' ? f.left + f.width / 2 : t.left + 20) - sr.left - 28 + 'px'; el.style.top = (dir === 'up' ? f.top + f.height / 2 : t.top + 10) - sr.top - 28 + 'px';
    v.screen.append(el); await sleep(30);
    const to = dir === 'up' ? { x: t.left + t.width / 2, y: t.top + t.height / 2 } : { x: f.left + f.width / 2, y: f.top + f.height * 0.6 };
    const from = dir === 'up' ? { x: f.left + f.width / 2, y: f.top + f.height / 2 } : { x: t.left + 20, y: t.top + 10 };
    el.style.transform = `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(${dir === 'up' ? 0.5 : 1})`; el.style.opacity = dir === 'up' ? '.3' : '.0';
    await sleep(1100); el.remove();
  };

  // ---- a. situation
  setFig(v, sceneUrl(s.id, '1-situation'), 'kb');
  let nb = nextBtn(); setBody(v, 'situation', nb);
  speak(id('sit'));
  await waitTap(nb); if (!alive()) return;

  // ---- b. feeling check
  const feel = await feelingCheck(v, alive);
  if (!alive() || !feel) return;

  // ---- c. a big, hard feeling: breathe first
  if (feel.intensity === 'lot' && BIG.includes(feel.key)) {
    const host = h('div', { class: 'act breathhost', 'data-testid': 'breath-host' });
    setFig(v, null); setBody(v, 'breath', h('div', { class: 'mokabreath' }, moka3d('idle')), host);
    await speak('feel.big'); if (!alive()) return;
    await guidedBreath(host, 3, alive); if (!alive()) return;
  }

  // ---- d..f. choice → outcome → repair / rewind (loops until the story reaches a good ending or a repair)
  const t0 = performance.now(); let firstChoice = true; let rewinds = 0; let repaired = false;
  const log: PlayLog = { id: `${Date.now()}-${Math.floor(rand(0, 1e6))}`, t: Date.now(), story: s.id, feeling: feel.key, intensity: feel.intensity, choice: 'good', good: true, repaired: false, rewinds: 0, ms: 0, finished: false };
  let ended: 'good' | 'repaired' = 'good';
  for (;;) {
    const tShown = performance.now();
    const pick = await choose(v, s, alive); if (!alive() || !pick) return;
    const ms = Math.round(performance.now() - tShown);
    if (firstChoice) {
      firstChoice = false;
      log.choice = pick.kind === 'third' ? 'third' : pick.kind; log.third = pick.kind === 'third' ? s.third : undefined; log.good = pick.good; log.ms = ms;
      upsertPlay(log);
      if (pick.good) saveProg(s.id, { golden: true });
    }
    void t0;
    if (pick.good) {
      // s10: the good choice is walking to the quiet corner: one real breath before the outcome
      if (s.id === 's10' && pick.kind === 'good') { await runCalmBreath(1); if (!alive()) return; }
      // good outcome: celebrate
      setFig(v, sceneUrl(s.id, pick.outSlot), 'kb'); setBody(v, 'outcome-good', h('div', { class: 'mokabig2' }, moka3d('jump')));
      sfx.big(); haptic([20, 40, 20]); confetti(v.screen, 26);
      setHearts(hearts + 1); flyHeart('up');
      await speak(id(pick.outId), Math.random() < 0.5 ? 'good.cheer.1' : 'good.cheer.2', 'hearts.up'); if (!alive()) return;
      ended = repaired ? 'repaired' : 'good';
      break;
    }
    // bad outcome: calm, muted, short
    setFig(v, sceneUrl(s.id, pick.outSlot), 'muted'); setBody(v, 'outcome-bad', h('div', { class: 'mokabig2' }, moka3d('concerned')));
    setHearts(hearts - 1);
    await speak(id(pick.outId), 'bad.soft'); if (!alive()) return;
    // repair or rewind
    const act = await repairAsk(v, alive); if (!alive() || !act) return;
    if (act === 'rewind') {
      rewinds++; log.rewinds = rewinds; upsertPlay(log);
      setHearts(hearts + 1); await speak('repair.rewind'); if (!alive()) return; continue;
    }
    repaired = true; log.repaired = true; upsertPlay(log);
    setFig(v, sceneUrl(s.id, '6-repair'), 'kb'); setBody(v, 'repaired', h('div', { class: 'mokabig2' }, moka3d('happy')));
    sfx.chime(2); setHearts(hearts + 1); flyHeart('up');
    await speak(id('repair'), 'repair.cheer'); if (!alive()) return;
    ended = 'repaired'; break;
  }
  void ended;

  // ---- g. lesson (Moka) → parent card → finish
  setFig(v, null);
  const lessonBtn = nextBtn();
  setBody(v, 'lesson', h('div', { class: 'mokabig2 big' }, moka3d('happy')), lessonBtn);
  speak(id('lesson')); await waitTap(lessonBtn); if (!alive()) return;

  const play = h('button', { class: 'bigbtn sky', 'data-testid': 'parent-play', 'data-t': '1', onclick: () => { sfx.tap(); speak('parent.card', id('parent')); } }, frag(P.play()), h('span', {}, 'השמע'));
  const done = h('button', { class: 'bigbtn', 'data-testid': 'story-finish', 'data-t': '1' }, frag(P.check()), h('span', {}, 'סיום'));
  setBody(v, 'parent', h('div', { class: 'pcard', 'data-testid': 'pcard' }, h('div', { class: 'pt' }, text('parent.card')), h('div', { class: 'pq' }, text(id('parent')))), play, done);
  await waitTap(done); if (!alive()) return;

  log.finished = true; upsertPlay(log);
  const pr = progOf(s.id);
  saveProg(s.id, { done: true, plays: pr.plays + 1, bestHearts: Math.max(pr.bestHearts, hearts) });
  // sticker + goodbye
  const st = frag<HTMLElement>(P.star()); st.classList.add('bigstar');
  setBody(v, 'finished', h('div', { class: 'stickerpop', 'data-testid': 'sticker-pop' }, st), h('div', { class: 'mokabig2' }, moka3d('jump')));
  sfx.big(); confetti(v.screen, 30); haptic([30, 60, 30]);
  await speak('story.outro'); if (!alive()) return;
  await sleep(700); if (!alive()) return;
  showPicker(env);
}

// ---------------------------------------------------------------- feeling check
async function feelingCheck(v: View, alive: () => boolean): Promise<{ key: FeelKey; intensity: 'little' | 'lot' } | null> {
  return new Promise((res) => {
    setFig(v, null);
    let key: FeelKey | null = null; let busy = false;
    const faces = h('div', { class: 'faces6', 'data-testid': 'faces' });
    const int = h('div', { class: 'introw', hidden: true },
      h('button', { class: 'ibtn', 'data-testid': 'int-little', 'data-t': '1', onclick: () => pickInt('little') }, h('i', { class: 'dot s' }), h('span', {}, 'קצת')),
      h('button', { class: 'ibtn', 'data-testid': 'int-lot', 'data-t': '1', onclick: () => pickInt('lot') }, h('i', { class: 'dot b' }), h('span', {}, 'הרבה')));
    FEELINGS.forEach((f) => {
      const btn = h('button', { class: 'face6', 'data-testid': 'feel-' + f.key, 'data-t': '1', 'aria-label': f.label },
        h('img', { src: faceUrl(f.key), alt: f.label, draggable: 'false' }), h('span', { class: 'fl' }, f.label));
      btn.addEventListener('click', () => {
        if (busy) return; sfx.pop(); key = f.key;
        faces.querySelectorAll('.face6').forEach((e) => e.classList.toggle('sel', e === btn));
        int.hidden = false; v.screen.dataset.step = 'intensity';
        speak(`feel.n.${f.key}`).then(() => { if (alive() && key === f.key && !busy) speak('feel.intensity'); });
      });
      faces.append(btn);
    });
    const pickInt = async (lvl: 'little' | 'lot') => {
      if (busy || !key) return; busy = true; sfx.tap();
      int.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
      mood('happy');
      await speak(`feel.ok.${key}`); if (!alive()) return res(null);
      res({ key, intensity: lvl });
    };
    const mood = (st: Parameters<typeof setMoka>[1]) => { const m = v.body.querySelector<HTMLElement>('.moka'); if (m) setMoka(m, st); };
    const head = h('div', { class: 'askrow' }, h('div', { class: 'askmoka' }, moka3d('idle')));
    setBody(v, 'feel', head, faces, int);
    speak('feel.ask');
  });
}

// ---------------------------------------------------------------- choice
interface Pick { kind: 'good' | 'bad' | 'third'; good: boolean; outSlot: string; outId: string }
function choose(v: View, s: Story, alive: () => boolean): Promise<Pick | null> {
  return new Promise((res) => {
    setFig(v, null);
    const opts: { kind: Pick['kind']; act: string; actId: string; good: boolean; outSlot: string; outId: string }[] = [
      { kind: 'good', act: '2-good-act', actId: 'good.act', good: true, outSlot: '3-good-out', outId: 'good.out' },
      { kind: 'bad', act: '4-bad-act', actId: 'bad.act', good: false, outSlot: '5-bad-out', outId: 'bad.out' },
    ];
    if (s.third) opts.push({ kind: 'third', act: '7-third-act', actId: 'third.act', good: s.third === 'words', outSlot: '8-third-out', outId: 'third.out' });
    const order = shuffled(opts);
    let sel: typeof opts[0] | null = null; let done = false;
    const confirmBtn = h('button', { class: 'bigbtn', 'data-testid': 'confirm', 'data-t': '1', hidden: true, onclick: () => fin() }, frag(P.check()), h('span', {}, 'בחרתי'));
    const cards = order.map((o) => {
      const c = h('button', { class: 'ccard', 'data-testid': 'choice-' + o.kind, 'data-kind': o.kind, 'data-good': o.good ? '1' : '0', 'data-t': '1', 'aria-label': text(`${s.id}.${o.actId}`) }, h('img', { src: sceneUrl(s.id, o.act), alt: '', draggable: 'false' }));
      c.addEventListener('click', () => {
        if (done) return;
        if (sel === o) { fin(); return; }               // second tap on the same card confirms
        sel = o; sfx.pop();
        cards.forEach((x) => x.classList.toggle('sel', x === c)); confirmBtn.hidden = false;
        speak(`${s.id}.${o.actId}`);                     // first tap: hear what this choice is
      });
      return c;
    });
    const fin = () => { if (done || !sel) return; done = true; sfx.tap(); stopSpeaking(); res({ kind: sel.kind, good: sel.good, outSlot: sel.outSlot, outId: sel.outId }); };
    const head = h('div', { class: 'askrow' }, h('div', { class: 'askmoka' }, moka3d('idle')));
    setBody(v, 'choice', head, h('div', { class: 'cards', style: `--n:${order.length}` }, ...cards), confirmBtn);
    v.body.dataset.n = String(order.length);
    speak('choice.ask');
    void alive;
  });
}

// ---------------------------------------------------------------- repair or rewind
function repairAsk(v: View, alive: () => boolean): Promise<'fix' | 'rewind' | null> {
  return new Promise((res) => {
    void alive;
    const fix = h('button', { class: 'rbtn2', 'data-testid': 'repair-fix', 'data-t': '1', onclick: () => { sfx.tap(); res('fix'); } }, h('div', { class: 'ico' }, heartImg()), h('span', {}, 'לתקן'));
    const back = h('button', { class: 'rbtn2', 'data-testid': 'repair-rewind', 'data-t': '1', onclick: () => { sfx.tap(); res('rewind'); } }, h('div', { class: 'ico' }, frag(P.retry())), h('span', {}, 'לחזור אחורה ולבחור אחרת'));
    setBody(v, 'repair-ask', h('div', { class: 'mokabig2' }, moka3d('concerned')), h('div', { class: 'rchoices' }, fix, back));
    speak('repair.ask');
  });
}
