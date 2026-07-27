import fs from 'fs';
import { URL } from 'url';

const manifestPath = new URL('../src/chapters.ts', import.meta.url).pathname;

async function run() {
  const args = process.argv.slice(2);
  let manifestData;
  let regenerateFolder = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i+1]) {
      manifestData = JSON.parse(fs.readFileSync(args[i+1], 'utf-8'));
      i++;
    } else if (args[i] === '--regenerate' && args[i+1]) {
      regenerateFolder = args[i+1];
      i++;
    }
  }

  if (!manifestData) {
    const res = await fetch('https://media.ehacademy.com/api/manifest');
    manifestData = await res.json();
  }

  const { COURSES, SLIDESHOWS, MANUALS } = await import(manifestPath);

  // Collect all references
  const referencedFiles = new Set();
  const courseFolders = new Set();
  const existingMetadata = new Map(); // key: folder -> prefix -> metadata object
  
  const addRef = (path, slideOrChapter) => {
    if (!path) return;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    referencedFiles.add(cleanPath);
    const parts = cleanPath.split('/');
    if (parts.length > 1) {
      const folder = parts[0];
      courseFolders.add(folder);
      
      // Store metadata for regeneration
      if (!existingMetadata.has(folder)) {
        existingMetadata.set(folder, new Map());
      }
      const filename = parts[parts.length - 1];
      const match = filename.match(/^(\d+)/);
      if (match) {
        const prefix = parseInt(match[1], 10);
        // Save id, duration, isSectionHeader, parentSectionId
        const meta = {};
        if (slideOrChapter.id) meta.id = slideOrChapter.id;
        if (slideOrChapter.duration) meta.duration = slideOrChapter.duration;
        if (slideOrChapter.isSectionHeader) meta.isSectionHeader = slideOrChapter.isSectionHeader;
        if (slideOrChapter.parentSectionId) meta.parentSectionId = slideOrChapter.parentSectionId;
        existingMetadata.get(folder).set(prefix, meta);
      }
    }
  };

  for (const c of COURSES) {
    if (c.isComingSoon) continue;
    if (c.chapters) {
      c.chapters.forEach(ch => addRef(ch.filename, ch));
    }
  }
  for (const s of SLIDESHOWS) {
    if (s.isComingSoon) continue;
    if (s.slides) {
      s.slides.forEach(slide => addRef(slide.filename, slide));
    }
  }
  for (const m of MANUALS) {
    if (m.isComingSoon) continue;
    if (m.filename) {
      const cleanPath = m.filename.startsWith('/') ? m.filename.slice(1) : m.filename;
      referencedFiles.add(cleanPath);
    }
  }

  const bucketFiles = manifestData.files.map(f => f.key);
  const bucketSet = new Set(bucketFiles);

  let hasError = false;

  // Direction 1: Every referenced file must exist in bucket
  console.log("--- Direction 1: Checking referenced files exist in bucket ---");
  for (const ref of referencedFiles) {
    if (!bucketSet.has(ref)) {
      console.error(`[FAIL] Referenced file not found in bucket: ${ref}`);
      hasError = true;
    }
  }

  // Direction 2: Every media file in a course folder in the bucket must be referenced
  console.log("\\n--- Direction 2: Checking bucket media files are referenced ---");
  const folderBucketFiles = new Map();
  for (const folder of courseFolders) {
    folderBucketFiles.set(folder, []);
  }

  for (const file of bucketFiles) {
    const parts = file.split('/');
    if (parts.length > 1) {
      const folder = parts[0];
      if (courseFolders.has(folder)) {
        folderBucketFiles.get(folder).push(file);
      }
    }
  }

  for (const [folder, files] of folderBucketFiles.entries()) {
    for (const file of files) {
      const ext = file.split('.').pop().toLowerCase();
      if (ext === 'png' || ext === 'mp4') {
        if (!referencedFiles.has(file)) {
          console.error(`[FAIL] Unreferenced media file in bucket: ${file}`);
          hasError = true;
        }
      } else {
        console.warn(`[WARN] Contamination in bucket folder '${folder}': ${file}`);
      }
    }
  }

  const uncoveredFolders = new Map();
  for (const file of bucketFiles) {
    const parts = file.split('/');
    if (parts.length > 1) {
      const folder = parts[0];
      if (!courseFolders.has(folder)) {
        uncoveredFolders.set(folder, (uncoveredFolders.get(folder) || 0) + 1);
      }
    }
  }
  for (const [folder, count] of uncoveredFolders.entries()) {
    console.info(`[INFO] Folder not covered by active courses: ${folder} (${count} files)`);
  }

  if (regenerateFolder) {
    console.log(`\\n--- Regenerating array for folder: ${regenerateFolder} ---`);
    const filesInFolder = folderBucketFiles.get(regenerateFolder) || [];
    const mediaFiles = filesInFolder.filter(f => {
      const ext = f.split('.').pop().toLowerCase();
      return ext === 'png' || ext === 'mp4';
    });

    const items = [];
    const metaMap = existingMetadata.get(regenerateFolder) || new Map();

    for (const file of mediaFiles) {
      const filename = file.split('/').pop();
      const match = filename.match(/^(\d+)/);
      const prefix = match ? parseInt(match[1], 10) : 0;
      
      const ext = file.split('.').pop().toLowerCase();
      const type = ext === 'mp4' ? 'video' : 'image';
      
      // Strip prefix NN_EHAcademy - <Something>-
      let title = filename.replace(/^\\d+_[^-]+-\\s*[^-]+-\\s*/, '');
      title = title.replace(/^[\\s-]+/, '');
      title = title.replace(/\\.(png|mp4)$/i, '');

      const item = {
        title,
        filename: file,
        type,
        _prefix: prefix
      };
      
      if (metaMap.has(prefix)) {
        Object.assign(item, metaMap.get(prefix));
      }
      items.push(item);
    }

    items.sort((a, b) => a._prefix - b._prefix);
    items.forEach(item => delete item._prefix);

    console.log(JSON.stringify(items, null, 2));
  }

  if (hasError) {
    console.error("\\nReconciliation failed.");
    process.exit(1);
  } else {
    console.log("\\nReconciliation passed.");
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
