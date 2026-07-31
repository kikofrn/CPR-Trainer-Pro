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
- removed legacy release.yml — it raced build.yml's release job on v* tags and signed with the retired TAURI_PRIVATE_KEY; build.yml's release job (TAURI_SIGNING_PRIVATE_KEY) is now the sole release path.
