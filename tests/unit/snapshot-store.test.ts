import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => {
  throw new Error('Should not import @tauri-apps/api/core');
});

describe('snapshot-store fake platform', () => {
  beforeEach(() => {
    vi.resetModules();
    (global as any).window = { localStorage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } };
    (global.window as any).__TAURI_INTERNALS__ = false;
  });

  it('resolves snapshot-store read/write on web without importing tauri', async () => {
    const { snapshotStore } = await import('../../src/snapshot-store');

    const loader = vi.fn(async () => ({ invoke: vi.fn() }));
    snapshotStore.setTauriLoader(loader);

    // read snapshot
    const snap = await snapshotStore.readSnapshot();
    expect(snap.schema).toBe(1); // Web should return empty schema

    // write snapshot
    await snapshotStore.writeSnapshot(snap);

    // updateAvgSpeedBps
    await snapshotStore.updateAvgSpeedBps(100);

    // mergeFiles
    await snapshotStore.mergeFiles({ 'test': { size: 1, csum: '1', mtime: '1' } });

    // setLastCheck
    await snapshotStore.setLastCheck('2026-08-01');

    expect(loader).not.toHaveBeenCalled();
  });
});
