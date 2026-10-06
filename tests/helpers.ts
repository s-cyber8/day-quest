import { Page, Locator, TestInfo, expect } from '@playwright/test';
import fs from 'node:fs';

export const adv = (page: Page, ms: number) => page.clock.runFor(ms);
export async function shot(page: Page, info: TestInfo, name: string) {
  await page.waitForTimeout(700); // CSS animations run in real time, not on the fake clock
  const dir = `screenshots/${info.project.name}`;
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
}
export async function center(l: Locator) {
  await l.waitFor({ state: 'attached' });
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
export async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps }); await page.mouse.up();
}
/** Parent 3-second press-and-hold (virtual time keeps the test fast and deterministic). */
export async function hold(page: Page, l: Locator, ms = 3200) {
  const c = await center(l);
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await adv(page, ms); await page.mouse.up();
}
export async function newApp(page: Page) {
  await page.clock.install();
  await page.goto('./');
  await expect(page.locator('[data-screen=map]')).toBeVisible();
  await adv(page, 600);
}
export async function rageTaps(page: Page, n = 7, x = 30, y = 560) {
  await page.evaluate(([n, x, y]) => {
    for (let i = 0; i < n; i++) {
      const t = document.elementFromPoint(x, y)!;
      t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerType: 'touch' }));
    }
  }, [n, x, y] as const);
}
export const stage = (page: Page) => page.locator('.stage');
export const items = (page: Page) => page.locator('.stage [data-t]');
export const dset = (page: Page, key: string) => page.evaluate((k) => (document.querySelector('.stage') as HTMLElement | null)?.dataset[k] ?? '', key);
export const GAMES = ['wake', 'teeth', 'dress', 'breakfast', 'walk', 'tower', 'football', 'ninja', 'build', 'memory', 'dinner', 'bath', 'sleep'];
export const stationOf = (game: string) => GAMES.indexOf(game) + 1;

/** Seed state so that `game` is the current, already-confirmed station at `level`, then open it. */
export async function openGame(page: Page, game: string, level: number, extra: { prog?: object } = {}) {
  await page.clock.install();
  await page.goto('./');
  await expect(page.locator('[data-screen=map]')).toBeVisible();
  const id = stationOf(game);
  await page.evaluate(([game, level, id, prog]) => {
    const day = JSON.parse(localStorage.getItem('dq.day') || '{}');
    day.done = Array.from({ length: id as number }, (_, i) => i + 1); // station already complete: the node replays the game for stars
    day.confirmed = Array.from({ length: id as number }, (_, i) => i + 1); day.night = false; day.skipped = []; day.stars = {};
    localStorage.setItem('dq.day', JSON.stringify(day));
    const st = JSON.parse(localStorage.getItem('dq.settings') || '{}'); st.startLevel = { [game as string]: level }; localStorage.setItem('dq.settings', JSON.stringify(st));
    localStorage.removeItem('dq.prog'); if (prog) localStorage.setItem('dq.prog', JSON.stringify(prog));
  }, [game, level, id, extra.prog ?? null] as const);
  await page.reload();
  await expect(page.locator('[data-screen=map]')).toBeVisible();
  await adv(page, 800);
  await page.getByTestId(`node-${id}`).click();
  await expect(page.locator(`[data-game=${game}][data-level="${level}"]`)).toBeVisible();
  await adv(page, 1500);
}

export const won = async (page: Page, game: string) => {
  await adv(page, 2500);
  const id = stationOf(game);
  await expect.poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem('dq.day')!).stars[id] ?? 0, id), { timeout: 5000 }).toBeGreaterThan(0);
  return page.evaluate((id) => JSON.parse(localStorage.getItem('dq.day')!).stars[id] as number, id);
};
export const lost = async (page: Page) => { await adv(page, 2500); await expect(page.getByTestId('retry').or(page.getByTestId('calm-prompt'))).toBeVisible(); };

async function dragItem(page: Page, id: string, zone: Locator, wait = 600) {
  const it = page.locator(`.stage [data-t][data-id="${id}"]`).first();
  await dragTo(page, await center(it), await center(zone)); await adv(page, wait);
}
const fmt = async (page: Page, sel: string) => (await page.locator(sel).count());

// ---------- solvers (pass) and breakers (fail). Each takes the level. ----------
type Fn = (page: Page, level: number) => Promise<void>;
async function sweepGerms(page: Page) {
  const g = page.locator('[data-testid=germ]'); const n = await g.count(); if (!n) return;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) pts.push(await center(g.nth(i)));
  await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
  for (const p of pts) await page.mouse.move(p.x, p.y, { steps: 8 });
  await page.mouse.up();
}
const poll = async (page: Page, cond: () => Promise<boolean>, max = 3000, step = 40) => { for (let i = 0; i < max; i++) { await adv(page, step); if (await cond()) return true; } return false; };

export const PASS: Record<string, Fn> = {
  async wake(page, level) {
    if (level === 3) {
      const seq = await dset(page, 'simon'); await adv(page, 7000);
      for (const ch of seq) { await page.getByTestId('pad-' + ch).click(); await adv(page, 300); }
      return;
    }
    await page.getByTestId('w-curtains').click(); await adv(page, 600);
    if (level === 2) { await page.getByTestId('w-clock').click(); await adv(page, 600); }
    await page.getByTestId('w-av').click(); await adv(page, 600);
  },
  async teeth(page) { await adv(page, 600); for (let k = 0; k < 12; k++) { await sweepGerms(page); await adv(page, 1700); if (await page.getByTestId('celebrate').count()) break; } },
  async dress(page) {
    const order: [string, number][] = [['vest', 0], ['shirt', 0], ['shorts', 1], ['socks', 2], ['shoes', 2]];
    for (const [id, z] of order) { await adv(page, 1000); await dragItem(page, id, page.locator('.stage .zone').nth(z), 700); }
    await adv(page, 3000);
  },
  async breakfast(page) {
    await adv(page, 300);
    const need = ((await page.locator('[data-need]').getAttribute('data-need')) ?? '').split(',');
    for (const id of need) await dragItem(page, id, page.locator('.stage .zone').first(), 600);
    await adv(page, 9000);
  },
  async walk(page) {
    let last = -9999; let t = 0;
    for (let i = 0; i < 2500; i++) {
      await adv(page, 40); t += 40;
      if (await page.getByTestId('celebrate').count()) return;
      const gap = Number(await dset(page, 'gap')); const sp = Number(await dset(page, 'speed')) || 120;
      if (gap > 0 && gap <= sp * 0.42 && t - last > 1300) { await page.mouse.click(60, 400); last = t; }
    }
  },
  async tower(page) {
    for (let i = 0; i < 4000; i++) {
      await adv(page, 16);
      if (await page.getByTestId('celebrate').count()) return;
      const s = Number(await dset(page, 'swing'));
      if (Math.abs(s) < 0.02) { await page.mouse.click(60, 300); await adv(page, 1100); }
    }
  },
  async football(page, level) {
    for (let k = 0; k < 5; k++) {
      await adv(page, 2000);
      if (await page.getByTestId('celebrate').count()) return;
      const need = level === 1 ? 0.15 : 0.24;
      await poll(page, async () => Math.abs(Number(await dset(page, 'gk'))) > need, 400);
      const gk = Number(await dset(page, 'gk')); const gw = Number(await dset(page, 'gw'));
      const b = await center(items(page).first());
      const dx = (gk > 0 ? -1 : 1) * 0.35 * gw * 260 / (gw * 0.6);
      await dragTo(page, b, { x: b.x + dx, y: b.y - 260 }); await adv(page, 3200);
    }
  },
  async ninja(page) {
    for (let i = 0; i < 6000; i++) {
      await adv(page, 16);
      if (await page.getByTestId('celebrate').count()) return;
      const v = await dset(page, 'ninja'); if (!v) { continue; }
      const [mc, zx, zw] = v.split(',').map(Number);
      if (mc > zx + zw * 0.2 && mc < zx + zw * 0.8) { await page.mouse.click(80, 300); await adv(page, 1300); }
    }
  },
  async build(page, level) {
    if (level === 1) {
      await adv(page, 400); const p = items(page).first();
      await dragTo(page, await center(p), { x: 150, y: 220 }); await adv(page, 20500);
      await page.getByTestId('build-finish').click(); return;
    }
    await page.getByTestId('mode-copy').click(); await adv(page, 800);
    const ref = (await dset(page, 'ref')).split(';').map((r) => r.split(','));
    const protos = ['sq', 'tri', 'rect']; const board = (await page.getByTestId('board').boundingBox())!;
    for (const [c, r, kind] of ref) {
      const proto = items(page).nth(protos.indexOf(kind));
      await dragTo(page, await center(proto), { x: board.x + (board.width / 4) * (+c + 0.5), y: board.y + (board.height / 3) * (+r + 0.5) }); await adv(page, 300);
    }
    await page.getByTestId('build-finish').click();
  },
  async memory(page, level) {
    await adv(page, level === 1 ? 3400 : 300);
    const cards = page.locator('.mcard'); const n = await cards.count(); const ids: string[] = [];
    for (let i = 0; i < n; i++) ids.push((await cards.nth(i).getAttribute('data-id'))!);
    const done = new Set<number>();
    for (let i = 0; i < n; i++) {
      if (done.has(i)) continue; const j = ids.findIndex((v, k) => k > i && v === ids[i] && !done.has(k)); done.add(i); done.add(j);
      await cards.nth(i).click(); await adv(page, 300); await cards.nth(j).click(); await adv(page, 1400);
    }
  },
  async dinner(page, level) {
    const kind: Record<string, number> = { broccoli: 0, carrot: 0, chicken: 1, egg: 1, sweet: 2, rice: 2 };
    const ids = level === 1 ? ['broccoli', 'chicken', 'sweet'] : ['broccoli', 'carrot', 'chicken', 'egg', 'sweet', 'rice'];
    for (const id of ids) await dragItem(page, id, page.locator('.stage .zone').nth(kind[id]), 500);
    await adv(page, 1500);
    await dragItem(page, 'water', page.locator('.stage .zone.glow').first(), 900);
  },
  async bath(page) {
    for (let k = 0; k < 60; k++) {
      await adv(page, 300);
      if (await page.getByTestId('celebrate').count()) return;
      const part = await dset(page, 'part'); if (!part) { await adv(page, 500); continue; }
      const ring = page.locator(`.stage [data-part=${part}]`).first(); const c = await center(ring);
      await page.mouse.move(c.x - 35, c.y); await page.mouse.down();
      for (let i = 0; i < 6; i++) { await page.mouse.move(c.x + 35, c.y, { steps: 6 }); await page.mouse.move(c.x - 35, c.y, { steps: 6 }); }
      await page.mouse.up(); await adv(page, 1600);
    }
  },
  async sleep(page, level) {
    await adv(page, 400);
    for (let i = 0; i < (level === 3 ? 4 : 3); i++) { const c = await center(items(page).first()); await page.mouse.click(c.x, c.y); await adv(page, 400); }
    await adv(page, 2500);
    if (level > 1) { const hide = await dset(page, 'hide'); const c = await center(page.getByTestId('spot-' + hide)); await page.mouse.click(c.x, c.y); await adv(page, 800); }
    const teddy = page.locator('.stage [data-t][data-id=teddy]'); await dragTo(page, await center(teddy), await center(page.locator('.stage .zone.glow').first())); await adv(page, 8000);
  },
};

export const FAIL: Record<string, Fn> = {
  async wake(page, level) {
    if (level === 1) for (let i = 0; i < 6; i++) { await page.getByTestId('w-clock').click(); await adv(page, 300); }
    else if (level === 2) for (let i = 0; i < 7; i++) { await page.getByTestId('w-av').click(); await adv(page, 300); }
    else { const seq = await dset(page, 'simon'); for (let i = 0; i < 3; i++) { await adv(page, 9500); await page.getByTestId('pad-' + ((Number(seq[0]) + 1) % 4)).click(); await adv(page, 400); } }
  },
  async teeth(page) {
    const s = (await stage(page).boundingBox())!;
    for (let i = 0; i < 9; i++) { await dragTo(page, { x: s.x + 20, y: s.y + s.height * 0.92 }, { x: s.x + s.width - 20, y: s.y + s.height * 0.92 }, 6); await adv(page, 200); }
  },
  async dress(page, level) {
    for (let i = 0; i < 7; i++) {
      const id = level === 1 ? 'vest' : 'shoes';
      const it = page.locator(`.stage [data-t][data-id="${id}"]`).first();
      await dragTo(page, await center(it), await center(page.locator('.stage .zone').nth(level === 1 ? 2 : 2))); await adv(page, 700);
      if (await page.getByTestId('retry').or(page.getByTestId('calm-prompt')).count()) return;
    }
  },
  async breakfast(page, level) {
    const need = ((await page.locator('[data-need]').getAttribute('data-need')) ?? '').split(',');
    const bad = (level === 1 ? ['banana', 'egg'] : level === 2 ? ['egg'] : ['juice']).find((x) => !need.includes(x))!;
    if (level === 3) await adv(page, 5000);
    for (let i = 0; i < 6; i++) { await dragItem(page, bad, page.locator('.stage .zone').first(), 600); if (await page.getByTestId('retry').or(page.getByTestId('calm-prompt')).count()) return; }
  },
  async walk(page) { await adv(page, 70000); },
  async tower(page) {
    let first = true;
    for (let i = 0; i < 6000; i++) {
      await adv(page, 16);
      if (await page.getByTestId('retry').or(page.getByTestId('calm-prompt')).count()) return;
      const s = Number(await dset(page, 'swing'));
      // first block off-centre, every next block dead-centre => the top part keeps toppling
      if (first ? s > 0.2 && s < 0.23 : Math.abs(s) < 0.03) { await page.mouse.click(60, 300); first = false; await adv(page, 1300); }
    }
  },
  async football(page) {
    for (let k = 0; k < 5; k++) {
      await adv(page, 2000);
      await poll(page, async () => Math.abs(Number(await dset(page, 'gk'))) < 0.03, 600);
      const b = await center(items(page).first()); await dragTo(page, b, { x: b.x, y: b.y - 260 }); await adv(page, 3200);
      if (await page.getByTestId('retry').or(page.getByTestId('calm-prompt')).count()) return;
    }
  },
  async ninja(page) {
    for (let i = 0; i < 8000; i++) {
      await adv(page, 16);
      if (await page.getByTestId('retry').or(page.getByTestId('calm-prompt')).count()) return;
      const v = await dset(page, 'ninja'); if (!v) continue;
      const [mc, zx, zw] = v.split(',').map(Number);
      if (mc < zx - 0.12 || mc > zx + zw + 0.12) { await page.mouse.click(80, 300); await adv(page, 1800); }
    }
  },
  async build(page) {
    await page.getByTestId('mode-copy').click(); await adv(page, 800);
    for (let i = 0; i < 4; i++) { await page.getByTestId('build-finish').click(); await adv(page, 500); if (await page.getByTestId('retry').or(page.getByTestId('calm-prompt')).count()) return; }
  },
  async memory(page, level) {
    await adv(page, level === 1 ? 3400 : 300);
    const cards = page.locator('.mcard'); const n = await cards.count(); const ids: string[] = [];
    for (let i = 0; i < n; i++) ids.push((await cards.nth(i).getAttribute('data-id'))!);
    const a = 0, b = ids.findIndex((v) => v !== ids[0]);
    for (let i = 0; i < 12; i++) {
      await cards.nth(a).click(); await adv(page, 300); await cards.nth(b).click(); await adv(page, 2600);
      if (await page.getByTestId('retry').or(page.getByTestId('calm-prompt')).count()) return;
    }
  },
  async dinner(page) {
    for (let i = 0; i < 6; i++) { await dragItem(page, 'broccoli', page.locator('.stage .zone').nth(1), 600); if (await page.getByTestId('retry').or(page.getByTestId('calm-prompt')).count()) return; }
  },
  async bath(page) {
    await adv(page, 3000);
    for (let k = 0; k < 12; k++) {
      const part = await dset(page, 'part'); const other = ['head', 'hands', 'tummy', 'feet'].find((p) => p !== part)!;
      const c = await center(page.locator(`.stage [data-part=${other}]`).first());
      await page.mouse.move(c.x - 35, c.y); await page.mouse.down();
      for (let i = 0; i < 4; i++) { await page.mouse.move(c.x + 35, c.y, { steps: 6 }); await page.mouse.move(c.x - 35, c.y, { steps: 6 }); }
      await page.mouse.up(); await adv(page, 2200);
      if (await page.getByTestId('retry').or(page.getByTestId('calm-prompt')).count()) return;
    }
  },
};
void fmt;
