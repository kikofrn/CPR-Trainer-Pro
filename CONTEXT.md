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
