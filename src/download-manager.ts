import { invoke } from '@tauri-apps/api/core';
import { listen, Event } from '@tauri-apps/api/event';
import { COURSES, MANUALS, SLIDESHOWS } from './chapters';

export interface DownloadState {
  isDownloading: boolean;
  activeCategory: 'everything' | 'cpr-aed' | 'first-aid' | 'manuals' | 'single' | null;
  queue: string[];
  totalQueueSize: number;
  completedQueueCount: number;
  currentFile: string | null;
  currentFileBytesWritten: number;
  currentFileTotalBytes: number;
  currentSpeed: number; // bytes per second
  currentTimeRemaining: number; // seconds
  fileStatuses: Record<string, boolean>; // map of filename -> isDownloaded
  activeBaseUrl: string; // the download server base URL
  globalDownloadedCount: number;
  globalTotalCount: number;
  fileAttempts: Record<string, number>;
}

export type DownloadStateListener = (state: DownloadState) => void;

interface DownloadProgressPayload {
  filename: string;
  bytes_written: number;
  total_bytes: number;
}

class DownloadManager {
  private state: DownloadState = {
    isDownloading: false,
    activeCategory: null,
    queue: [],
    totalQueueSize: 0,
    completedQueueCount: 0,
    currentFile: null,
    currentFileBytesWritten: 0,
    currentFileTotalBytes: 0,
    currentSpeed: 0,
    currentTimeRemaining: -1,
    fileStatuses: {},
    activeBaseUrl: localStorage.getItem('eh_download_base_url') || 'https://media.ehacademy.com/',
    globalDownloadedCount: 0,
    globalTotalCount: 0,
    fileAttempts: {},
  };

  private listeners: Set<DownloadStateListener> = new Set();
  private speedSamples: { time: number; bytes: number }[] = [];
  private lastProgressTime = 0;
  private lastBytesWritten = 0;

  constructor() {
    this.setupListeners();
    // Initialize file status check
    setTimeout(() => this.checkAllStatuses(), 200);
  }

  public subscribe(listener: DownloadStateListener): () => void {
    this.listeners.add(listener);
    // Emit current state immediately
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const stateCopy = { ...this.state, fileStatuses: { ...this.state.fileStatuses } };
    this.listeners.forEach((listener) => listener(stateCopy));
  }

  public getActiveState(): DownloadState {
    return { ...this.state };
  }

  public setBaseUrl(url: string) {
    let cleanUrl = url.trim();
    if (cleanUrl && !cleanUrl.endsWith('/')) {
      cleanUrl += '/';
    }
    this.state.activeBaseUrl = cleanUrl;
    localStorage.setItem('eh_download_base_url', cleanUrl);
    this.notify();
  }

  private async setupListeners() {
    try {
      // Listen to progress updates from the Rust backend
      await listen<DownloadProgressPayload>('download-progress', (event) => {
        const { filename, bytes_written, total_bytes } = event.payload;
        this.handleProgress(filename, bytes_written, total_bytes);
      });

      // Listen to completion event
      await listen<DownloadProgressPayload>('download-complete', (event) => {
        const { filename } = event.payload;
        this.handleFileComplete(filename);
      });
    } catch (e) {
      console.error('[DownloadManager] Error subscribing to Tauri events:', e);
    }
  }

  private handleProgress(filename: string, bytesWritten: number, totalBytes: number) {
    if (!this.state.isDownloading || this.state.currentFile !== filename) {
      this.state.currentFile = filename;
    }

    const now = Date.now();
    this.state.currentFileBytesWritten = bytesWritten;
    this.state.currentFileTotalBytes = totalBytes;

    // Speed calculation using a moving window
    if (this.lastProgressTime > 0) {
      const timeElapsed = (now - this.lastProgressTime) / 1000; // in seconds
      const bytesDiff = bytesWritten - this.lastBytesWritten;

      if (timeElapsed > 0 && bytesDiff >= 0) {
        this.speedSamples.push({ time: now, bytes: bytesDiff });
        // Keep last 5 seconds of samples
        this.speedSamples = this.speedSamples.filter((sample) => now - sample.time < 5000);

        const totalSampleBytes = this.speedSamples.reduce((sum, s) => sum + s.bytes, 0);
        const totalSampleTime = this.speedSamples.length > 1
          ? (this.speedSamples[this.speedSamples.length - 1].time - this.speedSamples[0].time) / 1000
          : 0.1;

        if (totalSampleTime > 0) {
          this.state.currentSpeed = totalSampleBytes / totalSampleTime;
        }
      }
    }

    this.lastProgressTime = now;
    this.lastBytesWritten = bytesWritten;

    // Calculate time remaining for the current file
    if (this.state.currentSpeed > 0 && totalBytes > bytesWritten) {
      this.state.currentTimeRemaining = (totalBytes - bytesWritten) / this.state.currentSpeed;
    } else {
      this.state.currentTimeRemaining = -1;
    }

    this.notify();
  }

  private handleFileComplete(filename: string) {
    console.log(`[DownloadManager] completed file: ${filename}`);
    
    // Mark file as downloaded
    this.state.fileStatuses[filename] = true;
    
    // If it was the head of the queue, pop it
    if (this.state.queue.length > 0 && this.state.queue[0] === filename) {
      this.state.queue.shift();
      this.state.completedQueueCount += 1;
    } else {
      // Remove from queue wherever it is just in case
      this.state.queue = this.state.queue.filter(f => f !== filename);
    }

    this.state.currentFile = null;
    this.state.currentFileBytesWritten = 0;
    this.state.currentFileTotalBytes = 0;
    this.state.currentTimeRemaining = -1;
    this.lastProgressTime = 0;
    this.lastBytesWritten = 0;
    this.speedSamples = [];

    this.updateGlobalCounts();
    this.notify();

    // Start next file
    if (this.state.queue.length > 0) {
      this.downloadNext();
    } else {
      this.state.isDownloading = false;
      this.state.activeCategory = null;
      this.state.totalQueueSize = 0;
      this.state.completedQueueCount = 0;
      this.state.currentSpeed = 0;
      console.log('[DownloadManager] Bulk download queue completed successfully!');
      this.notify();
    }
  }

  private async downloadNext() {
    if (this.state.queue.length === 0) return;

    const nextFile = this.state.queue[0];
    this.state.currentFile = nextFile;
    this.lastProgressTime = Date.now();
    this.lastBytesWritten = 0;
    this.speedSamples = [];
    this.notify();

    try {
      console.log(`[DownloadManager] Invoking download for: ${nextFile}`);
      await invoke('download_media_file', {
        baseUrl: this.state.activeBaseUrl,
        filename: nextFile
      });
    } catch (e) {
      console.error(`[DownloadManager] ❌ Download failed for ${nextFile}:`, e);
      
      const attempts = this.state.fileAttempts[nextFile] || 0;
      
      if (attempts < 5) {
        // Retry with exponential backoff + jitter
        this.state.fileAttempts[nextFile] = attempts + 1;
        const baseDelay = 1000;
        const delay = Math.min(30000, baseDelay * Math.pow(2, attempts) + Math.random() * 1000);
        
        console.log(`[DownloadManager] Retrying ${nextFile} (Attempt ${attempts + 1}/5) in ${Math.round(delay)}ms...`);
        this.notify();
        
        setTimeout(() => {
          this.downloadNext();
        }, delay);
      } else {
        // Give up after 5 attempts
        console.error(`[DownloadManager] ❌ Gave up on ${nextFile} after 5 attempts.`);
        this.state.fileStatuses[nextFile] = false;
        
        // Reset attempts for future bulk downloads
        this.state.fileAttempts[nextFile] = 0;
        
        if (this.state.queue.length > 0 && this.state.queue[0] === nextFile) {
          this.state.queue.shift();
          this.state.completedQueueCount += 1;
        }
        this.notify();
        this.downloadNext();
      }
    }
  }

  // Get files needed for a category
  public getFilesForCategory(category: 'everything' | 'cpr-aed' | 'first-aid' | 'manuals'): string[] {
    const files: string[] = [];

    // 1. Course Videos
    COURSES.forEach((course) => {
      const isCpr = course.id === 'cpr-aed';
      const isFa = course.id === 'first-aid' || course.id === 'pediatric';

      if (
        category === 'everything' ||
        (category === 'cpr-aed' && isCpr) ||
        (category === 'first-aid' && isFa)
      ) {
        course.chapters.forEach((ch) => {
          if (ch.filename && ch.filename.trim()) {
            files.push(ch.filename.trim());
          }
        });
      }
    });

    // 2. Slideshow Files
    SLIDESHOWS.forEach((slideshow) => {
      const isCpr = slideshow.id.startsWith('cpr-aed');
      const isFa = slideshow.id.startsWith('first-aid') || slideshow.id.startsWith('pedi');

      if (
        category === 'everything' ||
        (category === 'cpr-aed' && isCpr) ||
        (category === 'first-aid' && isFa)
      ) {
        slideshow.slides.forEach((slide) => {
          if (slide.filename && slide.filename.trim()) {
            // Strip leading slash
            const clean = slide.filename.trim().startsWith('/')
              ? slide.filename.trim().slice(1)
              : slide.filename.trim();
            files.push(clean);
          }
        });
      }
    });

    // 3. Manuals
    if (category === 'everything' || category === 'cpr-aed' || category === 'first-aid' || category === 'manuals') {
      MANUALS.forEach((manual) => {
        if (manual.filename && manual.filename.trim()) {
          files.push(manual.filename.trim());
        }
      });
    }

    // Deduplicate
    return Array.from(new Set(files));
  }

  public async startBulkDownload(category: 'everything' | 'cpr-aed' | 'first-aid' | 'manuals') {
    if (this.state.isDownloading) {
      console.warn('[DownloadManager] Already downloading. Pause or cancel first.');
      return;
    }

    try {
      const spaceBytes = await invoke<number>('check_disk_space');
      const requiredBytes = category === 'everything' ? 5 * 1024 * 1024 * 1024 : 1.5 * 1024 * 1024 * 1024;
      if (spaceBytes > 0 && spaceBytes < requiredBytes) {
        window.alert(`Insufficient disk space! You have ${Math.max(1, Math.round(spaceBytes / 1024 / 1024 / 1024))}GB free, but this bulk download requires approx ${Math.round(requiredBytes / 1024 / 1024 / 1024)}GB. Please free up some space and try again.`);
        return;
      }
    } catch (e) {
      console.warn('[DownloadManager] Could not check disk space:', e);
    }

    console.log(`[DownloadManager] Starting bulk download for: ${category}`);
    const allFiles = this.getFilesForCategory(category);
    
    // Check which ones are already downloaded
    const statuses = await this.checkStatusesForFiles(allFiles);
    
    // Queue up files that are NOT downloaded
    const pendingFiles = allFiles.filter((file) => !statuses[file]);

    if (pendingFiles.length === 0) {
      console.log('[DownloadManager] All files in this category are already downloaded!');
      // Mark all as true in local state
      allFiles.forEach(f => {
        this.state.fileStatuses[f] = true;
      });
      this.state.isDownloading = false;
      this.state.activeCategory = null;
      this.notify();
      return;
    }

    this.state.isDownloading = true;
    this.state.activeCategory = category;
    this.state.queue = pendingFiles;
    this.state.totalQueueSize = pendingFiles.length;
    this.state.completedQueueCount = 0;
    this.notify();

    this.downloadNext();
  }

  public async startSingleDownload(filename: string) {
    if (this.state.isDownloading) {
      // Add to queue if we're already bulk downloading or single downloading
      if (!this.state.queue.includes(filename) && this.state.currentFile !== filename) {
        this.state.queue.push(filename);
        this.state.totalQueueSize += 1;
        this.notify();
      }
      return;
    }

    try {
      const spaceBytes = await invoke<number>('check_disk_space');
      const requiredBytes = 500 * 1024 * 1024; // Assume single file is up to 500MB
      if (spaceBytes > 0 && spaceBytes < requiredBytes) {
        window.alert(`Insufficient disk space! You need at least 500MB of free space to safely download this file.`);
        return;
      }
    } catch (e) {
      console.warn('[DownloadManager] Could not check disk space:', e);
    }

    const clean = filename.trim().startsWith('/') ? filename.trim().slice(1) : filename.trim();
    const exists = await invoke<boolean>('check_media_file_exists', { filename: clean });
    if (exists) {
      this.state.fileStatuses[clean] = true;
      this.notify();
      return;
    }

    this.state.isDownloading = true;
    this.state.activeCategory = 'single';
    this.state.queue = [clean];
    this.state.totalQueueSize = 1;
    this.state.completedQueueCount = 0;
    this.notify();

    this.downloadNext();
  }

  public cancelDownload() {
    this.state.isDownloading = false;
    this.state.activeCategory = null;
    this.state.queue = [];
    this.state.totalQueueSize = 0;
    this.state.completedQueueCount = 0;
    this.state.currentFile = null;
    this.state.currentFileBytesWritten = 0;
    this.state.currentFileTotalBytes = 0;
    this.state.currentSpeed = 0;
    this.state.currentTimeRemaining = -1;
    this.notify();
  }

  public async checkStatusesForFiles(filenames: string[]): Promise<Record<string, boolean>> {
    try {
      const cleanList = filenames.map(f => f.trim().startsWith('/') ? f.trim().slice(1) : f.trim());
      const statusMap = await invoke<Record<string, boolean>>('check_media_files_status', { filenames: cleanList });
      
      // Update local state statuses
      Object.entries(statusMap).forEach(([file, exists]) => {
        this.state.fileStatuses[file] = exists;
      });
      this.updateGlobalCounts();
      this.notify();
      return statusMap;
    } catch (e) {
      console.error('[DownloadManager] check_media_files_status failed:', e);
      return {};
    }
  }

  public async checkAllStatuses() {
    // Gather all possible files in the app
    const allFiles: string[] = [];
    
    COURSES.forEach((course) => {
      course.chapters.forEach((ch) => {
        if (ch.filename) allFiles.push(ch.filename);
      });
    });

    SLIDESHOWS.forEach((slideshow) => {
      slideshow.slides.forEach((slide) => {
        if (slide.filename) allFiles.push(slide.filename);
      });
    });

    MANUALS.forEach((manual) => {
      if (manual.filename) allFiles.push(manual.filename);
    });

    const deduplicated = Array.from(new Set(allFiles));
    await this.checkStatusesForFiles(deduplicated);
  }

  private updateGlobalCounts() {
    const allFiles = this.getFilesForCategory('everything');
    this.state.globalTotalCount = allFiles.length;
    this.state.globalDownloadedCount = allFiles.filter(f => this.state.fileStatuses[f]).length;
  }

  // Check if a specific file is downloaded
  public isFileDownloaded(filename: string): boolean {
    const clean = filename.trim().startsWith('/') ? filename.trim().slice(1) : filename.trim();
    return !!this.state.fileStatuses[clean];
  }

  // Check if an entire course (videos only) is downloaded
  public isCourseDownloaded(courseId: string): boolean {
    const course = COURSES.find(c => c.id === courseId);
    if (!course || course.chapters.length === 0) return true;
    return course.chapters.every(ch => !ch.filename || this.isFileDownloaded(ch.filename));
  }

  // Check if a slideshow is completely downloaded
  public isSlideshowDownloaded(slideshowId: string): boolean {
    const slideshow = SLIDESHOWS.find(s => s.id === slideshowId);
    if (!slideshow) return true;
    return slideshow.slides.every(slide => !slide.filename || this.isFileDownloaded(slide.filename));
  }

  // Check if all manuals are completely downloaded
  public isManualsDownloaded(): boolean {
    return MANUALS.every(m => !m.filename || this.isFileDownloaded(m.filename));
  }

  // Helper to trigger download for a specific slideshow
  public async startSlideshowDownload(slideshowId: string) {
    const slideshow = SLIDESHOWS.find(s => s.id === slideshowId);
    if (!slideshow) return;

    const files = slideshow.slides
      .map((s) => s.filename)
      .filter(Boolean)
      .map((f) => (f.trim().startsWith('/') ? f.trim().slice(1) : f.trim()));

    // Also include manuals with the slideshow download as requested
    MANUALS.forEach((m) => {
      if (m.filename) files.push(m.filename.trim());
    });

    const statusMap = await this.checkStatusesForFiles(files);
    const pending = files.filter((f) => !statusMap[f]);

    if (pending.length === 0) {
      console.log(`[DownloadManager] Slideshow ${slideshowId} and manuals are already downloaded!`);
      this.notify();
      return;
    }

    if (this.state.isDownloading) {
      pending.forEach((f) => {
        if (!this.state.queue.includes(f) && this.state.currentFile !== f) {
          this.state.queue.push(f);
          this.state.totalQueueSize += 1;
        }
      });
      this.notify();
    } else {
      this.state.isDownloading = true;
      this.state.activeCategory = 'single';
      this.state.queue = pending;
      this.state.totalQueueSize = pending.length;
      this.state.completedQueueCount = 0;
      this.notify();
      this.downloadNext();
    }
  }

  // Helper to trigger download for all training manuals at once
  public async startManualsDownload() {
    const files = MANUALS.map((m) => m.filename).filter(Boolean);
    const statusMap = await this.checkStatusesForFiles(files);
    const pending = files.filter((f) => !statusMap[f]);

    if (pending.length === 0) {
      console.log('[DownloadManager] All manuals are already downloaded!');
      this.notify();
      return;
    }

    if (this.state.isDownloading) {
      pending.forEach((f) => {
        if (!this.state.queue.includes(f) && this.state.currentFile !== f) {
          this.state.queue.push(f);
          this.state.totalQueueSize += 1;
        }
      });
      this.notify();
    } else {
      this.state.isDownloading = true;
      this.state.activeCategory = 'manuals';
      this.state.queue = pending;
      this.state.totalQueueSize = pending.length;
      this.state.completedQueueCount = 0;
      this.notify();
      this.downloadNext();
    }
  }
}

export const downloadManager = new DownloadManager();

// Formatting helper for human readable speeds
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 KB/s';
  const kbs = bytesPerSec / 1024;
  if (kbs < 1024) {
    return `${kbs.toFixed(1)} KB/s`;
  }
  const mbs = kbs / 1024;
  return `${mbs.toFixed(1)} MB/s`;
}

// Formatting helper for time remaining
export function formatTimeRemaining(seconds: number): string {
  if (seconds < 0) return 'Estimating...';
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s remaining`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  if (mins < 60) {
    return `${mins}m ${secs}s remaining`;
  }
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m remaining`;
}
