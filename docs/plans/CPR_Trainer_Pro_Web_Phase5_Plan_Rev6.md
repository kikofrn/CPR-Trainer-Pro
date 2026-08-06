# CPR Trainer Pro — Web Phase-5 Implementer Prompt Rev 6 (ADJUDICATED): Mobile Completion

**AUDIENCE: Codex is the sole implementer.** This is Claude's adjudication of your Rev 5: BOTH new findings are ACCEPTED and code-verified (live refs both read `c0f9152` via `ls-remote`, so the stale-cached-ref preflight fix stands; your fullscreen inventory is confirmed exhaustive — all nine entry/exit routes carry `.catch(console.error)` at the exact lines pinned below, and `ManualFlipbook` today targets `document.documentElement`, making the reader-root rule a live correction; `slideshowIsPlaying` is the exact state name, App.tsx:344). Three adjudication changes: the self-containment sentence is restored (your header's "together with the binding canonical plan" dilution is reverted), the fullscreen inventory is pinned to exact verified line numbers with the state-listener locations added, and naming advances to Rev 6. Everything else is your Rev-5 text. **Implementation remains BLOCKED until Francisco explicitly authorizes this Rev 6. His authorization also constitutes business-copy approval of the exact §10 string.** Implement from THIS document alone — where it cites `CONTEXT.md`, the canonical plan, or repository records, those citations govern only the specific facts cited. Any contradiction, missing authority, or required expansion beyond this scope is a STOP-AND-ASK event.

Author: Claude (architect / sole web auditor), adjudicating Codex's Rev 5 · Date: August 5, 2026
Base: live `web-app` = live `web-production` = `c0f9152683e0ae5356bf050b72b1440dfb71538d`
The Phase-4 coordinator, history ledger, overlay host, managed-close routes, W19 chapter-only prefetch, W32 mobile split, W33 PDF teardown, and W34 switch geometry remain binding.

## 1. Preflight

Before editing:

1. Verify the remote URL:

```
git remote get-url origin
```

It must identify the expected CPR Trainer Pro repository.

2. Verify the live branch refs, not merely cached remote-tracking refs:

```
git ls-remote --exit-code origin refs/heads/web-app refs/heads/web-production
```

Both live refs must equal:

```
c0f9152683e0ae5356bf050b72b1440dfb71538d
```

3. Refresh the local remote-tracking refs:

```
git fetch --prune origin
```

Then verify `origin/web-app` and `origin/web-production` both equal the locked SHA. A pre-fetch cached-ref mismatch is not a product discrepancy; a post-fetch or live-ref mismatch is.

4. Verify:
   * Current branch is `web-app`.
   * `HEAD` equals the locked SHA.
   * `git status --porcelain` is empty.
5. Record Node and npm versions.
6. Run:
   * Clean `npm ci`
   * `npm run lint`
   * Full Vitest; expected base count 90
   * Production build
   * Full default Playwright; expected base count 36
7. Measure the main entry using the established Node zlib level-6 procedure:
   * Recorded base: 679,284 raw bytes / 191,116 gzip
   * Hard cap: 192,722 gzip
   * Recorded headroom: 1,606 bytes

If the Node runtime differs from the recorded run, rebuild and measure the unmodified base and candidate using the same runtime. The hard cap remains absolute.
The recorded baseline is authoritative from the final Phase-4 entry in `CONTEXT.md`, around line 207 — not from any prompt. If a prompt and `CONTEXT.md` disagree, `CONTEXT.md` wins and the discrepancy is reported; it is not by itself a stop condition.
Any genuine live-ref, cleanliness, test-count, build, or product discrepancy stops implementation.

## 2. Authorized scope

**Existing source files**

* `src/App.tsx`
* `src/components/VideoPlayer.tsx`
* `src/components/mobile/MobileShell.tsx`
* `src/components/ManualFlipbook.tsx`
* `src/components/SlideshowPlayer.tsx`
* `src/components/SendCertsPage.tsx`
* `src/components/HowToGuideModal.tsx`
* `src/media-selection-controller.ts` — GA6 audio lifecycle only
* `src/media-selection-controller.test.ts` — GA6 tests only
* `src/index.css`

Fullscreen helpers required by §7 must remain inside these authorized existing files. A new shared fullscreen source file is not authorized.

**Test and record files**

* `tests/e2e/phase5.spec.ts`
* Strictly necessary additions beneath `tests/e2e/helpers/`
* `playwright.config.ts` — add `phase5.spec.ts` to `testMatch` only
* `CONTEXT.md`
* `DECISIONS.md`, beginning with W35
* `docs/plans/CPR_Trainer_Pro_Web_App_Plan_v5.1_canonical.md` — Phase-5 checkboxes only
* `docs/plans/CPR_Trainer_Pro_Web_Phase5_Plan_Rev6.md` — this document, committed first

**Conditional new source files**
New files beneath `src/components/mobile/` are authorized only if a measured main-entry cap failure requires additional mobile-only splitting. Record the before/after measurement and reason for every split.
The controller and shared selection resolver must never be split merely to meet the cap. If a shared or non-mobile split is required, stop and ask.

**Protected: stop before editing**

* `src/components/WebSlideshowMedia.tsx`
* Any existing Phase-3 or Phase-4 helper whose semantics would need weakening
* Any file not explicitly authorized above

If slideshow swipe or another requirement genuinely needs `WebSlideshowMedia.tsx`, report the exact minimal proposed diff and wait.

**Forbidden outright**

* Dependencies or lockfile
* `src-tauri/`
* `src/chapters.ts`
* `DownloadAppModal.tsx`
* Media or binary files
* Workflows
* New persistence or storage
* Speculative media beyond W19
* Ordinary visual changes at widths ≥1024
* Broad error allowlists
* `git add -A`
* Force pushes
* Any implementer push to `web-production`

## 3. Execution and push governance

Implementation order:

1. Commit this plan locally.
2. Fix and verify GA6 audio.
3. Complete the manual timebox and record its decision.
4. Add slideshow touch behavior and complete fullscreen routing.
5. Add Continuous Play placement.
6. Complete mobile layouts, accessibility, and the authorized copy correction.
7. Run the complete final battery.
8. Make exactly one non-force push to `web-app`.

Multiple named local commits are allowed. Only one remote push is allowed. Any post-push failure requires STOP-AND-ASK before another push.

## 4. GA6 audio lifecycle — top priority

**Confirmed defect**
At `c0f9152`:

* `MediaSelectionController.resume()` at `media-selection-controller.ts:326–328` invokes `prepareElement()`.
* `prepareElement()` at `:643–645` sets volume to zero.
* `resume()` then calls `play()` without restoring the active target volume.
* Incoming/pending paths call `prepareElement()` at `:230`, `:252`, and `:392`.
* The singular-audio ordering contract is tested at `media-selection-controller.test.ts:400`.
* The controller is constructed only inside App's `isTauri`-guarded web-media effect at `App.tsx:947–949`; `VideoPlayer.tsx` imports a type only.

This guarantees silence for paused-commit → Play until another settings update. Android also demonstrated that relying on a later restore is not durable enough.

**Required ownership model**
Create one idempotent controller-owned operation that applies active playback settings:

* `muted` from the latest controller state
* `volume = muted ? 0 : targetVolume`
* Current `playbackRate`

Use it:

1. Immediately before `resume()` calls `play()`.
2. At commit, after the old element is paused or silenced and before the destination is exposed as active.
3. After the guarded crossfade/old-source cleanup, only if the same destination still owns the active slot.
4. During later active volume, mute, or playback-rate changes.

**Pending-element contract**
Preserve canonical Phase-3 behavior:

* Incoming playing selections may remain at zero volume during transition.
* Old and new elements must never both be audible.
* Updating settings during a pending request updates stored targets immediately.
* Pending mute and playback rate remain current.
* Pending volume may remain zero until commit.
* Commit applies the latest stored settings, not request-start snapshots.

Do not change selection generations, ownership epochs, prefetch, readiness, retries, failure preservation, or cleanup timing except for guarded post-cleanup settings reapplication.
The controller remains web-only. Reconfirm before commit that no Tauri path imports or constructs it.

**Required unit regressions**
Prove:

1. Paused commit → `resume()` applies current volume, mute, and rate before `play()`.
2. Chapter-switch commit leaves the destination at the latest nonzero volume when unmuted.
3. The old element is paused or inaudible before the destination becomes audible.
4. Settings changed while a request is pending:
   * Update the active element immediately.
   * Keep the pending element transition-safe.
   * Become the destination settings at commit.
5. Guarded post-crossfade reapplication cannot modify a reassigned or stale element.
6. Existing controller tests, including singular-audio ownership at line 400, retain their intent.

**Browser and device verification**
Playwright proves:

* First Play after a paused initial course commit yields `volume > 0`, `muted === false`, and actual playing state without prior volume interaction.
* A chapter switch during playback yields the same result after commit.
* Old and new elements are never simultaneously audible.

These become permanent default-suite regressions.
Because GA6a was reported on Android, Gate 5 includes real-Android first-play and mid-playback chapter-switch checks. Chromium emulation alone cannot close GA6a.

## 5. Manuals

**Half-day existing-flipbook timebox**
Test and repair the existing phone-width flipbook for no more than half a working day.
Pre-push testing uses Chromium touch emulation and responsive viewports. Record local WebKit only if an already-installed browser works without repository or dependency changes; it does not replace Gate-5 hardware.
Test:

* 375×667
* 390×844
* 430×932
* Their landscape counterparts
* 768×1024
* 820×1180

**Existing-flipbook acceptance**
At normal zoom:

* No horizontal crop or overflow.
* `<768` container width intentionally uses one-page portrait mode.
* `≥768` container width intentionally uses two-page mode.
* Touch page-turn does not capture browser-edge navigation.
* Toolbar controls remain visible and reachable with 44 px coarse-pointer regions.
* Rotation preserves the current page.
* The whole PDF is never mounted as active React-PDF canvases.

At magnified zoom:

* Pinch or an equivalent touch zoom interaction works.
* Drag-pan reaches every page region.
* Page-turn gestures do not fire accidentally while panning.
* Zoom can return to the normal centered view.
* Rotation preserves the current page and valid zoom state.

Lightweight pageflip wrappers are not automatically a failure. Record the exact peak mounted React-PDF page/canvas count and verify that it is constant with respect to document length and remains a bounded nearby-page window.

**Fallback trigger**
If rotation, touch zoom/pan, page-turn reliability, toolbar reachability, or bounded rendering still fails after the timebox, switch immediately to the fallback.
The fallback must:

* Use the existing `PDFDocumentProxy` and React-PDF `Page`.
* Render the current page plus at most one adjacent page.
* Keep no more than two page hosts/canvases mounted.
* Support touch swipe, previous/next, progress/page jump, and outline destinations.
* Preserve the current page across orientation changes.
* Preserve W33 loading-task ownership and fast-close teardown.
* Add no dependency.

Record the selected path and evidence in W36 or the next available decision.

**Hardware verdict**
Real iPhone/iPad testing occurs after the single candidate push. A hardware failure of a locally passing flipbook is STOP-AND-ASK. A fallback corrective requires Francisco's authorization and receives one corrective push.

## 6. Slideshows

**Swipe contract**
Enable swipe only for non-Tauri web at widths ≤1023.
Named constants:

* Edge exclusion: 24 CSS px from both horizontal edges
* Direction lock: 12 CSS px
* Horizontal dominance: `abs(dx) ≥ 1.25 × abs(dy)`
* Commit distance: 48 CSS px

Rules:

* Track one primary pointer/touch.
* Ignore multi-touch and pinch.
* Ignore gestures beginning on buttons, links, inputs, sliders, selectable controls, or swipe-exempt overlays.
* Never capture or cancel a gesture beginning inside either edge band.
* Vertical-locked and canceled gestures never change slides and are never `preventDefault()`-ed.
* Only a cancelable, internally horizontal-locked gesture may be prevented.
* Commit at most one slide per gesture.
* First and last slides remain bounded.
* Instructor Tips scrolling is swipe-exempt.
* Use App's existing `selectSlide` route; never mutate slideshow media directly.
* Swiping away from a playing video slide must retain the existing Phase-3 cleanup contract: the old video pauses/releases correctly, stale events cannot restore the prior slide, and `slideshowIsPlaying` (App.tsx:344) remains truthful.

**Touch-simplified mobile controls**
For non-Tauri web at ≤1023:

* Primary row: Previous, Play/Pause for video slides or a static-slide indicator, Next.
* Secondary row: Tips, Mute for video slides, and Fullscreen only when capable.
* No hover-only volume-slider dependency.
* All controls have accessible names and non-overlapping 44 px hit regions.
* Controls remain clear of the rail and safe areas in both orientations.

Desktop and Tauri controls remain unchanged.

## 7. Fullscreen and iOS behavior

**Complete baseline call-site inventory (verified at `c0f9152`)**
Route every web fullscreen entry and exit through an owner-local capability path. The complete set of baseline entry/exit routes — every one currently ending in `.catch(console.error)` — is:

* `VideoPlayer.tsx`
   * Mobile toggle `:361–362`
   * Desktop toggle `:490–494`
   * Close/exit path `:103–104`
* `SlideshowPlayer.tsx`
   * Close/exit path `:73–74`
   * Toggle `:304–307`
* `ManualFlipbook.tsx`
   * Toggle `:395–398` — currently requests fullscreen on `document.documentElement` (`:396`); it must be rerouted to the manual-reader root per the target rules below.
* `App.tsx`
   * `closeActiveContent` `:1344–1345`
   * Escape exit `:1408–1409`
   * `requestMobileHome` `:1595`

Fullscreen STATE listeners also exist at `App.tsx:1429–1436` (the authoritative `fullscreenchange` handler) and `ManualFlipbook.tsx:403–425` (a local `fullscreenchange` sync for its button state, plus a Tauri resize proxy) — the rerouted manual target must keep both coherent; neither may be orphaned or duplicated into a second source of truth.
These references are exhaustive for the baseline web fullscreen routes found at `c0f9152`. Re-run the inventory before commit. Existing Tauri-native branches and behavior remain unchanged.
Within each component, duplicate mobile/desktop controls must call the same owner-local route rather than retaining divergent request logic.

**Capability-first routing**
Never use browser or user-agent detection.
Standard targets:

* Course video: video-player container
* Slideshow: slideshow container
* Manual: manual-reader root, not the application document

Use standard `requestFullscreen()` only when the intended target exposes it.
For the course-video control only, when standard container fullscreen is unavailable:

* Capability remains unavailable until the active video has metadata.
* Do not start an asynchronous metadata wait inside the click handler.
* Re-evaluate capability on active-slot and metadata changes.
* Confirm `webkitEnterFullscreen` exists.
* Treat `webkitSupportsFullscreen === false` as unavailable.
* Invoke `webkitEnterFullscreen()` synchronously from the user's direct button action.
* Slideshow video does not receive a separate legacy element-fullscreen route; slideshow remains standard-container-only.

Visibility:

* Manual and slideshow controls are hidden without standard fullscreen capability.
* Course-video fullscreen is hidden when neither standard nor ready legacy capability exists.
* Capability updates when the active course-video slot or metadata changes.

**Entry and exit failure containment**
For web fullscreen entry and exit:

* Catch promise rejection and synchronous throws at the control owner.
* Do not create an unhandled rejection or call `console.error`.
* Keep the application interactive.
* If an entry capability proves unusable, hide or disable that route for the current mounted surface.
* Fullscreen state events — not optimistic button state — remain authoritative.
* A failed exit must not silently tear down the underlying content or history layer.
* Existing Tauri logging and native fullscreen handling are outside this web-only correction and remain unchanged.

**Coordinated fullscreen state**
App remains immersive-state owner and tracks:

* Standard `fullscreenchange`
* Legacy `webkitbeginfullscreen`
* Legacy `webkitendfullscreen`

Attach legacy listeners to both course-video elements and keep ownership correct across active-slot changes.
Use a combined standard-or-legacy immersive state wherever mobile chrome, close behavior, or sheet precedence depends on fullscreen. Do not assume `document.fullscreenElement` represents legacy video fullscreen.
Standard and legacy exits restore controls and mobile chrome according to existing immersive and sheet-precedence rules.

**iOS acceptance**
Verify:

* Every video retains `playsInline`.
* `100vh` fallback plus `100dvh` handles Safari URL-bar expansion/collapse.
* Momentum scrolling works in:
   * Course sheets
   * How-To
   * Send Certs online and offline
   * Manual pan/scroll surfaces
* No blanket `touch-action: none`.
* Safe-area insets remain correct.
* Edge-swipe Back uses the existing popstate route and is never captured by slideshow or manual gestures.

## 8. Orientation and breakpoint ownership

Automate:

```
768×1024 → 1024×768 → 768×1024
```

Preserve:

* Managed history state and depth
* Video chapter and playback time
* Intended video play/pause state
* Current slideshow and slide index
* Slideshow-video paused/playing truth
* Current manual and page
* Valid manual zoom state

The 1024-wide middle state intentionally uses desktop navigation. Returning to portrait restores mobile navigation without remounting or losing active content.
Retain the exact 1023/1024 seam.

## 9. Continuous Play

Render the existing shared switch in:

* CPR preview sheet
* CPR active-content list sheet
* First Aid preview sheet
* First Aid active-content list sheet
* Existing Settings panel

Every instance uses App-owned `isContinuousPlay` and its setter. Add no persistence or parallel state.
Tests toggle from Settings, CPR, and First Aid. For each origin:

* Any concurrently mounted instance updates immediately.
* Close/open the other course or Settings surfaces and prove they reflect the same App-owned `aria-checked` value.
* No remount creates a divergent default.

## 10. Mobile readability, accessibility, and copy

**Send Certs**
At 375 px, online and offline states must:

* Use a readable single-column flow.
* Have no forced nowrap or horizontal overflow.
* Keep close, portal, retry, guide, and external-link actions reachable.
* Preserve ≥1024 layout and visuals.

Replace clickable sample-card `<div>` elements with semantic buttons or equivalent keyboard-operable controls. Preserve dimensions and visual styling. Give every card an accessible name; native buttons supply Enter/Space behavior.

**How-To**
At 375 px:

* Menu, App, Teaching, and Portal paths use readable single-column layouts.
* Header, footer, navigation, screenshots, and close controls remain reachable.
* Content scrolls independently without trapping the page.
* No horizontal overflow.
* ≥1024 layout and copy remain unchanged.

Pass `isMobileWeb` explicitly from App. Do not infer mobile through user agent.
The only authorized copy change is the mobile-context replacement of the existing Continuous Play sentence around `HowToGuideModal.tsx:290` with exactly:

**"Continuous Play can be turned on in the course menu or in Settings (the gear icon at the top of the screen)."**

Francisco's authorization of Rev 6 constitutes business-copy approval of that exact string. Desktop retains its current sentence. Any other inaccurate desktop-only instruction requires STOP-AND-ASK.

**Accessibility**
Mobile-visible Manual and Slideshow controls require accessible names for:

* Close
* Previous/Next
* Play/Pause
* Magnify/zoom
* Tips
* Mute
* Fullscreen when present
* Interactive page progress/jump controls

Also require:

* Visible `focus-visible`
* Correct switch roles and `aria-checked`
* Disabled-state semantics
* Keyboard operation where meaningful
* Non-overlapping 44 px coarse-pointer regions
* Existing focus traps and Escape precedence remain green

Add no accessibility dependency.
Desktop-only easter-egg activation and mock controls remain unavailable from mobile navigation.

## 11. Automated verification

**Unit**
Run the complete Vitest suite, including all GA6 ownership tests. Record total files and tests.

**Default Playwright**
Add `phase5.spec.ts` to the existing app project. Use file- or describe-level mobile/touch options; do not add another committed project.
Keep strict console, page-error, and unhandled-rejection discipline unchanged.
Coverage must include:

* GA6 first play
* GA6 chapter switch
* Singular audio
* Manual page-turn, zoom/pan, rotation, render bound, and fallback if selected
* Slideshow horizontal swipe
* Swipe away from a playing video with correct cleanup/state truth
* Vertical scroll not blocked
* Edge-band exclusion
* Interactive-target and multi-touch exclusion
* Standard fullscreen entry from both VideoPlayer control branches
* Slideshow and manual standard-capability branches
* Video legacy-capability branch
* Legacy capability unavailable before metadata and re-evaluated afterward
* No-capability hidden-control branches
* Rejected standard entry, rejected exit, and synchronous legacy failure without unhandled rejection or `console.error`
* Standard and legacy fullscreen state events, including active-slot changes
* Close, Escape, and mobile-Home fullscreen exits
* iPad seam rotation
* Continuous Play synchronization across sequentially opened surfaces
* Send Certs online/offline 375 px layouts and keyboard cards
* All How-To paths at 375 px
* Mobile-only copy and unchanged desktop copy
* Accessible names and hit-target checks

Do not add waits that conceal races. Capability fakes alter APIs and events, never user-agent strings.

## 12. Final local battery

After implementation:

1. Clean `npm ci`.
2. Lint/typecheck.
3. Full Vitest.
4. Production build.
5. Main-entry zlib measurement and every generated JS chunk recorded.
6. Full CI-mode default Playwright.
7. Established representative viewport matrix:
   * 375×667
   * 390×844
   * 430×932
   * 768×1024
   * 820×1180
   * 667×375
   * 844×390
   * 932×430
   * 1024×768
   * 1180×820
   * 1023×768
   * 1440×900
8. Explicit 1023/1024 seam.
9. Explicit 768/820 portrait two-page-manual checks.
10. Full Layer-1 content matrix at 390 px.
11. Revalidate Phase-3 reference `c4bf8a82be6acb2c3cc7c04d6351386f1701a2c6` immediately before candidate visual comparison.
12. Compare all eight 1440×900 surfaces:
   * Ordinary difference limit ≤0.1%.
   * Mobile-only How-To and Send Certs work produces no unintended desktop change.
   * Semantic-button reset styling remains visually unchanged.
   * Unified desktop VideoPlayer fullscreen routing produces no ordinary visual change.
13. Tauri structural inventory.
14. `tauri build --debug --no-bundle`.
15. Tauri desktop smoke at normal and narrow widths.
16. Media verification:
   * `node scripts/verify-media-urls.mjs`
   * `node scripts/sync-chapters-from-bucket.mjs`
   * Never `--regenerate`
17. Drift checks:
   * `git diff --check`
   * Only authorized paths changed
   * Dependencies and lockfile unchanged
   * `src-tauri`, chapters, workflows, media, and protected files unchanged
   * No new storage
   * No speculative media beyond W19
   * No user-agent fullscreen routing
   * All baseline web fullscreen call sites use the new owner-local routing
   * No web fullscreen entry/exit path retains `.catch(console.error)`
   * Every video retains `playsInline`
   * Main entry ≤192,722 gzip

If the cap fails, split only mobile presentation code and rerun the complete affected battery. If compliant splitting cannot meet the cap, stop and ask.

## 13. Records and local commits

Append decisions beginning at W35, including:

* GA6 active/pending audio ownership and restore ordering
* Manual flipbook versus fallback
* Swipe thresholds
* Fullscreen capability, user-activation, and entry/exit routing
* Any cap-forced split

Update `CONTEXT.md` with:

* Base and candidate SHAs
* Live-ref preflight evidence
* Node/npm versions
* Test counts
* Bundle and chunk sizes
* GA6 evidence
* Manual timebox evidence and selected path
* Viewport and rotation results
* Fullscreen branch and failure-path results
* Exact changed mobile copy
* Visual comparison
* Tauri evidence
* Media reconciliation results

Tick canonical Phase-5 boxes only when their acceptance evidence is complete.
Stage files by explicit name. Local commits may be logical and incremental; no remote push occurs until the complete battery is green.

## 14. Single push and Gate 5

Immediately before pushing:

1. Verify the worktree is clean and every intended change is committed.
2. Query live refs again with `git ls-remote`.
3. Require live `web-app` and `web-production` still equal the locked base.
4. Refresh local refs if needed and verify the candidate descends from `c0f9152`.
5. Verify `web-production` was not changed locally.
6. Make exactly one non-force push to `web-app`.

A concurrent remote update causes the non-force push to fail and is a STOP-AND-ASK event.
Require Web App CI and gitleaks to pass at the exact pushed SHA. Any failure stops; no second push is implied.

**Gate-5 checks**
Claude performs the sole independent audit against the pushed SHA, including an independent Layer-1 390 px matrix and the full Rev-8-pattern reproduction battery.
Francisco performs:

* iPhone in both orientations
* iPad in both orientations
* 768/820 portrait manual checks
* Safari URL-bar collapse and momentum scrolling
* Fullscreen capability behavior
* Edge-swipe Back
* First Play with sound without touching volume
* Manual rotation/zoom/page-turn verdict
* Targeted Android:
   * First Play without touching volume
   * Chapter switch during playback
   * Destination remains audible
   * No mute/unmute workaround

Any failure returns to STOP-AND-ASK. A manual fallback corrective still requires explicit Francisco authorization.

**Promotion and domain order**
Only after Claude approves the exact candidate and Francisco's device checks pass:

1. Francisco promotes that approved SHA to `web-production` using canonical §6.3.
2. Wait for Cloudflare Pages production to report the exact promoted SHA.
3. Attach `app.ehacademy.com`.
4. Run Gate 5b against the live domain:
   * HTTPS
   * Production SHA
   * CSP and security headers
   * 404 behavior
   * Media streaming/range behavior
   * First Play with sound
   * Manual
   * Slideshow
   * Back behavior

Codex never pushes `web-production` and does not attach the domain.

