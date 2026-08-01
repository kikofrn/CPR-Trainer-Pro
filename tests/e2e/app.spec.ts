import { test, expect } from '@playwright/test';

function setupStrictErrors(page: any, expectedConsoleErrors: string[] = []) {
  const actualErrors: string[] = [];
  
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Only ignore exactly matched expected errors
      const index = expectedConsoleErrors.indexOf(text);
      if (index !== -1) {
        expectedConsoleErrors.splice(index, 1); // consumed
      } else {
        actualErrors.push(`Unexpected console.error: ${text}`);
      }
    }
  });

  page.on('pageerror', (err: any) => {
    actualErrors.push(`Unexpected pageerror: ${err.message}`);
  });

  return {
    verify: () => {
      expect(actualErrors).toEqual([]);
      expect(expectedConsoleErrors).toEqual([]);
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

    const courseLink = page.locator('button', { hasText: 'Adult CPR' }).first();
    await expect(courseLink).toBeVisible();
    await courseLink.click();

    const courseTitle = page.locator('h1', { hasText: 'Adult CPR' });
    await expect(courseTitle).toBeVisible();

    const otherLink = page.locator('button', { hasText: 'Child CPR' }).first();
    await expect(otherLink).toBeVisible();
    await otherLink.click();

    const otherTitle = page.locator('h1', { hasText: 'Child CPR' });
    await expect(otherTitle).toBeVisible();

    errorTracker.verify();
  });

  test('post-boot injected unhandled rejection', async ({ page }) => {
    const errorTracker = setupStrictErrors(page, [
      '[FATAL] Unhandled Promise Rejection: Error: Injected unhandled rejection'
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

    const courseLink = page.locator('button', { hasText: 'Adult CPR' }).first();
    await expect(courseLink).toBeVisible();
    await courseLink.click();

    const courseTitle = page.locator('h1', { hasText: 'Adult CPR' });
    await expect(courseTitle).toBeVisible();

    errorTracker.verify();
  });
});
