import { invoke } from '@tauri-apps/api/core';
import { listen, Event } from '@tauri-apps/api/event';
import { COURSES, MANUALS, SLIDESHOWS } from './chapters';
import { snapshotStore } from './snapshot-store';

const COMING_SOON_IDS = ['cpr-aed-spanish-course', 'first-aid-spanish-course'];

export interface DownloadState {
  isDownloading: boolean;
  activeCategory: 'everything' | 'cpr-aed' | 'first-aid' | 'manuals' | 'single' | null;
  queue: { filename: string; version?: string }[];
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
  isPaused: boolean;
  isPausing: boolean;
  failedFiles: string[];
  isMockingFiles: boolean;
}

export type DownloadStateListener = (state: DownloadState) => void;

interface DownloadProgressPayload {
  filename: string;
  bytes_written: number;
  total_bytes: number;
}

class DownloadManager {
  private normalizeFilename(filename: string): string {
    const trimmed = filename.trim();
    return trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  }

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
    isPaused: false,
    isPausing: false,
    failedFiles: [],
    isMockingFiles: false,
  };

  private listeners: Set<DownloadStateListener> = new Set();
  private speedSamples: { time: number; bytes: number }[] = [];
  private lastProgressTime = 0;
  private lastBytesWritten = 0;
  private mockMissingFiles = false;

  public toggleMockMissingFiles() {
    this.mockMissingFiles = !this.mockMissingFiles;
    this.state.isMockingFiles = this.mockMissingFiles;
    if (this.mockMissingFiles) {
      Object.keys(this.state.fileStatuses).forEach(key => {
        this.state.fileStatuses[key] = false;
      });
      this.state.globalDownloadedCount = 0;
      this.notify();
    } else {
      this.checkAllStatuses();
    }
  }

  public isMockingMissingFiles(): boolean {
    return this.mockMissingFiles;
  }

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

  private handleProgress(rawFilename: string, bytesWritten: number, totalBytes: number) {
    const filename = this.normalizeFilename(rawFilename);
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

  private handleFileComplete(rawFilename: string) {
    const filename = this.normalizeFilename(rawFilename);
    // Idempotency guard: if this file is already marked as downloaded and is NOT
    // the current file or head of the queue, this is a duplicate call — skip it.
    if (this.state.fileStatuses[filename] &&
        this.state.currentFile !== filename &&
        (this.state.queue.length === 0 || this.state.queue[0].filename !== filename)) {
      console.log(`[DownloadManager] Ignoring duplicate completion for: ${filename}`);
      return;
    }

    console.log(`[DownloadManager] completed file: ${filename}`);
    
    // Mark file as downloaded
    this.state.fileStatuses[filename] = true;
    
    // Update avgSpeedBps
    if (this.state.currentSpeed > 0) {
      snapshotStore.updateAvgSpeedBps(this.state.currentSpeed).catch(e => console.error(e));
    }

    // If it was the head of the queue, pop it
    if (this.state.queue.length > 0 && this.state.queue[0].filename === filename) {
      this.state.queue.shift();
      this.state.completedQueueCount += 1;
    } else {
      // Remove from queue wherever it is just in case
      const idx = this.state.queue.findIndex(q => q.filename === filename);
      if (idx !== -1) {
        this.state.queue.splice(idx, 1);
      }
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

    // Start next file (unless pausing)
    if (this.state.isPausing) {
      // Transition from "pausing" to fully "paused"
      this.state.isPausing = false;
      this.state.isPaused = true;
      this.state.currentFile = null;
      this.state.currentSpeed = 0;
      this.state.currentTimeRemaining = -1;
      console.log('[DownloadManager] Downloads paused after completing current file.');
      this.notify();
    } else if (this.state.queue.length > 0) {
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
    if (this.state.isPaused || this.state.isPausing) return; // Don't start new downloads while pausing/paused

    const nextItem = this.state.queue[0];
    const nextFile = this.normalizeFilename(nextItem.filename);
    this.state.currentFile = nextFile;
    this.lastProgressTime = Date.now();
    this.lastBytesWritten = 0;
    this.speedSamples = [];
    this.notify();

    try {
      console.log(`[DownloadManager] Invoking download for: ${nextFile}`);
      await invoke('download_media_file', {
        baseUrl: this.state.activeBaseUrl,
        filename: nextFile,
        version: nextItem.version
      });
      // Guarded fallback: if invoke succeeded but download-complete event was missed,
      // handle completion here to prevent the queue from getting stuck.
      if (!this.state.fileStatuses[nextFile] &&
          (this.state.currentFile === nextFile || (this.state.queue.length > 0 && this.state.queue[0].filename === nextFile))) {
        console.log(`[DownloadManager] ⚡ Guarded fallback: completing ${nextFile} (download-complete event may have been missed)`);
        this.handleFileComplete(nextFile);
      }
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
        
        // Track the failed file for UI visibility
        if (!this.state.failedFiles.includes(nextFile)) {
          this.state.failedFiles.push(nextFile);
        }
        
        // Reset attempts for future bulk downloads
        this.state.fileAttempts[nextFile] = 0;
        
        if (this.state.queue.length > 0 && this.state.queue[0].filename === nextFile) {
          this.state.queue.shift();
          this.state.completedQueueCount += 1;
        }
        this.notify();

        // If queue is now empty after removing failed file, properly reset state
        if (this.state.queue.length === 0) {
          this.state.isDownloading = false;
          this.state.activeCategory = null;
          this.state.currentFile = null;
          this.state.totalQueueSize = 0;
          this.state.completedQueueCount = 0;
          this.state.currentSpeed = 0;
          console.log('[DownloadManager] Bulk download completed (some files failed).');
          this.notify();
        } else {
          this.downloadNext();
        }
      }
    }
  }

  // Get files needed for a category
  public getFilesForCategory(category: 'everything' | 'cpr-aed' | 'first-aid' | 'manuals'): string[] {
    const files: string[] = [];

    // 1. Course Videos
    COURSES.forEach((course) => {
      const isCpr = course.id === 'cpr-aed' || course.id === 'pediatric-cpr-aed';
      const isFa = course.id === 'first-aid' || course.id === 'pediatric-first-aid';

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
      if (slideshow.isComingSoon || COMING_SOON_IDS.includes(slideshow.id)) return; // Skip coming-soon slideshows
      const isCpr = slideshow.id.startsWith('cpr-aed') || slideshow.id === 'pediatric-cpr-aed-course';
      const isFa = slideshow.id.startsWith('first-aid') || (slideshow.id.startsWith('pedi') && slideshow.id !== 'pediatric-cpr-aed-course');

      if (
        category === 'everything' ||
        (category === 'cpr-aed' && isCpr) ||
        (category === 'first-aid' && isFa)
      ) {
        slideshow.slides.forEach((slide) => {
          if (slide.filename && slide.filename.trim()) {
            files.push(this.normalizeFilename(slide.filename));
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
      const CATEGORY_DISK_REQUIREMENTS: Record<string, number> = {
      'everything': 5 * 1024 * 1024 * 1024,   // ~5 GB
      'cpr-aed':    2 * 1024 * 1024 * 1024,   // ~2 GB
      'first-aid':  2.5 * 1024 * 1024 * 1024,  // ~2.5 GB
        'manuals':    0.1 * 1024 * 1024 * 1024,   // ~100 MB
      };
      const requiredBytes = CATEGORY_DISK_REQUIREMENTS[category] || 1.5 * 1024 * 1024 * 1024;
      if (spaceBytes > 0 && spaceBytes < requiredBytes) {
        window.alert(`Insufficient disk space! You have ${Math.max(1, Math.round(spaceBytes / 1024 / 1024 / 1024))}GB free, but this bulk download requires approx ${Math.round(requiredBytes / 1024 / 1024 / 1024)}GB. Please free up some space and try again.`);
        return;
      }
    } catch (e) {
      console.warn('[DownloadManager] Could not check disk space:', e);
    }

    console.log(`[DownloadManager] Starting bulk download for: ${category}`);
    // Reset retry state for a fresh start
    this.state.fileAttempts = {};
    this.state.failedFiles = [];
    this.state.isPaused = false;
    this.state.isPausing = false;
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
    this.state.queue = pendingFiles.map(f => ({ filename: f }));
    this.state.totalQueueSize = pendingFiles.length;
    this.state.completedQueueCount = 0;
    this.notify();

    this.downloadNext();
  }

  public queueSpecificFiles(files: { filename: string; version: string }[]) {
    if (files.length === 0) return;

    if (this.state.isDownloading) {
      files.forEach((f) => {
        if (!this.state.queue.some(q => q.filename === f.filename) && this.state.currentFile !== f.filename) {
          this.state.queue.push({ filename: f.filename, version: f.version });
          this.state.totalQueueSize += 1;
        }
      });
      this.notify();
    } else {
      this.state.isDownloading = true;
      this.state.activeCategory = 'everything';
      this.state.queue = [...files];
      this.state.totalQueueSize = files.length;
      this.state.completedQueueCount = 0;
      this.state.isPaused = false;
      this.state.isPausing = false;
      this.notify();
      this.downloadNext();
    }
  }

  public async startSingleDownload(rawFilename: string) {
    const filename = this.normalizeFilename(rawFilename);
    if (this.state.isDownloading) {
      // Add to queue if we're already bulk downloading or single downloading
      if (!this.state.queue.some(q => q.filename === filename) && this.state.currentFile !== filename) {
        this.state.queue.push({ filename });
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

    // --- MOCK LOGIC ---
    if ((import.meta as any).env.DEV && this.mockMissingFiles) {
      this.state.isDownloading = true;
      this.state.activeCategory = 'single';
      this.state.queue = [{ filename }];
      this.state.totalQueueSize = 1;
      this.state.completedQueueCount = 0;
      this.state.currentFile = filename;
      this.state.currentFileTotalBytes = 1000000;
      this.state.currentFileBytesWritten = 0;
      this.notify();
      
      let progress = 0;
      const interval = setInterval(() => {
        progress += 200000; // 20% per second
        this.state.currentFileBytesWritten = progress;
        this.notify();
        if (progress >= 1000000) {
          clearInterval(interval);
          this.handleFileComplete(filename);
        }
      }, 1000);
      return;
    }
    // ------------------

    const exists = await invoke<boolean>('check_media_file_exists', { filename });
    if (exists) {
      this.state.fileStatuses[filename] = true;
      this.notify();
      return;
    }

    this.state.isDownloading = true;
    this.state.activeCategory = 'single';
    this.state.queue = [{ filename }];
    this.state.totalQueueSize = 1;
    this.state.completedQueueCount = 0;
    this.notify();

    this.downloadNext();
  }

  /**
   * Cancels the download queue. The currently active Rust download will finish
   * in the background (we don't abort HTTP streams), but its completion is
   * harmless — the file just gets saved to disk and fileStatuses is updated.
   * From the user's perspective, downloads stop immediately.
   */
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
    this.state.isPaused = false;
    this.state.isPausing = false;
    this.notify();
  }

  public pauseDownload() {
    if (!this.state.isDownloading || this.state.isPaused) return;
    
    if (this.state.currentFile) {
      // A file is actively downloading — transition to "pausing" state
      this.state.isPausing = true;
      console.log(`[DownloadManager] Pausing after current file completes: ${this.state.currentFile}`);
    } else {
      // No file actively downloading — pause immediately
      this.state.isPaused = true;
      this.state.isPausing = false;
      console.log('[DownloadManager] Downloads paused immediately.');
    }
    this.notify();
  }

  public resumeDownload() {
    if (!this.state.isPaused) return;
    
    this.state.isPaused = false;
    this.state.isPausing = false;
    console.log('[DownloadManager] Downloads resumed.');
    this.notify();
    
    if (this.state.queue.length > 0) {
      this.downloadNext();
    } else {
      this.state.isDownloading = false;
      this.state.activeCategory = null;
      this.state.totalQueueSize = 0;
      this.state.completedQueueCount = 0;
      this.state.currentSpeed = 0;
      console.log('[DownloadManager] No files left in queue after resume.');
      this.checkAllStatuses();
      this.notify();
    }
  }

  public async checkStatusesForFiles(filenames: string[]): Promise<Record<string, boolean>> {
    try {
      const cleanList = filenames.map(f => this.normalizeFilename(f));
      const statusMap = await invoke<Record<string, boolean>>('check_media_files_status', { filenames: cleanList });
      
      // Update local state statuses
      Object.entries(statusMap).forEach(([file, exists]) => {
        const effectiveExists = this.mockMissingFiles ? false : exists;
        this.state.fileStatuses[file] = effectiveExists;
        statusMap[file] = effectiveExists;
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
    // Gather all possible files in the app, normalizing filenames to match getFilesForCategory output
    const allFiles: string[] = [];
    
    COURSES.forEach((course) => {
      course.chapters.forEach((ch) => {
        if (ch.filename) allFiles.push(this.normalizeFilename(ch.filename));
      });
    });

    SLIDESHOWS.forEach((slideshow) => {
      if (slideshow.isComingSoon || COMING_SOON_IDS.includes(slideshow.id)) return; // Skip coming-soon slideshows
      slideshow.slides.forEach((slide) => {
        if (slide.filename) allFiles.push(this.normalizeFilename(slide.filename));
      });
    });

    MANUALS.forEach((manual) => {
      if (manual.filename) allFiles.push(this.normalizeFilename(manual.filename));
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
  public isFileDownloaded(rawFilename: string): boolean {
    const filename = this.normalizeFilename(rawFilename);
    return !!this.state.fileStatuses[filename];
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

    const statusMap = await this.checkStatusesForFiles(files);
    const pending = files.filter((f) => !statusMap[f]);

    if (pending.length === 0) {
      console.log(`[DownloadManager] Slideshow ${slideshowId} and manuals are already downloaded!`);
      this.notify();
      return;
    }

    if (this.state.isDownloading) {
      pending.forEach((f) => {
        if (!this.state.queue.some(q => q.filename === f) && this.state.currentFile !== f) {
          this.state.queue.push({ filename: f });
          this.state.totalQueueSize += 1;
        }
      });
      this.notify();
    } else {
      this.state.isDownloading = true;
      this.state.activeCategory = 'single';
      this.state.queue = pending.map(f => ({ filename: f }));
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
        if (!this.state.queue.some(q => q.filename === f) && this.state.currentFile !== f) {
          this.state.queue.push({ filename: f });
          this.state.totalQueueSize += 1;
        }
      });
      this.notify();
    } else {
      this.state.isDownloading = true;
      this.state.activeCategory = 'manuals';
      this.state.queue = pending.map(f => ({ filename: f }));
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
