import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('download-manager fake platform', () => {
  beforeEach(() => {
    vi.resetModules();
    (global as any).window = { alert: vi.fn(), localStorage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } };
    (global.window as any).__TAURI_INTERNALS__ = false;
  });

  it('resolves download queue logic on web without importing tauri', async () => {
    const { downloadManager } = await import('../../src/download-manager');
    
    // Explicitly set loaders that throw if called
    downloadManager.setTauriLoaders(
      async () => { throw new Error('Tauri core loader should not be called'); },
      async () => { throw new Error('Tauri event loader should not be called'); }
    );
    
    // Status via subscribe
    let state: any;
    downloadManager.subscribe(s => { state = s; });
    expect(state.fileStatuses['test.mp4'] || false).toBe(false);

    // Queue logic
    await downloadManager.startSingleDownload('test.mp4');
    
    // It should hit the mock logic in DEV mode if mockMissingFiles is true,
    // or just return silently since it's web.
    expect(state.isDownloading).toBe(false); // In test environment it's not dev mode so it skips mock logic
  });
});
