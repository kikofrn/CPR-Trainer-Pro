# CPR Trainer Pro macOS Phase 1.1 Report

**Date:** August 1, 2026

**Branch:** `mac-build`

**Scope:** Mandatory media-root lifecycle correction after the Phase 0 and 1 audit

## Correction

- Application Support media-directory creation and canonicalization now run once during Tauri setup.
- The setup result, including an actionable initialization error, is cached in managed application state for every protocol request and command.
- `media://` requests no longer create directories, write backup metadata, or canonicalize the media root for each chunk.
- Backup-exclusion failure is warning-only for the root, completed downloads, and the content snapshot. It cannot convert otherwise valid playback or completed storage operations into failures.

## Record Corrections

- Rust enforces hardcoded plan-approved path families; JavaScript supplies manifest size and ETag metadata.
- Images and PDFs are fully buffered under fixed caps. The recorded 23-27 MB Rust RSS measurement applies only to video seeking.
- Corrupt-snapshot schema rejection is unit tested, but complete reset and rebuild behavior has not been exercised end to end.
- Full-course offline playback and cold offline launch under three seconds are carried gates required before Phase 2 sign-off.

## Deferred Phase 2 Riders

- Add `If-Range` validation to resumed downloads.
- Await or otherwise coordinate cancellation completion before retry, preferably with per-file cancellation.
- Expire or invalidate the memoized media manifest after approximately 60 seconds.

## Dependency Disposition

The two low and three high npm findings affect Babel, esbuild, PostCSS, sharp, and Vite build/development tooling. The packaged Tauri application does not ship Node packages or process untrusted build inputs. Upgrades remain a controlled release-candidate task because build-chain changes require compatibility testing.

## Verification

- Rust Apple Silicon: 8 tests passed.
- Rust Intel: `cargo check --target x86_64-apple-darwin` passed from a clean temporary target.
- Live unsigned app startup: passed; the canonical media-library path was initialized and logged once before the UI began requesting content.
- TypeScript: `tsc --noEmit` passed.
- Frontend production bundle: passed with the pre-existing mixed-import and 500 kB chunk warnings.
- Frontend tests: 5 passed.
- R2 URL verification: 244 checked, 0 failures.
- R2/catalog reconciliation: passed with only the established informational uncovered folders.
- Source audit: no `ensure_media_dir` call remains; protocol and commands use `cached_media_dir` only.

## Verification Environment Note

The inherited generated `node_modules` tree contained verified-empty conflict-copy directories with names ending in ` 2`, including invalid implicit `@types` entries. They caused false TypeScript errors and severe first-read build delays. Only the ignored generated dependency tree was replaced with one serialized `npm ci` from the committed lockfile; no source or lockfile changed. All frontend gates then passed.

## Temporary Artifacts

The clean Cargo target and process-sampling files used to diagnose the local verification environment were removed before commit.
