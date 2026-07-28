import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(toolDirectory, "..");
const resourcesDirectory = path.join(projectDirectory, "CPRTrainerPro/Resources");
const manifestPath = path.join(resourcesDirectory, "content-manifest.json");
const tipsPath = path.join(resourcesDirectory, "instructor-tips.json");
const subtitlesDirectory = path.join(resourcesDirectory, "Subtitles");
const artworkDirectory = path.join(resourcesDirectory, "Artwork");
const r2ContentLengthsPath = path.join(projectDirectory, "Tools/r2-content-lengths.json");
const r2ObjectMetadataPath = path.join(projectDirectory, "Tools/r2-object-metadata.json");
const shouldVerifyNetwork = process.argv.includes("--network");
const baseURLArgument = process.argv
  .find((argument) => argument.startsWith("--base-url="))
  ?.slice("--base-url=".length);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJSON(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function assertSameStrings(actual, expected, label) {
  const actualSorted = sorted(actual);
  const expectedSorted = sorted(expected);
  assert(
    JSON.stringify(actualSorted) === JSON.stringify(expectedSorted),
    `${label} mismatch.\nExpected: ${expectedSorted.join(", ")}\nActual: ${actualSorted.join(", ")}`
  );
}

function assertSequentialIDs(items, prefix, ownerID) {
  const ids = new Set(items.map((item) => item.id));

  items.forEach((item, index) => {
    assert(item.id === `${prefix}${index + 1}`, `Unexpected id ${item.id} in ${ownerID}`);
    assert(typeof item.filename === "string" && item.filename.length > 0, `Missing filename for ${item.id}`);
    assert(!item.filename.startsWith("/"), `Leading slash in ${ownerID}/${item.id}`);
    assert(!item.filename.split("/").includes(".."), `Unsafe filename in ${ownerID}/${item.id}`);
    if (item.parentSectionId) {
      assert(ids.has(item.parentSectionId), `Missing parent ${item.parentSectionId} in ${ownerID}`);
    }
  });
}

const manifest = readJSON(manifestPath);
const tipsManifest = readJSON(tipsPath);
const r2ContentLengths = readJSON(r2ContentLengthsPath);
const r2ObjectMetadata = readJSON(r2ObjectMetadataPath);
const remoteBaseURL = baseURLArgument ?? manifest.mediaBaseURL;

assert(manifest.schemaVersion === 1, "Unsupported manifest schema");
assert(manifest.contentRevision === "experiment-3.0", "Unexpected content revision");
assert(manifest.courses.length === 2, "Expected two top-level courses");
assertSameStrings(
  manifest.courses.map((course) => course.id),
  ["cpr-aed", "first-aid"],
  "Top-level courses"
);

const expectedCourseModes = new Map([
  ["cpr-aed", ["cpr-aed-course", "cpr-aed", "pediatric-cpr-aed-course", "pediatric-cpr-aed"]],
  ["first-aid", ["first-aid-course", "first-aid", "pediatric-first-aid-course", "pediatric-first-aid"]],
]);
for (const course of manifest.courses) {
  assertSameStrings(
    course.modes.map((mode) => mode.id),
    expectedCourseModes.get(course.id),
    `Modes for ${course.id}`
  );

  for (const mode of course.modes) {
    assert(typeof mode.isAvailable === "boolean", `${mode.id} must declare isAvailable`);
    if (mode.isAvailable && mode.id.startsWith("pediatric-")) {
      assert(mode.kind === "slideshow", `${mode.id} must be a non-VA slideshow`);
    }
    if (!mode.isAvailable) {
      assert(!mode.packageID, `${mode.id} must not reference a downloadable package`);
    }
  }
}

const expectedSlideshows = new Map([
  ["cpr-aed-course", { count: 39, videoPositions: [8, 12, 17, 21, 22] }],
  ["first-aid-course", { count: 46, videoPositions: [11] }],
  ["pediatric-first-aid-course", { count: 45, videoPositions: [] }],
  ["pediatric-cpr-aed-course", { count: 36, videoPositions: [11, 16, 20, 21] }],
]);
const expectedPediatricCPRMedia = new Map([
  ["slide-12", ["Assessment and Activation - Check Responsiveness", "Pedi CPR Presentation Slides/12_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Check Responsiveness.png"]],
  ["slide-13", ["Assessment and Activation - Getting Help", "Pedi CPR Presentation Slides/13_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Getting Help.png"]],
  ["slide-14", ["Assessment and Activation - Check Breathing", "Pedi CPR Presentation Slides/14_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Check Breathing.png"]],
  ["slide-15", ["Assessment and Activation - Begin Chest Compressions", "Pedi CPR Presentation Slides/15_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Begin Chest Compressions.png"]],
  ["slide-16", ["Chest Compression Effect", "Pedi CPR Presentation Slides/16_EHAcademy - Pedi CPR AED Course Pres-Chest Compression Effect Video.mp4"]],
  ["slide-20", ["CPR Song", "Pedi CPR Presentation Slides/20_EHAcademy - Pedi CPR AED Course Pres-CPR Song.mp4"]],
  ["slide-25", ["Put it all together", "Pedi CPR Presentation Slides/25_EHAcademy - Pedi CPR AED Course Pres-Put it all together.png"]],
  ["slide-26", ["Infant Assessment", "Pedi CPR Presentation Slides/26_EHAcademy - Pedi CPR AED Course Pres-Infant Assessment.png"]],
  ["slide-29", ["Infant AED Use", "Pedi CPR Presentation Slides/29_EHAcademy - Pedi CPR AED Course Pres-Infant AED Use.png"]],
  ["slide-30", ["Infant Scenario", "Pedi CPR Presentation Slides/30_EHAcademy - Pedi CPR AED Course Pres-Infant Scenario.png"]],
  ["slide-31", ["Mild Choking", "Pedi CPR Presentation Slides/31_EHAcademy - Pedi CPR AED Course Pres-Mild Choking.png"]],
  ["slide-32", ["Severe Choking", "Pedi CPR Presentation Slides/32_EHAcademy - Pedi CPR AED Course Pres-Severe Choking.png"]],
  ["slide-33", ["Choking Relief Child", "Pedi CPR Presentation Slides/33_EHAcademy - Pedi CPR AED Course Pres-Choking Relief Child.png"]],
  ["slide-34", ["Choking Relief Infant", "Pedi CPR Presentation Slides/34_EHAcademy - Pedi CPR AED Course Pres-Choking Relief Infant.png"]],
]);
assert(manifest.slideshows.length === expectedSlideshows.size, "Unexpected slideshow count");
for (const slideshow of manifest.slideshows) {
  const expected = expectedSlideshows.get(slideshow.id);
  assert(expected, `Unexpected slideshow ${slideshow.id}`);
  assert(slideshow.slides.length === expected.count, `Unexpected slide count for ${slideshow.id}`);
  assertSequentialIDs(slideshow.slides, "slide-", slideshow.id);

  const videoPositions = slideshow.slides
    .map((slide, index) => slide.type === "video" ? index + 1 : null)
    .filter((position) => position !== null);
  assert(
    JSON.stringify(videoPositions) === JSON.stringify(expected.videoPositions),
    `Unexpected video positions in ${slideshow.id}`
  );
}

const pediatricCPR = manifest.slideshows.find(
  (slideshow) => slideshow.id === "pediatric-cpr-aed-course"
);
assert(
  pediatricCPR.slides.every((slide) => slide.filename.startsWith("Pedi CPR Presentation Slides/")),
  "Pediatric CPR must use only pediatric R2 objects"
);
for (const [slideID, [title, filename]] of expectedPediatricCPRMedia) {
  const slide = pediatricCPR?.slides.find((item) => item.id === slideID);
  assert(
    slide?.filename === filename,
    `Unexpected R2 media mapping for pediatric-cpr-aed-course/${slideID}`
  );
  assert(slide?.title === title, `Unexpected title for pediatric-cpr-aed-course/${slideID}`);
}

const expectedVideoCourses = new Map([
  ["cpr-aed", { count: 30, prefix: "cpr-" }],
  ["first-aid", { count: 45, prefix: "fa-" }],
]);
assert(manifest.videoCourses.length === expectedVideoCourses.size, "Unexpected VA course count");
for (const course of manifest.videoCourses) {
  const expected = expectedVideoCourses.get(course.id);
  assert(expected, `Unexpected VA course ${course.id}`);
  assert(course.chapters.length === expected.count, `Unexpected chapter count for ${course.id}`);
  assertSequentialIDs(course.chapters, expected.prefix, course.id);
}

const firstAidVA = manifest.videoCourses.find((course) => course.id === "first-aid");
assert(firstAidVA.chapters.find((chapter) => chapter.id === "fa-10")?.duration === "0:43", "Incorrect seizure video duration");

const expectedPackageCounts = new Map([
  ["package.cpr-aed.slideshow", 43],
  ["package.cpr-aed.video", 60],
  ["package.cpr-aed.pediatric-slideshow", 36],
  ["package.first-aid.slideshow", 47],
  ["package.first-aid.video", 90],
  ["package.first-aid.pediatric-slideshow", 45],
  ["package.manual.instructor", 1],
  ["package.manual.student", 1],
  ["package.manual.pediatric", 1],
]);
assert(manifest.packages.length === expectedPackageCounts.size, "Unexpected package count");

const packagesByID = new Map(manifest.packages.map((downloadPackage) => [
  downloadPackage.id,
  downloadPackage,
]));
for (const [packageID, expectedCount] of expectedPackageCounts) {
  const downloadPackage = packagesByID.get(packageID);
  assert(downloadPackage, `Missing package ${packageID}`);
  assert(downloadPackage.assets.length === expectedCount, `Unexpected asset count for ${packageID}`);
  assert(
    new Set(downloadPackage.assets.map((asset) => asset.filename)).size === downloadPackage.assets.length,
    `Duplicate assets in ${packageID}`
  );
  for (const asset of downloadPackage.assets) {
    assert(
      Number.isSafeInteger(asset.byteCount) && asset.byteCount > 0,
      `Missing byteCount for ${packageID}/${asset.filename}`
    );
    if (asset.kind !== "subtitle") {
      assert(typeof asset.eTag === "string" && asset.eTag.length > 0, `Missing ETag for ${asset.filename}`);
      assert(
        typeof asset.lastModified === "string" && !Number.isNaN(Date.parse(asset.lastModified)),
        `Missing Last-Modified for ${asset.filename}`
      );
    }
  }
}

const remoteAssetsByFilename = new Map();
for (const asset of manifest.packages
  .flatMap((downloadPackage) => downloadPackage.assets)
  .filter((asset) => typeof asset.eTag === "string" && asset.eTag.length > 0)) {
  const metadata = {
    byteCount: asset.byteCount,
    eTag: asset.eTag,
    lastModified: asset.lastModified,
  };
  const existingMetadata = remoteAssetsByFilename.get(asset.filename);
  assert(
    existingMetadata === undefined || JSON.stringify(existingMetadata) === JSON.stringify(metadata),
    `Conflicting metadata values for ${asset.filename}`
  );
  remoteAssetsByFilename.set(asset.filename, metadata);
}
for (const filename of manifest.packages.flatMap((item) => item.assets).map((asset) => asset.filename)) {
  assert(!filename.includes("Pres--"), `Suspicious doubled dash in ${filename}`);
  assert(!/Pres-\s/.test(filename), `Suspicious space after Pres- in ${filename}`);
}
assertSameStrings(
  remoteAssetsByFilename.keys(),
  Object.keys(r2ContentLengths),
  "R2 Content-Length inventory"
);
assertSameStrings(
  remoteAssetsByFilename.keys(),
  Object.keys(r2ObjectMetadata),
  "R2 object metadata inventory"
);
for (const [filename, metadata] of remoteAssetsByFilename) {
  assert(
    r2ContentLengths[filename] === metadata.byteCount,
    `Manifest byteCount does not match R2 inventory for ${filename}`
  );
  assert(
    JSON.stringify(r2ObjectMetadata[filename]) === JSON.stringify(metadata),
    `Manifest metadata does not match R2 inventory for ${filename}`
  );
}

const modes = manifest.courses.flatMap((course) => course.modes);
for (const mode of modes) {
  if (!mode.isAvailable) {
    continue;
  }
  const downloadPackage = packagesByID.get(mode.packageID);
  assert(downloadPackage, `Missing package for ${mode.id}`);
  const filenames = new Set(downloadPackage.assets.map((asset) => asset.filename));
  const content = mode.kind === "video"
    ? manifest.videoCourses.find((course) => course.id === mode.id)?.chapters
    : manifest.slideshows.find((slideshow) => slideshow.id === mode.id)?.slides;
  assert(content, `Missing content for ${mode.id}`);
  for (const item of content) {
    assert(filenames.has(item.filename), `Package ${mode.packageID} is missing ${item.filename}`);
  }
}

for (const manual of manifest.manuals) {
  const downloadPackage = packagesByID.get(manual.packageID);
  assert(downloadPackage?.assets.some((asset) => asset.filename === manual.filename), `Missing manual asset ${manual.filename}`);
}

const tipsBySlideshowID = new Map(
  tipsManifest.slideshows.map((slideshow) => [slideshow.id, slideshow.tips])
);
assertSameStrings(tipsBySlideshowID.keys(), expectedSlideshows.keys(), "Instructor tip courses");
for (const slideshow of manifest.slideshows) {
  const tips = tipsBySlideshowID.get(slideshow.id);
  assert(tips.length === slideshow.slides.length, `Unexpected tip count for ${slideshow.id}`);
  tips.forEach((tip, index) => {
    assert(tip.slideID === slideshow.slides[index].id, `Tip order mismatch in ${slideshow.id}`);
    assert(tip.title.trim().length > 0, `Empty tip title in ${slideshow.id}`);
    assert(tip.body.trim().length > 0, `Empty tip body in ${slideshow.id}`);
  });
}

const referencedSubtitles = new Set(
  manifest.packages
    .flatMap((downloadPackage) => downloadPackage.assets)
    .filter((asset) => asset.kind === "subtitle")
    .map((asset) => asset.filename.replace(/^subtitles\//i, ""))
);
const reviewedBundledOnlySubtitles = new Set([
  "12_EHAcademy - CPR AED Course Pres-Assessment Example.vtt",
  "17_EHAcademy - CPR AED Course Pres-Chest Compressions Video.vtt",
  "21_EHAcademy - CPR AED Course Pres-CPR Songs.vtt",
  "22_EHAcademy - CPR AED Course Pres-Practice Compressions.vtt",
  "11_EHAcademy - First Aid Course Pres-Seizure Video.vtt",
]);
const bundledOnlySubtitles = new Set(
  manifest.packages
    .flatMap((downloadPackage) => downloadPackage.assets)
    .filter((asset) => asset.kind === "subtitle" && !asset.eTag)
    .map((asset) => path.posix.basename(asset.filename))
);
assertSameStrings(
  bundledOnlySubtitles,
  reviewedBundledOnlySubtitles,
  "Reviewed bundled-only subtitle allowlist"
);
const bundledSubtitles = new Set(
  fs.readdirSync(subtitlesDirectory)
    .filter((filename) => filename.endsWith(".vtt"))
);
assert(referencedSubtitles.size === 80, "Unexpected referenced subtitle count");
assertSameStrings(bundledSubtitles, referencedSubtitles, "Bundled subtitles");
for (const subtitle of bundledSubtitles) {
  const contents = fs.readFileSync(path.join(subtitlesDirectory, subtitle), "utf8");
  assert(contents.trimStart().startsWith("WEBVTT"), `Invalid WebVTT header in ${subtitle}`);
}

const coverPath = path.join(artworkDirectory, "Pediatric CPR AED Cover.webp");
assert(fs.statSync(coverPath).size > 0, "Missing Pediatric CPR & AED cover");

const packageAssetCount = manifest.packages.reduce(
  (total, downloadPackage) => total + downloadPackage.assets.length,
  0
);
assert(packageAssetCount === 324, `Unexpected total package asset count: ${packageAssetCount}`);

async function verifyRemoteAssets() {
  const endpoint = new URL("/api/manifest", remoteBaseURL);
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  assert(response.status === 200, `Manifest request failed: HTTP ${response.status}`);
  const text = await response.text();
  assert(Buffer.byteLength(text) <= 2 * 1024 * 1024, "Remote manifest exceeds 2 MB");
  const payload = JSON.parse(text);
  assert(Array.isArray(payload.files), "Remote manifest files are missing");
  const liveByKey = new Map(payload.files.map((file) => [file.key, file]));

  const failures = [];
  for (const [filename, expected] of remoteAssetsByFilename) {
    const live = liveByKey.get(filename);
    if (!live) {
      failures.push(`${filename}: missing exact key`);
      continue;
    }
    if (live.size !== expected.byteCount) {
      failures.push(`${filename}: size ${live.size} (expected ${expected.byteCount})`);
    }
    const canonicalETag = String(live.etag ?? "").replace(/^W\//i, "").replace(/^"|"$/g, "");
    const expectedETag = String(expected.eTag ?? "").replace(/^W\//i, "").replace(/^"|"$/g, "");
    if (canonicalETag !== expectedETag) {
      failures.push(`${filename}: ETag ${canonicalETag} (expected ${expectedETag})`);
    }
  }
  assert(failures.length === 0, `CDN manifest validation failed:\n${failures.join("\n")}`);
}

console.log("Local content verification passed");
console.log(`Courses: ${manifest.courses.length}`);
console.log(`Slideshows: ${manifest.slideshows.length}`);
console.log(`VA courses: ${manifest.videoCourses.length}`);
console.log(`Bundled subtitles: ${bundledSubtitles.size}`);
console.log(`Package assets: ${packageAssetCount}`);

if (shouldVerifyNetwork) {
  console.log(`CDN base: ${remoteBaseURL}`);
  await verifyRemoteAssets();
  console.log("CDN content verification passed");
} else {
  console.log("CDN verification skipped (pass --network to enable)");
}
