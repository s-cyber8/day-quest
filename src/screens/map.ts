import { h, frag, sleep } from '../core/dom';
import { P } from '../art/props';
import { mokaSvg } from '../art/moka';
import { Station, STATIONS, imgOf, asset } from '../content/stations';
import { day, settings } from '../core/storage';
import { weekdayOfKey } from '../core/dom';
import { sfx } from '../core/audio';
import { say } from './ui';

/** Stations shown today: active for this weekday and not skipped (done ones always stay). */
export function visibleStations(): Station[] {
  const act = settings.days[weekdayOfKey(day.key || new Date().toISOString().slice(0, 10))] ?? STATIONS.map((s) => s.id);
  return STATIONS.filter((s) => day.done.includes(s.id) || (act.includes(s.id) && !day.skipped.includes(s.id)));
}
export const currentStation = (): Station | undefined => visibleStations().find((s) => !day.done.includes(s.id));
export const nextAfter = (s: Station): Station | undefined => visibleStations().find((x) => x.id > s.id && !day.done.includes(x.id));

export interface MapHooks { onStation(s: Station): void; onParent(): void; onBook(): void }

export function renderMap(hooks: MapHooks, from?: Station): HTMLElement {
  const vis = visibleStations();
  const cur = currentStation();
  const STEP = 150, TOP = 90;
  const total = TOP * 2 + (vis.length - 1) * STEP;
  const inner = h('div', { class: 'mapinner', style: `height:${total}px` });
  const xAt = (i: number) => (i % 2 === 0 ? 70 : 30) + (i % 4 === 1 ? -4 : i % 4 === 3 ? 6 : 0);
  const pos = vis.map((_, i) => ({ x: xAt(i), y: TOP + i * STEP }));
  // road
  const vw = 100;
  let d = `M${pos[0].x} ${pos[0].y}`;
  for (let i = 1; i < pos.length; i++) { const a = pos[i - 1], b = pos[i]; const my = (a.y + b.y) / 2; d += ` C${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`; }
  const road = frag<SVGElement>(`<svg class="road" viewBox="0 0 ${vw} ${total}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke" style="stroke-width:44px"/><path d="${d}" fill="none" stroke="#a8d8f0" stroke-width="3" stroke-dasharray="2 14" stroke-linecap="round" vector-effect="non-scaling-stroke" style="stroke-width:4px"/></svg>`);
  inner.append(road);
  vis.forEach((s, i) => {
    const done = day.done.includes(s.id), isCur = cur?.id === s.id;
    const n = h('button', { class: 'node' + (isCur ? ' current' : done ? '' : ' future'), 'data-testid': 'node-' + s.id, 'aria-label': s.label, style: `left:${pos[i].x}%;top:${pos[i].y}px` },
      h('img', { class: 'thumb', src: imgOf(s), alt: '', draggable: 'false' }), h('div', { class: 'num' }, String(s.id)));
    if (done) n.append(frag(P.star()), );
    if (done) (n.lastChild as HTMLElement).setAttribute('class', 'star');
    if (isCur) { n.dataset.t = '1'; n.addEventListener('click', () => { sfx.tap(); hooks.onStation(s); }); }
    inner.append(n);
  });
  // hero + Moka
  const idx = cur ? vis.indexOf(cur) : vis.length - 1;
  const fromIdx = from ? vis.findIndex((s) => s.id === from.id) : -1;
  const hero = h('div', { class: 'hero' }, h('img', { src: asset('avatar/rafael-football.png'), alt: '', draggable: 'false' }));
  const buddyMoka = mokaSvg('idle'); const buddy = h('div', { class: 'buddy' }, buddyMoka);
  const place = (i: number) => {
    const p = pos[Math.max(0, i)]; const side = p.x > 50 ? -1 : 1; // stand toward the centre
    hero.style.left = `calc(${p.x}% + ${side * 118}px - 56px)`; hero.style.top = p.y - 100 + 'px';
    buddy.style.left = `calc(${p.x}% + ${side * 118 + (side > 0 ? 62 : -62)}px - 48px)`; buddy.style.top = p.y + 6 + 'px';
  };
  inner.append(buddy, hero);
  place(fromIdx >= 0 ? fromIdx : idx);

  const stars = day.done.length;
  const medals = h('div', { class: 'medals', 'data-testid': 'medals' }, ...day.medals.slice(-5).map(() => frag(P.medal())));
  const starsEl = h('div', { class: 'stars', 'data-testid': 'stars', id: 'starcounter' }, frag(P.star()), h('span', {}, `${stars}/${vis.length}`));
  const scroll = h('div', { class: 'mapscroll' }, inner);
  const gear = h('button', { class: 'gear', 'data-testid': 'gear', 'aria-label': 'הורים', onclick: () => hooks.onParent() }, frag(P.gear()));
  const book = h('button', { class: 'rbtn book', 'data-testid': 'book', 'aria-label': 'ספר מדבקות', onclick: () => { sfx.tap(); hooks.onBook(); } }, frag(P.book()));
  const screen = h('div', { class: 'screen map', 'data-screen': 'map' }, h('div', { class: 'topbar' }, starsEl, medals), scroll, h('div', { class: 'mapfoot' }, gear, book));

  // after layout: scroll to the hero, and walk from the previous station if we just finished one
  requestAnimationFrame(() => {
    const sc = (i: number) => { scroll.scrollTop = Math.max(0, pos[Math.max(0, i)].y - scroll.clientHeight * 0.5); };
    sc(fromIdx >= 0 ? fromIdx : idx);
    if (fromIdx >= 0 && fromIdx !== idx) {
      setTimeout(async () => {
        hero.classList.add('walk'); setMokaWalk(buddyMoka, true); place(idx);
        scroll.scrollTo({ top: Math.max(0, pos[idx].y - scroll.clientHeight * 0.5), behavior: 'smooth' });
        await sleep(1900); hero.classList.remove('walk'); setMokaWalk(buddyMoka, false);
      }, 700);
    }
    if (!cur) say('map.allDone'); else if (fromIdx < 0) say('map.hello');
  });
  return screen;
}
function setMokaWalk(m: HTMLElement, on: boolean) { m.dataset.state = on ? 'walking' : 'idle'; }
