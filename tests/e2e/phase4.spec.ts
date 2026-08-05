import { expect, Page, Route, test } from '@playwright/test';

import { setupStrictErrors, type ExpectedError } from './helpers/strict-errors';

let verifyStrictErrors: (() => void) | null = null;
let strictExpectedErrors: ExpectedError[] = [];
test.beforeEach(async ({ page }) => {
  strictExpectedErrors = [];
  verifyStrictErrors = setupStrictErrors(page, strictExpectedErrors).verify;
});
test.afterEach(() => {
  verifyStrictErrors?.();
  verifyStrictErrors = null;
});

type EhState = {
  ehKind?: 'nav' | 'player' | 'download' | 'guide';
  ehView?: 'cpr' | 'first-aid' | 'manuals' | 'settings';
  ehDepth?: number;
  ehSession?: string;
  ehEntry?: number;
  ehRoot?: number;
  ehParent?: number;
  ehContent?: { kind: string; targetId?: string; itemId?: string };
  ehRetired?: boolean;
};

async function bootMobile(page: Page, width = 375, height = 812) {
  await page.setViewportSize({ width, height });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-app-ready="true"]').waitFor();
  await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible();
}

async function state(page: Page): Promise<EhState> {
  return page.evaluate(() => window.history.state as EhState);
}

async function openView(page: Page, name: 'CPR & AED' | 'First Aid' | 'Manuals') {
  await page.getByTestId('mobile-bottom-nav').getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId('mobile-navigation-sheet')).toBeVisible();
}

async function closeSheet(page: Page) {
  await page.getByRole('button', { name: 'Close course menu' }).click();
  await expect(page.getByTestId('mobile-navigation-sheet')).toBeHidden();
}

async function setSwitch(page: Page, name: string, checked: boolean) {
  const control = page.getByRole('switch', { name, exact: true });
  if ((await control.getAttribute('aria-checked')) !== String(checked)) await control.click();
  await expect(control).toHaveAttribute('aria-checked', String(checked));
}

async function startCprSlideshow(page: Page) {
  await openView(page, 'CPR & AED');
  await setSwitch(page, 'Pediatric Focused', false);
  await setSwitch(page, 'Virtual Assistant', false);
  await page.getByRole('button', { name: 'Start course', exact: true }).click();
  await expect(page.getByTitle('Close Slideshow')).toBeVisible();
  await expect(page.getByTestId('mobile-navigation-sheet')).toHaveCount(0);
}

async function startCprVideo(page: Page) {
  await openView(page, 'CPR & AED');
  await setSwitch(page, 'Pediatric Focused', false);
  await setSwitch(page, 'Virtual Assistant', true);
  await page.getByRole('button', { name: 'Start course', exact: true }).click();
  await expect(page.getByTestId('mobile-video-controls')).toBeVisible();
  await expect(page.getByTestId('mobile-navigation-sheet')).toHaveCount(0);
}

function holdInstructorManualRequests(count = 1) {
  const markRequested: Array<() => void> = [];
  const releaseRequest: Array<() => void> = [];
  const markSettled: Array<() => void> = [];
  const requested = Array.from({ length: count }, (_, index) => new Promise<void>(resolve => { markRequested[index] = resolve; }));
  const released = Array.from({ length: count }, (_, index) => new Promise<void>(resolve => { releaseRequest[index] = resolve; }));
  const settled = Array.from({ length: count }, (_, index) => new Promise<void>(resolve => { markSettled[index] = resolve; }));
  let requestIndex = 0;
  const handler = async (route: Route) => {
    const ownedIndex = requestIndex++;
    if (ownedIndex >= count) {
      await route.continue().catch(() => undefined);
      return;
    }

    markRequested[ownedIndex]();
    await released[ownedIndex];
    await route.continue().catch(() => undefined);
    markSettled[ownedIndex]();
  };

  return {
    handler,
    release: (index = 0) => releaseRequest[index](),
    requested,
    settleStarted: () => Promise.all(settled.slice(0, Math.min(requestIndex, count))),
  };
}

test.describe('Phase 4 mobile ownership and selection', () => {
  test('uses the exact 1023/1024 boundary and always preserves the Tauri desktop tree', async ({ page }) => {
    await bootMobile(page, 1023, 768);
    await expect(page.locator('button[title="Select CPR & AED Course Edition"]')).toHaveCount(0);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('mobile-bottom-nav')).toHaveCount(0);
    await expect(page.locator('button[title="Select CPR & AED Course Edition"]')).toHaveCount(1);

    await page.addInitScript(() => {
      let callbackId = 0;
      const callbacks: Record<number, (payload: unknown) => void> = {};
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        configurable: true,
        value: {
          callbacks,
          transformCallback(callback?: (payload: unknown) => void, once = false) {
            const id = ++callbackId;
            if (callback) callbacks[id] = payload => {
              if (once) delete callbacks[id];
              callback(payload);
            };
            return id;
          },
          unregisterCallback(id: number) { delete callbacks[id]; },
          runCallback(id: number, payload: unknown) { callbacks[id]?.(payload); },
          convertFileSrc(path: string) { return `http://asset.localhost/${encodeURIComponent(path)}`; },
          async invoke(command: string) {
            if (command === 'check_media_files_status' || command === 'get_media_file_mtimes') return {};
            if (command === 'check_media_file_exists') return false;
            if (command === 'check_disk_space') return 1_000_000_000;
            if (command.includes('plugin:event|listen')) return 1;
            return null;
          },
          metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
        },
      });
    });
    await page.route('http://media.localhost/**', route => route.fulfill({ status: 200, body: '' }));
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await expect(page.getByTestId('mobile-bottom-nav')).toHaveCount(0);
    await expect(page.locator('button[title="Select CPR & AED Course Edition"]')).toHaveCount(1);
  });

  test('exposes all four destinations and settings without duplicate navigation landmarks', async ({ page }) => {
    await bootMobile(page);
    for (const [button, heading] of [
      ['CPR & AED', 'CPR & AED'],
      ['First Aid', 'First Aid'],
      ['Manuals', 'Training Manuals'],
    ] as const) {
      await openView(page, button);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Course navigation' })).toHaveCount(1);
      await closeSheet(page);
    }
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByTestId('mobile-settings-panel')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Continuous Play' })).toBeVisible();
    await closeSheet(page);
    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'Certs', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'EH Academy Portal' })).toBeVisible();
    await expect(await state(page)).toMatchObject({ ehKind: 'player', ehDepth: 1 });
  });

  test('renders the eight shared selection states and derives both unavailable combinations from data', async ({ page }) => {
    await bootMobile(page);
    for (const family of ['CPR & AED', 'First Aid'] as const) {
      await openView(page, family);
      for (const [pediatric, va, available] of [
        [false, false, true],
        [false, true, true],
        [true, false, true],
        [true, true, false],
      ] as const) {
        await setSwitch(page, 'Pediatric Focused', pediatric);
        await setSwitch(page, 'Virtual Assistant', va);
        const action = page.getByRole('button', { name: available ? 'Start course' : 'Coming soon', exact: true });
        await expect(action).toHaveCount(1);
        if (available) await expect(action).toBeEnabled();
        else {
          await expect(action).toBeDisabled();
          await expect(page.getByText('To launch the Pediatric course, disable the Virtual Assistant.')).toBeVisible();
        }
      }
      await closeSheet(page);
    }
  });
});

test.describe('Phase 4 managed history', () => {
  test('supports base to sheet to player, native Back/Forward restoration, replacement, and Home', async ({ page }) => {
    await bootMobile(page);
    const base = await state(page);
    expect(base.ehDepth).toBe(0);
    expect(base.ehEntry).toBe(base.ehRoot);
    expect(base.ehSession).toBeTruthy();
    const initialLength = await page.evaluate(() => history.length);

    await openView(page, 'CPR & AED');
    expect(await state(page)).toMatchObject({ ehKind: 'nav', ehView: 'cpr', ehDepth: 1, ehParent: base.ehEntry, ehSession: base.ehSession });
    await expect.poll(async () => page.evaluate(() => history.length)).toBe(initialLength + 1);
    const sheetState = await state(page);
    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'CPR & AED', exact: true }).click();
    expect(await state(page)).toEqual(sheetState);

    await page.getByRole('button', { name: 'Start course', exact: true }).click();
    await expect(page.getByTitle('Close Slideshow')).toBeVisible();
    expect(await state(page)).toMatchObject({
      ehKind: 'player',
      ehDepth: 1,
      ehEntry: sheetState.ehEntry,
      ehContent: { kind: 'slideshow', targetId: 'cpr-aed-course', itemId: 'slide-1' },
    });
    expect(await page.evaluate(() => history.length)).toBe(initialLength + 1);

    await page.evaluate(() => window.history.back());
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
    await expect(page.getByTitle('Close Slideshow')).toHaveCount(0);

    await page.evaluate(() => window.history.forward());
    await expect(page.getByTitle('Close Slideshow')).toBeVisible();
    expect(await state(page)).toMatchObject({ ehKind: 'player', ehDepth: 1 });

    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'CPR & AED', exact: true }).click();
    await expect(page.getByTestId('cpr-active-list')).toBeVisible();
    const playerState = await state(page);
    expect(playerState).toMatchObject({ ehKind: 'nav', ehDepth: 2 });
    expect(playerState.ehEntry).not.toBe(sheetState.ehEntry);
    expect(playerState.ehParent).toBe(sheetState.ehEntry);
    const lengthBeforeReplacement = await page.evaluate(() => history.length);
    const secondSlide = page.getByTestId('cpr-active-list').getByRole('button').nth(1);
    await secondSlide.click();
    await expect.poll(async () => (await state(page)).ehKind).toBe('player');
    await expect.poll(async () => (await state(page)).ehDepth).toBe(1);
    expect(await page.evaluate(() => history.length)).toBe(lengthBeforeReplacement);

    await page.getByRole('button', { name: 'Return to menu' }).click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
    await expect(page.getByTitle('Close Slideshow')).toHaveCount(0);
  });

  test('normalizes a refreshed managed entry and safely rejects retired-session Forward', async ({ page }) => {
    await bootMobile(page);
    await startCprSlideshow(page);
    const oldSession = (await state(page)).ehSession;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
    expect((await state(page)).ehSession).not.toBe(oldSession);
    await page.evaluate(() => window.history.forward());
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
    await expect(page.getByTitle('Close Slideshow')).toHaveCount(0);
  });

  test('serializes rapid breakpoint seams without tearing down active content', async ({ page }) => {
    await bootMobile(page);
    await startCprSlideshow(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('mobile-bottom-nav')).toHaveCount(0);
    await expect(page.getByTitle('Close Slideshow')).toBeVisible();
    await expect(page.getByTitle('Expand Sidebar Menu')).toBeVisible();
    await page.getByTitle('Expand Sidebar Menu').click();
    await expect(page.getByTitle('Collapse Sidebar Menu')).toBeVisible();
    await page.setViewportSize({ width: 1023, height: 768 });
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTitle('Collapse Sidebar Menu')).toBeVisible();
    await page.setViewportSize({ width: 1023, height: 768 });
    await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible();
    await expect(page.getByTitle('Close Slideshow')).toBeVisible();
    await expect.poll(async () => (await state(page)).ehKind).toBe('player');
  });

  test('restores video paused, slideshow paused, manual, Certs, and a Certs-stacked Guide through Forward', async ({ page }) => {
    await bootMobile(page);

    await startCprVideo(page);
    await page.getByTestId('mobile-header').getByRole('button', { name: 'Return to menu' }).click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
    await page.evaluate(() => history.forward());
    await expect(page.getByTestId('mobile-video-controls')).toBeVisible();
    await expect.poll(async () => page.locator('video[data-media-active="true"]').evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
    await page.getByTestId('mobile-header').getByRole('button', { name: 'Return to menu' }).click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);

    await startCprSlideshow(page);
    await page.getByTestId('mobile-header').getByRole('button', { name: 'Return to menu' }).click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
    await page.evaluate(() => history.forward());
    await expect(page.getByTitle('Close Slideshow')).toBeVisible();
    await expect(page.getByTitle('Static Image Slide')).toBeVisible();
    await page.getByTestId('mobile-header').getByRole('button', { name: 'Return to menu' }).click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);

    await openView(page, 'Manuals');
    await page.getByRole('button', { name: 'Open manual', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close Manual' })).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('mobile-header').getByRole('button', { name: 'Return to menu' }).click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
    await page.evaluate(() => history.forward());
    await expect(page.getByRole('button', { name: 'Close Manual' })).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('mobile-header').getByRole('button', { name: 'Return to menu' }).click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);

    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'Certs', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'EH Academy Portal' })).toBeVisible();
    await page.getByRole('button', { name: 'View Step-by-Step Roster Guide' }).click({ noWaitAfter: true });
    await expect(page.getByRole('dialog', { name: 'EH Academy Training Guides' })).toBeVisible();
    expect(await state(page)).toMatchObject({ ehKind: 'guide', ehDepth: 2 });
    await page.evaluate(() => history.back());
    await expect(page.getByRole('dialog', { name: 'EH Academy Training Guides' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'EH Academy Portal' })).toBeVisible();
    expect(await state(page)).toMatchObject({ ehKind: 'player', ehDepth: 1, ehContent: { kind: 'certs' } });
    await page.getByTestId('mobile-header').getByRole('button', { name: 'Return to menu' }).click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
    await page.evaluate(() => history.forward());
    await expect(page.getByRole('heading', { name: 'EH Academy Portal' })).toBeVisible();
  });

  test('refreshes from player, navigation, and modal to a fresh safe base without restoring content', async ({ page }) => {
    await bootMobile(page);
    await startCprSlideshow(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
    await expect(page.getByTitle('Close Slideshow')).toHaveCount(0);

    await openView(page, 'Manuals');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
    await expect(page.getByTestId('mobile-navigation-sheet')).toHaveCount(0);

    await page.getByRole('button', { name: 'Download app for offline use' }).click();
    await expect(page.getByTestId('download-app-dialog')).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
    await expect(page.getByTestId('download-app-dialog')).toHaveCount(0);
  });
});

test.describe('Phase 4 overlays, players, and layout', () => {
  test('locks and traps a sheet, stacks Guide over Settings, and restores focus on Escape', async ({ page }) => {
    await bootMobile(page);
    const settings = page.getByRole('button', { name: 'Open settings' });
    await settings.focus();
    await settings.click();
    const sheet = page.getByTestId('mobile-navigation-sheet');
    await expect(sheet).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('position', 'fixed');
    await expect(page.getByRole('button', { name: 'Close course menu' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(sheet.getByRole('button', { name: 'Certs', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Close course menu' })).toBeFocused();

    await sheet.getByRole('button', { name: 'Guide', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'EH Academy Training Guides' })).toBeVisible();
    await expect(sheet).toHaveAttribute('inert', '');
    expect(await state(page)).toMatchObject({ ehKind: 'guide', ehDepth: 2 });
    const guideCard = page.getByRole('button', { name: 'Open Guide to Using the App' });
    await guideCard.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('heading', { name: 'Guide to Using the App' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'EH Academy Training Guides' })).toHaveCount(0);
    await expect(page.getByTestId('mobile-settings-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
    await expect(settings).toBeFocused();
  });

  test('manages Download, manual, slideshow, video, and cert close routes through history', async ({ page }) => {
    await bootMobile(page);
    await page.getByRole('button', { name: 'Download app for offline use' }).click();
    await expect(page.getByTestId('download-app-dialog')).toBeVisible();
    expect(await state(page)).toMatchObject({ ehKind: 'download', ehDepth: 1 });
    await page.getByRole('button', { name: 'Close download dialog' }).click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);

    await openView(page, 'Manuals');
    await page.getByRole('button', { name: 'Open manual', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close Manual' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('mobile-navigation-sheet')).toHaveCount(0);
    expect(await state(page)).toMatchObject({ ehKind: 'player', ehDepth: 1 });
    await page.getByRole('button', { name: 'Close Manual' }).click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);

    await startCprSlideshow(page);
    await page.getByTitle('Close Slideshow').click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);

    await startCprVideo(page);
    await expect(page.getByRole('slider', { name: 'Video progress' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous section' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Play narration|Pause narration/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next section' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mute sound|Unmute sound/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Playback speed/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /subtitles/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toggle fullscreen view' })).toBeVisible();
    await expect(page.locator('input[type="range"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Close course' }).click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);

    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'Certs', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'EH Academy Portal' })).toBeVisible();
    await page.getByRole('button', { name: /Return to menu/i }).click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
  });

  test('fast-closes an in-flight manual without an unhandled rejection', async ({ page }) => {
    const heldManual = holdInstructorManualRequests();
    await page.route('**/instructor_manual.pdf', heldManual.handler);

    try {
      await bootMobile(page);
      await openView(page, 'Manuals');
      await page.getByRole('button', { name: 'Open manual', exact: true }).click();
      await heldManual.requested[0];
      await expect(page.locator('canvas').filter({ visible: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Close Manual' }).click();
      await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
    } finally {
      heldManual.release();
      await heldManual.settleStarted();
      await page.unroute('**/instructor_manual.pdf', heldManual.handler);
    }
  });

  test('fast-closes an in-flight manual restored through Forward without an unhandled rejection', async ({ page }) => {
    const heldManual = holdInstructorManualRequests(2);
    await page.route('**/instructor_manual.pdf', heldManual.handler);

    try {
      await bootMobile(page);
      await openView(page, 'Manuals');
      await page.getByRole('button', { name: 'Open manual', exact: true }).click();
      await heldManual.requested[0];
      await expect(page.locator('canvas').filter({ visible: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Close Manual' }).click();
      await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
      await page.evaluate(() => history.forward());
      await heldManual.requested[1];
      await expect(page.locator('canvas').filter({ visible: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Close Manual' }).click();
      await expect.poll(async () => (await state(page)).ehDepth).toBe(0);
    } finally {
      heldManual.release(0);
      heldManual.release(1);
      await heldManual.settleStarted();
      await page.unroute('**/instructor_manual.pdf', heldManual.handler);
    }
  });

  test('retries a failed manual without an unhandled teardown rejection', async ({ page }) => {
    strictExpectedErrors.push({
      channel: 'console',
      message: 'Failed to load resource: net::ERR_FAILED',
      pathname: '/instructor_manual.pdf',
      count: 1,
    });
    const failedManual = (url: URL) => url.href.endsWith('/instructor_manual.pdf');
    await page.route(failedManual, route => route.abort('failed'));

    await bootMobile(page);
    await openView(page, 'Manuals');
    await page.getByRole('button', { name: 'Open manual', exact: true }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Manual unavailable' });
    await expect(alert).toBeVisible({ timeout: 15_000 });

    await page.unroute(failedManual);
    await alert.getByRole('button', { name: /Retry/ }).click();
    await expect(page.locator('canvas').filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
  });

  test('isolates stage shortcuts under a sheet and suppresses synthetic mouse activity after a touch toggle', async ({ page }) => {
    await bootMobile(page);
    await startCprSlideshow(page);
    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'CPR & AED', exact: true }).click();
    const sheet = page.getByTestId('mobile-navigation-sheet');
    const slideCounter = page.getByText(/^Slide 1 of \d+$/);
    const before = await slideCounter.textContent();
    await sheet.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    expect(await slideCounter.textContent()).toBe(before);
    await closeSheet(page);
    await page.getByTestId('mobile-header').getByRole('button', { name: 'Return to menu' }).click();
    await expect.poll(async () => (await state(page)).ehDepth).toBe(0);

    await startCprVideo(page);
    await expect.poll(async () => page.locator('[data-media-state="loading"]').count(), { timeout: 20_000 }).toBe(0);
    const stage = page.locator('.mobile-video-stage');
    const controls = page.getByTestId('mobile-video-controls');
    await page.getByRole('button', { name: 'Play narration' }).click();
    await expect(page.getByRole('button', { name: 'Pause narration' })).toBeVisible();
    await stage.dispatchEvent('pointerup', { pointerType: 'touch', clientX: 100, clientY: 200 });
    await expect.poll(async () => controls.evaluate(element => getComputedStyle(element).opacity)).toBe('0');
    await stage.dispatchEvent('mousemove', { clientX: 102, clientY: 202 });
    await expect.poll(async () => controls.evaluate(element => getComputedStyle(element).opacity)).toBe('0');
    await stage.dispatchEvent('pointerup', { pointerType: 'touch', clientX: 100, clientY: 200 });
    await expect.poll(async () => controls.evaluate(element => getComputedStyle(element).opacity)).toBe('1');
  });

  test('keeps portrait and landscape controls clear of the bottom rail across target widths', async ({ page }, testInfo) => {
    const viewports = [
      { width: 375, height: 667 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 820, height: 1180 },
      { width: 667, height: 375 },
      { width: 844, height: 390 },
      { width: 932, height: 430 },
      { width: 1024, height: 768 },
      { width: 1180, height: 820 },
      { width: 1023, height: 768 },
      { width: 1440, height: 900 },
    ];
    await bootMobile(page, viewports[0].width, viewports[0].height);
    for (let index = 0; index < viewports.length; index += 1) {
      const viewport = viewports[index];
      await page.setViewportSize(viewport);
      const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
      if (viewport.width <= 1023) {
        await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible();
        const destination = (['CPR & AED', 'First Aid', 'Manuals'] as const)[index % 3];
        await openView(page, destination);
        await closeSheet(page);
        if (index === 0) {
          await page.getByRole('button', { name: 'Open settings' }).click();
          await expect(page.getByRole('button', { name: 'Offline Training?' })).toBeVisible();
          await expect(page.getByRole('button', { name: 'CPR & AED Onboarding Course' })).toBeVisible();
          await expect(page.getByRole('button', { name: 'First Aid Onboarding Course' })).toBeVisible();
          await closeSheet(page);
          await page.getByRole('button', { name: 'Download app for offline use' }).click();
          await expect(page.getByTestId('download-app-dialog')).toBeVisible();
          await page.getByRole('button', { name: 'Close download dialog' }).click();
          await expect(page.getByTestId('download-app-dialog')).toHaveCount(0);
        }
      } else {
        await expect(page.getByTestId('mobile-bottom-nav')).toHaveCount(0);
        await expect(page.locator('button[title="Select CPR & AED Course Edition"]')).toBeVisible();
      }
      await page.screenshot({ path: testInfo.outputPath(`viewport-${viewport.width}x${viewport.height}.png`), fullPage: false });
    }

    await page.setViewportSize({ width: 667, height: 375 });
    await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible();
    await startCprSlideshow(page);
    const nextSlide = await page.getByTitle('Next Slide').boundingBox();
    const nav = await page.getByTestId('mobile-bottom-nav').boundingBox();
    expect(nextSlide).not.toBeNull();
    expect(nav).not.toBeNull();
    expect(nextSlide!.y + nextSlide!.height).toBeLessThanOrEqual(nav!.y);
    await page.screenshot({ path: testInfo.outputPath('mobile-landscape-slideshow.png'), fullPage: false });
  });

  test('prefetches only the focused video chapter and never loads the mobile chunk on desktop', async ({ page }) => {
    const activeFragment = '01_EHAcademy%20-%20CPR%20AED%20Course%20Video-Introduction.mp4';
    const candidateFragment = '02_EHAcademy%20-%20CPR%20AED%20Course%20Video-Why%20are%20we%20here.mp4';
    const exactRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes(activeFragment) || request.url().includes(candidateFragment)) exactRequests.push(request.url());
    });
    await bootMobile(page);
    await startCprVideo(page);
    await expect.poll(() => exactRequests.filter(url => url.includes(activeFragment)).length, { timeout: 20_000 }).toBeGreaterThan(0);
    await expect.poll(async () => page.locator('[data-media-state="loading"]').count(), { timeout: 20_000 }).toBe(0);
    await expect(page.locator('[data-media-state="failed"]')).toHaveCount(0);
    expect(exactRequests.filter(url => url.includes(candidateFragment))).toHaveLength(0);
    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'CPR & AED', exact: true }).click();
    const secondChapter = page.locator('[data-media-row="chapter"][data-course-id="cpr-aed"][data-item-id="cpr-2"]').getByRole('button').first();
    await secondChapter.focus();
    await expect.poll(() => exactRequests.filter(url => url.includes(candidateFragment)).length, { timeout: 20_000 }).toBeGreaterThan(0);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('mobile-bottom-nav')).toHaveCount(0);
    await expect.poll(async () => (await state(page)).ehSession).toBeUndefined();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await page.waitForLoadState('load');
    const mobileChunkRequests = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name).filter(name => name.includes('MobileShell-')));
    expect(mobileChunkRequests).toEqual([]);
  });

  test('shows pending and failed state on only the selected chapter row and retries through the existing controller', async ({ page }) => {
    test.setTimeout(60_000);
    await bootMobile(page);
    await startCprVideo(page);
    await expect.poll(async () => page.locator('[data-media-state="loading"]').count(), { timeout: 20_000 }).toBe(0);
    strictExpectedErrors.push({
      channel: 'console',
      message: 'Failed to load resource: net::ERR_FAILED',
      pathname: '/CPR%20AED%20VA%20Slides/02_EHAcademy%20-%20CPR%20AED%20Course%20Video-Why%20are%20we%20here.mp4',
      count: 4,
    });
    const candidate = (url: URL) => url.href.includes('02_EHAcademy%20-%20CPR%20AED%20Course%20Video-Why%20are%20we%20here.mp4');
    await page.route(candidate, route => route.abort('failed'));

    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'CPR & AED', exact: true }).click();
    const rowSelector = '[data-media-row="chapter"][data-course-id="cpr-aed"][data-item-id="cpr-2"]';
    await page.locator(rowSelector).getByRole('button').first().click();
    await expect(page.getByTestId('mobile-navigation-sheet')).toHaveCount(0);
    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'CPR & AED', exact: true }).click();
    await expect(page.locator(rowSelector)).toHaveAttribute('data-media-row-state', 'loading');
    await expect(page.locator('[data-media-row-state="loading"]')).toHaveCount(1);
    await expect(page.locator('[data-media-state="retrying"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(rowSelector)).toHaveAttribute('data-media-row-state', 'failed', { timeout: 25_000 });
    await expect(page.locator('[data-media-row-state="failed"]')).toHaveCount(1);
    await expect(page.locator(rowSelector).getByRole('button', { name: /Retry/ })).toBeVisible();
    await expect(page.locator('video[data-media-active="true"]')).toHaveAttribute('src', /Introduction\.mp4/);

    await page.unroute(candidate);
    await page.locator(rowSelector).getByRole('button', { name: /Retry/ }).click();
    await expect.poll(async () => page.locator('video[data-media-active="true"]').getAttribute('src'), { timeout: 20_000 }).toContain('Why%20are%20we%20here.mp4');
  });

  test('uses non-overlapping 44px coarse-pointer targets and a reduced-motion sheet path', async ({ browser, page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await bootMobile(page);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await openView(page, 'CPR & AED');
    await closeSheet(page);

    const context = await browser.newContext({ hasTouch: true, viewport: { width: 375, height: 812 } });
    const touchPage = await context.newPage();
    const touchErrors = setupStrictErrors(touchPage, []);
    await bootMobile(touchPage);
    const metrics = await touchPage.evaluate(() => {
      const actions = Array.from(document.querySelectorAll<HTMLElement>('.mobile-header-actions .mobile-coarse-target'));
      return actions.map(element => {
        const box = element.getBoundingClientRect();
        const after = getComputedStyle(element, '::after');
        return { width: box.width, height: box.height, pseudoWidth: after.width, pseudoHeight: after.height };
      });
    });
    expect(metrics.length).toBeGreaterThan(0);
    for (const metric of metrics) {
      expect(metric.width).toBeGreaterThanOrEqual(44);
      expect(metric.height).toBeGreaterThanOrEqual(44);
      expect(Number.parseFloat(metric.pseudoWidth)).toBeGreaterThanOrEqual(44);
      expect(Number.parseFloat(metric.pseudoHeight)).toBeGreaterThanOrEqual(44);
    }
    const boxes = await touchPage.locator('.mobile-header-actions .mobile-coarse-target').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }));
    for (let index = 1; index < boxes.length; index += 1) expect(boxes[index].left).toBeGreaterThanOrEqual(boxes[index - 1].right);
    touchErrors.verify();
    await context.close();
  });
});
