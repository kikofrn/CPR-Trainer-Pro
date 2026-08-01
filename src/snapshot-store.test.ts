import { describe, it, expect, vi, beforeEach } from 'vitest';
import { snapshotStore } from './snapshot-store';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('SnapshotStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('self-heals on parse failure (F2)', async () => {
    // Mock the invoke to return corrupt JSON
    vi.mocked(invoke).mockResolvedValueOnce('{"corrupt": true, "schema": 1,');

    const result = await snapshotStore.readSnapshot();
    
    // Should fallback to empty schema
    expect(result).toEqual({ schema: 1, avgSpeedBps: 0, files: {} });
    expect(invoke).toHaveBeenCalledWith('read_version_snapshot');
  });
});
