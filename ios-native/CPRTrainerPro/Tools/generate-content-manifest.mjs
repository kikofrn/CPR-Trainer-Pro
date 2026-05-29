import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, "../../..");
const chaptersPath = path.join(repoRoot, "src/chapters.ts");
const subtitlesDir = path.join(repoRoot, "public/subtitles");
const outPath = path.join(repoRoot, "ios-native/CPRTrainerPro/CPRTrainerPro/Resources/content-manifest.json");
const subtitleOutDir = path.join(repoRoot, "ios-native/CPRTrainerPro/CPRTrainerPro/Resources/Subtitles");

const source = fs.readFileSync(chaptersPath, "utf8");

function extractArray(exportName) {
  const marker = `export let ${exportName}`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Missing ${marker}`);
  }

  const assignmentIndex = source.indexOf("=", markerIndex);
  if (assignmentIndex === -1) {
    throw new Error(`Missing assignment for ${exportName}`);
  }

  const start = source.indexOf("[", assignmentIndex);
  if (start === -1) {
    throw new Error(`Missing array start for ${exportName}`);
  }

  let depth = 0;
  let quote = null;
  let escaping = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];

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

    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  throw new Error(`Could not find end of ${exportName}`);
}

function evaluateArray(exportName) {
  const arraySource = extractArray(exportName);
  return vm.runInNewContext(`(${arraySource})`, {}, { timeout: 1000 });
}

function cleanFilename(filename) {
  return String(filename ?? "")
    .trim()
    .replace(/^\/+/, "");
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
  return {
    id: `${prefix}.${clean}`,
    filename: clean,
    kind: kindForFilename(clean),
  };
}

function subtitleCandidatesFor(filename) {
  const clean = cleanFilename(filename);
  if (!clean.toLowerCase().endsWith(".mp4")) return [];

  const withoutMP4 = clean.replace(/\.mp4$/i, "");
  return [
    `${withoutMP4}.vtt`,
    `${clean}.vtt`,
  ];
}

function subtitleAssetsFor(filename, prefix, subtitleNames) {
  return subtitleCandidatesFor(filename)
    .filter((candidate) => subtitleNames.has(candidate))
    .map((candidate) => ({
      id: `${prefix}.subtitle.${candidate}`,
      filename: `subtitles/${candidate}`,
      kind: "subtitle",
    }));
}

const slideshows = evaluateArray("SLIDESHOWS")
  .filter((slideshow) => [
    "cpr-aed-course",
    "first-aid-course",
    "pediatric-first-aid-course",
  ].includes(slideshow.id))
  .map((slideshow) => ({
    id: slideshow.id,
    title: slideshow.title,
    slides: slideshow.slides.map((slide) => ({
      id: slide.id,
      title: slide.title,
      filename: cleanFilename(slide.filename),
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
      duration: chapter.duration ?? null,
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
      },
      {
        id: "cpr-aed",
        kind: "video",
        title: "VA Video",
        packageID: "package.cpr-aed.video",
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
      },
      {
        id: "first-aid",
        kind: "video",
        title: "VA Video",
        packageID: "package.first-aid.video",
      },
      {
        id: "pediatric-first-aid-course",
        kind: "slideshow",
        title: "Pediatric Focused",
        packageID: "package.first-aid.pediatric-slideshow",
      },
    ],
  },
];

const packages = [
  packageForSlideshow(slideshowByID.get("cpr-aed-course"), "package.cpr-aed.slideshow", "CPR & AED Slideshow"),
  packageForVideoCourse(videoCourseByID.get("cpr-aed"), "package.cpr-aed.video", "CPR & AED VA Video"),
  packageForSlideshow(slideshowByID.get("first-aid-course"), "package.first-aid.slideshow", "First Aid Slideshow"),
  packageForVideoCourse(videoCourseByID.get("first-aid"), "package.first-aid.video", "First Aid VA Video"),
  packageForSlideshow(slideshowByID.get("pediatric-first-aid-course"), "package.first-aid.pediatric-slideshow", "Pediatric Focused Slideshow"),
  ...manuals.map(packageForManual),
];

const manifest = {
  schemaVersion: 1,
  mediaBaseURL: "https://media.ehacademy.com/",
  sendCertsURL: "https://ehacademy.com/login",
  courses,
  videoCourses,
  slideshows,
  manuals,
  packages,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);

fs.rmSync(subtitleOutDir, { recursive: true, force: true });
fs.mkdirSync(subtitleOutDir, { recursive: true });

const subtitleAssets = new Set(
  packages
    .flatMap((item) => item.assets)
    .filter((asset) => asset.kind === "subtitle")
    .map((asset) => asset.filename.replace(/^subtitles\//, ""))
);

for (const subtitle of subtitleAssets) {
  fs.copyFileSync(path.join(subtitlesDir, subtitle), path.join(subtitleOutDir, subtitle));
}

const assetCount = packages.reduce((total, item) => total + item.assets.length, 0);
console.log(`Wrote ${path.relative(repoRoot, outPath)}`);
console.log(`Bundled subtitles: ${subtitleAssets.size}`);
console.log(`Courses: ${courses.length}`);
console.log(`Video courses: ${videoCourses.length}`);
console.log(`Slideshows: ${slideshows.length}`);
console.log(`Manuals: ${manuals.length}`);
console.log(`Packages: ${packages.length}`);
console.log(`Package assets: ${assetCount}`);
