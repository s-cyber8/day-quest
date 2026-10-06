import { Game, GameCtx, el, put, dragItems, DragItem, inside, rel, swipePop, centerOf, shuffle, triesBar, Pt } from './engine';
import { P } from '../art/props';
import { asset, STATIONS, imgOf } from '../content/stations';
import { sfx, haptic } from '../core/audio';
import { mokaSvg, setMoka } from '../art/moka';
import { h, drag, frag, clamp } from '../core/dom';

const avatar = (hgt: number) => h('img', { src: asset('avatar/rafael-football.png'), style: `height:${hgt}px;display:block`, draggable: 'false' });
const COLS = ['#ff9bb3', '#8fd0f0', '#ffe28a', '#a8e6cf', '#c8b6f2', '#ffb870'];
type Kind = 'sq' | 'tri' | 'rect';
const KINDS: Kind[] = ['sq', 'tri', 'rect'];
const tileDims = (k: Kind, s: number) => ({ w: s * (k === 'rect' ? 1.3 : 1), hh: k === 'rect' ? s * 0.68 : s });

/* 9 — Free build, or copy the picture (L2/L3). */
export const build: Game = (ctx) => {
  if (ctx.level === 1) return mode('free');
  // choose a mode
  ctx.say('g.9.choose');
  const wrap = el('abs'); Object.assign(wrap.style, { inset: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', zIndex: '5' });
  const mk = (label: string, html: string, which: 'free' | 'copy') => {
    const b = h('button', { class: 'tile', 'data-testid': 'mode-' + which, 'data-t': '1', style: 'width:min(70%,240px);min-height:0;padding:8px' }, h('div', { class: 'ic', style: 'width:64px;height:64px' }), h('div', {}, label));
    (b.firstChild as HTMLElement).innerHTML = html;
    b.onclick = () => { sfx.tap(); wrap.remove(); mode(which); };
    return b;
  };
  wrap.append(mk('בונים חופשי', P.tile('tri', COLS[1]), 'free'), mk('כמו בתמונה', P.tile('sq', COLS[0]), 'copy'));
  ctx.root.append(wrap);
  ctx.hand(() => ({ kind: 'tap', at: { x: ctx.W / 2, y: ctx.H * 0.36 } }));

  function mode(which: 'free' | 'copy') {
    const { root, W, H } = ctx;
    ctx.hand(null);
    const copy = which === 'copy';
    const ts = 76;
    const bTop = copy ? H * 0.27 : H * 0.02, bH = copy ? H * 0.42 : H * 0.64, bL = W * 0.03, bW = W * 0.94;
    const board = el('abs'); board.dataset.testid = 'board'; Object.assign(board.style, { left: bL + 'px', top: bTop + 'px', width: bW + 'px', height: bH + 'px', borderRadius: '30px', background: 'rgba(255,255,255,.6)', border: '4px dashed rgba(47,74,99,.18)' });
    root.append(board);
    const COLN = 4, ROWN = 3;
    const cell = (c: number, r: number): Pt => ({ x: bL + (bW / COLN) * (c + 0.5), y: bTop + (bH / ROWN) * (r + 0.5) });
    const nearest = (p: Pt) => { const c = clamp(Math.floor((p.x - bL) / (bW / COLN)), 0, COLN - 1), r = clamp(Math.floor((p.y - bTop) / (bH / ROWN)), 0, ROWN - 1); return { c, r, ...cell(c, r) }; };
    const placed = new Map<string, { kind: Kind; e: HTMLElement }>();
    const trayY = H * 0.82;
    const snapFree = (v: number) => Math.round(v / 24) * 24;
    let count = 0, ref: { c: number; r: number; kind: Kind }[] = [];
    if (copy) {
      const n = ctx.level === 2 ? 3 : 5; ctx.budget(ctx.level === 2 ? 2 : 1);
      const cells = shuffle(Array.from({ length: COLN * ROWN }, (_, i) => ({ c: i % COLN, r: Math.floor(i / COLN) }))).slice(0, n);
      ref = cells.map((x) => ({ ...x, kind: KINDS[Math.floor(Math.random() * 3)] }));
      root.dataset.ref = ref.map((t) => `${t.c},${t.r},${t.kind}`).join(';');
      const rw = W * 0.55, rh = H * 0.2, rx = W / 2 - rw / 2, ry = 6;
      const panel = el('abs'); Object.assign(panel.style, { left: rx + 'px', top: ry + 'px', width: rw + 'px', height: rh + 'px', background: '#fff', borderRadius: '22px', boxShadow: 'var(--shadow)', zIndex: '3' }); root.append(panel);
      ref.forEach((t) => { const d = tileDims(t.kind, 36); const e = put(el('abs', P.tile(t.kind, COLS[(t.c + t.r) % 6])), rx + (rw / COLN) * (t.c + 0.5), ry + (rh / ROWN) * (t.r + 0.5), d.w, d.hh); e.style.zIndex = '4'; root.append(e); });
      ctx.say('g.9.copy');
    } else { ctx.say('g.9.how'); }
    const spawn = (k: Kind, x: number, y: number) => {
      const d = tileDims(k, ts); const col = COLS[(count++) % 6];
      const t = put(el('abs', P.tile(k, col)), x, y, d.w, d.hh); t.style.zIndex = '4'; root.append(t); return { t, d };
    };
    const dropTile = (t: HTMLElement, d: { w: number; hh: number }, k: Kind, x: number, y: number) => {
      const rb = root.getBoundingClientRect(); const px = x - rb.left, py = y - rb.top;
      t.style.transition = 'all .2s';
      if (py > H * 0.7 || py < bTop - 20 && copy) { t.remove(); return false; }
      if (copy) {
        const n = nearest({ x: px, y: py }); const key = n.c + ',' + n.r;
        if (placed.has(key)) { t.remove(); return false; }
        t.style.left = n.x - d.w / 2 + 'px'; t.style.top = n.y - d.hh / 2 + 'px'; placed.set(key, { kind: k, e: t });
        t.addEventListener('pointerdown', () => { /* re-pick up: remove from grid */ });
      } else { t.style.left = snapFree(clamp(px - d.w / 2, 4, W - d.w - 4)) + 'px'; t.style.top = snapFree(clamp(py - d.hh / 2, 4, H * 0.66 - d.hh)) + 'px'; }
      sfx.place(); return true;
    };
    KINDS.forEach((k, idx) => {
      const d0 = tileDims(k, ts);
      const proto = put(el('abs', P.tile(k, COLS[idx])), W * (0.22 + idx * 0.28), trayY, d0.w, d0.hh); proto.dataset.t = '1'; root.append(proto);
      let tile: ReturnType<typeof spawn> | null = null;
      drag(proto, {
        start: (x, y) => { const rb = root.getBoundingClientRect(); tile = spawn(k, x - rb.left, y - rb.top); sfx.tap(); },
        move: (x, y) => { if (!tile) return; const rb = root.getBoundingClientRect(); tile.t.style.left = x - rb.left - tile.d.w / 2 + 'px'; tile.t.style.top = y - rb.top - tile.d.hh / 2 + 'px'; },
        end: (x, y) => { if (!tile) return; const tl = tile; tile = null; if (dropTile(tl.t, tl.d, k, x, y)) { ctx.hit(); if (!copy) makeMovable(tl.t, tl.d); } },
      });
    });
    function makeMovable(t: HTMLElement, d: { w: number; hh: number }) {
      t.dataset.t = '1';
      drag(t, {
        start: () => { t.style.zIndex = '5'; t.style.transition = 'none'; sfx.tap(); },
        move: (x, y) => { const rb = root.getBoundingClientRect(); t.style.left = x - rb.left - d.w / 2 + 'px'; t.style.top = y - rb.top - d.hh / 2 + 'px'; },
        end: (x, y) => { const rb = root.getBoundingClientRect(); if (y - rb.top > H * 0.7) { t.classList.add('pop'); setTimeout(() => t.remove(), 300); return; } t.style.transition = 'all .2s'; t.style.left = snapFree(clamp(x - rb.left - d.w / 2, 4, W - d.w - 4)) + 'px'; t.style.top = snapFree(clamp(y - rb.top - d.hh / 2, 4, H * 0.66 - d.hh)) + 'px'; sfx.place(); },
      });
    }
    const okBtn = () => {
      const b = h('button', { class: 'bigbtn', 'data-t': '1', 'data-testid': 'build-finish', style: 'position:absolute;left:50%;bottom:2%;transform:translateX(-50%);animation:fadeIn .6s both;z-index:6;min-width:120px' }, frag(P.check()));
      root.append(b); return b;
    };
    if (!copy) {
      ctx.hand(() => ({ kind: 'drag', from: { x: W * 0.22, y: trayY }, to: { x: W * 0.4, y: H * 0.3 } }));
      ctx.later(() => { const b = okBtn(); b.addEventListener('click', () => { b.remove(); sfx.big(); ctx.praise(); ctx.win(3); }); ctx.say('g.9.finish'); }, 20000);
    } else {
      ctx.hand(() => ({ kind: 'drag', from: { x: W * 0.22, y: trayY }, to: cell(ref[0].c, ref[0].r) }));
      const b = okBtn();
      b.addEventListener('click', () => {
        let ok = 0; const used = new Set<string>();
        ref.forEach((t) => { const k = t.c + ',' + t.r; const p = placed.get(k); if (p && p.kind === t.kind && !used.has(k)) { ok++; used.add(k); } });
        const extra = placed.size - ref.length;
        if (ok === ref.length) { sfx.big(); ctx.praise(); ctx.win(extra <= 0 && ctx.mistakes() === 0 ? 3 : ctx.mistakes() === 0 ? 2 : 1); }
        else { placed.forEach((p, key) => { if (!used.has(key)) { p.e.classList.add('jiggle'); setTimeout(() => p.e.classList.remove('jiggle'), 1500); } }); ctx.mistake(); }
      });
    }
  }
};

/* 10 — Memory. L1: 4 pairs with a preview. L2: 6 pairs. L3: 8 pairs. Limited wrong tries. */
export const memory: Game = (ctx) => {
  const { root, W, H } = ctx;
  const L = ctx.level, pairs = [0, 4, 6, 8][L], cols = [0, 2, 3, 4][L], budget = [0, 6, 8, 10][L];
  ctx.budget(budget);
  const picks = shuffle(STATIONS).slice(0, pairs);
  const deck = shuffle([...picks, ...picks].map((s, i) => ({ s, i })));
  const rows = Math.ceil(deck.length / cols), gap = 10;
  const cw = Math.min((W - 24 - gap * (cols - 1)) / cols, 200), ch = Math.min((H - 80 - gap * (rows - 1)) / rows, cw * 1.05);
  const grid = el('abs'); Object.assign(grid.style, { left: '50%', top: '50%', transform: 'translate(-50%,-46%)', display: 'grid', gridTemplateColumns: `repeat(${cols}, ${cw}px)`, gap: gap + 'px' });
  const cards = deck.map((d) => {
    const c = h('button', { class: 'mcard', 'data-t': '1', 'data-id': String(d.s.id) });
    Object.assign(c.style, { width: cw + 'px', height: ch + 'px', perspective: '700px', position: 'relative' });
    const inner = h('div', { class: 'mi' }); Object.assign(inner.style, { position: 'absolute', inset: '0', transition: 'transform .5s', transformStyle: 'preserve-3d' });
    const front = h('div', {}, h('img', { src: imgOf(d.s), draggable: 'false', style: 'width:100%;height:100%;object-fit:cover;border-radius:20px' }));
    Object.assign(front.style, { position: 'absolute', inset: '0', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: '20px', background: '#fff', padding: '4px', boxShadow: 'var(--shadow)' });
    const back = h('div', {}); back.innerHTML = P.paw(); Object.assign(back.style, { position: 'absolute', inset: '0', backfaceVisibility: 'hidden', borderRadius: '20px', background: 'linear-gradient(135deg,#8fd0f0,#bfe3f7)', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow)', padding: '26%' });
    inner.append(front, back); c.append(inner); grid.append(c);
    return { c, inner, id: d.s.id, matched: false };
  });
  root.append(grid);
  const left = triesBar(ctx, budget + 1, 'bottom'); left(budget + 1);
  const show = (k: typeof cards[0], on: boolean) => { k.inner.style.transform = on ? 'rotateY(180deg)' : 'none'; };
  let busy = L === 1, open: typeof cards = [], matched = 0;
  if (L === 1) { cards.forEach((k) => show(k, true)); ctx.say('g.10.peek'); ctx.later(() => { cards.forEach((k) => show(k, false)); busy = false; ctx.say('g.10.how'); }, 3000); }
  else ctx.say('g.10.how');
  ctx.hand(() => (busy ? null : { kind: 'tap', at: rel(ctx, cards[0].c) }));
  cards.forEach((k) => k.c.addEventListener('click', () => {
    if (busy || k.matched || open.includes(k)) return;
    sfx.flip(); show(k, true); open.push(k);
    if (open.length < 2) return;
    busy = true; const [a, b] = open;
    if (a.id === b.id) {
      a.matched = b.matched = true; matched++; open = [];
      ctx.later(() => { sfx.chime(matched); ctx.hit(); const c = centerOf(a.c); ctx.sparkle(c.x, c.y); const d = centerOf(b.c); ctx.sparkle(d.x, d.y); busy = false; if (matched === pairs) ctx.later(() => { ctx.praise(); ctx.win(); }, 600); }, 500);
    } else {
      ctx.later(() => { sfx.soft(); const lost = ctx.mistake(false); left(Math.max(0, budget + 1 - ctx.mistakes())); if (lost) return;
        ctx.later(() => { show(a, false); show(b, false); open = []; busy = false; }, 900); }, 700);
    }
  }));
};

/* 11 — Healthy plate: vegetable / protein / carb sections. L3 adds sweets that must not go on the plate. */
export const dinner: Game = (ctx) => {
  const { root, W, H } = ctx;
  const L = ctx.level;
  ctx.budget(L === 1 ? 4 : L === 2 ? 3 : 2);
  const pw = Math.min(W * 0.84, 330), cx = W / 2, cy = H * 0.28;
  const plate = put(el('abs', P.plate()), cx, cy, pw, pw * 0.72); root.append(plate);
  const zs: Record<string, Pt> = { veg: { x: cx - pw * 0.2, y: cy - pw * 0.06 }, prot: { x: cx + pw * 0.2, y: cy - pw * 0.06 }, carb: { x: cx, y: cy + pw * 0.15 } };
  const zEl: Record<string, HTMLElement> = {};
  (['veg', 'prot', 'carb'] as const).forEach((k) => {
    const z = put(el('abs zone'), zs[k].x, zs[k].y, pw * 0.38, pw * 0.3); z.style.borderRadius = '50%'; zEl[k] = z;
    const ghost = el('abs', k === 'veg' ? P.broccoli() : k === 'prot' ? P.chicken() : P.sweet()); put(ghost, zs[k].x, zs[k].y, pw * 0.26); ghost.style.opacity = '.22'; ghost.style.filter = 'grayscale(1)';
    root.append(z, ghost);
  });
  const food: { id: string; kind: string; html: string }[] = L === 1
    ? [{ id: 'broccoli', kind: 'veg', html: P.broccoli() }, { id: 'chicken', kind: 'prot', html: P.chicken() }, { id: 'sweet', kind: 'carb', html: P.sweet() }]
    : [{ id: 'broccoli', kind: 'veg', html: P.broccoli() }, { id: 'carrot', kind: 'veg', html: P.carrot() }, { id: 'chicken', kind: 'prot', html: P.chicken() }, { id: 'egg', kind: 'prot', html: P.egg() }, { id: 'sweet', kind: 'carb', html: P.sweet() }, { id: 'rice', kind: 'carb', html: P.rice() }];
  const sweets = L === 3 ? [{ id: 'lolly', kind: 'candy', html: P.lollipop() }, { id: 'cake', kind: 'candy', html: P.cake() }] : [];
  const all = shuffle([...food, ...sweets]);
  const counts: Record<string, number> = { veg: 0, prot: 0, carb: 0 };
  let toPlace = food.length, said = false;
  const per = Math.ceil(all.length / 2);
  const items: DragItem[] = all.map((f, i) => {
    const row = i < per ? 0 : 1, idx = row ? i - per : i, cnt = row ? all.length - per : per;
    return {
      id: f.id, html: f.html, size: 76, home: { x: (W / (cnt + 1)) * (idx + 1), y: H * (0.62 + row * 0.13) },
      onDrop: (c) => {
        const onPlate = inside(c, plate, ctx, 0);
        if (!onPlate) return null;
        if (f.kind === 'candy') { ctx.mistake(false); sfx.soft(); if (!said) { said = true; ctx.say('g.11.candy'); } return null; }
        if (!inside(c, zEl[f.kind], ctx, 10)) { ctx.mistake(); return null; }
        const z = zs[f.kind]; const n = counts[f.kind]++; toPlace--;
        if (toPlace === 0) ctx.later(water, 700); else ctx.hand(hintFn);
        return { x: z.x + (n % 2 ? 22 : -14), y: z.y + (n % 2 ? 10 : -6) };
      },
    };
  });
  dragItems(ctx, items);
  const hintFn = () => { const it = items.find((x) => !x.placed && !sweets.some((s) => s.id === x.id)); return it ? { kind: 'drag' as const, from: it.home, to: zs[all.find((a) => a.id === it.id)!.kind] } : null; };
  ctx.say('g.11.how'); ctx.hand(hintFn);
  function water() {
    items.forEach((i) => { if (!i.placed && i.el) { i.el.style.transition = 'opacity .5s'; i.el.style.opacity = '0'; i.el.style.pointerEvents = 'none'; } });
    ctx.say('g.11.water');
    const mat = put(el('abs zone glow'), W * 0.82, H * 0.5, 100, 130); root.append(mat);
    dragItems(ctx, [{ id: 'water', html: P.glass(1), size: 100, home: { x: W / 2, y: H * 0.7 }, onDrop: (c) => { if (!inside(c, mat, ctx, 30)) return null; ctx.later(() => { sfx.sparkle(); ctx.praise(); ctx.win(); }, 600); return rel(ctx, mat); } }]);
    ctx.hand(() => ({ kind: 'drag', from: { x: W / 2, y: H * 0.7 }, to: rel(ctx, mat) }));
  }
};

/* 12 — Bath: scrub the body part the narrator names. L3 adds a generous per-part timer. */
export const bath: Game = (ctx) => {
  const { root, W, H } = ctx;
  const L = ctx.level;
  ctx.budget(L === 1 ? 4 : L === 2 ? 3 : 2);
  const hA = Math.min(H * 0.5, 330), wA = hA * (562 / 747), ax = W / 2, ay = H * 0.34;
  const tub = put(el('abs'), W / 2, H * 0.62, Math.min(W * 0.94, 420), H * 0.3);
  Object.assign(tub.style, { background: 'linear-gradient(#bfe6fb,#8fd0f0)', borderRadius: '30px 30px 90px 90px', boxShadow: 'var(--shadow)' });
  const av = el('abs'); av.append(avatar(hA)); put(av, ax, ay, wA, hA); av.style.left = ax - wA / 2 + 'px';
  root.append(av, tub);
  const duck = put(el('abs', P.duck()), W * 0.8, H * 0.58, 76); duck.style.animation = 'bob 2.4s ease-in-out infinite'; duck.style.zIndex = '2'; root.append(duck);
  const at = (fx: number, fy: number): Pt => ({ x: ax - wA / 2 + fx * wA, y: ay - hA / 2 + fy * hA });
  const parts: Record<string, { pts: Pt[]; id: string }> = {
    head: { pts: [at(0.5, 0.1)], id: 'g.12.head' }, hands: { pts: [at(0.08, 0.5), at(0.93, 0.56)], id: 'g.12.hands' },
    tummy: { pts: [at(0.5, 0.42)], id: 'g.12.tummy' }, feet: { pts: [at(0.12, 0.78), at(0.5, 0.92)], id: 'g.12.feet' },
  };
  const plan = L === 1 ? ['hands', 'head', 'tummy'] : L === 2 ? shuffle(['hands', 'feet', 'head', 'tummy']) : (() => { const o: string[] = []; const ks = Object.keys(parts); while (o.length < 6) { const k = ks[Math.floor(Math.random() * 4)]; if (k !== o[o.length - 1]) o.push(k); } return o; })();
  const R = 56;
  const rings = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.pts.map((p) => { const r = put(el('abs'), p.x, p.y, R * 2); Object.assign(r.style, { borderRadius: '50%', border: '5px dashed #fff', background: 'rgba(255,255,255,.18)', opacity: '0', zIndex: '3', pointerEvents: 'none' }); r.dataset.part = k; root.append(r); return r; })]));
  const sponge = el('abs', `<svg viewBox="0 0 100 100" class="prop"><rect x="10" y="22" width="80" height="56" rx="18" fill="#ffe066"/><g fill="#f0c940"><circle cx="30" cy="40" r="5"/><circle cx="56" cy="56" r="5"/><circle cx="70" cy="36" r="4"/></g></svg>`);
  put(sponge, 0, 0, 90); Object.assign(sponge.style, { opacity: '0', pointerEvents: 'none', zIndex: '6' }); root.append(sponge);
  const stepDots = triesBar(ctx, plan.length, 'bottom'); stepDots(plan.length);
  let i = 0, scrub = 0, wrongDist = 0, lastWrong = 0, tLeft = 9, lx = 0, ly = 0, down = false, gap = true; // gap: between parts nothing counts
  const cur = () => parts[plan[i]];
  const show = () => {
    Object.values(rings).flat().forEach((r) => (r.style.opacity = '0'));
    if (i >= plan.length) return;
    root.dataset.part = plan[i];
    rings[plan[i]].forEach((r) => (r.style.opacity = '1'));
    ctx.say(cur().id); tLeft = 9; scrub = 0; wrongDist = 0; gap = false;
    ctx.hand(() => { const p = cur().pts[0]; return { kind: 'drag', from: { x: p.x - 36, y: p.y }, to: { x: p.x + 36, y: p.y } }; });
  };
  const bubbles = (p: Pt) => { for (let k = 0; k < 7; k++) { const b = put(el('abs', P.bubble()), p.x + (Math.random() - 0.5) * 70, p.y + (Math.random() - 0.5) * 40, 28 + Math.random() * 22); b.style.zIndex = '4'; b.style.transition = 'transform 2s ease-out, opacity 2s'; root.append(b); requestAnimationFrame(() => { b.style.transform = `translate(${(Math.random() - 0.5) * 80}px, ${-90 - Math.random() * 60}px)`; b.style.opacity = '0'; }); setTimeout(() => b.remove(), 2100); } };
  ctx.say('g.12.how'); ctx.later(show, 2200);
  const area = el('abs'); Object.assign(area.style, { inset: '0', zIndex: '5' }); area.dataset.t = '1'; root.append(area);
  drag(area, {
    start: (x, y) => { lx = x; ly = y; down = true; },
    move: (x, y) => {
      const rb = root.getBoundingClientRect(); sponge.style.opacity = '1'; sponge.style.left = x - rb.left - 45 + 'px'; sponge.style.top = y - rb.top - 45 + 'px';
      if (!down || i >= plan.length || gap) return;
      const d = Math.hypot(x - lx, y - ly); lx = x; ly = y;
      const px = x - rb.left, py = y - rb.top;
      const onTarget = cur().pts.some((p) => Math.hypot(p.x - px, p.y - py) < R + 14);
      if (onTarget) {
        scrub += d; wrongDist = 0;
        if (scrub > 260) { const p = cur().pts[0]; bubbles(p); sfx.pop(); sfx.sparkle(); ctx.hit(); i++; gap = true; stepDots(plan.length - i); ctx.hand(null); ctx.later(show, 1400); }
      } else if (Object.entries(parts).some(([k, v]) => k !== plan[i] && v.pts.some((p) => Math.hypot(p.x - px, p.y - py) < R - 10))) {
        wrongDist += d; if (wrongDist > 160 && performance.now() - lastWrong > 1800) { wrongDist = 0; lastWrong = performance.now(); ctx.mistake(); }
      }
    },
    end: () => { down = false; },
  });
  ctx.loop((dt) => {
    if (L !== 3 || i >= plan.length) { if (i >= plan.length && !(ctx as unknown as { _w?: number })._w) { (ctx as unknown as { _w?: number })._w = 1; sfx.sparkle(); ctx.later(() => { ctx.praise(); ctx.win(); }, 1000); } return; }
    if (gap) return;
    tLeft -= dt;
    rings[plan[i]].forEach((r) => (r.style.borderColor = tLeft < 3 ? '#ffb870' : '#fff'));
    if (tLeft <= 0) { tLeft = 9; ctx.mistake(); }
  });
};

/* 13 — Sleep: calm, never fails and never has a timer. Lamps in order, find the teddy, tuck it in, Moka lies down. */
export const sleep: Game = (ctx) => {
  const { root, W, H } = ctx;
  const L = ctx.level;
  const dark = el('abs'); Object.assign(dark.style, { inset: '0', background: '#101a40', opacity: '0', transition: 'opacity 1.6s', pointerEvents: 'none', zIndex: '6' });
  const bw = Math.min(W * 0.8, 330);
  const bed = put(el('abs', P.bed()), W / 2, H * 0.52, bw, 220);
  const blanket = put(el('abs'), W / 2 + 28, H * 0.52 + 24, bw * 0.62, 62);
  Object.assign(blanket.style, { background: '#7fa6e6', borderRadius: '24px', opacity: '0', transition: 'opacity .8s' });
  root.append(bed, blanket);
  const nLamps = L === 3 ? 4 : 3, ordered = L >= 2;
  const lamps = Array.from({ length: nLamps }, (_, i) => { const l = put(el('abs', P.lamp(true)), (W / (nLamps + 1)) * (i + 1), H * 0.14, ctx.size(90)); l.dataset.t = '1'; root.append(l); return l; });
  root.append(dark);
  let off = 0;
  const nextLamp = () => lamps[off];
  const hl = () => { lamps.forEach((l, i) => { l.style.animation = ordered && i === off ? 'pulse2 1.6s ease-in-out infinite' : ''; }); ctx.hand(() => (off < nLamps ? { kind: 'tap', at: rel(ctx, ordered ? nextLamp() : lamps.find((l) => !l.dataset.off)!) } : null)); };
  ctx.say('g.13.how'); hl();
  lamps.forEach((l, i) => l.addEventListener('pointerdown', () => {
    if (l.dataset.off) return;
    if (ordered && i !== off) { l.animate([{ transform: 'rotate(-8deg)' }, { transform: 'rotate(8deg)' }, { transform: 'none' }], 350); return; }
    l.dataset.off = '1'; l.innerHTML = P.lamp(false); l.style.animation = ''; delete l.dataset.t; sfx.soft(); ctx.hit();
    off = ordered ? off + 1 : lamps.filter((x) => x.dataset.off).length;
    dark.style.opacity = String((lamps.filter((x) => x.dataset.off).length / nLamps) * 0.7);
    if (lamps.every((x) => x.dataset.off)) ctx.later(findTeddy, 1300); else hl();
  }));
  function findTeddy() {
    const nSpots = L === 1 ? 0 : L === 2 ? 3 : 5;
    const homeTeddy: Pt = { x: W / 2, y: H * 0.86 };
    if (nSpots === 0) return tuck(homeTeddy);
    ctx.say('g.13.find');
    const hideIdx = Math.floor(Math.random() * nSpots); root.dataset.hide = String(hideIdx);
    const spots = Array.from({ length: nSpots }, (_, i) => { const s = put(el('abs', i % 2 ? P.cushion() : P.box()), (W / (nSpots + 1)) * (i + 1), H * 0.8, ctx.size(84)); s.dataset.t = '1'; s.dataset.testid = 'spot-' + i; s.style.zIndex = '7'; root.append(s); return s; });
    ctx.hand(() => ({ kind: 'tap', at: rel(ctx, spots[hideIdx]) }));
    spots.forEach((s, i) => s.addEventListener('pointerdown', () => {
      if (s.dataset.done) return; s.dataset.done = '1';
      s.style.transition = 'transform .5s, opacity .5s'; s.style.transform = 'translateY(-26px) rotate(-6deg)'; s.style.opacity = '.55'; sfx.flip();
      if (i === hideIdx) { spots.forEach((x) => { delete x.dataset.t; x.style.pointerEvents = 'none'; x.style.zIndex = '3'; }); sfx.chime(2); tuck(rel(ctx, s)); }
    }));
  }
  function tuck(from: Pt) {
    const tgt = put(el('abs zone glow'), W / 2 - bw * 0.2, H * 0.52 - 6, 130, 90); root.append(tgt); root.append(dark);
    ctx.say('g.13.teddy');
    dragItems(ctx, [{ id: 'teddy', html: P.teddy(), size: 100, home: from, onDrop: (c) => (inside(c, tgt, ctx, 50) ? { x: W / 2 - bw * 0.2, y: H * 0.52 - 14 } : null) }], () => {
      blanket.style.opacity = '1'; sfx.soft(); tgt.remove();
      const mk = mokaSvg('walking'); const mw = el('abs'); mw.append(mk); put(mw, W * 0.12, H * 0.74, 120, 120); mw.style.transition = 'left 2.2s ease-in-out'; mw.style.zIndex = '7'; root.append(mw);
      ctx.later(() => { mw.style.left = W / 2 + bw * 0.25 + 'px'; }, 200);
      ctx.later(() => { setMoka(mk, 'sleepy'); ctx.say('g.13.moka'); }, 2600);
      ctx.later(() => { dark.style.opacity = '0.8'; ctx.win(3); }, 4800);
    });
    ctx.hand(() => ({ kind: 'drag', from, to: { x: W / 2 - bw * 0.2, y: H * 0.52 - 14 } }));
  }
  void haptic; void (null as unknown as GameCtx); void swipePop;
};
