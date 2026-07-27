import { describe, it, expect } from 'vitest';
import { checkUpdates, ManifestFile, SnapshotFile, LocalFile } from './update-checker';

describe('update-checker', () => {
  it('identical etags produce no changes', () => {
    const relevantKeys = new Set(['course1.mp4']);
    const thumbnailsRegistry = new Set<string>();
    
    const manifestFiles: ManifestFile[] = [
      { key: 'course1.mp4', etag: 'etag123', uploaded: '2026-07-20T10:00:00Z', size: 1000 }
    ];
    const snapshotFiles: Record<string, SnapshotFile> = {
      'course1.mp4': { etag: 'etag123', uploaded: '2026-07-20T10:00:00Z', size: 1000 }
    };
    const localFiles: Record<string, LocalFile> = {
      'course1.mp4': { mtime: new Date('2026-07-20T10:00:00Z').getTime() }
    };

    const { changedFiles, missingEtagsToUpdate } = checkUpdates(
      relevantKeys, manifestFiles, snapshotFiles, localFiles, thumbnailsRegistry
    );

    expect(changedFiles).toHaveLength(0);
    expect(Object.keys(missingEtagsToUpdate)).toHaveLength(0);
  });

  it('a changed etag produces a change', () => {
    const relevantKeys = new Set(['course1.mp4']);
    const thumbnailsRegistry = new Set<string>();
    
    const manifestFiles: ManifestFile[] = [
      { key: 'course1.mp4', etag: 'etag456', uploaded: '2026-07-22T10:00:00Z', size: 1005 }
    ];
    const snapshotFiles: Record<string, SnapshotFile> = {
      'course1.mp4': { etag: 'etag123', uploaded: '2026-07-20T10:00:00Z', size: 1000 }
    };
    const localFiles: Record<string, LocalFile> = {
      'course1.mp4': { mtime: new Date('2026-07-20T10:00:00Z').getTime() }
    };

    const { changedFiles } = checkUpdates(
      relevantKeys, manifestFiles, snapshotFiles, localFiles, thumbnailsRegistry
    );

    expect(changedFiles).toHaveLength(1);
    expect(changedFiles[0].key).toBe('course1.mp4');
    expect(changedFiles[0].version).toBe('etag456');
    expect(changedFiles[0].isSilent).toBe(false);
  });

  it('first run fallback with and without the skew margin', () => {
    const relevantKeys = new Set(['changed.mp4', 'unchanged.mp4']);
    const thumbnailsRegistry = new Set<string>();
    
    const manifestFiles: ManifestFile[] = [
      { key: 'changed.mp4', etag: 'etag1', uploaded: '2026-07-22T10:15:00Z', size: 1000 },
      { key: 'unchanged.mp4', etag: 'etag2', uploaded: '2026-07-22T10:05:00Z', size: 1000 },
    ];
    // No snapshot entries
    const snapshotFiles: Record<string, SnapshotFile> = {};
    
    const localMtime = new Date('2026-07-22T10:00:00Z').getTime(); // base time
    
    const localFiles: Record<string, LocalFile> = {
      'changed.mp4': { mtime: localMtime },
      'unchanged.mp4': { mtime: localMtime }
    };

    const { changedFiles, missingEtagsToUpdate } = checkUpdates(
      relevantKeys, manifestFiles, snapshotFiles, localFiles, thumbnailsRegistry
    );

    // changed.mp4 uploaded is 15 minutes after local mtime -> exceeds 10 min margin -> changed
    // unchanged.mp4 uploaded is 5 minutes after local mtime -> within 10 min margin -> unchanged
    
    expect(changedFiles).toHaveLength(1);
    expect(changedFiles[0].key).toBe('changed.mp4');

    expect(Object.keys(missingEtagsToUpdate)).toHaveLength(1);
    expect(missingEtagsToUpdate['unchanged.mp4']).toBeDefined();
    expect(missingEtagsToUpdate['unchanged.mp4'].etag).toBe('etag2');
  });

  it('never downloaded exclusion', () => {
    const relevantKeys = new Set(['course1.mp4', 'not_downloaded.mp4']);
    const thumbnailsRegistry = new Set<string>();
    
    const manifestFiles: ManifestFile[] = [
      { key: 'course1.mp4', etag: 'etag1', uploaded: '2026-07-22T10:00:00Z', size: 1000 },
      { key: 'not_downloaded.mp4', etag: 'etag2', uploaded: '2026-07-22T10:00:00Z', size: 1000 }
    ];
    // not_downloaded.mp4 is missing from localFiles entirely
    const localFiles: Record<string, LocalFile> = {
      'course1.mp4': { mtime: new Date('2026-07-20T10:00:00Z').getTime() }
    };
    
    const snapshotFiles: Record<string, SnapshotFile> = {
      'course1.mp4': { etag: 'etag1', uploaded: '2026-07-22T10:00:00Z', size: 1000 }
    };

    const { changedFiles, missingEtagsToUpdate } = checkUpdates(
      relevantKeys, manifestFiles, snapshotFiles, localFiles, thumbnailsRegistry
    );

    expect(changedFiles).toHaveLength(0);
    expect(Object.keys(missingEtagsToUpdate)).toHaveLength(0);
  });

  it('thumbnail silence flag', () => {
    const relevantKeys = new Set(['thumb1.png']);
    const thumbnailsRegistry = new Set(['thumb1.png']);
    
    const manifestFiles: ManifestFile[] = [
      { key: 'thumb1.png', etag: 'new_etag', uploaded: '2026-07-22T10:00:00Z', size: 100 }
    ];
    const snapshotFiles: Record<string, SnapshotFile> = {
      'thumb1.png': { etag: 'old_etag', uploaded: '2026-07-20T10:00:00Z', size: 100 }
    };
    const localFiles: Record<string, LocalFile> = {
      'thumb1.png': { mtime: new Date('2026-07-20T10:00:00Z').getTime() }
    };

    const { changedFiles } = checkUpdates(
      relevantKeys, manifestFiles, snapshotFiles, localFiles, thumbnailsRegistry
    );

    expect(changedFiles).toHaveLength(1);
    expect(changedFiles[0].key).toBe('thumb1.png');
    expect(changedFiles[0].isSilent).toBe(true);
  });
});
