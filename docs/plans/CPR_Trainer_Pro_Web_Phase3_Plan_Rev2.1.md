# CPR Trainer Pro - Web Phase 3 Implementation Plan, Revision 2.1-B

Status: Francisco-authorized implementation plan

Date: 2026-08-03

Implementer: Codex

Independent Gate-3 auditor: Claude

This document combines Codex Revision 2 with Claude's Revision 2.1 Amendment Sheet A and Francisco-authorized Amendment Sheet B. It is the complete governing plan for this implementation round. Precedence on overlap is Sheet B, then Sheet A, then Revision 2. The canonical product plan remains `docs/plans/CPR_Trainer_Pro_Web_App_Plan_v5.1_canonical.md`; this document is the executable round plan and records adjudicated clarifications that must also be mirrored into the canonical records.

## 0. Non-negotiable preflight and round sequencing

- [ ] Work only from a clean `web-app` checkout.
- [ ] Normalize `origin` to its GitHub `owner/repo` pair and compare `kikofrn/cpr-trainer-pro` case-insensitively. Accept SSH or HTTPS forms and an optional `.git` suffix; reject any other owner or repository.
- [ ] Require all three SHAs to equal `3a5fd0ae272c75e73da3dd766a0fddc73981ebe6` before product work: `HEAD`, `origin/web-app`, and `origin/web-production`.
- [ ] Require empty `git status --porcelain`.
- [ ] Require the Gate-1 reference archive candidate to be `39b4bb1b881119c054feb9c576b16fd663d0f2f8`, with the externally archived reference material available for same-machine revalidation.
- [ ] Commit this complete plan as the first commit of the round. Do not include machine-specific paths in the committed plan.
- [ ] Then cherry-pick main commit `78ff12a` for `LICENSE`, gitleaks CI, and the pre-commit configuration. Resolve the `DECISIONS.md` add/add conflict by preserving all web-branch history and adding the relevant incoming decision. Do not claim the pre-commit hook is active merely because its configuration is present.
- [ ] Stop rather than improvise if any preflight invariant fails or a needed change falls outside this plan.

## 1. Scope and change controls

Authorized product files and surfaces:

- `src/App.tsx`
- `src/components/VideoPlayer.tsx`
- `src/components/SlideshowPlayer.tsx`
- `src/components/HeaderNav.tsx`
- `src/components/Sidebar.tsx`
- `src/components/ManualFlipbook.tsx`
- Conditional copy-only edits in `src/components/SendCertsPage.tsx` and `src/components/HowToGuideModal.tsx`, after Francisco approves exact business/legal wording
- Focused new pure modules under `src/`, `src/utils/`, and focused test helpers/specs, including `src/config/downloads.ts`, `src/utils/platform-detect.ts`, and `src/components/DownloadAppModal.tsx`
- `src/index.css`, `index.html`, `public/_headers`, and only the specifically justified package/lockfile changes
- Playwright/Vitest configuration and focused tests
- `scripts/capture-reference-screenshots.mjs` and focused audit-tooling helpers
- `.github/workflows/web-ci.yml`
- The canonical plan and repository records: this plan, `CONTEXT.md`, and `DECISIONS.md`

Forbidden unless a new written authorization is obtained:

- `src-tauri/**`
- `src/chapters.ts`
- desktop release workflow changes
- media assets, screenshot evidence, generated diffs, archives, or machine paths
- `.gitignore` churn or deletion/weakening of existing tests
- new runtime dependencies
- dependencies other than the four exact `@fontsource` packages approved below
- a second permanent slideshow video element
- wiring the local visual comparator into routine web CI
- any push beyond the two authorized pushes, except a third CSP-corrective push explicitly authorized by Francisco

Every logical step uses an exact commit subject of the form `web(phase-3): <step>`. Stage named paths only; never use `git add -A`.

## 2. Approved upstream governance addition

- [ ] Cherry-pick `78ff12a` after the plan commit.
- [ ] Preserve the web branch's complete `DECISIONS.md` content while integrating the upstream public-repository decision.
- [ ] Verify the license and both leak-scanning files are exactly the intended upstream versions.
- [ ] Confirm gitleaks CI is syntactically valid. Record that `pre-commit install` is still a developer-local action and is not implied by committing `.pre-commit-config.yaml`.

## 3. Harness and CI hardening - separate from product code

Harness-engine changes are a separate logical commit or commits and may not be mixed with product code.

### 3.1 Default Playwright contract

- [ ] Remove global animation suppression (`MotionGlobalConfig`) from product-facing tests. Tests must observe shipped motion rather than changing it globally.
- [ ] Preserve the existing four default E2E tests and add the focused Phase-3 specifications to the default configuration.
- [ ] Make fixture discovery/reporting deterministic and non-fatal when unrelated fixture files are absent.
- [ ] Retain CI retries only where configured; capture `trace: on-first-retry` and upload trace-bearing Playwright artifacts on failure.
- [ ] Add explicit least-privilege workflow permissions and a job timeout.
- [ ] Keep the isolated Gate-1 matrix separate from routine CI.
- [ ] Point hosted checks at the intended preview/build configuration without weakening local production-preview coverage.

### 3.2 Gate matrix corrections

- [ ] Add the eighth required visual surface: a normalized coming-soon state.
- [ ] Capture Settings with the sidebar closed and the actual panel expanded.
- [ ] Check Spanish dormancy with the sidebar closed for the home, CPR, and First Aid routes, while allowing the already-adjudicated static `isComingSoon` guide prose.
- [ ] Continue collecting console errors, page errors, and unhandled rejections as independent failure channels.

### 3.3 Deterministic screenshot comparator

- [ ] Enhance the local capture tooling with the already-installed `sharp`; add no dependency.
- [ ] Validate image dimensions and compute exact hashes, changed-pixel counts, ratios, diff bounding boxes, and useful geometry diagnostics.
- [ ] The comparator must understand the eight named surfaces and explicit masks only; it must never silently mask a difference.
- [ ] Sheet B supersedes the prior text-bounds-only font rule for this round: the Futura-to-Jost metric change on non-Apple systems requires a declared full deliberate re-baseline of all eight surfaces. Geometry and text-rectangle capture remain required to prove container-level layout is sane and that the reflow sweep found every clipping or overflow defect.
- [ ] Store screenshots, masks, generated diffs, and reports outside the repository. Never serialize machine-specific paths into committed output.
- [ ] Keep the comparator as audit tooling only; never wire it into `web-ci.yml`.

Hard precondition: before computing or reporting any candidate comparison, recapture candidate `39b4bb1b881119c054feb9c576b16fd663d0f2f8` on the same machine and prove the archived reference hashes reproduce. If revalidation fails, stop visual work and report the invalid environment. Do not calculate a candidate verdict against an unvalidated reference.

## 4. Pure web media lifecycle controller

Create a pure, node-testable controller with dependency-injected media operations, timers, and callbacks. It must not read or write browser storage.

### 4.1 State and identity

Use stable course/chapter IDs, never array positions, as transactional identities. Model at least:

- `committedSelection`: the chapter currently presented
- `pendingSelection`: the requested destination, if any
- `failedRequest`: the destination and failure information for a request that did not commit
- `playbackIntent`: whether continuous playback is intended across a transition
- playback outcome/state that distinguishes loading, playing, ready-paused, autoplay-denied, stalled/retrying, and terminal failure
- `resumeRequired`: set after reconnect because recovery must never autoplay unexpectedly
- a monotonically increasing request generation and per-element ownership epoch

The UI may show a pending row and its failure without changing the committed route or active chapter until a destination is actually ready.

### 4.2 Transaction and playback rules

- Attach all listeners before assigning `src`; then assign the URL and call `load()` as appropriate.
- A request commits only when the requested media reaches the readiness contract and the current generation/ownership still owns the event.
- Continuous play is governed by `playbackIntent`, not by stale element state.
- Selecting the already committed chapter is a no-op. Replay is a distinct explicit restart command and is exempt from that no-op.
- A second selection supersedes the first without allowing late events, promises, timers, or cleanup from the first request to mutate or destroy the new request.
- Pausing while a transition is pending clears continuous-play intent for the eventual commit.
- Retrying the same failed destination creates a fresh generation.
- Cancellation clears `src` and calls `load()` only on the element still owned by the cancelled request.
- Media events and promise settlements must be filtered by both request generation and element ownership epoch.
- Web playback keeps at most one audible element. Crossfade may overlap visual elements only while audio ownership remains singular.
- Preserve the current committed frame until the replacement can be shown; do not expose a black frame during a switch.
- Add `playsInline` to every relevant video element.

### 4.3 Timing and failure classification

- Start a 15-second readiness watchdog for a newly requested destination.
- Once playback has begun, use a separate 10-second stall timer under the canonical run conditions.
- Automatic retry backoff is 2 seconds, 4 seconds, and 8 seconds, then terminal failure.
- Classify failures using observable browser/media signals, including `MediaError` codes. Do not claim an HTTP status that the media element does not expose.
- Offline failure is a distinct, actionable state. On reconnect, recover only to ready-paused with `resumeRequired`; the user must explicitly Resume.

### 4.4 Pure controller verification

Cover the canonical twelve cases plus focused supplemental cases:

1. successful playing commit
2. ready-but-paused commit
3. autoplay rejection/denial
4. terminal failure preserving committed selection
5. rapid A to B to C selection with stale B events ignored
6. cancel during readiness and listener/timer cleanup
7. automatic retry schedule and exhaustion
8. offline failure, reconnect, and explicit Resume requirement
9. ownership-epoch protection against stale timers
10. stale promise settlement cannot change the current state
11. reused-element cleanup cannot clear the new owner's source
12. audio ownership/no-overlap across transition and cancellation

Supplemental tests must cover same-selection no-op versus Replay, pause during pending selection, retrying the same failed target, readiness watchdog versus playback stall timer, and exactly-once listener/timer disposal.

## 5. Chapter-player integration

- [ ] Enable the new transactional controller only for `!isTauri`.
- [ ] Retain the current Tauri chapter playback path and normal behavior. Do not leak CDN retry policy into desktop local playback.
- [ ] Gate off the current 800 ms adjacent/next-source speculative preload effect on web.
- [ ] Render committed, pending, retry, failure, offline, Resume, and Replay states truthfully and accessibly.
- [ ] Preserve route/course identity while a request is pending or failed; only a successful commit updates the active destination.
- [ ] Route all `VideoPlayer.tsx` persistence through `safeStorage`; after migration, the broad production-source search for `localStorage` must find only `src/utils/safe-storage.ts`.
- [ ] Verify listener cleanup, no audible overlap, no black frame, and no stale request mutation in Playwright against actual DOM media fakes/controlled routes.
- [ ] Measure chapter-switch latency deterministically on at least three cold-cache chapters: one small file, one large file, and one special-character URL. Metric is gesture to first rendered/playing destination frame. Target median is at most 2.5 seconds and worst is at most 5.0 seconds on the named Gate-3 profile. Failure invokes the canonical stop/amend path; it never silently becomes a baseline.

## 6. Web slideshow lifecycle

Implement the web slideshow with one persistent video element across video slides. This is the single permanent player permitted by canonical section 4C, not a second player.

- [ ] On web, drive the persistent element imperatively and disable adjacent video speculative preload.
- [ ] Apply generation and ownership protection, readiness watchdog, retry/failure/offline states, truthful play state, cleanup on close/swipe/switch, Skip, and explicit retry.
- [ ] Image slides remain image elements and receive equivalent load/error handling so a failed image is actionable and skippable.
- [ ] Do not let late video events navigate back from a newer video or image slide.
- [ ] Keep the existing keyed `AnimatePresence` Tauri structure byte-identical where practical. If shared JSX makes exact preservation impossible, list every structural divergence with file and line in `CONTEXT.md` and the handoff.
- [ ] Stop and ask before adding any second permanent slideshow player.

Playwright acceptance must cover successful video playback, autoplay denial with a Play control, video failure with working Skip, rapid video-to-image navigation with stale events ignored, and `slideshowIsPlaying` matching the real media state. Add focused image-load failure coverage.

Explicit visual acceptance on web: image-to-video and video-to-image transitions show no black flash, no dead frame, and no regression in perceived transition quality compared with the current approved build. Self-check during implementation and spot-check again at Gate 3.

## 7. PDF/manual failure UX and offline behavior

- [ ] Use `react-pdf` load/error callbacks to represent loading, document failure, and page failure explicitly.
- [ ] Preserve the last usable manual view where possible; do not replace useful content with a blank pane.
- [ ] Provide Retry and a safe recovery/close path with accessible status messaging.
- [ ] Distinguish offline guidance from a generic load failure without making offline-availability claims.
- [ ] Test document failure, page failure, retry, and offline recovery behavior in the browser harness.

## 8. Sidebar, typography, LCP, and identity

### 8.1 Sidebar and responsive parity

- [ ] Initialize sidebar visibility with `useState(isTauri)` so web does not briefly mount desktop sidebar content while Tauri retains its current initial open state.
- [ ] Verify closed-sidebar Settings capture and desktop web/Tauri structural isolation.

### 8.2 Fonts

- [ ] Replace the network Google Fonts stylesheet with exactly pinned local packages:
  - `@fontsource/inter@5.3.0`
  - `@fontsource/playfair-display@5.3.0`
  - `@fontsource/jetbrains-mono@5.3.0`
  - `@fontsource/jost@5.3.0`
- [ ] Self-host the same Inter, Playfair Display, and JetBrains Mono weights/styles as the audited mac-build implementation.
- [ ] Self-host Jost latin normal weights 400, 500, 600, 700, 800, and 900 with `font-display: swap`; verify every referenced WOFF2 exists and re-run the source weight inventory before finalizing coverage.
- [ ] Use the authorized default stacks: `"Futura", "Jost", "Inter", ui-sans-serif, system-ui, sans-serif` and `"Futura", "Jost", "Playfair Display", serif`. Remove Calibri; leave the mono stack unchanged.
- [ ] Run the full 1440 px eight-surface matrix plus header, both selectors, sidebar, Settings, Send Certs, and How-To reflow sweep. Fix clipping, truncation, overflow, and undersized fixed-width controls; do not classify those defects as re-baseline candidates.
- [ ] Record measured local-font/LCP deltas. `index.css` is shared: Apple keeps real Futura first; future Windows-desktop adoption is a separate decision and is not part of this web round.
- [ ] These four font packages are the only project dependency additions authorized in this round.

### 8.3 LCP asset

- [ ] Preserve the idle illustration's intrinsic dimensions as 1024 by 691.
- [ ] Add explicit intrinsic sizing/priority only where it improves layout and LCP without changing the approved desktop geometry.
- [ ] Add a preload only if a captured performance trace demonstrates the fetch starts materially late and the preload improves the metric without waste.

### 8.4 Metadata and business copy

The suggested title `CPR Trainer Pro | Everyday Hero Academy`, description, `og:site_name`, and image alt text are proposals, not approved copy. Implement metadata only with exact wording Francisco explicitly approves; approval of a quoted proposed set verbatim counts. The current shipped strings differ: `index.html` uses `EH Academy - Instructor App` (typographic dash in the source), while Tauri window chrome is configured separately as `EH Academy - CPR Trainer Pro` (typographic dash in the source).

Any `index.html` title/meta edit is a shared-document change, like font loading: it also changes the Tauri WebView document title. The visible desktop window title remains governed by untouched `src-tauri/tauri.conf.json`. Record this distinction in `CONTEXT.md` and verify unchanged visible desktop chrome during cross-platform QA. Do not change business/legal wording in Send Certs or How-To without exact approval.

### 8.5 Web-only offline-download affordance

- [ ] Add typed download configuration for Windows, macOS, and iOS. Use the verified evergreen Windows URL `https://github.com/kikofrn/CPR-Trainer-Pro/releases/latest/download/CPRTrainerPro-Setup.exe`; the vanity hostname is not the installer redirect as of authorization. Keep macOS and iOS URLs null and show disabled `Coming soon` rows.
- [ ] Add a pure, unit-tested platform detector that prefers `navigator.userAgentData.platform`, falls back to the user-agent string, distinguishes touch-capable iPadOS from macOS, and treats detection as presentation-only.
- [ ] Add a web-only header icon button titled and labelled `Download app for offline use`. App computes its visibility; hide it whenever a course, slideshow, manual, or Send Certs content surface is open.
- [ ] Add one shared download modal with backdrop, X, and Escape close, initial focus, focus restoration, a highlighted detected-platform action, secondary available-platform actions, and disabled `Coming soon` rows. Windows uses ordinary anchor navigation; a future iOS URL uses `openExternalUrl()`.
- [ ] On web only, replace the Settings label with a separate `Offline Training?` button that opens the same modal. Preserve the adjacent easter-egg Info button byte-identical and preserve the current desktop `Offline Training Mode` label/behavior.
- [ ] Add unit coverage for the detector and config, plus default Playwright coverage for header visibility, both modal entry points, close behavior, the configured Windows href, desktop isolation, and console cleanliness.
- [ ] Declare the header icon and Settings label as intended re-baseline diffs. Record the configuration-driven, presentation-only decision and the optional future iOS Smart App Banner.

## 9. CSP staging, deployment evidence, and pushes

### 9.1 Push 1

After all non-CSP-enforcement product work and the full clean battery:

- [ ] Stage named files only and make all logical commits.
- [ ] Use a report-only CSP on the preview path first; do not claim enforcement from local-only evidence.
- [ ] Use `npx --yes wrangler@4.118.0` as a pinned tool download, not a project dependency.
- [ ] Push the complete round once as Push 1.
- [ ] Require both web CI and gitleaks to pass on Push 1.
- [ ] Capture hosted preview behavior and CSP reports/console evidence for the exact pushed SHA.

### 9.2 Push 2

- [ ] Derive the narrow enforcing policy from hosted evidence. It must retain the canonical directives including `form-action 'self'` and `frame-src 'none'`, and only the required media/font/image/connect/script/style sources.
- [ ] Flip from report-only to enforcing CSP, add the hosted evidence record, rerun the complete relevant local smoke, and commit.
- [ ] Push exactly once as Push 2.
- [ ] Require both web CI and gitleaks to pass and perform an enforcing-CSP hosted smoke.

A third push exists only to correct CSP after Push 2 and requires Francisco's explicit authorization. No other pushes are permitted in this round.

## 10. Verification, records, and Gate-3 handoff

### 10.1 Clean verification battery before Push 1

- [ ] `npm ci`
- [ ] TypeScript/no-emit and lint checks
- [ ] all Vitest tests, including controller cases
- [ ] production web build
- [ ] media URL verification and chapter/R2 reconciliation
- [ ] default Playwright suite including all Phase-3 specifications
- [ ] isolated desktop content/state-machine matrix at 1440 px
- [ ] validated same-machine eight-surface screenshot comparison
- [ ] deterministic latency measurements
- [ ] dependency audits split into full tree and production runtime
- [ ] Tauri isolation review, normal-path desktop smoke, visible window-title check, and structural divergence inventory
- [ ] source searches for direct storage, forbidden preload behavior, missing `playsInline`, forbidden machine paths, changed media/binary assets, and unexpected scope
- [ ] clean named-file diff and clean worktree after each final commit

### 10.2 Records duties

- [ ] Append dated `DECISIONS.md` entries for canonical W12-W17 and the adjudicated section 4A/4C semantic amendments implemented here: `playbackIntent`; `failedRequest`; Replay as an explicit restart command; the 15-second readiness watchdog plus separate 10-second stall timer; `MediaError`-based failure classification with no HTTP-status claims; reconnect to ready-paused with explicit Resume; and one permanent web slideshow element.
- [ ] Mirror these section 4A/4C amendments into the canonical plan, following the Gate-1 records-commit precedent.
- [ ] Record in `CONTEXT.md` all shared-document effects, every authorized cross-platform safety/shared change, any Tauri structural divergence with file/line, verification evidence, remaining limitations, and the exact next action.
- [ ] Record that `npx --yes wrangler@4.118.0` is a pinned tool download, not a project dependency; the dependency whitelist remains exactly the four font packages.
- [ ] Keep this plan's checkboxes current after each meaningful step.

### 10.3 Copy and Gate-3 sequencing

Claude's technical Gate-3 audit may begin on the pushed implementation tip while the business/legal copy decision is pending. No Gate-3 verdict or promotion may occur until Francisco either approves the existing copy as-is or supplies exact replacements. Any replacement lands as an authorized delta commit and is audited before the verdict.

Completion is reported after Push 2. Gate 3 then verifies the exact pushed SHA through the full diff audit, state-machine/controller cases, slideshow visual spot-check, CSP enforcement, deterministic screenshots and latency, desktop isolation, records, and the resolved copy decision.

## 11. Commit map

The implementation should use the smallest coherent version of this map; split a step further only when it improves auditability:

1. `web(phase-3): record governing revision 2.1 plan`
2. `web(phase-3): add license and leak scanning`
3. `web(phase-3): harden phase 3 browser harness`
4. `web(phase-3): add deterministic screenshot comparison`
5. `web(phase-3): implement media lifecycle controller`
6. `web(phase-3): integrate transactional chapter playback`
7. `web(phase-3): make slideshow media lifecycle persistent`
8. `web(phase-3): add manual loading failure recovery`
9. `web(phase-3): optimize web shell and local fonts`
10. `web(phase-3): add offline app download affordance`
11. `web(phase-3): record verification and report-only CSP`
12. Push 1 and hosted verification
13. `web(phase-3): enforce verified content security policy`
14. Push 2 and hosted enforcing-CSP smoke

## 12. Amendment audit result

Codex independently checked all eight Revision 2.1 amendments against the approved Git state, current source, Gate-1 evidence inventory, package registry pin, and canonical governance. All eight are accurate and worthwhile. Amendment 2 is accepted specifically as an approval boundary: it does not itself approve replacement metadata or business/legal copy.

Codex independently checked Sheet B against the authorized branch and current external endpoints. Its architecture and sequencing are accepted with the governing clarifications recorded above: Sheet B corrects the prior `dm-sans` transcription to the mac-build's actual JetBrains Mono package; the GitHub evergreen installer is the selected default because the vanity hostname is not currently an installer redirect; Send Certs is included in the hidden-content rule; and desktop retains its existing Settings label while the repurposed button/modal remains strictly web-only.
