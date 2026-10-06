import { test, expect } from '@playwright/test';
import { openGame, adv, newApp, shot, hold, center } from './helpers';

const end = (page: import('@playwright/test').Page, o: object) => page.evaluate((o) => (window as unknown as { __dqEnd: (o: unknown) => void }).__dqEnd(o), o);

test('two wins in a row level up; stars: best kept; level persisted', async ({ page }, info) => {
  await openGame(page, 'teeth', 1, { prog: { teeth: { level: 1, wins: 1, fails: 0 } } });
  await end(page, { result: 'win', stars: 2 });
  await adv(page, 2500);
  await expect(page.getByTestId('celebrate')).toBeVisible();
  await page.waitForTimeout(800); await shot(page, info, 'levels-1-levelup');
  const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('dq.prog')!));
  expect(prog.teeth.level).toBe(2); expect(prog.teeth.wins).toBe(0);
  const day = await page.evaluate(() => JSON.parse(localStorage.getItem('dq.day')!));
  expect(day.stars['2']).toBe(2);
});

test('two fails in a row: silent level down + Moka offers a quiet break (once, cooldown respected)', async ({ page }, info) => {
  await openGame(page, 'teeth', 2);
  await end(page, { result: 'lose' }); await adv(page, 2500);
  await expect(page.getByTestId('retry')).toBeVisible();
  await page.waitForTimeout(600); await shot(page, info, 'levels-2-retry');
  await page.getByTestId('retry-again').click(); await adv(page, 1500);
  await expect(page.locator('[data-game=teeth][data-level="2"]')).toBeVisible();
  await end(page, { result: 'lose' }); await adv(page, 2500);
  await expect(page.getByTestId('calm-prompt')).toBeVisible();
  await expect(page.getByTestId('calm-prompt')).toContainText('הפסקה שקטה');
  await page.waitForTimeout(600); await shot(page, info, 'levels-3-break-offer');
  await page.getByTestId('calm-no').click(); await adv(page, 1500);
  await expect(page.locator('[data-game=teeth][data-level="1"]')).toBeVisible(); // quietly easier
  // another double fail inside the cooldown: no second offer, just the retry screen
  await end(page, { result: 'lose' }); await adv(page, 2500); await expect(page.getByTestId('retry')).toBeVisible();
  await page.getByTestId('retry-again').click(); await adv(page, 1500);
  await end(page, { result: 'lose' }); await adv(page, 2500);
  await expect(page.getByTestId('calm-prompt')).toHaveCount(0);
  await expect(page.getByTestId('retry')).toBeVisible();
});

test('break offer -> yes goes to the calm corner and is logged as "fails"', async ({ page }) => {
  await openGame(page, 'memory', 2);
  await end(page, { result: 'lose' }); await adv(page, 2500); await page.getByTestId('retry-again').click(); await adv(page, 1500);
  await end(page, { result: 'lose' }); await adv(page, 2500);
  await page.getByTestId('calm-yes').click(); await adv(page, 800);
  await expect(page.getByTestId('calm')).toBeVisible();
  await expect(page.getByTestId('feel-upset')).toHaveCount(0); // no feelings question on entry
  await expect(page.getByTestId('act-water')).toBeVisible();
  await page.getByTestId('back').click(); await adv(page, 800);
  await expect(page.getByTestId('calm')).toHaveCount(0);
  const log = await page.evaluate(() => JSON.parse(localStorage.getItem('dq.log')!));
  expect(log[0].calm[0].source).toBe('fails');
});

test('leaving a game returns to the map with the station already complete; it can be replayed for stars', async ({ page }) => {
  await openGame(page, 'dress', 2);
  await page.getByTestId('back').click(); await adv(page, 800);
  await expect(page.locator('[data-screen=map]')).toBeVisible();
  const day = await page.evaluate(() => JSON.parse(localStorage.getItem('dq.day')!));
  expect(day.done).toContain(3);
  await expect(page.getByTestId('node-3').locator('.star')).toBeVisible();
  await page.getByTestId('node-3').click(); await adv(page, 1500);
  await expect(page.locator('[data-game=dress]')).toBeVisible();
});

test('real flow: confirm completes the station even if the game is abandoned; day moves on', async ({ page }) => {
  await newApp(page);
  await page.getByTestId('node-1').click(); await page.getByTestId('go').click(); await adv(page, 800);
  await hold(page, page.getByTestId('hold')); await adv(page, 4500);
  await expect(page.locator('[data-game=wake]')).toBeVisible();
  await page.getByTestId('back').click(); await adv(page, 800);
  await expect(page.locator('[data-screen=map]')).toBeVisible();
  const day = await page.evaluate(() => JSON.parse(localStorage.getItem('dq.day')!));
  expect(day.done).toEqual([1]); expect(day.stars['1'] ?? 0).toBe(0);
  await expect(page.getByTestId('node-2')).toHaveClass(/current/);
});

test('wake lock is requested during a station and released on the map', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __wl: number; __wlr: number };
    w.__wl = 0; w.__wlr = 0;
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { w.__wl++; return { release: async () => { w.__wlr++; }, addEventListener() {} }; } } });
  });
  await newApp(page);
  expect(await page.evaluate(() => (window as unknown as { __wl: number }).__wl)).toBe(0);
  await page.getByTestId('node-1').click(); await expect(page.locator('[data-screen=announce]')).toBeVisible(); await adv(page, 400);
  expect(await page.evaluate(() => (window as unknown as { __wl: number }).__wl)).toBeGreaterThan(0);
  await page.getByTestId('back').click(); await adv(page, 600);
  expect(await page.evaluate(() => (window as unknown as { __wlr: number }).__wlr)).toBeGreaterThan(0);
});

test('hand hint shows, hides on first touch, returns after 6 s idle', async ({ page }) => {
  await openGame(page, 'walk', 1);
  const hand = page.getByTestId('hand');
  await adv(page, 800); await expect(hand).toBeVisible();
  await page.mouse.click(60, 400); await expect(hand).toBeHidden();
  await adv(page, 6500); await expect(hand).toBeVisible();
});
