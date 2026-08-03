import { chromium } from 'playwright';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwrightVersion = require('playwright/package.json').version;
const repositoryRoot = process.cwd();
const configuredOutputDir = process.env.GATE1_SCREENSHOT_DIR;
const candidateSha = process.env.GATE1_CANDIDATE_SHA;
const baseUrl = process.env.GATE1_BASE_URL ?? 'http://127.0.0.1:4173';
const captureType = process.env.GATE_SCREENSHOT_CAPTURE_TYPE ?? 'candidate';

if (!['candidate', 'reference-revalidation'].includes(captureType)) {
  throw new Error('GATE_SCREENSHOT_CAPTURE_TYPE must be candidate or reference-revalidation.');
}

if (!configuredOutputDir || !path.isAbsolute(configuredOutputDir)) {
  throw new Error('GATE1_SCREENSHOT_DIR must be an absolute path.');
}
if (!candidateSha || !/^[0-9a-f]{40}$/i.test(candidateSha)) {
  throw new Error('GATE1_CANDIDATE_SHA must be a full 40-character Git SHA.');
}

const outputDir = path.resolve(configuredOutputDir);
const relativeOutputPath = path.relative(repositoryRoot, outputDir);
if (relativeOutputPath === '' || (!relativeOutputPath.startsWith('..') && !path.isAbsolute(relativeOutputPath))) {
  throw new Error('Gate-1 screenshots must be stored outside the repository working tree.');
}
if (fs.existsSync(outputDir) && fs.readdirSync(outputDir).length > 0) {
  throw new Error('GATE1_SCREENSHOT_DIR must be empty or not yet exist.');
}

const repositorySha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
if (repositorySha !== candidateSha) {
  throw new Error(`Candidate mismatch: GATE1_CANDIDATE_SHA=${candidateSha}, repository HEAD=${repositorySha}.`);
}

fs.mkdirSync(outputDir, { recursive: true });

const screenshotOptions = {
  animations: 'disabled',
  caret: 'hide',
  maskColor: '#111111',
};

async function ensureSidebarOpen(page) {
  const expand = page.getByTitle('Expand Sidebar Menu');
  if (!(await page.getByTitle('Collapse Sidebar Menu').count())) {
    await expand.waitFor({ state: 'visible' });
    await expand.click();
  }
  await page.getByTitle('Collapse Sidebar Menu').waitFor();
}

const surfaces = [
  {
    name: 'home-course-list',
    ready: async page => {
      await ensureSidebarOpen(page);
      await page.getByTitle('Select CPR & AED Course Edition').waitFor();
      await page.getByTitle('Select First Aid Course Edition').waitFor();
    },
  },
  {
    name: 'chapter-player',
    ready: async page => {
      await page.getByTitle('Select CPR & AED Course Edition').click();
      const vaLabel = page.getByText('Enable Virtual Assistant?', { exact: true });
      const vaToggle = vaLabel.locator('..').getByRole('button');
      const knob = vaToggle.locator('div').first();
      if (!((await knob.getAttribute('class')) ?? '').includes('translate-x-5')) await vaToggle.click();
      await page.getByRole('button', { name: 'START COURSE', exact: true }).click();
      const video = page.locator('video.pointer-events-auto').first();
      await video.waitFor({ state: 'attached' });
      await video.evaluate(element => {
        element.pause();
        element.currentTime = 0;
      });
      const subtitleButton = page.getByTitle(/^(Enable|Disable) Subtitles$/);
      if ((await subtitleButton.getAttribute('title')) === 'Enable Subtitles') await subtitleButton.click();
      await page.getByTitle('Disable Subtitles').waitFor();
      await page.getByTitle('Play Narration').waitFor();
    },
  },
  {
    name: 'slideshow-slide',
    ready: async page => {
      await page.getByTitle('Select CPR & AED Course Edition').click();
      await page.getByRole('button', { name: 'START COURSE', exact: true }).click();
      await page.getByText(/^Slide 1 of \d+$/).waitFor();
      await page.locator('img[alt="Introduction"]').waitFor();
    },
  },
  {
    name: 'manual-page',
    ready: async page => {
      await page.getByTitle('Browse Student and Instructor Handbooks').click();
      await page.getByRole('button', { name: /Student Manual/i }).first().click();
      await page.getByRole('button', { name: 'OPEN STUDENT MANUAL', exact: true }).click();
      await page.getByText('Manual Flipbook Reader', { exact: true }).waitFor();
      const currentPage = page.locator('div.h-20 span').first();
      await currentPage.waitFor();
      await page.waitForFunction(element => /^(?!00)\d{2}$/.test(element.textContent ?? ''), await currentPage.elementHandle());
      await page.locator('canvas').filter({ visible: true }).first().waitFor();
    },
  },
  {
    name: 'send-certs',
    ready: async page => {
      await ensureSidebarOpen(page);
      await page.getByRole('heading', { name: 'SEND CERTS', exact: true }).click();
      await page.getByText('Secure Login', { exact: true }).waitFor();
    },
  },
  {
    name: 'how-to',
    ready: async page => {
      await ensureSidebarOpen(page);
      await page.getByRole('heading', { name: 'SEND CERTS', exact: true }).click();
      await page.getByRole('button', { name: 'View Step-by-Step Roster Guide', exact: true }).click();
      await page.getByText('EH Academy Training Guides', { exact: true }).waitFor();
    },
  },
  {
    name: 'coming-soon',
    ready: async page => {
      await ensureSidebarOpen(page);
      await page.getByTitle('Select CPR & AED Course Edition').click();
      for (const label of ['Pediatric Focused?', 'Enable Virtual Assistant?']) {
        const toggle = page.getByText(label, { exact: true }).locator('..').getByRole('button');
        const knob = toggle.locator('div').first();
        if (!((await knob.getAttribute('class')) ?? '').includes('translate-x-5')) await toggle.click();
      }
      await page.getByRole('button', { name: 'COMING SOON', exact: true }).waitFor();
      await page.getByText('To launch the Pediatric course, disable the Virtual Assistant.', { exact: true }).waitFor();
    },
    finalize: async page => {
      for (const label of ['Pediatric Focused?', 'Enable Virtual Assistant?']) {
        const knob = page.getByText(label, { exact: true }).locator('..').getByRole('button').locator('div').first();
        await knob.evaluate(element => {
          element.style.transform = 'none';
          element.style.left = '22px';
          element.style.willChange = 'auto';
        });
      }
    },
  },
  {
    name: 'settings-offline-panel',
    ready: async page => {
      const collapse = page.getByTitle('Collapse Sidebar Menu');
      if (await collapse.count()) {
        await collapse.click();
        await collapse.waitFor({ state: 'detached' });
      }
      const expand = page.getByTitle('Expand Sidebar Menu');
      await expand.waitFor({ state: 'visible' });
      await expand.click();
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('button', { name: 'Offline Training?', exact: true }).waitFor();
      await page.getByTitle('Download app for offline use').waitFor();
      await page.getByRole('button', { name: 'Guide', exact: true }).waitFor();
      for (const desktopOnlyControl of [
        'All Offline Media Downloaded',
        'Download All Offline Media',
        'Downloads Paused',
        'Resume',
        'Cancel',
      ]) {
        if (await page.getByText(desktopOnlyControl, { exact: false }).count()) {
          throw new Error(`Desktop-only offline control exposed on the web: ${desktopOnlyControl}`);
        }
      }
    },
    finalize: async page => {
      const continuousPlay = page.getByText('Continuous Play', { exact: true });
      const settingRow = continuousPlay.locator('xpath=ancestor::div[contains(@class,"justify-between")][1]');
      const toggleKnob = settingRow.locator('button div').first();
      await toggleKnob.evaluate(element => {
        element.style.transform = 'none';
        element.style.left = '2px';
        element.style.willChange = 'auto';
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    },
  },
];

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function formatError(error) {
  return error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}`.trim() : String(error);
}

async function stabilize(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const visibleImages = Array.from(document.images).filter(image => image.getClientRects().length > 0);
    return visibleImages.every(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  });
  await page.evaluate(async () => {
    const visibleImages = Array.from(document.images).filter(image => image.getClientRects().length > 0);
    await Promise.all(visibleImages.map(image => image.decode()));
    for (const video of document.querySelectorAll('video')) {
      video.pause();
      video.currentTime = 0;
    }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.waitForFunction(() => new Promise(resolve => {
    let previous = '';
    let stableFrames = 0;
    const sample = () => {
      const snapshot = Array.from(document.body.querySelectorAll('*'))
        .filter(element => element.getClientRects().length > 0)
        .map(element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return [
            Math.round(rect.x * 10) / 10,
            Math.round(rect.y * 10) / 10,
            Math.round(rect.width * 10) / 10,
            Math.round(rect.height * 10) / 10,
            style.opacity,
            style.transform,
            style.filter,
          ];
        });
      const serialized = JSON.stringify(snapshot);
      stableFrames = serialized === previous ? stableFrames + 1 : 0;
      previous = serialized;
      if (stableFrames >= 8) {
        resolve(true);
      } else {
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
  }));
  await page.mouse.move(0, 0);
}

async function captureSurface(browser, passName, surface) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__gate1ScreenshotUnhandled = [];
    window.addEventListener('unhandledrejection', event => {
      const reason = event.reason;
      window.__gate1ScreenshotUnhandled.push(
        reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason),
      );
    });
  });

  const passDir = path.join(outputDir, passName);
  fs.mkdirSync(passDir, { recursive: true });
  const screenshotPath = path.join(passDir, `${surface.name}.png`);
  let primaryError;
  let screenshotError;
  let buffer;
  let layout;
  let unhandledRejections = [];

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await surface.ready(page);
    await stabilize(page);
    if (surface.finalize) await surface.finalize(page);
    await stabilize(page);
    layout = await page.evaluate(() => {
      const round = value => Math.round(value * 10) / 10;
      const rect = element => {
        const box = element.getBoundingClientRect();
        return { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) };
      };
      const selectors = ['[data-app-ready="true"]', 'header', 'aside', 'main', 'video', 'iframe', 'canvas', 'img'];
      const geometry = selectors.flatMap(selector =>
        Array.from(document.querySelectorAll(selector))
          .filter(element => element.getClientRects().length > 0)
          .map((element, index) => ({ selector, index, ...rect(element) })),
      );
      const textRects = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!(node.textContent ?? '').trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const box of range.getClientRects()) {
          if (box.width > 0 && box.height > 0) {
            textRects.push({ x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });
          }
        }
      }
      return { geometry, textRects };
    });
    unhandledRejections = await page.evaluate(() => window.__gate1ScreenshotUnhandled ?? []);
    if (consoleErrors.length || pageErrors.length || unhandledRejections.length) {
      throw new Error(JSON.stringify({ consoleErrors, pageErrors, unhandledRejections }, null, 2));
    }
  } catch (error) {
    primaryError = error;
  }

  try {
    buffer = await page.screenshot({
      ...screenshotOptions,
      path: screenshotPath,
      mask: [page.locator('video'), page.locator('iframe')],
    });
  } catch (error) {
    screenshotError = error;
  }

  await context.close();
  const failures = [primaryError, screenshotError].filter(Boolean).map(formatError);
  if (failures.length) throw new Error(`${passName}/${surface.name}\n${failures.join('\n\n')}`);

  return {
    sha256: sha256(buffer),
    bytes: buffer.length,
    layout,
    runtime: { consoleErrors, pageErrors, unhandledRejections },
  };
}

const browser = await chromium.launch();
try {
  const chromiumVersion = browser.version();
  const passes = {};
  for (const passName of ['pass-a', 'pass-b']) {
    passes[passName] = {};
    for (const surface of surfaces) {
      console.log(`[${passName}] ${surface.name}`);
      passes[passName][surface.name] = await captureSurface(browser, passName, surface);
    }
  }

  for (const surface of surfaces) {
    const a = passes['pass-a'][surface.name];
    const b = passes['pass-b'][surface.name];
    if (a.sha256 !== b.sha256 || a.bytes !== b.bytes) {
      throw new Error(`Screenshot reproducibility failed for ${surface.name}: ${a.sha256}/${a.bytes} != ${b.sha256}/${b.bytes}.`);
    }
  }

  const endingSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
  if (endingSha !== candidateSha) throw new Error(`Repository HEAD changed during capture: ${endingSha}.`);

  const manifest = {
    schemaVersion: 2,
    captureType,
    referenceType: captureType === 'reference-revalidation'
      ? 'same-machine-gate1-reference-revalidation'
      : 'phase3-candidate',
    candidateCodeSha: candidateSha,
    historicalVisualBaseline: null,
    comparison: 'same-machine sequential byte identity',
    surfaces: surfaces.map(surface => surface.name),
    masks: ['video', 'iframe'],
    environment: {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      playwrightVersion,
      chromiumVersion,
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      locale: 'en-US',
      timezoneId: 'America/Chicago',
      colorScheme: 'light',
      reducedMotion: 'reduce',
      serviceWorkers: 'blocked',
      mediaPolicy: 'paused at currentTime 0; video and iframe regions masked',
    },
    passes,
  };
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Captured ${surfaces.length} deterministic surfaces in two byte-identical passes.`);
} finally {
  await browser.close();
}
