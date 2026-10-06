import { h, frag } from '../core/dom';
import { P } from '../art/props';
import { STATIONS, imgOf } from '../content/stations';
import { day } from '../core/storage';
import { sfx } from '../core/audio';

const LBL: Record<string, string> = { water: 'מים', ball: 'כדור', pet: 'מוקה', breath: 'בלון' };

export function renderSticker(onBack: () => void): HTMLElement {
  const grid = h('div', { class: 'grid' });
  STATIONS.forEach((s) => {
    const done = day.done.includes(s.id);
    grid.append(h('div', { class: 'slot' + (done ? '' : ' empty'), 'data-done': done ? '1' : '0' },
      done ? frag(P.star()) : h('img', { src: imgOf(s), style: 'width:64px;height:64px;border-radius:50%;object-fit:cover', alt: '' }), h('div', {}, s.label)));
  });
  const mg = h('div', { class: 'grid' });
  if (!day.medals.length) mg.append(h('div', { class: 'slot empty' }, frag(P.medal()), h('div', {}, 'מדליית רוגע')));
  day.medals.forEach((m) => mg.append(h('div', { class: 'slot', 'data-testid': 'medal-slot' }, frag(P.medal()), h('div', {}, 'רוגע: ' + (LBL[m.activity] ?? '')))));
  return h('div', { class: 'screen sticker', 'data-screen': 'sticker' },
    h('button', { class: 'rbtn backrow', 'data-testid': 'book-back', onclick: () => { sfx.tap(); onBack(); } }, frag(P.arrow())),
    h('h1', {}, 'ספר המדבקות'), grid, h('h1', { style: 'font-size:26px;margin-top:8px' }, 'מדליות רוגע'), mg);
}
