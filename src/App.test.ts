import { describe, expect, it, vi } from 'vitest';
import {
  beginDetectedUsbImport,
  closeManualSurface,
  runPresenterExitGuard,
  shouldShowUsbDriveBanner,
  syncPresenterSubtitle,
  type DetectedUsbDrive,
} from './App';

describe('presenter subtitle synchronization', () => {
  it('clears the viewer subtitle when captions are toggled off', () => {
    const sender = vi.fn().mockResolvedValue(true);

    syncPresenterSubtitle(
      true,
      false,
      { text: 'Continue CPR until help arrives.' },
      sender,
    );

    expect(sender).toHaveBeenCalledOnce();
    expect(sender).toHaveBeenCalledWith('presentation:subtitle', { text: '' });
  });

  it('does not emit when Presenter is inactive', () => {
    const sender = vi.fn().mockResolvedValue(true);

    syncPresenterSubtitle(false, true, { text: 'Visible cue' }, sender);

    expect(sender).not.toHaveBeenCalled();
  });
});

describe('presenter exit guard', () => {
  it('blocks a home reset and preserves selection while presenting', () => {
    let activeCourseIndex: number | null = 2;
    let activeSlideshowIndex: number | null = 1;
    let selectedManual: string | null = 'adult-cpr';
    let activeTab = 'manual';
    const onBlocked = vi.fn();
    const onExit = vi.fn(() => {
      activeCourseIndex = null;
      activeSlideshowIndex = null;
      selectedManual = null;
      activeTab = 'video';
    });

    expect(runPresenterExitGuard(true, onBlocked, onExit)).toBe(false);
    expect(onBlocked).toHaveBeenCalledWith('Stop presenting to return home');
    expect(onExit).not.toHaveBeenCalled();
    expect({ activeCourseIndex, activeSlideshowIndex, selectedManual, activeTab }).toEqual({
      activeCourseIndex: 2,
      activeSlideshowIndex: 1,
      selectedManual: 'adult-cpr',
      activeTab: 'manual',
    });
  });

  it('runs the home reset when Presenter is inactive', () => {
    const onBlocked = vi.fn();
    const onExit = vi.fn();

    expect(runPresenterExitGuard(false, onBlocked, onExit)).toBe(true);
    expect(onBlocked).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledOnce();
  });
});

describe('manual close and recovery', () => {
  it('clears only the manual and preserves course and slideshow selection', () => {
    const activeCourseIndex = 2;
    const activeSlideshowIndex = 1;
    let selectedManual: string | null = 'adult-cpr';
    let activeTab: 'video' | 'manual' = 'manual';

    closeManualSurface(
      (manual) => { selectedManual = manual; },
      (tab) => { activeTab = tab; },
    );

    expect({ activeCourseIndex, activeSlideshowIndex, selectedManual, activeTab }).toEqual({
      activeCourseIndex: 2,
      activeSlideshowIndex: 1,
      selectedManual: null,
      activeTab: 'video',
    });
  });

  it('remains available during Presenter without setting an error banner', () => {
    const isPresentingExternally = true;
    let selectedManual: string | null = 'student-manual';
    let activeTab: 'video' | 'manual' = 'manual';
    const setPresenterError = vi.fn();

    closeManualSurface(
      (manual) => { selectedManual = manual; },
      (tab) => { activeTab = tab; },
    );

    expect(isPresentingExternally).toBe(true);
    expect(selectedManual).toBeNull();
    expect(activeTab).toBe('video');
    expect(setPresenterError).not.toHaveBeenCalled();
  });
});

describe('conference USB auto-detection', () => {
  const detectedDrive: DetectedUsbDrive = {
    folder: '/Volumes/EHA Conference',
    summary: {
      appVersion: '3.0.0',
      generatedAt: '2026-08-03T00:00:00Z',
      fileCount: 344,
      totalBytes: 2_351_000_000,
    },
  };

  it('does not show the import banner during Presenter or an active import', () => {
    expect(shouldShowUsbDriveBanner(detectedDrive, true, false)).toBe(false);
    expect(shouldShowUsbDriveBanner(detectedDrive, false, true)).toBe(false);
    expect(shouldShowUsbDriveBanner(detectedDrive, false, false)).toBe(true);
  });

  it('passes the detected folder and summary into the existing start-import path', () => {
    const startImport = vi.fn();

    beginDetectedUsbImport(detectedDrive, startImport);

    expect(startImport).toHaveBeenCalledOnce();
    expect(startImport).toHaveBeenCalledWith(detectedDrive.folder, detectedDrive.summary);
  });
});
