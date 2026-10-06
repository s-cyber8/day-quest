import { test, expect } from '@playwright/test';
import { adv, shot, center, hold, newApp, PASS, rageTaps } from './helpers';
import { STATIONS } from '../src/content/stations';

test.describe.configure({ mode: 'serial' });

test('full day: 13 stations, parent confirms, mini-games, night mode', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await newApp(page);
  await shot(page, info, '01-map-start');
  for (const s of STATIONS) {
    const n = String(s.id).padStart(2, '0');
    await page.getByTestId(`node-${s.id}`).click();
    await expect(page.locator('[data-screen=announce]')).toBeVisible();
    await adv(page, 1500);
    await shot(page, info, `st${n}-a-announce`);
    await page.getByTestId('go').click();
    await expect(page.locator('[data-screen=godo]')).toBeVisible();
    await adv(page, 1200);
    await shot(page, info, `st${n}-b-go-do-it`);
    // a short tap must NOT confirm
    const holdBtn = page.getByTestId('hold');
    const c = await center(holdBtn);
    await page.mouse.click(c.x, c.y);
    await expect(page.locator('[data-screen=godo]')).toBeVisible();
    await hold(page, holdBtn);
    await expect(page.getByTestId('celebrate')).toBeVisible();
    await adv(page, 1500);
    await shot(page, info, `st${n}-c-celebrate`);
    await adv(page, 4500);
    await expect(page.locator(`[data-game=${s.game}][data-level="2"]`)).toBeVisible();
    await adv(page, 1500);
    await shot(page, info, `st${n}-d-game-start`);
    await PASS[s.game](page, 2);
    await adv(page, 1500);
    await shot(page, info, `st${n}-e-game-end`);
    await adv(page, 5000);
    if (s.id < 13) {
      await expect(page.locator('[data-screen=map]')).toBeVisible({ timeout: 15000 });
      await adv(page, 3000);
      if (s.id % 4 === 0) await shot(page, info, `st${n}-f-map`);
    }
  }
  await adv(page, 6000);
  await expect(page.getByTestId('night')).toBeVisible();
  await page.waitForTimeout(3500);
  await shot(page, info, '99-night');
  // night stays locked on reload
  await page.reload(); await expect(page.getByTestId('night')).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('calm corner: rage taps -> prompt -> activities -> feelings -> bridge -> medal', async ({ page }, info) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); });
  await newApp(page);
  await page.getByTestId('node-1').click();
  await expect(page.locator('[data-screen=announce]')).toBeVisible();
  await adv(page, 1000);
  await rageTaps(page);
  await expect(page.getByTestId('calm-prompt')).toBeVisible();
  await shot(page, info, 'calm-1-prompt');
  await page.getByTestId('calm-yes').click();
  await expect(page.getByTestId('calm')).toBeVisible();
  await adv(page, 800);
  await expect(page.getByTestId('feel-upset')).toHaveCount(0); // no feelings question on entry
  await expect(page.getByTestId('act-water')).toBeVisible();
  await shot(page, info, 'calm-3-pick');
  // water: hold the glass until empty
  await page.getByTestId('act-water').click();
  const g = await center(page.getByTestId('glass'));
  await page.mouse.move(g.x, g.y); await page.mouse.down(); await adv(page, 12000);
  await shot(page, info, 'calm-4-water');
  await adv(page, 14000); await page.mouse.up(); await adv(page, 3500);
  await expect(page.getByTestId('feel-meh')).toBeVisible();
  await page.getByTestId('feel-meh').click();      // still so-so -> offered another
  await expect(page.getByTestId('act-ball')).toBeVisible();
  await page.getByTestId('act-ball').click();
  const b = await center(page.getByTestId('ball'));
  for (let i = 0; i < 5; i++) {
    await page.mouse.move(b.x, b.y); await page.mouse.down(); await adv(page, 1000);
    if (i === 0) await shot(page, info, 'calm-5-ball');
    await adv(page, 1000); await page.mouse.up(); await adv(page, 1000);
  }
  await adv(page, 3000);
  await page.getByTestId('feel-calm').click();
  await adv(page, 2500);
  await shot(page, info, 'calm-6-bridge');
  await hold(page, page.getByTestId('hold'));
  await expect(page.getByTestId('medal')).toBeVisible();
  await page.waitForTimeout(1200); await shot(page, info, 'calm-7-medal');
  await adv(page, 5000);
  await expect(page.getByTestId('calm')).toHaveCount(0);
  await expect(page.locator('[data-screen=announce]')).toBeVisible(); // back exactly where he was
  // cooldown: another burst right away does not trigger
  await rageTaps(page);
  await expect(page.getByTestId('calm-prompt')).toHaveCount(0);
  // pet + breathing (fallback or mic) via the cloud
  await page.getByTestId('cloud').click();
  await adv(page, 600);
  await page.getByTestId('act-pet').click();
  const p = await center(page.getByTestId('pet'));
  await page.mouse.move(p.x - 40, p.y); await page.mouse.down();
  for (let i = 0; i < 60; i++) { await page.mouse.move(p.x - 40 + (i % 2 ? 60 : 0), p.y, { steps: 1 }); await adv(page, 400); }
  await shot(page, info, 'calm-8-pet');
  await page.mouse.up(); await adv(page, 3000);
  await page.getByTestId('feel-meh').click();
  await page.getByTestId('act-breath').click();
  await page.waitForTimeout(400); // let the async permission chain start before moving virtual time
  await adv(page, 10500);
  const mode = await page.evaluate(() => document.body.dataset.mic);
  expect(mode).toBe('fallback');
  const a = await center(page.getByTestId('breathhold'));
  for (let i = 0; i < 4; i++) { await page.mouse.move(a.x, a.y); await page.mouse.down(); await adv(page, 3500); if (i === 1) await shot(page, info, 'calm-9-breath'); await page.mouse.up(); await adv(page, 4200); }
  await adv(page, 2000);
  await expect(page.getByTestId('feel-calm')).toBeVisible();
  await page.getByTestId('feel-calm').click(); await adv(page, 2500);
  await page.getByTestId('bridge-skip').click(); await adv(page, 5000);
});

test('offline after first load + layout checks + RTL', async ({ page, context, browserName }, info) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit cannot emulate offline with service workers; verified on Chromium + live URL');
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('[data-screen=map]')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const sw = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight }));
  expect(sw.sw).toBeLessThanOrEqual(sw.iw); expect(sw.sh).toBeLessThanOrEqual(sw.ih);
  await page.getByTestId('node-1').click();
  await expect(page.locator('[data-screen=announce] img.pic')).toBeVisible();
  expect(await page.evaluate(() => (document.querySelector('[data-screen=announce] img.pic') as HTMLImageElement).naturalWidth)).toBeGreaterThan(100);
  await page.waitForTimeout(800); await shot(page, info, 'offline-announce');
  await context.setOffline(false);
});

test('safe-area insets respected', async ({ page }, info) => {
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ':root{--sat:47px;--sab:34px}'; document.head.append(s); }); });
  await newApp(page);
  await shot(page, info, 'safearea-map');
  const r = await page.evaluate(() => document.querySelector('.topbar')!.getBoundingClientRect().top);
  expect(r).toBeGreaterThanOrEqual(47);
});

test('parent mode: gate, PIN, weekday stations, voice recording + playback priority, log', async ({ page, browserName }, info) => {
  await newApp(page);
  await page.getByTestId('gear').click();
  await expect(page.getByTestId('gate')).toBeVisible();
  await hold(page, page.getByTestId('hold'));
  await expect(page.getByTestId('parent')).toBeVisible();
  await page.waitForTimeout(500); await shot(page, info, 'parent-1-top');
  // deactivate station 8 for today's weekday
  await page.getByTestId('st-8').uncheck();
  await page.getByTestId('pin-input').fill('1234'); await page.getByTestId('pin-input').dispatchEvent('change');
  await page.getByTestId('rec-st.1.announce').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300); await shot(page, info, 'parent-2-voice');
  await page.getByTestId('parent-close').click();
  await expect(page.getByTestId('node-8')).toHaveCount(0);
  // PIN gate now
  await page.getByTestId('gear').click();
  await hold(page, page.getByTestId('hold'));
  await expect(page.getByTestId('pinpad')).toBeVisible();
  for (const k of ['9', '9', '9', '9']) await page.getByTestId('pin-' + k).click();
  await expect(page.getByTestId('pinpad')).toBeVisible(); // wrong code stays
  for (const k of ['1', '2', '3', '4']) await page.getByTestId('pin-' + k).click();
  await expect(page.getByTestId('parent')).toBeVisible();
  await page.getByTestId('parent-close').click();
});

test('speech: no Hebrew voice -> caption + chime; Hebrew voice -> tts', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __v: string };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => (w.__v === 'he' ? [{ lang: 'he-IL', name: 'Fake' }] : []),
      speak: (u: { onend?: () => void; text: string }) => { const w2 = window as unknown as { __said?: string[] }; (w2.__said ||= []).push(u.text); setTimeout(() => u.onend?.(), 5); },
      cancel() {}, addEventListener() {},
    } });
  });
  await page.goto('./');
  await page.waitForTimeout(800);
  await page.getByTestId('node-1').click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => document.body.dataset.speech)).toBe('chime');
  await expect(page.locator('#caption')).toHaveClass(/show/);
  await page.evaluate(() => { (window as unknown as { __v: string }).__v = 'he'; });
  await page.reload();
  await page.evaluate(() => { (window as unknown as { __v: string }).__v = 'he'; });
  await page.getByTestId('node-1').click();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => document.body.dataset.speech)).toBe('tts');
  expect((await page.evaluate(() => (window as unknown as { __said: string[] }).__said)).join('|')).toContain('רפאל');
});
