import { Game, el, put, dragSequence, swipePop, centerOf } from './engine';
import { P } from '../art/props';
import { asset } from '../content/stations';
import { sfx } from '../core/audio';
import { h, frag } from '../core/dom';

const avatarImg = (name: string, hgt: number) => h('img', { src: asset(`avatar/${name}.png`), style: `height:${hgt}px;display:block`, draggable: 'false' });

/* 1 — Wake up: open the curtains, sun rises, stretch */
export const wake: Game = (ctx) => {
  const { root, W, H } = ctx;
  const ww = Math.min(W * 0.84, 340), wh = ww * 0.78;
  const win = put(el('abs'), W / 2, H * 0.3, ww, wh);
  Object.assign(win.style, { borderRadius: '28px', overflow: 'hidden', border: '10px solid #fff', background: 'linear-gradient(#bfe3f7,#eaf8ff)', boxShadow: 'var(--shadow)' });
  const sun = el('abs', P.sun()); Object.assign(sun.style, { width: '46%', height: '56%', left: '27%', bottom: '-60%', transition: 'bottom 3s ease-out' });
  const cl = (side: 'left' | 'right') => { const c = el('abs bar'); Object.assign(c.style, { top: '0', bottom: '0', width: '51%', [side]: '0', background: 'repeating-linear-gradient(90deg,#ffb3c1 0 16px,#ffc9d4 16px 32px)', borderRadius: side === 'left' ? '0 0 22px 0' : '0 0 0 22px' }); return c; };
  const cL = cl('left'), cR = cl('right');
  win.append(sun, cL, cR);
  win.dataset.t = '1';
  root.append(win);
  ctx.say('g.1.how');
  let opened = false;
  win.addEventListener('pointerdown', () => {
    if (opened) return; opened = true; delete win.dataset.t;
    cL.style.transform = 'translateX(-92%)'; cR.style.transform = 'translateX(92%)';
    sfx.whoosh(); sun.style.bottom = '8%';
    ctx.later(() => sfx.chime(1), 900);
    ctx.later(stretch, 2400);
  });
  function stretch() {
    const av = el('abs'); av.append(avatarImg('rafael-football', Math.min(H * 0.38, 300)));
    Object.assign(av.style, { left: '50%', bottom: '4%', transform: 'translateX(-50%)', transformOrigin: '50% 100%', transition: 'transform .5s cubic-bezier(.3,1.6,.5,1)', animation: 'fadeIn .6s both' });
    av.dataset.t = '1'; root.append(av);
    ctx.say('g.1.stretch');
    let n = 0;
    av.addEventListener('pointerdown', () => {
      n++; sfx.boing(); ctx.hit();
      av.style.transform = `translateX(-50%) scale(${0.94 + n * 0.0}, 1.14) rotate(${n % 2 ? 3 : -3}deg)`;
      ctx.later(() => (av.style.transform = 'translateX(-50%)'), 450);
      ctx.sparkle(centerOf(av).x, centerOf(av).y - 60);
      if (n === 3) { delete av.dataset.t; ctx.praise(); ctx.finish(); }
    });
  }
};

/* 2 — Brush teeth: swipe to pop germs */
export const teeth: Game = (ctx) => {
  const { root, W, H } = ctx;
  const mw = Math.min(W * 0.92, 400), mh = mw * 0.74;
  const mouth = put(el('abs'), W / 2, H * 0.46, mw, mh);
  const tx = [20, 40, 60, 80];
  mouth.innerHTML = `<svg viewBox="0 0 100 74" class="prop"><path d="M6 36 C6 8 94 8 94 36 C94 66 6 66 6 36Z" fill="#ff8fa3"/><path d="M12 36 C12 14 88 14 88 36 C88 60 12 60 12 36Z" fill="#c9566e"/><g class="teethrow">${tx.map((x) => `<rect x="${x - 8}" y="19" width="16" height="15" rx="5" fill="#fff"/><rect x="${x - 8}" y="39" width="16" height="15" rx="5" fill="#fff"/>`).join('')}</g><path d="M30 46 Q50 56 70 46" fill="#ff8fa3" opacity=".0"/></svg>`;
  root.append(mouth);
  const gs = ctx.size(76);
  const spots: [number, number][] = [[20, 26], [40, 26], [60, 26], [80, 26], [30, 46], [70, 46]].map(([x, y]) => [x, y] as [number, number]);
  const cols = ['#9bd36b', '#7fd0c0', '#b4d96b', '#8fd68a', '#a5d86f', '#7fd0a8'];
  const germs = spots.map(([x, y], i) => {
    const g = el('abs jiggle', P.germ(cols[i])); put(g, (x / 100) * mw + (W - mw) / 2, (y / 74) * mh + (H * 0.46 - mh / 2), gs);
    g.style.animationDelay = i * 0.2 + 's'; root.append(g); return g;
  });
  const brush = el('abs', P.brush()); put(brush, 0, 0, 100); brush.style.opacity = '0'; brush.style.pointerEvents = 'none'; brush.style.zIndex = '4'; root.append(brush);
  ctx.say('g.2.how');
  swipePop(ctx, root, germs, 28, (g) => {
    g.classList.remove('jiggle'); g.classList.add('pop'); sfx.pop(); ctx.hit();
    const c = centerOf(g); ctx.sparkle(c.x, c.y); setTimeout(() => g.remove(), 400);
  }, () => {
    mouth.querySelector('.teethrow')!.setAttribute('filter', 'drop-shadow(0 0 3px #fff7a8)');
    sfx.sparkle(); ctx.say('g.2.done'); ctx.later(() => { brush.remove(); ctx.praise(); ctx.finish(); }, 1800);
  }, brush);
};

/* 3 — Get dressed: drag Argentina kit onto the outline, end state = real dressed avatar */
export const dress: Game = (ctx) => {
  const { root, W, H } = ctx;
  const sh = Math.min(H * 0.62, 420), sw = sh * (379 / 743);
  const cx = W / 2, cy = H * 0.37;
  const sil = el('abs'); put(sil, cx, cy, sw, sh);
  const img = h('img', { src: asset('avatar/rafael-dressed.png'), style: 'width:100%;height:100%;object-fit:contain', class: 'sil', draggable: 'false' });
  sil.append(img); root.append(sil);
  const zone = (fx: number, fy: number, fw: number, fh: number) => {
    const z = el('abs zone'); put(z, cx - sw / 2 + fx * sw, cy - sh / 2 + fy * sh, fw * sw, fh * sh); root.append(z); return z;
  };
  const zShirt = zone(0.5, 0.36, 0.9, 0.3), zShorts = zone(0.5, 0.66, 0.66, 0.2), zSocks = zone(0.5, 0.88, 0.7, 0.1), zShoes = zone(0.5, 0.96, 0.8, 0.09);
  const tray = { x: W / 2, y: H * 0.86 };
  const b = root.getBoundingClientRect();
  const slotAt = (z: HTMLElement) => { const c = centerOf(z); return { x: c.x - b.left, y: c.y - b.top }; };
  ctx.say('g.3.how');
  dragSequence(ctx, [
    { html: P.shirt(), size: 130, target: zShirt, slot: slotAt(zShirt) },
    { html: P.shorts(), size: 110, target: zShorts, slot: slotAt(zShorts) },
    { html: P.sock(), size: 90, target: zSocks, slot: slotAt(zSocks) },
    { html: P.shoe(), size: 96, target: zShoes, slot: slotAt(zShoes) },
  ], tray, () => {
    root.querySelectorAll('.abs:not(.zone)').forEach((n) => { if (n !== sil) (n as HTMLElement).style.transition = 'opacity .8s', ((n as HTMLElement).style.opacity = '0'); });
    img.className = ''; img.style.transition = 'opacity .8s'; sfx.sparkle(); ctx.say('g.3.done');
    ctx.later(() => { ctx.praise(); ctx.finish(); }, 1600);
  });
};

const spoonSvg = `<svg viewBox="0 0 100 100" class="prop"><ellipse cx="70" cy="30" rx="20" ry="14" fill="#dfe6ec" transform="rotate(-30 70 30)"/><path d="M60 40 L16 88" stroke="#c9d3db" stroke-width="9" stroke-linecap="round"/></svg>`;

/* 4 — Breakfast: cereal, milk, toast; spoon "eats" */
export const breakfast: Game = (ctx) => {
  const { root, W, H } = ctx;
  const av = el('abs'); av.append(avatarImg('rafael-football', Math.min(H * 0.28, 210)));
  Object.assign(av.style, { left: '50%', top: '2%', transform: 'translateX(-50%)' });
  root.append(av);
  const bowl = put(el('abs zone', P.bowl()), W * 0.36, H * 0.5, ctx.size(150), 150);
  const plate = put(el('abs zone', P.plate()), W * 0.74, H * 0.5, ctx.size(130), 130);
  root.append(bowl, plate);
  const tray = { x: W / 2, y: H * 0.8 };
  ctx.say('g.4.how');
  dragSequence(ctx, [
    { html: P.cereal(), size: 110, target: bowl, slot: { x: W * 0.36, y: H * 0.5 - 14 } },
    { html: P.milk(), size: 110, target: bowl, slot: { x: W * 0.36, y: H * 0.5 - 14 } },
    { html: P.toast(), size: 100, target: plate, slot: { x: W * 0.74, y: H * 0.5 - 8 } },
  ], tray, () => {
    root.querySelectorAll('.abs').forEach((n) => { const e = n as HTMLElement; if (!e.classList.contains('zone') && e !== av) e.remove(); });
    bowl.innerHTML = P.bowlFull(); plate.innerHTML = frag(P.plate()).outerHTML + '';
    plate.querySelector('svg')!.insertAdjacentHTML('beforeend', '<path d="M30 52 C26 40 42 36 50 42 C58 36 74 40 70 52 L70 62 H30Z" fill="#e8b575" stroke="#c98f4e" stroke-width="2.5"/>');
    const sp = put(el('abs', spoonSvg), W * 0.36, H * 0.5, 110); sp.style.transition = 'all 1.1s ease-in-out'; root.append(sp);
    const bites = [0, 1, 2];
    bites.forEach((i) => {
      ctx.later(() => { const c = centerOf(av); const b = root.getBoundingClientRect(); sp.style.left = c.x - b.left - 55 + 'px'; sp.style.top = c.y - b.top + 20 + 'px'; sfx.whoosh(); }, 800 + i * 2600);
      ctx.later(() => { sfx.squish(0.3); }, 800 + i * 2600 + 1100);
      ctx.later(() => { sp.style.left = W * 0.36 - 55 + 'px'; sp.style.top = H * 0.5 - 55 + 'px'; }, 800 + i * 2600 + 1300);
    });
    ctx.later(() => { ctx.say('g.4.done'); }, 800 + 3 * 2600);
    ctx.later(() => { ctx.praise(); ctx.finish(); }, 800 + 3 * 2600 + 1800);
  });
};
