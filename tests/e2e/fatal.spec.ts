import { test, expect } from '@playwright/test';
import { setupStrictErrors } from './helpers/strict-errors';

test.describe('Fatal Error Handling', () => {
  test('shows raw DOM screen when container is missing', async ({ page }) => {
    const errorTracker = setupStrictErrors(page, [
      {
        channel: 'console',
        pathname: '/src/utils/boot.tsx',
        count: 1,
        message: '[FATAL] missing-container: Error: Container not found'
      }
    ]);
    await page.goto('/tests/e2e/fixtures/throwing-render.html');

    const div = page.locator('div', { hasText: 'FATAL: Application container (#root) not found.' });
    await expect(div).toBeVisible();
    errorTracker.verify();
  });

  test('shows production fallback on boundary catch', async ({ page }) => {
    const errorTracker = setupStrictErrors(page, [
      {
        channel: 'console',
        pathname: '/src/utils/boot.tsx',
        count: 1,
        message: 'React Caught Error (Boundary): Error: Simulated runtime error inside boundary'
      },
      {
        channel: 'console',
        pathname: '/src/components/ErrorBoundary.tsx',
        count: 1,
        message: '[ErrorBoundary] Caught error: Error: Simulated runtime error inside boundary'
      }
    ]);

    await page.goto('/tests/e2e/fixtures/throwing-boundary.html');

    const heading = page.locator('h2', { hasText: 'App Stopped' });
    await expect(heading).toBeVisible();

    const reloadBtn = page.locator('button', { hasText: 'Reload App' });
    await expect(reloadBtn).toBeVisible();
    await expect(page.locator('button')).toHaveCount(1);

    // Assert that the raw pre-root fatal screen and stack traces are ABSENT
    const pre = page.locator('pre');
    await expect(pre).not.toBeVisible();
    const missingRootMsg = page.locator('div', { hasText: 'FATAL: Application container (#root) not found.' });
    await expect(missingRootMsg).not.toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Simulated runtime error inside boundary');
    expect(bodyText).not.toContain('at ChildThatThrows');

    errorTracker.verify();
  });
});
