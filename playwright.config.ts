import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const configuredArtifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR;
if (configuredArtifactDir && !path.isAbsolute(configuredArtifactDir)) {
  throw new Error('PLAYWRIGHT_ARTIFACT_DIR must be an absolute path.');
}

const artifactRoot = path.resolve(
  configuredArtifactDir ?? path.join(os.tmpdir(), 'cpr-trainer-pro-playwright-default')
);
const relativeArtifactPath = path.relative(process.cwd(), artifactRoot);
if (relativeArtifactPath === '' || (!relativeArtifactPath.startsWith('..') && !path.isAbsolute(relativeArtifactPath))) {
  throw new Error('Playwright artifacts must be stored outside the repository working tree.');
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['line'],
    ['html', { outputFolder: path.join(artifactRoot, 'html-report'), open: 'never' }],
  ],
  outputDir: path.join(artifactRoot, 'test-results'),

  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  use: {
    actionTimeout: 15000,
    navigationTimeout: 60000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'app',
      testMatch: [
        'tests/e2e/app.spec.ts',
        'tests/e2e/phase3.spec.ts',
      ],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4173',
      },
    },
    {
      name: 'fixtures',
      testMatch: 'tests/e2e/fatal.spec.ts',
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:5199',
      },
    },
  ],

  webServer: [
    {
      command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: process.env.CI ? 240000 : 120000,
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 5199 --strictPort',
      url: 'http://127.0.0.1:5199',
      reuseExistingServer: false,
      timeout: process.env.CI ? 240000 : 120000,
    },
  ],
});
