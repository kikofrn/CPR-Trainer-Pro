# CPR Trainer Pro macOS Phase 2 Report

**Date:** August 1, 2026; Phase 2.1 audit fixes updated August 2, 2026

**Branch:** `mac-build`

**Scope:** Presenter, display-sleep coordination, USB media import, and mandatory download riders C2-C4

**Status:** Phase 2 was pushed at `2fca895`; its audit required the Phase 2.1 fixes recorded below. Physical hardware gates and auditor spot-verification remain open, so Phase 2 is not signed off.

## Mandatory Download Corrections

- C2: resumed requests send `If-Range` with the manifest ETag. Append is allowed only for a matching 206 and validated Content-Range; a 200 response replaces the stale partial from byte zero.
- C3: cancellation supports the active filename, waits for the Rust registry to unwind, and uses a frontend epoch to prevent cancelled or delayed work from consuming retries or restarting a suppressed queue.
- C4: the manifest cache has a 60-second TTL, sets expiry when a fetch promise is created so concurrent callers share one request, and is refreshed by successful update checks. The unused invalidation method was removed because local USB file state is independent of the remote catalog cache.

## Presenter and Sleep

- Added the independent `presenter-viewer` audience window with session-scoped readiness and minimal event permissions.
- Integrated video, slideshow image/video, seek, subtitles, volume, mute, rate, play/pause, auto-advance, disconnect, and local-media restore behavior onto the current player architecture.
- Retained the double-buffer course player and the null-discarding slideshow callback ref with element-owned `onEnded` handling. Phase 2 accidentally regressed the callback to an unguarded ref; Phase 2.1 restores the required guarded form.
- Monitor discovery runs every three seconds while idle and presenting.
- Downloads, imports, update checks, and prompts are suppressed during Presenter use. The full active download queue is snapshotted and resumes after a clean stop; new requests made during suppression are dropped by design.
- A native IOKit display assertion covers Presenter, fullscreen, and actively playing slideshows. AppKit sleep/wake notifications release and conditionally reacquire it, and destruction of the main window releases it without treating presenter or splash destruction as app closure; failures are nonfatal.
- Rapid starts, disconnects, and delayed download retries have explicit lifecycle guards.

## USB Import

- Uses the standard Tauri folder picker only; no volume scanning is present.
- Accepts the drive root containing `eha-usb-manifest.json` and `media/`, plus a selected `media/` folder when its sibling manifest remains accessible.
- Validates schema, approved catalog path, extension, containment, symlinks, duplicate keys, per-file and total ceilings, source size, ETag presence, and SHA-256 format before import.
- Preflights pending bytes with a 256 MiB reserve.
- Streams 1 MiB chunks into per-file resumable partials, hashes all bytes, verifies size and SHA-256, flushes and syncs, atomically renames, applies backup exclusion best-effort, and atomically updates the snapshot after each file.
- Supports progress, cancel, user-initiated Try Again, resume, already-installed skip, and offline use after import. No automatic USB retry loop is present.
- Network downloads and USB import are mutually suppressed.

## Transplant Checklist

1. `src/utils/presenter.ts`: implemented from the historical reference and adapted to current architecture.
2. `public/presenter-viewer.html`: implemented with session readiness and guarded load tokens.
3. Viewer capability plus the nine restored main-window permissions: implemented; opener scope unchanged.
4. `withGlobalTauri: true`: enabled solely for the viewer HTML contract.
5. `src/utils/fullscreen.ts`: implemented with window-level macOS fullscreen.
6. `slide-url.ts` and `subtitle-lookup.ts`: extracted with per-segment encoding, raw-key lookup, and cue update guard.
7. `App.tsx` integration: implemented, including media silence/restore and presenter guards.
8. Header, video, and slideshow controls: implemented; the required null-discarding slideshow ref behavior is restored in Phase 2.1 after the Phase 2 regression.
9. macOS entitlement selection: base config uses the unsandboxed DMG plist; MAS uses an explicit overlay.
10. New channel plists: empty DMG; MAS sandbox, outbound network, and user-selected read-only.
11. Apple signing/build ignore stanza: added.
12. CI secret names: reference-only for Phase 5; no secret or provisioning profile was added.

## Additional C5 Cleanup

- Removed preauthorization for an unshipped Spanish root-asset family.
- Removed the unused `list_media_files` command.
- Malformed and unsatisfiable Range requests return HTTP 416 with `Content-Range: bytes */{len}` instead of an internal error. The more HTTP-correct 416 response is an accepted substitution for the original plan's 400 wording.
- Batch status checks degrade per file.
- Bulk downloads reuse one `reqwest::Client` and enforce a 2 GiB per-transfer ceiling; USB import enforces 2 GiB per file and 12 GiB total.
- Added Rust coverage for corrupt-snapshot recovery, 405, 416, ETag normalization, USB manifest/source validation, and protocol bounds.

## Phase 2.1 Audit Fixes

- Restored the guarded slideshow callback ref so an outgoing `AnimatePresence mode="popLayout"` video cannot null the incoming video ref.
- Blocked course/slideshow switching while presenting and guarded all three download-completion UI effects.
- Restored manifest single-flight behavior by starting the TTL when the promise is created.
- Reset download partials at or above expected size, delete rejected partials on HTTP 416, and added a regression test for the reset boundary.
- Added main-window destruction release for the display-sleep assertion while ignoring presenter and splash window destruction.
- Replaced the USB error modal's dead action with a working, user-initiated Try Again flow.
- Rust and JavaScript snapshot writers remain safe only because download suppression spans USB import; that invariant is now explicit in `DECISIONS.md`.
- USB snapshot batching, presentation-time request deferral, ManualFlipbook fullscreen unification, broader Phase 3 tests, and LICENSE/gitleaks work remain deferred.

## Entitlements and Packaging Boundary

- `entitlements.dmg.plist` is empty and selected by the base Tauri config.
- `tauri.appstore.conf.json` selects `entitlements.mas.plist` only for MAS builds.
- MAS entitlements are App Sandbox, outbound network, and user-selected read-only.
- No provisioning profile, certificate, archive, package, signature, upload, or submission was created.

## Verification Passed

- Rust unit tests: 11 passed, including the Phase 2.1 completed-partial boundary regression.
- TypeScript: `tsc --noEmit` passed.
- Frontend tests: 5 passed.
- Production frontend bundle: passed; 2,151 modules transformed in 2.74 seconds from the exact Phase 2.1 temporary source snapshot. Existing mixed-import and main-chunk size warnings remain nonfatal.
- Apple Silicon Rust target: `cargo check --target aarch64-apple-darwin` passed.
- Intel Rust target: `cargo check --target x86_64-apple-darwin` passed.
- Rust formatting: `cargo fmt --check` passed.
- Tauri MAS overlay: full debug `--no-bundle` compile passed and produced an unsigned temporary executable. No bundle or archive was made.
- Entitlement plists: `plutil -lint` passed.
- R2 URLs: 244 checked, 0 failures.
- Diff whitespace: `git diff --check` passed.

## Dependency Disposition

The two low and three high npm findings are build/development-only: Babel, PostCSS, and Vite process repository source; sharp is used only by local icon/image scripts; the esbuild finding is in the Windows development path under `tsx`. None is shipped as a Node runtime in the Tauri app, and no untrusted build input is processed. Broad upgrades remain deferred to a compatibility-tested release-candidate gate.

## Verification Environment Encountered

The generated dependency tree under the Documents-backed worktree repeatedly blocked in filesystem reads while traversing roughly one thousand Lucide modules. The same exact uncommitted source, copied without Git metadata or generated dependencies to `/private/tmp` and installed with `npm ci`, passed TypeScript, Vitest, Vite, and Tauri compilation normally. No library-validation weakening or tracked dependency substitution was used.

Phase 2.1 verification used a deterministic Git archive of `2fca895` plus the eight explicit modified files in `/private/tmp`, avoiding traversal of the Documents-backed generated trees. The locked dependencies installed with `npm ci`; TypeScript, Vitest, Vite, Rust tests, formatting, and both Apple architecture checks then passed. The development app launched and initialized the Application Support media library, but Computer Use timed out without returning a screenshot or accessibility tree by either app name or bundle ID. Therefore video-to-video control continuity and local slide-video muting are not claimed as manually observed and remain open hardware-session checks.

## Open Hardware Gates

- Carried Phase 1: complete-course download and playback with networking disabled.
- Carried Phase 1: cold offline launch to interactive in under three seconds.
- Presenter video and slideshow drill, including video-to-video transition, seek, subtitles, volume, disconnect, reconnect within five seconds, sleep, and wake.
- A 45-minute image-only deck and fullscreen playback with `pmset -g assertions` active only when expected and clean after exit.
- Confirm no prompt, update check, download, or import runs while presenting; the pre-existing active queue resumes afterward while newly requested work during suppression remains dropped.
- Confirm sidebar course/slideshow switching is blocked while presenting without changing the audience content.
- USB full import, cancellation, resume, user-initiated retry, low-space failure, offline playback, responsiveness, and safe drive removal.
- MAS sandbox picker test to determine whether selecting `media/` exposes the sibling manifest; if not, final instructions use the drive root.
- `tmutil isexcluded` for the media root, imported/downloaded files, and snapshot.
- End-to-end corrupt-snapshot reset and rebuild.

These gates must pass or receive an explicit carried-gate decision before Phase 2 sign-off.

## Temporary Artifacts

Temporary source, Cargo targets, Rollup verifier packages, and the process sample used to diagnose the Documents-path issue are removed before the Phase 2 commit.
