import { expect, Page, test } from '@playwright/test';

import { setupStrictErrors } from './helpers/strict-errors';

let verifyStrictErrors: (() => void) | null = null;
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.beforeEach(async ({ page }) => {
  verifyStrictErrors = setupStrictErrors(page, []).verify;
});
test.afterEach(() => {
  verifyStrictErrors?.();
  verifyStrictErrors = null;
});

async function bootMobile(page: Page, width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-app-ready="true"]').waitFor();
  await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible();
}

async function openView(page: Page, name: 'CPR & AED' | 'First Aid' | 'Manuals') {
  await page.getByTestId('mobile-bottom-nav').getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId('mobile-navigation-sheet')).toBeVisible();
}

async function setSwitch(page: Page, name: string, checked: boolean) {
  const control = page.getByRole('switch', { name, exact: true });
  if ((await control.getAttribute('aria-checked')) !== String(checked)) await control.click();
  await expect(control).toHaveAttribute('aria-checked', String(checked));
}

async function closeSheet(page: Page) {
  await page.getByRole('button', { name: 'Close course menu' }).click();
  await expect(page.getByTestId('mobile-navigation-sheet')).toBeHidden();
}

async function startCprVideo(page: Page) {
  await openView(page, 'CPR & AED');
  await setSwitch(page, 'Pediatric Focused', false);
  await setSwitch(page, 'Virtual Assistant', true);
  await page.getByRole('button', { name: 'Start course', exact: true }).click();
  await expect(page.getByTestId('mobile-video-controls')).toBeVisible();
  await expect(page.getByTestId('mobile-navigation-sheet')).toHaveCount(0);
}

async function startCprSlideshow(page: Page) {
  await openView(page, 'CPR & AED');
  await setSwitch(page, 'Pediatric Focused', false);
  await setSwitch(page, 'Virtual Assistant', false);
  await page.getByRole('button', { name: 'Start course', exact: true }).click();
  await expect(page.getByTestId('slideshow-player')).toBeVisible();
  await expect(page.getByTestId('mobile-navigation-sheet')).toHaveCount(0);
}

async function openManual(page: Page) {
  await openView(page, 'Manuals');
  await page.getByRole('button', { name: 'Open manual', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close Manual' })).toBeVisible({ timeout: 20_000 });
}

async function swipe(
  page: Page,
  selector: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  pointerId = 1,
) {
  const target = page.locator(selector);
  await target.dispatchEvent('pointerdown', { pointerId, pointerType: 'touch', isPrimary: true, clientX: start.x, clientY: start.y, buttons: 1 });
  await target.dispatchEvent('pointermove', { pointerId, pointerType: 'touch', isPrimary: true, clientX: end.x, clientY: end.y, buttons: 1 });
  await target.dispatchEvent('pointerup', { pointerId, pointerType: 'touch', isPrimary: true, clientX: end.x, clientY: end.y, buttons: 0 });
}

async function installStandardFullscreenFake(page: Page) {
  await page.addInitScript(() => {
    let active: Element | null = null;
    const state = { failEntry: false, failExit: false, requestedTarget: '' };
    Object.defineProperty(window, '__phase5Fullscreen', { configurable: true, value: state });
    Object.defineProperty(Document.prototype, 'fullscreenElement', {
      configurable: true,
      get: () => active,
    });
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      value: function requestFullscreen(this: Element) {
        state.requestedTarget = this.getAttribute('data-testid')
          ?? (this.hasAttribute('data-manual-reader-root') ? 'manual-reader' : this.className?.toString() ?? this.tagName);
        if (state.failEntry) return Promise.reject(new DOMException('entry rejected', 'NotAllowedError'));
        active = this;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      },
    });
    Object.defineProperty(Document.prototype, 'exitFullscreen', {
      configurable: true,
      value: function exitFullscreen() {
        if (state.failExit) return Promise.reject(new DOMException('exit rejected', 'NotAllowedError'));
        active = null;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      },
    });
  });
}

test.describe('Phase 5 audio and state ownership', () => {
  test('restores audible first play and preserves one audible owner across chapter commit', async ({ page }) => {
    await bootMobile(page);
    await startCprVideo(page);
    await expect.poll(async () => page.locator('[data-media-state="loading"]').count(), { timeout: 20_000 }).toBe(0);

    const active = page.locator('video[data-media-active="true"]');
    const originalSource = await active.getAttribute('src');
    await page.getByRole('button', { name: 'Play narration' }).click();
    await expect(page.getByRole('button', { name: 'Pause narration' })).toBeVisible();
    await expect.poll(async () => active.evaluate((video: HTMLVideoElement) => ({ paused: video.paused, muted: video.muted, volume: video.volume }))).toEqual({ paused: false, muted: false, volume: 1 });
    await expect.poll(async () => page.locator('video').evaluateAll((videos: HTMLVideoElement[]) => videos.filter(video => !video.paused && !video.muted && video.volume > 0).length)).toBe(1);

    await page.getByRole('button', { name: 'Next section' }).click();
    await expect.poll(async () => page.locator('video[data-media-active="true"]').getAttribute('src'), { timeout: 20_000 }).not.toBe(originalSource);
    await expect.poll(async () => page.locator('video[data-media-active="true"]').evaluate((video: HTMLVideoElement) => ({ paused: video.paused, muted: video.muted, volume: video.volume }))).toEqual({ paused: false, muted: false, volume: 1 });
    await expect.poll(async () => page.locator('video').evaluateAll((videos: HTMLVideoElement[]) => videos.filter(video => !video.paused && !video.muted && video.volume > 0).length)).toBe(1);
  });

  test('keeps Continuous Play synchronized across settings, both course previews, and an active course list', async ({ page }) => {
    await bootMobile(page);
    await page.getByRole('button', { name: 'Open settings' }).click();
    await setSwitch(page, 'Continuous Play', true);
    await closeSheet(page);

    await openView(page, 'CPR & AED');
    await expect(page.getByRole('switch', { name: 'Continuous Play' })).toHaveAttribute('aria-checked', 'true');
    await setSwitch(page, 'Continuous Play', false);
    await closeSheet(page);

    await openView(page, 'First Aid');
    await expect(page.getByRole('switch', { name: 'Continuous Play' })).toHaveAttribute('aria-checked', 'false');
    await setSwitch(page, 'Continuous Play', true);
    await closeSheet(page);

    await openView(page, 'CPR & AED');
    await setSwitch(page, 'Virtual Assistant', false);
    await page.getByRole('button', { name: 'Start course', exact: true }).click();
    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'CPR & AED', exact: true }).click();
    await expect(page.getByTestId('cpr-active-list').getByRole('switch', { name: 'Continuous Play' })).toHaveAttribute('aria-checked', 'true');
    await closeSheet(page);
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByRole('switch', { name: 'Continuous Play' })).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('Phase 5 manual fallback', () => {
  test('bounds rendering to one page and preserves page/zoom truth through pan, turn, rotation, and the 768 seam', async ({ page }) => {
    test.setTimeout(90_000);
    await bootMobile(page, 390, 844);
    await openManual(page);
    const viewer = page.locator('[data-manual-viewer="windowed"]');
    await expect(viewer).toBeVisible({ timeout: 20_000 });
    await expect(viewer.locator('[data-pdf-page-host]')).toHaveCount(1);
    await expect(viewer.locator('canvas')).toHaveCount(1);
    await expect(page.getByRole('slider', { name: 'Manual page progress' })).toHaveAttribute('aria-valuenow', '1');

    const railBox = await page.getByTestId('mobile-bottom-nav').boundingBox();
    expect(railBox).not.toBeNull();
    for (const control of [
      page.getByRole('button', { name: 'Previous manual page' }),
      page.getByRole('slider', { name: 'Manual page progress' }),
      page.getByLabel(/Manual page 1 of .*Enter a page number/),
      page.getByRole('button', { name: 'Next manual page' }),
    ]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(railBox!.y);
    }
    await page.getByRole('button', { name: 'Next manual page' }).click();
    await expect(page.getByRole('slider', { name: 'Manual page progress' })).toHaveAttribute('aria-valuenow', '2');
    await page.getByRole('button', { name: 'Previous manual page' }).click();
    await expect(page.getByRole('slider', { name: 'Manual page progress' })).toHaveAttribute('aria-valuenow', '1');

    await page.getByRole('button', { name: 'Magnify manual page' }).click();
    await expect(page.getByRole('button', { name: 'Reset manual zoom' })).toHaveAttribute('aria-pressed', 'true');
    const zoomed = await viewer.evaluate(element => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, touchAction: getComputedStyle(element).touchAction }));
    expect(zoomed.scrollWidth).toBeGreaterThan(zoomed.clientWidth);
    expect(zoomed.touchAction).toMatch(/pan-x|manipulation/);
    await viewer.evaluate(element => { element.scrollLeft = 60; });
    await expect.poll(() => viewer.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);

    await swipe(page, '[data-manual-viewer="windowed"]', { x: 310, y: 380 }, { x: 180, y: 382 });
    await expect(page.getByRole('slider', { name: 'Manual page progress' })).toHaveAttribute('aria-valuenow', '1');
    await page.getByRole('button', { name: 'Reset manual zoom' }).click();
    await swipe(page, '[data-manual-viewer="windowed"]', { x: 310, y: 380 }, { x: 180, y: 382 });
    await expect(page.getByRole('slider', { name: 'Manual page progress' })).toHaveAttribute('aria-valuenow', '2');

    const jump = page.getByLabel(/Manual page 2 of .*Enter a page number/);
    await jump.fill('3');
    await jump.press('Enter');
    await expect(page.getByRole('slider', { name: 'Manual page progress' })).toHaveAttribute('aria-valuenow', '3');
    await page.getByRole('button', { name: 'Magnify manual page' }).click();
    await page.setViewportSize({ width: 667, height: 375 });
    await expect(viewer).toHaveAttribute('data-current-page', '3');
    await expect(viewer.locator('canvas')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Reset manual zoom' })).toHaveAttribute('aria-pressed', 'true');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(viewer).toHaveAttribute('data-current-page', '3');
    await expect(page.getByRole('button', { name: 'Reset manual zoom' })).toHaveAttribute('aria-pressed', 'true');

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-manual-viewer="windowed"]')).toHaveCount(0);
    await expect(page.locator('.flipbook-canvas')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('slider', { name: 'Manual page progress' })).toHaveAttribute('aria-valuenow', '3');
    await expect(page.getByRole('button', { name: 'Reset manual zoom' })).toHaveAttribute('aria-pressed', 'true');
    const renderedPages = await page.locator('.flipbook-canvas canvas').count();
    expect(renderedPages).toBeLessThanOrEqual(9);
    await page.setViewportSize({ width: 820, height: 1180 });
    await expect(page.locator('.flipbook-canvas')).toBeVisible();
  });
});

test.describe('Phase 5 slideshow gestures', () => {
  test('commits one horizontal slide and excludes vertical, edge, interactive, and multi-touch starts', async ({ page }) => {
    await bootMobile(page);
    await startCprSlideshow(page);
    const counter = page.getByTestId('slideshow-counter');
    await expect(counter).toHaveText(/^Slide 1 of /);
    const targetMetrics = await page.getByTestId('slideshow-player').locator('.mobile-coarse-target:visible').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      const pseudo = getComputedStyle(element, '::after');
      return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: Number.parseFloat(pseudo.width), height: Number.parseFloat(pseudo.height) };
    }));
    for (const metric of targetMetrics) {
      expect(metric.width).toBeGreaterThanOrEqual(44);
      expect(metric.height).toBeGreaterThanOrEqual(44);
    }
    for (let left = 0; left < targetMetrics.length; left += 1) {
      for (let right = left + 1; right < targetMetrics.length; right += 1) {
        const a = targetMetrics[left];
        const b = targetMetrics[right];
        const overlaps = Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2;
        expect(overlaps).toBe(false);
      }
    }

    await swipe(page, '[data-testid="slideshow-player"]', { x: 310, y: 360 }, { x: 210, y: 362 });
    await expect(counter).toHaveText(/^Slide 2 of /);
    await swipe(page, '[data-testid="slideshow-player"]', { x: 250, y: 250 }, { x: 245, y: 350 }, 2);
    await expect(counter).toHaveText(/^Slide 2 of /);
    await swipe(page, '[data-testid="slideshow-player"]', { x: 10, y: 350 }, { x: 120, y: 350 }, 3);
    await expect(counter).toHaveText(/^Slide 2 of /);

    const next = page.getByRole('button', { name: 'Next slide' });
    const box = await next.boundingBox();
    expect(box).not.toBeNull();
    await next.dispatchEvent('pointerdown', { pointerId: 4, pointerType: 'touch', isPrimary: true, clientX: box!.x + 10, clientY: box!.y + 10, buttons: 1 });
    await next.dispatchEvent('pointermove', { pointerId: 4, pointerType: 'touch', isPrimary: true, clientX: box!.x - 90, clientY: box!.y + 10, buttons: 1 });
    await next.dispatchEvent('pointerup', { pointerId: 4, pointerType: 'touch', isPrimary: true, clientX: box!.x - 90, clientY: box!.y + 10, buttons: 0 });
    await expect(counter).toHaveText(/^Slide 2 of /);

    const stage = page.getByTestId('slideshow-player');
    await stage.dispatchEvent('pointerdown', { pointerId: 5, pointerType: 'touch', isPrimary: true, clientX: 300, clientY: 350, buttons: 1 });
    await stage.dispatchEvent('pointerdown', { pointerId: 6, pointerType: 'touch', isPrimary: false, clientX: 270, clientY: 350, buttons: 1 });
    await stage.dispatchEvent('pointermove', { pointerId: 5, pointerType: 'touch', isPrimary: true, clientX: 190, clientY: 350, buttons: 1 });
    await stage.dispatchEvent('pointerup', { pointerId: 6, pointerType: 'touch', isPrimary: false, clientX: 270, clientY: 350, buttons: 0 });
    await stage.dispatchEvent('pointerup', { pointerId: 5, pointerType: 'touch', isPrimary: true, clientX: 190, clientY: 350, buttons: 0 });
    await expect(counter).toHaveText(/^Slide 2 of /);
  });

  test('swipes away from a playing video with paused media and truthful next-slide controls', async ({ page }) => {
    await bootMobile(page);
    await startCprSlideshow(page);
    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'CPR & AED', exact: true }).click();
    await page.getByTestId('cpr-active-list').locator('[data-item-id="slide-8"] button').first().click();
    await expect(page.getByTestId('slideshow-counter')).toContainText('Slide 8 of ');
    const play = page.getByRole('button', { name: 'Play slideshow video' });
    if (await play.isVisible()) await play.click();
    await expect(page.getByRole('button', { name: 'Pause slideshow video' })).toBeVisible({ timeout: 20_000 });
    await swipe(page, '[data-testid="slideshow-player"]', { x: 310, y: 350 }, { x: 200, y: 350 });
    await expect(page.getByTestId('slideshow-counter')).toContainText('Slide 9 of ');
    await expect(page.getByRole('img', { name: 'Course Overview' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Static image slide' })).toBeVisible();
    await expect.poll(async () => page.locator('video').evaluateAll((videos: HTMLVideoElement[]) => videos.every(video => video.paused))).toBe(true);
  });
});

test.describe('Phase 5 fullscreen capability routing', () => {
  test('targets each standard owner, covers both video control branches, and preserves content on rejected entry/exit', async ({ page }) => {
    await installStandardFullscreenFake(page);
    await bootMobile(page);
    await startCprVideo(page);
    const fullscreen = page.getByRole('button', { name: 'Toggle fullscreen view' });
    await fullscreen.click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
    await expect(page.getByTestId('mobile-header')).toHaveClass(/-translate-y-full/);
    expect(await page.evaluate(() => (window as unknown as { __phase5Fullscreen: { requestedTarget: string } }).__phase5Fullscreen.requestedTarget)).toContain('mobile-video-stage');
    await page.getByRole('button', { name: 'Close course' }).click({ force: true });
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    await expect(page.getByTestId('mobile-video-controls')).toBeVisible();
    await page.getByRole('button', { name: 'Toggle fullscreen view' }).click();
    await page.getByTestId('mobile-header').getByRole('button', { name: 'Return to menu' }).dispatchEvent('click');
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    await expect(page.getByTestId('mobile-video-controls')).toBeVisible();
    await page.getByRole('button', { name: 'Toggle fullscreen view' }).click();
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('mobile-bottom-nav')).toHaveCount(0);
    await page.getByRole('button', { name: 'Toggle fullscreen view' }).click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
    await page.getByRole('button', { name: 'Toggle fullscreen view' }).click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('mobile-header').getByRole('button', { name: 'Return to menu' }).click();
    await startCprSlideshow(page);
    await page.getByRole('button', { name: 'Toggle slideshow fullscreen' }).click();
    expect(await page.evaluate(() => (window as unknown as { __phase5Fullscreen: { requestedTarget: string } }).__phase5Fullscreen.requestedTarget)).toBe('slideshow-player');
    await page.getByTitle('Close Slideshow').click();
    await expect(page.getByTestId('slideshow-player')).toBeVisible();
    await page.getByTitle('Close Slideshow').click();
    await expect(page.getByTestId('slideshow-player')).toHaveCount(0);

    await openManual(page);
    await page.getByRole('button', { name: 'Toggle manual fullscreen' }).click();
    expect(await page.evaluate(() => (window as unknown as { __phase5Fullscreen: { requestedTarget: string } }).__phase5Fullscreen.requestedTarget)).toBe('manual-reader');
    await page.getByRole('button', { name: 'Close Manual' }).click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    await expect(page.getByRole('button', { name: 'Close Manual' })).toBeVisible();
    await page.getByRole('button', { name: 'Toggle manual fullscreen' }).click();
    await page.evaluate(() => { (window as unknown as { __phase5Fullscreen: { failExit: boolean } }).__phase5Fullscreen.failExit = true; });
    await page.getByRole('button', { name: 'Toggle manual fullscreen' }).click();
    await expect(page.getByRole('button', { name: 'Close Manual' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
    await page.evaluate(() => { (window as unknown as { __phase5Fullscreen: { failExit: boolean } }).__phase5Fullscreen.failExit = false; });
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    await page.getByRole('button', { name: 'Close Manual' }).click();

    await startCprVideo(page);
    await page.evaluate(() => { (window as unknown as { __phase5Fullscreen: { failEntry: boolean } }).__phase5Fullscreen.failEntry = true; });
    await page.getByRole('button', { name: 'Toggle fullscreen view' }).click();
    await expect(page.getByRole('button', { name: 'Toggle fullscreen view' })).toHaveCount(0);
    await expect(page.getByTestId('mobile-video-controls')).toBeVisible();
  });

  test('re-evaluates legacy video capability after metadata, tracks active slots, and hides unavailable or failed routes', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      const state = { metadata: false, supports: true, calls: 0, fail: false };
      Object.defineProperty(window, '__phase5Legacy', { configurable: true, value: state });
      Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined });
      Object.defineProperty(Document.prototype, 'exitFullscreen', { configurable: true, value: undefined });
      Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => state.metadata ? 1 : 0 });
      Object.defineProperty(HTMLVideoElement.prototype, 'webkitSupportsFullscreen', { configurable: true, get: () => state.supports });
      Object.defineProperty(HTMLVideoElement.prototype, 'webkitEnterFullscreen', {
        configurable: true,
        value: function webkitEnterFullscreen(this: HTMLVideoElement) {
          state.calls += 1;
          if (state.fail) throw new DOMException('legacy rejected', 'NotAllowedError');
          this.dispatchEvent(new Event('webkitbeginfullscreen'));
        },
      });
    });
    await bootMobile(page);
    await startCprVideo(page);
    await expect(page.getByRole('button', { name: 'Toggle fullscreen view' })).toHaveCount(0);
    await page.evaluate(() => {
      (window as unknown as { __phase5Legacy: { metadata: boolean } }).__phase5Legacy.metadata = true;
      document.querySelector<HTMLVideoElement>('video[data-media-active="true"]')?.dispatchEvent(new Event('loadedmetadata'));
    });
    await expect(page.getByRole('button', { name: 'Toggle fullscreen view' })).toBeVisible();
    await page.getByRole('button', { name: 'Toggle fullscreen view' }).click();
    await expect(page.getByTestId('mobile-header')).toHaveClass(/-translate-y-full/);
    expect(await page.evaluate(() => (window as unknown as { __phase5Legacy: { calls: number } }).__phase5Legacy.calls)).toBe(1);
    await page.locator('video[data-media-active="true"]').dispatchEvent('webkitendfullscreen');
    await expect(page.getByTestId('mobile-header')).not.toHaveClass(/-translate-y-full/);

    await page.getByRole('button', { name: 'Next section' }).click();
    await expect.poll(async () => page.locator('[data-media-state="loading"]').count(), { timeout: 20_000 }).toBe(0);
    await page.locator('video[data-media-active="true"]').dispatchEvent('loadedmetadata');
    await expect(page.getByRole('button', { name: 'Toggle fullscreen view' })).toBeVisible();
    await page.evaluate(() => { (window as unknown as { __phase5Legacy: { fail: boolean } }).__phase5Legacy.fail = true; });
    await page.getByRole('button', { name: 'Toggle fullscreen view' }).click();
    await expect(page.getByRole('button', { name: 'Toggle fullscreen view' })).toHaveCount(0);

    await page.evaluate(() => {
      const state = (window as unknown as { __phase5Legacy: { fail: boolean; supports: boolean } }).__phase5Legacy;
      state.fail = false;
      state.supports = false;
      document.querySelector<HTMLVideoElement>('video[data-media-active="true"]')?.dispatchEvent(new Event('emptied'));
    });
    await expect(page.getByRole('button', { name: 'Toggle fullscreen view' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close course' }).click();
    await startCprSlideshow(page);
    await expect(page.getByRole('button', { name: 'Toggle slideshow fullscreen' })).toHaveCount(0);
    await page.getByTitle('Close Slideshow').click();
    await openManual(page);
    await expect(page.getByRole('button', { name: 'Toggle manual fullscreen' })).toHaveCount(0);
  });
});

test.describe('Phase 5 responsive completion', () => {
  test('does not request mobile presentation chunks on a desktop-only load', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'load' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await expect(page.getByTestId('mobile-bottom-nav')).toHaveCount(0);
    const mobileChunks = await page.evaluate(() => performance.getEntriesByType('resource')
      .map(entry => entry.name)
      .filter(name => name.includes('MobileShell-') || name.includes('MobileSlideshowControls-')));
    expect(mobileChunks).toEqual([]);
  });

  test('keeps online and offline Send Certs usable at 375 px with keyboard-operable online cards', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'open', {
        configurable: true,
        value: (url?: string | URL) => {
          Object.defineProperty(window, '__phase5OpenedUrl', { configurable: true, writable: true, value: String(url ?? '') });
          return null;
        },
      });
    });
    await bootMobile(page, 375, 667);
    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'Certs', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'EH Academy Portal' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const card = page.getByRole('button', { name: 'Open portal for CPR AED and First Aid certification cards' });
    await card.focus();
    await expect(card).toBeFocused();
    await card.press('Enter');
    expect(await page.evaluate(() => (window as unknown as { __phase5OpenedUrl?: string }).__phase5OpenedUrl)).toBe('https://ehacademy.com/login');
    await expect(page.getByRole('button', { name: 'Close Send Certs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Instructor Portal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Step-by-Step Roster Guide' })).toBeVisible();

    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByRole('heading', { name: 'Offline Mode' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Close Send Certs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry Connection' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Step-by-Step Roster Guide' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ehacademy.com', exact: true })).toBeVisible();
  });

  test('reaches every How-To path at 375 px and scopes the approved Continuous Play copy to mobile', async ({ page }) => {
    await bootMobile(page, 375, 667);
    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.getByRole('button', { name: 'Guide', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'EH Academy Training Guides' });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);

    await page.getByRole('button', { name: 'Open Guide to Using the App' }).click();
    await expect(page.getByText('Continuous Play can be turned on in the course menu or in Settings (the gear icon at the top of the screen).')).toBeVisible();
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
    await page.getByRole('button', { name: 'Open Guide to Teaching' }).click();
    await expect(page.getByRole('heading', { name: 'Guide to Teaching a Course' })).toBeVisible();
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
    await page.getByRole('button', { name: 'Open Guide to Issuing Certs' }).click();
    await expect(page.getByRole('heading', { name: 'Guide to Issuing Certifications' })).toBeVisible();
    await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
    await page.getByRole('button', { name: 'Open Guide to Using the App' }).click();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByText('Continuous Play can be turned on in the course menu or in Settings (the gear icon at the top of the screen).')).toHaveCount(0);
    await expect(page.getByText(/Toggle Continuous Play ON in the bottom left of the sidebar/)).toBeVisible();
  });

  test('preserves active video ownership across the 768/1024 portrait-landscape seam', async ({ page }) => {
    await bootMobile(page, 768, 1024);
    await startCprVideo(page);
    await expect.poll(async () => page.locator('[data-media-state="loading"]').count(), { timeout: 20_000 }).toBe(0);
    const source = await page.locator('video[data-media-active="true"]').getAttribute('src');
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('mobile-bottom-nav')).toHaveCount(0);
    await expect(page.locator('video[data-media-active="true"]')).toHaveAttribute('src', source!);
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible();
    await expect(page.locator('video[data-media-active="true"]')).toHaveAttribute('src', source!);
  });

  test('preserves slideshow-video index and playing truth across the iPad seam', async ({ page }) => {
    await bootMobile(page, 768, 1024);
    await startCprSlideshow(page);
    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'CPR & AED', exact: true }).click();
    await page.getByTestId('cpr-active-list').locator('[data-item-id="slide-8"] button').first().click();
    const play = page.getByRole('button', { name: 'Play slideshow video' });
    if (await play.isVisible()) await play.click();
    await expect(page.getByRole('button', { name: 'Pause slideshow video' })).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => page.locator('video').evaluateAll((videos: HTMLVideoElement[]) => videos.some(video => !video.paused))).toBe(true);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('mobile-bottom-nav')).toHaveCount(0);
    await expect(page.getByText(/^Slide 8 of \d+$/)).toBeVisible();
    await expect(page.getByTitle('Pause Video Slide')).toBeVisible();
    await expect.poll(() => page.locator('video').evaluateAll((videos: HTMLVideoElement[]) => videos.some(video => !video.paused))).toBe(true);

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible();
    await expect(page.getByTestId('slideshow-counter')).toContainText('Slide 8 of ');
    await expect(page.getByRole('button', { name: 'Pause slideshow video' })).toBeVisible();
  });
});
