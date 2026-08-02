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
- removed transcribe_batch.py and update_durations.py handling (public-repo hygiene: personal paths)
- build.yml: least-privilege permissions blocks + explicit releaseDraft false so releases/latest/download/latest.json resolves immediately on publish
- RECORD: 2.3.0–2.3.2 installed clients can never auto-update (endpoint renamed update.json→latest.json + key rotated in the same release; nothing materially lost — the old pipeline never published artifacts; auto-update begins working as of 2.3.3→2.3.4)
- ACCEPTED LIMITATION (2.3.3): the content-update prompt has no foreground gating — a late-completing startup check can surface the modal over an active presentation (startup-seconds race). Fix in 2.3.4: defer prompt while a presentation is active.
- ACCEPTED LIMITATION (2.3.3): the version snapshot is written non-atomically and a corrupted snapshot never self-heals (silently degrades to date-fallback). Fix in 2.3.4: temp-file+rename write in Rust plus rebuild-on-parse-failure.

## Phase 1 (Web App Initial)
- W1: web-app from v2.3.3/89f7f11; WEB-ONLY; Windows fixes arrive by audited cherry-pick.
- W2: Web streams everything from media.ehacademy.com via cdnUrl(); no downloads/updater/offline claims.
- W3: Subtitles from the site bundle; public/404.html ensures missing assets 404 (never SPA-fallback HTML 200).
- W4: Cloudflare Pages; web-production advances only by gate-approved idempotent fast-forward under 6.4 protection; domain after Gate 5; fully public.
- W5: Mobile = responsive breakpoints in one codebase; <=1023 px mobile nav, >=1024 px desktop nav (iPad landscape = desktop intentionally); >=1024 px visuals unchanged (<=0.1% same-machine harness diff); 44 px hit-regions under any-pointer: coarse with visuals unchanged; full mobile UI pre-conference.
- W6: Web media = the 4A committed/pending controller: four outcomes (playing/paused/denied/failed), generation tokens, no speculative loading; desktop Tauri untouched; latency amendment path per 3.6-A.
- W7: noindex at launch = app shell only (headers + robots.txt + meta); media-domain indexing is an accepted residual.
- W8: Public, guessable Pages previews accepted.
- W9: Dependency security: evidence-based non-breaking npm audit fix; remaining advisories recorded post-fix (Full audit: 1 high in build-time `sharp`, accepted because fix is semver-major and it has build-only reachability; Runtime audit: 0 vulnerabilities). Process deviation: the pre-fix snapshot was not captured in the original Phase 1 run. Pinned @playwright/test; 5.6 test-dependency policy (no jsdom without adjudicated exception); dev server never bound to shared networks.
- W10: Web thumbnails use bundled fallback covers for the conference (web fileStatuses is always empty so the CDN thumbnail path is never taken); CDN-with-onError-fallback recorded as a post-conference option.
- W11: Cross-platform SAFETY exceptions (3.2): safeStorage, safe fatal rendering + root Error Boundary, external-link opener isolation, pure course-selection extraction - shared on both platforms; normal Tauri behavior verified structurally unchanged. All other web behavior strictly !isTauri/responsive-gated.

- Decided to implement the ErrorBoundary production fallback test (Step 6b) using Playwright via a new test fixture (throwing-boundary.html/tsx) instead of Vitest with jsdom, strictly adhering to the 5.6 test-dependency policy (no jsdom without exception).

## 2026-08-02 Gate-1 recovery
- Gate-1 matrix execution is isolated in `playwright.gate1.config.ts`: one exact spec, one serial worker, zero retries, a production preview, and a required empty evidence root outside the repository. The orchestrator validates the clean root; Playwright workers may reload the config after reporter folders have been created.
- Every matrix row writes a viewport screenshot and structured JSON record even when its product assertion fails; console errors, page errors, and unhandled rejections are separate failure channels.
- Spanish remains guarded at interactive controls and routes only. Static explanatory prose in the How-To guide may mention future Spanish modules without making an edition reachable.

