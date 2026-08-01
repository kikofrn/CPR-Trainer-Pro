import { test, expect } from '@playwright/test';

test.describe('Fatal Error Handling', () => {
  test('shows raw DOM screen when container is missing', async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/throwing-render.html');
    
    const div = page.locator('div', { hasText: 'FATAL: Application container (#root) not found.' });
    await expect(div).toBeVisible();
  });

  test('shows production fallback on boundary catch', async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/throwing-boundary.html');
    
    const heading = page.locator('h2', { hasText: 'App Stopped' });
    await expect(heading).toBeVisible();
    
    const reloadBtn = page.locator('button', { hasText: 'Reload App' });
    await expect(reloadBtn).toBeVisible();

    // Assert that the raw pre-root fatal screen and stack traces are ABSENT
    const pre = page.locator('pre');
    await expect(pre).not.toBeVisible();
    const missingRootMsg = page.locator('div', { hasText: 'FATAL: Application container (#root) not found.' });
    await expect(missingRootMsg).not.toBeVisible();
    
    // Reload is the primary recovery action, tested by its visibility and text above
  });
});
