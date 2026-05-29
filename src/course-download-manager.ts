import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { COURSES, SLIDESHOWS, MANUALS } from './chapters';

export interface CoursePackage {
  id: string;
  displayName: string;
  category: 'video' | 'slideshow' | 'manual';
  files: string[];
}

export interface PackageDownloadState {
  packageId: string;
  status: 'idle' | 'downloading' | 'paused' | 'complete' | 'error';
  filesTotal: number;
  filesDownloaded: number;
  bytesTotal: number;
  bytesDownloaded: number;
  currentFile: string | null;
  speed: number;
  timeRemaining: number;
  errorMessage: string | null;
}

export type DownloadManagerListener = (states: Record<string, PackageDownloadState>) => void;

class CourseDownloadManager {
  private activeBaseUrl: string = localStorage.getItem('eh_download_base_url') || 'https://media.ehacademy.com/';
  private packages: CoursePackage[] = [];
  private states: Record<string, PackageDownloadState> = {};
  private listeners: Set<DownloadManagerListener> = new Set();

  private speedSamples: Record<string, { time: number; bytes: number }[]> = {};
  private lastBytesWritten: Record<string, number> = {};

  constructor() {
    this.initializePackages();
    this.setupListeners();
    this.refreshAllStatuses();
  }

  private initializePackages() {
    this.packages = [
      {
        id: 'cpr-aed-video',
        displayName: 'CPR & AED Video Course',
        category: 'video',
        files: COURSES[0].chapters.map(c => c.filename).filter(Boolean)
      },
      {
        id: 'first-aid-video',
        displayName: 'First Aid Video Course',
        category: 'video',
        files: COURSES[1].chapters.map(c => c.filename).filter(Boolean)
      },
      {
        id: 'cpr-aed-slides',
        displayName: 'CPR & AED Slideshow',
        category: 'slideshow',
        files: SLIDESHOWS[0].slides.map(s => s.filename).filter(Boolean).map(f => f.startsWith('/') ? f.slice(1) : f)
      },
      {
        id: 'first-aid-slides',
        displayName: 'First Aid Slideshow',
        category: 'slideshow',
        files: SLIDESHOWS[1].slides.map(s => s.filename).filter(Boolean).map(f => f.startsWith('/') ? f.slice(1) : f)
      },
      {
        id: 'cpr-aed-spanish-slides',
        displayName: 'CPR & AED Spanish Slideshow',
        category: 'slideshow',
        files: SLIDESHOWS[2].slides.map(s => s.filename).filter(Boolean).map(f => f.startsWith('/') ? f.slice(1) : f)
      },
      {
        id: 'first-aid-spanish-slides',
        displayName: 'First Aid Spanish Slideshow',
        category: 'slideshow',
        files: SLIDESHOWS[3].slides.map(s => s.filename).filter(Boolean).map(f => f.startsWith('/') ? f.slice(1) : f)
      },
      {
        id: 'pediatric-slides',
        displayName: 'Pediatric First Aid Slideshow',
        category: 'slideshow',
        files: SLIDESHOWS[4].slides.map(s => s.filename).filter(Boolean).map(f => f.startsWith('/') ? f.slice(1) : f)
      },
      {
        id: 'manuals',
        displayName: 'Training Manuals',
        category: 'manual',
        files: MANUALS.map(m => m.filename).filter(Boolean)
      }
    ];

    // Initialize state
    for (const pkg of this.packages) {
      this.states[pkg.id] = {
        packageId: pkg.id,
        status: 'idle',
        filesTotal: pkg.files.length,
        filesDownloaded: 0,
        bytesTotal: 0,
        bytesDownloaded: 0,
        currentFile: null,
        speed: 0,
        timeRemaining: -1,
        errorMessage: null
      };
      this.speedSamples[pkg.id] = [];
      this.lastBytesWritten[pkg.id] = 0;
    }
  }

  public getPackages() {
    return this.packages;
  }

  public getPackage(id: string) {
    return this.packages.find(p => p.id === id);
  }

  public subscribe(listener: DownloadManagerListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.states });
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const statesCopy = { ...this.states };
    this.listeners.forEach(l => l(statesCopy));
  }

  private async setupListeners() {
    await listen('download-group-progress', (event: any) => {
      const { groupId, filename, bytesWritten, totalBytes } = event.payload;
      
      const state = this.states[groupId];
      if (!state) return;

      state.status = 'downloading';
      state.currentFile = filename;
      state.bytesDownloaded = bytesWritten; // This is per-file, but we can display it

      // Speed calc
      const now = Date.now();
      const lastBytes = this.lastBytesWritten[groupId] || 0;
      const bytesDiff = bytesWritten - lastBytes;
      
      if (bytesDiff >= 0) {
        this.speedSamples[groupId].push({ time: now, bytes: bytesDiff });
        this.speedSamples[groupId] = this.speedSamples[groupId].filter(s => now - s.time < 5000);
        
        const totalSampleBytes = this.speedSamples[groupId].reduce((sum, s) => sum + s.bytes, 0);
        const totalSampleTime = this.speedSamples[groupId].length > 1 
          ? (this.speedSamples[groupId][this.speedSamples[groupId].length - 1].time - this.speedSamples[groupId][0].time) / 1000
          : 0.1;
          
        if (totalSampleTime > 0) {
          state.speed = totalSampleBytes / totalSampleTime;
        }
      }
      this.lastBytesWritten[groupId] = bytesWritten;
      
      if (state.speed > 0 && totalBytes > bytesWritten) {
        state.timeRemaining = (totalBytes - bytesWritten) / state.speed;
      }

      this.notify();
    });

    await listen('download-group-complete', (event: any) => {
      const { groupId, filename } = event.payload;
      const state = this.states[groupId];
      if (!state) return;
      
      // A file finished. Re-check full status to see if the whole group is done
      this.refreshStatus(groupId);
    });
  }

  public async startDownload(packageId: string) {
    const pkg = this.getPackage(packageId);
    if (!pkg) return;

    this.states[packageId].status = 'downloading';
    this.notify();

    try {
      await invoke('start_download_group', {
        groupId: packageId,
        baseUrl: this.activeBaseUrl,
        files: pkg.files
      });
    } catch (e: any) {
      this.states[packageId].status = 'error';
      this.states[packageId].errorMessage = e.toString();
      this.notify();
    }
  }

  public async pauseDownload(packageId: string) {
    this.states[packageId].status = 'paused';
    this.notify();
    await invoke('pause_download_group', { groupId: packageId }).catch(console.error);
  }

  public async resumeDownload(packageId: string) {
    this.states[packageId].status = 'downloading';
    this.notify();
    await invoke('resume_download_group', { groupId: packageId }).catch(console.error);
  }

  public async cancelDownload(packageId: string) {
    this.states[packageId].status = 'idle';
    this.notify();
    await invoke('cancel_download_group', { groupId: packageId }).catch(console.error);
    await this.refreshStatus(packageId);
  }

  public async deletePackage(packageId: string): Promise<number> {
    const pkg = this.getPackage(packageId);
    if (!pkg) return 0;
    try {
      const bytesFreed = await invoke<number>('delete_media_files', { files: pkg.files });
      await this.refreshStatus(packageId);
      return bytesFreed;
    } catch (e) {
      console.error(e);
      return 0;
    }
  }

  public async fetchPackageSize(packageId: string): Promise<number> {
    const pkg = this.getPackage(packageId);
    if (!pkg) return 0;
    try {
      const sizes = await invoke<Record<string, number>>('fetch_file_sizes', {
        baseUrl: this.activeBaseUrl,
        files: pkg.files
      });
      const total = Object.values(sizes).reduce((sum, size) => sum + size, 0);
      this.states[packageId].bytesTotal = total;
      this.notify();
      return total;
    } catch (e) {
      console.error(e);
      return 0;
    }
  }

  public async refreshStatus(packageId: string) {
    const pkg = this.getPackage(packageId);
    if (!pkg) return;

    try {
      const statuses = await invoke<Record<string, boolean>>('check_media_files_status', {
        filenames: pkg.files
      });
      
      const downloadedCount = Object.values(statuses).filter(Boolean).length;
      const state = this.states[packageId];
      
      state.filesDownloaded = downloadedCount;
      if (downloadedCount === pkg.files.length) {
        state.status = 'complete';
        state.currentFile = null;
        state.speed = 0;
        state.timeRemaining = -1;
      } else if (state.status === 'complete' || state.status === 'idle') {
        state.status = 'idle';
      }
      
      this.notify();
    } catch (e) {
      console.error(e);
    }
  }

  public async refreshAllStatuses() {
    for (const pkg of this.packages) {
      await this.refreshStatus(pkg.id);
    }
  }

  public isPackageReady(packageId: string): boolean {
    return this.states[packageId]?.status === 'complete';
  }
}

export const courseDownloadManager = new CourseDownloadManager();
