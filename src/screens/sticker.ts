import { h, frag } from '../core/dom';
import { P } from '../art/props';
import { STATIONS, imgOf } from '../content/stations';
import { day } from '../core/storage';
import { STORIES, sceneUrl } from '../content/stories';
import { progOf } from '../core/stories-store';

const LBL: Record<string, string> = { water: 'מים', ball: 'כדור', pet: 'מוקה', breath: 'בלון' };

export function renderSticker(_onBack: () => void): HTMLElement {
  const grid = h('div', { class: 'grid' });
  STATIONS.forEach((s) => {
    const done = day.done.includes(s.id);
    grid.append(h('div', { class: 'slot' + (done ? '' : ' empty'), 'data-done': done ? '1' : '0' },
      done ? frag(P.star()) : h('img', { src: imgOf(s), style: 'width:64px;height:64px;border-radius:50%;object-fit:cover', alt: '' }), h('div', {}, s.label)));
  });
  const mg = h('div', { class: 'grid' });
  if (!day.medals.length) mg.append(h('div', { class: 'slot empty' }, frag(P.medal()), h('div', {}, 'מדליית רוגע')));
  day.medals.forEach((m) => mg.append(h('div', { class: 'slot', 'data-testid': 'medal-slot' }, frag(P.medal()), h('div', {}, 'רוגע: ' + (LBL[m.activity] ?? '')))));
  const sg = h('div', { class: 'grid', 'data-testid': 'story-stickers' });
  STORIES.forEach((st) => {
    const p = progOf(st.id);
    sg.append(h('div', { class: 'slot' + (p.done ? '' : ' empty'), 'data-done': p.done ? '1' : '0' },
      p.done ? frag(P.star()) : h('img', { src: sceneUrl(st.id, '1-situation'), style: 'width:64px;height:64px;border-radius:50%;object-fit:cover', alt: '' }), h('div', {}, st.title)));
  });
  return h('div', { class: 'screen sticker', 'data-screen': 'sticker' },
    h('h1', {}, 'ספר המדבקות'), grid, h('h1', { style: 'font-size:26px;margin-top:8px' }, 'מדבקות סיפורים'), sg, h('h1', { style: 'font-size:26px;margin-top:8px' }, 'מדליות רוגע'), mg);
}
