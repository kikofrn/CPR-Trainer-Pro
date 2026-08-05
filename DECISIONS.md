# Decisions

## 2026-07-26
- Bucket is source of truth enforced at build time, not runtime.
- Update detection is etag based via a Cloudflare Worker manifest endpoint at `/api/manifest`.
- Update triggered downloads use version pinned URLs to defeat CDN cache staleness.
- Course structure remains hardcoded in `chapters.ts` and is never replaced at runtime.
- Thumbnails refresh silently without a user prompt.
- The pediatric slideshow courses are live and only the two pediatric Virtual Assistant courses are coming soon.
- This release is Windows only with macOS and iOS ported afterward.
- Plan documents live in `docs/plans/` and sessions stop rather than search outside the repository.
- No anticipatory code, state, or scaffolding; no probes or verification beyond phase scope.
- The Worker manifest endpoint is live at `https://media.ehacademy.com/api/manifest` on the preferred Workers route.
- `desktop.ini` was removed from both pediatric presentation folders.
- Reconciliation and verification skip content flagged `isComingSoon`.
- Every phase ends with a commit named for the phase before the verification report.
- Temporary files must be listed in reports and deleted before phase end.
- Direction 2 scans only folders referenced by active courses and reports uncovered folders informationally.
- The update check flow is implemented as a pure module in `src/update-checker.ts`, cleanly separating the diffing logic from side effects.
- `src/snapshot-store.ts` handles JSON read/write queues for `.content-versions.json` natively, preventing race conditions between the update checker and download manager.
- Exponential decay for `avgSpeedBps` uses a 0.8/0.2 split favoring the historical average to avoid drastic UI fluctuation.
- Files are always staged explicitly by name and `git add -A` is prohibited.
- The update checker accepts the thumbnails registry as a function argument rather than importing a registry that does not exist until Phase 5.
- The local branch backup-pre-cleanup contains pre-scrub history and must be deleted before the first push; pushes are always by explicit branch name and git push --all is prohibited.
- Partially completed updates self-heal by tracking pending updates in App.tsx and writing individual manifest entries to the snapshot store as each file completes.
- Per-file snapshot writes are driven by download completion events, never by the existence status map.
- In HeaderNav.tsx, for both toggles enabled, routing dynamically resolves the pediatric VA course index by searching the COURSES array for the correct ID rather than relying on a hardcoded index.
- Grouped First Aid toggles inside a flex container to match the exact vertical spacing layout of the CPR menu toggles.
- The two new bundled fallback webp files for the pediatric VA states were compressed directly from the provided bucket png versions into `public/` during Phase 5.
- First downloads of registry thumbnails are owned by the startup orchestrator, not the update checker, as never-downloaded thumbnails are correctly excluded by the update checker's never-downloaded rule.
- release inputs (tagName, releaseName, releaseBody) are passed to tauri-action only on refs/tags pushes, so branch and manual dispatch runs are compile-only checks and must not attempt release uploads.

## 2026-07-30
- The macOS Intel compile check runs on macos-15-intel because GitHub retired the macos-13 image in December 2025; the compile-check matrix is Windows, macOS-ARM, macOS-Intel, Linux, and only Windows artifacts ship this release.
- DECISIONS.md contained a corrupted UTF-16LE chunk mid-file (bytes 2153-2769, 308 NUL bytes) that rendered as spaced-out characters and broke UTF-8 string-matching tools. Repaired: the region was decoded as UTF-16LE, its two decision lines recovered verbatim ("Partially completed updates self-heal..." and "Per-file snapshot writes are driven..."), and the whole file rewritten as clean UTF-8 with LF line endings. No content was lost.
- The Windows release version is 2.3.3 because v2.3.1 and v2.3.2 are already released tags and the installer must upgrade, never downgrade.

## 2026-07-31
- the slideshow video ref uses a null-discarding callback ref because AnimatePresence popLayout overlaps outgoing and incoming slides during video-to-video transitions, and the outgoing unmount must not clobber the shared ref; slide-video ended handling moved to the element's onEnded prop for the same reason.
- updater signing key rotated (the original private key was lost; no shipped build ever received a signed update, so rotation costs nothing); releases are produced by a dedicated Windows-only release job on v* tag pushes while the matrix job is a compile check on all triggers; the updater endpoint is releases/latest/download/latest.json with createUpdaterArtifacts enabled.

## 2026-08-01
- `mac-build` starts from exact commit `3ced294` in a sibling worktree; the Windows, historical Mac, and iOS branches remain untouched.
- macOS version 3.0.0 targets a universal Intel/Apple Silicon binary with macOS 12 as the minimum supported release.
- Mac binary updates are channel-specific: the DMG links to a health-checked EH Academy download page, while the Mac App Store build relies only on App Store updates.
- Desktop content checks run at startup only; no hourly check is added to the Mac release.
- Mac App Store privacy must be revalidated against Cloudflare logging before reaffirming the shared Data Not Collected declaration.
- Conference media import is picker-only and copies one shared USB media library into Application Support.
- Downloaded media lives under the Tauri Application Support app-data directory, never in the app bundle or a user-selected arbitrary path. The canonical media root is resolved and cached once during setup. Backup-exclusion metadata is attempted for the directory, completed files, and version snapshot, but failure is logged and never blocks playback or a completed download.
- `media://localhost/` is the only local media URL. The protocol accepts only GET and HEAD, rejects traversal, encoded traversal, symlinks, and unapproved extensions, caps response sizes, and serves bounded byte ranges for video.
- A live WebKit gate established the video contract: an un-ranged MP4 request receives the first 2 MiB as HTTP 206, while the media element performs ordinary byte-range seeking. This avoids loading full videos into Rust or WebKit memory.
- JavaScript supplies manifest size and ETag metadata, while Rust independently restricts downloads to hardcoded plan-approved folder prefixes and root files on `media.ehacademy.com`; Rust does not ingest the JavaScript course catalog itself. Downloads use connect and chunk-stall timeouts, support cancellation and partial resume, and publish only after flush, sync, verification, and atomic rename.
- Content-version snapshots are schema validated and written by atomic replacement. The corrupt-snapshot reset path exists but remains an end-to-end manual gate.
- External navigation uses the scoped Tauri opener permission for the EH Academy portal, onboarding documents, and support email only. Web fallback remains centralized in the same validated helper.
- Runtime web-font requests are prohibited. Inter, Playfair Display, and JetBrains Mono are packaged locally with their OFL licenses, and CSP allows media only from the custom protocol and `https://media.ehacademy.com`.
- The current live catalog contains no multipart ETag values. Opaque multipart preservation is covered by unit test; a live multipart case remains unavailable until the bucket contains one.
- The startup splash target changed from 3200 ms plus a 300 ms close delay to 1000 ms plus a 100 ms close delay so the offline path does not intentionally hold an already-ready app. The final cold offline launch measurement remains a physical gate.
- Full-course offline download/playback and cold offline launch under three seconds are explicitly carried to Phase 2 sign-off on the reference Mac; Phase 2 cannot be signed off without measured results or a new explicit authorization to carry them farther.
- Phase 2 must add `If-Range` to resumed downloads, coordinate cancellation completion before retry (preferably per file), and expire or invalidate the memoized manifest after approximately 60 seconds.
- The five npm audit findings (two low, three high) are in Babel, esbuild, PostCSS, sharp, and Vite build/development tooling. Node packages are not shipped in the Tauri runtime, and the app does not process untrusted build inputs; compatibility-tested upgrades are deferred to the release-candidate dependency gate.
- Resumed HTTP downloads send `If-Range` with the manifest ETag. A matching 206 may append only when Content-Range begins at the local partial length and ends at the manifest size; a 200 response truncates the stale partial and starts from byte zero.
- Download cancellation is per-file when a current filename is known, awaits backend registry unwind for up to three seconds, and advances a frontend epoch so cancellation and delayed retries do not consume retry attempts or re-enter a resumed queue.
- The in-session manifest cache expires after 60 seconds. Its expiry is set when a fetch promise is created so concurrent callers share one in-flight request, and a successful startup manifest fetch refreshes it directly. The unused explicit invalidation API was removed because USB imports change local file status, not the remote catalog.
- Presenter uses an independent, minimally capable `presenter-viewer` window and preserves the current double-buffer player plus callback-ref slideshow transition behavior. Monitor discovery runs every three seconds both idle and active.
- Display sleep is prevented during external presentation, fullscreen playback, and an actively playing slideshow. Assertion failures are warning-only; assertions are released on stop, sleep, window close, and process exit, then reacquired after wake only when still required.
- USB import is picker-only and streams into Application Support through resumable partial files. Size and SHA-256 are verified before atomic rename, and the version snapshot is atomically updated after each installed file. Imports and network downloads are mutually suppressed.
- The importer accepts either the conference-drive root containing `eha-usb-manifest.json` plus `media/`, or a selected `media/` directory when the sibling manifest is accessible. Because MAS security scope may not grant sibling access, the physical sandbox gate will determine the final README instruction; selecting the drive root is the safe fallback and does not duplicate media.
- Distribution entitlements are channel-specific. The base/DMG config uses an empty unsandboxed plist; `tauri.appstore.conf.json` alone selects App Sandbox, outbound network, and user-selected read-only access. No provisioning profile is stored in Git.
- The Presenter/USB implementation does not close the carried Phase 1 gates. Full-course offline playback and cold offline launch under three seconds run first at the reference-Mac hardware session and gate Phase 2 sign-off.

## 2026-08-02
- Phase 2 accidentally replaced the Decision-32 null-discarding slideshow video callback ref with an unguarded callback. Phase 2.1 restores the guarded ref so an outgoing `AnimatePresence mode="popLayout"` slide cannot null the incoming element after a video-to-video transition.
- Course and slideshow switching is blocked while Presenter is active with a non-modal notice. The chapter, manual, and slide download-completion effects also refuse presentation-time UI mutations so the instructor and audience displays cannot diverge.
- A download partial at or above the manifest size is reset before requesting media. HTTP 416 also removes the partial before returning an error so the next retry can recover.
- Malformed or unsatisfiable local `media://` Range requests return HTTP 416 with `Content-Range: bytes */{len}`. This intentionally substitutes the more HTTP-correct 416 response for the plan's original 400 wording.
- Presenter suppression snapshots and resumes the full active download queue, including its current file and queued work. New download requests made while suppression is active are dropped by design rather than deferred.
- The display-sleep assertion is explicitly released when the main window is destroyed. Destruction of the splash or presenter viewer window does not release it.
- USB import retry is user-initiated through Try Again; there is no automatic retry loop.
- Rust USB snapshot updates and JavaScript `snapshot-store` updates are separate unsynchronized read-modify-write paths. They remain safe only while downloads stay suppressed for the entire USB import; future changes must preserve that mutual-exclusion invariant or add shared serialization.
- The Phase 2 Sidebar `AnimatePresence mode="wait"` change and the UI-visibility reset when window fullscreen exits are benign supporting UI changes outside the headline feature set.
- Deferred follow-up remains explicit: batch USB snapshot I/O before any roughly 10,000-file catalog, add a deferred queue if presentation-time download requests must be retained, unify ManualFlipbook element fullscreen with window fullscreen, expand If-Range/USB-copy/sleep-assertion tests in Phase 3, and handle LICENSE/gitleaks only under separate authorization.

## 2026-08-03
- Hardware Drill 3-A found that the local subtitle toggle did not reach the external Presenter viewer: the subtitle effect emitted every active cue without consulting `showSubtitles`. Phase 2.2 sends an empty subtitle string whenever captions are disabled and re-emits the active cue when they are enabled; the viewer already clears its text and visibility state for an empty string.
- The HeaderNav and Sidebar logo "Return to Main Menu" actions use one full home-reset guard and the existing non-modal error banner while Presenter is active; player close paths already stop Presenter before resetting and remain unchanged.
- Phase 2.2 applied that full exit guard too broadly to ManualFlipbook close and error recovery. Phase 2.2b restores their narrow, deliberately unguarded behavior: clear only the selected manual and return the instructor tab to video, preserving active course/slideshow selection. Manuals never load into the external viewer, so these actions cannot desynchronize audience content and must remain usable during Presenter and error recovery.
- The general-purpose USB folder-picker icon is removed from the header. The unsandboxed conference build polls mounted disks every four seconds for a root `eha-usb-manifest.json`, silently validates candidates through the existing importer rules, and offers Import or Dismiss only for a valid library.
- A detected USB mount is handled once per insertion. Dismissal or import silences it for the rest of that mount session, while observing the mount disappear clears the in-memory mark so the same drive can prompt after reinsertion. Detection starts suppressed until the frontend event listener is ready, then remains suppressed during Presenter, an active import, and while a detection banner awaits a decision.
- Removing the picker intentionally leaves no in-app fallback if disk enumeration, permissions, an unexpected mount layout, or validation prevents auto-detection. No hidden picker was retained; restoring a diagnostic/manual path requires a separate product decision. The existing dialog dependencies and backend inspection command are left intact because dependency/capability cleanup is outside this fix round.

## 2026-08-05
- Per `docs/plans/CPR_Trainer_Pro_macOS_Phase3_Prompt.md`, `mac-build` now carries the repository LICENSE plus gitleaks CI and pre-commit configuration byte-identical to commit `78ff12a`. The workflow scans full Git history on every push to every branch; the local hook remains subject to the checked-in pre-commit configuration and must never be bypassed.
- The Tauri dialog plugin registration, Rust dependency, and `dialog:allow-open` capability are removed together as dead release weight after Phase 2.2 replaced the manual USB folder picker with mounted-drive auto-detection.
- Root scratch files `lite_app.tsx`, `square-icon.js`, `generate_tips_json.py`, and `metadata.json` are deleted from `mac-build`. The only full-tree text hits were this Phase 3 plan's own cleanup inventory; no source, Rust, HTML, Vite, or package reference existed, and the 20-file production asset listing remained identical after deletion.
