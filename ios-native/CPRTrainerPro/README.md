# CPR Trainer Pro iOS Native

Native SwiftUI implementation of CPR Trainer Pro for iPhone and iPad.

This project is intentionally isolated from the existing Tauri desktop and Mac builds. The first native scope is English CPR/AED, English First Aid, the Pediatric Focused First Aid variant, manuals, reliable offline downloads, native playback, and Send Certs.

Spanish presentations are intentionally out of scope for this first build.

## Current Checkpoint

- SwiftUI iPhone/iPad app shell with Courses, Downloads, Manuals, and Send Certs tabs.
- Generated native `content-manifest.json` from the desktop `chapters.ts`, excluding Spanish content.
- First Aid keeps Pediatric First Aid as an in-course Pediatric Focused toggle, not a separate top-level course.
- Background `URLSession` download service with exact filename preservation, URL encoding, retry/backoff, atomic temp-file moves, and local storage excluded from iCloud backup.
- Persisted download queue plans so a requested package can resume remaining assets after app restart.
- Native video, mixed image/video slideshow, and PDF manual viewers.
- Bundled VTT subtitles with a native WebVTT parser and subtitle overlay for video course chapters and slideshow video slides.
- Real course/manual artwork copied into isolated iOS resources, with safe fallbacks.
- XCTest target with manifest, filename, URL, queue-store, and subtitle parser contract tests.

## Build Check

Last local compile checkpoint:

```sh
xcodebuild -project ios-native/CPRTrainerPro/CPRTrainerPro.xcodeproj \
  -scheme CPRTrainerPro \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /private/tmp/CPRTrainerProDerivedData \
  CODE_SIGNING_ALLOWED=NO \
  build-for-testing
```

The test bundle compiles in this sandbox. Running the tests or visually inspecting the simulator still needs normal CoreSimulator access, which the sandbox could not reach.

## Still To Validate/Build

- Run the app in Simulator or on device and visually inspect all screens.
- Execute XCTest on a working simulator.
- Validate real download behavior against the CDN, including backgrounding, relaunch, network loss, and cancel/retry.
- Add external-display clean output beyond AirPlay/screen mirroring.
- Add package size/disk-space preflight once reliable remote sizes are available.
- Keep Spanish presentations excluded until the content is finalized.
