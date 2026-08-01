# CPR Trainer Pro macOS Phase 2 Report

**Date:** August 1, 2026

**Branch:** `mac-build`

**Scope:** Presenter, display-sleep coordination, USB media import, and mandatory download riders C2-C4

**Status:** Implementation and compile gates pass. Physical hardware gates remain open; Phase 2 is not signed off.

## Mandatory Download Corrections

- C2: resumed requests send `If-Range` with the manifest ETag. Append is allowed only for a matching 206 and validated Content-Range; a 200 response replaces the stale partial from byte zero.
- C3: cancellation supports the active filename, waits for the Rust registry to unwind, and uses a frontend epoch to prevent cancelled or delayed work from consuming retries or restarting a suppressed queue.
- C4: the manifest cache has a 60-second TTL, successful update checks refresh it, and explicit invalidation is available.

## Presenter and Sleep

- Added the independent `presenter-viewer` audience window with session-scoped readiness and minimal event permissions.
- Integrated video, slideshow image/video, seek, subtitles, volume, mute, rate, play/pause, auto-advance, disconnect, and local-media restore behavior onto the current player architecture.
- Retained the double-buffer course player and the null-discarding slideshow callback ref with element-owned `onEnded` handling.
- Monitor discovery runs every three seconds while idle and presenting.
- Downloads, imports, update checks, and prompts are suppressed during Presenter use and resume after a clean stop.
- A native IOKit display assertion covers Presenter, fullscreen, and actively playing slideshows. AppKit sleep/wake notifications release and conditionally reacquire it; failures are nonfatal.
- Rapid starts, disconnects, and delayed download retries have explicit lifecycle guards.

## USB Import

- Uses the standard Tauri folder picker only; no volume scanning is present.
- Accepts the drive root containing `eha-usb-manifest.json` and `media/`, plus a selected `media/` folder when its sibling manifest remains accessible.
- Validates schema, approved catalog path, extension, containment, symlinks, duplicate keys, per-file and total ceilings, source size, ETag presence, and SHA-256 format before import.
- Preflights pending bytes with a 256 MiB reserve.
- Streams 1 MiB chunks into per-file resumable partials, hashes all bytes, verifies size and SHA-256, flushes and syncs, atomically renames, applies backup exclusion best-effort, and atomically updates the snapshot after each file.
- Supports progress, cancel, retry, resume, already-installed skip, and offline use after import.
- Network downloads and USB import are mutually suppressed.

## Transplant Checklist

1. `src/utils/presenter.ts`: implemented from the historical reference and adapted to current architecture.
2. `public/presenter-viewer.html`: implemented with session readiness and guarded load tokens.
3. Viewer capability plus the nine restored main-window permissions: implemented; opener scope unchanged.
4. `withGlobalTauri: true`: enabled solely for the viewer HTML contract.
5. `src/utils/fullscreen.ts`: implemented with window-level macOS fullscreen.
6. `slide-url.ts` and `subtitle-lookup.ts`: extracted with per-segment encoding, raw-key lookup, and cue update guard.
7. `App.tsx` integration: implemented, including media silence/restore and presenter guards.
8. Header, video, and slideshow controls: implemented; current slideshow ref behavior retained.
9. macOS entitlement selection: base config uses the unsandboxed DMG plist; MAS uses an explicit overlay.
10. New channel plists: empty DMG; MAS sandbox, outbound network, and user-selected read-only.
11. Apple signing/build ignore stanza: added.
12. CI secret names: reference-only for Phase 5; no secret or provisioning profile was added.

## Additional C5 Cleanup

- Removed preauthorization for an unshipped Spanish root-asset family.
- Removed the unused `list_media_files` command.
- Invalid Range header bytes return a bounded range error instead of an internal error.
- Batch status checks degrade per file.
- Bulk downloads reuse one `reqwest::Client` and enforce a 2 GiB per-transfer ceiling; USB import enforces 2 GiB per file and 12 GiB total.
- Added Rust coverage for corrupt-snapshot recovery, 405, 416, ETag normalization, USB manifest/source validation, and protocol bounds.

## Entitlements and Packaging Boundary

- `entitlements.dmg.plist` is empty and selected by the base Tauri config.
- `tauri.appstore.conf.json` selects `entitlements.mas.plist` only for MAS builds.
- MAS entitlements are App Sandbox, outbound network, and user-selected read-only.
- No provisioning profile, certificate, archive, package, signature, upload, or submission was created.

## Verification Passed

- Rust unit tests: 10 passed.
- TypeScript: `tsc --noEmit` passed.
- Frontend tests: 5 passed.
- Production frontend bundle: passed; 2,151 modules transformed in 3.00 seconds from the exact temporary source snapshot. Existing mixed-import and main-chunk size warnings remain nonfatal.
- Apple Silicon Rust target: `cargo check --target aarch64-apple-darwin` passed.
- Intel Rust target: `cargo check --target x86_64-apple-darwin` passed.
- Tauri MAS overlay: full debug `--no-bundle` compile passed and produced an unsigned temporary executable. No bundle or archive was made.
- Entitlement plists: `plutil -lint` passed.
- R2 URLs: 244 checked, 0 failures.
- Diff whitespace: `git diff --check` passed.

## Dependency Disposition

The two low and three high npm findings are build/development-only: Babel, PostCSS, and Vite process repository source; sharp is used only by local icon/image scripts; the esbuild finding is in the Windows development path under `tsx`. None is shipped as a Node runtime in the Tauri app, and no untrusted build input is processed. Broad upgrades remain deferred to a compatibility-tested release-candidate gate.

## Verification Environment Encountered

The generated dependency tree under the Documents-backed worktree repeatedly blocked in filesystem reads while traversing roughly one thousand Lucide modules. The same exact uncommitted source, copied without Git metadata or generated dependencies to `/private/tmp` and installed with `npm ci`, passed TypeScript, Vitest, Vite, and Tauri compilation normally. No library-validation weakening or tracked dependency substitution was used.

## Open Hardware Gates

- Carried Phase 1: complete-course download and playback with networking disabled.
- Carried Phase 1: cold offline launch to interactive in under three seconds.
- Presenter video and slideshow drill, including video-to-video transition, seek, subtitles, volume, disconnect, reconnect within five seconds, sleep, and wake.
- A 45-minute image-only deck and fullscreen playback with `pmset -g assertions` active only when expected and clean after exit.
- Confirm no prompt, update check, download, or import runs while presenting and deferred work resumes afterward.
- USB full import, cancellation, resume, retry, low-space failure, offline playback, responsiveness, and safe drive removal.
- MAS sandbox picker test to determine whether selecting `media/` exposes the sibling manifest; if not, final instructions use the drive root.
- `tmutil isexcluded` for the media root, imported/downloaded files, and snapshot.
- End-to-end corrupt-snapshot reset and rebuild.

These gates must pass or receive an explicit carried-gate decision before Phase 2 sign-off.

## Temporary Artifacts

Temporary source, Cargo targets, Rollup verifier packages, and the process sample used to diagnose the Documents-path issue are removed before the Phase 2 commit.
