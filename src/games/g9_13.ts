import { Game, el, put, dragSequence, swipePop, centerOf } from './engine';
import { P } from '../art/props';
import { asset, STATIONS, imgOf } from '../content/stations';
import { sfx, haptic } from '../core/audio';
import { mokaSvg, setMoka } from '../art/moka';
import { h, drag, frag, clamp } from '../core/dom';

/* 9 — Free build with magnet tiles. No goal; a "finished" button appears after 20 s. */
export const build: Game = (ctx) => {
  const { root, W, H } = ctx;
  const cols = ['#ff9bb3', '#8fd0f0', '#ffe28a', '#a8e6cf', '#c8b6f2', '#ffb870'];
  const kinds: ('sq' | 'tri' | 'rect')[] = ['sq', 'tri', 'rect'];
  const board = el('abs'); Object.assign(board.style, { left: '3%', right: '3%', top: '2%', height: '64%', borderRadius: '30px', background: 'rgba(255,255,255,.6)', border: '4px dashed rgba(47,74,99,.18)' });
  root.append(board);
  const trayY = H * 0.84, ts = Math.max(86, ctx.size(92));
  const nextCol = { i: 0 };
  const snap = (v: number) => Math.round(v / 24) * 24;
  let count = 0;
  const makeDraggable = (tile: HTMLElement, w: number, hh: number) => {
    tile.dataset.t = '1';
    drag(tile, {
      start: () => { tile.style.zIndex = '4'; tile.style.transition = 'none'; sfx.tap(); },
      move: (x, y) => { const rb = root.getBoundingClientRect(); tile.style.left = x - rb.left - w / 2 + 'px'; tile.style.top = y - rb.top - hh / 2 + 'px'; },
      end: (x, y) => {
        const rb = root.getBoundingClientRect();
        if (y - rb.top > H * 0.7) { tile.classList.add('pop'); setTimeout(() => tile.remove(), 300); count--; return; }
        tile.style.transition = 'all .2s'; tile.style.left = snap(clamp(x - rb.left - w / 2, 4, W - w - 4)) + 'px'; tile.style.top = snap(clamp(y - rb.top - hh / 2, 4, H * 0.66 - hh)) + 'px'; sfx.place();
      },
    });
  };
  kinds.forEach((k, idx) => {
    const spot = W * (0.22 + idx * 0.28);
    const w = ts * (k === 'rect' ? 1.3 : 1), hh = k === 'rect' ? ts * 0.68 : ts;
    const proto = put(el('abs', P.tile(k, cols[idx])), spot, trayY, w, hh);
    proto.dataset.t = '1'; root.append(proto);
    let tile: HTMLElement | null = null;
    drag(proto, {
      start: (x, y) => {
        if (count >= 40) return;
        const c = cols[nextCol.i++ % cols.length]; const rb = root.getBoundingClientRect();
        tile = put(el('abs', P.tile(k, c)), x - rb.left, y - rb.top, w, hh); tile.style.zIndex = '4'; root.append(tile); count++; sfx.tap();
      },
      move: (x, y) => { if (!tile) return; const rb = root.getBoundingClientRect(); tile.style.left = x - rb.left - w / 2 + 'px'; tile.style.top = y - rb.top - hh / 2 + 'px'; },
      end: (x, y) => {
        if (!tile) return; const rb = root.getBoundingClientRect(); const t = tile; tile = null;
        if (y - rb.top > H * 0.7) { t.remove(); count--; return; }
        t.style.transition = 'all .2s'; t.style.left = snap(clamp(x - rb.left - w / 2, 4, W - w - 4)) + 'px'; t.style.top = snap(clamp(y - rb.top - hh / 2, 4, H * 0.66 - hh)) + 'px'; sfx.place(); ctx.hit();
        makeDraggable(t, w, hh);
      },
    });
  });
  ctx.say('g.9.how');
  ctx.later(() => {
    const b = h('button', { class: 'bigbtn', 'data-t': '1', 'data-testid': 'build-finish', style: 'position:absolute;left:50%;bottom:2%;transform:translateX(-50%);animation:fadeIn .6s both;z-index:6' }, frag(P.check()));
    b.addEventListener('click', () => { b.remove(); sfx.big(); ctx.praise(); ctx.finish(); });
    root.append(b); ctx.say('g.9.finish');
  }, 20000);
};

/* 10 — Memory: 3 pairs (6 cards) with station images */
export const memory: Game = (ctx) => {
  const { root, W, H } = ctx;
  const picks = [STATIONS[1], STATIONS[6], STATIONS[11]];
  const deck = [...picks, ...picks].map((s, i) => ({ s, i })).sort(() => Math.random() - 0.5);
  const cw = Math.min((W - 48) / 2, 200), ch = Math.min((H - 40) / 3 - 12, cw * 0.95);
  const grid = el('abs'); Object.assign(grid.style, { left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'grid', gridTemplateColumns: `repeat(2, ${cw}px)`, gap: '14px' });
  const cards = deck.map((d) => {
    const c = h('button', { class: 'mcard', 'data-t': '1' });
    Object.assign(c.style, { width: cw + 'px', height: ch + 'px', perspective: '700px', position: 'relative' });
    const inner = h('div', { class: 'mi' }); Object.assign(inner.style, { position: 'absolute', inset: '0', transition: 'transform .5s', transformStyle: 'preserve-3d' });
    const front = h('div', {}, h('img', { src: imgOf(d.s), draggable: 'false', style: 'width:100%;height:100%;object-fit:cover;border-radius:24px' }));
    Object.assign(front.style, { position: 'absolute', inset: '0', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: '24px', background: '#fff', padding: '5px', boxShadow: 'var(--shadow)' });
    const back = h('div', {}); back.innerHTML = P.paw(); Object.assign(back.style, { position: 'absolute', inset: '0', backfaceVisibility: 'hidden', borderRadius: '24px', background: 'linear-gradient(135deg,#8fd0f0,#bfe3f7)', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow)', padding: '26%' });
    inner.append(front, back); c.append(inner); grid.append(c);
    return { c, inner, id: d.s.id, matched: false };
  });
  root.append(grid);
  const show = (k: typeof cards[0], on: boolean) => { k.inner.style.transform = on ? 'rotateY(180deg)' : 'none'; };
  let busy = true, open: typeof cards = [], matched = 0;
  cards.forEach((k) => show(k, true));
  ctx.say('g.10.how');
  ctx.later(() => { cards.forEach((k) => show(k, false)); busy = false; }, 2600);
  cards.forEach((k) => k.c.addEventListener('click', () => {
    if (busy || k.matched || open.includes(k)) return;
    sfx.flip(); show(k, true); open.push(k);
    if (open.length < 2) return;
    busy = true; const [a, b] = open;
    if (a.id === b.id) {
      a.matched = b.matched = true; matched++; open = [];
      ctx.later(() => { sfx.chime(matched); ctx.hit(); const c = centerOf(a.c); ctx.sparkle(c.x, c.y); const d = centerOf(b.c); ctx.sparkle(d.x, d.y); busy = false;
        if (matched === 3) { ctx.later(() => { ctx.praise(); ctx.finish(); }, 700); } }, 500);
    } else {
      ctx.later(() => { ctx.miss(); }, 600);
      ctx.later(() => { show(a, false); show(b, false); open = []; busy = false;
        if (ctx.scale > 1) { const t = cards.find((x) => !x.matched && x !== a && x !== b) ?? a; const pair = cards.filter((x) => !x.matched && x.id === t.id); pair.forEach((x) => x.c.classList.add('jiggle')); ctx.later(() => pair.forEach((x) => x.c.classList.remove('jiggle')), 2500); }
      }, 1700);
    }
  }));
};

/* 11 — Dinner: veg, chicken, sweet potato to the plate; water to the table */
export const dinner: Game = (ctx) => {
  const { root, W, H } = ctx;
  const table = el('abs'); Object.assign(table.style, { left: '0', right: '0', top: H * 0.44 + 'px', height: '10px', background: '#c9a06c', borderRadius: '5px' });
  const plate = put(el('abs zone', P.plate()), W * 0.38, H * 0.38, ctx.size(190), 150);
  const mat = put(el('abs zone'), W * 0.82, H * 0.37, ctx.size(100), 130);
  const av = el('abs'); av.append(h('img', { src: asset('avatar/rafael-football.png'), style: `height:${Math.min(H * 0.2, 150)}px`, draggable: 'false' })); Object.assign(av.style, { left: '50%', top: '1%', transform: 'translateX(-50%)', opacity: '.95' });
  root.append(av, table, plate, mat);
  const tray = { x: W / 2, y: H * 0.74 };
  const pc = { x: W * 0.38, y: H * 0.38 };
  ctx.say('g.11.how');
  dragSequence(ctx, [
    { html: P.broccoli(), size: 100, target: plate, slot: { x: pc.x - 28, y: pc.y - 6 } },
    { html: P.chicken(), size: 110, target: plate, slot: { x: pc.x + 6, y: pc.y + 10 } },
    { html: P.sweet(), size: 100, target: plate, slot: { x: pc.x + 38, y: pc.y - 4 }, onPlace: () => ctx.later(() => ctx.say('g.11.water'), 900) },
    { html: P.glass(1), size: 100, target: mat, slot: { x: W * 0.82, y: H * 0.37 - 10 } },
  ], tray, () => { sfx.sparkle(); ctx.later(() => { ctx.praise(); ctx.finish(); }, 800); });
};

/* 12 — Bath: swipe to scrub and pop bubbles; the duck floats */
export const bath: Game = (ctx) => {
  const { root, W, H } = ctx;
  const tw = Math.min(W * 0.94, 420), th = H * 0.58, ty = H * 0.5;
  const tub = put(el('abs'), W / 2, ty, tw, th);
  Object.assign(tub.style, { background: '#fff', borderRadius: '40px 40px 90px 90px', boxShadow: 'var(--shadow)', overflow: 'hidden' });
  tub.innerHTML = `<div style="position:absolute;left:0;right:0;bottom:0;height:70%;background:linear-gradient(#bfe6fb,#8fd0f0)"></div>`;
  root.append(tub);
  const duck = put(el('abs', P.duck()), W / 2, ty + th * 0.05, 100); duck.style.animation = 'bob 2.4s ease-in-out infinite'; root.append(duck);
  const n = 10, bs = ctx.size(84);
  const bubbles = Array.from({ length: n }, (_, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const bx = W / 2 - tw / 2 + tw * (0.2 + col * 0.3) + (Math.random() - 0.5) * 24, by = ty - th / 2 + th * (0.2 + row * 0.2) + (Math.random() - 0.5) * 20;
    const b = put(el('abs', P.bubble()), bx, by, bs); b.style.animation = `bob ${2 + Math.random() * 2}s ease-in-out infinite`; root.append(b); return b;
  });
  const sponge = el('abs', `<svg viewBox="0 0 100 100" class="prop"><rect x="10" y="22" width="80" height="56" rx="18" fill="#ffe066"/><g fill="#f0c940"><circle cx="30" cy="40" r="5"/><circle cx="56" cy="56" r="5"/><circle cx="70" cy="36" r="4"/></g></svg>`);
  put(sponge, 0, 0, 100); sponge.style.opacity = '0'; sponge.style.pointerEvents = 'none'; sponge.style.zIndex = '4'; root.append(sponge);
  ctx.say('g.12.how');
  swipePop(ctx, root, bubbles, 24, (b) => { b.style.animation = ''; b.classList.add('pop'); sfx.pop(); ctx.hit(); const c = centerOf(b); ctx.sparkle(c.x, c.y); setTimeout(() => b.remove(), 400); },
    () => { sponge.remove(); duck.style.animation = 'cheer 1s ease-in-out infinite'; sfx.sparkle(); ctx.later(() => { ctx.praise(); ctx.finish(); }, 800); }, sponge);
};

/* 13 — Sleep: lamps off, teddy to bed, Moka lies down → Night Mode */
export const sleep: Game = (ctx) => {
  const { root, W, H } = ctx;
  const dark = el('abs'); Object.assign(dark.style, { inset: '0', background: '#101a40', opacity: '0', transition: 'opacity 1.6s', pointerEvents: 'none', zIndex: '6' });
  const bed = put(el('abs', P.bed()), W / 2, H * 0.6, Math.min(W * 0.8, 330), 220);
  const blanket = put(el('abs'), W / 2 + 28, H * 0.6 + 24, Math.min(W * 0.8, 330) * 0.62, 62);
  Object.assign(blanket.style, { background: '#7fa6e6', borderRadius: '24px', opacity: '0', transition: 'opacity .8s' });
  root.append(bed, blanket);
  const lamps = [0.2, 0.5, 0.8].map((fx) => { const l = put(el('abs', P.lamp(true)), W * fx, H * 0.2, ctx.size(100)); l.dataset.t = '1'; root.append(l); return l; });
  root.append(dark);
  ctx.say('g.13.how');
  let off = 0;
  lamps.forEach((l) => l.addEventListener('pointerdown', () => {
    if (l.dataset.off) return; l.dataset.off = '1'; l.innerHTML = P.lamp(false); delete l.dataset.t; off++; sfx.soft(); ctx.hit();
    dark.style.opacity = String(off * 0.22);
    if (off === 3) ctx.later(teddy, 1200);
  }));
  function teddy() {
    const bw = Math.min(W * 0.8, 330);
    const tgt = put(el('abs zone'), W / 2 - bw * 0.2, H * 0.6 - 10, 130, 90); root.append(tgt); root.append(dark);
    ctx.say('g.13.teddy');
    dragSequence(ctx, [{ html: P.teddy(), size: 100, target: tgt, slot: { x: W / 2 - bw * 0.2, y: H * 0.6 - 18 } }], { x: W / 2, y: H * 0.86 }, () => {
      blanket.style.opacity = '1'; sfx.soft();
      const mk = mokaSvg('walking'); const mw = el('abs'); mw.append(mk); put(mw, W * 0.12, H * 0.78, 120, 120); mw.style.transition = 'left 2.2s ease-in-out'; mw.style.zIndex = '7'; root.append(mw);
      ctx.later(() => { mw.style.left = W / 2 + bw * 0.25 + 'px'; }, 200);
      ctx.later(() => { setMoka(mk, 'sleepy'); ctx.say('g.13.moka'); }, 2600);
      ctx.later(() => { dark.style.opacity = '0.8'; ctx.finish(); }, 4800);
    });
  }
  void haptic;
};
