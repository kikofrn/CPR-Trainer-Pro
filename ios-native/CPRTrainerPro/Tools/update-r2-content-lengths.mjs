import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolDirectory, "..");
const manifestPath = path.join(
  projectDirectory,
  "CPRTrainerPro/Resources/content-manifest.json"
);
const outputPath = path.join(toolDirectory, "r2-content-lengths.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function mediaURL(filename) {
  const encodedPath = filename
    .replace(/^\/+/, "")
    .split("/")
    .map((component) => encodeURIComponent(component))
    .join("/");
  return new URL(encodedPath, manifest.mediaBaseURL).href;
}

const filenames = [...new Set(
  manifest.packages
    .flatMap((downloadPackage) => downloadPackage.assets)
    .filter((asset) => asset.kind !== "subtitle")
    .map((asset) => asset.filename)
)].sort((left, right) => left.localeCompare(right));

const contentLengths = {};
const failures = [];
let nextIndex = 0;
let completed = 0;

async function readContentLength(filename) {
  const response = await fetch(mediaURL(filename), {
    method: "HEAD",
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  await response.body?.cancel();

  if (response.status < 200 || response.status >= 400) {
    throw new Error(`HTTP ${response.status}`);
  }

  const byteCount = Number(response.headers.get("content-length"));
  if (!Number.isSafeInteger(byteCount) || byteCount <= 0) {
    throw new Error("missing or invalid Content-Length");
  }

  return byteCount;
}

async function worker() {
  while (nextIndex < filenames.length) {
    const index = nextIndex;
    nextIndex += 1;
    const filename = filenames[index];

    try {
      contentLengths[filename] = await readContentLength(filename);
    } catch (error) {
      failures.push(
        `${filename}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    completed += 1;
    if (completed % 25 === 0 || completed === filenames.length) {
      console.log(`R2 size check: ${completed}/${filenames.length}`);
    }
  }
}

await Promise.all(Array.from({ length: 8 }, () => worker()));

if (failures.length > 0) {
  throw new Error(`R2 size discovery failed:\n${failures.join("\n")}`);
}

const orderedContentLengths = Object.fromEntries(
  Object.entries(contentLengths)
    .sort(([left], [right]) => left.localeCompare(right))
);
const temporaryPath = `${outputPath}.update-${process.pid}`;
fs.writeFileSync(temporaryPath, `${JSON.stringify(orderedContentLengths, null, 2)}\n`);
fs.renameSync(temporaryPath, outputPath);

const totalBytes = Object.values(orderedContentLengths)
  .reduce((total, byteCount) => total + byteCount, 0);
console.log(`Wrote ${path.relative(projectDirectory, outputPath)}`);
console.log(`Unique R2 objects: ${filenames.length}`);
console.log(`Total bytes: ${totalBytes}`);
