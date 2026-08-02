import { expect, Page, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = path.resolve(process.env.GATE1_EVIDENCE_DIR!);
const candidateSha = process.env.GATE1_CANDIDATE_SHA!;
const contentViewport = { width: 1440, height: 900 };
const mobileViewport = { width: 390, height: 844 };

type EvidenceRecord = {
  id: string;
  title: string;
  candidateSha: string;
  viewport: { width: number; height: number };
  startedAt: string;
  finishedAt?: string;
  status?: 'passed' | 'failed';
  observations: Record<string, unknown>;
  runtime: {
    consoleErrors: string[];
    pageErrors: string[];
    unhandledRejections: string[];
  };
  failure?: string;
  evidence?: { screenshot: string; json: string };
};

declare global {
  interface Window {
    __gate1UnhandledRejections?: string[];
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}`.trim() : String(error);
}

async function boot(page: Page, viewport = contentViewport): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-app-ready="true"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

async function runEvidenceRow(
  page: Page,
  id: string,
  title: string,
  viewport: { width: number; height: number },
  body: (record: EvidenceRecord) => Promise<void>,
): Promise<void> {
  const rowDir = path.join(evidenceDir, 'rows');
  fs.mkdirSync(rowDir, { recursive: true });
  const screenshotPath = path.join(rowDir, `${id}.png`);
  const jsonPath = path.join(rowDir, `${id}.json`);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__gate1UnhandledRejections = [];
    window.addEventListener('unhandledrejection', event => {
      const reason = event.reason;
      window.__gate1UnhandledRejections!.push(
        reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason),
      );
    });
  });

  const record: EvidenceRecord = {
    id,
    title,
    candidateSha,
    viewport,
    startedAt: new Date().toISOString(),
    observations: {},
    runtime: { consoleErrors, pageErrors, unhandledRejections: [] },
  };

  let primaryError: unknown;
  try {
    await body(record);
    record.runtime.unhandledRejections = await page.evaluate(() => window.__gate1UnhandledRejections ?? []);
    expect(record.runtime.consoleErrors, 'unexpected console errors').toEqual([]);
    expect(record.runtime.pageErrors, 'unexpected page errors').toEqual([]);
    expect(record.runtime.unhandledRejections, 'unexpected unhandled rejections').toEqual([]);
  } catch (error) {
    primaryError = error;
    try {
      record.runtime.unhandledRejections = await page.evaluate(() => window.__gate1UnhandledRejections ?? []);
    } catch {
      // The original page failure remains authoritative; evidence writing below must still run.
    }
  }

  let screenshotError: unknown;
  try {
    await page.screenshot({ path: screenshotPath, animations: 'disabled', caret: 'hide' });
  } catch (error) {
    screenshotError = error;
  }

  record.finishedAt = new Date().toISOString();
  record.status = primaryError || screenshotError ? 'failed' : 'passed';
  if (primaryError || screenshotError) {
    record.failure = [primaryError && errorText(primaryError), screenshotError && `Screenshot: ${errorText(screenshotError)}`]
      .filter(Boolean)
      .join('\n\n');
  }
  record.evidence = {
    screenshot: path.relative(evidenceDir, screenshotPath).replaceAll('\\', '/'),
    json: path.relative(evidenceDir, jsonPath).replaceAll('\\', '/'),
  };

  let jsonError: unknown;
  try {
    fs.writeFileSync(jsonPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  } catch (error) {
    jsonError = error;
  }

  const failures = [primaryError, screenshotError, jsonError].filter(Boolean).map(errorText);
  if (failures.length > 0) throw new Error(failures.join('\n\n'));
}

async function setCourseToggle(page: Page, label: string, enabled: boolean): Promise<void> {
  const labelNode = page.getByText(label, { exact: true });
  const toggle = labelNode.locator('..').getByRole('button');
  await expect(toggle).toBeVisible();
  const knob = toggle.locator('div').first();
  const isEnabled = (await knob.getAttribute('class'))?.includes('translate-x-5') ?? false;
  if (isEnabled !== enabled) await toggle.click();
  await expect(knob).toHaveClass(enabled ? /translate-x-5/ : /translate-x-0\.5/);
}

async function openCourseSelector(page: Page, kind: 'cpr' | 'fa'): Promise<void> {
  await page.getByTitle(kind === 'cpr' ? 'Select CPR & AED Course Edition' : 'Select First Aid Course Edition').click();
}

async function launchCourse(page: Page, kind: 'cpr' | 'fa', pediatric: boolean, narrated: boolean): Promise<void> {
  await openCourseSelector(page, kind);
  await setCourseToggle(page, 'Pediatric Focused?', pediatric);
  await setCourseToggle(page, 'Enable Virtual Assistant?', narrated);
  const start = page.getByRole('button', { name: 'START COURSE', exact: true });
  await expect(start).toBeEnabled();
  await start.click();
}

async function expandAllSections(page: Page): Promise<void> {
  while (await page.getByTitle('Expand Section').count()) {
    await page.getByTitle('Expand Section').first().click();
  }
}

async function selectSidebarItem(page: Page, title: string): Promise<void> {
  const heading = page.locator('aside h3').filter({ hasText: title }).first();
  await expect(heading).toHaveText(title);
  await heading.click();
}

async function verifySlideshow(
  page: Page,
  record: EvidenceRecord,
  kind: 'cpr' | 'fa',
  pediatric: boolean,
  expectedVideoTitle?: string,
): Promise<void> {
  await boot(page);
  await launchCourse(page, kind, pediatric, false);
  const slideCounter = page.getByText(/^Slide \d+ of \d+$/).first();
  await expect(slideCounter).toBeVisible();
  const initial = await slideCounter.textContent();
  const totalSlides = Number(initial!.match(/of (\d+)$/)?.[1]);
  const seen = new Set<string>([initial!]);

  if (!expectedVideoTitle) {
    expect(totalSlides).toBe(45);
    await expect(page.getByTitle('Play Video Slide')).toHaveCount(0);
    for (let index = 1; index < totalSlides; index += 1) {
      const prior = await slideCounter.textContent();
      await page.getByTitle('Next Slide').click();
      await expect.poll(async () => slideCounter.textContent()).not.toBe(prior);
      seen.add((await slideCounter.textContent())!);
      await expect(page.getByTitle('Play Video Slide')).toHaveCount(0);
    }
    expect(seen.size).toBe(45);
    record.observations.slidePositions = Array.from(seen).slice(0, 6);
    record.observations.slideCount = totalSlides;
    record.observations.mediaComposition = { images: 45, videos: 0 };
    return;
  }

  for (let index = 0; index < 5; index += 1) {
    await page.getByTitle('Next Slide').click();
    await expect.poll(async () => slideCounter.textContent()).not.toBe(Array.from(seen).at(-1));
    seen.add((await slideCounter.textContent())!);
  }
  expect(seen.size).toBe(6);
  record.observations.slidePositions = Array.from(seen);
  record.observations.slideCount = totalSlides;

  const activeTitle = slideCounter.locator('..').locator('p').nth(1);
  for (let index = 0; index < totalSlides && (await activeTitle.textContent()) !== expectedVideoTitle; index += 1) {
    const next = page.getByTitle('Next Slide');
    await expect(next).toBeEnabled();
    await next.click();
  }
  await expect(activeTitle).toHaveText(expectedVideoTitle);
  const video = page.locator('video').filter({ visible: true }).first();
  await expect(video).toBeVisible();
  if (!(await video.evaluate((element: HTMLVideoElement) => element.paused))) {
    await expect.poll(async () => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0.25);
    await page.getByTitle('Pause Video Slide').click();
  }
  expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await page.getByTitle('Play Video Slide').click();
  await expect.poll(async () => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
  record.observations.videoTitle = expectedVideoTitle;
}

async function activeNarrationVideo(page: Page) {
  return page.locator('video.pointer-events-auto').first();
}

async function verifyNarratedCourse(
  page: Page,
  record: EvidenceRecord,
  kind: 'cpr' | 'fa',
  chapterCount: number,
  middleChapter: string,
): Promise<void> {
  await boot(page);
  await launchCourse(page, kind, false, true);
  await expect(page.locator('aside h3').filter({ hasText: 'Introduction' }).first()).toHaveText('Introduction');
  await expandAllSections(page);
  expect(await page.locator('aside h3').count()).toBe(chapterCount);

  const video = await activeNarrationVideo(page);
  await expect(video).toBeAttached();
  if (await video.evaluate((element: HTMLVideoElement) => element.paused)) {
    await page.getByTitle('Play Narration').click();
  }
  const startTime = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
  await expect.poll(
    async () => video.evaluate((element: HTMLVideoElement) => element.currentTime),
    { timeout: 50000 },
  ).toBeGreaterThanOrEqual(startTime + 20);

  const subtitleToggle = page.getByTitle(/^(Enable|Disable) Subtitles$/);
  if ((await subtitleToggle.getAttribute('title')) === 'Enable Subtitles') await subtitleToggle.click();
  await expect(page.getByTitle('Disable Subtitles')).toBeVisible();

  const beforeSeek = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
  const seek = page.getByTitle('Click to seek playback position');
  const seekBox = await seek.boundingBox();
  expect(seekBox).not.toBeNull();
  await seek.click({ position: { x: seekBox!.width * 0.12, y: seekBox!.height / 2 } });
  await expect.poll(async () => Math.abs((await video.evaluate((element: HTMLVideoElement) => element.currentTime)) - beforeSeek)).toBeGreaterThan(2);
  await expect(page.locator('div.absolute.bottom-28 p')).toBeVisible();

  await selectSidebarItem(page, middleChapter);
  const middleVideo = await activeNarrationVideo(page);
  await expect.poll(async () => middleVideo.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
  record.observations = {
    chapterCount,
    firstChapter: 'Introduction',
    naturalPlaybackAdvanceSeconds: 20,
    subtitles: 'enabled with visible cue',
    seek: 'currentTime changed',
    middleChapter,
    middleChapterPlayback: 'progressed',
  };
}

async function verifyComingSoon(page: Page, record: EvidenceRecord, kind: 'cpr' | 'fa'): Promise<void> {
  await boot(page);
  await openCourseSelector(page, kind);
  await setCourseToggle(page, 'Pediatric Focused?', true);
  await setCourseToggle(page, 'Enable Virtual Assistant?', true);
  const comingSoon = page.getByRole('button', { name: 'COMING SOON', exact: true });
  await expect(comingSoon).toBeDisabled();
  await expect(page.getByText('To launch the Pediatric course, disable the Virtual Assistant.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'START COURSE', exact: true })).toHaveCount(0);
  record.observations = { disabled: true, bypassControls: 0 };
}

async function verifyManual(page: Page, record: EvidenceRecord, title: string): Promise<void> {
  await boot(page);
  await page.getByTitle('Browse Student and Instructor Handbooks').click();
  await page.getByRole('button', { name: new RegExp(title, 'i') }).first().click();
  await page.getByRole('button', { name: `OPEN ${title.toUpperCase()}`, exact: true }).click();
  await expect(page.getByText('Manual Flipbook Reader', { exact: true })).toBeVisible();
  const currentPage = page.locator('div.h-20 span').first();
  await expect(currentPage).toHaveText(/^(?!00)\d{2}$/);
  const pages = [await currentPage.textContent()];
  for (let index = 0; index < 4; index += 1) {
    const prior = pages.at(-1);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => currentPage.textContent(), { timeout: 10000 }).not.toBe(prior);
    pages.push(await currentPage.textContent());
  }
  const magnify = page.getByRole('button', { name: 'Magnify', exact: true });
  await magnify.click();
  await expect(magnify).toHaveClass(/bg-eh-red/);
  record.observations = { manual: title, pageCounterSequence: pages, magnify: 'active' };
}

test.describe('Gate-1 product matrix', () => {
  test.describe.configure({ mode: 'serial' });

  test('01 CPR adult self-paced slideshow', async ({ page }) => {
    await runEvidenceRow(page, '01-cpr-adult-slideshow', 'CPR adult self-paced slideshow', contentViewport,
      record => verifySlideshow(page, record, 'cpr', false, 'Life and Death Drama'));
  });

  test('02 CPR adult virtual assistant course', async ({ page }) => {
    await runEvidenceRow(page, '02-cpr-adult-va', 'CPR adult virtual assistant course', contentViewport,
      record => verifyNarratedCourse(page, record, 'cpr', 30, 'Practice Breaths'));
  });

  test('03 pediatric CPR slideshow', async ({ page }) => {
    await runEvidenceRow(page, '03-pediatric-cpr-slideshow', 'Pediatric CPR slideshow', contentViewport,
      record => verifySlideshow(page, record, 'cpr', true, 'Assessment Example'));
  });

  test('04 pediatric CPR plus virtual assistant is coming soon', async ({ page }) => {
    await runEvidenceRow(page, '04-pediatric-cpr-va-coming-soon', 'Pediatric CPR plus virtual assistant coming soon', contentViewport,
      record => verifyComingSoon(page, record, 'cpr'));
  });

  test('05 First Aid adult self-paced slideshow', async ({ page }) => {
    await runEvidenceRow(page, '05-fa-adult-slideshow', 'First Aid adult self-paced slideshow', contentViewport,
      record => verifySlideshow(page, record, 'fa', false, 'Seizure Video'));
  });

  test('06 First Aid adult virtual assistant course', async ({ page }) => {
    await runEvidenceRow(page, '06-fa-adult-va', 'First Aid adult virtual assistant course', contentViewport,
      record => verifyNarratedCourse(page, record, 'fa', 45, 'Internal Bleeding'));
  });

  test('07 pediatric First Aid slideshow', async ({ page }) => {
    await runEvidenceRow(page, '07-pediatric-fa-slideshow', 'Pediatric First Aid slideshow', contentViewport,
      record => verifySlideshow(page, record, 'fa', true));
  });

  test('08 pediatric First Aid plus virtual assistant is coming soon', async ({ page }) => {
    await runEvidenceRow(page, '08-pediatric-fa-va-coming-soon', 'Pediatric First Aid plus virtual assistant coming soon', contentViewport,
      record => verifyComingSoon(page, record, 'fa'));
  });

  for (const [index, title, id] of [
    ['09', 'Instructor Manual', 'instructor-manual'],
    ['10', 'Student Manual', 'student-manual'],
    ['11', 'Pediatric Student Manual', 'pediatric-student-manual'],
  ] as const) {
    test(`${index} ${title}`, async ({ page }) => {
      await runEvidenceRow(page, `${index}-${id}`, title, contentViewport, record => verifyManual(page, record, title));
    });
  }

  test('12 Send Certs', async ({ page }) => {
    await runEvidenceRow(page, '12-send-certs', 'Send Certs', contentViewport, async record => {
      await boot(page);
      await page.getByRole('heading', { name: 'SEND CERTS', exact: true }).click();
      await expect(page.getByText('Secure Login', { exact: true })).toBeVisible();
      await expect(page.getByText('Manage Classes', { exact: true })).toBeVisible();
      await expect(page.getByText('Issue Cards', { exact: true })).toBeVisible();
      record.observations.portalActions = ['Secure Login', 'Manage Classes', 'Issue Cards'];
    });
  });

  test('13 How-To guide', async ({ page }) => {
    await runEvidenceRow(page, '13-how-to-guide', 'How-To guide', contentViewport, async record => {
      await boot(page);
      await page.getByRole('heading', { name: 'SEND CERTS', exact: true }).click();
      await page.getByRole('button', { name: 'View Step-by-Step Roster Guide', exact: true }).click();
      await expect(page.getByText('EH Academy Training Guides', { exact: true })).toBeVisible();
      record.observations.guide = 'opened from Send Certs';
    });
  });

  test('14 mobile boot at 390 by 844', async ({ page }) => {
    await runEvidenceRow(page, '14-mobile-boot', 'Mobile boot at 390 by 844', mobileViewport, async record => {
      await boot(page, mobileViewport);
      await expect(page.locator('[data-app-ready="true"]')).toBeVisible();
      record.observations.appReady = true;
    });
  });

  test('15 mobile horizontal overflow at 390 by 844', async ({ page }) => {
    await runEvidenceRow(page, '15-mobile-overflow', 'Mobile horizontal overflow at 390 by 844', mobileViewport, async record => {
      await boot(page, mobileViewport);
      const dimensions = await page.evaluate(() => ({
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyClientWidth: document.body.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }));
      expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.documentClientWidth);
      expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.bodyClientWidth);
      record.observations.dimensions = dimensions;
    });
  });

  test('16 Spanish editions remain interactively unreachable', async ({ page }) => {
    await runEvidenceRow(page, '16-spanish-interactive-guard', 'Spanish editions remain interactively unreachable', contentViewport, async record => {
      await boot(page);
      const exposures = await page.locator('button, a, [role="button"], [role="link"], input, select, option').evaluateAll(elements =>
        elements.map(element => ({
          text: (element.textContent ?? '').trim(),
          title: element.getAttribute('title') ?? '',
          ariaLabel: element.getAttribute('aria-label') ?? '',
          href: element.getAttribute('href') ?? '',
          value: element.getAttribute('value') ?? '',
        })).filter(item => /spanish|espa(?:ñ|n)ol|(^|\/)es(?:\/|$)/i.test(Object.values(item).join(' '))),
      );
      expect(exposures).toEqual([]);
      record.observations = {
        interactiveSpanishControlsOrRoutes: exposures,
        staticHowToProseAllowed: true,
      };
    });
  });
});
