import { invoke } from '@tauri-apps/api/core';
import { SnapshotFile } from './update-checker';

export interface SnapshotData {
  schema: number;
  lastCheck?: string;
  avgSpeedBps: number;
  files: Record<string, SnapshotFile>;
}

class SnapshotStore {
  private queue: Promise<any> = Promise.resolve();

  private async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation);
    this.queue = next.catch(() => {});
    return next;
  }

  public async readSnapshot(): Promise<SnapshotData> {
    return this.enqueue(async () => {
      try {
        const raw = await invoke<string>('read_version_snapshot');
        if (!raw || raw.trim() === '' || raw === '{}') {
          return { schema: 1, avgSpeedBps: 0, files: {} };
        }
        return JSON.parse(raw) as SnapshotData;
      } catch (e) {
        console.error('[SnapshotStore] Failed to read snapshot', e);
        return { schema: 1, avgSpeedBps: 0, files: {} };
      }
    });
  }

  public async writeSnapshot(data: SnapshotData): Promise<void> {
    return this.enqueue(async () => {
      try {
        const content = JSON.stringify(data, null, 2);
        await invoke('write_version_snapshot', { content });
      } catch (e) {
        console.error('[SnapshotStore] Failed to write snapshot', e);
      }
    });
  }

  public async updateAvgSpeedBps(speed: number): Promise<void> {
    if (speed <= 0) return;
    return this.enqueue(async () => {
      try {
        let raw = await invoke<string>('read_version_snapshot');
        let data: SnapshotData;
        if (!raw || raw.trim() === '' || raw === '{}') {
          data = { schema: 1, avgSpeedBps: 0, files: {} };
        } else {
          data = JSON.parse(raw) as SnapshotData;
        }

        if (!data.avgSpeedBps || data.avgSpeedBps === 0) {
          data.avgSpeedBps = speed;
        } else {
          // Exponential decay
          data.avgSpeedBps = data.avgSpeedBps * 0.8 + speed * 0.2;
        }

        const content = JSON.stringify(data, null, 2);
        await invoke('write_version_snapshot', { content });
      } catch (e) {
        console.error('[SnapshotStore] Failed to update avgSpeedBps', e);
      }
    });
  }
}

export const snapshotStore = new SnapshotStore();
