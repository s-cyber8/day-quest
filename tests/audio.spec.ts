import { test, expect } from '@playwright/test';
import { adv, newApp, hold, center } from './helpers';

// Pixel 7 project only (fake microphone device): parent recording -> Web Audio path, never an <audio> element.
test('speech goes through Web Audio (parent recording), not HTMLAudioElement; test-sound button reports the path', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __srcStart: number; __audioPlay: number };
    w.__srcStart = 0; w.__audioPlay = 0;
    const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a: []) { w.__srcStart++; return st.apply(this, a); };
    const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { w.__audioPlay++; return pl.call(this); };
  });
  await newApp(page);
  await page.getByTestId('gear').click(); await hold(page, page.getByTestId('hold'));
  await expect(page.getByTestId('parent')).toBeVisible();
  const rec = page.getByTestId('rec-st.2.announce'); await rec.scrollIntoViewIfNeeded();
  await rec.click(); await page.waitForTimeout(1500); await rec.click(); // record ~1.5 s from the fake device, then stop
  await expect(page.getByTestId('play-st.2.announce')).toBeVisible();
  await expect(rec).toHaveText('הקלט מחדש', { timeout: 10000 });
  await page.getByTestId('play-st.2.announce').click();
  await expect.poll(() => page.evaluate(() => document.body.dataset.speech), { timeout: 8000 }).toBe('recording');
  expect(await page.evaluate(() => (window as unknown as { __srcStart: number }).__srcStart)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { __audioPlay: number }).__audioPlay)).toBe(0);
  // test-sound button
  await page.getByTestId('test-sound').scrollIntoViewIfNeeded(); await page.getByTestId('test-sound').click();
  await expect(page.getByTestId('sound-report')).toContainText('speech path used', { timeout: 15000 });
  await expect(page.getByTestId('sound-report')).toContainText('AudioContext');
});

test('balloon breathing uses the microphone when available', async ({ page }) => {
  await newApp(page);
  await page.getByTestId('cloud').click(); await adv(page, 600);
  await page.getByTestId('act-breath').click(); await page.waitForTimeout(500); await adv(page, 800);
  expect(await page.evaluate(() => document.body.dataset.mic)).toBe('mic');
});

test('bundled voice-over plays through Web Audio, including offline, from the precache', async ({ page, context }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __srcStart: number; __audioPlay: number };
    w.__srcStart = 0; w.__audioPlay = 0;
    const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a: []) { w.__srcStart++; return st.apply(this, a); };
    const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { w.__audioPlay++; return pl.call(this); };
  });
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForTimeout(4000); // let the service worker precache the clips
  await page.reload(); await expect(page.locator('[data-screen=map]')).toBeVisible();
  await context.setOffline(true);
  await page.getByTestId('node-1').click();
  await expect.poll(() => page.evaluate(() => document.body.dataset.speech), { timeout: 10000 }).toBe('bundled');
  expect(await page.evaluate(() => (window as unknown as { __srcStart: number }).__srcStart)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { __audioPlay: number }).__audioPlay)).toBe(0);
  await page.screenshot({ path: 'screenshots/pixel7/audio-offline.png' });
  await context.setOffline(false);
});

test('parent mode: original clip button + test sound reports a bundled clip', async ({ page }) => {
  await newApp(page);
  await page.getByTestId('gear').click(); await hold(page, page.getByTestId('hold'));
  await expect(page.getByTestId('parent')).toBeVisible();
  const orig = page.getByTestId('orig-st.2.announce'); await orig.scrollIntoViewIfNeeded(); await orig.click();
  await expect.poll(() => page.evaluate(() => document.body.dataset.speech), { timeout: 10000 }).toBe('bundled');
  await page.getByTestId('test-sound').scrollIntoViewIfNeeded(); await page.getByTestId('test-sound').click();
  await expect(page.getByTestId('sound-report')).toContainText('bundled clip: found', { timeout: 15000 });
  await expect(page.getByTestId('sound-report')).toContainText('speech path used: bundled');
});
