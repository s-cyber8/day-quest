import { Game, el, put, dragItems, DragItem, inside, rel, swipePop, centerOf, shuffle, triesBar, timerBar, Pt } from './engine';
import { P } from '../art/props';
import { asset } from '../content/stations';
import { sfx } from '../core/audio';
import { h, frag } from '../core/dom';

const avatarImg = (name: string, hgt: number) => h('img', { src: asset(`avatar/${name}.png`), style: `height:${hgt}px;display:block`, draggable: 'false' });
const icon = (html: string, size: number) => { const e = el('', html); e.style.width = e.style.height = size + 'px'; return e; };
const curtainsIcon = `<svg viewBox="0 0 100 100" class="prop"><rect x="8" y="12" width="84" height="76" rx="12" fill="#bfe3f7" stroke="#fff" stroke-width="6"/><rect x="8" y="12" width="40" height="76" rx="10" fill="#ffb3c1"/><rect x="52" y="12" width="40" height="76" rx="10" fill="#ffb3c1"/></svg>`;

/* 1 — Wake up. L1: curtains → stretch (clock is a decoy). L2: curtains → clock → stretch, in the order shown. L3: Simon sequence of 4. */
export const wake: Game = (ctx) => {
  const { root, W, H } = ctx;
  if (ctx.level === 3) return simon();
  ctx.budget(ctx.level === 1 ? 4 : 3);
  const ww = Math.min(W * 0.84, 340), wh = ww * 0.62;
  const win = put(el('abs'), W / 2, H * 0.22, ww, wh);
  Object.assign(win.style, { borderRadius: '28px', overflow: 'hidden', border: '10px solid #fff', background: 'linear-gradient(#bfe3f7,#eaf8ff)', boxShadow: 'var(--shadow)' });
  const sun = el('abs', P.sun()); Object.assign(sun.style, { width: '40%', height: '70%', left: '30%', bottom: '-70%', transition: 'bottom 3s ease-out' });
  const cl = (side: 'left' | 'right') => { const c = el('abs bar'); Object.assign(c.style, { top: '0', bottom: '0', width: '51%', [side]: '0', background: 'repeating-linear-gradient(90deg,#ffb3c1 0 16px,#ffc9d4 16px 32px)' }); return c; };
  const cL = cl('left'), cR = cl('right'); win.append(sun, cL, cR); win.dataset.t = '1'; win.dataset.testid = 'w-curtains';
  const clock = put(el('abs', P.clock()), W * 0.22, H * 0.52, ctx.size(100)); clock.dataset.t = '1'; clock.dataset.testid = 'w-clock';
  const av = el('abs'); av.append(avatarImg('rafael-football', Math.min(H * 0.34, 260)));
  Object.assign(av.style, { left: '58%', bottom: '2%', transform: 'translateX(-50%)', transformOrigin: '50% 100%', transition: 'transform .5s cubic-bezier(.3,1.6,.5,1)' }); av.dataset.t = '1'; av.dataset.testid = 'w-av';
  root.append(win, clock, av);
  const steps = ctx.level === 1 ? ['curtains', 'stretch'] : ['curtains', 'clock', 'stretch'];
  // order strip (pictures, no words)
  const strip = el('abs'); Object.assign(strip.style, { left: '50%', bottom: '2px', transform: 'translateX(-50%)', display: 'flex', gap: '10px', background: 'rgba(255,255,255,.85)', borderRadius: '20px', padding: '6px 12px', zIndex: '4', alignItems: 'center' });
  const strip1 = steps.map((s, i) => { const c = icon(s === 'curtains' ? curtainsIcon : s === 'clock' ? P.clock() : `<img src="${asset('avatar/rafael-football.png')}" style="height:100%;object-fit:contain">`, 46); c.style.opacity = '.5'; if (i) strip.append(h('span', { style: 'color:#7fb9de;font-weight:700' }, '›')); strip.append(c); return c; });
  root.append(strip);
  let step = 0;
  const target = () => (steps[step] === 'curtains' ? win : steps[step] === 'clock' ? clock : av);
  const refreshHint = () => { strip1.forEach((c, i) => (c.style.opacity = i < step ? '.25' : i === step ? '1' : '.5')); ctx.hand(() => (step < steps.length ? { kind: 'tap', at: rel(ctx, target()) } : null)); };
  ctx.say(ctx.level === 1 ? 'g.1.curtains' : 'g.1.order');
  const advance = () => {
    step++; ctx.hit();
    if (step >= steps.length) { sfx.sparkle(); ctx.praise(); ctx.win(); return; }
    ctx.say(steps[step] === 'clock' ? 'g.1.clock' : 'g.1.stretch'); refreshHint();
  };
  const press = (which: string, e: HTMLElement) => e.addEventListener('pointerdown', () => {
    if (step >= steps.length) return;
    if (steps[step] !== which) { e.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], 300); ctx.mistake(); return; }
    if (which === 'curtains') { cL.style.transform = 'translateX(-92%)'; cR.style.transform = 'translateX(92%)'; sfx.whoosh(); sun.style.bottom = '8%'; ctx.later(() => sfx.chime(1), 900); }
    else if (which === 'clock') { clock.animate([{ transform: 'rotate(-12deg)' }, { transform: 'rotate(12deg)' }, { transform: 'none' }], 400); sfx.soft(); }
    else { av.style.transform = 'translateX(-50%) scaleY(1.14) rotate(3deg)'; sfx.boing(); ctx.later(() => (av.style.transform = 'translateX(-50%)'), 450); const c = centerOf(av); ctx.sparkle(c.x, c.y - 60); }
    advance();
  });
  press('curtains', win); press('clock', clock); press('stretch', av);
  refreshHint();

  function simon() {
    ctx.budget(2);
    const pads = [
      { c: '#ffb3c1', html: curtainsIcon }, { c: '#ffe28a', html: P.clock() }, { c: '#a8e6cf', html: P.sun() },
      { c: '#bfe3f7', html: `<img src="${asset('avatar/rafael-football.png')}" style="height:100%;object-fit:contain">` },
    ].map((p, i) => {
      const e = el('abs'); const sz = Math.min(W * 0.4, 160);
      put(e, W / 2 + (i % 2 ? 1 : -1) * (sz * 0.58), H * 0.3 + Math.floor(i / 2) * (sz * 1.15), sz, sz);
      Object.assign(e.style, { background: p.c, borderRadius: '34px', boxShadow: 'var(--shadow)', padding: '16%', transition: 'transform .25s, filter .25s' });
      e.innerHTML = p.html; e.dataset.t = '1'; e.dataset.testid = 'pad-' + i; root.append(e); return e;
    });
    const seq = Array.from({ length: 4 }, () => Math.floor(Math.random() * 4));
    for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) seq[i] = (seq[i] + 1) % 4;
    root.dataset.simon = seq.join('');
    let pos = 0, accepting = false;
    const flash = (i: number) => { pads[i].style.transform = 'scale(1.12)'; pads[i].style.filter = 'brightness(1.15) drop-shadow(0 0 14px #fff6a8)'; sfx.chime(i); ctx.later(() => { pads[i].style.transform = ''; pads[i].style.filter = ''; }, 450); };
    const demo = () => {
      accepting = false; pos = 0; ctx.hand(null); ctx.say('g.1.simon');
      seq.forEach((n, k) => ctx.later(() => flash(n), 2600 + k * 800));
      ctx.later(() => { accepting = true; ctx.say('g.1.simon.go'); ctx.hand(() => ({ kind: 'tap', at: rel(ctx, pads[seq[pos]]) })); }, 2600 + seq.length * 800 + 300);
    };
    pads.forEach((p, i) => p.addEventListener('pointerdown', () => {
      if (!accepting) return;
      flash(i);
      if (seq[pos] !== i) { accepting = false; if (!ctx.mistake(false)) { ctx.say('retry.1'); ctx.later(demo, 1800); } return; }
      pos++; ctx.hit();
      if (pos >= seq.length) { accepting = false; ctx.praise(); ctx.win(); }
    }));
    demo();
  }
};

/* 2 — Brush teeth. L1: germs stay put. L2: germs hide behind teeth. L3: clean the 4 zones in the order shown, with a generous timer. */
export const teeth: Game = (ctx) => {
  const { root, W, H } = ctx;
  ctx.budget(ctx.level === 1 ? 6 : ctx.level === 2 ? 5 : 3);
  const mw = Math.min(W * 0.92, 400), mh = mw * 0.74, mcx = W / 2, mcy = H * 0.42;
  const mouth = put(el('abs'), mcx, mcy, mw, mh);
  const tx = [20, 40, 60, 80];
  mouth.innerHTML = `<svg viewBox="0 0 100 74" class="prop"><path d="M6 36 C6 8 94 8 94 36 C94 66 6 66 6 36Z" fill="#ff8fa3"/><path d="M12 36 C12 14 88 14 88 36 C88 60 12 60 12 36Z" fill="#c9566e"/><g class="teethrow">${tx.map((x) => `<rect x="${x - 8}" y="19" width="16" height="15" rx="5" fill="#fff"/><rect x="${x - 8}" y="39" width="16" height="15" rx="5" fill="#fff"/>`).join('')}</g></svg>`;
  root.append(mouth);
  const gs = ctx.size(70);
  const pos = (x: number, y: number): Pt => ({ x: (x / 100) * mw + (W - mw) / 2, y: (y / 74) * mh + (mcy - mh / 2) });
  const slots: { x: number; y: number; q: number }[] = [];
  tx.forEach((x, i) => { slots.push({ x, y: 26, q: i < 2 ? 0 : 1 }); slots.push({ x, y: 47, q: i < 2 ? 2 : 3 }); });
  const chosen = ctx.level === 3 ? slots : shuffle(slots).slice(0, 6);
  const cols = ['#9bd36b', '#7fd0c0', '#b4d96b', '#8fd68a', '#a5d86f', '#7fd0a8', '#9bd36b', '#7fd0c0'];
  const germs = chosen.map((s, i) => {
    const g = el('abs', P.germ(cols[i])); g.dataset.testid = 'germ'; const p = pos(s.x, s.y); put(g, p.x, p.y, gs); g.dataset.q = String(s.q);
    if (ctx.level === 1) { g.classList.add('jiggle'); g.style.animationDelay = i * 0.2 + 's'; }
    root.append(g); return g;
  });
  const brush = el('abs', P.brush()); put(brush, 0, 0, 100); Object.assign(brush.style, { opacity: '0', pointerEvents: 'none', zIndex: '4' }); root.append(brush);
  let left = germs.length; let timer: { stop(): void } | null = null;
  // L2: germs duck behind the teeth for a moment
  if (ctx.level === 2) {
    ctx.say('g.2.hide');
    germs.forEach((g, i) => {
      let t = i * 0.7; let hid = false;
      ctx.loop((dt) => { if (g.dataset.popped) return; t += dt; const cyc = t % 3.4; const hide = cyc > 2.1; if (hide !== hid) { hid = hide; g.style.transition = 'transform .35s, opacity .35s'; g.style.transform = hide ? 'scale(.2)' : ''; g.style.opacity = hide ? '0' : '1'; g.dataset.hidden = hide ? '1' : ''; } });
    });
  }
  // L3: zones in a shown order
  let order = shuffle([0, 1, 2, 3]), zi = 0;
  const zoneBox = [[8, 14, 50, 30], [50, 14, 92, 30], [8, 38, 50, 58], [50, 38, 92, 58]]; // % of mouth
  const guide = el('abs'); Object.assign(guide.style, { border: '5px dashed #fff', borderRadius: '24px', zIndex: '3', pointerEvents: 'none', boxShadow: '0 0 0 4px rgba(255,255,255,.35)', display: 'none' }); root.append(guide);
  const setZone = () => {
    const q = order[zi]; const [a, b, c, d] = zoneBox[q];
    const p0 = pos(a, (b / 100) * 74), p1 = pos(c, (d / 100) * 74);
    Object.assign(guide.style, { display: 'block', left: p0.x + 'px', top: pos(0, b * 0.74).y + 'px', width: p1.x - p0.x + 'px', height: pos(0, d * 0.74).y - pos(0, b * 0.74).y + 'px' });
    ctx.hand(() => { const c0 = { x: (p0.x + p1.x) / 2, y: pos(0, ((b + d) / 2) * 0.74).y }; return { kind: 'drag', from: { x: c0.x - 40, y: c0.y }, to: { x: c0.x + 40, y: c0.y } }; });
  };
  const live = () => germs.filter((g) => !g.dataset.popped && !g.dataset.hidden && (ctx.level !== 3 || +g.dataset.q! === order[zi]));
  if (ctx.level === 3) { ctx.say('g.2.zone'); setZone(); timer = timerBar(ctx, 75, () => ctx.lose()); }
  else { ctx.say('g.2.how'); ctx.hand(() => { const g = germs.find((x) => !x.dataset.popped); if (!g) return null; const c = rel(ctx, g); return { kind: 'drag', from: { x: c.x - 60, y: c.y }, to: { x: c.x + 40, y: c.y } }; }); }
  swipePop(ctx, root, live, 22, (g) => {
    g.classList.remove('jiggle'); g.classList.add('pop'); sfx.pop(); ctx.hit(); left--;
    const c = centerOf(g); ctx.sparkle(c.x, c.y); setTimeout(() => g.remove(), 400);
    if (ctx.level === 3 && !germs.some((x) => !x.dataset.popped && +x.dataset.q! === order[zi])) { zi++; sfx.chime(zi); if (zi < 4) setZone(); else guide.style.display = 'none'; }
    if (left === 0) {
      timer?.stop(); mouth.querySelector('.teethrow')!.setAttribute('filter', 'drop-shadow(0 0 3px #fff7a8)');
      sfx.sparkle(); ctx.say('g.2.done'); ctx.later(() => { brush.remove(); ctx.praise(); ctx.win(); }, 1800);
    }
  }, (n) => { if (n === 0 && left > 0) ctx.mistake(false); }, brush);
};

/* 3 — Get dressed, in the right order. L1: one piece at a time. L2: all pieces, correct order. L3: plus rain-coat and pajamas to leave out. */
export const dress: Game = (ctx) => {
  const { root, W, H } = ctx;
  ctx.budget(ctx.level === 1 ? 5 : ctx.level === 2 ? 3 : 2);
  const sh = Math.min(H * 0.56, 400), sw = sh * (379 / 743);
  const cx = W / 2, cy = H * 0.34;
  const sil = el('abs'); put(sil, cx, cy, sw, sh);
  const img = h('img', { src: asset('avatar/rafael-dressed.png'), style: 'width:100%;height:100%;object-fit:contain', class: 'sil', draggable: 'false' });
  sil.append(img); root.append(sil);
  const zone = (fx: number, fy: number, fw: number, fh: number) => { const z = el('abs zone'); put(z, cx - sw / 2 + fx * sw, cy - sh / 2 + fy * sh, fw * sw, fh * sh); root.append(z); return z; };
  const zTorso = zone(0.5, 0.36, 0.95, 0.3), zLegs = zone(0.5, 0.66, 0.7, 0.2), zFeet = zone(0.5, 0.93, 0.9, 0.16);
  const order: { id: string; html: string; zone: HTMLElement; size: number }[] = [
    { id: 'vest', html: P.vest(), zone: zTorso, size: 100 }, { id: 'shirt', html: P.shirt(), zone: zTorso, size: 120 },
    { id: 'shorts', html: P.shorts(), zone: zLegs, size: 100 }, { id: 'socks', html: P.sock(), zone: zFeet, size: 80 }, { id: 'shoes', html: P.shoe(), zone: zFeet, size: 84 },
  ];
  const decoys = [{ id: 'rain', html: P.raincoat(), zone: zTorso, size: 100 }, { id: 'pj', html: P.pajamas(), zone: zTorso, size: 100 }];
  let next = 0;
  const placedEls: HTMLElement[] = [];
  const finish = () => {
    placedEls.forEach((n) => { n.style.transition = 'opacity .8s'; n.style.opacity = '0'; });
    img.className = ''; sfx.sparkle(); ctx.say('g.3.done'); ctx.later(() => { ctx.praise(); ctx.win(); }, 1600);
  };
  const mkItem = (o: typeof order[0], home: Pt, decoy: boolean): DragItem => ({
    id: o.id, html: o.html, size: o.size > 90 ? 84 : 72, home,
    onDrop: (c) => {
      const zhit = inside(c, o.zone, ctx, 20);
      const anyZone = [zTorso, zLegs, zFeet].some((z) => inside(c, z, ctx, 20));
      if (!anyZone) return null; // dropped in empty space: just floats back, no penalty
      if (!zhit || decoy || order[next].id !== o.id) { ctx.mistake(); if (decoy) ctx.say('g.3.sunny'); return null; }
      next++; const z = rel(ctx, o.zone);
      const off = o.id === 'shirt' ? 0 : o.id === 'vest' ? 0 : o.id === 'socks' ? -8 : 0;
      if (next >= order.length) ctx.later(finish, 500); else if (ctx.level > 1) refresh();
      return { x: z.x + off, y: z.y + (o.id === 'shoes' ? 10 : 0) };
    },
  });
  const homeFor = (i: number, n: number, row = 0): Pt => ({ x: (W / (n + 1)) * (i + 1), y: H * (ctx.level === 3 ? 0.77 + row * 0.12 : 0.82) });
  if (ctx.level === 1) {
    ctx.say('g.3.how');
    const showOne = () => {
      if (next >= order.length) return;
      const o = order[next];
      const [it] = [mkItem(o, { x: W / 2, y: H * 0.84 }, false)];
      const baseDrop = it.onDrop; it.onDrop = (c, i) => { const r = baseDrop(c, i); if (r) ctx.later(showOne, 900); return r; };
      dragItems(ctx, [it], () => {}); placedEls.push(it.el!);
      ctx.hand(() => ({ kind: 'drag', from: { x: W / 2, y: H * 0.84 }, to: rel(ctx, o.zone) }));
    };
    showOne();
    return void refreshNoop();
  }
  ctx.say('g.3.order');
  const pool = ctx.level === 2 ? order.map((o) => ({ o, d: false })) : shuffle([...order.map((o) => ({ o, d: false })), ...decoys.map((o) => ({ o, d: true }))]);
  if (ctx.level === 3) ctx.say('g.3.sunny');
  const n1 = ctx.level === 3 ? 4 : pool.length;
  const items = shuffle(pool).map((p, i) => {
    const row = ctx.level === 3 ? (i < n1 ? 0 : 1) : 0; const idx = ctx.level === 3 ? (i < n1 ? i : i - n1) : i; const cnt = ctx.level === 3 ? (i < n1 ? n1 : pool.length - n1) : pool.length;
    return mkItem(p.o, homeFor(idx, cnt, row), p.d);
  });
  dragItems(ctx, items); items.forEach((i) => placedEls.push(i.el!));
  function refresh() { const o = order[next]; const it = items.find((x) => x.id === o.id)!; ctx.hand(() => ({ kind: 'drag', from: it.home, to: rel(ctx, o.zone) })); }
  function refreshNoop() { /* level 1 handles its own hint */ }
  refresh();
};

/* 4 — Breakfast order. L1: picture card, 3 foods. L2: includes "how many". L3: card disappears — remember 5 items. */
export const breakfast: Game = (ctx) => {
  const { root, W, H } = ctx;
  ctx.budget(ctx.level === 1 ? 4 : ctx.level === 2 ? 3 : 2);
  const FOODS: Record<string, string> = { cereal: P.cereal(), milk: P.milk(), toast: P.toast(), banana: P.banana(), egg: P.egg(), juice: P.juice() };
  const need: string[] = ctx.level === 1 ? ['cereal', 'milk', 'toast'] : ctx.level === 2 ? ['toast', 'toast', 'banana', 'juice'] : shuffle(['cereal', 'milk', 'banana', 'toast', 'egg']);
  const trayIds = ctx.level === 1 ? shuffle(['cereal', 'milk', 'toast', 'banana', 'egg']) : ctx.level === 2 ? shuffle(['toast', 'toast', 'toast', 'banana', 'juice', 'egg']) : shuffle(['cereal', 'milk', 'banana', 'toast', 'toast', 'egg', 'juice']);
  const av = el('abs'); av.append(avatarImg('rafael-football', Math.min(H * 0.2, 150))); Object.assign(av.style, { left: '50%', top: H * 0.24 + 'px', transform: 'translateX(-50%)' }); root.append(av);
  // order card
  const card = el('abs'); Object.assign(card.style, { left: '50%', top: '4px', transform: 'translateX(-50%)', display: 'flex', gap: '6px', background: '#fff', borderRadius: '22px', padding: '8px 12px', boxShadow: 'var(--shadow)', zIndex: '4' });
  card.dataset.need = need.join(',');
  need.forEach((f) => card.append(icon(FOODS[f], 52)));
  root.append(card);
  if (ctx.level === 3) { ctx.say('g.4.memory'); ctx.later(() => { card.innerHTML = ''; need.forEach(() => { const q = el('', ''); Object.assign(q.style, { width: '52px', height: '52px', borderRadius: '50%', background: '#e3eef6', display: 'grid', placeItems: 'center', color: '#7fb9de', fontWeight: '700', fontSize: '28px' }); q.textContent = '?'; card.append(q); }); ctx.hand(firstHint); }, 4500); }
  else ctx.say('g.4.how');
  const mat = el('abs zone glow'); put(mat, W / 2, H * 0.46, Math.min(W * 0.9, 360), H * 0.17); root.append(mat);
  mat.innerHTML = P.plate(); (mat.firstChild as SVGElement).style.cssText = 'position:absolute;inset:0;opacity:.55;width:100%;height:100%';
  const remaining = [...need]; let placed = 0;
  const per = Math.ceil(trayIds.length / 2);
  const items: DragItem[] = trayIds.map((f, i) => {
    const row = i < per ? 0 : 1, idx = row ? i - per : i, cnt = row ? trayIds.length - per : per;
    return {
      id: f, html: FOODS[f], size: 72, home: { x: (W / (cnt + 1)) * (idx + 1), y: H * (0.68 + row * 0.12) },
      onDrop: (c) => {
        if (!inside(c, mat, ctx, 10)) return null;
        const k = remaining.indexOf(f);
        if (k < 0) { ctx.mistake(); return null; }
        remaining.splice(k, 1); const m = rel(ctx, mat); const slot = placed++;
        const tot = need.length; if (!remaining.length) ctx.later(eat, 600); else ctx.hand(firstHint);
        return { x: m.x - ((tot - 1) * 34) + slot * 68, y: m.y };
      },
    };
  });
  dragItems(ctx, items);
  function firstHint() { const f = remaining[0]; const it = items.find((x) => x.id === f && !x.placed); return it ? { kind: 'drag' as const, from: it.home, to: rel(ctx, mat) } : null; }
  ctx.hand(ctx.level === 3 ? null : firstHint);
  const spoon = `<svg viewBox="0 0 100 100" class="prop"><ellipse cx="70" cy="30" rx="20" ry="14" fill="#dfe6ec" transform="rotate(-30 70 30)"/><path d="M60 40 L16 88" stroke="#c9d3db" stroke-width="9" stroke-linecap="round"/></svg>`;
  function eat() {
    const sp = put(el('abs', spoon), rel(ctx, mat).x, rel(ctx, mat).y, 100); sp.style.transition = 'all 1s ease-in-out'; sp.style.zIndex = '9'; root.append(sp);
    [0, 1].forEach((i) => {
      ctx.later(() => { const c = rel(ctx, av); sp.style.left = c.x - 50 + 'px'; sp.style.top = c.y + 'px'; sfx.whoosh(); }, 300 + i * 2200);
      ctx.later(() => sfx.squish(0.3), 300 + i * 2200 + 1000);
      ctx.later(() => { sp.style.left = W / 2 - 50 + 'px'; sp.style.top = rel(ctx, mat).y - 50 + 'px'; }, 300 + i * 2200 + 1200);
    });
    ctx.later(() => ctx.say('g.4.done'), 4800); ctx.later(() => { ctx.praise(); ctx.win(); }, 6200);
  }
  void frag;
};
