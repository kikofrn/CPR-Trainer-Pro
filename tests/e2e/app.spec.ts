import { test, expect } from '@playwright/test';

function setupStrictErrors(page: any, expectedErrors: string[] = []) {
  const actualErrors: string[] = [];
  
  const checkAndConsumeExpected = (text: string) => {
    const index = expectedErrors.findIndex(expected => text.includes(expected));
    if (index !== -1) {
      expectedErrors.splice(index, 1);
      return true;
    }
    return false;
  };

  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!checkAndConsumeExpected(text)) {
        actualErrors.push(`Unexpected console.error: ${text}`);
      }
    }
  });

  page.on('pageerror', (err: any) => {
    const text = err.message || err.toString();
    if (!checkAndConsumeExpected(text)) {
      actualErrors.push(`Unexpected pageerror: ${text}`);
    }
  });

  return {
    verify: () => {
      expect(actualErrors).toEqual([]);
      expect(expectedErrors).toEqual([]);
    }
  };
}

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

    await page.goto('/');

    await page.waitForSelector('[data-app-ready="true"]');
    await page.evaluate(() => document.fonts.ready);

    const cprDropdown = page.locator('button', { hasText: 'CPR & AED' }).first();
    await expect(cprDropdown).toBeVisible();
    await cprDropdown.click();

    // Wait for the dropdown animation to finish
    await page.waitForTimeout(1000);

    // Enable Virtual Assistant to launch Video Player
    const vaToggle = page.locator('span', { hasText: 'Enable Virtual Assistant?' }).locator('..').locator('button');
    await expect(vaToggle).toBeVisible();
    await vaToggle.click();
    await page.waitForTimeout(1000); // Wait for state update

    const startCprCourse = page.locator('button', { hasText: 'START COURSE' }).first();
    await expect(startCprCourse).toBeVisible();
    await startCprCourse.click();

    // Verify media playback starts by getting the main video (excluding UI elements)
    const video = page.locator('video:not([src*="CPR-Dummies"]):not([src*="WakeUp"])').first();
    await video.waitFor({ state: 'attached' });
    
    // Play video
    await video.evaluate((vid: HTMLVideoElement) => vid.play());
    
    // Wait for currentTime to advance > 0
    await expect(async () => {
      const currentTime = await video.evaluate((vid: HTMLVideoElement) => vid.currentTime);
      expect(currentTime).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });

    const faDropdown = page.locator('button', { hasText: 'FIRST AID' }).first();
    await expect(faDropdown).toBeVisible();
    await faDropdown.click({ force: true });

    const startFaCourse = page.locator('button', { hasText: 'START COURSE' }).first();
    await expect(startFaCourse).toBeVisible();

    errorTracker.verify();
  });

  test('post-boot injected unhandled rejection', async ({ page }) => {
    const errorTracker = setupStrictErrors(page, [
      'Injected unhandled rejection',
      'Injected unhandled rejection'
    ]);

    await page.goto('/');
    await page.waitForSelector('[data-app-ready="true"]');
    
    // Inject unhandled rejection
    await page.evaluate(() => {
      setTimeout(() => {
        Promise.reject(new Error('Injected unhandled rejection'));
      }, 0);
    });
    
    await page.waitForTimeout(500);

    const cprDropdown = page.locator('button', { hasText: 'CPR & AED' }).first();
    await expect(cprDropdown).toBeVisible();
    await cprDropdown.click({ force: true });

    const startCprCourse = page.locator('button', { hasText: 'START COURSE' }).first();
    await expect(startCprCourse).toBeVisible();
    await startCprCourse.click({ force: true });

    errorTracker.verify();
  });
});
