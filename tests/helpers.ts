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
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
export async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}
/** Parent 3-second press-and-hold (virtual time keeps the test fast and deterministic). */
export async function hold(page: Page, l: Locator, ms = 3200) {
  const c = await center(l);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await adv(page, ms);
  await page.mouse.up();
}
export async function newApp(page: Page) {
  await page.clock.install();
  await page.goto('./');
  await expect(page.locator('[data-screen=map]')).toBeVisible();
  await adv(page, 600);
}
export const stage = (page: Page) => page.locator('.stage');
export const items = (page: Page) => page.locator('.stage [data-t]');

/** Drag the currently offered item onto the glowing zone, n times. */
async function dragSeq(page: Page, n: number, wait = 1000) {
  for (let i = 0; i < n; i++) {
    await adv(page, 700);
    const it = items(page).last();
    await expect(it).toBeVisible();
    const tgt = page.locator('.stage .zone.glow').first();
    await dragTo(page, await center(it), await center(tgt));
    await adv(page, wait);
  }
}

export const SOLVERS: Record<string, (page: Page) => Promise<void>> = {
  async wake(page) {
    await adv(page, 300);
    await items(page).first().click(); await adv(page, 2600);
    for (let i = 0; i < 3; i++) { await items(page).first().click(); await adv(page, 600); }
  },
  async teeth(page) {
    await adv(page, 400);
    const g = page.locator('.stage .abs.jiggle');
    const n = await g.count();
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) pts.push(await center(g.nth(i)));
    await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
    for (const p of pts) await page.mouse.move(p.x, p.y, { steps: 8 });
    await page.mouse.up(); await adv(page, 3000);
  },
  async dress(page) { await dragSeq(page, 4); await adv(page, 2500); },
  async breakfast(page) { await dragSeq(page, 3); await adv(page, 12000); },
  async walk(page) {
    for (let i = 0; i < 10; i++) { await items(page).first().click({ position: { x: 20, y: 300 } }).catch(async () => { await page.mouse.click(60, 400); }); await adv(page, 1200); }
  },
  async tower(page) { await dragSeq(page, 6, 1400); },
  async football(page) {
    for (let k = 0; k < 2; k++) {
      await adv(page, 800);
      const b = await center(items(page).first());
      await dragTo(page, b, { x: b.x + 40, y: b.y - 260 });
      await adv(page, 3200);
    }
  },
  async ninja(page) { for (let i = 0; i < 7; i++) { await page.mouse.click(80, 300); await adv(page, 1300); } },
  async build(page) {
    await adv(page, 500);
    const protos = items(page);
    for (let i = 0; i < 3; i++) {
      const p = await center(protos.nth(i));
      await dragTo(page, p, { x: 100 + i * 90, y: 200 + i * 60 });
    }
    await adv(page, 20500);
    await page.getByTestId('build-finish').click();
    await adv(page, 2500);
  },
  async memory(page) {
    await adv(page, 3000);
    const cards = page.locator('.mcard');
    const srcs: string[] = [];
    for (let i = 0; i < 6; i++) srcs.push((await cards.nth(i).locator('img').getAttribute('src'))!);
    // one deliberate mismatch first (a miss is gentle), then the pairs
    const other = srcs.findIndex((s, i) => i > 0 && s !== srcs[0]);
    await cards.nth(0).click(); await adv(page, 300); await cards.nth(other).click(); await adv(page, 2500);
    const used = new Set<number>();
    for (let i = 0; i < 6; i++) {
      if (used.has(i)) continue; const j = srcs.findIndex((s, k) => k > i && s === srcs[i] && !used.has(k));
      used.add(i); used.add(j);
      await cards.nth(i).click(); await adv(page, 300); await cards.nth(j).click(); await adv(page, 1200);
    }
    await adv(page, 2000);
  },
  async dinner(page) { await dragSeq(page, 4); await adv(page, 2500); },
  async bath(page) {
    await adv(page, 400);
    const s = (await stage(page).boundingBox())!;
    await page.mouse.move(s.x + 10, s.y + s.height * 0.2); await page.mouse.down();
    for (let y = s.y + s.height * 0.2; y < s.y + s.height * 0.8; y += 36) {
      await page.mouse.move(s.x + s.width - 10, y, { steps: 14 }); await page.mouse.move(s.x + 10, y + 18, { steps: 14 });
    }
    await page.mouse.up(); await adv(page, 3000);
  },
  async sleep(page) {
    await adv(page, 400);
    for (let i = 0; i < 3; i++) { await items(page).first().click(); await adv(page, 300); }
    await adv(page, 2500);
    await dragSeq(page, 1, 1000);
    await adv(page, 7000);
  },
};

/** Rapid-fire taps on empty space (dispatched in one go: Playwright clicks are slower than 1.5 s for 7). */
export async function rageTaps(page: Page, n = 7, x = 30, y = 560) {
  await page.evaluate(([n, x, y]) => {
    for (let i = 0; i < n; i++) {
      const t = document.elementFromPoint(x, y)!;
      t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerType: 'touch' }));
    }
  }, [n, x, y] as const);
}
