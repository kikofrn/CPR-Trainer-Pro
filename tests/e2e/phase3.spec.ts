import { expect, Page, Route, test } from '@playwright/test';

import { setupStrictErrors } from './helpers/strict-errors';

async function enableToggle(page: Page, label: string) {
  const toggle = page.getByText(label, { exact: true }).locator('..').getByRole('button');
  const knob = toggle.locator('div').first();
  if (!((await knob.getAttribute('class')) ?? '').includes('translate-x-5')) await toggle.click();
}

async function launchNarratedCpr(page: Page, play = false) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-app-ready="true"]').waitFor();
  await page.getByTitle('Select CPR & AED Course Edition').click();
  await enableToggle(page, 'Enable Virtual Assistant?');
  await page.getByRole('button', { name: 'START COURSE', exact: true }).click();
  const activeVideo = page.locator('video[data-media-active="true"]');
  await expect.poll(async () => activeVideo.getAttribute('src'), { timeout: 20_000 }).toContain('Introduction.mp4');
  if (play && await activeVideo.evaluate((video: HTMLVideoElement) => video.paused)) {
    await page.getByTitle('Play Narration').click();
    await expect.poll(async () => activeVideo.evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);
  }
  return activeVideo;
}

async function selectChapter(page: Page, title: string) {
  const chapter = page.locator('aside h3').filter({ hasText: title }).first();
  await expect(chapter).toHaveText(title);
  await chapter.click();
}

async function launchCprSlideshow(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-app-ready="true"]').waitFor();
  await page.getByTitle('Select CPR & AED Course Edition').click();
  await page.getByRole('button', { name: 'START COURSE', exact: true }).click();
  await expect(page.getByText(/^Slide 1 of \d+$/)).toBeVisible();
  await expect(page.locator('[data-slideshow-media-state="image-ready"]')).toBeVisible({ timeout: 20_000 });
}

async function advanceToCprVideoSlide(page: Page) {
  for (let slide = 2; slide <= 8; slide += 1) {
    await page.getByTitle('Next Slide').click();
    await expect(page.getByText(new RegExp(`^Slide ${slide} of \\d+$`))).toBeVisible();
  }
}

test.describe('Phase 3 transactional chapter playback', () => {
  test('does not speculatively request the next chapter', async ({ page }) => {
    const errors = setupStrictErrors(page, []);
    const requestedVideos = new Set<string>();
    page.on('request', request => {
      const url = request.url();
      if (/CPR%20AED%20VA%20Slides\/.*\.mp4(?:\?|$)/.test(url)) requestedVideos.add(url.split('?')[0]);
    });

    await launchNarratedCpr(page);
    expect(Array.from(requestedVideos)).toHaveLength(1);
    expect(Array.from(requestedVideos)[0]).toContain('Introduction.mp4');
    errors.verify();
  });

  test('preserves the committed chapter through retry exhaustion, then retries explicitly', async ({ page }) => {
    test.setTimeout(50_000);
    const errors = setupStrictErrors(page, []);
    const activeVideo = await launchNarratedCpr(page, true);
    await page.evaluate(() => {
      const originalLoad = HTMLMediaElement.prototype.load;
      const originalPlay = HTMLMediaElement.prototype.play;
      (window as typeof window & { __restorePhase3MediaLoad?: () => void }).__restorePhase3MediaLoad = () => {
        HTMLMediaElement.prototype.load = originalLoad;
        HTMLMediaElement.prototype.play = originalPlay;
      };
      HTMLMediaElement.prototype.load = function phase3FailingLoad() {
        if (this.src.includes('Why%20are%20we%20here.mp4')) return;
        originalLoad.call(this);
      };
      HTMLMediaElement.prototype.play = function phase3PendingPlay() {
        if (this.src.includes('Why%20are%20we%20here.mp4')) return new Promise<void>(() => undefined);
        return originalPlay.call(this);
      };
    });

    await selectChapter(page, 'Why are we here');
    const inactiveVideo = page.locator('video[data-media-active="false"]');
    await expect(page.locator('[data-media-state="loading"]')).toBeVisible();
    for (const retryDelay of [2_000, 4_000, 8_000]) {
      await inactiveVideo.evaluate(video => video.dispatchEvent(new Event('error')));
      await expect(page.locator('[data-media-state="retrying"]')).toBeVisible();
      await expect(page.locator('[data-media-state="loading"]')).toBeVisible({ timeout: retryDelay + 10_000 });
    }
    await inactiveVideo.evaluate(video => video.dispatchEvent(new Event('error')));
    await expect(page.locator('[data-media-state="failed"]')).toBeVisible();
    await expect.poll(async () => activeVideo.getAttribute('src')).toContain('Introduction.mp4');
    await expect(page.locator('aside h3').filter({ hasText: 'Introduction' }).first().locator('..').locator('..')).toHaveClass(/border-eh-red/);

    await page.evaluate(() => {
      (window as typeof window & { __restorePhase3MediaLoad?: () => void }).__restorePhase3MediaLoad?.();
    });
    await page.locator('[data-media-state="failed"]').getByRole('button', { name: 'Retry', exact: true }).click();
    await expect.poll(async () => page.locator('video[data-media-active="true"]').getAttribute('src'), { timeout: 20_000 }).toContain('Why%20are%20we%20here.mp4');
    errors.verify();
  });

  test('newest rapid selection wins when an older media response arrives late', async ({ page }) => {
    test.setTimeout(40_000);
    const errors = setupStrictErrors(page, []);
    await launchNarratedCpr(page);
    const delayedFragment = '02_EHAcademy%20-%20CPR%20AED%20Course%20Video-Why%20are%20we%20here.mp4';
    let releaseDelayed!: () => void;
    const delayed = new Promise<void>(resolve => { releaseDelayed = resolve; });
    let markDelayedFinished!: () => void;
    const delayedFinished = new Promise<void>(resolve => { markDelayedFinished = resolve; });
    const delayRoute = async (route: Route) => {
      await delayed;
      await route.continue().catch(() => undefined);
      markDelayedFinished();
    };
    await page.route(url => url.href.includes(delayedFragment), delayRoute);

    await selectChapter(page, 'Why are we here');
    await expect(page.locator('[data-media-state="loading"]')).toBeVisible();
    await selectChapter(page, 'Life and Death Drama');
    await expect.poll(async () => page.locator('video[data-media-active="true"]').getAttribute('src'), { timeout: 20_000 }).toContain('Life%20and%20Death%20Drama.mp4');
    releaseDelayed();
    await delayedFinished;
    await expect(page.locator('video[data-media-active="true"]')).toHaveAttribute('src', /Life%20and%20Death%20Drama\.mp4/);
    errors.verify();
  });
});

test.describe('Phase 3 persistent slideshow media', () => {
  test('keeps one video element, reports truthful play state, and rejects stale video events after an image transition', async ({ page }) => {
    test.setTimeout(45_000);
    const errors = setupStrictErrors(page, []);
    await launchCprSlideshow(page);
    expect(await page.locator('video').count()).toBe(1);
    await advanceToCprVideoSlide(page);
    const video = page.locator('video').first();
    await expect(page.locator('[data-slideshow-media-state="video-playing"]')).toBeVisible({ timeout: 20_000 });
    expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);

    await page.getByTitle('Pause Video Slide').click();
    await expect(page.locator('[data-slideshow-media-state="video-paused"]')).toBeVisible();
    expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await page.getByTitle('Play Video Slide').click();
    await expect(page.locator('[data-slideshow-media-state="video-playing"]')).toBeVisible();

    await page.getByTitle('Next Slide').click();
    await expect.poll(async () => page.evaluate(() => {
      const visibleVideo = Array.from(document.querySelectorAll('video')).some(element => getComputedStyle(element).opacity !== '0');
      const visibleImage = Array.from(document.querySelectorAll('img:not([aria-hidden="true"])')).some(element => {
        const style = getComputedStyle(element);
        return element.getClientRects().length > 0 && style.opacity !== '0';
      });
      const loadingFrame = !!document.querySelector('[data-slideshow-media-state="image-loading"]');
      return visibleVideo || visibleImage || loadingFrame;
    })).toBe(true);
    await expect(page.getByText(/^Slide 9 of \d+$/)).toBeVisible();
    await expect(page.locator('[data-slideshow-media-state="image-ready"]')).toBeVisible({ timeout: 20_000 });
    await video.evaluate(element => {
      element.dispatchEvent(new Event('playing'));
      element.dispatchEvent(new Event('error'));
    });
    await expect(page.getByText(/^Slide 9 of \d+$/)).toBeVisible();
    await expect(page.locator('[data-slideshow-media-state="image-ready"]')).toBeVisible();
    errors.verify();
  });

  test('autoplay denial waits for readiness and exposes Play', async ({ page }) => {
    test.setTimeout(40_000);
    const errors = setupStrictErrors(page, []);
    await launchCprSlideshow(page);
    await page.evaluate(() => {
      const originalPlay = HTMLMediaElement.prototype.play;
      (window as typeof window & { __restoreSlideshowPlay?: () => void }).__restoreSlideshowPlay = () => {
        HTMLMediaElement.prototype.play = originalPlay;
      };
      HTMLMediaElement.prototype.play = function denyTargetSlide() {
        if (this.src.includes('Life%20and%20Death%20Drama.mp4')) {
          const error = new DOMException('User activation required.', 'NotAllowedError');
          return Promise.reject(error);
        }
        return originalPlay.call(this);
      };
    });
    await advanceToCprVideoSlide(page);
    await expect(page.locator('[data-slideshow-media-state="autoplay-denied"]')).toBeVisible({ timeout: 20_000 });
    expect(await page.locator('video').evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await page.evaluate(() => {
      (window as typeof window & { __restoreSlideshowPlay?: () => void }).__restoreSlideshowPlay?.();
    });
    await page.getByTitle('Play Video Slide').click();
    await expect(page.locator('[data-slideshow-media-state="video-playing"]')).toBeVisible();
    errors.verify();
  });

  test('terminal video failure offers Retry and Skip', async ({ page }) => {
    test.setTimeout(55_000);
    const errors = setupStrictErrors(page, []);
    await launchCprSlideshow(page);
    await page.evaluate(() => {
      const originalLoad = HTMLMediaElement.prototype.load;
      const originalPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.load = function holdTargetSlide() {
        if (this.src.includes('Life%20and%20Death%20Drama.mp4')) return;
        originalLoad.call(this);
      };
      HTMLMediaElement.prototype.play = function holdTargetPlayback() {
        if (this.src.includes('Life%20and%20Death%20Drama.mp4')) return new Promise<void>(() => undefined);
        return originalPlay.call(this);
      };
    });
    await advanceToCprVideoSlide(page);
    const video = page.locator('video').first();
    await expect(page.locator('[data-slideshow-media-state="video-loading"]')).toBeVisible();
    for (const retryDelay of [2_000, 4_000, 8_000]) {
      await video.evaluate(element => element.dispatchEvent(new Event('error')));
      await expect(page.locator('[data-slideshow-media-state="retrying"]')).toBeVisible();
      await expect.poll(async () => video.getAttribute('src'), { timeout: retryDelay + 10_000 }).toContain('Life%20and%20Death%20Drama.mp4');
    }
    await video.evaluate(element => element.dispatchEvent(new Event('error')));
    const alert = page.locator('[data-slideshow-media-state="failed"]').getByRole('alert');
    await expect(alert.getByRole('button', { name: /Retry/ })).toBeVisible();
    await expect(alert.getByRole('button', { name: /Skip/ })).toBeVisible();
    await alert.getByRole('button', { name: /Skip/ }).click();
    await expect(page.getByText(/^Slide 9 of \d+$/)).toBeVisible();
    errors.verify();
  });

  test('image failure has a branded Retry and Skip recovery path', async ({ page }) => {
    const errors = setupStrictErrors(page, [{
      channel: 'console',
      message: 'Failed to load resource: net::ERR_FAILED',
      pathname: '/CPR%20AED%20Presentation%20Slides/02_EHAcademy%20-%20CPR%20AED%20Course%20Pres-Why%20should%20I%20learn%20CPR.png',
      count: 1,
    }]);
    await launchCprSlideshow(page);
    const failedImage = '02_EHAcademy%20-%20CPR%20AED%20Course%20Pres-Why%20should%20I%20learn%20CPR.png';
    await page.route(url => url.href.includes(failedImage), route => route.abort('failed'));
    await page.getByTitle('Next Slide').click();
    const alert = page.locator('[data-slideshow-media-state="failed"]').getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 10_000 });
    await alert.getByRole('button', { name: /Skip/ }).click();
    await expect(page.getByText(/^Slide 3 of \d+$/)).toBeVisible();
    errors.verify();
  });
});

test.describe('Phase 3 manual failure recovery', () => {
  test('document failure offers Retry and Close, then recovers without a blank reader', async ({ page }) => {
    const failedManual = (url: URL) => url.href.endsWith('/student_manual.pdf');
    await page.route(failedManual, route => route.abort('failed'));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await page.getByTitle('Browse Student and Instructor Handbooks').click();
    await page.getByRole('button', { name: /Student Manual/i }).first().click();
    await page.getByRole('button', { name: 'OPEN STUDENT MANUAL', exact: true }).click();

    const alert = page.getByRole('alert').filter({ hasText: 'Manual unavailable' });
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert.getByRole('button', { name: /Retry/ })).toBeVisible();
    await expect(alert.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    await page.unroute(failedManual);
    await alert.getByRole('button', { name: /Retry/ }).click();
    await expect(page.locator('canvas').filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Manual Flipbook Reader', { exact: true })).toBeVisible();
  });

  test('page render failure offers Retry Page and preserves the reader shell', async ({ page }) => {
    await page.addInitScript(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      (window as typeof window & { __failPdfCanvas?: boolean }).__failPdfCanvas = false;
      (HTMLCanvasElement.prototype as any).getContext = function (...args: any[]) {
        if ((window as typeof window & { __failPdfCanvas?: boolean }).__failPdfCanvas) {
          throw new Error('Expected PDF canvas failure');
        }
        return originalGetContext.apply(this, args as any);
      };
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await page.getByTitle('Browse Student and Instructor Handbooks').click();
    await page.getByRole('button', { name: /Student Manual/i }).first().click();
    await page.evaluate(() => {
      (window as typeof window & { __failPdfCanvas?: boolean }).__failPdfCanvas = true;
    });
    await page.getByRole('button', { name: 'OPEN STUDENT MANUAL', exact: true }).click();

    await expect(page.getByText('Manual Flipbook Reader', { exact: true })).toBeVisible();
    const retryPage = page.getByRole('button', { name: 'Retry Page', exact: true }).first();
    await expect(retryPage).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => {
      (window as typeof window & { __failPdfCanvas?: boolean }).__failPdfCanvas = false;
    });
    await retryPage.click();
    await expect(page.locator('canvas').filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
  });

  test('offline document failure gives reconnect guidance and recovers after reconnect', async ({ page, context }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await page.getByTitle('Browse Student and Instructor Handbooks').click();

    // Cache the lazy reader bundle with a different document before simulating a
    // disconnected browser. This isolates the student-manual request under test.
    await page.getByRole('button', { name: /Instructor Manual/i }).first().click();
    await page.getByRole('button', { name: 'OPEN INSTRUCTOR MANUAL', exact: true }).click();
    await expect(page.locator('canvas').filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Close Manual', exact: true }).click();
    await page.getByTitle('Browse Student and Instructor Handbooks').click();
    await page.getByRole('button', { name: /Student Manual/i }).first().click();

    const failedManual = (url: URL) => url.href.endsWith('/student_manual.pdf');
    await page.route(failedManual, route => route.abort('internetdisconnected'));
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.getByRole('button', { name: 'OPEN STUDENT MANUAL', exact: true }).click();

    const alert = page.getByRole('alert').filter({ hasText: 'Manual unavailable' });
    await expect(alert).toContainText('You are offline. Reconnect, then retry the training manual.', { timeout: 15_000 });
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.unroute(failedManual);
    await alert.getByRole('button', { name: /Retry/ }).click();
    await expect(page.locator('canvas').filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Phase 3 offline app download affordance', () => {
  test('opens from the header and Settings while remaining hidden during course content', async ({ page }) => {
    const errors = setupStrictErrors(page, []);
    const downloadButton = page.getByTitle('Download app for offline use');
    const expectedWindowsUrl = 'https://github.com/kikofrn/CPR-Trainer-Pro/releases/latest/download/CPRTrainerPro-Setup.exe';

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await expect(page.getByTitle('Collapse Sidebar Menu')).toHaveCount(0);
    await expect(page.getByTitle('Expand Sidebar Menu')).toBeVisible();
    await expect(downloadButton).toBeVisible();

    await downloadButton.click();
    const headerDialog = page.getByRole('dialog', { name: 'Download the app for offline use' });
    await expect(headerDialog).toBeVisible();
    await expect(headerDialog.getByRole('link', { name: 'Download for Windows' })).toHaveAttribute('href', expectedWindowsUrl);
    await expect(headerDialog.getByRole('button', { name: 'Coming soon' })).toHaveCount(2);
    await page.getByTestId('download-app-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(headerDialog).toBeHidden();
    await expect(downloadButton).toBeFocused();

    await downloadButton.click();
    await expect(headerDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(headerDialog).toBeHidden();
    await expect(downloadButton).toBeFocused();

    await page.getByTitle('Select CPR & AED Course Edition').click();
    await page.getByRole('button', { name: 'START COURSE', exact: true }).click();
    await expect(downloadButton).toHaveCount(0);
    const sidebarCollapse = page.getByTitle('Collapse Sidebar Menu');
    if (await sidebarCollapse.count()) await sidebarCollapse.click();
    await page.locator('main').getByTitle('Return to Main Menu').click();
    await expect(downloadButton).toBeVisible();

    await page.getByTitle('Expand Sidebar Menu').click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settingsEntry = page.getByRole('button', { name: 'Offline Training?', exact: true });
    await expect(settingsEntry).toBeVisible();
    await settingsEntry.click();
    const settingsDialog = page.getByRole('dialog', { name: 'Download the app for offline use' });
    await expect(settingsDialog).toBeVisible();
    await settingsDialog.getByRole('button', { name: 'Close download dialog' }).click();
    await expect(settingsDialog).toBeHidden();
    await expect(settingsEntry).toBeFocused();
    errors.verify();
  });
});
