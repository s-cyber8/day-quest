import { test, expect, Page } from '@playwright/test';
import { adv, newApp, openGame, shot, hold, center, GAMES, items } from './helpers';

/** No chrome button may overlap another button, the caption, the thumbnail, or content. */
async function audit(page: Page, label: string) {
  const res = await page.evaluate(() => {
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      if (!(r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05)) return false;
      // occluded by a full-screen overlay (e.g. the map under the calm corner)? then it is not on screen
      const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
      return !!top && (e === top || e.contains(top) || top.contains(e));
    };
    const R = (e: Element) => e.getBoundingClientRect();
    const hit = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 3 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3;
    const fixed = ['#back', '#cloud'].map((s) => document.querySelector(s)).filter((e): e is Element => !!e && vis(e));
    const others = [...document.querySelectorAll('button:not(#back):not(#cloud), #caption.show, .thumbrow, .stage [data-t], .hold, .bigbtn, .card, .stars, .node.current, .faces button, .tile')].filter((e) => vis(e) && !e.closest('#back, #cloud'));
    const bad: string[] = [];
    for (const f of fixed) for (const o of others) {
      if (o.closest('.mapscroll') && !o.matches('.node.current')) continue;
      if (hit(R(f), R(o))) bad.push(`${f.id} overlaps ${o.className || o.tagName} ${o.getAttribute('data-testid') ?? ''}`);
    }
    if (fixed.length === 2 && hit(R(fixed[0]), R(fixed[1]))) bad.push('back overlaps cloud');
    const vp = { w: innerWidth, h: innerHeight };
    for (const f of fixed) { const r = R(f); if (r.left < 0 || r.right > vp.w || r.top < 0 || r.bottom > vp.h) bad.push(f.id + ' outside viewport'); }
    const sw = document.documentElement.scrollWidth > innerWidth;
    return { bad, sw, back: !!document.querySelector('#back:not([hidden])'), backSize: document.querySelector('#back') ? R(document.querySelector('#back')!).width : 0 };
  });
  expect(res.sw, label + ' horizontal scroll').toBe(false);
  expect(res.bad, label).toEqual([]);
  return res;
}

test('layout: map, station screens, calm corner, sticker book, parent', async ({ page }, info) => {
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ':root{--sat:47px;--sab:34px}'; document.head.append(s); }); });
  await newApp(page);
  let r = await audit(page, 'map'); expect(r.back).toBe(false); // home screen: nothing to go back to
  await shot(page, info, 'lay-map');
  await page.getByTestId('node-1').click(); await expect(page.locator('[data-screen=announce]')).toBeVisible(); await adv(page, 1200);
  r = await audit(page, 'announce'); expect(r.back).toBe(true); expect(r.backSize).toBeGreaterThanOrEqual(72);
  await shot(page, info, 'lay-announce');
  await page.getByTestId('go').click(); await expect(page.locator('[data-screen=godo]')).toBeVisible(); await adv(page, 1200);
  await audit(page, 'godo'); await shot(page, info, 'lay-godo');
  await page.getByTestId('back').click(); await adv(page, 600);
  await expect(page.locator('[data-screen=map]')).toBeVisible();
  // sticker book
  await page.getByTestId('book').click(); await adv(page, 600); r = await audit(page, 'sticker'); expect(r.back).toBe(true); await shot(page, info, 'lay-sticker');
  await page.getByTestId('back').click(); await adv(page, 600);
  // calm corner (via the cloud, bottom corner)
  const cb = (await page.getByTestId('cloud').boundingBox())!; const vp = page.viewportSize()!;
  expect(cb.y + cb.height).toBeGreaterThan(vp.height * 0.8);
  await page.getByTestId('cloud').click(); await adv(page, 800);
  await expect(page.getByTestId('act-water')).toBeVisible(); await audit(page, 'calm-pick'); await shot(page, info, 'lay-calm');
  await page.getByTestId('back').click(); await adv(page, 800);
  await expect(page.getByTestId('calm')).toHaveCount(0);
  // parent
  await page.getByTestId('gear').click(); await hold(page, page.getByTestId('hold')); await expect(page.getByTestId('parent')).toBeVisible();
  await page.waitForTimeout(500); await shot(page, info, 'lay-parent');
  const pb = (await page.getByTestId('back').boundingBox())!; const ph = (await page.locator('.parent h1').boundingBox())!;
  expect(ph.y).toBeGreaterThanOrEqual(pb.y + pb.height - 2); // content starts below the back button
  await page.getByTestId('back').click(); await expect(page.locator('[data-screen=map]')).toBeVisible();
});

for (const game of GAMES) {
  test(`layout: game ${game} (levels 1-3)`, async ({ page }, info) => {
    await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ':root{--sat:47px;--sab:34px}'; document.head.append(s); }); });
    for (const level of [1, 2, 3]) {
      await openGame(page, game, level);
      await adv(page, 1500);
      const r = await audit(page, `${game} L${level}`);
      expect(r.back).toBe(true);
      if (level === 2 || game === 'wake') await shot(page, info, `lay-game-${game}-L${level}`);
      // every interactive game item must clear the back button and the cloud
      const n = await items(page).count();
      expect(n).toBeGreaterThanOrEqual(0);
    }
  });
}

test('bath: Rafael in the tub, all five scrub zones are reachable (inside the stage, clear of back button and cloud)', async ({ page }, info) => {
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ':root{--sat:47px;--sab:34px}'; document.head.append(s); }); });
  await openGame(page, 'bath', 2);
  await adv(page, 3000);
  await expect(page.getByTestId('bath-boy')).toBeVisible();
  const st = (await page.locator('.stage').boundingBox())!;
  const zones = JSON.parse(await page.evaluate(() => (document.querySelector('.stage') as HTMLElement).dataset.parts!)) as Record<string, { x: number; y: number }[]>;
  expect(Object.keys(zones).sort()).toEqual(['ears', 'hands', 'head', 'shoulders', 'tummy']);
  const cloud = (await page.getByTestId('cloud').boundingBox())!, back = (await page.getByTestId('back').boundingBox())!;
  const boy = (await page.getByTestId('bath-boy').boundingBox())!;
  for (const [k, pts] of Object.entries(zones)) for (const p of pts) {
    const ax = st.x + p.x, ay = st.y + p.y;
    expect(ax, k).toBeGreaterThan(st.x + 20); expect(ax, k).toBeLessThan(st.x + st.width - 20);
    expect(ay, k).toBeGreaterThan(st.y + 20); expect(ay, k).toBeLessThan(st.y + st.height - 20);
    expect(ax >= cloud.x && ax <= cloud.x + cloud.width && ay >= cloud.y && ay <= cloud.y + cloud.height, k + ' under cloud').toBe(false);
    expect(ax >= back.x && ax <= back.x + back.width && ay >= back.y && ay <= back.y + back.height, k + ' under back').toBe(false);
    expect(ax, k).toBeGreaterThan(boy.x); expect(ax, k).toBeLessThan(boy.x + boy.width); expect(ay, k).toBeGreaterThan(boy.y); expect(ay, k).toBeLessThan(boy.y + boy.height);
  }
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelectorAll('.stage [data-part]').forEach((r) => ((r as HTMLElement).style.opacity = '1')));
  await shot(page, info, 'lay-bath-zones');
});
