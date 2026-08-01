import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  projects: [
    {
      name: 'app',
      testMatch: 'tests/e2e/app.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4173',
      },
    },
    {
      name: 'fixtures',
      testMatch: 'tests/e2e/fatal.spec.ts',
      // Run fixtures serially to prevent cold dev-server timeout issues on clean installs
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
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 5199 --strictPort',
      url: 'http://127.0.0.1:5199',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
