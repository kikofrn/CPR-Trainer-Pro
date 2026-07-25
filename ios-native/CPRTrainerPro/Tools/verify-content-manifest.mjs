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
  ["cpr-aed", ["cpr-aed-course", "cpr-aed", "pediatric-cpr-aed-course"]],
  ["first-aid", ["first-aid-course", "first-aid", "pediatric-first-aid-course"]],
]);
for (const course of manifest.courses) {
  assertSameStrings(
    course.modes.map((mode) => mode.id),
    expectedCourseModes.get(course.id),
    `Modes for ${course.id}`
  );

  for (const mode of course.modes) {
    if (mode.id.startsWith("pediatric-")) {
      assert(mode.kind === "slideshow", `${mode.id} must be a non-VA slideshow`);
    }
  }
}

const expectedSlideshows = new Map([
  ["cpr-aed-course", { count: 39, videoPositions: [8, 12, 17, 21, 22] }],
  ["first-aid-course", { count: 46, videoPositions: [11] }],
  ["pediatric-first-aid-course", { count: 45, videoPositions: [] }],
  ["pediatric-cpr-aed-course", { count: 36, videoPositions: [11, 16, 20, 21] }],
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
}

const modes = manifest.courses.flatMap((course) => course.modes);
for (const mode of modes) {
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
    .map((asset) => asset.filename.replace(/^subtitles\//, ""))
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

function mediaURL(filename) {
  const encodedPath = filename
    .replace(/^\/+/, "")
    .split("/")
    .map((component) => encodeURIComponent(component))
    .join("/");
  return new URL(encodedPath, remoteBaseURL).href;
}

async function requestExists(url) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      let response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      await response.body?.cancel();

      if ([400, 403, 405, 501].includes(response.status)) {
        response = await fetch(url, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          redirect: "follow",
          signal: AbortSignal.timeout(15_000),
        });
        await response.body?.cancel();
      }

      if (response.status >= 200 && response.status < 400) {
        return null;
      }

      if (attempt === 2) {
        return `HTTP ${response.status}`;
      }
    } catch (error) {
      if (attempt === 2) {
        return error instanceof Error ? error.message : String(error);
      }
    }
  }

  return "unknown error";
}

async function verifyRemoteAssets() {
  const filenames = sorted(new Set(
    manifest.packages
      .flatMap((downloadPackage) => downloadPackage.assets)
      .filter((asset) => asset.kind !== "subtitle")
      .map((asset) => asset.filename)
  ));
  const failures = [];
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (nextIndex < filenames.length) {
      const index = nextIndex;
      nextIndex += 1;
      const filename = filenames[index];
      const error = await requestExists(mediaURL(filename));
      if (error) failures.push(`${filename}: ${error}`);
      completed += 1;
      if (completed % 25 === 0 || completed === filenames.length) {
        console.log(`CDN check: ${completed}/${filenames.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: 8 }, () => worker()));
  assert(failures.length === 0, `CDN validation failed:\n${failures.join("\n")}`);
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
