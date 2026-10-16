// Home: two big illustrated doors. The last-used world is highlighted ("ממשיכים").
import { h, frag } from '../core/dom';
import { P } from '../art/props';
import { settings, saveSettings } from '../core/storage';
import { sfx } from '../core/audio';
import { moka3d } from '../art/moka';
import { bgUrl } from '../art/sprites';

export type World = 'day' | 'stories';
export interface HomeHooks { open(w: World): void; onParent(): void; onBook(): void }
export function renderHome(hooks: HomeHooks): HTMLElement {
  const last = settings.lastWorld;
  const door = (w: World, label: string, art: string, pos: string) => {
    const b = h('button', { class: 'door' + (last === w ? ' last' : ''), 'data-testid': 'door-' + w, 'data-t': '1', 'aria-label': label,
      onclick: () => { sfx.pop(); settings.lastWorld = w; saveSettings(); hooks.open(w); } },
      h('div', { class: 'art', style: `background-image:url(${art});background-position:${pos}` }),
      h('div', { class: 'lbl' }, label), last === w ? h('div', { class: 'cont' }, 'ממשיכים') : null);
    return b;
  };
  const base = import.meta.env.BASE_URL;
  const buddy = moka3d('happy');
  return h('div', { class: 'screen home', 'data-screen': 'home', 'data-testid': 'home' },
    door('day', 'היום שלי', bgUrl('day-map'), '50% 62%'),
    h('div', { class: 'homemoka' }, buddy),
    door('stories', 'הסיפורים שלי', `${base}assets/stories/scenes/s03-1-situation.webp`, '50% 40%'),
    h('div', { class: 'homefoot' },
      h('button', { class: 'rbtn book', 'data-testid': 'book', 'aria-label': 'ספר מדבקות', onclick: () => { sfx.tap(); hooks.onBook(); } }, frag(P.book())),
      h('button', { class: 'gear', 'data-testid': 'gear', 'aria-label': 'הורים', onclick: () => hooks.onParent() }, frag(P.gear()))));
}
