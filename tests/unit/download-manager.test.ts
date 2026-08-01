import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => {
  throw new Error('Tauri core loader should not be called');
});

vi.mock('@tauri-apps/api/event', () => {
  throw new Error('Tauri event loader should not be called');
});

describe('download-manager fake platform', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    (global as any).window = { alert: vi.fn(), localStorage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } };
    (global.window as any).__TAURI_INTERNALS__ = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('proves constructor and all entry points do not invoke tauri loaders', async () => {
    // Import module in web mode. The mocks above will throw if construction tries to import tauri
    const { downloadManager } = await import('../../src/download-manager');

    // Run pending timers (constructor schedules checkAllStatuses)
    await vi.runAllTimersAsync();

    // Now test all entry points that can reach Tauri loader
    await downloadManager.startBulkDownload('everything');
    await downloadManager.startSingleDownload('test.mp4');
    await downloadManager.queueSpecificFiles([{ filename: 'test2.mp4', version: '1' }]);
    await downloadManager.checkStatusesForFiles(['test.mp4']);
    await downloadManager.checkAllStatuses();

    // Slideshow/manual specific paths
    await downloadManager.startSlideshowDownload('course1');
    await downloadManager.startManualsDownload();

    // No exception should be thrown
    expect(true).toBe(true);
  });
});
