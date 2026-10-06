import { Game, el, put, centerOf, rel, triesBar, Pt } from './engine';
import { P } from '../art/props';
import { asset } from '../content/stations';
import { sfx, haptic } from '../core/audio';
import { mokaSvg, setMoka } from '../art/moka';
import { h, drag, clamp } from '../core/dom';

const avatar = (hgt: number) => h('img', { src: asset('avatar/rafael-football.png'), style: `height:${hgt}px;display:block`, draggable: 'false' });

/* 5 — Walk to kindergarten: tap to jump over puddles. Falling = back to a checkpoint (counts as a mistake). */
export const walk: Game = (ctx) => {
  const { root, W, H } = ctx;
  const L = ctx.level;
  ctx.budget(L === 1 ? 4 : L === 2 ? 3 : 2);
  const speed = [0, 120, 160, 200][L], gap = [0, 420, 360, 300][L], n = [0, 4, 6, 8][L];
  const groundY = H * 0.62, ax = W * 0.3;
  const obst = Array.from({ length: n }, (_, i) => 520 + i * gap);
  const endX = obst[n - 1] + 460;
  const world = el('abs'); Object.assign(world.style, { left: '0', top: '0', width: '100%', height: '100%', overflow: 'hidden' });
  const road = el('abs'); Object.assign(road.style, { left: '0', right: '0', top: groundY + 'px', bottom: '0', background: 'linear-gradient(#e9dfc9,#d8c9a8)' });
  const grass = el('abs'); Object.assign(grass.style, { left: '0', right: '0', top: groundY - 8 + 'px', height: '14px', background: '#9fdc9a', borderRadius: '7px' });
  root.append(road, grass, world);
  const puddles = obst.map((x) => { const e = put(el('abs', P.puddle()), 0, groundY + 8, 110, 70); world.append(e); return e; });
  const stars = obst.map((x, i) => { const e = put(el('abs jiggle', P.star()), 0, groundY - 130, 56); e.dataset.i = String(i); world.append(e); return e; });
  const home = put(el('abs', P.cloud()), 0, groundY - 50, 130, 100); world.append(home);
  const av = el('abs'); av.append(avatar(120)); av.style.left = ax - 40 + 'px'; av.style.zIndex = '3'; root.append(av);
  const moka = mokaSvg('walking'); const mw = el('abs'); mw.append(moka); put(mw, ax - 90, groundY - 36, 84, 84); mw.style.zIndex = '2'; root.append(mw);
  const left = triesBar(ctx, (L === 1 ? 4 : L === 2 ? 3 : 2) + 1); left((L === 1 ? 4 : L === 2 ? 3 : 2) + 1);
  const total = (L === 1 ? 4 : L === 2 ? 3 : 2) + 1;
  let dist = 0, jt = -1, state: 'run' | 'splash' | 'done' = 'run', hold = 0;
  const JUMP = 0.8, HEIGHT = 120;
  const jump = () => { if (state !== 'run' || jt >= 0) return; jt = 0; sfx.boing(); haptic(8); };
  const tap = el('abs'); Object.assign(tap.style, { inset: '0', zIndex: '4' }); tap.dataset.t = '1'; root.append(tap);
  tap.addEventListener('pointerdown', jump);
  ctx.say('g.5.how');
  ctx.hand(() => ({ kind: 'tap', at: { x: ax, y: groundY - 40 } }));
  const place = () => {
    const sx = (wx: number) => ax + (wx - dist);
    obst.forEach((x, i) => { puddles[i].style.left = sx(x) - 55 + 'px'; stars[i].style.left = sx(x + gap / 2) - 28 + 'px'; });
    home.style.left = sx(endX) - 65 + 'px';
    const jy = jt >= 0 ? 4 * HEIGHT * jt * (1 - jt) : 0;
    av.style.top = groundY - 124 - jy + 'px';
    av.style.transform = state === 'splash' ? 'rotate(-18deg)' : `rotate(${jt >= 0 ? -6 : 0}deg)`;
  };
  place();
  ctx.loop((dt) => {
    if (state === 'done') return;
    if (state === 'splash') { hold -= dt; if (hold <= 0) state = 'run'; place(); return; }
    dist += speed * dt;
    root.dataset.gap = String(Math.round((obst.find((x) => x > dist - 40) ?? 1e9) - dist)); root.dataset.speed = String(speed);
    if (jt >= 0) { jt += dt / JUMP; if (jt >= 1) jt = -1; }
    const jy = jt >= 0 ? 4 * HEIGHT * jt * (1 - jt) : 0;
    obst.forEach((x, i) => {
      if (Math.abs(x - dist) < 38 && jy < 32 && !puddles[i].dataset.fell) {
        puddles[i].dataset.fell = '1'; setTimeout(() => delete puddles[i].dataset.fell, 1500);
        state = 'splash'; hold = 0.9; dist = Math.max(0, x - 280); jt = -1; sfx.soft(); setMoka(moka, 'concerned');
        setTimeout(() => setMoka(moka, 'walking'), 900);
        const lost = ctx.mistake(false);
        left(Math.max(0, total - ctx.mistakes()));
        if (!lost) ctx.say('retry.1');
      }
    });
    stars.forEach((s, i) => { if (!s.dataset.got && Math.abs(obst[i] + gap / 2 - dist) < 36) { s.dataset.got = '1'; s.classList.add('pop'); sfx.chime(i); const c = centerOf(s); ctx.sparkle(c.x, c.y); } });
    if (dist >= endX - 30) { state = 'done'; setMoka(moka, 'happy'); sfx.big(); ctx.praise(); ctx.win(); }
    place();
  });
  void clamp; void drag;
};

/* 6 — Tower: a block swings; tap to drop it. Off-balance towers topple (the top part falls). */
export const tower: Game = (ctx) => {
  const { root, W, H } = ctx;
  const L = ctx.level;
  ctx.budget(L === 1 ? 3 : L === 2 ? 2 : 2);
  const goal = [0, 4, 6, 8][L];
  const bw = W * [0, 0.36, 0.3, 0.24][L], bh = 40, omega = [0, 1.5, 2.1, 2.8][L], amp = W * 0.3;
  const baseY = H * 0.88, cx = W / 2, top0 = H * 0.06;
  const ground = el('abs'); Object.assign(ground.style, { left: '0', right: '0', top: baseY + 'px', height: '14px', background: '#d8c9a8', borderRadius: '7px' }); root.append(ground);
  const colors = ['#ff9bb3', '#8fd0f0', '#ffe28a', '#a8e6cf', '#c8b6f2', '#ffb870', '#9fdc9a', '#f6a6e0'];
  const stack: { x: number; e: HTMLElement }[] = [];
  let t = 0, falling: { e: HTMLElement; x: number; y: number; vy: number; ci: number } | null = null, ended = false, idx = 0;
  const left = triesBar(ctx, (L === 1 ? 3 : 2) + 1, 'bottom'); left((L === 1 ? 3 : 2) + 1);
  const mkBlock = (x: number, y: number, ci: number) => { const e = put(el('abs', P.block(colors[ci % colors.length])), x, y, bw, bh); e.style.transformOrigin = '50% 100%'; e.style.zIndex = '3'; return e; };
  const sw = mkBlock(cx, top0 + 30, 0); root.append(sw);
  const rope = el('abs'); Object.assign(rope.style, { width: '4px', height: top0 + 30 - bh / 2 + 'px', background: '#b9c7d3', top: '0', left: cx + 'px', zIndex: '2' }); root.append(rope);
  const nextCol = () => idx++;
  let col = nextCol();
  sw.firstChild && ((sw.firstChild as SVGElement).outerHTML, 0);
  const recolor = () => { sw.innerHTML = P.block(colors[col % colors.length]); };
  recolor();
  ctx.say('g.6.how');
  ctx.hand(() => ({ kind: 'tap', at: { x: W / 2, y: H * 0.5 } }));
  const tap = el('abs'); Object.assign(tap.style, { inset: '0', zIndex: '5' }); tap.dataset.t = '1'; root.append(tap);
  tap.addEventListener('pointerdown', () => {
    if (ended || falling || stack.length >= goal + 1) return;
    const x = cx + Math.sin(t * omega) * amp;
    const e = mkBlock(x, top0 + 30, col); sw.style.opacity = '0'; root.append(e); sfx.whoosh();
    falling = { e, x, y: top0 + 30, vy: 0, ci: col };
  });
  const topple = (k: number) => {
    // everything above level k falls off
    const gone = stack.splice(k + 1);
    gone.forEach((b, i) => { const dir = (b.x - stack[k].x >= 0 ? 1 : -1); b.e.style.transition = 'transform 1s ease-in, opacity 1s'; b.e.style.transform = `translate(${dir * (80 + i * 30)}px, ${160}px) rotate(${dir * (40 + i * 20)}deg)`; b.e.style.opacity = '0'; setTimeout(() => b.e.remove(), 1000); });
    sfx.soft(); ctx.say('g.6.fell');
  };
  const checkStability = () => {
    for (let k = 0; k < stack.length - 1; k++) {
      const above = stack.slice(k + 1); const com = above.reduce((s, b) => s + b.x, 0) / above.length;
      if (Math.abs(com - stack[k].x) > bw / 2) { topple(k); return true; }
    }
    return false;
  };
  const star = () => { const e = put(el('abs', P.star()), stack[stack.length - 1].x, baseY - stack.length * bh - 30, 66); e.style.animation = 'starin 1s both'; root.append(e); sfx.sparkle(); ctx.say('g.6.top'); };
  ctx.loop((dt) => {
    if (ended) return;
    t += dt; root.dataset.swing = ((Math.sin(t * omega) * amp) / W).toFixed(3); root.dataset.bw = String(bw / W);
    if (!falling) { const x = cx + Math.sin(t * omega) * amp; sw.style.left = x - bw / 2 + 'px'; rope.style.left = x - 2 + 'px'; rope.style.height = top0 + 30 - bh / 2 + 'px'; return; }
    const f = falling; f.vy += 1500 * dt; f.y += f.vy * dt;
    const landY = baseY - stack.length * bh - bh / 2;
    f.e.style.top = f.y - bh / 2 + 'px';
    if (f.y >= landY) {
      falling = null; const prevX = stack.length ? stack[stack.length - 1].x : cx;
      if (Math.abs(f.x - prevX) > bw * 0.95) { // missed the tower altogether
        f.e.style.transition = 'transform .8s ease-in, opacity .8s'; f.e.style.transform = `translate(${(f.x > prevX ? 1 : -1) * 60}px, ${H}px) rotate(40deg)`; f.e.style.opacity = '0'; setTimeout(() => f.e.remove(), 800);
        sw.style.opacity = '1'; const lost = ctx.mistake(false); left(Math.max(0, (L === 1 ? 4 : 3) - ctx.mistakes())); if (!lost) ctx.say('retry.2'); return;
      }
      f.e.style.top = landY - bh / 2 + 'px'; stack.push({ x: f.x, e: f.e }); sfx.place(); ctx.hit(); ctx.sparkle(centerOf(f.e).x, centerOf(f.e).y);
      col = nextCol(); recolor(); sw.style.opacity = '1';
      if (checkStability()) { const lost = ctx.mistake(false); left(Math.max(0, (L === 1 ? 4 : 3) - ctx.mistakes())); if (lost) ended = true; }
      else if (stack.length >= goal) { ended = true; star(); ctx.later(() => { ctx.praise(); ctx.win(); }, 1200); }
    }
  });
  void rel;
};

/* 7 — Football: 5 shots, 3 goals to win. The goalie blocks (L3: plus a moving defender). */
export const football: Game = (ctx) => {
  const { root, W, H } = ctx;
  const L = ctx.level;
  ctx.budget(2);
  const gw = Math.min(W * 0.86, 360), gh = gw * 0.55; const gy = H * 0.2;
  const pitch = el('abs'); Object.assign(pitch.style, { left: '-2%', right: '-2%', top: gy - gh * 0.55 + 'px', bottom: '0', background: 'linear-gradient(#9fdc9a,#7fcf86)', borderRadius: '40px 40px 0 0' });
  const goal = put(el('abs', P.goal()), W / 2, gy, gw, gh); root.append(pitch, goal);
  const gsz = [0, 78, 90, 100][L];
  const goalie = put(el('abs', P.goalie()), W / 2, gy + gh * 0.12, gsz); root.append(goalie);
  const defender = put(el('abs', P.goalie()), W / 2, H * 0.5, 80); defender.style.filter = 'hue-rotate(160deg)'; defender.style.display = L === 3 ? 'block' : 'none'; root.append(defender);
  const bsz = 88, home = { x: W / 2, y: H * 0.8 };
  const ball = put(el('abs', P.football()), home.x, home.y, bsz); ball.dataset.t = '1'; ball.style.zIndex = '5'; root.append(ball);
  const av = el('abs'); av.append(avatar(Math.min(H * 0.24, 190))); Object.assign(av.style, { left: W * 0.06 + 'px', bottom: '2%' }); root.append(av);
  const shotsLeft = triesBar(ctx, 5, 'bottom'); shotsLeft(5);
  const gX = W / 2, omega = [0, 0.9, 1.5, 2.1][L], track = [0, 0, 0.5, 0.75][L], reach = gsz * 0.55;
  let t = 0, shooting = false, shots = 0, goals = 0, ended = false;
  const gAt = (tt: number) => gX + Math.sin(tt * omega) * gw * 0.3;
  ctx.loop((dt) => { t += dt; root.dataset.gk = ((gAt(t) - gX) / gw).toFixed(3); root.dataset.gw = String(gw); root.dataset.def = L === 3 ? String(Math.sin(t * 1.3 + 1) * 0.32) : ''; if (!shooting) goalie.style.left = gAt(t) - gsz / 2 + 'px'; if (L === 3 && !shooting) defender.style.left = W / 2 + Math.sin(t * 1.3 + 1) * W * 0.32 - 40 + 'px'; });
  ctx.say('g.7.how');
  ctx.hand(() => ({ kind: 'drag', from: home, to: { x: W / 2, y: gy + gh * 0.4 } }));
  let sx = 0, sy = 0;
  drag(ball, {
    start: (x, y) => { sx = x; sy = y; ball.style.transition = 'none'; },
    move: (x, y) => { const rb = root.getBoundingClientRect(); ball.style.left = clamp(x - rb.left - bsz / 2, 0, W - bsz) + 'px'; ball.style.top = clamp(y - rb.top - bsz / 2, H * 0.3, H - bsz) + 'px'; },
    end: (x, y) => {
      const dx = x - sx, dy = y - sy;
      if (shooting) return;
      if (dy > -70) { ball.style.transition = 'all .4s'; ball.style.left = home.x - bsz / 2 + 'px'; ball.style.top = home.y - bsz / 2 + 'px'; return; }
      shoot(dx, dy);
    },
  });
  function shoot(dx: number, dy: number) {
    shooting = true; shots++; sfx.kick(); haptic(15); delete ball.dataset.t;
    const aim = clamp(gX + (dx / Math.max(60, Math.abs(dy))) * gw * 0.6, gX - gw * 0.52, gX + gw * 0.52);
    const ty = gy + gh * 0.25, FL = 0.9;
    const out = Math.abs(aim - gX) > gw * 0.46; // wide of the post
    ball.style.transition = `all ${FL}s cubic-bezier(.2,.6,.3,1)`;
    ball.style.left = aim - bsz * 0.31 + 'px'; ball.style.top = ty + 'px'; ball.style.transform = 'scale(.62)';
    const g0 = gAt(t), gEnd = g0 + (aim - g0) * track;
    goalie.style.transition = `left ${FL}s ease-out`; goalie.style.left = gEnd - gsz / 2 + 'px';
    let blockedBy = '';
    if (L === 3) { const f = 0.55; const bx = home.x + (aim - home.x) * f; const dxp = W / 2 + Math.sin(t * 1.3 + 1) * W * 0.32; if (Math.abs(dxp - bx) < 46) blockedBy = 'def'; }
    if (!blockedBy && !out && Math.abs(gEnd - aim) < reach) blockedBy = 'keeper';
    ctx.later(() => {
      const goalNow = !blockedBy && !out;
      if (goalNow) { goals++; ctx.hit(); sfx.big(); ctx.say('g.7.goal'); for (let i = 0; i < 4; i++) ctx.later(() => ctx.sparkle(root.getBoundingClientRect().left + aim + (i - 1.5) * 40, root.getBoundingClientRect().top + ty - 20), i * 150); }
      else { sfx.soft(); if (blockedBy === 'def') { ball.style.transition = 'all .3s'; ball.style.left = aim - 150 + 'px'; } ctx.say('g.7.saved'); }
      shotsLeft(5 - shots);
      if (!goalNow && ctx.mistake(false)) return;
      if (goals >= 3) { ended = true; ctx.later(() => { ctx.praise(); ctx.win(ctx.mistakes() === 0 ? 3 : ctx.mistakes() === 1 ? 2 : 1); }, 1400); return; }
      if (shots >= 5) { ended = true; ctx.lose(); return; }
      ctx.later(() => { if (ended) return; ball.style.transition = 'none'; ball.style.transform = 'none'; ball.style.left = home.x - bsz / 2 + 'px'; ball.style.top = home.y - bsz / 2 + 'px'; ball.dataset.t = '1'; shooting = false; goalie.style.transition = 'none'; }, 1500);
    }, FL * 1000 + 100);
  }
};

/* 8 — Ninja: tap when the marker is in the green zone to swing / hop. Missing = a soft fall onto the mat, then try the segment again. */
export const ninja: Game = (ctx) => {
  const { root, W, H } = ctx;
  const L = ctx.level;
  ctx.budget(L === 1 ? 4 : L === 2 ? 3 : 2);
  const segs: ('swing' | 'hop')[] = L === 1 ? ['swing', 'swing', 'hop', 'swing', 'hop'] : L === 2 ? ['swing', 'swing', 'hop', 'swing', 'hop', 'swing', 'hop'] : ['swing', 'swing', 'hop', 'swing', 'hop', 'swing', 'hop', 'swing', 'hop'];
  const gap = Math.max(140, W * 0.36);
  const zoneW = [0, 0.4, 0.28, 0.18][L], period = [0, 2.2, 1.7, 1.3][L];
  const world = el('abs'); Object.assign(world.style, { left: '0', top: '0', width: gap * (segs.length + 3) + 'px', height: H + 'px', transition: 'transform 1s cubic-bezier(.45,.05,.3,1)' });
  const barY = H * 0.24;
  world.innerHTML = `<div class="abs" style="left:0;right:0;top:${barY}px;height:14px;background:#ef6b6b;border-radius:7px"></div>` +
    Array.from({ length: segs.length }, (_, i) => `<div class="abs" style="left:${W * 0.5 + i * gap * 1.2}px;top:${barY}px;width:12px;height:${H * 0.08}px;background:#f59a9a;border-radius:6px"></div>`).join('') +
    `<div class="abs" style="left:0;right:0;top:${H * 0.62}px;height:${H * 0.38}px;background:#cdeccf"></div>`;
  segs.forEach((s, i) => { if (s === 'hop') world.append(put(el('abs', P.cushion()), W * 0.5 + gap * (i + 0.5), H * 0.62 - 16, 110, 80)); });
  root.append(world);
  const mat = put(el('abs', P.cushion()), W / 2, H * 0.62 - 4, 190, 90); mat.style.opacity = '0'; mat.style.zIndex = '1'; root.append(mat);
  const av = el('abs'); av.append(avatar(Math.min(H * 0.26, 210)));
  Object.assign(av.style, { left: W / 2 - 60 + 'px', top: barY + 10 + 'px', transition: 'top .5s ease, transform .5s ease', transformOrigin: '50% 0', zIndex: '2' });
  root.append(av);
  // timing gauge
  const gw = Math.min(W * 0.8, 320), gx = W / 2 - gw / 2, gyy = H * 0.84;
  const track = el('abs'); Object.assign(track.style, { left: gx + 'px', top: gyy + 'px', width: gw + 'px', height: '26px', borderRadius: '13px', background: '#fff', boxShadow: 'var(--shadow)', zIndex: '6' });
  const zone = el('abs'); Object.assign(zone.style, { top: '0', bottom: '0', width: zoneW * 100 + '%', borderRadius: '13px', background: '#7fd6a0' });
  const marker = el('abs'); Object.assign(marker.style, { top: '-7px', width: '40px', height: '40px', borderRadius: '50%', background: '#ef6b6b', border: '4px solid #fff', boxShadow: '0 3px 8px rgba(0,0,0,.25)' });
  track.append(zone, marker); root.append(track);
  const tap = el('abs'); Object.assign(tap.style, { inset: '0', zIndex: '5' }); tap.dataset.t = '1'; root.append(tap);
  const left = triesBar(ctx, (L === 1 ? 4 : L === 2 ? 3 : 2) + 1); left((L === 1 ? 4 : L === 2 ? 3 : 2) + 1);
  const total = (L === 1 ? 4 : L === 2 ? 3 : 2) + 1;
  let i = 0, busy = false, t = 0, zx = 0.3;
  const newZone = () => { zx = 0.05 + Math.random() * (0.9 - zoneW); zone.style.left = zx * 100 + '%'; };
  newZone();
  const pos = () => { const ph = (t / period) % 1; return ph < 0.5 ? ph * 2 : 2 - ph * 2; };
  ctx.say('g.8.how');
  ctx.hand(() => ({ kind: 'tap', at: { x: gx + gw * (zx + zoneW / 2), y: gyy - 10 } }));
  ctx.loop((dt) => { if (busy) { root.dataset.ninja = ''; return; } t += dt; const p = pos(); root.dataset.ninja = [((p * (gw - 40) + 20) / gw).toFixed(3), zx.toFixed(3), zoneW].join(','); marker.style.left = p * (gw - 40) + 'px'; });
  tap.addEventListener('pointerdown', () => {
    if (busy || i >= segs.length) return; busy = true;
    const p = pos(); const mc = (p * (gw - 40) + 20) / gw; const hit = mc >= zx && mc <= zx + zoneW;
    const hop = segs[i] === 'hop';
    if (hit) {
      i++; sfx.whoosh(); haptic(8); ctx.hit();
      world.style.transform = `translateX(${-i * gap}px)`;
      av.style.transform = hop ? 'rotate(0)' : `rotate(${i % 2 ? -12 : 12}deg)`;
      if (hop) { av.style.top = H * 0.62 - 230 + 'px'; ctx.later(() => (av.style.top = H * 0.62 - 150 + 'px'), 350); }
      ctx.later(() => { sfx.chime(i); const c = centerOf(av); ctx.sparkle(c.x, c.y); if (i >= segs.length) { ctx.praise(); ctx.win(); } else { busy = false; newZone(); } }, 1050);
    } else {
      mat.style.opacity = '1'; av.style.top = H * 0.62 - 150 + 'px'; av.style.transform = 'rotate(70deg)'; sfx.soft();
      const lost = ctx.mistake(false); left(Math.max(0, total - ctx.mistakes())); if (!lost) ctx.say('g.8.fall');
      ctx.later(() => { mat.style.opacity = '0'; av.style.transform = 'none'; av.style.top = (hop || i > 0 && segs[i - 1] === 'hop' ? H * 0.62 - 150 : barY + 10) + 'px'; if (!hop) av.style.top = barY + 10 + 'px'; busy = false; newZone(); }, 1500);
    }
  });
  void rel;
  void ({} as Pt);
};
