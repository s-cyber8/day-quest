import { test, expect, Page } from '@playwright/test';
import { adv, hold, shot } from './helpers';

// Rafael's Stories. Bundled voice-over is blocked so speech takes the (virtual-clock) fallback path and the tests do not wait for real audio.
const SIDS = Array.from({ length: 12 }, (_, i) => `s${String(i + 1).padStart(2, '0')}`);

async function open(page: Page, world: 'stories' | 'day' | '' = 'stories') {
  await page.route('**/audio/**', (r) => r.abort());
  await page.clock.install();
  await page.goto(world ? `./?w=${world}` : './');
  await adv(page, 800);
}
async function until(page: Page, testid: string, max = 90000) {
  const l = page.getByTestId(testid).first();
  for (let t = 0; t < max; t += 250) { if (await l.isVisible().catch(() => false)) return l; await adv(page, 250); }
  throw new Error('timeout waiting for ' + testid);
}
const step = (page: Page) => page.locator('.story').getAttribute('data-step');
async function untilStep(page: Page, s: string, max = 90000) {
  for (let t = 0; t < max; t += 250) { if ((await step(page).catch(() => null)) === s) return; await adv(page, 250); }
  throw new Error(`step ${s} not reached, at ${await step(page).catch(() => '?')}`);
}
async function startStory(page: Page, sid: string) {
  await page.getByTestId('story-' + sid).click(); await untilStep(page, 'situation', 5000);
}
async function feelingCheck(page: Page, key = 'angry', lvl: 'little' | 'lot' = 'little') {
  await (await until(page, 'next')).click();
  await untilStep(page, 'feel', 5000);
  await page.getByTestId('feel-' + key).click(); await adv(page, 400);
  await page.getByTestId('int-' + lvl).click();
}
async function choose(page: Page, kind: 'good' | 'bad' | 'third') {
  await untilStep(page, 'choice');
  await page.getByTestId('choice-' + kind).click(); await adv(page, 300);
  await page.getByTestId('confirm').click();
}
async function toLessonAndFinish(page: Page) {
  await untilStep(page, 'lesson');
  await page.getByTestId('next').click(); await untilStep(page, 'parent', 5000);
  await page.getByTestId('story-finish').click();
  await untilStep(page, 'finished', 5000);
  await expect(page.getByTestId('storypick')).toBeVisible({ timeout: 1000 }).catch(async () => { await adv(page, 20000); await expect(page.getByTestId('storypick')).toBeVisible(); });
}
const plays = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('dq.storylog') || '[]'));
const prog = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('dq.stories') || '{}'));

test('home: two illustrated doors, last-used world is remembered', async ({ page }, info) => {
  await open(page, '');
  await expect(page.getByTestId('door-day')).toBeVisible(); await expect(page.getByTestId('door-stories')).toBeVisible();
  await expect(page.locator('.door.last')).toHaveCount(0);
  await shot(page, info, 'home-1');
  await page.getByTestId('door-stories').click(); await adv(page, 600);
  await expect(page.getByTestId('storypick')).toBeVisible();
  await page.getByTestId('back').click(); await adv(page, 600);
  await expect(page.getByTestId('door-stories')).toHaveClass(/last/);
  await page.getByTestId('door-day').click(); await adv(page, 600);
  await expect(page.locator('[data-screen=map]')).toBeVisible();
  await shot(page, info, 'daymap-1');
  await page.getByTestId('back').click(); await adv(page, 600);
  await expect(page.getByTestId('door-day')).toHaveClass(/last/);
  // all 13 stations are on the illustrated map and stay inside it
  await page.getByTestId('door-day').click(); await adv(page, 600);
  for (let i = 1; i <= 13; i++) await expect(page.getByTestId('node-' + i)).toHaveCount(1);
});

test('picker: 12 cards with the situation picture; Moka intro only the first time', async ({ page }, info) => {
  await open(page);
  await expect(page.locator('.scard')).toHaveCount(12);
  await expect(page.getByTestId('pick-line')).toContainText('אני מוקה');
  await shot(page, info, 'stories-picker');
  await page.reload(); await adv(page, 800);
  await expect(page.getByTestId('pick-line')).toContainText('איזה סיפור');
});

for (const sid of SIDS) {
  test(`${sid}: good path, sticker + golden heart on the card`, async ({ page }) => {
    await open(page);
    await startStory(page, sid);
    await feelingCheck(page, 'happy', 'little');
    await choose(page, 'good');
    if (sid === 's10') { await runBreathIfShown(page); }
    await untilStep(page, 'outcome-good');
    await expect(page.locator('.story .meter')).toHaveAttribute('data-hearts', '3');
    await toLessonAndFinish(page);
    await expect(page.getByTestId('sticker-' + sid)).toBeVisible();
    await expect(page.getByTestId('golden-' + sid)).toBeVisible();
    const l = await plays(page);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ story: sid, feeling: 'happy', intensity: 'little', choice: 'good', good: true, repaired: false, rewinds: 0, finished: true });
    expect((await prog(page))[sid]).toMatchObject({ done: true, golden: true, bestHearts: 3 });
  });
}

async function runBreathIfShown(page: Page) {
  // s10 good choice: one real calm-corner breath comes first (microphone balloon where available, otherwise hold-to-breathe)
  const cb = page.getByTestId('calm-breath');
  for (let t = 0; t < 60000; t += 250) {
    if (await cb.isVisible().catch(() => false)) break;
    if ((await step(page).catch(() => '')) === 'outcome-good') return;
    await adv(page, 250);
  }
  if (!(await cb.isVisible().catch(() => false))) return;
  const holdArea = page.getByTestId('breathhold');
  for (let t = 0; t < 16000 && !(await holdArea.count()); t += 250) await adv(page, 250); // no microphone: the hold-to-breathe fallback appears after the mic request gives up
  if (await holdArea.count()) {
    const b = (await holdArea.boundingBox())!; await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await adv(page, 4600); await page.mouse.up(); await adv(page, 5000);
  }
  for (let t = 0; t < 40000; t += 250) { if (!(await cb.isVisible().catch(() => false))) break; await adv(page, 250); }
  await expect(cb).toHaveCount(0);
  await untilStep(page, 'outcome-good');
}

test('s10 good choice runs one real calm-corner breath before its outcome', async ({ page }) => {
  await open(page);
  await startStory(page, 's10');
  await feelingCheck(page, 'angry', 'little');
  await choose(page, 'good');
  const cb = page.getByTestId('calm-breath');
  for (let t = 0; t < 30000 && !(await cb.isVisible().catch(() => false)); t += 250) await adv(page, 250);
  await expect(cb).toBeVisible();
  expect(await step(page)).not.toBe('outcome-good');
  await runBreathIfShown(page);
  await expect(page.locator('.story[data-step=outcome-good]')).toBeVisible();
});

test('bad choice: calm muted outcome, heart dims, repair restores it and ends well', async ({ page }, info) => {
  await open(page);
  await startStory(page, 's03');
  await feelingCheck(page, 'angry', 'little');
  await expect(page.locator('.story .meter')).toHaveAttribute('data-hearts', '2');
  await choose(page, 'bad');
  await untilStep(page, 'outcome-bad');
  await expect(page.locator('.story .sfig.muted')).toHaveCount(1);       // desaturated, no Ken Burns
  await expect(page.locator('.story .confetti')).toHaveCount(0);          // no celebration
  await expect(page.locator('.story .meter')).toHaveAttribute('data-hearts', '1');
  await shot(page, info, 'story-bad-outcome');
  await untilStep(page, 'repair-ask');
  await expect(page.getByTestId('repair-fix')).toBeVisible(); await expect(page.getByTestId('repair-rewind')).toBeVisible();
  await shot(page, info, 'story-repair-ask');
  await page.getByTestId('repair-fix').click();
  await untilStep(page, 'repaired');
  await expect(page.locator('.story .meter')).toHaveAttribute('data-hearts', '2');
  await shot(page, info, 'story-repaired');
  await toLessonAndFinish(page);
  await expect(page.getByTestId('golden-s03')).toHaveCount(0);            // first choice was not good
  const l = await plays(page);
  expect(l[0]).toMatchObject({ choice: 'bad', good: false, repaired: true, rewinds: 0, finished: true });
  expect((await prog(page)).s03.done).toBe(true);
});

test('bad choice -> go back and choose differently; a good ending is always reachable', async ({ page }) => {
  await open(page);
  await startStory(page, 's05');
  await feelingCheck(page, 'happy', 'little');
  await choose(page, 'bad');
  await untilStep(page, 'repair-ask');
  await page.getByTestId('repair-rewind').click();
  await untilStep(page, 'choice');
  await expect(page.locator('.story .meter')).toHaveAttribute('data-hearts', '2'); // nothing lost by going back
  await choose(page, 'good');
  await untilStep(page, 'outcome-good');
  await toLessonAndFinish(page);
  const l = await plays(page);
  expect(l[0]).toMatchObject({ choice: 'bad', rewinds: 1, repaired: false, finished: true });
  await expect(page.getByTestId('golden-s05')).toHaveCount(0);
});

test('big feeling (angry/sad/scared + a lot): guided 3-breath circle before choosing; not for a little or other feelings', async ({ page }, info) => {
  await open(page);
  await startStory(page, 's03');
  await feelingCheck(page, 'angry', 'lot');
  await untilStep(page, 'breath', 30000);
  await until(page, 'guided-ring', 30000);
  await shot(page, info, 'story-breath');
  await untilStep(page, 'choice', 60000);
  await page.getByTestId('back').click(); await adv(page, 800);
  await expect(page.getByTestId('storypick')).toBeVisible();
  for (const [k, l] of [['sad', 'lot'], ['scared', 'lot']] as const) {
    await startStory(page, 's04'); await feelingCheck(page, k, l); await untilStep(page, 'breath', 30000); await page.getByTestId('back').click(); await adv(page, 600);
  }
  for (const [k, l] of [['angry', 'little'], ['happy', 'lot'], ['disappointed', 'lot'], ['calm', 'lot']] as const) {
    await startStory(page, 's01'); await feelingCheck(page, k, l);
    await untilStep(page, 'choice', 30000);
    await page.getByTestId('back').click(); await adv(page, 600);
  }
});

test('every feeling is accepted with its matching Moka line', async ({ page }) => {
  await open(page);
  const seen: string[] = [];
  for (const k of ['happy', 'angry', 'sad', 'scared', 'disappointed', 'calm']) {
    await startStory(page, 's08');
    await (await until(page, 'next')).click(); await untilStep(page, 'feel', 5000);
    await page.getByTestId('feel-' + k).click(); await adv(page, 300);
    await page.getByTestId('int-little').click();
    await until(page, 'sline');
    for (let t = 0; t < 8000; t += 250) { await adv(page, 250); const tx = await page.getByTestId('sline').textContent(); if (tx && /בסדר|יופי|רגוע|מאכזב/.test(tx)) { seen.push(k + ':' + tx); break; } }
    await untilStep(page, 'choice', 30000);
    await page.getByTestId('back').click(); await adv(page, 500);
  }
  expect(seen).toHaveLength(6);
  expect(seen.find((s) => s.startsWith('angry'))).toContain('זה בסדר להרגיש כועס');
  expect(seen.find((s) => s.startsWith('calm'))).toContain('אתה רגוע');
});

test('choice cards: first tap selects and plays, second tap or the button confirms; order is randomized', async ({ page }) => {
  await open(page);
  const orders = new Set<string>();
  for (let i = 0; i < 8; i++) {
    await startStory(page, 's01'); await feelingCheck(page, 'happy', 'little'); await untilStep(page, 'choice');
    orders.add((await page.locator('.ccard').evaluateAll((c) => c.map((x) => (x as HTMLElement).dataset.kind).join(','))));
    await page.getByTestId('back').click(); await adv(page, 500);
  }
  expect(orders.size).toBeGreaterThan(1);
  await startStory(page, 's01'); await feelingCheck(page, 'happy', 'little'); await untilStep(page, 'choice');
  await expect(page.getByTestId('confirm')).toBeHidden();
  await page.getByTestId('choice-good').click(); await adv(page, 300);
  expect(await step(page)).toBe('choice');                     // one tap does not commit
  await expect(page.getByTestId('confirm')).toBeVisible();
  await page.getByTestId('choice-bad').click(); await adv(page, 300);  // switching is allowed
  await expect(page.getByTestId('choice-bad')).toHaveClass(/sel/);
  await page.getByTestId('choice-bad').click();                // second tap on the selected card confirms
  await untilStep(page, 'outcome-bad');
});

test('s02: the third option (ignoring) is a bad choice with its own outcome, then the repair flow', async ({ page }) => {
  await open(page);
  await startStory(page, 's02'); await feelingCheck(page, 'disappointed', 'little');
  await untilStep(page, 'choice');
  await expect(page.locator('.ccard')).toHaveCount(3);
  await expect(page.getByTestId('choice-third')).toHaveAttribute('data-good', '0');
  await page.getByTestId('choice-third').click(); await adv(page, 300); await page.getByTestId('confirm').click();
  await untilStep(page, 'outcome-bad');
  await expect(page.locator('.story .sfig.muted img')).toHaveAttribute('src', /s02-8-third-out/);
  await untilStep(page, 'repair-ask'); await page.getByTestId('repair-fix').click(); await untilStep(page, 'repaired');
  await toLessonAndFinish(page);
  expect((await plays(page))[0]).toMatchObject({ choice: 'third', third: 'ignore', good: false, repaired: true });
});

test('s10: the third option (saying the feeling in words) is good and needs no breath', async ({ page }) => {
  await open(page);
  await startStory(page, 's10'); await feelingCheck(page, 'angry', 'little');
  await untilStep(page, 'choice');
  await expect(page.getByTestId('choice-third')).toHaveAttribute('data-good', '1');
  await page.getByTestId('choice-third').click(); await adv(page, 300); await page.getByTestId('confirm').click();
  await untilStep(page, 'outcome-good', 20000);
  await expect(page.getByTestId('calm-breath')).toHaveCount(0);
  await expect(page.locator('.story .sfig img')).toHaveAttribute('src', /s10-8-third-out/);
  await toLessonAndFinish(page);
  expect((await plays(page))[0]).toMatchObject({ choice: 'third', third: 'words', good: true });
  await expect(page.getByTestId('golden-s10')).toBeVisible();
});

test('parent card: question as text with a play button; finishing gives a sticker and the book shows it', async ({ page }) => {
  await open(page);
  await startStory(page, 's07'); await feelingCheck(page, 'happy', 'little'); await choose(page, 'good'); await untilStep(page, 'lesson');
  await page.getByTestId('next').click(); await untilStep(page, 'parent', 5000);
  await expect(page.getByTestId('pcard')).toContainText('שאלה להורה');
  await expect(page.getByTestId('pcard')).toContainText('מה יעזור לך לעצור משחק');
  await expect(page.getByTestId('parent-play')).toBeVisible();
  await page.getByTestId('parent-play').click(); await adv(page, 500);
  await page.getByTestId('story-finish').click(); await until(page, 'storypick', 30000);
  await expect(page.getByTestId('sticker-s07')).toBeVisible();
  await page.getByTestId('back').click(); await adv(page, 600);
  await page.getByTestId('book').click(); await adv(page, 600);
  await expect(page.getByTestId('story-stickers').locator('[data-done="1"]')).toHaveCount(1);
});

test('parent mode: What we are learning (patterns, last 5 per story, disclaimer, copy summary)', async ({ page }, info) => {
  await open(page, '');
  // seed: s10 played 4 times, angry-a-lot in 3; s03 twice bad; some improvement in s01
  await page.evaluate(() => {
    const now = Date.now(); const mk = (i: number, story: string, feeling: string, intensity: string, choice: string, good: boolean, extra: object = {}) => ({ id: 'x' + i, t: now - (50 - i) * 3600e3, story, feeling, intensity, choice, good, repaired: false, rewinds: 0, ms: 4000 + i * 100, finished: true, ...extra });
    const l = [
      mk(1, 's10', 'angry', 'lot', 'bad', false, { repaired: true }), mk(2, 's10', 'angry', 'lot', 'bad', false), mk(3, 's10', 'sad', 'little', 'good', true), mk(4, 's10', 'angry', 'lot', 'third', true, { third: 'words' }),
      mk(5, 's03', 'angry', 'lot', 'bad', false), mk(6, 's03', 'angry', 'little', 'bad', false, { repaired: true }),
      mk(7, 's01', 'sad', 'little', 'bad', false), mk(8, 's01', 'sad', 'little', 'bad', false), mk(9, 's01', 'happy', 'little', 'good', true), mk(10, 's01', 'calm', 'little', 'good', true),
    ];
    localStorage.setItem('dq.storylog', JSON.stringify(l));
  });
  await page.reload(); await adv(page, 800);
  await page.getByTestId('gear').click(); await adv(page, 400);
  await hold(page, page.getByTestId('hold')); await adv(page, 600);
  await expect(page.getByTestId('parent')).toBeVisible();
  await page.getByTestId('open-insights').click(); await adv(page, 400);
  await expect(page.getByTestId('insights')).toBeVisible();
  await expect(page.getByTestId('disclaimer')).toHaveText('אלה בחירות במשחק, לא אבחון. כדאי לשוחח עליהן עם רפאל, ואם יש מטפלת – לשתף אותה.');
  const pats = await page.getByTestId('pattern').allTextContents();
  expect(pats).toContain('כשאומרים לו לא (סיפור 10): ב-3 מתוך 4 פעמים בחר כועס-הרבה');
  expect(pats.some((p) => p.startsWith('כעס גדול או פחד גדול'))).toBe(true);
  expect(pats.some((p) => p.includes('סיפור 3') && p.includes('בחירה הלא טובה'))).toBe(true);
  expect(pats.some((p) => p.startsWith('שיפור') && p.includes('סיפור 1'))).toBe(true);
  await expect(page.getByTestId('story-log-s10').locator('.prow')).toHaveCount(4);
  await expect(page.getByTestId('story-log-s10').locator('.prow.hot').first()).toBeVisible();
  await shot(page, info, 'parent-insights');
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { (window as unknown as { __copied: string }).__copied = t; } }, configurable: true }); });
  await page.getByTestId('copy-summary').click(); await adv(page, 300);
  await expect(page.getByTestId('copy-status')).toHaveText('הסיכום הועתק');
  const copied = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
  expect(copied).toContain('אלה בחירות במשחק, לא אבחון'); expect(copied).toContain('סיפור 10');
});

test('stories never touch the day: no stars or stickers removed, day state unchanged', async ({ page }) => {
  await open(page, 'day');
  const before = await page.evaluate(() => localStorage.getItem('dq.day'));
  await page.getByTestId('back').click(); await adv(page, 500);
  await page.getByTestId('door-stories').click(); await adv(page, 500);
  await startStory(page, 's09'); await feelingCheck(page, 'happy', 'little'); await choose(page, 'bad'); await untilStep(page, 'repair-ask'); await page.getByTestId('repair-fix').click(); await untilStep(page, 'repaired');
  await toLessonAndFinish(page);
  expect(await page.evaluate(() => localStorage.getItem('dq.day'))).toBe(before);
});

test('no SVG Moka left: every Moka on every screen is a 3D sprite image', async ({ page }) => {
  await open(page, 'day');
  const check = async (label: string) => {
    const r = await page.evaluate(() => [...document.querySelectorAll('.moka')].map((m) => ({ svg: m.querySelectorAll('svg').length, img: (m.querySelector('img') as HTMLImageElement | null)?.src ?? '', ok: ((m.querySelector('img') as HTMLImageElement | null)?.naturalWidth ?? 0) > 50 })));
    for (const m of r) { expect(m.svg, label).toBe(0); expect(m.img, label).toMatch(/assets\/moka\/(idle|happy|concerned|sleepy|walk|jump)\.png$/); }
    return r.length;
  };
  expect(await check('map')).toBeGreaterThan(0);
  await page.getByTestId('node-1').click(); await adv(page, 800); expect(await check('announce')).toBe(0);
  await page.getByTestId('go').click(); await adv(page, 800); expect(await check('godo')).toBeGreaterThan(0);
  await page.getByTestId('cloud').click(); await adv(page, 800); expect(await check('calm')).toBeGreaterThan(0);
  await page.getByTestId('act-pet').click(); await adv(page, 800); expect(await check('pet')).toBeGreaterThan(1);
  await page.getByTestId('back').click(); await adv(page, 500);
  await page.goto('./?w=stories'); await adv(page, 800); expect(await check('picker')).toBeGreaterThan(0);
  await startStory(page, 's01'); expect(await check('story')).toBeGreaterThanOrEqual(0);
});

test('offline: home, stories, scene pictures and Moka sprites come from the precache', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit cannot emulate offline with service workers; verified on Chromium + live URL');
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(async () => !!(await caches.match(new URL('assets/stories/scenes/s12-6-repair.webp', document.baseURI).href)) && !!(await caches.match(new URL('assets/moka/jump.png', document.baseURI).href)), null, { timeout: 60000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('door-stories')).toBeVisible();
  await page.getByTestId('door-stories').click();
  await expect(page.locator('.scard')).toHaveCount(12);
  await page.waitForFunction(() => [...document.querySelectorAll('.scard img.pic')].every((i) => (i as HTMLImageElement).naturalWidth > 300), null, { timeout: 15000 });
  await page.getByTestId('story-s12').click();
  await expect(page.locator('.story[data-step=situation]')).toBeVisible();
  await context.setOffline(false);
});
