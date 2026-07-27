export interface ManifestFile {
  key: string;
  etag: string;
  uploaded: string;
  size: number;
}

export interface SnapshotFile {
  etag: string;
  uploaded: string;
  size: number;
}

export interface LocalFile {
  mtime: number; // in milliseconds
}

export interface ChangedFile {
  key: string;
  version: string;
  size: number;
  isSilent: boolean;
}

export interface UpdateCheckResult {
  changedFiles: ChangedFile[];
  missingEtagsToUpdate: Record<string, SnapshotFile>;
}

export function getRelevantKeys(
  slideshows: { slides: { filename: string }[] }[],
  courses: { chapters: { filename: string }[], manualFilename?: string }[],
  manuals: { filename: string }[],
  thumbnails: string[]
): Set<string> {
  const keys = new Set<string>();

  for (const s of slideshows) {
    for (const slide of s.slides) {
      if (slide.filename) keys.add(slide.filename);
    }
  }

  for (const c of courses) {
    if (c.manualFilename) keys.add(c.manualFilename);
    for (const chap of c.chapters) {
      if (chap.filename) keys.add(chap.filename);
    }
  }

  for (const m of manuals) {
    if (m.filename) keys.add(m.filename);
  }

  for (const t of thumbnails) {
    if (t) keys.add(t);
  }

  return keys;
}

export function checkUpdates(
  relevantKeys: Set<string>,
  manifestFiles: ManifestFile[],
  snapshotFiles: Record<string, SnapshotFile>,
  localFiles: Record<string, LocalFile>,
  thumbnailsRegistry: Set<string>
): UpdateCheckResult {
  const changedFiles: ChangedFile[] = [];
  const missingEtagsToUpdate: Record<string, SnapshotFile> = {};

  const manifestMap = new Map<string, ManifestFile>();
  for (const f of manifestFiles) {
    manifestMap.set(f.key, f);
  }

  for (const key of relevantKeys) {
    const local = localFiles[key];
    if (!local) {
      // files never downloaded are excluded
      continue;
    }

    const manifestFile = manifestMap.get(key);
    if (!manifestFile) {
      continue;
    }

    const snap = snapshotFiles[key];

    if (snap) {
      // diff manifest entries against the snapshot; etag inequality means changed
      if (snap.etag !== manifestFile.etag) {
        changedFiles.push({
          key,
          version: manifestFile.etag,
          size: manifestFile.size,
          isSilent: thumbnailsRegistry.has(key)
        });
      }
    } else {
      // missing snapshot entry falls back to the uploaded versus local file mtime rule with the 10 minute skew margin
      const uploadedMs = new Date(manifestFile.uploaded).getTime();
      const skewMarginMs = 10 * 60 * 1000;
      
      if (uploadedMs > local.mtime + skewMarginMs) {
        changedFiles.push({
          key,
          version: manifestFile.etag,
          size: manifestFile.size,
          isSilent: thumbnailsRegistry.has(key)
        });
      } else {
        missingEtagsToUpdate[key] = {
          etag: manifestFile.etag,
          uploaded: manifestFile.uploaded,
          size: manifestFile.size
        };
      }
    }
  }

  return { changedFiles, missingEtagsToUpdate };
}
