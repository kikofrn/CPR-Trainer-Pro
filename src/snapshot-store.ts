import { SnapshotFile } from './update-checker';
import { isTauri } from './media-resolver';

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

  private tauriLoader: () => Promise<any> = () => import('@tauri-apps/api/core');

  public setTauriLoader(loader: () => Promise<any>) {
    this.tauriLoader = loader;
  }

  public async readSnapshot(): Promise<SnapshotData> {
    return this.enqueue(async () => {
      if (!isTauri) return { schema: 1, avgSpeedBps: 0, files: {} };
      try {
        const { invoke } = await this.tauriLoader();
        const raw: string = await invoke('read_version_snapshot');
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
      if (!isTauri) return;
      try {
        const { invoke } = await this.tauriLoader();
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
      if (!isTauri) return;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
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
  public async mergeFiles(entries: Record<string, SnapshotFile>): Promise<void> {
    return this.enqueue(async () => {
      if (!isTauri) return;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        let raw = await invoke<string>('read_version_snapshot');
        let data: SnapshotData;
        if (!raw || raw.trim() === '' || raw === '{}') {
          data = { schema: 1, avgSpeedBps: 0, files: {} };
        } else {
          data = JSON.parse(raw) as SnapshotData;
        }

        data.files = { ...data.files, ...entries };

        const content = JSON.stringify(data, null, 2);
        await invoke('write_version_snapshot', { content });
      } catch (e) {
        console.error('[SnapshotStore] Failed to merge files', e);
      }
    });
  }

  public async setLastCheck(iso: string): Promise<void> {
    return this.enqueue(async () => {
      if (!isTauri) return;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        let raw = await invoke<string>('read_version_snapshot');
        let data: SnapshotData;
        if (!raw || raw.trim() === '' || raw === '{}') {
          data = { schema: 1, avgSpeedBps: 0, files: {} };
        } else {
          data = JSON.parse(raw) as SnapshotData;
        }

        data.lastCheck = iso;

        const content = JSON.stringify(data, null, 2);
        await invoke('write_version_snapshot', { content });
      } catch (e) {
        console.error('[SnapshotStore] Failed to set lastCheck', e);
      }
    });
  }
}

export const snapshotStore = new SnapshotStore();
