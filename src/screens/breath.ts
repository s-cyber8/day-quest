// Guided breathing circle (no microphone): in 4 s, out 4 s, n times. Same ring look as the calm corner's breath activity.
import { h, sleep } from '../core/dom';
import { speak } from '../core/speech';
import { sfx } from '../core/audio';
import { text } from '../content/phrases';

export function guidedBreath(host: HTMLElement, cycles: number, alive: () => boolean): Promise<void> {
  return new Promise(async (res) => {
    const ring = h('div', { class: 'breathring', 'data-testid': 'guided-ring' });
    const dot = h('div', { class: 'breathdot' });
    const label = h('div', { class: 'title', style: 'min-height:44px;margin:0;color:#fff;text-shadow:0 2px 8px rgba(30,40,70,.5)' });
    const dots = h('div', { class: 'bdots' }, ...Array.from({ length: cycles }, () => h('i')));
    const box = h('div', { class: 'balloonbox' }, ring, dot);
    host.replaceChildren(label, box, dots);
    const setRing = (p: number) => { const s = 70 + p * 150; ring.style.width = ring.style.height = s + 'px'; dot.style.transform = `scale(${0.55 + p * 0.7})`; };
    setRing(0);
    for (let c = 0; c < cycles; c++) {
      label.textContent = text('calm.breath.in'); speak('calm.breath.in'); sfx.breathe(true, 4);
      for (let t = 0; t < 4; t += 0.05) { setRing(t / 4); await sleep(50); if (!alive()) return res(); }
      label.textContent = text('calm.breath.out'); speak('calm.breath.out'); sfx.breathe(false, 4);
      for (let t = 0; t < 4; t += 0.05) { setRing(1 - t / 4); await sleep(50); if (!alive()) return res(); }
      (dots.children[c] as HTMLElement).classList.add('on'); sfx.chime(c);
    }
    await sleep(500); res();
  });
}
