import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const args = process.argv.slice(2);
const sourceRootIndex = args.indexOf("--source-root");
const inlineSourceRoot = args.find((arg) => arg.startsWith("--source-root="))?.split("=", 2)[1];
const sourceRootArgument = inlineSourceRoot ?? (
  sourceRootIndex >= 0 ? args[sourceRootIndex + 1] : undefined
);

if (!sourceRootArgument) {
  throw new Error(
    "Missing --source-root. Pass a checkout containing the Experiment 3.0 src and public folders."
  );
}

const sourceRoot = path.resolve(sourceRootArgument);
const chaptersPath = path.join(sourceRoot, "src/chapters.ts");
const instructorTipsPath = path.join(sourceRoot, "src/instructor-tips.ts");
const subtitlesDir = path.join(sourceRoot, "public/subtitles");
const pediatricCoverPath = path.join(sourceRoot, "public/Pediatric CPR AED Cover.webp");
const outPath = path.join(repoRoot, "ios-native/CPRTrainerPro/CPRTrainerPro/Resources/content-manifest.json");
const tipsOutPath = path.join(repoRoot, "ios-native/CPRTrainerPro/CPRTrainerPro/Resources/instructor-tips.json");
const subtitleOutDir = path.join(repoRoot, "ios-native/CPRTrainerPro/CPRTrainerPro/Resources/Subtitles");
const artworkOutDir = path.join(repoRoot, "ios-native/CPRTrainerPro/CPRTrainerPro/Resources/Artwork");
const r2ContentLengthsPath = path.join(toolDir, "r2-content-lengths.json");
const r2ObjectMetadataPath = path.join(toolDir, "r2-object-metadata.json");

const source = fs.readFileSync(chaptersPath, "utf8");
const instructorTipsSource = fs.readFileSync(instructorTipsPath, "utf8");
const r2ContentLengths = JSON.parse(fs.readFileSync(r2ContentLengthsPath, "utf8"));
const r2ObjectMetadata = JSON.parse(fs.readFileSync(r2ObjectMetadataPath, "utf8"));

function extractAssignment(input, marker, openingCharacter, closingCharacter) {
  const markerIndex = input.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Missing ${marker}`);
  }

  const assignmentIndex = input.indexOf("=", markerIndex);
  if (assignmentIndex === -1) {
    throw new Error(`Missing assignment for ${marker}`);
  }

  const start = input.indexOf(openingCharacter, assignmentIndex);
  if (start === -1) {
    throw new Error(`Missing ${openingCharacter} after ${marker}`);
  }

  let depth = 0;
  let quote = null;
  let escaping = false;

  for (let i = start; i < input.length; i += 1) {
    const char = input[i];

    if (quote) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === openingCharacter) depth += 1;
    if (char === closingCharacter) {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, i + 1);
      }
    }
  }

  throw new Error(`Could not find end of ${marker}`);
}

function evaluateArray(exportName) {
  const arraySource = extractAssignment(source, `export let ${exportName}`, "[", "]");
  return vm.runInNewContext(`(${arraySource})`, {}, { timeout: 1000 });
}

function evaluateInstructorTips() {
  const objectSource = extractAssignment(
    instructorTipsSource,
    "export const INSTRUCTOR_TIPS",
    "{",
    "}"
  );
  return vm.runInNewContext(`(${objectSource})`, {}, { timeout: 1000 });
}

function cleanFilename(filename) {
  return String(filename ?? "")
    .trim()
    .replace(/^\/+/, "");
}

// R2 object keys and their ordering are authoritative. These overrides reconcile
// the Windows Experiment 3.0 labels with the exact pediatric objects in R2.
const r2SlideshowOverrides = new Map([
  ["pediatric-cpr-aed-course/slide-12", {
    title: "Assessment and Activation - Check Responsiveness",
    filename: "Pedi CPR Presentation Slides/12_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Check Responsiveness.png",
  }],
  ["pediatric-cpr-aed-course/slide-13", {
    title: "Assessment and Activation - Getting Help",
    filename: "Pedi CPR Presentation Slides/13_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Getting Help.png",
  }],
  ["pediatric-cpr-aed-course/slide-14", {
    title: "Assessment and Activation - Check Breathing",
    filename: "Pedi CPR Presentation Slides/14_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Check Breathing.png",
  }],
  ["pediatric-cpr-aed-course/slide-15", {
    title: "Assessment and Activation - Begin Chest Compressions",
    filename: "Pedi CPR Presentation Slides/15_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Begin Chest Compressions.png",
  }],
  ["pediatric-cpr-aed-course/slide-16", {
    title: "Chest Compression Effect",
    filename: "Pedi CPR Presentation Slides/16_EHAcademy - Pedi CPR AED Course Pres-Chest Compression Effect Video.mp4",
  }],
  ["pediatric-cpr-aed-course/slide-20", {
    title: "CPR Song",
    filename: "Pedi CPR Presentation Slides/20_EHAcademy - Pedi CPR AED Course Pres-CPR Song.mp4",
  }],
  ["pediatric-cpr-aed-course/slide-25", {
    title: "Put it all together",
    filename: "Pedi CPR Presentation Slides/25_EHAcademy - Pedi CPR AED Course Pres-Put it all together.png",
  }],
  ["pediatric-cpr-aed-course/slide-26", {
    title: "Infant Assessment",
    filename: "Pedi CPR Presentation Slides/26_EHAcademy - Pedi CPR AED Course Pres-Infant Assessment.png",
  }],
  ["pediatric-cpr-aed-course/slide-29", {
    title: "Infant AED Use",
    filename: "Pedi CPR Presentation Slides/29_EHAcademy - Pedi CPR AED Course Pres-Infant AED Use.png",
  }],
  ["pediatric-cpr-aed-course/slide-30", {
    title: "Infant Scenario",
    filename: "Pedi CPR Presentation Slides/30_EHAcademy - Pedi CPR AED Course Pres-Infant Scenario.png",
  }],
  ["pediatric-cpr-aed-course/slide-31", {
    title: "Mild Choking",
    filename: "Pedi CPR Presentation Slides/31_EHAcademy - Pedi CPR AED Course Pres-Mild Choking.png",
  }],
  ["pediatric-cpr-aed-course/slide-32", {
    title: "Severe Choking",
    filename: "Pedi CPR Presentation Slides/32_EHAcademy - Pedi CPR AED Course Pres-Severe Choking.png",
  }],
  ["pediatric-cpr-aed-course/slide-33", {
    title: "Choking Relief Child",
    filename: "Pedi CPR Presentation Slides/33_EHAcademy - Pedi CPR AED Course Pres-Choking Relief Child.png",
  }],
  ["pediatric-cpr-aed-course/slide-34", {
    title: "Choking Relief Infant",
    filename: "Pedi CPR Presentation Slides/34_EHAcademy - Pedi CPR AED Course Pres-Choking Relief Infant.png",
  }],
]);

function resolvedSlideshowFilename(slideshowID, slide) {
  return cleanFilename(
    r2SlideshowOverrides.get(`${slideshowID}/${slide.id}`)?.filename ?? slide.filename
  );
}

function resolvedSlideshowTitle(slideshowID, slide) {
  return r2SlideshowOverrides.get(`${slideshowID}/${slide.id}`)?.title ?? slide.title;
}

function kindForFilename(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".mp4")) return "video";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".vtt")) return "subtitle";
  return "image";
}

function mediaAsset(filename, prefix) {
  const clean = cleanFilename(filename);
  const byteCount = r2ContentLengths[clean];
  const metadata = r2ObjectMetadata[clean];
  assert(
    Number.isSafeInteger(byteCount) && byteCount > 0,
    `Missing R2 Content-Length for ${clean}`
  );
  assert(metadata?.byteCount === byteCount, `Missing or stale R2 metadata for ${clean}`);
  assert(typeof metadata.eTag === "string" && metadata.eTag.length > 0, `Missing R2 ETag for ${clean}`);
  assert(
    typeof metadata.lastModified === "string" && !Number.isNaN(Date.parse(metadata.lastModified)),
    `Missing R2 Last-Modified for ${clean}`
  );
  return {
    id: `${prefix}.${clean}`,
    filename: clean,
    kind: kindForFilename(clean),
    byteCount,
    eTag: metadata.eTag,
    lastModified: metadata.lastModified,
  };
}

function subtitleCandidatesFor(filename) {
  const clean = cleanFilename(filename);
  if (!clean.toLowerCase().endsWith(".mp4")) return [];

  const basename = path.posix.basename(clean);
  const withoutMP4 = basename.replace(/\.mp4$/i, "");
  return [
    `${withoutMP4}.vtt`,
    `${basename}.vtt`,
  ];
}

function subtitleAssetsFor(filename, prefix, subtitleNames) {
  return subtitleCandidatesFor(filename)
    .filter((candidate) => subtitleNames.has(candidate))
    .map((candidate) => {
      const remoteFilename = `Subtitles/${candidate}`;
      const metadata = r2ObjectMetadata[remoteFilename];
      if (metadata) {
        return {
          id: `${prefix}.subtitle.${candidate}`,
          filename: remoteFilename,
          kind: "subtitle",
          byteCount: metadata.byteCount,
          eTag: metadata.eTag,
          lastModified: metadata.lastModified,
        };
      }
      return {
        id: `${prefix}.subtitle.${candidate}`,
        filename: `subtitles/${candidate}`,
        kind: "subtitle",
        byteCount: fs.statSync(path.join(subtitlesDir, candidate)).size,
      };
    });
}

const slideshows = evaluateArray("SLIDESHOWS")
  .filter((slideshow) => [
    "cpr-aed-course",
    "first-aid-course",
    "pediatric-first-aid-course",
    "pediatric-cpr-aed-course",
  ].includes(slideshow.id))
  .map((slideshow) => ({
    id: slideshow.id,
    title: slideshow.title,
    slides: slideshow.slides.map((slide) => ({
      id: slide.id,
      title: slideshow.id === "cpr-aed-course" && slide.id === "slide-6"
        ? "What if something goes wrong"
        : slideshow.id === "cpr-aed-course" && slide.id === "slide-35"
          ? "Choking Adult"
          : resolvedSlideshowTitle(slideshow.id, slide),
      filename: resolvedSlideshowFilename(slideshow.id, slide),
      type: slide.type,
      isSectionHeader: Boolean(slide.isSectionHeader),
      parentSectionId: slide.parentSectionId ?? null,
    })),
  }));

const videoCourses = evaluateArray("COURSES")
  .filter((course) => ["cpr-aed", "first-aid"].includes(course.id))
  .map((course) => ({
    id: course.id,
    title: course.title,
    shortTitle: course.shortTitle ?? course.title,
    manualFilename: cleanFilename(course.manualFilename),
    chapters: course.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      filename: cleanFilename(chapter.filename),
      duration: course.id === "first-aid" && chapter.id === "fa-10"
        ? "0:43"
        : chapter.duration ?? null,
      subtitle: chapter.subtitle ?? null,
      description: chapter.description ?? null,
      isSectionHeader: Boolean(chapter.isSectionHeader),
      parentSectionId: chapter.parentSectionId ?? null,
    })),
  }));

const manuals = evaluateArray("MANUALS").map((manual) => ({
  id: manual.id,
  title: manual.title,
  description: manual.description,
  filename: cleanFilename(manual.filename),
  thumbnail: cleanFilename(manual.thumbnail),
  packageID: `package.manual.${manual.id}`,
}));

const expectedSlideshowShape = new Map([
  ["cpr-aed-course", { count: 39, prefixes: ["CPR AED Presentation Slides/"], videos: [8, 12, 17, 21, 22] }],
  ["first-aid-course", { count: 46, prefixes: ["First Aid Presentation Slides/"], videos: [11] }],
  ["pediatric-first-aid-course", { count: 45, prefixes: ["Pedi First Aid Presentation Slides/"], videos: [] }],
  ["pediatric-cpr-aed-course", {
    count: 36,
    prefixes: ["Pedi CPR Presentation Slides/"],
    videos: [11, 16, 20, 21],
  }],
]);
const expectedVideoCourseShape = new Map([
  ["cpr-aed", { count: 30, prefix: "CPR AED VA Slides/" }],
  ["first-aid", { count: 45, prefix: "First Aid VA Slides/" }],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateSequentialItems(items, prefix, ownerID) {
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    assert(!ids.has(item.id), `Duplicate item id ${item.id} in ${ownerID}`);
    ids.add(item.id);
    assert(
      item.id === `${prefix}${index + 1}`,
      `Unexpected item id ${item.id} at position ${index + 1} in ${ownerID}`
    );
    assert(item.filename.length > 0, `Missing filename for ${item.id} in ${ownerID}`);
  }

  for (const item of items) {
    if (item.parentSectionId) {
      assert(ids.has(item.parentSectionId), `Missing parent ${item.parentSectionId} for ${item.id}`);
    }
  }
}

function validateSourceContent() {
  assert(slideshows.length === expectedSlideshowShape.size, "Unexpected native slideshow count");
  for (const slideshow of slideshows) {
    const expected = expectedSlideshowShape.get(slideshow.id);
    assert(expected, `Unexpected native slideshow ${slideshow.id}`);
    assert(slideshow.slides.length === expected.count, `Unexpected slide count for ${slideshow.id}`);
    assert(
      slideshow.slides.every((slide) => (
        expected.prefixes.some((prefix) => slide.filename.startsWith(prefix))
      )),
      `Unexpected media folder in ${slideshow.id}`
    );
    const videoPositions = slideshow.slides
      .map((slide, index) => slide.type === "video" ? index + 1 : null)
      .filter(Boolean);
    assert(
      JSON.stringify(videoPositions) === JSON.stringify(expected.videos),
      `Unexpected video slide positions in ${slideshow.id}`
    );
    validateSequentialItems(slideshow.slides, "slide-", slideshow.id);
  }

  assert(videoCourses.length === expectedVideoCourseShape.size, "Unexpected native video course count");
  for (const course of videoCourses) {
    const expected = expectedVideoCourseShape.get(course.id);
    assert(expected, `Unexpected native video course ${course.id}`);
    assert(course.chapters.length === expected.count, `Unexpected chapter count for ${course.id}`);
    assert(
      course.chapters.every((chapter) => chapter.filename.startsWith(expected.prefix)),
      `Unexpected media folder in ${course.id}`
    );
    validateSequentialItems(
      course.chapters,
      course.id === "cpr-aed" ? "cpr-" : "fa-",
      course.id
    );
  }

  assert(
    manuals.map((manual) => manual.id).join(",") === "instructor,student,pediatric",
    "Unexpected native manual set"
  );
  assert(
    manuals.every((manual) => !manual.filename.includes("/")),
    "Manual PDFs must remain at the CDN root"
  );
}

validateSourceContent();

const subtitleNames = new Set(
  fs.existsSync(subtitlesDir)
    ? fs.readdirSync(subtitlesDir).filter((name) => name.endsWith(".vtt"))
    : []
);

function packageForSlideshow(slideshow, packageID, title) {
  if (!slideshow) {
    throw new Error(`Missing slideshow for ${packageID}`);
  }

  const assets = [];
  for (const slide of slideshow.slides) {
    assets.push(mediaAsset(slide.filename, packageID));
    assets.push(...subtitleAssetsFor(slide.filename, packageID, subtitleNames));
  }
  return {
    id: packageID,
    title,
    assets: dedupeAssets(assets),
  };
}

function packageForVideoCourse(course, packageID, title) {
  const assets = [];
  for (const chapter of course.chapters) {
    assets.push(mediaAsset(chapter.filename, packageID));
    assets.push(...subtitleAssetsFor(chapter.filename, packageID, subtitleNames));
  }
  return {
    id: packageID,
    title,
    assets: dedupeAssets(assets),
  };
}

function packageForManual(manual) {
  return {
    id: manual.packageID,
    title: manual.title,
    assets: [mediaAsset(manual.filename, manual.packageID)],
  };
}

function dedupeAssets(assets) {
  const byFilename = new Map();
  for (const asset of assets) {
    byFilename.set(asset.filename, asset);
  }
  return [...byFilename.values()];
}

const slideshowByID = new Map(slideshows.map((slideshow) => [slideshow.id, slideshow]));
const videoCourseByID = new Map(videoCourses.map((course) => [course.id, course]));

const courses = [
  {
    id: "cpr-aed",
    title: "CPR & AED for All Ages",
    subtitle: "Instructor-paced slideshow by default, with VA video as an optional mode.",
    artworkName: "CPR AED for All Ages Cover.webp",
    modes: [
      {
        id: "cpr-aed-course",
        kind: "slideshow",
        title: "Slideshow",
        packageID: "package.cpr-aed.slideshow",
        isAvailable: true,
      },
      {
        id: "cpr-aed",
        kind: "video",
        title: "VA Video",
        packageID: "package.cpr-aed.video",
        isAvailable: true,
      },
      {
        id: "pediatric-cpr-aed-course",
        kind: "slideshow",
        title: "Pediatric Focused",
        packageID: "package.cpr-aed.pediatric-slideshow",
        isAvailable: true,
      },
      {
        id: "pediatric-cpr-aed",
        kind: "video",
        title: "Pediatric + Virtual Assistant",
        isAvailable: false,
      },
    ],
  },
  {
    id: "first-aid",
    title: "First Aid for All Ages",
    subtitle: "Instructor-paced slideshow by default. Pediatric Focused is a variant inside this course.",
    artworkName: "First Aid for All Ages Cover.webp",
    modes: [
      {
        id: "first-aid-course",
        kind: "slideshow",
        title: "Slideshow",
        packageID: "package.first-aid.slideshow",
        isAvailable: true,
      },
      {
        id: "first-aid",
        kind: "video",
        title: "VA Video",
        packageID: "package.first-aid.video",
        isAvailable: true,
      },
      {
        id: "pediatric-first-aid-course",
        kind: "slideshow",
        title: "Pediatric Focused",
        packageID: "package.first-aid.pediatric-slideshow",
        isAvailable: true,
      },
      {
        id: "pediatric-first-aid",
        kind: "video",
        title: "Pediatric + Virtual Assistant",
        isAvailable: false,
      },
    ],
  },
];

const packages = [
  packageForSlideshow(slideshowByID.get("cpr-aed-course"), "package.cpr-aed.slideshow", "CPR & AED Slideshow"),
  packageForVideoCourse(videoCourseByID.get("cpr-aed"), "package.cpr-aed.video", "CPR & AED VA Video"),
  packageForSlideshow(slideshowByID.get("pediatric-cpr-aed-course"), "package.cpr-aed.pediatric-slideshow", "Pediatric CPR & AED Slideshow"),
  packageForSlideshow(slideshowByID.get("first-aid-course"), "package.first-aid.slideshow", "First Aid Slideshow"),
  packageForVideoCourse(videoCourseByID.get("first-aid"), "package.first-aid.video", "First Aid VA Video"),
  packageForSlideshow(slideshowByID.get("pediatric-first-aid-course"), "package.first-aid.pediatric-slideshow", "Pediatric Focused Slideshow"),
  ...manuals.map(packageForManual),
];

const expectedR2Filenames = new Set(
  packages
    .flatMap((downloadPackage) => downloadPackage.assets)
    .filter((asset) => typeof asset.eTag === "string" && asset.eTag.length > 0)
    .map((asset) => asset.filename)
);
assert(
  Object.keys(r2ContentLengths).length === expectedR2Filenames.size,
  "R2 Content-Length inventory contains stale or missing objects"
);
assert(
  Object.keys(r2ObjectMetadata).length === expectedR2Filenames.size,
  "R2 metadata inventory contains stale or missing objects"
);
for (const filename of Object.keys(r2ContentLengths)) {
  assert(expectedR2Filenames.has(filename), `Stale R2 Content-Length entry: ${filename}`);
}
for (const filename of Object.keys(r2ObjectMetadata)) {
  assert(expectedR2Filenames.has(filename), `Stale R2 metadata entry: ${filename}`);
}

const manifest = {
  schemaVersion: 1,
  contentRevision: "experiment-3.0",
  mediaBaseURL: "https://media.ehacademy.com/",
  sendCertsURL: "https://ehacademy.com/login",
  courses,
  videoCourses,
  slideshows,
  manuals,
  packages,
};

function normalizeTipLine(value) {
  return String(value)
    .replace(/\*+/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.startsWith("- ") ? `• ${line.slice(2).trim()}` : line)
    .join("\n");
}

const sourceInstructorTips = evaluateInstructorTips();
const tipsManifest = {
  schemaVersion: 1,
  slideshows: slideshows.map((slideshow) => {
    const courseTips = sourceInstructorTips[slideshow.id];
    assert(courseTips, `Missing instructor tips for ${slideshow.id}`);

    const tips = slideshow.slides.map((slide, index) => {
      const sourceLines = courseTips[slide.id];
      assert(Array.isArray(sourceLines), `Missing instructor tip for ${slideshow.id}/${slide.id}`);
      const body = sourceLines
        .map(normalizeTipLine)
        .filter(Boolean)
        .join("\n");
      assert(body.length > 0, `Empty instructor tip for ${slideshow.id}/${slide.id}`);

      return {
        slideID: slide.id,
        slideNumber: index + 1,
        title: slide.title,
        body,
      };
    });

    assert(
      Object.keys(courseTips).length === slideshow.slides.length,
      `Unexpected instructor tip count for ${slideshow.id}`
    );
    return { id: slideshow.id, tips };
  }),
};

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
assert(packages.length === expectedPackageCounts.size, "Unexpected package count");
for (const downloadPackage of packages) {
  const expectedCount = expectedPackageCounts.get(downloadPackage.id);
  assert(expectedCount, `Unexpected package ${downloadPackage.id}`);
  assert(
    downloadPackage.assets.length === expectedCount,
    `Unexpected asset count for ${downloadPackage.id}: ${downloadPackage.assets.length}`
  );
}
assert(fs.existsSync(pediatricCoverPath), "Missing Pediatric CPR AED cover artwork");

const subtitleAssets = new Set(
  packages
    .flatMap((item) => item.assets)
    .filter((asset) => asset.kind === "subtitle")
    .map((asset) => asset.filename.replace(/^subtitles\//, ""))
);
assert(subtitleAssets.size === 80, `Unexpected bundled subtitle count: ${subtitleAssets.size}`);
for (const subtitle of subtitleAssets) {
  assert(
    fs.existsSync(path.join(subtitlesDir, subtitle)),
    `Missing referenced subtitle ${subtitle}`
  );
}

function writeFileAtomically(filename, contents) {
  const temporaryPath = `${filename}.generate-${process.pid}`;
  fs.writeFileSync(temporaryPath, contents);
  fs.renameSync(temporaryPath, filename);
}

function replaceDirectoryAtomically(destination, populate) {
  const staging = `${destination}.generate-${process.pid}`;
  const backup = `${destination}.backup-${process.pid}`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.rmSync(backup, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  try {
    populate(staging);
    if (fs.existsSync(destination)) {
      fs.renameSync(destination, backup);
    }
    fs.renameSync(staging, destination);
    fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    if (!fs.existsSync(destination) && fs.existsSync(backup)) {
      fs.renameSync(backup, destination);
    }
    throw error;
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
writeFileAtomically(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileAtomically(tipsOutPath, `${JSON.stringify(tipsManifest, null, 2)}\n`);

replaceDirectoryAtomically(
  subtitleOutDir,
  (stagingDirectory) => {
    for (const subtitle of subtitleAssets) {
      fs.copyFileSync(
        path.join(subtitlesDir, subtitle),
        path.join(stagingDirectory, subtitle)
      );
    }
  }
);

fs.mkdirSync(artworkOutDir, { recursive: true });
const artworkDestination = path.join(artworkOutDir, "Pediatric CPR AED Cover.webp");
const artworkTemporaryPath = `${artworkDestination}.generate-${process.pid}`;
fs.copyFileSync(
  pediatricCoverPath,
  artworkTemporaryPath
);
fs.renameSync(artworkTemporaryPath, artworkDestination);

const assetCount = packages.reduce((total, item) => total + item.assets.length, 0);
console.log(`Wrote ${path.relative(repoRoot, outPath)}`);
console.log(`Wrote ${path.relative(repoRoot, tipsOutPath)}`);
console.log(`Bundled subtitles: ${subtitleAssets.size}`);
console.log(`Courses: ${courses.length}`);
console.log(`Video courses: ${videoCourses.length}`);
console.log(`Slideshows: ${slideshows.length}`);
console.log(`Manuals: ${manuals.length}`);
console.log(`Packages: ${packages.length}`);
console.log(`Package assets: ${assetCount}`);
