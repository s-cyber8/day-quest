import { h, frag, sleep } from '../core/dom';
import { P } from '../art/props';
import { moka3d, setMoka } from '../art/moka';
import { Station, STATIONS, imgOf, asset } from '../content/stations';
import { day, settings } from '../core/storage';
import { weekdayOfKey } from '../core/dom';
import { sfx } from '../core/audio';
import { bgUrl } from '../art/sprites';
import { say } from './ui';

/** Stations shown today: active for this weekday and not skipped (done ones always stay). */
export function visibleStations(): Station[] {
  const act = settings.days[weekdayOfKey(day.key || new Date().toISOString().slice(0, 10))] ?? STATIONS.map((s) => s.id);
  return STATIONS.filter((s) => day.done.includes(s.id) || (act.includes(s.id) && !day.skipped.includes(s.id)));
}
export const currentStation = (): Station | undefined => visibleStations().find((s) => !day.done.includes(s.id));
export const nextAfter = (s: Station): Station | undefined => visibleStations().find((x) => x.id > s.id && !day.done.includes(x.id));

export interface MapHooks { onStation(s: Station): void; onParent(): void; onBook(): void }

// Station markers along the cobbled path of the illustrated map (bg-day-map, 768x1376): [x, y] in image pixels, home (1) at the bottom, night house (13) at the top.
const PATH: [number, number][] = [[400, 1285], [585, 1235], [540, 1110], [330, 1040], [215, 935], [330, 830], [530, 760], [585, 650], [470, 555], [320, 500], [215, 420], [300, 345], [450, 300]];
const IW = 768, IH = 1376;

export function renderMap(hooks: MapHooks, from?: Station): HTMLElement {
  const vis = visibleStations();
  const cur = currentStation();
  const inner = h('div', { class: 'mapinner', style: `background-image:url(${bgUrl('day-map')})` });
  const pt = (s: Station) => ({ x: (PATH[s.id - 1][0] / IW) * 100, y: (PATH[s.id - 1][1] / IH) * 100 });
  vis.forEach((s) => {
    const done = day.done.includes(s.id), isCur = cur?.id === s.id;
    const p = pt(s);
    const n = h('button', { class: 'node' + (isCur ? ' current' : done ? ' done' : ' open'), 'data-testid': 'node-' + s.id, 'aria-label': s.label, style: `left:${p.x}%;top:${p.y}%` },
      h('img', { class: 'thumb', src: imgOf(s), alt: '', draggable: 'false' }), h('div', { class: 'num' }, String(s.id)));
    if (done) {
      const st = day.stars[s.id] ?? 0;
      const sw = h('div', { class: 'star' + (st ? '' : ' nostars'), 'data-stars': String(st) }, frag(P.star(st ? '#ffd966' : '#c9e8d4')), h('span', { class: 'sn' }, st ? String(st) : '✓'));
      n.append(sw);
    }
    // every station is open at any time, in any order; the next one in the routine just glows. Done stations replay for stars.
    n.dataset.t = '1'; n.addEventListener('click', () => { sfx.tap(); hooks.onStation(s); });
    inner.append(n);
  });
  // hero + Moka stand beside the current station
  const idx = cur ? vis.indexOf(cur) : vis.length - 1;
  const fromIdx = from ? vis.findIndex((s) => s.id === from.id) : -1;
  const hero = h('div', { class: 'hero' }, h('img', { src: asset('avatar/rafael-football.png'), alt: '', draggable: 'false' }));
  const buddyMoka = moka3d('idle'); const buddy = h('div', { class: 'buddy' }, buddyMoka);
  const place = (i: number) => {
    const st = vis[Math.max(0, Math.min(vis.length - 1, i))]; const p = pt(st);
    const side = p.x > 50 ? -1 : 1; // stand toward the centre of the map
    hero.style.left = p.x + side * 15 + '%'; hero.style.top = p.y + 3 + '%';
    buddy.style.left = p.x + side * 15 + (side > 0 ? 11 : -11) + '%'; buddy.style.top = p.y + 3.4 + '%';
  };
  inner.append(buddy, hero);
  place(fromIdx >= 0 ? fromIdx : idx);

  const stars = day.done.reduce((a, id) => a + (day.stars[id] ?? 0), 0);
  const medals = h('div', { class: 'medals', 'data-testid': 'medals' }, ...day.medals.slice(-5).map(() => frag(P.medal())));
  const starsEl = h('div', { class: 'stars', 'data-testid': 'stars', id: 'starcounter' }, frag(P.star()), h('span', {}, `${stars}`));
  const scroll = h('div', { class: 'mapscroll' }, inner);
  const posY = (i: number) => (pt(vis[Math.max(0, Math.min(vis.length - 1, i))]).y / 100) * inner.offsetHeight;
  const gear = h('button', { class: 'gear', 'data-testid': 'gear', 'aria-label': 'הורים', onclick: () => hooks.onParent() }, frag(P.gear()));
  const book = h('button', { class: 'rbtn book', 'data-testid': 'book', 'aria-label': 'ספר מדבקות', onclick: () => { sfx.tap(); hooks.onBook(); } }, frag(P.book()));
  const screen = h('div', { class: 'screen map', 'data-screen': 'map' }, h('div', { class: 'topbar' }, starsEl, medals), scroll, h('div', { class: 'mapfoot' }, book, gear));

  // after layout: scroll to the hero, and walk from the previous station if we just finished one
  requestAnimationFrame(() => {
    const sc = (i: number) => { scroll.scrollTop = Math.max(0, posY(i) - scroll.clientHeight * 0.55); };
    sc(fromIdx >= 0 ? fromIdx : idx);
    if (fromIdx >= 0 && fromIdx !== idx) {
      setTimeout(async () => {
        hero.classList.add('walk'); setMokaWalk(buddyMoka, true); place(idx);
        scroll.scrollTo({ top: Math.max(0, posY(idx) - scroll.clientHeight * 0.55), behavior: 'smooth' });
        await sleep(1900); hero.classList.remove('walk'); setMokaWalk(buddyMoka, false);
      }, 700);
    }
    if (!cur) say('map.allDone'); else if (fromIdx < 0) say('map.hello');
  });
  return screen;
}
function setMokaWalk(m: HTMLElement, on: boolean) { setMoka(m, on ? 'walking' : 'idle'); }
