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
