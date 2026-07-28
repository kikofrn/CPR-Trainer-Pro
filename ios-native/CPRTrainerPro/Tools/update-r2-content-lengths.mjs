import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolDirectory, "..");
const manifestPath = path.join(
  projectDirectory,
  "CPRTrainerPro/Resources/content-manifest.json"
);
const contentLengthsOutputPath = path.join(toolDirectory, "r2-content-lengths.json");
const metadataOutputPath = path.join(toolDirectory, "r2-object-metadata.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const previousMetadata = Object.fromEntries(
  manifest.packages
    .flatMap((downloadPackage) => downloadPackage.assets)
    .filter((asset) => asset.eTag)
    .map((asset) => [
      asset.filename,
      {
        byteCount: asset.byteCount,
        eTag: asset.eTag,
        lastModified: asset.lastModified,
      },
    ])
);

const filenames = [...new Set(
  manifest.packages
    .flatMap((downloadPackage) => downloadPackage.assets)
    .map((asset) => asset.filename)
)].sort((left, right) => left.localeCompare(right));

const reviewedBundledOnlySubtitles = new Set([
  "subtitles/12_EHAcademy - CPR AED Course Pres-Assessment Example.vtt",
  "subtitles/17_EHAcademy - CPR AED Course Pres-Chest Compressions Video.vtt",
  "subtitles/21_EHAcademy - CPR AED Course Pres-CPR Songs.vtt",
  "subtitles/22_EHAcademy - CPR AED Course Pres-Practice Compressions.vtt",
  "subtitles/11_EHAcademy - First Aid Course Pres-Seizure Video.vtt",
]);

const endpoint = new URL("/api/manifest", manifest.mediaBaseURL);
const response = await fetch(endpoint, {
  headers: { Accept: "application/json", "Cache-Control": "no-cache" },
  method: "GET",
    redirect: "follow",
  signal: AbortSignal.timeout(30_000),
});
if (response.status !== 200) {
  throw new Error(`R2 manifest request failed: HTTP ${response.status}`);
}
const text = await response.text();
if (Buffer.byteLength(text) > 2 * 1024 * 1024) {
  throw new Error("R2 manifest exceeds the 2 MB safety limit");
}
const payload = JSON.parse(text);
if (!Array.isArray(payload.files)) {
  throw new Error("R2 manifest is missing its files array");
}
const liveByKey = new Map(payload.files.map((file) => [file.key, file]));
const objectMetadata = {};
const failures = [];

for (const filename of filenames) {
  const file = liveByKey.get(filename);
  if (!file) {
    if (!reviewedBundledOnlySubtitles.has(filename)) {
      failures.push(`${filename}: missing exact key`);
    }
    continue;
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    failures.push(`${filename}: missing or invalid size`);
    continue;
  }
  const rawETag = String(file.etag ?? "").trim();
  const uploaded = String(file.uploaded ?? "").trim();
  const canonicalETag = rawETag
    .replace(/^W\//i, "")
    .replace(/^"|"$/g, "");
  if (!canonicalETag) {
    failures.push(`${filename}: missing ETag`);
    continue;
  }
  if (!uploaded || Number.isNaN(Date.parse(uploaded))) {
    failures.push(`${filename}: missing or invalid upload date`);
    continue;
  }
  const previous = previousMetadata[filename];
  const previousCanonicalETag = String(previous?.eTag ?? "")
    .trim()
    .replace(/^W\//i, "")
    .replace(/^"|"$/g, "");
  if (
    previous?.byteCount === file.size
    && previousCanonicalETag === canonicalETag
  ) {
    objectMetadata[filename] = previous;
  } else {
    const isSubtitle = filename.startsWith("Subtitles/");
    objectMetadata[filename] = {
      byteCount: file.size,
      eTag: isSubtitle ? canonicalETag : `"${canonicalETag}"`,
      lastModified: isSubtitle
        ? uploaded
        : new Date(uploaded).toUTCString(),
    };
  }
}

if (failures.length > 0) {
  throw new Error(`R2 manifest discovery failed:\n${failures.join("\n")}`);
}

const orderedMetadata = Object.fromEntries(
  Object.entries(objectMetadata)
    .sort(([left], [right]) => left.localeCompare(right))
);
const orderedContentLengths = Object.fromEntries(
  Object.entries(orderedMetadata).map(([filename, metadata]) => [
    filename,
    metadata.byteCount,
  ])
);

function writeJSONAtomically(outputPath, value) {
  const temporaryPath = `${outputPath}.update-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporaryPath, outputPath);
}

writeJSONAtomically(contentLengthsOutputPath, orderedContentLengths);
writeJSONAtomically(metadataOutputPath, orderedMetadata);

const totalBytes = Object.values(orderedContentLengths)
  .reduce((total, byteCount) => total + byteCount, 0);
console.log(`Wrote ${path.relative(projectDirectory, contentLengthsOutputPath)}`);
console.log(`Wrote ${path.relative(projectDirectory, metadataOutputPath)}`);
console.log(`Referenced R2 objects: ${Object.keys(orderedMetadata).length}`);
console.log(`Reviewed bundled-only captions: ${reviewedBundledOnlySubtitles.size}`);
console.log(`Total bytes: ${totalBytes}`);
