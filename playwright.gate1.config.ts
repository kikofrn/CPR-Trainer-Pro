import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = process.env.GATE1_EVIDENCE_DIR;
const candidateSha = process.env.GATE1_CANDIDATE_SHA;

if (!evidenceDir || !path.isAbsolute(evidenceDir)) {
  throw new Error('GATE1_EVIDENCE_DIR must be an absolute path.');
}
if (!candidateSha || !/^[0-9a-f]{40}$/i.test(candidateSha)) {
  throw new Error('GATE1_CANDIDATE_SHA must be a full 40-character Git SHA.');
}

const resolvedEvidenceDir = path.resolve(evidenceDir);
const relativeEvidencePath = path.relative(process.cwd(), resolvedEvidenceDir);
if (relativeEvidencePath === '' || (!relativeEvidencePath.startsWith('..') && !path.isAbsolute(relativeEvidencePath))) {
  throw new Error('Gate-1 evidence must be stored outside the repository working tree.');
}
// Playwright reloads this config in each worker after the reporter/output folders exist.
// Enforce the clean-root precondition only in the orchestrating process.
if (process.env.TEST_WORKER_INDEX === undefined && fs.existsSync(resolvedEvidenceDir) && fs.readdirSync(resolvedEvidenceDir).length > 0) {
  throw new Error('GATE1_EVIDENCE_DIR must be empty or not yet exist.');
}
fs.mkdirSync(resolvedEvidenceDir, { recursive: true });

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'gate1-matrix.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 120000,
  expect: {
    timeout: 20000,
  },
  reporter: [
    ['line'],
    ['html', { outputFolder: path.join(resolvedEvidenceDir, 'html-report'), open: 'never' }],
  ],
  outputDir: path.join(resolvedEvidenceDir, 'test-results'),
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    actionTimeout: 20000,
    navigationTimeout: 60000,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 240000,
  },
});
