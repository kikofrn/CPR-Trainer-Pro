# Context

- Stack: React 19, Vite, Tauri 2, TypeScript.
- Web integration branch: `web-app`; `web-production` remains prohibited until Gate 1 passes and Francisco promotes an approved SHA.
- Governing plan: `docs/plans/CPR_Trainer_Pro_Web_App_Plan_v5.1_canonical.md` plus the authorized Gate-1 recovery corrections.
- Cloudflare R2 at `media.ehacademy.com` is the media source of truth; `src/chapters.ts` remains frozen and must reconcile with it.
- Course identity is by string ID, never array position, in new code.
- Public-repository rules: no secrets, machine paths, evidence binaries, or blanket staging.

## Gate-1 recovery controls

- Recovery start SHA: `3d0e99a7ea2cd56642265210ab95d9706d4fdebf`.
- Immutable implementation candidate: `39b4bb1b881119c054feb9c576b16fd663d0f2f8`.
- Round anchors retained for audit: `b550d6c`, `51c8cca`, `f188af9`, and HeaderNav parity anchor `898e28d`.
- Gate-1 recovery: Claude's sole independent audit PASSED at `ad2bdab` (findings D1-D6 recorded, none invalidating). Francisco's P9/R8 desktop smoke PASSED Aug 3 (streamed-playback caveat recorded below). The approved SHA is named in Claude's written gate verdict on this records commit.
- Gate 1 creates the first approved visual reference. Historical unapproved SHAs are not visual baselines.
- Spanish editions remain data-dormant and have no interactive route; accepted static guide prose may mention future Spanish modules.
- Durable evidence is outside the repository under `CPR Trainer Pro Gate 1 Evidence/39b4bb1b881119c054feb9c576b16fd663d0f2f8/`.

## Build and bundle evidence

- A fresh `npm ci` installed 204 packages from the committed lockfile. Lint passed, Vitest passed 34/34 in six files, and the production build passed.
- The built `dist/` contained no forbidden legacy fixture filenames or markers.
- Main entry `main-DcXpGZnV.js`: 619,749 raw bytes and 175,202 gzip bytes. Historical 175,178-byte anchor delta: +24 bytes.
- Secondary/lazy chunks, raw/gzip bytes: `HowToGuideModal-66FNMvKr.js` 30,623/6,642; `ManualFlipbook-CfB9IHYa.js` 11,999/4,433; `SendCertsPage-CblbbANU.js` 11,377/2,920; `core-DhEqZVGG.js` 2,441/978; `event-BK_86lmQ.js` 1,407/682; `index-DTsjy6O1.js` 1,061/502; `index-yW3ljqrP.js` 192/157; `vendor-flipbook-D3FS9ItY.js` 45,137/10,986; `vendor-pdf-B4x9AjGA.js` 431,092/127,842; `window-DlR023_X.js` 14,007/3,483.
- Current full dependency audit reports one accepted high-severity build-time `sharp` advisory; the production-dependency audit reports zero vulnerabilities.

## Browser, Chromium, and codec evidence

- Harness toolchain: Playwright `1.62.1`; Chrome for Testing and headless shell `151.0.7922.34`, Playwright Chromium revision `1234`; FFmpeg revision `1011`.
- CI installs bundled Chromium with `npx playwright install --with-deps chromium`, runs only the four-test default config, keeps output under `${{ runner.temp }}`, and uploads the HTML report with 14-day retention. The 16-row Gate-1 matrix remains an explicit, separate audit command.
- Default E2E was discovered as exactly four tests in two files and passed twice from the candidate: 4/4 in 27.5 seconds, then 4/4 in 12.7 seconds.
- Poisoned-storage media playback passed in both default runs. Matrix playback proved at least 20 seconds of natural CPR and First Aid playback, visible subtitles, a working seek, and progression of middle chapters `Practice Breaths` and `Internal Bleeding`, with zero console errors, page errors, or unhandled rejections.

## Gate-1 content matrix

- Discovery is exactly 16 tests in one file. The complete matrix passed 16/16 in one serial worker with zero retries in 1.9 minutes.
- The matrix produced 16 JSON records and 16 screenshots; every row passed with zero console errors, page errors, or unhandled rejections.
- CPR and First Aid chapter counts are 30 and 45 respectively. Pediatric First Aid proves 45 image chapters and zero video chapters. Coming-soon courses remain disabled with no bypass. The 390px boot/overflow case and the Spanish interactive-only guard both passed.
- `scripts/verify-media-urls.mjs` verified 244 URLs with zero failures. Chapter/R2 reconciliation passed; uncovered objects remain informational: App Thumbnails 8, Pediatric CPR VA Slides 1, Pediatric First Aid VA Slides 1, Subtitles 75, and guide 6.
- Evidence archive: `gate1-matrix-evidence-39b4bb1.zip`, SHA-256 `6f671883de9e6c9d7cb0ad9b02ca2e9b48e75f3de95c9b5e59874e96582991e8`.

## Screenshot reference determinism

- Both candidate invocations captured two internal passes for seven required surfaces. All four corresponding passes were byte-identical, and all strict runtime-error channels were empty.
- The saved first reference is invocation 2, pass B. Surface SHA-256 values: home/course list `fc1a6497421b6347f81270f896f96fd4f86bd36526032a17844be8ded7e2bd6b`; chapter player `675412dcfe59bfdc5528e1b0ac95a8c662326c2027b613305d984534938f9ddc`; slideshow slide `c3e27b8e03128b01b9c2b424226c05463fc6054a881d263c4afc465a3200dc84`; manual page `e784bcb5193823864e4b673880e92eac81cc47ffddaf94bba07ae6ab9067ad3e`; send certificates `affaa6570cf3ebb14fd7d823e8fb79f38a0e10fa99b1a440d8fea12bb1a901df`; how-to `a7cade0f4826a024b7c2de4c153ccb801eed584eac8210f89180b6d2e5568585`; settings/offline panel `c1d437b4bae03fb32bfaf544ca0bd976f2f705f09c35cab56f81f6a4b75d38ea`.
- Reference archive: `gate1-reference-screenshots-39b4bb1.zip`, SHA-256 `5b832a8847d2fa05bc74f04da96295b596a36376543e6faf8153193c9735e940`.
- Each archive contains a validated relative-path checksum manifest; `ARCHIVE-SHA256.txt` records both top-level archive hashes.

## Tauri isolation inventory

- Fourteen dynamic Tauri import sites remain. All are platform-gated: `snapshot-store.ts` returns before its injected core loader on web; `download-manager.ts` returns or cancels before event/core loaders on web; seven `App.tsx` imports sit in `isTauri`-gated effects, branches, actions, subtitle, or updater paths; `utils/browser.ts` uses `window.open` on web; `main.tsx` invokes its injected loader only for a Tauri splash close; and both `ManualFlipbook.tsx` imports are inside Tauri-only fullscreen branches.
- `src-tauri` has zero net changes. The desktop `build.yml` workflow has zero net changes. The only workflow net change is `.github/workflows/web-ci.yml`.

## R9 full verification

- Candidate automated verification is complete: clean install, toolchain capture, lint, 34/34 unit tests, build, fixture scan, bundle measurement, two default E2E runs, isolated 16-row matrix, two screenshot invocations/four-pass comparison, media verification, chapter reconciliation, dependency audits, Tauri isolation review, codec summary, and static candidate gate all passed subject only to the accepted build-time `sharp` advisory.
- Static scope checks passed: clean candidate worktree; exact authorized 14-file net scope versus both `51c8cca` and `f188af9`; zero changed zero-byte files; whitespace-clean versus `b550d6c` and `f188af9`; `fatal.spec.ts` parity with `f188af9`; `HeaderNav.tsx` parity with `898e28d`; no drift in package files, `src/chapters.ts`, `src-tauri`, or desktop workflow; no forbidden Playwright sleeps, `networkidle`, or forced actions; no machine paths in changed public files.
- Evidence archives and their checksum manifests passed an independent read/hash verification. Push and hosted CI are the next operational handoff steps after this archival record.

## Smoke Test Verification (R8)

R8 desktop smoke: PASSED - Aug 3, 2026, performed by Francisco on the Windows dev checkout (`npm run tauri:dev` at the audited tip). Verified: boot to home screen; splashscreen closed automatically; one CPR course chapter played in desktop (Tauri) mode. Recorded caveat, accepted by Francisco: playback was CDN-streamed (no offline media present in the dev profile), so the offline download/local-playback path was not exercised this round - accepted because that path is byte-identical to the pre-round state (auditor-verified) and the shipped Windows product lives on a separate frozen branch. Also confirmed during the smoke: the dev-only Developer Tools / Mock Updater section is `import.meta.env.DEV`-gated (Sidebar.tsx:729) and absent from production builds; the real updater check exits immediately when not in Tauri (App.tsx:174), so the web build ships no updater.

## Current state (session handoff)

- C1 `c2991ae` restored runnable tests and boot parity; C2 `8081611` stabilized the four-test default Playwright suite; C3 `4d0ba41` added the isolated 16-row Gate-1 matrix.
- C4 `b870683` made the seven-surface screenshot proof deterministic; C5 `44bcbd2` wired default E2E and governance into web CI; C6 `7c7c51d` made the external CI report retrievable; C7 `39b4bb1` reconciled canonical-plan CI policy and is the immutable implementation candidate.
- Candidate evidence is complete and archived. The remaining machine steps are this records-only commit, a non-force push of `web-app`, and hosted CI confirmation.
- Claude's independent audit PASSED (`ad2bdab`); Francisco's P9/R8 smoke PASSED (Aug 3, caveat above). This records-only commit closes the recovery round; Claude's verdict names the approved SHA. `web-production` is created at the approved SHA in Phase 2 (plan section 6) - not before.

## Phase 3 implementation — 2026-08-03

### Governance and scope

- Round base: `3a5fd0ae272c75e73da3dd766a0fddc73981ebe6`; the normalized origin owner/repository matched `kikofrn/cpr-trainer-pro` case-insensitively, `origin/web-app` and `origin/web-production` matched the base, and the worktree was clean before implementation. The committed governing document is `docs/plans/CPR_Trainer_Pro_Web_Phase3_Plan_Rev2.1.md`, subsequently amended in-place by authorized Sheets B and C.
- Product tip before the records/CSP commit: `c4bf8a82be6acb2c3cc7c04d6351386f1701a2c6`. The round changes no media/PDF/image binaries, `src/chapters.ts`, `src-tauri`, or `.github/workflows/build.yml`.
- The controller and failure behavior are web-only. The shared exceptions are `playsInline`, safe storage use, the `index.css` font document, the sidebar's `isTauri` initial state, and `index.html` metadata. The project dependency exception is exactly `@fontsource/inter`, `@fontsource/playfair-display`, `@fontsource/jetbrains-mono`, and `@fontsource/jost`, all exactly `5.3.0`.
- `npx --yes wrangler@4.118.0` is a pinned tool download, not a project dependency. Its emulator persistence/evidence remained outside the repository; the exact temporary repo-local `.wrangler/` shell it created was removed after the verified process tree stopped.

### Media lifecycle and Sheet C

- The web chapter controller keeps stable committed/pending/failed identities, `playbackIntent`, `resumeRequired`, generation plus ownership epochs, a 15-second readiness watchdog, a separate 10-second playing-stall timer, 2/4/8-second retry backoff, MediaError-based classification, explicit Replay, and reconnect-to-ready-paused behavior. The committed frame stays visible until a replacement is ready; audio ownership never overlaps.
- Sheet C adds one separate newest-wins metadata-prefetch epoch. Only `pointerenter`, `touchstart`, or keyboard `focus` on a specific row may warm that row. Prefetch does not mutate committed/pending UI state or play. Selecting a different chapter or leaving/switching/closing/unmounting cancels and releases it; selecting the warmed chapter promotes it without source reassignment. Adjacent/next prediction remains forbidden. A single plain media-origin preconnect is issued per course-player open, with no keepalive.
- The web slideshow owns one persistent video element and actionable image/video error states. The Tauri structural divergence is explicit in `src/components/SlideshowPlayer.tsx`: lines 87-131 retain the keyed `AnimatePresence` player and adjacent preload structure behind `isTauri`, with only `playsInline` additions at lines 110 and 124; lines 132-145 select the new web lifecycle component. `src/App.tsx` lines 1698-1719 supplies shared state/control props. No second permanent player was added.
- Three slideshow video objects remain non-fast-start and are media-side scope, not repository defects: CPR/AED Presentation Slides 08 (`Life and Death Drama`), CPR/AED Presentation Slides 17 (`Chest Compressions Video`), and First Aid Presentation Slides 11 (`Seizure Video`). Francisco's separate lossless `+faststart` remux work remains the resolution.

### Latency gate

- The original no-prefetch gate at `54d0630` failed under five fresh contexts per chapter: Infant Scenario median/worst 3.220/3.252 s; Why are we here 9.068/9.080 s; CPR Music 2.868/2.870 s; overall median 3.220 s and worst 9.080 s. This triggered the required pause and Sheet-C adjudication rather than a silent baseline change.
- The Sheet-C remeasurement at `9d9e7adb7ff90252a8e2514c43bcfc5bba5b89c1` used Moto G Power-class 412x915 emulation at DPR 2.625, cold cache, Slow 4G (180,000 B/s download, 84,375 B/s upload, 562.5 ms latency), and 4x CPU throttling. Each fresh-context trial explicitly hovered its row, awaited real `loadedmetadata`, then measured the actual click to the first rendered playing frame with `requestVideoFrameCallback`.

| Chapter | Bytes | Five click-to-frame trials (ms) | Median / worst (ms) | Median intent-to-metadata / prefetch lead (ms) | Median / worst loading feedback (ms) |
|---|---:|---|---:|---:|---:|
| Infant Scenario | 3,005,409 | 379.1, 377.4, 379.2, 388.7, 367.3 | 379.1 / 388.7 | 2,801.0 / 2,866.1 | 17.7 / <200 |
| Why are we here | 44,274,596 | 1,184.1, 1,184.3, 1,195.4, 1,171.6, 1,183.2 | 1,184.1 / 1,195.4 | 6,485.8 / 6,559.9 | 31.1 / 33.0 |
| CPR Music | 32,285,925 | 373.3, 387.3, 355.2, 423.1, 396.9 | 387.3 / 423.1 | 2,432.6 / 2,488.9 | 17.4 / <200 |

- Overall median was 388.7 ms and worst was 1,195.4 ms. Healthy-file worst 423.1 ms passed <=5,000 ms; heavy-file worst 1,195.4 ms passed <=10,000 ms; heavy loading feedback worst 33.0 ms passed <=200 ms. There were zero console, page, or unhandled-rejection errors.
- Cross-origin Resource Timing was unavailable because the media responses did not grant TAO, so CDP Network timing is the governing phase evidence. Representative median request-to-response/header-complete values were Infant 588.573/586.618 ms, Why 599.831/596.659 ms, and CPR Music 590.859/588.266 ms; median send-to-header-start was 22.659/23.259/20.699 ms. Connections reused in 5/5, 4/5, and 5/5 trials respectively. The one cold Why connection recorded DNS 0.722 ms, connect 48.486 ms, SSL 19.348 ms, request-to-response 645.118 ms, intent-to-metadata 6,488 ms, click-to-frame 1,184.3 ms, and feedback 33 ms.
- The eight heavy-`moov` exception names/sizes and the physical-transfer rationale are recorded in W19. Gate 6 re-audits the list and carries forward the same amended targets.

### Shell, fonts, metadata, and download affordance

- Web boot conditionally unmounts the Sidebar; the two onboarding covers therefore produce no boot request. All later explicit opens remain intact. Tauri still starts with the Sidebar open.
- Jost latin normal weights 400/500/600/700/800/900 total 61,344 built bytes. Futura remains first and Jost second in both UI stacks; Calibri is removed. Apple platforms continue to resolve real Futura, while Windows/Android/Linux use Jost. `index.css` is shared, but adopting the new fallback order on the separately frozen Windows track remains a future Francisco decision.
- The idle illustration remains byte-identical with explicit intrinsic 1024x691 dimensions and `fetchPriority="high"`. The trace identified it as the home LCP resource; it did not justify a separate document preload, so none was added. The main entry is 184,970 gzip bytes versus the 175,202-byte Gate-1 baseline (+5.6%, within the +10% budget). The formal Lighthouse/LCP budget still closes at Gate 6.
- The approved shared `index.html` metadata is title `CPR Trainer Pro | Everyday Hero Academy`, description/OG description `Instructor course materials for Everyday Hero Academy CPR, AED, and First Aid training.`, `og:site_name` `Everyday Hero Academy`, absolute temporary Pages URL/image, 1024x691 image metadata with descriptive alt, favicon, noindex/no-canonical, and one plain media-origin preconnect. This changes the Tauri WebView document title, but visible desktop chrome remains controlled by unchanged `src-tauri/tauri.conf.json`.
- Francisco approved the existing Send Certs and How-To business/legal copy as-is on August 3. No copy source file changed, and Gate 3 is no longer copy-blocked. A pre-verdict wording change remains an authorized copy-only delta requiring audit.
- The offline-app affordance is web-only. Windows uses `https://github.com/kikofrn/CPR-Trainer-Pro/releases/latest/download/CPRTrainerPro-Setup.exe`; macOS and iOS remain visible disabled Coming Soon rows. Platform detection changes presentation only and never triggers a download. The header icon is hidden on content surfaces, while the separate web Settings button opens the same dialog; Tauri retains `Offline Training Mode` and never renders the modal.

### Clean verification and visual evidence

- Clean `npm ci` installed 208 packages. TypeScript passed; Vitest passed 63/63 across nine files; production build passed; the default Playwright suite passed 17/17; the isolated serial Gate matrix passed 16/16. Media verification passed 244/244 URLs and chapter/R2 reconciliation passed with only the previously documented informational uncovered folders.
- Full dependency audit: one accepted high-severity direct dev/build dependency (`sharp <0.35.0`, fixed only by semver-major 0.35.3). Production-only audit: zero vulnerabilities.
- Production storage search matches only `src/utils/safe-storage.ts`; the separate test search matches only its justified unit tests. Fourteen dynamic Tauri imports remain platform-gated. Every video has `playsInline`; web adjacent/next speculation remains disabled; no forbidden machine paths, media/binary changes, unexpected scope, or whitespace errors were found.
- Desktop reflow/overflow/title/runtime sweep passed in Chrome, Edge, and Firefox at 1280x720, 1440x900, and 1920x1080. The 1440 run additionally exercised both selectors, Sidebar, Settings, Send Certs, and How-To. The current-branch Tauri dev smoke compiled, revealed a responsive main window with the exact unchanged `EH Academy — CPR Trainer Pro` chrome title, and left `src-tauri`/desktop workflow with zero content diff.
- Before candidate comparison, a detached same-machine recapture of approved reference `39b4bb1b881119c054feb9c576b16fd663d0f2f8` reproduced all seven archived SHA-256 hashes exactly; fresh pass A/B were also byte-identical and all runtime-error channels were empty. This satisfied the hard environment precondition.
- The deliberate eight-surface Phase-3 rebaseline at `c4bf8a82be6acb2c3cc7c04d6351386f1701a2c6` was byte-identical across both candidate passes on every surface, stronger than the permitted Coming Soon <=16-pixel/<=1-channel bound. Pass-B hashes: home `0d605143ed739c4e67bd70d977c535283742ef15453092e14ddc1324084fa19f`; chapter `e14c3bd1b2a2ee50258de3555a264b58a068c3d4c346fbc1b2b689f473ba1a1f`; slideshow `0f758535d62e5fbb78791e779b8b6885ade649ba1c6a0e3227cd890f66083dfd`; manual `84367ffc531bd26da2adba5f1d8dd7c60207bb3362ef5a9c83dbef051a0d0f9c`; Send Certs `04dcb9e09d2de879caeec6c9c805ab29d21b07cef4674597709c64f0445a1cab`; How-To `4f5633d9e43ce21436e181db833dc2d845c2b216a5fab3c0a16bd081c42e31fa`; Coming Soon `3fe9435b1c859f4690aba6ea455c72104c17263b82172390b1bb7ee972117986`; Settings `f4e0cfe520896b7f0de2008afc89ac811521ac85dc7b8de2dc397033d81ec958`. Screenshots, geometry/text rectangles, manifests, and diffs remain external and uncommitted.
- Pinned Wrangler 4.118.0 served the current production build with the exact report-only policy, no Google font hosts, and `form-action 'self'`/`frame-src 'none'`. All eight surfaces passed twice with exact hashes and zero console errors, page errors, unhandled rejections, or CSP violations. The emulator and port were stopped before cleanup.

### Remaining Phase-3 action

- Push 1 was `857d87ab1a4855a45949f052eb8a820646351c77`. GitHub Web App CI run `30862601307` and gitleaks run `30862601280` both completed successfully for that exact SHA. The `web-app` Pages alias served the exact built main asset names and approved metadata, included the intended report-only policy, and had no enforcing CSP header.
- The hosted Chromium matrix passed 16/16 in one serial worker with zero captured console errors, page errors, or unhandled rejections. The representative CPR slideshow, narrated-course, Instructor Manual, Send Certs, and How-To rows also passed 5/5 in Edge and 5/5 in Firefox. This exercised the required hosted media/manual/slideshow paths before enforcement; evidence remained outside the repository.
- Hosted report-only evidence required no directive changes. Push 2 therefore changes only the header name from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`; the directive value is byte-identical.
- The enforcing production build passed. Pinned Wrangler 4.118.0 served the enforcing header with no report-only header. All eight deterministic surfaces passed twice with exact repeatability and zero CSP/runtime violations. A separate actual-resource smoke passed 4/4: narrated chapter playback, the persistent video-slide transition/state path, PDF failure then retry/recovery, and both offline-download entry points. The verified Wrangler process tree was stopped, port 8788 was free, and the exact untracked repository `.wrangler/` shell was removed before staging.
- Push 2, its two green CI checks, and its hosted enforcing-CSP smoke remain before handoff. A third push remains prohibited unless an actual CSP defect appears and Francisco explicitly authorizes the corrective path.
- After Push 2, Claude may begin the sole independent Gate-3 technical audit. The business/legal copy decision is resolved and no longer blocks its verdict.

## Phase 3 closure and Phase 4 preflight — August 4, 2026

- Phase-3 Push 2 completed at approved SHA `b6d905dd57372b9c86e0d96d4412157dc845a86c`; Web App CI and gitleaks were green, and the hosted enforcing-CSP smoke passed. Gate 3 passed and canonical §6.3 promoted the web track to Phase 4.
- The Phase-4 clean checkout began with `HEAD`, `origin/web-app`, and `origin/web-production` all at `b6d905dd57372b9c86e0d96d4412157dc845a86c`; `web-production` is an ancestor of `web-app`, the branch is `web-app`, and the worktree was clean.
- Baseline verification: clean `npm ci` installed 208 packages; TypeScript passed; Vitest passed 63/63 across nine files; production build passed; default Playwright passed 17/17 after one transparent infrastructure retry (the first run was 16/17 because one worker's initial `page.goto('/')` was aborted, and that unchanged case passed 1/1 in isolation before the complete rerun passed).
- Baseline main entry `main-D8iMAjly.js` is 655,898 raw bytes and 184,968 gzip bytes using Node zlib's default level-6 procedure (Vite display: 184.97 kB), below the 192,722-byte Phase-4 cap. `src/index.css` contains no breakpoint override in `@theme`; Tailwind `lg` remains 1024 px.
