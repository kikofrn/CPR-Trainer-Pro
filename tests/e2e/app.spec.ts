import { test, expect } from '@playwright/test';

import { setupStrictErrors } from './helpers/strict-errors';

test.describe('App Integration', () => {
  test('boot with poisoned storage', async ({ page }) => {
    const errorTracker = setupStrictErrors(page, []);

    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('Poisoned storage') };
      Storage.prototype.setItem = () => { throw new Error('Poisoned storage') };
      Storage.prototype.removeItem = () => { throw new Error('Poisoned storage') };
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('[data-app-ready="true"]');
    await page.evaluate(() => document.fonts.ready);

    const cprDropdown = page.locator('button', { hasText: 'CPR & AED' }).first();
    await expect(cprDropdown).toBeVisible();
    await cprDropdown.click();

    const vaToggle = page.locator('span', { hasText: 'Enable Virtual Assistant?' }).locator('..').locator('button');
    await expect(vaToggle).toBeVisible();
    await vaToggle.click();

    const startCprCourse = page.locator('button', { hasText: 'START COURSE' }).first();
    await expect(startCprCourse).toBeVisible();
    await startCprCourse.click();

    const video = page.locator('video:not([src*="CPR-Dummies"]):not([src*="WakeUp"])').first();
    await video.waitFor({ state: 'attached' });

    const isPaused = await video.evaluate((vid: HTMLVideoElement) => vid.paused);
    if (isPaused) {
      const playBtn = page.locator('button[title="Play Narration"]').first();
      await expect(playBtn).toBeVisible();
      await playBtn.click();
    }

    await expect(async () => {
      const isActuallyPaused = await video.evaluate((vid: HTMLVideoElement) => vid.paused);
      expect(isActuallyPaused).toBe(false);
      const currentTime = await video.evaluate((vid: HTMLVideoElement) => vid.currentTime);
      expect(currentTime).toBeGreaterThan(0);
    }).toPass({ timeout: 20000 });

    const faDropdown = page.locator('button', { hasText: 'FIRST AID' }).first();
    await expect(faDropdown).toBeVisible();
    await expect(faDropdown).toBeEnabled();
    await faDropdown.click();

    const startFaCourse = page.locator('button', { hasText: 'START COURSE' }).first();
    await expect(startFaCourse).toBeVisible();

    errorTracker.verify();
  });

  test('post-boot injected unhandled rejection', async ({ page }) => {
    const expectedErrors = [
      { channel: 'console' as const, message: '[FATAL] Unhandled Promise Rejection: Error: Injected unhandled rejection', pathname: '/', count: 1 },
      { channel: 'pageerror' as const, message: 'Injected unhandled rejection', pathname: '/', count: 1 }
    ];
    const errorTracker = setupStrictErrors(page, expectedErrors);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-app-ready="true"]');

    const mainScriptUrl = await page.evaluate(() => {
      const script = document.querySelector('script[src*="/assets/main-"]');
      return script ? new URL((script as HTMLScriptElement).src).pathname : '/';
    });
    expectedErrors[0].pathname = mainScriptUrl;

    const expectedConsoleEvent = page.waitForEvent('console', {
      predicate: message =>
        message.type() === 'error' &&
        message.text().split('\n')[0] === '[FATAL] Unhandled Promise Rejection: Error: Injected unhandled rejection',
      timeout: 15000,
    });
    const expectedPageError = page.waitForEvent('pageerror', {
      predicate: error => error.message === 'Injected unhandled rejection',
      timeout: 15000,
    });

    await page.evaluate(() => {
      setTimeout(() => {
        Promise.reject(new Error('Injected unhandled rejection'));
      }, 0);
    });

    await Promise.all([expectedConsoleEvent, expectedPageError]);

    await expect(page.locator('h2', { hasText: 'App Stopped' })).toHaveCount(0);
    await expect(page.locator('text=FATAL:')).toHaveCount(0);
    await expect(page.locator('text=Unhandled Promise Rejection')).toHaveCount(0);

    const cprDropdown = page.locator('button', { hasText: 'CPR & AED' }).first();
    await expect(cprDropdown).toBeVisible();
    await expect(cprDropdown).toBeEnabled();
    await cprDropdown.click();

    const startCprCourse = page.locator('button', { hasText: 'START COURSE' }).first();
    await expect(startCprCourse).toBeVisible();
    await expect(startCprCourse).toBeEnabled();
    await startCprCourse.click();

    errorTracker.verify();
  });
});
