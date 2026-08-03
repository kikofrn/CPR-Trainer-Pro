import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const repositoryRoot = process.cwd();
const approvedReferenceSha = '39b4bb1b881119c054feb9c576b16fd663d0f2f8';
const archivedManifestPath = requiredAbsoluteFile('GATE_ARCHIVED_REFERENCE_MANIFEST');
const referenceDir = requiredAbsoluteDirectory('GATE_REFERENCE_REVALIDATION_DIR');
const candidateDir = requiredAbsoluteDirectory('GATE_CANDIDATE_SCREENSHOT_DIR');
const reportDir = requiredAbsoluteOutputDirectory('GATE_SCREENSHOT_REPORT_DIR');
const allowFontDiff = process.env.GATE_ALLOW_FONT_DIFF === '1';

function assertOutsideRepository(target, label) {
  const relative = path.relative(repositoryRoot, target);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error(`${label} must be outside the repository working tree.`);
  }
}

function requiredAbsoluteFile(name) {
  const configured = process.env[name];
  if (!configured || !path.isAbsolute(configured)) throw new Error(`${name} must be an absolute file path.`);
  const resolved = path.resolve(configured);
  assertOutsideRepository(resolved, name);
  if (!fs.statSync(resolved).isFile()) throw new Error(`${name} must identify a file.`);
  return resolved;
}

function requiredAbsoluteDirectory(name) {
  const configured = process.env[name];
  if (!configured || !path.isAbsolute(configured)) throw new Error(`${name} must be an absolute directory.`);
  const resolved = path.resolve(configured);
  assertOutsideRepository(resolved, name);
  if (!fs.statSync(resolved).isDirectory()) throw new Error(`${name} must identify a directory.`);
  return resolved;
}

function requiredAbsoluteOutputDirectory(name) {
  const configured = process.env[name];
  if (!configured || !path.isAbsolute(configured)) throw new Error(`${name} must be an absolute directory.`);
  const resolved = path.resolve(configured);
  assertOutsideRepository(resolved, name);
  if (fs.existsSync(resolved) && fs.readdirSync(resolved).length > 0) {
    throw new Error(`${name} must be empty or not yet exist.`);
  }
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function passB(manifest, surface) {
  const entry = manifest?.passes?.['pass-b']?.[surface];
  if (!entry) throw new Error(`Manifest has no pass-b record for ${surface}.`);
  return entry;
}

function validateReferenceReproduction(archived, revalidated) {
  if (archived.candidateCodeSha !== approvedReferenceSha || revalidated.candidateCodeSha !== approvedReferenceSha) {
    throw new Error('Reference validation must use the approved Gate-1 candidate SHA.');
  }
  if (revalidated.captureType !== 'reference-revalidation') {
    throw new Error('Reference capture must set GATE_SCREENSHOT_CAPTURE_TYPE=reference-revalidation.');
  }
  const failures = [];
  for (const surface of archived.surfaces) {
    const expected = passB(archived, surface);
    const actual = passB(revalidated, surface);
    const image = path.join(referenceDir, 'pass-b', `${surface}.png`);
    const diskHash = sha256(image);
    if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes || diskHash !== expected.sha256) {
      failures.push({
        surface,
        expected: { sha256: expected.sha256, bytes: expected.bytes },
        actual: { sha256: actual.sha256, bytes: actual.bytes, diskHash },
      });
    }
  }
  if (failures.length) {
    throw new Error(`Archived Gate-1 hash reproduction failed; candidate comparison is prohibited.\n${JSON.stringify(failures, null, 2)}`);
  }
}

function sameEnvironment(reference, candidate) {
  return JSON.stringify(reference.environment) === JSON.stringify(candidate.environment);
}

function sameGeometry(referenceEntry, candidateEntry) {
  return JSON.stringify(referenceEntry.layout?.geometry ?? null) === JSON.stringify(candidateEntry.layout?.geometry ?? null);
}

function inAnyTextRect(x, y, rects) {
  const px = x + 0.5;
  const py = y + 0.5;
  return rects.some(rect => px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height);
}

async function compareSurface(surface, referenceManifest, candidateManifest) {
  const referenceEntry = passB(referenceManifest, surface);
  const candidateEntry = passB(candidateManifest, surface);
  const referencePath = path.join(referenceDir, 'pass-b', `${surface}.png`);
  const candidatePath = path.join(candidateDir, 'pass-b', `${surface}.png`);
  const referenceImage = await sharp(referencePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const candidateImage = await sharp(candidatePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const referenceInfo = referenceImage.info;
  const candidateInfo = candidateImage.info;
  if (referenceInfo.width !== candidateInfo.width || referenceInfo.height !== candidateInfo.height || referenceInfo.channels !== candidateInfo.channels) {
    throw new Error(`${surface}: image geometry differs (${referenceInfo.width}x${referenceInfo.height} vs ${candidateInfo.width}x${candidateInfo.height}).`);
  }

  const totalPixels = referenceInfo.width * referenceInfo.height;
  const output = Buffer.alloc(referenceImage.data.length);
  const textRects = [
    ...(referenceEntry.layout?.textRects ?? []),
    ...(candidateEntry.layout?.textRects ?? []),
  ];
  let changedPixels = 0;
  let nonTextChangedPixels = 0;
  let minX = referenceInfo.width;
  let minY = referenceInfo.height;
  let maxX = -1;
  let maxY = -1;

  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    const offset = pixel * referenceInfo.channels;
    let changed = false;
    for (let channel = 0; channel < referenceInfo.channels; channel += 1) {
      if (referenceImage.data[offset + channel] !== candidateImage.data[offset + channel]) changed = true;
    }
    const x = pixel % referenceInfo.width;
    const y = Math.floor(pixel / referenceInfo.width);
    if (changed) {
      changedPixels += 1;
      if (!inAnyTextRect(x, y, textRects)) nonTextChangedPixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      output[offset] = 255;
      output[offset + 1] = 0;
      output[offset + 2] = 255;
      output[offset + 3] = 255;
    } else {
      const gray = Math.round((referenceImage.data[offset] + referenceImage.data[offset + 1] + referenceImage.data[offset + 2]) / 3);
      output[offset] = gray;
      output[offset + 1] = gray;
      output[offset + 2] = gray;
      output[offset + 3] = 80;
    }
  }

  const changedRatio = changedPixels / totalPixels;
  const nonTextChangedRatio = nonTextChangedPixels / totalPixels;
  const geometryUnchanged = sameGeometry(referenceEntry, candidateEntry);
  const exact = changedPixels === 0;
  const normalAcceptance = changedRatio <= 0.001;
  const fontAcceptance = allowFontDiff && geometryUnchanged && nonTextChangedPixels === 0 && nonTextChangedRatio < 0.001;
  const accepted = exact || normalAcceptance || fontAcceptance;
  if (changedPixels > 0) {
    await sharp(output, { raw: referenceInfo }).png().toFile(path.join(reportDir, `${surface}.diff.png`));
  }
  return {
    surface,
    accepted,
    exact,
    acceptance: exact ? 'exact' : fontAcceptance ? 'font-text-bounds' : normalAcceptance ? 'under-0.1-percent' : 'failed',
    dimensions: { width: referenceInfo.width, height: referenceInfo.height },
    changedPixels,
    changedRatio,
    nonTextChangedPixels,
    nonTextChangedRatio,
    geometryUnchanged,
    changedBounds: changedPixels === 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  };
}

const archivedManifest = readJson(archivedManifestPath);
const referenceManifest = readJson(path.join(referenceDir, 'manifest.json'));
const candidateManifest = readJson(path.join(candidateDir, 'manifest.json'));
validateReferenceReproduction(archivedManifest, referenceManifest);
if (candidateManifest.captureType !== 'candidate') throw new Error('Candidate capture must use GATE_SCREENSHOT_CAPTURE_TYPE=candidate.');
if (!sameEnvironment(referenceManifest, candidateManifest)) {
  throw new Error('Reference and candidate captures do not have identical recorded environments.');
}
const surfaces = referenceManifest.surfaces.filter(surface => candidateManifest.surfaces.includes(surface));
if (surfaces.length !== referenceManifest.surfaces.length || surfaces.length !== candidateManifest.surfaces.length) {
  throw new Error('Reference and candidate surface sets differ.');
}

const comparisons = [];
for (const surface of surfaces) comparisons.push(await compareSurface(surface, referenceManifest, candidateManifest));
const report = {
  schemaVersion: 1,
  approvedReferenceSha,
  candidateCodeSha: candidateManifest.candidateCodeSha,
  archivedReferenceRevalidated: true,
  sameEnvironment: true,
  allowFontDiff,
  accepted: comparisons.every(comparison => comparison.accepted),
  comparisons,
};
fs.writeFileSync(path.join(reportDir, 'comparison.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (!report.accepted) process.exitCode = 1;
