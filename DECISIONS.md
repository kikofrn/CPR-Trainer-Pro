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

## 2026-08-01
- Added LICENSE (proprietary, all-rights-reserved), a gitleaks CI workflow, and a gitleaks pre-commit config for public-repo hardening (Claude-authored, Francisco-authorized).

## 2026-08-02 Gate-1 recovery
- Gate-1 matrix execution is isolated in `playwright.gate1.config.ts`: one exact spec, one serial worker, zero retries, a production preview, and a required empty evidence root outside the repository. The orchestrator validates the clean root; Playwright workers may reload the config after reporter folders have been created.
- Every matrix row writes a viewport screenshot and structured JSON record even when its product assertion fails; console errors, page errors, and unhandled rejections are separate failure channels.
- Spanish remains guarded at interactive controls and routes only. Static explanatory prose in the How-To guide may mention future Spanish modules without making an edition reachable.
- Gate 1 creates the first approved visual reference, so the screenshot harness performs two sequential same-candidate passes and requires byte identity; it does not compare against `b550d6c` or another unapproved historical SHA.
- The visual reference contains seven surfaces. Surface 7 is the expanded web Settings/Offline panel—not a fabricated modal—and the Info easter-egg control is never activated. Live video and iframe regions are the only declared masks.
- Web CI installs Playwright Chromium and runs only `playwright.config.ts` (the four-test default suite). Its output stays under the runner's temporary directory and the HTML report is uploaded for 14 days. The slower 16-row Gate-1 matrix is intentionally isolated from routine push/PR CI and remains an explicit audit step.

## 2026-08-03 Phase 3
- W12: The sidebar starts collapsed on web and retains its existing open default in Tauri through an `isTauri`-conditioned initial state. There is no new persistence; any future Windows-default change remains a separately authorized desktop-track decision.
- W13: Web typography is self-hosted with exactly four `@fontsource` packages at `5.3.0`: Inter, Playfair Display, JetBrains Mono, and Jost. The Futura-first/Jost-second stacks preserve real Futura on Apple platforms and replace the Windows Calibri fallback with Jost. Google font hosts are removed from the CSP for conference-Wi-Fi resilience and Gate-2 LCP debt.
- W14: CSP is staged from report-only to enforcement only after a zero-violation full surface sweep. It permits only self-hosted styles/fonts plus the named media CDN and required `data:`/`blob:` cases; Google font hosts are excluded under W13.
- W15: Gate 3 performs a declared full deliberate re-baseline of all eight surfaces because Jost changes font metrics. Geometry and text rectangles remain audit evidence, the seven Gate-1 reference surfaces still require same-machine environment revalidation, and Coming Soon receives its first reference. Candidate repeatability records exact hashes; its new Coming Soon dropdown may use only the capture tool's explicit <=16-pixel, <=1-channel-value raster-equivalence bound for rounded-toggle antialiasing.
- W16: The proprietary LICENSE, gitleaks CI workflow, and gitleaks pre-commit configuration are adopted on `web-app` as public-repository controls.
- W17: Public metadata and identity strings are business copy. Francisco approved the Revision-2 set on August 3, 2026: title `CPR Trainer Pro | Everyday Hero Academy`; description/OG description `Instructor course materials for Everyday Hero Academy CPR, AED, and First Aid training.`; `og:site_name` `Everyday Hero Academy`; the temporary Pages URL/image and descriptive image alt. The `index.html` edit is a shared-document change affecting the Tauri WebView document title, while visible desktop window chrome remains governed by unchanged `src-tauri/tauri.conf.json`. Francisco also approved the existing public Send Certs and How-To business/legal wording as-is; this is revocable by an authorized copy-only delta before the Gate-3 verdict.
- W18: The offline-app download affordance is web-only, configuration-driven, and never auto-downloads. Platform detection affects presentation only; Windows uses the verified GitHub evergreen installer URL, macOS and iOS remain visible disabled Coming Soon rows, and Settings repurposes only its separate label/button. A future iOS Smart App Banner waits for an App Store ID.
- W19: Sheet C amends W6's no-speculation rule only for explicit row intent. On web, `pointerenter`, `touchstart`, or keyboard `focus` may metadata-prefetch that exact row on the inactive player under a separate newest-wins epoch; a different selection, surface exit, course switch, close, or unmount cancels it. Adjacent/next prediction remains forbidden. One media-origin preconnect per course-player open is permitted and is not a media request. The Gate-3 latency target remains median <=2.5 s; worst <=5.0 s for files whose `moov` atom is <=128 KB. The recorded heavy-`moov` exception is worst <=10.0 s plus branded loading feedback <=200 ms for: `Why are we here` 490,679 B; `Assessment and Activation` 277,243 B; `Practice Compressions (VA)` 229,663 B; `Practice Compressions (Pres)` 163,847 B; `Heart Attack (FA VA)` 150,027 B; `Course Overview` 143,247 B; `Child CPR` 143,003 B; and `Using a Tourniquet (FA VA)` 132,655 B. The exception exists because the index bytes alone impose an unavoidable Slow-4G transfer floor; Gate 6 re-audits the list and no file joins it silently. Three slideshow videos remain non-fast-start and are Francisco-owned media-side remux work: CPR/AED slides 08 and 17, and First Aid slide 11; the repository does not replace or remux them in this round.
- The authorized controller semantics are explicit: `playbackIntent` carries continuous-play intent; terminal selection failure is retained as `failedRequest`; Replay is an explicit restart command and is exempt from the same-selection no-op; readiness uses a 15-second watchdog and playback stalls use a separate 10-second timer; failure classification uses `MediaError`/browser signals without HTTP-status claims; reconnect always returns ready-paused with an explicit Resume requirement; and the web slideshow owns one permanent video element.

## 2026-08-04 Phase 4
- W20: Course selection is resolved only by immutable string-ID mappings in `src/course-selection-model.ts`; desktop HeaderNav and mobile navigation consume the same resolver, unavailable pediatric-VA combinations remain data-derived, and no index/fallback duplication is permitted.
- W21: Every selection/content activation is tagged `desktop` or `mobile`. Only desktop-origin actions mutate desktop Sidebar/selector presentation; history restorations are mobile-origin, history-sourced, and paused.
- W22: One web-lifetime `MobileHistoryCoordinator` owns responsive history. Construction, monotonic IDs, session ledger, and boot state survive React StrictMode replay; listener setup/cleanup and asynchronous completions are generation-guarded. Tauri never constructs it.
- W23: Mobile ownership is the synchronous runtime predicate `!isTauri && matchMedia('(max-width: 1023px)').matches`. Mobile CSS is scoped through web-only classes; narrow Tauri preserves its two explicit legacy raw-width behaviors and never receives mobile navigation, history, pointer, or overlay behavior.
- W24: Managed entries carry validated session, entry, parent, depth, kind, view, and four-kind content descriptors. The bounded in-memory ledger reconstructs full chains, replaces same-player descriptors without a push, and prunes abandoned branches.
- W25: Retired/old-session entries are tombstoned and return through their recorded depth to the real root. Mismatched or lost pop events reconcile against actual `history.state`; a close timeout still at its source retains the player instead of tearing down unrelated content.
- W26: Refresh from managed player/sheet/modal normalizes to a new safe base and does not restore content. Breakpoint exits serialize to the managed root before retirement; rapid seam changes reconcile to the latest desired width while preserving active media and desktop Sidebar state.
- W27: MobileShell owns the composite focus trap, body lock, backdrop, inertness, Escape priority, animation exit barrier, and trigger restoration for navigation plus Download/Guide stacking. App-level stage shortcuts and fade activity are suspended through overlay exit.
- W28: Mobile Settings lives in the navigation sheet and exposes Continuous Play, Offline Training, and Guide through App-owned callbacks. Existing onboarding/content logic is reused; no media, retry, progress, download, or selection logic is copied into mobile presentation.
- W29: W19 remains the sole speculative-media exception: only explicit pointer, touch, or keyboard intent on one exact chapter row may call the existing chapter-prefetch path. Mobile adds no adjacent, next-chapter, slideshow-row, manual, or idle media speculation.
- W30: Immersive precedence is native fullscreen or actively playing with hidden controls. An open sheet keeps its rail visible and owns Escape; fullscreen exits first, then the next managed Back/Home closes content. Restored video and slideshow entries never autoplay.
- W31: The web viewport metadata adds only `viewport-fit=cover`; the shell uses dynamic viewport units with a stable fallback and targeted safe-area insets. The boundary remains exactly 1023 mobile / 1024 desktop, including rotation.
- W32: The mobile presentation is a deterministic lazy chunk because the integrated main entry would consume the Phase-4 margin. A minimal synchronous viewport/history bootstrap remains in the main entry; desktop requests no MobileShell chunk, mobile loads it at boot, and no idle/code prefetch was added.
