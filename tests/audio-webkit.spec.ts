import { test, expect } from '@playwright/test';
// iPhone profile (WebKit): decodeAudioData must handle the bundled mp3 clips and play them through Web Audio.
test('WebKit: bundled clips decode and play through Web Audio', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __srcStart: number; __audioPlay: number };
    w.__srcStart = 0; w.__audioPlay = 0;
    const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a: []) { w.__srcStart++; return st.apply(this, a); };
    const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { w.__audioPlay++; return pl.call(this); };
  });
  await page.goto('./'); await expect(page.locator('[data-screen=map]')).toBeVisible();
  await page.getByTestId('node-1').click();
  await expect.poll(() => page.evaluate(() => document.body.dataset.speech), { timeout: 12000 }).toBe('bundled');
  expect(await page.evaluate(() => (window as unknown as { __srcStart: number }).__srcStart)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { __audioPlay: number }).__audioPlay)).toBe(0);
});
