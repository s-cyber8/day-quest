import { Game, el, put, centerOf } from './engine';
import { P } from '../art/props';
import { asset } from '../content/stations';
import { sfx, haptic } from '../core/audio';
import { mokaSvg, setMoka } from '../art/moka';
import { h, drag, clamp, lerp } from '../core/dom';

const avatar = (hgt: number) => h('img', { src: asset('avatar/rafael-football.png'), style: `height:${hgt}px;display:block`, draggable: 'false' });

/* 5 — Walk to kindergarten: tap to step along a winding path with Moka, collect 5 stars */
export const walk: Game = (ctx) => {
  const { root, W, H } = ctx;
  const pts = Array.from({ length: 11 }, (_, i) => ({ x: W * (0.5 + 0.3 * Math.sin(i * 0.95 + 0.4) * (i === 0 ? 0 : 1)), y: H * (0.88 - i * 0.076) }));
  const d = pts.map((p, i) => (i ? `L${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`)).join(' ');
  const road = el('abs', `<svg width="${W}" height="${H}" style="display:block"><path d="${d}" fill="none" stroke="#fff" stroke-width="64" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/><path d="${d}" fill="none" stroke="#bfe3f7" stroke-width="6" stroke-linecap="round" stroke-dasharray="4 18" /></svg>`);
  Object.assign(road.style, { left: '0', top: '0', width: W + 'px', height: H + 'px' });
  root.append(road);
  const kg = put(el('abs', P.cloud()), pts[10].x, pts[10].y - 20, 110); root.append(kg);
  const starAt = [2, 4, 6, 8, 10];
  const stars = starAt.map((i) => { const s = put(el('abs jiggle', P.star()), pts[i].x, pts[i].y - 36, 64); root.append(s); return s; });
  const moka = mokaSvg('walking'); const mw = el('abs'); mw.append(moka); put(mw, pts[0].x - 70, pts[0].y, 96, 96); root.append(mw);
  const av = el('abs'); av.append(avatar(120)); root.append(av);
  const place = (p: { x: number; y: number }, extra = 0) => { put(av, p.x + extra, p.y - 40, 70, 120); put(mw, p.x - 66, p.y - 6, 96, 96); };
  Object.assign(av.style, { transition: 'left .9s ease-in-out, top .9s ease-in-out' }); mw.style.transition = 'left 1.1s ease-in-out, top 1.1s ease-in-out';
  place(pts[0]);
  const tap = el('abs'); Object.assign(tap.style, { inset: '0', zIndex: '3' }); tap.dataset.t = '1'; root.append(tap);
  ctx.say('g.5.how');
  let step = 0, collected = 0; let busy = false;
  tap.addEventListener('pointerdown', () => {
    if (busy || step >= 10) return; busy = true; step++; sfx.step(); haptic(8);
    place(pts[step]); setMoka(moka, 'walking');
    ctx.later(() => {
      busy = false;
      const k = starAt.indexOf(step);
      if (k >= 0) { stars[k].classList.add('pop'); sfx.chime(collected); collected++; ctx.hit(); const c = centerOf(av); ctx.sparkle(c.x, c.y - 40); }
      if (step >= 10) { setMoka(moka, 'happy'); delete tap.dataset.t; ctx.praise(); ctx.finish(); }
    }, 950);
  });
};

/* 6 — Tower of blocks, star on top */
export const tower: Game = (ctx) => {
  const { root, W, H } = ctx;
  const colors = ['#ff9bb3', '#8fd0f0', '#ffe28a', '#a8e6cf', '#c8b6f2'];
  const bw = Math.min(W * 0.34, 150), bh = bw * 0.5;
  const baseY = H * 0.74; const cx = W / 2;
  const ground = el('abs'); Object.assign(ground.style, { left: '0', right: '0', top: baseY + 'px', height: '14px', background: '#d8c9a8', borderRadius: '7px' });
  const zone = put(el('abs zone'), cx, baseY - bh * 2.6, bw * 1.5, bh * 5.4); root.append(ground, zone);
  const tray = { x: W / 2, y: H * 0.88 };
  let n = 0;
  ctx.say('g.6.how');
  const nextBlock = () => {
    if (!ctx.alive()) return;
    const isStar = n >= 5;
    if (isStar) ctx.say('g.6.star');
    const w = isStar ? ctx.size(84) : bw * ctx.scale; const hh = isStar ? w : bh * ctx.scale;
    const e = put(el('abs', isStar ? P.star() : P.block(colors[n % 5])), tray.x, tray.y, w, hh);
    e.dataset.t = '1'; e.style.zIndex = '5'; root.append(e); zone.classList.add('glow');
    let ox = 0, oy = 0;
    drag(e, {
      start: (x, y) => { const c = centerOf(e); ox = x - c.x; oy = y - c.y; e.style.transition = 'none'; sfx.tap(); },
      move: (x, y) => { const rb = root.getBoundingClientRect(); e.style.left = x - ox - rb.left - w / 2 + 'px'; e.style.top = y - oy - rb.top - hh / 2 + 'px'; },
      end: (x, y) => {
        const rb = root.getBoundingClientRect(); const px = x - ox - rb.left, py = y - oy - rb.top;
        const centerY = baseY - n * bh * 0.98 - hh / 2;
        const near = Math.abs(px - cx) < bw * 1.1 + 40 * ctx.scale && Math.abs(py - centerY) < bh * 2.5 + 60 * ctx.scale;
        e.style.transition = 'all .45s cubic-bezier(.3,1.3,.5,1)';
        if (near) {
          const nx = cx + (isStar ? 0 : ((n % 2) ? 5 : -5));
          e.style.left = nx - w / 2 + 'px'; e.style.top = centerY - hh / 2 + 'px';
          delete e.dataset.t; e.style.pointerEvents = 'none';
          sfx.place(); haptic(10); ctx.hit(); ctx.sparkle(rb.left + nx, rb.top + centerY); n++;
          if (isStar) { zone.classList.remove('glow'); sfx.sparkle(); ctx.praise(); ctx.finish(); }
          else ctx.later(nextBlock, 600);
        } else { e.style.left = tray.x - w / 2 + 'px'; e.style.top = tray.y - hh / 2 + 'px'; ctx.miss(); }
      },
    });
  };
  nextBlock();
};

/* 7 — Football: flick the ball at the goal. The goalie is slow and always lets one in. */
export const football: Game = (ctx) => {
  const { root, W, H } = ctx;
  const gw = Math.min(W * 0.86, 360), gh = gw * 0.55; const gy = H * 0.2;
  const pitch = el('abs'); Object.assign(pitch.style, { left: '-2%', right: '-2%', top: gy - gh * 0.55 + 'px', bottom: '0', background: 'linear-gradient(#9fdc9a,#7fcf86)', borderRadius: '40px 40px 0 0' });
  const goal = put(el('abs', P.goal()), W / 2, gy, gw, gh); root.append(pitch, goal);
  const goalie = put(el('abs', P.goalie()), W / 2, gy + gh * 0.12, ctx.size(88)); root.append(goalie);
  const bsz = ctx.size(96);
  const home = { x: W / 2, y: H * 0.8 };
  const ball = put(el('abs', P.football()), home.x, home.y, bsz); ball.dataset.t = '1'; ball.style.zIndex = '5'; root.append(ball);
  const av = el('abs'); av.append(avatar(Math.min(H * 0.26, 200))); Object.assign(av.style, { left: W * 0.08 + 'px', bottom: '2%', opacity: '.95' }); root.append(av);
  let t = 0, attempts = 0, goals = 0, shooting = false;
  const gX = W / 2;
  let reach = 1;
  ctx.loop((dt) => { t += dt * 0.7 * ctx.speed; if (!shooting) goalie.style.left = gX + Math.sin(t) * gw * 0.28 - goalie.offsetWidth / 2 + 'px'; });
  ctx.say('g.7.how');
  let sx = 0, sy = 0, st = 0;
  drag(ball, {
    start: (x, y) => { sx = x; sy = y; st = performance.now(); ball.style.transition = 'none'; },
    move: (x, y) => { const rb = root.getBoundingClientRect(); ball.style.left = clamp(x - rb.left - bsz / 2, 0, W - bsz) + 'px'; ball.style.top = clamp(y - rb.top - bsz / 2, H * 0.3, H - bsz) + 'px'; },
    end: (x, y) => {
      const dx = x - sx, dy = y - sy;
      if (shooting) return;
      if (dy > -20 && Math.hypot(dx, dy) < 40) { // tap or tiny drag: nudge back, not a miss
        ball.style.transition = 'all .4s'; ball.style.left = home.x - bsz / 2 + 'px'; ball.style.top = home.y - bsz / 2 + 'px'; return;
      }
      shoot(dx, dy);
    },
  });
  function shoot(dx: number, dy: number) {
    shooting = true; attempts++; sfx.kick(); haptic(15); delete ball.dataset.t;
    // swipe direction nudges where it goes, always inside the goal mouth
    const aim = clamp(gX + (dx / Math.max(60, Math.abs(dy))) * gw * 0.5, gX - gw * 0.4, gX + gw * 0.4);
    const ty = gy + gh * 0.25;
    ball.style.transition = 'all .9s cubic-bezier(.2,.6,.3,1)';
    ball.style.left = aim - bsz * 0.4 + 'px'; ball.style.top = ty + 'px'; ball.style.transform = 'scale(.62)';
    // goalie tries (a little) on the first shot, then looks the other way
    const gx = attempts <= 1 ? gX + (aim - gX) * 0.35 : gX + (aim < gX ? 1 : -1) * gw * 0.34;
    goalie.style.transition = 'left 1.6s ease-out'; goalie.style.left = gx - goalie.offsetWidth / 2 + 'px';
    ctx.later(() => {
      goals++; ctx.hit(); sfx.big(); ctx.say('g.7.goal'); ctx.sparkle(aim + root.getBoundingClientRect().left, ty + root.getBoundingClientRect().top);
      for (let i = 0; i < 4; i++) ctx.later(() => ctx.sparkle(root.getBoundingClientRect().left + aim + (i - 1.5) * 40, root.getBoundingClientRect().top + ty - 20), i * 150);
      if (goals >= 2) { ctx.later(() => ctx.praise(), 1400); ctx.finish(); return; }
      ctx.later(() => { // reset the ball
        ball.style.transition = 'none'; ball.style.transform = 'none'; ball.style.left = home.x - bsz / 2 + 'px'; ball.style.top = home.y - bsz / 2 + 'px';
        ball.dataset.t = '1'; shooting = false; goalie.style.transition = 'none'; reach = 1; void reach;
      }, 1600);
    }, 1000);
  }
  void lerp;
};

/* 8 — Ninja: tap to swing across monkey bars, then hop soft cushions */
export const ninja: Game = (ctx) => {
  const { root, W, H } = ctx;
  const gap = Math.max(140, W * 0.36), steps = 7;
  const world = el('abs'); Object.assign(world.style, { left: '0', top: '0', width: gap * (steps + 3) + 'px', height: H + 'px', transition: 'transform 1s cubic-bezier(.45,.05,.3,1)' });
  const barY = H * 0.28;
  world.innerHTML = `<div class="abs" style="left:0;right:0;top:${barY}px;height:14px;background:#ef6b6b;border-radius:7px"></div>` +
    Array.from({ length: 5 }, (_, i) => `<div class="abs" style="left:${W * 0.5 + i * gap * 1.2}px;top:${barY}px;width:12px;height:${H * 0.1}px;background:#f59a9a;border-radius:6px"></div>`).join('') +
    `<div class="abs" style="left:0;right:0;top:${H * 0.78}px;height:${H * 0.22}px;background:#cdeccf"></div>`;
  for (let i = 0; i < 2; i++) world.append(put(el('abs', P.cushion()), W * 0.5 + gap * (5.2 + i * 1.3), H * 0.78 - 18, ctx.size(110), 80));
  root.append(world);
  const av = el('abs'); const img = avatar(Math.min(H * 0.3, 240)); av.append(img);
  const aw = 130; Object.assign(av.style, { left: W / 2 - aw / 2 + 'px', top: barY + 10 + 'px', transition: 'top .5s ease, transform .5s ease', transformOrigin: '50% 0', zIndex: '2' });
  root.append(av);
  const tap = el('abs'); Object.assign(tap.style, { inset: '0', zIndex: '3' }); tap.dataset.t = '1'; root.append(tap);
  ctx.say('g.8.how');
  let i = 0, busy = false;
  tap.addEventListener('pointerdown', () => {
    if (busy || i >= steps) return; busy = true; i++;
    const hop = i > 4;
    sfx.whoosh(); haptic(8);
    world.style.transform = `translateX(${(i * gap) * (document.dir === 'rtl' ? 1 : -1) * 1}px)`;
    world.style.transform = `translateX(${-i * gap}px)`;
    av.style.transform = hop ? 'translateY(0) rotate(0)' : `rotate(${i % 2 ? -12 : 12}deg)`;
    if (hop) av.style.top = H * 0.78 - 190 + 'px';
    ctx.later(() => { if (hop) { av.style.top = H * 0.78 - 250 + 'px'; ctx.later(() => (av.style.top = H * 0.78 - 190 + 'px'), 350); } }, 400);
    ctx.later(() => {
      busy = false; sfx.chime(i); ctx.hit(); const c = centerOf(av); ctx.sparkle(c.x, c.y);
      if (i >= steps) { delete tap.dataset.t; ctx.praise(); ctx.finish(); }
    }, 1050);
  });
};
