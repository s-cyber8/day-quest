import { h, frag, rand } from '../core/dom';
import { P } from '../art/props';
import { mokaSvg } from '../art/moka';
import { asset } from '../content/stations';
import { sfx } from '../core/audio';
import { speak } from '../core/speech';
import { holdButton } from './ui';

/** Starry night, locked until morning. `fresh` = just finished the day (plays the lullaby once). */
export function renderNight(fresh: boolean, onUnlock: () => void): HTMLElement {
  const n = h('div', { class: 'night', 'data-screen': 'night', 'data-testid': 'night' });
  for (let i = 0; i < 46; i++) {
    const s = h('i', { class: 'star' }); const sz = rand(2, 5);
    Object.assign(s.style, { width: sz + 'px', height: sz + 'px', left: rand(0, 100) + '%', top: rand(0, 62) + '%', animationDelay: rand(0, 6) + 's', animationDuration: rand(5, 9) + 's' });
    n.append(s);
  }
  const scene = h('div', { class: 'scene' },
    h('div', { class: 'bedsvg' }, frag(P.bed())),
    h('img', { class: 'head', src: asset('avatar/rafael-football.png'), alt: '', draggable: 'false' }),
    h('div', { class: 'blanket' }),
    h('div', { class: 'zz' }, 'z z'),
    h('div', { class: 'mokan' }, mokaSvg('sleepy')));
  n.append(h('div', { class: 'moon' }), scene,
    h('div', { class: 'msg' }, 'לילה טוב רפאל. נתראה בבוקר'),
    h('div', { class: 'unlock' }, holdButton(onUnlock, { caption: 'הורה: פתיחה' })));
  if (fresh) {
    setTimeout(() => { sfx.lullaby(); }, 600);
    speak('night.1', 'night.2');
  }
  return n;
}
