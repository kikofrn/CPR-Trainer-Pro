import { test, expect } from '@playwright/test';

import { setupStrictErrors } from './helpers/strict-errors';

test.describe('App Integration', () => {
  test('boot with poisoned storage', async ({ page }) => {
    // The safeStorage catches the error but we might log a warning or it might be silent.
    // If there are expected console errors, list them here. safeStorage doesn't console.error on poisoned storage, it returns default.
    const errorTracker = setupStrictErrors(page, []);

    // Poison storage BEFORE page load
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

    // Wait for the VA toggle to be visible, it appears after the dropdown animation
    const vaToggle = page.locator('span', { hasText: 'Enable Virtual Assistant?' }).locator('..').locator('button');
    await expect(vaToggle).toBeVisible();
    await vaToggle.click();

    const startCprCourse = page.locator('button', { hasText: 'START COURSE' }).first();
    await expect(startCprCourse).toBeVisible();
    await startCprCourse.click();

    // Verify media playback starts by getting the main video (excluding UI elements)
    const video = page.locator('video:not([src*="CPR-Dummies"]):not([src*="WakeUp"])').first();
    await video.waitFor({ state: 'attached' });

    // Play video naturally via UI if not autoplaying
    const isPaused = await video.evaluate((vid: HTMLVideoElement) => vid.paused);
    if (isPaused) {
      // Click the custom player's center play button overlay or control bar play button
      const playBtn = page.locator('button[title="Play Narration"]').first();
      await expect(playBtn).toBeVisible();
      await playBtn.click();
    }

    // Wait for currentTime to advance > 0 and assert it's playing
    await expect(async () => {
      const isActuallyPaused = await video.evaluate((vid: HTMLVideoElement) => vid.paused);
      expect(isActuallyPaused).toBe(false);
      const currentTime = await video.evaluate((vid: HTMLVideoElement) => vid.currentTime);
      expect(currentTime).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });

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

    // Update the pathname for the console error to match the built main.js chunk
    const mainScriptUrl = await page.evaluate(() => {
      const script = document.querySelector('script[src*="/assets/main-"]');
      return script ? new URL((script as HTMLScriptElement).src).pathname : '/';
    });
    expectedErrors[0].pathname = mainScriptUrl;

    // Inject unhandled rejection
    await page.evaluate(() => {
      setTimeout(() => {
        Promise.reject(new Error('Injected unhandled rejection'));
      }, 0);
    });

    // Assert that neither fatal fallback is present.
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
