import { test, expect } from '@playwright/test';
import { setupStrictErrors } from './helpers/strict-errors';
import fs from 'fs';

test.describe('Fatal Error Handling', () => {
  test('shows raw DOM screen when container is missing', async ({ page }) => {
    const errorTracker = setupStrictErrors(page, []);
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
        message: `React Caught Error (Boundary): Error: Simulated runtime error inside boundary
    at ChildThatThrows (http://127.0.0.1:5199/tests/e2e/fixtures/throwing-boundary.tsx:4:9)
    at Object.react_stack_bottom_frame (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:18509:20)
    at renderWithHooks (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:5654:24)
    at updateFunctionComponent (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:7475:21)
    at beginWork (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:8525:20)
    at runWithFiberInDEV (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:997:72)
    at performUnitOfWork (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:12561:98)
    at workLoopSync (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:12424:43)
    at renderRootSync (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:12408:13)
    at performWorkOnRoot (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:11827:37) {componentStack: \n    at ChildThatThrows (http://127.0.0.1:5199/tes….0.0.1:5199/src/components/ErrorBoundary.tsx:5:5), errorBoundary: ErrorBoundary}`
      },
      {
        channel: 'console',
        pathname: '/src/components/ErrorBoundary.tsx',
        count: 1,
        message: `[ErrorBoundary] Caught error: Error: Simulated runtime error inside boundary
    at ChildThatThrows (http://127.0.0.1:5199/tests/e2e/fixtures/throwing-boundary.tsx:4:9)
    at Object.react_stack_bottom_frame (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:18509:20)
    at renderWithHooks (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:5654:24)
    at updateFunctionComponent (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:7475:21)
    at beginWork (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:8525:20)
    at runWithFiberInDEV (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:997:72)
    at performUnitOfWork (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:12561:98)
    at workLoopSync (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:12424:43)
    at renderRootSync (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:12408:13)
    at performWorkOnRoot (http://127.0.0.1:5199/node_modules/.vite/deps/react-dom_client.js?v=4c6e4a4c:11827:37) {componentStack: \n    at ChildThatThrows (http://127.0.0.1:5199/tes….0.0.1:5199/src/components/ErrorBoundary.tsx:5:5)}`
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

