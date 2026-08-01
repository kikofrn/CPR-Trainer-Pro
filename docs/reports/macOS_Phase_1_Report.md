# CPR Trainer Pro macOS Phase 1 Report

**Date:** August 1, 2026

**Branch:** `mac-build`

**Phase:** Native media core and application hardening

## Implemented

- Stores media and `.content-versions.json` in Tauri Application Support and attempts the native macOS backup-exclusion resource value as best-effort metadata.
- Resolves media through `media://localhost/` with strict path, method, type, symlink, range, and response-size policy.
- Uses JavaScript manifest metadata for expected size and ETag while Rust independently restricts downloads to hardcoded plan-approved path families on the exact Cloudflare R2 host.
- Verifies manifest size and opaque ETag, supports cancellation and partial resume, and atomically publishes verified files.
- Contains a corrupt-snapshot reset path; end-to-end recovery remains a manual gate.
- Packages all UI fonts locally and records their OFL licenses.
- Restricts CSP and Tauri opener permissions to the media host and approved EH Academy destinations.
- Surfaces media-storage failures in an actionable application modal.

## Automated Gates

- TypeScript: `npx tsc --noEmit` passed.
- Frontend production bundle: `npm run build` passed.
- Frontend tests: 5 passed.
- Rust Apple Silicon tests: 8 passed, covering path traversal, encoded traversal, extension policy, catalog policy, symlinks, snapshot schema, opaque ETags, and bounded GET/HEAD/range responses.
- Rust Intel compile: `cargo check --target x86_64-apple-darwin` passed.
- R2 URL verification: 244 checked, 0 failures.
- R2/catalog reconciliation: passed; uncovered non-course folders were informational only.
- Build residue searches found no temporary gate code, hosted font URLs, obsolete media base-path calls, updater/process plugins, or test artifacts in the production bundle.

## Live macOS Gates

- A 168,056,932-byte course video downloaded through the production Rust path and matched its source MD5/ETag.
- A 65,401,384-byte instructor PDF downloaded through the production Rust path and matched its source MD5/ETag.
- Cancellation left a resumable 13,065,280-byte partial file; the next launch resumed it, verified the full video, and removed the partial.
- WebKit returned a bounded 2 MiB HTTP 206 response for an un-ranged video request, loaded video metadata, and completed more than 540 alternating seeks over ten minutes without playback failure.
- During the video seek test, Rust RSS remained approximately 23-27 MB and combined Rust and WebKit RSS remained approximately 33-41 MB with no monotonic growth. This measurement does not characterize PDF loading.
- Images and PDFs are fully buffered under their protocol caps; the 65 MB PDF was fully buffered in production.
- `tmutil isexcluded` confirmed backup exclusion for the media directory, downloaded files, and snapshot.

## Remaining Manual Gates

- Download and play an entire course with networking disabled, including relaunch and representative seeking.
- Measure cold offline launch to interactive state on the final minimum-spec test Mac.
- Repeat media playback in a signed, sandboxed Mac App Store package after entitlements and provisioning are implemented.
- Exercise timeout messaging against a deliberately stalled endpoint; timeout behavior is implemented but the production CDN was not intentionally disrupted.
- Recheck multipart ETag behavior live when a relevant R2 object uses a multipart ETag; current catalog objects do not.
- Exercise corrupt-snapshot removal and reconstruction end to end; the current regression test validates schema rejection only.

## Dependency Note

`npm audit` reports five inherited findings: two low and three high. They affect Babel, esbuild, PostCSS, sharp, and Vite build/development tooling; Node packages are not shipped in the Tauri runtime. No automatic dependency rewrite was applied because upgrades require compatibility testing before the release-candidate gate.

## Temporary Artifacts

All Phase 1 spike code, temporary backups, test media copies, `.download.part` files, and corrupt-snapshot fixtures were removed. The production media files downloaded into Application Support remain as legitimate local test content and are outside the repository.
