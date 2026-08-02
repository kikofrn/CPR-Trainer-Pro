# CPR Trainer Pro — Web App Plan v5.1 CANONICAL — FULLY SELF-CONTAINED — IMPLEMENTATION-READY

**Author:** Claude (architect/auditor) · **Date:** August 1, 2026 · **Conference:** August 10
**Status:** THE governing doc for the Web track — **APPROVED TO IMPLEMENT (joint Claude+Codex, Aug 1; Codex round-6 verdict: "approved to implement" after four clerical edits + one clarification, all applied in this text)**. No further plan audits; the next Codex review is Gate 1 against the implementation. This document is complete on its own: no rule, step, risk, or decision requires consulting v1–v5 (historical records only). Commit as `docs/plans/CPR_Trainer_Pro_Web_App_Plan_v5.1_canonical.md` in Phase 0.
**Implementer:** Gemini 3.1 Pro (Antigravity). **Auditors:** Claude (every gate) + Codex (co-audits Gates 1, 3, 4, 5, 6). Francisco authorizes phases, performs every promotion, owns rollback and business signoff.
**Repo:** github.com/kikofrn/cpr-trainer-pro (PUBLIC — never commit secrets, never `git add -A`).

---

## 0.1 Round-5 adjudication (the v5.1 amendments — all four ACCEPTED, all code claims verified)

Codex's round-5 verdict: no architectural changes needed; four narrow implementation blockers → this v5.1. Verified before acceptance: `SlideshowPlayer.tsx` uses ONE video element (~line 97) with separate adjacent-media preload elements (~line 108, incl. `preload="auto"` videos); `selectSlide()` commits the slide index immediately and `setSlideshowIsPlaying(true)` is set without awaiting `play()` resolution (App.tsx:871/900); the stale comment "Videos always use local URL (they must be downloaded first to stream)" exists at SlideshowPlayer.tsx:35–37.

| # | Amendment | Where |
|---|---|---|
| A1 | Ownership epochs: stale crossfade/cleanup timers can destroy a reused media element (timer callbacks aren't guarded by media-event generation tokens) | §4A — ownership-epoch rules + tests t9–t12. MANDATORY. |
| A2 | Slideshow video needs its own explicit contract (single element; no dual-player crossfade; `slideshowIsPlaying` truth) | NEW §4C + Playwright coverage; Phase 3.1b |
| A3 | Safe mechanism for the first-render Error Boundary test (no public crash flag) | §4B — `mountApp()` extraction + localhost-only test fixture under `tests/e2e/fixtures/` |
| A4 | Desktop-scope contradiction: shared safety refactors must be explicitly authorized | §3.2 — named cross-platform safety exceptions + acceptance checks; recorded as W11 |

Small corrections folded in: `vite.config.ts` cleanup removes `loadEnv`/`env`/`mode`/unused `isTauri` along with the define (Phase 1.11); "`web-production` is the only PRODUCTION branch" (previews are also public) (§3.1); promotion preflight checks incl. `git merge-base --is-ancestor` (§6.3); Pages-rollback divergence is by design DURING an emergency — the prohibition is leaving it unreconciled (§6.5); Lighthouse throttling is applied by Lighthouse itself, separate from the DevTools profile, never double-applied (§5.7); stale slideshow "must be downloaded" comments updated for web streaming (Phase 3.1b).

## 0.2 Provenance and round-4 adjudication

This plan is the product of four audit rounds (Claude architect + Codex independent auditor; every code claim verified against the repo before acceptance). Round 4's seven required corrections, all ACCEPTED:

| # | Correction | Where fixed |
|---|---|---|
| C1 | v4 referenced v3 for rules/guide/risks — not self-contained | This entire document; §5.1, §6, §7 fully expanded; adjudication nuances restated in §3.6 |
| C2 | Media state machine lacked transactional application state | §4A (committed/pending selection contract + 8 automated controller tests) |
| C3 | Prescribed playback order can fail on mobile Safari (user-activation window; `loadeddata` unreliable under Data Saver; AbortController can't cancel media loads) | §4A (playing/paused/denied/failed distinction; listeners-before-src; readyState checks; generation tokens; `src`-clear + `load()` for aborts). Codex now co-audits Gate 3. |
| C4 | Boot-completion design had a race (`root.render()` is async) | §4B (`rootOwned` vs `appReady`; raw-DOM fatal screen only pre-rootOwned; React 19 root error options permitted; first-render error test; generic production fallback with Reload primary) |
| C5 | jsdom authorization contradicted the dependency whitelist | §5.6 test-dependency policy: NO jsdom — DI/fakes in Vitest (node env) + Playwright for DOM behavior; a DOM unit-test need = stop-and-ask, never a silent addition |
| C6 | Gate 1 invoked a mobile matrix before mobile exists | §5.5 matrix schedule rebuilt per gate; explicit viewport pairs incl. the 1023/1024 boundary; explicit real-device allocation |
| C7 | Deployment/harness execution underspecified (no local target; branch-protection/promotion contradiction) | §5.4 harness execution protocol; §6 deployment guide (bypass-actor model, force-push/deletion blocks, CI status requirement, post-build SHA verification, `git push -u`) |

Round-4 improvements, all ACCEPTED: performance baselines split (Gate 1 local JS; Gate 2 pages.dev network/LCP/CLS; 175 KB = pre-project reference only) + absolute chapter-switch targets (§5.7); stall-timer run conditions + terminal-failure handling (§4 Phase 3.2); manual fallback defined as windowed page rendering, objective trigger decides alone (§4 Phase 5.1); external-link `noopener` hardening + keyboard-operable course cards (§4 Phases 1.11b/4.6 — `window.open(url,'_blank')` without noopener verified in `utils/browser.ts` and Sidebar; clickable-`<div>` cards verified); CSP adds `form-action 'self'` and `frame-src 'none'` (§4 Phase 3.3); expanded legal-review scope (§4 Phase 3.6); daily critical-path checkpoint + written feature-priority order (§4.9).

Verified codebase facts this plan rests on (all confirmed against `v2.3.3` = `89f7f1142d3d86e09f31de6ee8bfe0adeebfee5b`, and independently by Codex): the web build compiles (main JS 619 KB / 175 KB gzip) and boots fully in a plain browser; tsc passes; vitest 5/5; all 244 active media URLs return; bucket↔`chapters.ts` reconciliation passes; manifest = JSON 200 with CORS `*`; media = Range/206 with CORS `*`; 135 VTTs bundled in `public/subtitles/` and fetched site-relative in web mode; web fullscreen fallbacks exist; thumbnails fall back to bundled covers when nothing is "downloaded".

Verified defects/gaps this plan fixes: `mediaUrl()` returns bare filenames in web mode (`cdnUrl()` already exists in the same file); Tauri imports reachable in browsers (`App.tsx:14–15` static plugins; `Sidebar.tsx:6` static invoke; `download-manager.ts:1–2`; `snapshot-store.ts:1`; `main.tsx` fatal path — dynamic but ungated); global `error`/`unhandledrejection` handlers replace the React root even post-mount, and the only ErrorBoundary wraps the manual viewer alone; direct `localStorage` at 11 sites in 4 files including the download-manager singleton constructor; `selectChapter()` swaps players and chapter state together, before the destination loads; `preload="auto"` on both players + a next-`src`+`.load()` effect at 800 ms + slideshow adjacent preloads; Cloudflare Pages' no-`404.html` default returns index.html HTTP 200 for every unmatched path (including missing `.vtt` files); unused `GEMINI_API_KEY` define in `vite.config.ts` (nothing leaked); six npm advisory packages (@babel/core, brace-expansion, esbuild-via-tsx, postcss, sharp, vite ≤6.4.2 — dev script binds `0.0.0.0`), all build-side, non-breaking fixes for all but sharp; no browser-test harness in-repo; `window.open` without `noopener`; clickable-`<div>` instructor cards; `lite_app.tsx` is corrupted unused legacy (never touch).

## 1. Executive summary (plain language)

The Windows app is React + Vite (web technology) inside the Tauri desktop shell. Both auditors confirmed the exact tested `v2.3.3` code builds and boots in a plain browser. The web app is that code with: media streamed from your CDN; the desktop machinery made provably inert AND the app made resilient to browser-world failures; a deployment pipeline where nothing unaudited can reach the live site; and a full mobile UI (your top priority) built in two gated phases that provably cannot disturb desktop.

**Locked decisions (Francisco, Aug 1):** URL **app.ehacademy.com**, attached only after the mobile gate passes · **fully public** · **full mobile UI before Aug 10** · **Antigravity implements** · **noindex at launch (app shell only)** · **public previews accepted**.

## 2. Base choice

Base: Windows `v2.3.3` (tag → `89f7f1142d3d86e09f31de6ee8bfe0adeebfee5b`). Rejected alternatives: iOS (Swift cannot run in browsers — full rewrite), `mac-app-store` branch (same codebase, two months stale, pre-audit), from scratch (indefensible 9 days out). Out of scope, locked: downloads/offline, app auto-updater (the site is always current), splash window, login, Coming-Soon gating changes, `?v=` etag pinning at launch (4 h CDN cache accepted; the conference is protected by the Aug 8 R2 freeze), media-domain indexing policy (residual, §7.8), CDN thumbnails on web (bundled fallbacks accepted for the conference, §8 W10).

## 3. Architecture

### 3.1 Branches
- **`web-app`** — integration branch, created from tag `v2.3.3`. Antigravity pushes ONLY here. Cloudflare Pages builds it as previews — public AND guessable (`web-app.<project>.pages.dev` + per-push hash URLs), accepted (§8 W8).
- **`web-production`** — the only PRODUCTION branch (previews are also publicly reachable; this branch is the only one served at the production URL/domain). Created by Francisco in Phase 2; advances ONLY by the §6.3 promotion procedure to a SHA named in a written gate verdict. Antigravity never touches it.

### 3.2 Change rules
1. Web behavior activates only behind the runtime check `!isTauri` (from `media-resolver.ts`). NORMAL desktop behavior and visuals stay identical — future Windows→web cherry-picks depend on it (the Windows 2.3.4 `?v=`-encoding fix S3 is earmarked). **Authorized cross-platform SAFETY exceptions (A4; recorded as W11) — these shared refactors apply on both platforms and may improve EXCEPTIONAL/error behavior, but must not change normal Tauri behavior:** `safeStorage`; safe fatal rendering + root Error Boundary (§4B); external-link opener isolation (`noopener,noreferrer` via `openExternalUrl()`); pure course-selection extraction (Phase 4.2). Everything else — media streaming policy (§4A/§4C), browser retry UI, history behavior, mobile layout — remains strictly `!isTauri`/responsive-gated. **Acceptance for the exceptions:** Tauri platform-fake tests confirm the splash-close and dynamic-import paths still execute only in Tauri mode; normal desktop selection, progress persistence, updater, download, and external-link flows remain structurally unchanged; no browser CDN behavior leaks into the Tauri media path; every shared exception is listed in `CONTEXT.md`.
2. No file deletions. `src-tauri/` and `chapters.ts` content are never touched. The desktop release workflow is never touched.
3. Dependency changes: exactly two scoped exceptions — Phase 1.7 (`npm audit fix`) and Phase 1.10 (pinned `@playwright/test`). §5.6 governs test-dependency questions. Anything else = stop-and-ask.
4. Testability refactors are authorized ONLY within §4 Phase 1.6b's boundaries.

### 3.3 Mobile approach
One codebase; Tailwind responsive breakpoints; the players are reused, not forked. Mobile layout below `lg` (1024 px): **window width ≤1023 px must show mobile navigation; ≥1024 px must show desktop navigation — including iPad landscape (1024/1180 px), which intentionally receives the desktop layout.** Desktop ≥1024 px is regression-guarded by the §5.4 screenshot protocol (≤0.1% pixel diff, same-machine sequential comparison).

### 3.4 Touch targets
Every interactive control exposes a ≥44×44 px HIT REGION via invisible expansion (pseudo-element/wrapper) under **`@media (any-pointer: coarse)`** (hybrid laptops report both pointer types). Visual dimensions never change (verified desktop controls: ~33 px menu button, 40×20 edition toggles, 40×40 rate button). Overlap check: tapping each control's expanded edge fires that control's handler, never a neighbor's.

### 3.5 Hosting
Cloudflare Pages, git-connected; production branch `web-production`; build `npm run build`; output `dist`; env `NODE_VERSION=22`. Browsers fetch media DIRECTLY from `media.ehacademy.com` (R2 zero egress) — media does not flow "through" Pages. Cost: likely $0/month at expected usage (Pages free tier; R2 storage/ops metered within existing usage; glance at billing after launch week).

### 3.6 Standing adjudication nuances (restated in full; agreed with Codex)
- **A — No speculative next-chapter loading at launch.** The inactive player carries no `src` except during an in-flight, user-initiated switch (§4A). "Late-chapter metadata prefetch" is deliberately excluded; if Gate 3's latency measurements (§5.7) fail the absolute targets, the documented amendment path is to revisit this policy — never to silently accept slower switches.
- **B — Domain timing.** `app.ehacademy.com` attaches only after Gate 5 (mobile complete). Until then production runs on `<project>.pages.dev`, unannounced and noindexed. QR/booth signage may print any time — the URL string is predetermined. Francisco may attach earlier only by explicit recorded decision as an intentionally incomplete, unannounced launch.
- **C — Harness at gates, not CI.** CI (Phase 1.9) runs typecheck+vitest+build only; the Playwright suite is run by the implementer at phase end and by auditors at gates, per §5.4. Revisit post-conference.
- **D — Media-domain indexing out of scope.** The app-shell noindex (headers/robots/meta) does not govern `media.ehacademy.com` responses; changing worker/R2 headers during freeze week is its own risk. Recorded residual (§7.8), revisit post-conference.

## 4. The phases

Rhythm: **Francisco authorizes → Antigravity implements from THIS doc → pushes `web-app` → audit (Claude every gate; Codex co-audits Gates 1/3/4/5/6) → written verdict names the approved SHA → Francisco promotes (from Phase 2 on).** Never start phase N+1 before gate N passes. Daily critical-path checkpoint per §4.9.

### §4A — The media selection controller (governs Phase 3; stated here because it is the plan's highest-risk component)

**Transactional model.** Two selection records exist: **committed** (what the UI asserts is current: `activeChapterIndex`/`activeChapter`, highlighted row, subtitle file + cue state, progress bar binding, saved course progress, the visible player) and **pending** (a user request in flight). Rules:
1. A chapter/course/Next/Prev/continuous-play/Retry request creates a pending selection with a fresh **generation token** (monotonic counter — NOT AbortController, which cannot cancel an HTML media element's load; the element is aborted/reset by clearing/changing `src` then calling `load()`).
2. NOTHING committed changes while pending is in flight: not the chapter index, not the highlighted row, not the subtitle source, not saved progress. The pending row shows a distinct "Loading chapter…" affordance.
3. The destination loads on the INACTIVE player: register `canplay`/`loadeddata`/`error` listeners BEFORE assigning `src`; after assigning, also check `readyState` directly so an already-fired event can't be missed; `loadeddata` alone is NOT a sufficient success signal (may not fire under mobile Data Saver) — readiness = `canplay` OR `readyState ≥ HAVE_FUTURE_DATA`, with `error` as the failure path.
4. **Playing/paused/denied/failed are four distinct outcomes:**
   - Capture whether the current player was playing at request time.
   - Current PAUSED → load destination's first frame, commit the swap PAUSED, do not call `play()`.
   - Current PLAYING → initiate `play()` on the incoming player as close to the original user gesture as practical (mobile Safari's user-activation window expires; a late scripted `play()` may reject), incoming player at volume 0, await readiness/playing, then swap/crossfade and restore volume. Audible tracks of the two players must NEVER overlap.
   - `play()` rejection with `NotAllowedError` is NOT a media failure: commit the swap paused and show a Resume affordance.
   - Real load/decode/network failure: discard pending, keep ALL committed state on the old chapter (which keeps playing/paused as it was), show Retry on the pending row.
5. Commit point: only after readiness (and playback, when required) succeeds does committed state update — chapter index, highlight, subtitles, progress binding — and only then is course progress saved.
6. After the crossfade completes: clear the OLD player's `src` and call `load()` to release its buffer.
7. Stale events: any event carrying a generation older than the current pending token is ignored. Rapid selections: the newest request wins; older pendings are reset (src cleared + `load()`).
8. Cleanup: pending loads are cancelled and elements reset on player close, course switch, slideshow switch, and unmount. A failed or cancelled pending load clears its source and resets the element.
9. **Ownership epochs (A1 — timers are not media events; generation tokens alone don't protect against stale DELAYED callbacks):** every media-element assignment records an ownership epoch = (transition generation, expected element, expected source). Every delayed callback — crossfade completion, source cleanup, retry, stall timeout — captures the epoch it was scheduled under and, before mutating an element, verifies the element still carries that epoch and source. Reusing an element for a newer request CANCELS any older fade/cleanup callback targeting it. Old-player cleanup may clear an element only if it has not been reassigned. (The failure this kills: A active → B commits → A's post-fade cleanup is scheduled → user selects C → A begins loading C → the stale B-transition cleanup fires and clears A, aborting C.)
10. Listener hygiene: all `canplay`/`loadeddata`/`playing`/`error`/`abort`/timeout listeners — AND the failure-handling listeners (`waiting`, `stalled`, `progress`, `timeupdate`, `visibilitychange`) — are removed on success, failure, cancellation, and unmount. Ownership epochs (rule 9) guard EVERY destructive delayed action: fade cleanup, retry callbacks, and stall timers alike — not merely media events.
11. `NotAllowedError` still WAITS for media readiness before committing the paused destination — it never commits a blank element. Mute, playback rate, and the zero-volume transition state are applied BEFORE calling `play()`.
12. Selecting the already-committed chapter is a MEDIA-CONTROLLER no-op — no new request, no playback reset — but normal UI navigation still occurs: the selector/sheet closes and the existing player is revealed, preserving its playing/paused state. (An implementation must not leave the user stranded in the selection sheet after tapping the current chapter.)

**Automated controller tests (Vitest, pure logic via dependency injection — §5.6):** (t1) A→B success commits B; (t2) A→B failure leaves committed A intact, pending cleared, Retry exposed; (t3) A→B→C rapid with stale B events arriving last — C wins, B events ignored; (t4) close/unmount during pending B — clean reset, no commit; (t5) paused A→B commits paused, no `play()` call; (t6) A→B with `play()` rejecting `NotAllowedError` — commits paused + Resume state; (t7) course switch during pending chapter request — pending discarded, new course's initial selection proceeds; (t8) post-fade cleanup clears the old element's source; **(t9) A→B commits, C requested during A's cleanup delay — the stale cleanup must NOT clear C's element; (t10) repeated failure→Retry cycles leave exactly one active listener set and one retry timer; (t11) selecting the already-committed chapter creates no new request and does not reset playback; (t12) `NotAllowedError` before readiness — destination commits paused only AFTER readiness, never blank.** Manual acceptance additionally verifies: zero next-chapter request before selection (Network panel ABSENCE), no black frame at any point, subtitles/rate/volume correct after commit.

### §4B — Boot and error containment (governs Phase 1.5)

Two distinct flags, because `createRoot().render()` is asynchronous and code after it may run before the first render:
- **`rootOwned`** — set when React has taken responsibility for the root (i.e., `createRoot` succeeded and `render` was invoked without throwing synchronously). The raw-DOM fatal screen (built with `textContent`/element construction — NEVER `innerHTML` with interpolated content) is permitted ONLY while `!rootOwned` (missing #root container, bootstrap failure).
- **`appReady`** — set by a sentinel effect inside the mounted tree; it also sets `data-app-ready="true"` on the root element (the §5.4 harness readiness marker).
Rules: once `rootOwned`, global `error`/`unhandledrejection` handlers NEVER replace the root DOM — they log (a dismissible toast is optional), even if `appReady` is still false. React render failures — including FIRST-render failures — are handled by the root-level Error Boundary (wrap `<App/>` in the existing `ErrorBoundary` component, which supports `fallback`/`onReset`), whose production fallback is a generic branded message with **Reload as the primary action** (a retry-in-place would immediately re-fail on persistent errors; never show stack traces or exception text in production). React 19's `createRoot` options (`onUncaughtError`, `onCaughtError`, `onRecoverableError`) MAY be used for the logging paths. The Tauri splash-close path (storage flag + dynamic `@tauri-apps` import) runs ONLY when `isTauri`, each operation individually caught — a web fatal path never loads a Tauri module.

**First-render-error test mechanism (A3 — no public crash flag, no production test hook):** extract mounting into a side-effect-free function `mountApp({ container, AppComponent, platform })`. Production `main.tsx` calls it with the real `App`. A test-only Vite fixture under `tests/e2e/fixtures/` calls the SAME `mountApp` with a component that throws during render; the fixture is served only on `127.0.0.1` and is NOT part of the production Rollup inputs, `dist`, the Pages deployment, or any public route. Playwright verifies against the fixture: the generic branded Error Boundary fallback appears; Reload is the primary action; NO stack/exception text; NOT the raw pre-root fatal screen. Code review verifies production `main.tsx` uses the same tested `mountApp` path. The pre-root failure path is tested separately via injected boot dependencies (missing root container → the safe raw-DOM fallback). **Other §4B tests: a post-boot unhandled rejection leaves the app fully interactive; throwing storage does not prevent boot.**

### §4C — Slideshow media contract (A2; governs Phase 3.1b — the slideshow does NOT use §4A's dual-element crossfade)

Verified current shape: ONE video element per video slide; hidden adjacent-media preload elements; `selectSlide()` commits the slide index immediately; `slideshowIsPlaying` can be true even when `play()` rejects. §4C shares §4A's generation-token, autoplay-rejection, listener-cleanup, retry, and cancellation RULES, applied to the single-element model:
1. Remove speculative adjacent VIDEO loading on web (`!isTauri`). Adjacent IMAGE preloading may remain only if measured and intentional (record the measurement in `CONTEXT.md`).
2. Entering a video slide shows a branded loading frame/spinner — never an unstyled black video.
3. Readiness and error handlers are attached BEFORE assigning the source.
4. Rapid slide changes use a slideshow-specific generation token; stale video/image events cannot change the current slide.
5. `slideshowIsPlaying` becomes true ONLY after `play()` resolves or the `playing` event fires — never before.
6. `NotAllowedError` leaves the video ready and paused with a visible Play control.
7. Load/decode failure shows Retry AND Skip; controls never claim the video is playing.
8. Closing, swiping away, or switching slides pauses the video, removes listeners, clears retry/stall timers, and releases the source.
9. Image load errors get a branded error/Skip state.
10. NO second permanent slideshow player unless Gate 3 evidence demonstrates it is needed (stop-and-ask + plan amendment path).

**Playwright coverage (Phase 3.1b):** successful video-slide playback; autoplay denial (paused + Play control); video failure → Skip works; rapid video-slide→image-slide navigation with late video events (slide doesn't change back, no stale mutation); `slideshowIsPlaying` matches actual element state throughout.

### Phase −1 — Workspace preflight (Antigravity, ~10 min) — BLOCKING
The previous Antigravity workspace is known-bad (empty git history, v2.3.2-era contents, nested `experiment-2.6` clone). It must not be used.
1. [x] In a NEW empty directory (sibling to, never inside, any existing checkout): `git clone https://github.com/kikofrn/cpr-trainer-pro.git cpr-web && cd cpr-web`
2. [x] Verify ALL: `git remote -v` shows exactly that URL; `git status --porcelain` is empty; `git rev-parse --show-toplevel` is the new folder.
3. [x] `git fetch --tags && git rev-parse 'v2.3.3^{commit}'` prints `89f7f1142d3d86e09f31de6ee8bfe0adeebfee5b`. ANY mismatch → STOP and report; do not improvise.

### Phase 0 — Branch + plan commit (Antigravity, ~20 min; exactly two commits)
1. [x] `git checkout -b web-app v2.3.3`; verify HEAD = the locked SHA.
2. [x] Commit 1: this doc, verbatim, at `docs/plans/CPR_Trainer_Pro_Web_App_Plan_v5.1_canonical.md` — `web(phase-0): commit governing web plan v5.1`.
3. [x] Commit 2: append to `CONTEXT.md`: branch created from v2.3.3; `npm ci && npm run build` result (both must succeed); date — `web(phase-0): record baseline build`.
4. [x] Push: `git push -u origin web-app`.
**Gate 0 (Claude):** correct SHA ancestry; exactly two commits; plan verbatim; nothing else touched.

### Phase 1 — Web-mode correctness, resilience, isolation proof, harness (Antigravity, ~1.5 days)
1. [x] `src/media-resolver.ts` — when `!isTauri`, `mediaUrl()` returns `cdnUrl(filename)`; EXCEPTION: paths starting `/subtitles/` keep returning the bare relative path. Tauri branch untouched.
2. [x] `src/download-manager.ts` — nothing Tauri loads/executes in browsers: gate the constructor's event subscription; every `invoke`-calling method returns caller-expected "nothing downloaded" shapes when `!isTauri`; top-level `@tauri-apps/*` imports become dynamic imports inside gated paths. Web-mode construction uses the CDN default base URL and performs NO storage read.
3. [x] `src/snapshot-store.ts` — empty default read; silent no-op writes when `!isTauri`; dynamic import.
4. [x] `src/App.tsx` — remove static plugin imports (lines 14–15); dynamic import inside the existing gated updater code. `src/components/Sidebar.tsx` — remove the static `invoke` import (line 6); route BOTH instructor-course opens through `openExternalUrl()`.
5. [x] `src/main.tsx` — implement §4B in full (rootOwned/appReady; textContent-only fatal screen gated to `!rootOwned`; isTauri-gated splash path; root ErrorBoundary with branded Reload-primary fallback; `data-app-ready` sentinel; **the `mountApp()` extraction + `tests/e2e/fixtures/` throwing-render fixture per §4B/A3**).
5b. [x] NEW `src/utils/safe-storage.ts` — `get/set/remove` wrapping `localStorage` in try/catch with defaults and an in-memory fallback map (state stays session-consistent when storage throws). Migrate ALL direct `localStorage` access in `main.tsx`, `App.tsx`, `download-manager.ts`. (`VideoPlayer.tsx` migrates in Phase 3. Gate 6 audit: `rg -n "localStorage" src` — the broad pattern, catching `window.localStorage`, `globalThis.localStorage`, and bracket forms — EVERY result must be inside `src/utils/safe-storage.ts`; any other result fails the gate unless it is test-only and explicitly justified.)
6. [x] **Vitest tests (per §5.6 — DI/fakes, node environment, NO jsdom):** (a) `mediaUrl()` web/Tauri/`/subtitles/`/special-char encoding; (b) fake non-Tauri platform → download-manager + snapshot-store logic never invokes the Tauri loader; (c) web fatal path never requests a Tauri module; (d) safeStorage with throwing backing store returns defaults and stays consistent. Existing 5 tests keep passing. **Playwright tests (Phase 1.10 harness):** boot with localStorage stubbed to throw (app boots, navigates, plays); post-boot injected unhandled rejection (app stays interactive); first-render error (boundary fallback appears).
6b. [x] **Testability refactors AUTHORIZED within these boundaries:** extract boot/fatal handling from `main.tsx` into small exported functions; extract the §4A controller as a pure module; a small platform adapter or injected dynamic-import loader; `vi.resetModules()` patterns; explicit storage fakes. Boundaries: zero desktop behavior change; zero new runtime dependencies; refactors confined to whitelisted files + small new `src/utils/`/test-helper modules; each recorded in the handoff note.
7. [x] **Dependency security — evidence procedure:** (1) save `npm audit --json` → `docs/plans/evidence/audit-pre.json` AND `npm audit --omit=dev --json` → `audit-pre-runtime.json` (expected: zero runtime advisories); (2) `npm audit fix` (plain; NEVER `--force`); (3) review package.json + lockfile diffs (expected magnitude ~22 packages: vite 6.4.2→6.4.3, esbuild, postcss, brace-expansion, babel transitives; sharp remains — semver-major); (4) clean `npm ci` + `npm run lint` + `npx vitest run` + `npm run build` all green; (5) save post-fix `audit-post.json` + `audit-post-runtime.json`; (6) record every REMAINING advisory in `DECISIONS.md` W9 (package/version/reachability/rationale) — only after seeing post-fix results. Verify the JSONs contain no machine-specific paths. Commit alone.
8. [x] `public/_headers`:
   ```
   /*
     X-Content-Type-Options: nosniff
     Referrer-Policy: strict-origin-when-cross-origin
     X-Frame-Options: DENY
     Permissions-Policy: camera=(), microphone=(), geolocation=()
     X-Robots-Tag: noindex
   ```
   + `public/robots.txt` (`User-agent: *` / `Disallow: /`) + `<meta name="robots" content="noindex">` in `index.html`. No CSP yet (Phase 3, staged).
9. [x] `public/404.html` — minimal branded "Page not found", self-contained, no JS (kills Pages' serve-index-for-everything default). NEW `.github/workflows/web-ci.yml` — push/PR on `web-app` only: Node 22 → `npm ci` → `npm run lint` → `npx vitest run` → `npm run build`. Desktop release workflow untouched.
10. [ ] **Harness:** pinned `@playwright/test` devDependency + `npx playwright install chromium` in setup docs + checked-in `tests/e2e/` implementing §5.4 (readiness via `data-app-ready` + `document.fonts.ready` + locator assertions — NEVER `networkidle`; exact-match expected-error allowlists; screenshot determinism). Record Playwright version + Chromium build in `CONTEXT.md`. No screenshot images committed.
11. [x] `vite.config.ts` — delete the `GEMINI_API_KEY` define block AND its now-unused scaffolding: the `loadEnv` import, the `env` variable, the `mode` destructured parameter, and the unused `isTauri` variable (nothing else in the config changes). Download-UI sweep — every download surface hidden when `!isTauri`, listed with file:line in `CONTEXT.md`.
11b. [x] `src/utils/browser.ts` — `window.open(url, '_blank', 'noopener,noreferrer')` in BOTH call sites; verify every external-opening surface routes through `openExternalUrl()` (Sidebar's direct `window.open` fallbacks get the same flags via the helper).
12. [x] Append decisions W1–W11 (§8) to `DECISIONS.md`. **Isolation acceptance:** `rg -n "@tauri-apps" src` inventory pasted into `CONTEXT.md`; per-hit gating mechanism stated in the handoff note; the step-6 tests are the executable proof.
**Forbidden:** `src-tauri/`, `chapters.ts` content, dependencies beyond 1.7/1.10, visual/layout changes, file deletions, desktop release workflow.
**Gate 1 (Claude + Codex):** line-by-line diff vs this list; independent build; harness run per §5.4 against a local `vite preview` target — **full §5.5 Layer-1 content matrix at 1440 px + 390 px boot/overflow smoke only** (mobile UI does not exist yet); all unit + Playwright tests; **confirm the throwing-render fixture is ABSENT from the production `dist` output and that no public crash query/test hook exists; confirm the POSITIVE Tauri platform-fake assertion (the splash loader executes in Tauri mode) alongside the negative one (never in web mode);** media scripts (`node scripts/verify-media-urls.mjs`; `node scripts/sync-chapters-from-bucket.mjs` check mode); isolation review; audit JSONs sanity-checked; **baseline recorded: measured total initial JS gzip (the 175 KB figure is only the pre-project reference — the measured value is the budget anchor).**

### Phase 2 — Pages, production branch, rollback readiness (Francisco, guided; ~45 min)
1. [ ] Create the production branch at the Gate-1-approved SHA: `git fetch origin && git checkout -b web-production <approved-sha> && git push -u origin web-production`.
2. [ ] Pages project per §6.2 (production branch `web-production`, `npm run build`, `dist`, `NODE_VERSION=22`). NO custom domain yet (§3.6-B).
3. [ ] **Branch protection on `web-production` per §6.4** (Francisco/admin as the sole bypass actor for the promotion push; force pushes and deletion blocked; CI status required if supported). If the repo plan lacks protection features, record that in `CONTEXT.md` and rely on the §6.3 procedure.
4. [ ] **Rollback runbook established NOW (§6.5)** + Pages build-failure email notifications enabled.
**Gate 2 (Claude):** production `pages.dev` URL over HTTPS; headers present (incl. noindex; robots.txt served); video/PDF/subtitles stream; manifest reachable; no mixed content; **404 semantics: unknown page → 404 page; missing JS/image → 404; missing `.vtt` → 404, never HTML 200; existing assets → 200**; promotion + rollback procedures dry-run understood by Francisco; **network/LCP/CLS baseline recorded on `pages.dev` on the named throttling profile (the hosting-comparable baseline for Phase 6).**

### Phase 3 — Media controller, streaming policy, failure UX, CSP, copy review (Antigravity + Francisco, ~1.5 days)
1. [ ] **Implement §4A in full** (committed/pending controller; four outcomes; generation tokens + ownership epochs; listeners-before-src + readyState; cleanup + listener hygiene) as web-only behavior (desktop Tauri untouched). The 800 ms next-`src` preload effect is gated OFF for web. `playsInline` added to EVERY video element (players + slideshow) now. `VideoPlayer.tsx` localStorage → `safeStorage` in this phase. All 12 controller tests (§4A t1–t12) green.
1b. [ ] **Implement §4C in full** (slideshow contract: no speculative adjacent video on web; branded loading/error/Skip states; slideshow generation token; truthful `slideshowIsPlaying`; cleanup on close/swipe/switch) + its five Playwright scenarios. **Update the stale comments in `SlideshowPlayer.tsx` (~lines 35–37) claiming videos "must be downloaded first to stream" — on web they stream via `mediaUrl()`.**
2. [ ] **Failure UX with bounds:** visible retryable states — media 404/403 ("couldn't load this video" + Retry); mid-play stall (spinner immediately; error only after a no-progress interval of 10 s); offline ("reconnect to keep streaming" banner; `navigator.onLine` is a hint only, paired with element/fetch failure); PDF failure (error card + Retry); slideshow media failure (skip-forward affordance). Retry rules: capped exponential backoff (2 s/4 s/8 s, max 3 automatic attempts) for LIKELY-TRANSIENT network failures only; **terminal failures (unsupported format/decode errors) are NOT auto-retried** — manual Retry only; retries cancelled on chapter change; reconnect reloads to a READY state and never auto-resumes audible playback (Resume shown if autoplay is blocked). **The stall timer runs ONLY while playback is intended and the element is waiting/stalled; it pauses/resets on: intentional pause, seeking, hidden tab (`visibilitychange`), chapter switch, any successful `playing`/`progress`/advancing `timeupdate`, and unmount.** No separate network-probe requests.
3. [ ] **CSP staged:** add as `Content-Security-Policy-Report-Only`:
   `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://media.ehacademy.com; media-src 'self' blob: https://media.ehacademy.com; connect-src 'self' https://media.ehacademy.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; frame-src 'none'`
   Report-only validation = exercising this gate's §5.5 matrix while watching the browser console (no reporting endpoint). Zero violations → switch to enforcing `Content-Security-Policy` (keep `X-Frame-Options`). Any directive change recorded with rationale in `CONTEXT.md`.
4. [ ] Meta/identity: title, description, favicon, Open Graph tags with ABSOLUTE `og:image` URL. ONE preconnect to `https://media.ehacademy.com`, mode matched to observed requests (media elements are no-CORS ⇒ start with the plain variant) and validated in DevTools; keep a second variant only if DevTools shows a second connection pool in real use.
5. [ ] Desktop QA sweep 1280–1920 px, Chrome/Edge/Firefox.
6. [ ] **Business/legal review (Francisco):** the public Send Certs compliance/marketing claims; copyright wording; public availability of the training content itself; rights to referenced standards/branded material; whether an emergency/training-use disclaimer is appropriate; certification/OSHA/child-care-licensing/"latest standards" claims; external third-party course links. Finalized BEFORE responsive QA (text changes affect mobile wrapping). Recorded in `CONTEXT.md`. This is a business decision — auditors flag, Francisco decides.
**Gate 3 (Claude + Codex — co-audit added because this phase carries the plan's highest UX risk):** diff audit; §5.5 desktop content/state-machine matrix at 1440 px; controller tests t1–t12; ALL FIVE §4C slideshow Playwright scenarios; manual state-machine acceptance including request absence, no black frame, rapid selection, failure preservation, no audible overlap, truthful slideshow play state, and stale slideshow-event rejection; CSP console-violation check; screenshot diff vs Gate-1 baseline (§5.4); **chapter-switch latency measured per §5.7 — if the absolute targets fail, Gate 3 FAILS or invokes the §3.6-A amendment; a slow result must not silently become the baseline.** Promote on pass.

### Phase 4 — Mobile UI foundation (Antigravity, ~1.5 days) ⭐ top priority
1. [ ] **Viewport shell:** web-only class applied via `!isTauri` (NOT `@supports`-only — Tauri's WebView may also support dvh):
   ```css
   .web-app-shell { height: 100vh; height: 100dvh; }
   ```
   replacing the root `h-screen` for web. Safe-area insets applied ONLY to the mobile header, content edges, and bottom bar — never blanket on the root. Desktop Tauri rendering unchanged.
2. [ ] **Shared course-selection model** extracted from `HeaderNav` (standard/VA/pediatric/pedi+VA editions, Coming-Soon combinations, last-used-edition session memory) into a pure module/hook consumed by BOTH the desktop header (behavior unchanged) and mobile navigation. **Pure unit tests:** CPR + FA × all four edition combinations incl. Coming-Soon; video vs slideshow surface; missing/reordered course IDs; last-view behavior; desktop and mobile resolve the SAME course ID for identical inputs. Session-memory semantics preserved exactly; no new persistence.
3. [ ] Navigation shell: bottom tab bar ≤1023 px (CPR & AED · First Aid · Manuals · Certs — same surfaces/icons as HeaderNav); course/chapter/edition selection in a slide-up sheet driven by the shared model, reusing Sidebar data/components restyled. **The sheet is an accessible dialog: focus containment, body-scroll locking, focus restoration on close.**
4. [ ] **History state machine:** push a named sentinel (`{ehOverlay:'sheet'}` / `{ehOverlay:'player'}`) ONLY on closed→open transitions of those two UI states. Course/chapter changes create NO history entries. Opening the player while the sheet is open REPLACES the sheet sentinel. Back: player → tab/list; sheet → closed; base → leaves the site normally. UI-initiated close consumes exactly its own sentinel and never navigates away from the app. **Refresh ALWAYS normalizes to base state via `replaceState` — it never restores an overlay.** `popstate` closes overlays and never pushes (no loops). Forward restores a valid state or safely lands on the tab list. Listener removed on unmount. **Tests: direct entry, repeated Back, Forward, refresh mid-overlay (→ base), Android hardware Back.**
5. [ ] Video experience: full-width 16:9; tap toggles controls; §3.4 hit regions with overlap check; landscape edge-to-edge; subtitles legible; next/prev thumb-reachable. Bottom bar hides consistently in ALL immersive states — video playback (controls hidden), manual fullscreen, slideshow fullscreen.
6. [ ] A11y built in now: labels on all new icon buttons; visible focus; ARIA state for tabs/toggles; reduced-motion honored by new animations; **instructor-course cards become keyboard-operable controls (role/tabIndex/Enter+Space or real `<button>`) with unchanged visuals.**
7. [ ] Acceptance per §5.5 Gate-4 row.
**Forbidden:** ≥1024 px visual changes; restructuring players; new dependencies.
**Gate 4 (Claude + Codex):** same-machine 1440 px screenshot diff ≤0.1%; §5.5 responsive representative matrix; breakpoint-boundary check (1023 mobile / 1024 desktop); code audit for breakpoint violations + selection-model duplication; history walkthrough incl. **Android hardware Back on the Gate-4 real Android device**; course-model tests green; a11y spot-check.

### Phase 5 — Mobile UI completion (Antigravity, ~1.5 days)
1. [ ] Manuals: test and repair the EXISTING mobile flipbook path (`isMobile` = containerWidth<768 at ManualFlipbook.tsx:274; `usePortrait` at :436) on real phone widths — page-turn gestures, zoom, toolbar reachability. **Objective trigger, which decides alone: if the flipbook still fails iOS rotation/zoom testing after a HALF-DAY timebox, switch to the fallback.** The fallback is a **windowed single-page viewer: current PDF page rendered + at most one adjacent page cached, implemented with the existing react-pdf `Page` machinery (lazy/virtualized, NO new dependency, never the whole document in the DOM — iPhone memory pressure).** Decision + evidence in `DECISIONS.md`.
2. [ ] Slideshows: swipe navigation with **horizontal direction-locking** (mostly-horizontal gestures drive slides; vertical scrolling and iOS edge-swipe navigation never blocked); slide videos follow §4A/Phase-3 policies; touch-simplified controls.
3. [ ] Send Certs + How-To modal: single-column readable at 375 px (copy already final from Phase 3.6).
4. [ ] iOS Safari pass: `playsInline` verified everywhere; `dvh` shell vs URL-bar collapse; momentum scrolling; orientation changes never lose player state.
5. [ ] A11y for this phase's surfaces; desktop-only surfaces (easter eggs, mock toggles) absent from mobile UI.
**Gate 5 (Claude + Codex):** §5.5 Gate-5 row (**full Layer-1 content matrix at 390 px** + iPhone/iPad real-device set); **explicit manual-viewer check at 768 and 820 px PORTRAIT — the flipbook's internal breakpoint is <768 while the app's mobile-nav breakpoint is <1024, so tablets get mobile navigation WITH two-page manual mode; that combination must be intentionally usable;** same-machine 1440 px diff; media reconciliation scripts re-run. **On pass: Francisco attaches `app.ehacademy.com` (§6.6);** Gate 5b live-domain re-check (HTTPS, headers, streaming, 404 semantics).

### Phase 6 — Performance, QA, freeze (Antigravity + Francisco, ~1 day + checks)
1. [ ] **Performance budget (§5.7):** initial JS gzip ≤ measured Gate-1 baseline + 10% unless justified in writing; zero speculative video requests (re-verified); non-media transfer + request count vs the Gate-2 `pages.dev` baseline, regression ≤ 10%; LCP ≤ 2.5 s and CLS ≤ 0.1 on the named profile vs the Gate-2 baseline; chapter-switch latency: absolute targets per §5.7 AND regression ≤ 20% vs the Gate-3 recording; Lighthouse mobile ≥ 85 as MEDIAN of 3 cold-cache runs (profile per §5.7). **Bundle splitting ONLY if the budget fails.**
2. [ ] A11y final verification (implemented in 4–5): focus order, labels, contrast, captions, reduced-motion, hit regions + overlap. Gate 6 storage audit: `rg -n "localStorage" src` (broad pattern) — every result inside `src/utils/safe-storage.ts`; anything else fails unless test-only and explicitly justified.
3. [ ] Real devices per §5.5 Gate-6 row (all repeated: iPhone, iPad both orientations, Android, desktop Chrome/Edge/Firefox/Safari). Findings triaged fix-now vs post-conference.
4. [ ] Media reconciliation re-run (final).
5. [ ] **Content freeze:** R2 FROZEN Aug 8–10 (no uploads/replacements). Post-freeze media exception = Francisco's explicit approval + Cloudflare cache purge of affected URLs; Pages rollback does NOT roll back R2; dependent app+media changes ship together.
6. [ ] Monitoring confirmed: Pages failure emails (enabled Phase 2); Claude checks deploy status + live smoke at every gate; rollback per §6.5.
7. [ ] QR code for `https://app.ehacademy.com` (Claude produces print-ready QR + booth one-pager on request).
8. [ ] Freeze: after Aug 8, `web-production` advances only for Francisco-approved fixes.
9. [ ] **Conference-morning booth checklist:** domain resolves over HTTPS; headers present; QR scans; default CPR course plays + one seek; one manual opens; one slideshow advances; offline desktop/USB backup present at the booth.
**Gate 6 (Claude + Codex):** final audit vs this entire plan; live domain checks; go/no-go note written into the project status doc.

### §4.9 Timeline, checkpoint, and priority order
Aug 1–2: −1/0/1 + Gate 1 · Aug 3: Phase 2 + Gate 2, Phase 3 begins · Aug 4: Phase 3 completes + Gate 3 · Aug 4–5: Phase 4 + Gate 4 · Aug 6–7: Phase 5 + Gate 5 + domain · Aug 7–8: Phase 6 + Gate 6 · Aug 8–10: freeze + buffer. This is tight and the buffer is thin — therefore:
- **Daily critical-path checkpoint:** each day Francisco (or the session on his behalf) posts a one-line status against this schedule; a slip of more than half a day triggers the priority order below rather than schedule denial.
- **Feature-priority order (cut from the bottom, never the top):** 1. playback correctness (§4A) · 2. mobile navigation · 3. manual usability · 4. real-device testing · 5. rollback readiness · 6. failure-UX breadth · 7. animation/transition polish · 8. perf fine-tuning beyond the budget. Desktop web (Gates 1–3) is independently demo-able if mobile slips catastrophically — that is the emergency floor, not the plan.

## 5. Guardrails, roles, harness, matrix, budgets

### 5.1 Antigravity rules (complete; every prompt includes them; every audit enforces them)
1. This committed plan is the ONLY source of truth. If anything is ambiguous or the code contradicts the plan, STOP — write the question into `CONTEXT.md`, commit that, end the turn. Never improvise a resolution.
2. Scope is a per-phase whitelist. Always off-limits: `src-tauri/`, `chapters.ts` content, dependencies beyond the named scoped exceptions, the desktop release workflow, every branch other than `web-app`, and `web-production` above all.
3. No invented APIs. Verify every function/prop/option against this repo or the installed package's types under `node_modules` before use. Unsure → stop and record.
4. Additive, gated changes only: web behavior behind `!isTauri`; mobile styling behind responsive prefixes; desktop behavior and ≥1024 px visuals provably unchanged.
5. Never `git add -A`. Stage named files only. The repo is public: no secrets, no binaries, no personal/machine paths in any committed text (including evidence JSONs).
6. Tick this plan's checkboxes in the committed doc as steps complete; commit per logical step (`web(phase-N): <step>`); phase-end handoff note in `CONTEXT.md` (files changed with line refs, self-test evidence with the browser named, refactors made under 1.6b); durable choices appended to `DECISIONS.md` as W-entries.
7. Never claim a test that was not run.
8. Testability refactors only within Phase 1.6b boundaries, each recorded.

### 5.2 Roles
Antigravity implements. Claude architects, audits every gate, adjudicates all auditor findings, and writes each phase's prompt only after the prior gate passes. Codex co-audits Gates 1, 3, 4, 5, 6 (comments go to Francisco/Claude; Claude adjudicates into plan amendments — nothing pastes into the plan directly). Francisco authorizes phases, performs every promotion, owns rollback and the business/legal review. Claude's repo access is read-only; Claude never pushes.

### 5.3 Claude gate-audit procedure
Fresh clone → diff vs the prior gate SHA → every changed line maps to a plan step → independent `npm ci` + `npm run build` → harness per §5.4 → §5.5 matrix row for this gate → unit + controller + Playwright tests → media reconciliation scripts (Gates 1, 5, 6) → checkbox/`CONTEXT.md`/`DECISIONS.md` verification → written verdict naming the approved SHA → project status doc updated in the same turn.

### 5.4 Harness execution protocol (deterministic, reproducible)
- **Dependency:** pinned `@playwright/test` (devDependency; exact version + Chromium build recorded in `CONTEXT.md`). Setup REQUIRES `npx playwright install chromium` — the npm package alone does not install the browser; Playwright versions map to specific browser builds.
- **Local target (Gates 1+ and any pre-Pages run):** `npm run build`, then serve with `npx vite preview --host 127.0.0.1 --port <port>` — NEVER the dev script (it binds `0.0.0.0`).
- **Baseline/candidate:** check out the previous approved SHA and the candidate SHA in separate clean worktrees/clones, serve on separate localhost ports, run SEQUENTIALLY on the SAME machine with identical browser version, viewport, DPR, locale, timezone, color scheme, and font conditions. Never compare screenshots across OSes or machines.
- **Readiness:** await `data-app-ready="true"` (§4B) + `document.fonts.ready` + locator assertions for the surface under test; explicit media/poster readiness only where relevant. NEVER `networkidle` (discouraged by Playwright; meaningless with active media).
- **Error rule:** fail on every UNEXPECTED `pageerror`, unhandled rejection, or `console.error`. Failure-scenario tests declare their expected errors as **exact message/type/URL matches with expected counts — broad regexes forbidden.**
- **Screenshots:** transitions/animations disabled (injected style + reduced-motion); never capture live video frames (paused poster state or masked region); fixed initial storage/state; masks declared in-script and reviewed at audit; 0.1% pixel-diff threshold (valid only under this same-machine process); baseline/candidate/diff images + checksums + both SHAs recorded in the gate report; images travel with the report, never committed.

### 5.5 Test-matrix schedule (per gate; replaces any blanket rule)
Definitions — **Layer 1 (full content matrix):** every visible course/edition: open, play first chapter ≥20 s with subtitles on, seek, jump to one middle chapter, chapter list renders; every slideshow: open, advance ≥5 slides incl. one video slide; every manual: open, ≥4 page turns, zoom once; Send Certs + How-To render; Coming-Soon stays gated. (Watching all content end-to-end is explicitly NOT required.) **Layer 2 (responsive representative smoke):** ONE representative course + manual + slideshow; navigation, layout integrity, no horizontal scroll — at the explicit viewports: 375×667, 390×844, 430×932, 768×1024, 820×1180, their landscape counterparts (667×375, 844×390, 932×430, 1024×768, 1180×820 — noting ≥1024-wide landscape intentionally shows desktop layout), **1023×768 (must be mobile nav) and 1024×768 (must be desktop nav)**, and 1440×900. **Layer 3 (real devices):** default CPR course, one special-character media path, one manual, one slideshow video, Back behavior.
- **Gate 1:** Layer 1 at 1440 px; 390 px boot/overflow smoke ONLY (no mobile UI exists yet).
- **Gate 3:** desktop content/state-machine matrix at 1440 px (Layer 1 + §4A acceptance).
- **Gate 4:** Layer 2 full viewport set + Layer 3 on ANDROID (hardware Back included).
- **Gate 5:** Layer 1 at 390 px + Layer 3 on IPHONE + IPAD (both orientations).
- **Gate 6:** targeted regression (areas changed since Gate 5) + Layer 3 repeated on ALL devices (iPhone, iPad, Android, desktop Chrome/Edge/Firefox/Safari).

### 5.6 Test-dependency policy (removes the jsdom ambiguity)
NO jsdom, happy-dom, or Testing Library. Unit tests (boot controller, storage, platform gating, §4A media controller) run in Vitest's node environment against PURE logic via dependency injection and small fakes — this is what Phase 1.6b's refactors exist to enable. Real-DOM behavior (boot, navigation, throwing-storage, error-boundary, history, §4A manual acceptance) is covered by the Playwright harness. If the implementer believes a DOM-rendering UNIT test is genuinely required, that is a stop-and-ask: Claude adjudicates, and only then may an exactly-pinned jsdom devDependency be added as a third scoped exception, included in the audit review. The implementer never infers dependency permissions.

### 5.7 Performance measurement (defined metrics, split baselines)
- **JS baseline:** measured total initial JS gzip at Gate 1 (local build). 175 KB is only the pre-project reference. Budget: ≤ baseline + 10% at Gate 6 unless justified in writing.
- **Network/LCP/CLS baseline:** recorded at Gate 2 on `pages.dev` (hosting-comparable). Budget at Gate 6: LCP ≤ 2.5 s, CLS ≤ 0.1, non-media transfer + request-count regression ≤ 10% — all on the named profile.
- **Named profile:** Chrome DevTools mobile emulation (Moto G Power class), Slow 4G network throttling, 4× CPU throttling, cold cache; parameters recorded in `CONTEXT.md`.
- **Chapter-switch latency:** metric = time from chapter activation (user gesture) to the destination's first rendered/playing frame. Measured at Gate 3 on ≥3 cold-cache chapters: one small file, one large file, one special-character URL. **Absolute targets on the named profile: median ≤ 2.5 s, worst ≤ 5.0 s.** Exceeding them FAILS Gate 3 or invokes the §3.6-A preload-policy amendment — it must not silently become the accepted baseline. Gate 6 re-measures: regression ≤ 20% vs Gate 3.
- **Lighthouse:** mobile ≥ 85, MEDIAN of 3 cold-cache runs. **Lighthouse applies its own throttling — run it WITHOUT the DevTools throttling profile active (never double-throttle); the named DevTools profile is for manual/har measurements only.**

## 6. Deployment, promotion, rollback (complete guide — Francisco)

### 6.1 Concepts (60 seconds)
A website is files a computer sends to browsers; hosting = the company running that computer; DNS = the phone book mapping `app.ehacademy.com` to it. Your domain's DNS is already at Cloudflare (that's how media.ehacademy.com works), and Cloudflare's free static hosting is **Pages**. Browsers load the app shell from Pages and stream media DIRECTLY from `media.ehacademy.com` (R2 — zero egress fees). Cost: likely $0/month at expected usage.

### 6.2 One-time Pages setup (Phase 2, after Gate 1)
1. Create the production branch: `git fetch origin && git checkout -b web-production <approved-sha> && git push -u origin web-production` (the SHA comes from Claude's Gate-1 verdict).
2. dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** (labels may drift; the flow is "create a Pages project from a Git repository"). Authorize GitHub; pick **cpr-trainer-pro**.
3. Build settings: production branch **`web-production`** · build command **`npm run build`** · output **`dist`** · environment variable **`NODE_VERSION` = `22`**.
4. **Save and Deploy** → `https://<project>.pages.dev` in ~2 min. That's the live app (unannounced; noindexed). Enable build-failure email notifications in the project settings.
5. NO custom domain yet — that happens after Gate 5 (§6.6).

### 6.3 Promotion (after every passing gate from Gate 3 on)
Claude's gate verdict names `<approved-sha>`. Run in this EXACT order (ancestry is only checked after production is fetched and current — checking earlier can fail on unfetched objects, a missing local branch, or stale state):
```
git remote get-url origin          # must print the expected repository URL
git status --porcelain             # must print nothing
git fetch origin
git checkout web-production        # first time on a machine: git checkout -b web-production origin/web-production
git pull --ff-only
git cat-file -e <approved-sha>^{commit}   # the approved object exists locally
git merge-base --is-ancestor HEAD <approved-sha>   # approved SHA descends from current production
git merge --ff-only <approved-sha>
git push origin web-production
```
Acceptance: the remote URL is the expected repository; `git status --porcelain` is empty; `git cat-file` confirms the approved object exists; `git merge-base` exits successfully AFTER production is current; and — after the Pages build COMPLETES — the dashboard shows the production deployment referencing exactly `<approved-sha>` (not merely that the push succeeded).

### 6.4 Branch protection (Phase 2)
On GitHub → repo Settings → Branches → rule for `web-production`: **block force pushes; block deletion; require the `web-ci` status check on the commit if the plan supports it; restrict pushes with Francisco/admin as the SOLE bypass actor** — the §6.3 promotion is a direct push by Francisco, so he must be the bypass; nobody else (and no implementing agent) can push. If these features aren't available on the repo's plan, record that in `CONTEXT.md` and rely on §6.3 discipline.

### 6.5 Rollback runbook (established in Phase 2, before anything is production-visible)
1. **Immediate recovery:** Pages dashboard → the previous good deployment → **Rollback** (takes effect in ~1 min; app only — media in R2 is separate).
2. **Then reconcile git:** create a forward `git revert` of the bad change on `web-app`; Claude audits the revert; promote the revert commit via §6.3.
3. **Verify** git and the deployed SHA agree again in the Pages dashboard.
During an emergency, the Pages rollback deliberately makes the deployed SHA differ from the branch tip — that divergence is by design and temporary. The prohibition is leaving it UNRECONCILED: steps 2–3 must follow promptly so git and the deployed site agree again. R2 media has no rollback button — that's what the Phase-6 content freeze and purge runbook are for.

### 6.6 Custom domain (after Gate 5 passes)
Pages project → **Custom domains** → add `app.ehacademy.com` → confirm the DNS record Cloudflare offers to create (same account). HTTPS is automatic. Gate 5b re-checks the live domain. (Attaching earlier is possible only as an explicit recorded decision — §3.6-B.)

## 7. Risks (complete)
1. Media is publicly reachable (already true today); accepted; signed URLs are a post-conference option.
2. Content updates propagate within ~4 h (CDN cache); accepted at launch; conference protected by the Aug 8 R2 freeze; `?v=` pinning deliberately deferred.
3. Previews are public AND guessable (branch alias); accepted (W8); Cloudflare Access available later.
4. Conference Wi-Fi may be poor: throttled-profile testing throughout; the desktop/USB app is the booth backup.
5. Implementer drift: contained by whitelists, stop-and-ask, per-gate audits, the screenshot tripwire, and the promotion model — drift can reach a preview, never production.
6. Divergence from Windows: handled by audited cherry-picks only.
7. Timeline: thin buffer; governed by the §4.9 checkpoint + priority order; desktop web after Gate 3 is the emergency floor.
8. Media-domain indexing not governed by app noindex (§3.6-D residual).
9. Web thumbnails remain bundled fallbacks (W10): cosmetic-only risk if bucket thumbnail art changes post-build; accepted for the conference.
10. §4A is the highest-risk component; mitigated by pure-controller tests, Codex co-audit at Gate 3, and absolute latency targets with a defined amendment path.

## 8. Decisions to append to `DECISIONS.md` on `web-app` (Phase 1)
- **W1:** `web-app` from `v2.3.3`/`89f7f11`; WEB-ONLY; Windows fixes arrive by audited cherry-pick.
- **W2:** Web streams everything from `media.ehacademy.com` via `cdnUrl()`; no downloads/updater/offline claims.
- **W3:** Subtitles from the site bundle; `public/404.html` ensures missing assets 404 (never SPA-fallback HTML 200).
- **W4:** Cloudflare Pages; `web-production` advances only by gate-approved idempotent fast-forward (§6.3) under §6.4 protection; domain after Gate 5; fully public.
- **W5:** Mobile = responsive breakpoints in one codebase; ≤1023 px mobile nav, ≥1024 px desktop nav (iPad landscape = desktop intentionally); ≥1024 px visuals unchanged (≤0.1% same-machine harness diff); 44 px hit-regions under `any-pointer: coarse` with visuals unchanged; full mobile UI pre-conference.
- **W6:** Web media = the §4A committed/pending controller: four outcomes (playing/paused/denied/failed), generation tokens, no speculative loading; desktop Tauri untouched; latency amendment path per §3.6-A.
- **W7:** noindex at launch = app shell only (headers + robots.txt + meta); media-domain indexing is an accepted residual.
- **W8:** Public, guessable Pages previews accepted.
- **W9:** Dependency security: evidence-based non-breaking `npm audit fix` (pre/post full + `--omit=dev` JSONs; no machine paths); remaining advisories recorded post-fix by package/version/reachability/rationale (sharp expected to remain); pinned `@playwright/test` + `npx playwright install chromium` for the harness; §5.6 test-dependency policy (no jsdom without adjudicated exception); dev server never bound to shared networks.
- **W10:** Web thumbnails use bundled fallback covers for the conference (web `fileStatuses` is always empty ⇒ the CDN thumbnail path is never taken); CDN-with-`onError`-fallback recorded as a post-conference option.
- **W11:** Cross-platform SAFETY exceptions (§3.2): `safeStorage`, safe fatal rendering + root Error Boundary, external-link opener isolation, pure course-selection extraction — shared on both platforms; may improve exceptional/error behavior only; normal Tauri behavior verified structurally unchanged (platform-fake tests + `CONTEXT.md` listing). All other web behavior strictly `!isTauri`/responsive-gated.

---
*v1–v5 are retained in the project as adjudication history only — nothing in them is needed to execute this plan. The Phases −1/0/1 prompt v5.1 ships with this doc; prompts for later phases are issued by Claude only after the preceding gate passes. Per the joint Claude+Codex round-5 agreement: no further broad planning cycles — the next meaningful review is Gate 1 against actual code.*
