# CPR Trainer Pro iOS Native

Native SwiftUI implementation of CPR Trainer Pro for iPhone and iPad.

This project is intentionally isolated from the existing Tauri desktop and Mac builds. The native scope is English CPR/AED, English First Aid, separate Pediatric Focused CPR/AED and First Aid slideshow variants, manuals, reliable offline downloads, native playback, and Send Certs.

Spanish presentations are intentionally out of scope for this first build.

## Current Checkpoint

- SwiftUI iPhone/iPad app shell with Courses, Downloads, Manuals, and Send Certs tabs.
- Generated native `content-manifest.json` from the Experiment 3.0 desktop `chapters.ts`, excluding Spanish content.
- CPR/AED and First Aid each keep their non-VA pediatric slideshow as an in-course Pediatric Focused toggle.
- Revision-scoped download storage prevents media or queued work from an older catalog from being mistaken for current content.
- Exact production R2 byte counts power a remaining-content estimate that excludes already-downloaded files and deduplicates media shared by multiple courses.
- A one-time-per-launch Download All prompt appears only when content is missing and no bulk download is already underway.
- Settings > All Downloads includes a Download All action and a live remaining-size/time estimate.
- Background `URLSession` download service with exact filename preservation, URL encoding, retry/backoff, atomic temp-file moves, and local storage excluded from iCloud backup.
- Persisted download queue plans so a requested package can resume remaining assets after app restart.
- Persisted, sequential Download All plans keep background work bounded to three concurrent files and avoid racing shared course assets.
- Native video, mixed image/video slideshow, and PDF manual viewers.
- Bundled VTT subtitles with a native WebVTT parser and subtitle overlay for video course chapters and slideshow video slides.
- Real course/manual artwork copied into isolated iOS resources, with safe fallbacks.
- XCTest target with manifest, filename, URL, queue-store, and subtitle parser contract tests.

## Regenerate and Verify Experiment 3.0 Content

Generation requires an explicit path to an Experiment 3.0 checkout, which prevents an accidental import from the wrong branch:

```sh
node ios-native/CPRTrainerPro/Tools/update-r2-content-lengths.mjs

node ios-native/CPRTrainerPro/Tools/generate-content-manifest.mjs \
  --source-root /path/to/experiment-3.0-checkout
```

The size inventory command queries every unique manifest object in production R2
and atomically updates `Tools/r2-content-lengths.json`. Run it whenever production
media is replaced, then regenerate the manifest.

Run the fast local contract audit after every generation:

```sh
node ios-native/CPRTrainerPro/Tools/verify-content-manifest.mjs
```

Add `--network` to verify every referenced video, image, and PDF against the production CDN:

```sh
node ios-native/CPRTrainerPro/Tools/verify-content-manifest.mjs --network
```

Cloudflare R2 object keys are the source of truth for generated media filenames.
The Windows Experiment 3.0 data supplies course structure and ordering only.
Pediatric CPR intentionally reuses shared all-ages CPR objects when R2 does not
contain a duplicate pediatric object.

## Build Check

Last local compile checkpoint:

```sh
xcodebuild -project ios-native/CPRTrainerPro/CPRTrainerPro.xcodeproj \
  -scheme CPRTrainerPro \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /private/tmp/CPRTrainerProDerivedData \
  CODE_SIGNING_ALLOWED=NO \
  EXCLUDED_SOURCE_FILE_NAMES=Assets.xcassets \
  ONLY_ACTIVE_ARCH=YES \
  ARCHS=arm64 \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build-for-testing
```

The app and test targets compile with this source-only sandbox check. Running the tests, compiling the asset catalog, or visually inspecting the simulator still needs normal CoreSimulator access.

## Still To Validate/Build

- Run the app in Simulator or on device and visually inspect all screens.
- Execute XCTest on a working simulator.
- Validate real download behavior against the CDN, including backgrounding, relaunch, network loss, and cancel/retry.
- Add external-display clean output beyond AirPlay/screen mirroring.
- Keep Spanish presentations excluded until the content is finalized.
