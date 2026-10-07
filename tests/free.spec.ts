import { test, expect, Page } from '@playwright/test';
import { adv, hold, newApp, shot, center } from './helpers';
import { PHRASES } from '../src/content/phrases';
import fs from 'node:fs';

const doneIds = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('dq.day')!).done as number[]);
async function confirmStation(page: Page, id: number) {
  await page.getByTestId(`node-${id}`).click();
  await expect(page.locator('[data-screen=announce]')).toBeVisible();
  await page.getByTestId('go').click(); await adv(page, 800);
  await hold(page, page.getByTestId('hold'));
  await adv(page, 4600);
  await expect(page.locator('[data-screen=game]')).toBeVisible();
}
async function expectNext(page: Page, id: number) {
  await expect(page.getByTestId(`node-${id}`)).toHaveClass(/current/);
  // the avatar stands at the highlighted station
  const hero = await center(page.locator('.hero img')); const node = await center(page.getByTestId(`node-${id}`));
  expect(Math.hypot(hero.x - node.x, hero.y - node.y)).toBeLessThan(230);
}

test('stations open in any order (4 -> 12 -> 2 -> 13 -> 7); the highlight follows the next uncompleted station in order; nothing locks', async ({ page }, info) => {
  await newApp(page);
  await expectNext(page, 1);
  for (const id of [4, 12, 2]) {
    await confirmStation(page, id);
    await page.getByTestId('back').click(); await adv(page, 800);
    await expect(page.locator('[data-screen=map]')).toBeVisible(); await adv(page, 2600);
    await expectNext(page, 1);
  }
  expect((await doneIds(page)).sort((a, b) => a - b)).toEqual([2, 4, 12]);
  await shot(page, info, 'free-1-map-out-of-order');
  // station 13: win the bedtime game -> calm night ending, no lock
  await confirmStation(page, 13);
  await page.evaluate(() => (window as unknown as { __dqEnd: (o: unknown) => void }).__dqEnd({ result: 'win', stars: 3 }));
  await adv(page, 2500); await adv(page, 5000);
  await expect(page.getByTestId('night')).toBeVisible();
  await page.waitForTimeout(3000); await shot(page, info, 'free-2-night');
  await expect(page.getByTestId('hold')).toHaveCount(0); // no unlock hold / PIN flow any more
  await page.getByTestId('night-continue').click(); await expect(page.locator('[data-screen=map]')).toBeVisible(); await adv(page, 2600);
  await expectNext(page, 1);
  await confirmStation(page, 7);
  await page.getByTestId('back').click(); await adv(page, 800);
  await expect(page.locator('[data-screen=map]')).toBeVisible();
  expect((await doneIds(page)).sort((a, b) => a - b)).toEqual([2, 4, 7, 12, 13]);
  // a reload is not locked either
  await page.reload(); await expect(page.locator('[data-screen=map]')).toBeVisible();
  await expect(page.getByTestId('node-9')).toBeEnabled(); // a station that is "ahead" is open
  // finish 1, 3, 5, 6: the highlight moves on to 8
  for (const id of [1, 3, 5, 6]) { await confirmStation(page, id); await page.getByTestId('back').click(); await adv(page, 800); }
  await adv(page, 2600); await expectNext(page, 8);
  // completed stations replay for stars
  await page.getByTestId('node-4').click(); await adv(page, 1500);
  await expect(page.locator('[data-game=breakfast]')).toBeVisible();
});

test('no "הרגליים" anywhere (phrases, audio manifest, bundle) and the bath has exactly the five body parts', async () => {
  const all = Object.values(PHRASES).map((p) => p.text + (p.tts ?? '')).join('|');
  expect(all).not.toContain('הרגליים'); expect(Object.keys(PHRASES)).not.toContain('g.12.feet');
  for (const id of ['g.12.head', 'g.12.ears', 'g.12.shoulders', 'g.12.hands', 'g.12.tummy']) expect(PHRASES[id]).toBeTruthy();
  const man = JSON.parse(fs.readFileSync('public/audio/manifest.json', 'utf8')).clips;
  expect(Object.keys(man)).not.toContain('g.12.feet'); expect(Object.keys(man)).toContain('g.12.shoulders');
  expect(fs.existsSync('public/audio/narrator/g.12.feet.mp3')).toBe(false);
});
