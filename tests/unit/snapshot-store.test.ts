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
    
    // read snapshot
    const snap = await snapshotStore.readSnapshot();
    expect(snap.schema).toBe(1); // Web should return empty schema
    
    // write snapshot
    await snapshotStore.writeSnapshot(snap);
    
    // all done
  });
});
