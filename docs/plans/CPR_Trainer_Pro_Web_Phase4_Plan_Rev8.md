# CPR Trainer Pro — Web Phase-4 Implementation Plan, Rev 8 (ADJUDICATED)

**AUDIENCE: This document addresses exactly ONE implementer — Codex.** It is the adjudicated result of plan-review cycle 4: Rev 6 → Codex's Rev-7 review (8 findings — ALL 8 verified correct against the code and ACCEPTED) → this Claude adjudication, which adopts Rev 7 in full and applies only the §0 corrections (restorations and precision — ZERO design changes). **The architecture is agreed; the remaining deltas are boilerplate preservation.** Implementation remains BLOCKED until Francisco explicitly authorizes this Rev 8. Implement from THIS document alone; if source behavior contradicts it or a decision is materially ambiguous, STOP and report — never improvise (canonical §5.1).

Author: Claude (architect / sole web auditor), adjudicating Codex's Rev 7 · Date: August 4, 2026 · Base: `web-app` @ `b6d905dd57372b9c86e0d96d4412157dc845a86c`. Governing spec: canonical v5.1 §4 Phase 4 items 1–7, §3.2–§3.4, §5.1, §5.4–§5.7; Gate-3 G2/G3; the Rev 2→7 records.

## 0. Adjudication delta

**All 8 Rev-7 findings verified and ACCEPTED**, with code proof: `prefetchWebChapter` exists at `App.tsx:884–887` and is wired ONLY to Sidebar chapter rows (`Sidebar.tsx:442/:445/:448`, each `!isTauri`-gated) — no slideshow-row prefetch API exists, and slideshow loading/retry lives inside forbidden `WebSlideshowMedia.tsx`, so Rev 6's chapter-AND-slide W19 requirement was infeasible and the chapter-only boundary is correct; `boot.tsx:224` wraps the app in `StrictMode`, so coordinator idempotence under dev effect-replay is a real requirement; the three `window.innerWidth` sites exist exactly as cited — `App.tsx:411` (Tauri download-completion effect), `:951` (`selectChapter` WEB path), `:972` (`selectChapter` Tauri path) — one web-gated, two reaching Tauri, which is why "route web behavior through `isMobileWeb`, preserve legacy narrow-Tauri behavior explicitly" is the right instruction; the retired-entry `history.go(-depth)` return fixes the real stale-tombstone-pileup UX defect in Rev 6's normalize-in-place rule; conditionally unmounting the desktop nav tree on mobile follows the existing conditional-Sidebar pattern (`App.tsx:1382`); staged splitting and four-kind Forward coverage are accepted as written.

Rev 8 corrections to Rev 7 (T1–T7; no design changes):

- **T1 (canonical mechanism — FOURTH drop of the same text).** The §3.4 hit-region mechanism is restored: ≥44×44 px via INVISIBLE expansion (pseudo-element/wrapper) under `@media (any-pointer: coarse)` (hybrid laptops report both pointer types), visual glyph sizes unchanged. §9.
- **T2 (implementation precision).** The instructor-card enumeration is restored: `role="button"` (or a visually identical native button), `tabIndex={0}` if role-based, Enter/Space handling, accessible name, focus-visible, zero ordinary-screenshot change. §9.
- **T3 (standing dry-run rule).** Key file:line anchors restored throughout (Rev 7 kept a few, dropped most).
- **T4 (clarity).** Depth labels restored in the transition table.
- **T5 (core reuse rule dropped).** The no-logic-copy rule is restored in §8: the sheet reuses App-owned data and handlers ONLY — `handleItemClick` (origin-tagged), `switchCourse` (`App.tsx:975`), `switchSlideshow` (`:1074`), `selectChapter` (`:937`), `selectSlide` (`:1086`), `selectManual` (`:475`), Continuous Play, Offline-Training callback, Guide callback — and copies NO media, download, retry, progress, or selection logic.
- **T6 (test feasibility nuance).** Playwright cannot run real Tauri; the "narrow Tauri gets no mobile behavior" browser test uses the repo's established PLATFORM-FAKE pattern (canonical §3.2 acceptance — inject the Tauri marker before load) where feasible; otherwise the §15 Tauri structural inventory + manual smoke carries that assertion alone. §14 item 2 annotated.
- **T7 (small restorations).** "No jsdom" regains its stop-and-ask clause (a DOM-test need is adjudicated, never silently added); the mute button explicitly remains on mobile; W19's identity as the ONLY permitted speculative-media behavior is restated.

## 1. Objective and priority

Implement the mobile web foundation while preserving: Gate-3 playback-controller correctness; normal desktop web appearance/behavior ≥1024 px; existing Tauri appearance/behavior at every width; current catalog, progress, retry, download, slideshow, and manual semantics; a single non-force push to `web-app`; the prohibition against modifying `web-production`. Priority (canonical §4.9): playback and history correctness > mobile navigation > manual/slideshow reachability > accessibility > performance and polish. No acceptance gate may be removed to save time.

## 2. Clean preflight

Use a new clean checkout, not the legacy workspace or a detached audit clone. Before editing:

1. Verify the remote is `kikofrn/cpr-trainer-pro` (either capitalization).
2. Fetch and prune `web-app` and `web-production`.
3. `git checkout web-app`; require empty porcelain.
4. Require `HEAD` = `origin/web-app` = `origin/web-production` = `b6d905dd57372b9c86e0d96d4412157dc845a86c`.
5. Run `npm ci` → `npm run lint` (`tsc --noEmit`) → full Vitest → production build → default Playwright. Gate 3 recorded 63 Vitest / 17 Playwright; RECORD actual counts.
6. Measure the main-entry gzip with the same procedure as `CONTEXT.md` (184,970 B recorded there).
7. Verify Tailwind has no breakpoint override (`index.css:115` `@theme` = fonts/colors only); `lg` = 1024 px.
8. Inventory the three existing `window.innerWidth` checks: `App.tsx:411` (Tauri effect), `:951` (web `selectChapter`), `:972` (Tauri `selectChapter`).
9. STOP AND REPORT any SHA, baseline, test, build, bundle, or breakpoint discrepancy.

## 3. Authorized scope

**Existing source files:** `src/App.tsx` · `src/components/HeaderNav.tsx` · `src/components/Sidebar.tsx` · `src/components/VideoPlayer.tsx` · `src/components/HowToGuideModal.tsx` · `src/index.css` · `index.html` · `playwright.config.ts`.

How-To edits are LIMITED to: dialog naming/semantics; accessible close name; keyboard activation of the existing clickable cards (`HowToGuideModal.tsx:104`, `:127` region); `focus-visible` treatment; one nonvisual exit-completion callback (always-mounted with internal `AnimatePresence`, `:25–35`). Do NOT add a second Escape handler to How-To — mobile Escape is overlay-manager-owned. No copy, responsive-layout, or ordinary visual change; its 375 px redesign remains Phase 5.

`index.html` may change ONLY to `width=device-width, initial-scale=1.0, viewport-fit=cover` (`index.html:6`). `playwright.config.ts` may change ONLY to add the Phase-4 spec to the app project `testMatch` (`playwright.config.ts:44–47`).

**Records:** canonical v5.1 plan (Phase-4 checkboxes only); Phase-3 Rev2.1 plan (Push-2 boxes `:254–255` only); `CONTEXT.md`; `DECISIONS.md`.

**New files:** mobile header/bottom-navigation/sheet/shell components; mobile overlay host; persistent web coordinator/hook; pure `src/course-selection-model.ts` + `src/mobile-history.ts` + Vitest specs; `tests/e2e/phase4.spec.ts` + helpers; `docs/plans/CPR_Trainer_Pro_Web_Phase4_Plan_Rev8.md`.

**Forbidden:** dependencies/lockfile; `src-tauri/`; `src/chapters.ts`; `media-selection-controller.ts`; `WebSlideshowMedia.tsx`; playback-controller restructuring; `DownloadAppModal.tsx`; media/PDF/image/font/binary changes; workflow changes; storage additions; speculative media behavior beyond existing W19 (which remains the ONLY permitted speculative-media path); ordinary ≥1024 px visual changes; `git add -A`; force pushes; any push to `web-production`.

## 4. First records commit

Before implementation code: (1) this Rev 8 verbatim as `docs/plans/CPR_Trainer_Pro_Web_Phase4_Plan_Rev8.md`; (2) tick ONLY the two Push-2 boxes (`Phase-3 Rev2.1:254–255`); (3) APPEND a dated `CONTEXT.md` closure — Push 2, both green checks, hosted enforcing-CSP smoke, Gate 3, §6.3 promotion, approved SHA `b6d905d` — never rewriting history; (4) record preflight SHAs, counts, gzip, breakpoint confirmation. Suggested: `web(phase-4): record governing mobile foundation plan`.

## 5. Responsive and coordinator architecture

### 5.1 Web-only gate
Derive `isMobileWeb` SYNCHRONOUSLY on first render — `!isTauri && matchMedia('(max-width: 1023px)').matches` (the `&&` short-circuit keeps Tauri from ever touching `matchMedia`) — avoiding a mobile first-paint flash of desktop navigation. Every mobile layout/behavior uses runtime `isMobileWeb` conditional rendering/classes, or a selector scoped beneath the web-only root class combined with the width query. NO bare `max-lg:`/width-only CSS in shared components where it could affect a narrow Tauri window. Pass `isMobileWeb` to shared components (e.g., `VideoPlayer`) when their rendered structure changes.

### 5.2 Presentation ownership
Mobile web: mount the mobile shell; do NOT render the desktop HeaderNav or Sidebar tree (follows the existing conditional pattern, `App.tsx:1382`). Desktop web: render existing HeaderNav + Sidebar. Tauri: always the existing tree. `showSidebar` and selector states stay App-owned so they survive desktop-tree unmounting; media/player surfaces stay mounted as required to preserve content.

### 5.3 Coordinator phases
The persistent web coordinator (mounted for the App's entire web lifetime; Tauri never constructs it) has explicit phases: `desktop-inactive` · `boot-normalizing` · `mobile-active` · `mobile-exiting` · `stale-return`. Fresh desktop boot stays `desktop-inactive` and does NOT alter `history.state`; fresh mobile boot establishes one managed base via `replaceState`; entering mobile from desktop creates a new session; leaving mobile retires the session; stale state found at boot is normalized even at desktop width; mobile presentation unmounts only after the exit transaction settles.

### 5.4 StrictMode idempotence
`boot.tsx:224` mounts through `StrictMode`, so: construct the coordinator once (ref/lazy initializer, never inside a listener effect); session ID, root entry, monotonic counter, and ledger survive effect replay; listener effects only attach/detach; boot normalization is one-shot-guarded; every timeout, dynamic import, history completion, and exit callback carries a lifecycle GENERATION; cleanup invalidates stale generations and clears timers; a replayed initialization produces NO additional `replaceState`/`pushState`/`history.go`. A pure injected-history test covers duplicate boot/setup/cleanup.

### 5.5 Breakpoint movement
To desktop: hide mobile presentation immediately → cancel mobile presentation work → ONE transaction to the managed root with teardown suppressed → replace the root with neutral desktop state → retire the session → content continues in desktop layout. Back to mobile: wait for any exit/stale transaction → fresh mobile base at the current safe root → push exactly one player entry if content is active, else stay base. Rapid seam changes update ONE desired-mode value — never concurrent transactions; reconcile to the latest width after settlement. Repeated crossings (incl. tablet rotation 768×1024 ↔ 1024×768) are idempotent.

## 6. Activation origin and desktop-state isolation

Activations carry `origin: 'desktop' | 'mobile'`; history restorations use `origin:'mobile', source:'history', playbackIntent:false`. Desktop-origin-only effects: `setShowSidebar(true)` and selector-flag closes inside `handleItemClick` (`App.tsx:555`), `selectManual` (`:486`), `switchCourse` (`:988`), `switchSlideshow` (`:1083`), plus other desktop presentation mutations. Route the existing width-dependent WEB behavior (`:951`) through `isMobileWeb`; PRESERVE the legacy narrow-Tauri behavior at `:411`/`:972` explicitly rather than accidentally changing it. Required cases: mobile activation → desktop leaves the sidebar collapsed; a deliberately opened desktop sidebar survives desktop → mobile → desktop; repeated seam movement preserves content; narrow Tauri retains existing layout and behavior.

## 7. Course-selection model (`src/course-selection-model.ts`)

One pure ID-driven resolver used by desktop HeaderNav and mobile navigation, replacing the hard-coded Start-button logic (`HeaderNav.tsx:250–262` CPR, `:383–395` FA — `findIndex` −1 risk + literal slideshow indexes `5`/`4`/`0`/`1`).

| Family | Pediatric | VA | Target |
|---|---|---|---|
| CPR | No | No | Slideshow `cpr-aed-course` |
| CPR | No | Yes | Video `cpr-aed` |
| CPR | Yes | No | Slideshow `pediatric-cpr-aed-course` |
| CPR | Yes | Yes | Video `pediatric-cpr-aed` (catalog `isComingSoon` today) |
| First Aid | No | No | Slideshow `first-aid-course` |
| First Aid | No | Yes | Video `first-aid` |
| First Aid | Yes | No | Slideshow `pediatric-first-aid-course` |
| First Aid | Yes | Yes | Video `pediatric-first-aid` (catalog `isComingSoon` today) |

**Output:** family; target kind; stable target ID; thumbnail/display variant; availability; user-facing unavailable reason. **Rules:** resolve by ID only; return NO catalog index — App re-finds the index immediately before dispatch and never dispatches `-1`; missing IDs never fall back; Coming-Soon from catalog data (`HeaderNav.tsx:77–81` pattern); unavailable actions disabled with the existing reason ("To launch the Pediatric course, disable the Virtual Assistant."); Spanish slideshows hidden; inputs dependency-injected, never mutated; toggles stay App-owned memory (`App.tsx:285–288`, no storage); `lastCprView`/`lastFaView` (`:366–367`) remain separate SURFACE memory incl. the desktop return-from-manual shortcut (`HeaderNav.tsx:141–147`); desktop markup/wording/animation/classes visually identical ≥1024 px.

## 8. Mobile shell and navigation

### 8.1 Viewport
Tauri keeps `h-screen` (`App.tsx:1306`); web gets `.web-app-shell { height: 100vh; height: 100dvh; }`. `env(safe-area-inset-*, 0px)` only on the header, relevant content/control edges, sheet scroll area, and bottom navigation — no root-wide or duplicated padding. New animations: transform/opacity, ≤250 ms, nonspatial reduced-motion path.

### 8.2 Mobile header
Brand/Home; current section title; Settings; the existing offline-download action when `showDownloadAffordance` is true (`App.tsx:527–532` — computed once, shared value and callback). At base the brand renders NONINTERACTIVELY. With player content active it becomes an accessible "Return to menu" button routed through the managed close (§10). The header is inert while any sheet-class layer is open, and unavailable in native fullscreen (fullscreen exits first; content closes on the next explicit Back/Home).

### 8.3 Bottom navigation
CPR & AED · First Aid · Manuals · Certs — native `<nav>`/`<button>`s with accessible names; for sheet destinations `aria-controls` references the sheet panel and `aria-expanded=true` only for the currently open matching view; `aria-current` represents the current content/view. Certs activates the existing Send Certs surface (entry mirrors `HeaderNav.tsx:514`). Re-tapping is a no-op ONLY when that exact sheet view is already topmost; tapping the active content's family opens its chapter/TOC sheet; switching views uses `replaceState`; Settings stays a header action; base with no content shows no false `aria-current`; Settings preserves a valid underlying content highlight or none.

### 8.4 Sheet content
Views: CPR; First Aid; Manuals; Settings. CPR/FA: chapter/slide lists ONLY when the represented target matches active/displayed content — otherwise preview + Start/Open; Coming-Soon/missing targets show their reason, never a stale list. Manuals: TOC only when the previewed manual ID matches the active manual, else preview + Open. Settings: Continuous Play; "Offline Training?" when eligible; Guide; both instructor-onboarding links. Only the active sheet view is mounted.

**Reuse rule (T5 restored):** the sheet reuses App-owned data and handlers ONLY — `handleItemClick` (origin-tagged), `switchCourse` (`App.tsx:975`), `switchSlideshow` (`:1074`), `selectChapter` (`:937`), `selectSlide` (`:1086`), `selectManual` (`:475`), Continuous Play, the Offline-Training callback, the Guide callback — and copies NO media, download, retry, progress, or selection logic into sheet components.

### 8.5 Exact W19 boundary (Codex Rev-7 finding — chapter-only, verified)
W19 metadata prefetch applies ONLY to web video chapter rows — the only existing Gate-3 API (`prefetchWebChapter`, `App.tsx:884–887`; Sidebar wiring `Sidebar.tsx:442/:445/:448`). Chapter rows: reuse the existing App-owned `prefetchWebChapter` path; trigger only from exact-row pointer enter, touch start, or keyboard focus; newest-wins; no adjacent/next prediction; selecting the warmed row uses the existing promotion; the existing controller owns cancellation; `media-selection-controller.ts` untouched. Chapter-row UI: match `webPendingChapter`/`webFailedChapter` by course + chapter ID; Loading only on the matching pending row; Failed/Retry only on the matching failed row; Retry calls the existing App-owned callback. Slideshow rows: NO prefetch, NO claimed per-row pending/failed state; existing `selectSlide`; loading/retry/offline/Resume stays inside the existing slideshow player path. Manual rows: no speculative prefetch; existing selection/outline/progress state.

## 9. Overlay ownership, precedence, and accessibility

One mobile overlay host owns: presented stack; focus trap; trigger restoration; inertness/AT hiding; body locking; Escape/backdrop; exit completion; history-entry association. The coordinator owns semantic/browser state — never conflate lifetimes.

**Layers:** the player is not an ARIA modal. Sheet + bottom rail form ONE composite modal layer; the trap cycles through BOTH (keyboard view switching works); main content and mobile header are inert while open; if the rail cannot live inside the dialog's real DOM container, omit `aria-modal` — never publish inaccurate semantics. Download/Guide stack above navigation; Guide also stacks directly above Send Certs (`SendCertsPage.tsx:86`); Download opens directly from base via the header affordance (a depth-1 modal with no sheet beneath — inert then covers everything else, including the bottom navigation and header); only ONE top modal; ONLY the top layer is interactive and exposed to assistive technology; underlying layers stay mounted but inert, preserving view/scroll.

**Close routing:** on mobile, pass the managed close into Download's existing `onClose` (its internal Escape listener, `DownloadAppModal.tsx:40–46`, then reaches managed history without editing the file) and the managed setter/callback into How-To (backdrop `:30`). The manager owns Escape for navigation and How-To. Duplicates coalesce in the transaction.

**Body and focus:** capture body scroll position + modified inline styles exactly once on first sheet-class open; restore exactly once after the last presented layer exits. Download: let its internal restoration run (`:37/:47`), then VALIDATE after exit completion — if focus is invalid, inert, disconnected, or outside the destination layer, apply the recorded trigger or destination heading. How-To/navigation: manager restores directly from entry-keyed records.

**Exit lifecycle:** history is semantic truth; an outgoing Framer layer may linger. During exit: noninteractive presentation barrier; destination content inert; focus on a neutral manager sentinel; outgoing layer pointer-inert + AT-hidden; body unlock + destination focus only after exit completion; reduced-motion exits complete immediately; a second native Back fast-forwards/cancels the old transition and reconciles the newest target; never two visible or interactive outgoing layers. App-owned `AnimatePresence` completion for Download (`App.tsx:1307–1311`); the authorized callback for How-To.

**Immersive precedence + keyboard isolation:** while any sheet-class layer is open — suspend the fade timer (`App.tsx:1222–1268`); force UI-visible; keep the rail visible; block underlying stage activity from changing visibility; preserve playback unless explicitly paused; DISABLE the App-level Space/Arrow shortcuts (the global keydown branches, `App.tsx` ~1150–1195, that call `selectChapter`/`selectSlide`/`toggleSlideshowPlay` — `inert` does not block window-level keydown); Escape belongs to the top overlay unless native fullscreen is active. Role-based How-To/Sidebar controls `preventDefault` Space and avoid double activation.

**Accessibility:** accessible names on every new icon-only control; visible `focus-visible`; edition toggles with switch semantics + `aria-checked`; reduced motion. **Hit regions (T1 — canonical §3.4 in full):** ≥44×44 px via INVISIBLE expansion (pseudo-element/wrapper) under `@media (any-pointer: coarse)` (hybrid laptops report both pointer types), visual glyph sizes unchanged, no expanded-edge overlap (each expanded edge fires its own control's handler, never a neighbor's) — applied to Phase-4-exposed controls in whitelisted/new components; slideshow/manual entry+close targets in non-whitelisted files are MEASURED (the VideoPlayer pattern p-3 + 24 px = 48 px, `VideoPlayer.tsx:107–109`, suggests compliance) — below 44 px and unfixable from an authorized file = STOP-AND-ASK. **Instructor cards (T2)** (`Sidebar.tsx:577–616`): `role="button"` or a visually identical native button; `tabIndex={0}` if role-based; Enter/Space; accessible name; focus-visible; zero ordinary-screenshot change. Manual/slideshow modernization stays Phase 5.

## 10. Managed player close

One App-owned mobile close route for EVERY path ending active content: video close incl. Coming-Soon (`VideoPlayer.tsx:72`); slideshow close; manual close; manual ErrorBoundary reset; Send Certs return; mobile Home; browser Back from player; exceptional state clears. (All reachable via App-passed props — no forbidden-file edits.) Behavior: (1) native fullscreen → exit fullscreen only; (2) else ONE transaction to the player's parent/base; (3) exact matching pop → existing teardown once; (4) mismatch → reconcile, no unrelated teardown; (5) timeout at source → retain the player. Desktop and Tauri keep existing immediate close paths.

## 11. History model (`src/mobile-history.ts` + coordinator)

### 11.1 State
```ts
type EhContent =
  | { kind: 'video'; targetId: string; itemId: string }      // course + chapter ID ("cpr-1"-style — verified)
  | { kind: 'slideshow'; targetId: string; itemId: string }  // slideshow + slide ID ("slide-N" — verified)
  | { kind: 'manual'; targetId: string }
  | { kind: 'certs' };

type EhHistoryState = {
  ehOverlay?: 'sheet' | 'player';
  ehSession: string; ehEntry: number; ehRoot: number; ehParent?: number;
  ehDepth: 0 | 1 | 2 | 3;
  ehKind?: 'player' | 'nav' | 'download' | 'guide';
  ehView?: 'cpr' | 'first-aid' | 'manuals' | 'settings';
  ehContent?: EhContent;
  ehRetired?: true;
};
```
A retired tombstone has no overlay/kind/view/content; it retains validated session/root/entry/depth ONLY for the safe root-return; it never renders content. NEVER stored: playback time, playing state, volume, download state, PDF page, controller internals. Preserve unrelated state only when it is a plain record — never spread primitives or arrays. Max managed depth 3.

### 11.2 Ledger
Per-session in-memory map keyed by `ehEntry`: unique monotonic IDs per pushed slot; `replaceState` keeps the ID and updates the descriptor; push-after-Back purges abandoned descendants; unknown same-session IDs are invalid; parent/root/depth/kind relationships must match; reconciliation reconstructs the complete root→target chain (never assumes single-step movement); intentionally lost on reload.

### 11.3 Transitions
| Current | Action | Effect |
|---|---|---|
| base | open navigation/Settings | push `sheet/nav`, depth 1 |
| base | open Download from header | push `sheet/download`, depth 1 |
| base | start content/Certs | push `player` + descriptor, depth 1 |
| base-origin sheet | start content | REPLACE sheet slot with player descriptor |
| player | change course/chapter/manual/slide/Certs (incl. continuous-play progression) | REPLACE player descriptor; no push |
| player | open navigation/Settings | push `sheet/nav`, depth 2 |
| Send Certs player | open Guide | push `sheet/guide`, parent = player, depth 2 |
| sheet over player | select content | accept target; ONE transaction to parent; replace parent descriptor — never re-activating the old target |
| navigation sheet | switch view | replace `ehView`; no push |
| navigation sheet | open Download/Guide | push distinct modal (depth ≤3) |
| top modal | close/Back/Escape/backdrop | ONE transaction to its recorded parent |
| player | close/Back/Home | ONE transaction to base + teardown once |
| base | Back | browser default — leaves the site normally |

A later load failure after a sheet-over-player selection stays the normal Gate-3 failed-request UI; history never reverts to the previous target.

### 11.4 Transaction
ONE programmatic navigation at a time; records source, exact expected target, distance, reason, optional replacement descriptor, preserve/teardown policy, start time, lifecycle generation. Mutating controls coalesce/disable; native Back/Forward remains possible; every pop reconciles actual `event.state`; exact match completes once; mismatch cancels intended side effects; ~2 s timeout (still at source → retain source UI; state changed → reconcile); never an automatic retry-Back; `popstate` never pushes; invalid normalization may `replaceState`; ONE guarded stale-return traversal is permitted for a validated retired entry (never recursive).

### 11.5 Same-session Forward
Valid ledger entry → reconstruct its chain: video → restore course/chapter by ID, PAUSED; slideshow → restore slideshow/slide by ID, PAUSED; manual → restore by ID (no page position); certs → restore Send Certs; navigation → reconstruct valid parent content, then open the recorded view; download/guide → reconstruct the parent chain, then the modal; already-matching content keeps its playback state untouched; missing IDs normalize to base; never a fallback item; never autoplay.

### 11.6 Retired / old-session Forward (Codex Rev-7 finding — root-return, accepted)
Forward into a structurally valid retired/old-session state: render safe base/desktop presentation immediately; activate/tear down NO media; start one guarded `history.go(-ehDepth)` to the recorded root; remain neutral at the root; if the recorded distance/root cannot be trusted, replace ONLY the current entry with neutral base and traverse nothing; a stale-return never recursively starts another. This keeps normal Back-to-leave from the real root and prevents stale entries becoming extra apparent pages.

### 11.7 Refresh
Read prior metadata before creating the new session → render base immediately → replace the top with a retired tombstone retaining validated root distance → if depth 1–3 valid, ONE guarded traversal to the root → establish fresh mobile base (mobile width) or neutral desktop state (desktop width) → never restore content or overlays → overlay actions unavailable until settled → old Forward entries follow §11.6. Acceptance: refresh restores nothing; Back from normalized base leaves normally; no stale entry starts media.

### 11.8 Breakpoint exit and retired branches
After mobile → desktop the coordinator remembers the neutral root; Forward into an old mobile branch is rejected back to that root and never changes desktop content; re-entering mobile happens only from a settled safe root, then a new session (+ one player entry if content is active).

## 12. Mobile video foundation (canonical item 5 in full)

The two-element Gate-3 controller is untouched. Below 1024 px on mobile web only: portrait full-width 16:9; `object-contain` — never crop; landscape edge-to-edge with chrome overlay; primary row Previous · Play/Pause · Next at the bottom in the THUMB ZONE; utility row Mute · Rate · CC · Fullscreen (mute stays available); hover volume slider hidden (`VideoPlayer.tsx:367–382`); desktop single-row layout (`:314–427`) unchanged; no overlap or horizontal scroll at 375 px.

**Progress:** a labelled native `<input type="range">` replaces the click strip (`:296–312`) on mobile: keyboard-operable; ≥44 px interaction height (thin visual track allowed); disabled without valid seekable duration; updates the active media element + displayed progress; stops stage propagation. Desktop unchanged.

**Subtitles:** `bottom = controls stack height + safe-area bottom inset + spacing` — never the fixed `bottom-28` (`:234`) on mobile; verify width at 375 px, line height, multiline wrapping, no collision, no crop in either orientation.

**Tap:** one canonical stage activation; pointer handlers classify but never toggle separately; touch-derived synthetic `mousemove`/`click` never causes a second reveal (container click listeners AND the window mousemove listener, `App.tsx:1254`); controls stop propagation; paused/loading/failed/Resume-required/ended keep controls visible (`App.tsx:1236–1239` anchors the pause branch); playing keeps the 3 s timer when no sheet is open; desktop mouse behavior unchanged.

**Immersive:** extend the existing `fullscreenchange` listener (`App.tsx:1208–1218`; manual fullscreens `document.documentElement`, `ManualFlipbook.tsx:352`). `immersive = native fullscreen OR actively playing with UI hidden`, applied to the header, bottom nav, video controls, and inline slideshow controls — except an open sheet keeps its rail visible. First Back/Escape exits fullscreen; the next Back/Home closes content.

## 13. Performance

Revalidate: anchor 175,202 B gzip; cap 192,722 B; main entry ≈184,970 B; margin ≈7,752 B. How-To is already lazy (`App.tsx:22` + `Suspense` `:1725`) and already excluded from the figure. Requirements: same gzip procedure before/after; cap must pass; only the active sheet view mounted; the desktop Sidebar/HeaderNav tree NOT mounted on mobile; no dependency; no new speculative media; record initial + first-use transfer.

If the cap fails, STAGED splitting: (1) mobile sheet/overlay presentation first; (2) if still over, mobile-only history planner/presentation code; (3) keep a minimal synchronous bootstrap in the main entry (synchronous viewport ownership; loading/disabled states; no actionable mobile controls before history support is ready); (4) never split the shared course resolver (desktop consumes it); (5) desktop ≥1024 px requests NO mobile chunk; (6) if the budget still fails after authorized splitting, STOP AND ASK. Code prefetch (distinct from W19 media prefetch): pointer-intent preload where practical; idle prefetch only in mobile mode with Save-Data off and connection better than 2g (absent info → none). Record main gzip, each chunk, desktop boot requests, mobile first-open latency, total mobile first-use JS.

## 14. Verification

**Pure Vitest (NO jsdom — a DOM-test need is a STOP-AND-ASK, never a silent addition):** eight resolver mappings; reordered/missing catalogs; Coming-Soon; surface-memory separation; input immutability; desktop/mobile equivalence; state parsing + tombstones; unique IDs; ledger validation; branch pruning; content descriptors for all four kinds; descriptor replacement without push; full-chain reconstruction; transactions (match/mismatch/coalescing/timeout); retired stale-return; refresh; breakpoint + rapid-width changes; StrictMode duplicate bootstrap/setup/cleanup; lifecycle-generation rejection; old-session rejection. Record the final count.

**Playwright** (app project; strict error discipline; grouped for CI time; no sleeps/`networkidle`/forced actions/broad allowlists; W19 assertions use EXACT candidate URLs so active-media traffic is never mistaken for speculation):
1. 1023 mobile / 1024 desktop ownership.
2. Narrow-width platform-fake Tauri (the repo's established §3.2 pattern — inject the Tauri marker before load) receives no mobile layout/history/pointer behavior; if the fake proves infeasible here, the §15 Tauri structural inventory + smoke carries this assertion alone (T6).
3. No desktop HeaderNav/Sidebar tree mounted on mobile.
4. Course-selection + Coming-Soon parity.
5. Manuals, Certs, Settings, Download, Guide, onboarding reachability.
6. Preview vs active list/TOC.
7. Chapter-only W19 prefetch on exact intent; 8. no candidate request without intent; 9. chapter pending/Failed/Retry rows; 10. no new slideshow-row prefetch.
11. Composite trap incl. the rail; 12. inertness, body lock, backdrop, Escape, restoration.
13. Sheet precedence over immersive hiding; 14. Space/Arrow isolation.
15. Download/Guide stacking; 16. base → Download; 17. Send Certs → Guide → Send Certs.
18. Exit barrier + rapid repeated Back.
19. DIRECT ENTRY establishes one base, no overlay.
20. Entry ID/kind/depth/parent/session/view/content assertions.
21. base→sheet→player; 22. player→sheet→player without reset (§4A rule-12 no-op included); 23. descriptor replacement without history growth; 24. pending/failed selection never restores the old target.
25. Back → base → Forward restoration: video PAUSED, slideshow PAUSED, manual, Certs.
26. Full-stack Back/Forward incl. repeated Back; 27. refresh from player/sheet/modal; 28. retired/old Forward returns to the real root.
29. Programmatic-close/native-Back race; 30. seam + rapid-resize idempotence; 31. both sidebar-preservation cases; 32. all §10 close routes.
33. Tap + synthetic-event suppression; 34. auto-hide + exceptional visible states; 35. two-row controls, range seeking, subtitles, immersive; 36. fullscreen two-step Back where supported.
37. Keyboard cards + `aria-checked` + focus-visible; 38. coarse-pointer edges/overlap; 39. reduced motion; 40. if split: desktop makes no mobile-chunk request; deterministic mobile loading.

## 15. Full battery and visual gate

Clean install → lint/typecheck → full Vitest → production build → bundle measurement → default Playwright → the 12-viewport matrix (375×667, 390×844, 430×932, 768×1024, 820×1180, 667×375, 844×390, 932×430, 1024×768, 1180×820, 1023×768, 1440×900; at each: representative course, manual, slideshow, navigation, Settings/Download reachability, no horizontal overflow) → explicit 1023/1024 + rotation checks → full history walkthrough → pointer edge/overlap sweep → NARROW and normal Tauri smoke + structural inventory (no mobile shell/history/pointer/overlay behavior at any width) → raw-width audit (web behavior uses the shared responsive source; `:411`/`:972` Tauri behavior preserved) → drift checks (forbidden files, dependencies, lockfile, storage, media loading, workflows; no machine paths or evidence binaries; `git diff --check`; named-file staging).

**Immediately before visual comparison (W15):** recapture `c4bf8a82be6acb2c3cc7c04d6351386f1701a2c6`; byte-match the archived Phase-3 reference hashes; then compare — seven surfaces ≤0.1%; Coming Soon ≤16 differing pixels, channel delta ≤1; How-To ZERO ordinary visual difference.

## 16. Android Gate-4 check (Francisco)

Portrait + landscape; display cutout + safe areas; URL-bar resizing; all four destinations; target preview + chapter selection; sheet rail usable while underlying media plays; tap-to-toggle; control reachability; manual/slideshow entry; base→sheet→player; player→sheet→player; Send Certs → Guide; stacked-modal Back; video/slideshow Forward restoration WITHOUT autoplay; manual/Certs Forward restoration; hardware Back; browser Forward where exposed; refresh at player, sheet, and modal; native-fullscreen two-step Back; mobile first-open latency if split; no owned overlay skipped by Back.

## 17. Commits, records, push, and Gate 4

Suggested commits: (1) `web(phase-4): record governing mobile foundation plan` · (2) `web(phase-4): centralize course selection` · (3) `web(phase-4): add mobile shell and managed history` · (4) `web(phase-4): adapt video and overlay accessibility` · (5) `web(phase-4): add responsive browser coverage` · (6) `web(phase-4): record verification and gate-4 handoff`.

Before pushing: tick canonical Phase-4 items 1–7; append W20+ `DECISIONS.md` entries (resolver; activation origin; StrictMode-safe coordinator; web-only style gate; history descriptors + ledger; retired-entry return; refresh/breakpoint normalization; overlay/presentation lifecycle; Settings/onboarding placement; exact W19 chapter-only boundary; immersive precedence; viewport meta; conditional splitting/prefetch if used); update `CONTEXT.md` (counts, file references, bundle data, viewport results, screenshot percentages, seam evidence, Tauri smoke, accepted limitations); stage named files only; exactly ONE non-force push to `web-app`; Web App CI + gitleaks at that SHA; a needed second push = STOP-AND-ASK; never touch `web-production`.

**Gate 4:** Claude performs the sole independent audit — diff-to-plan mapping; independent battery; reference revalidation + screenshot comparison; responsive matrix; seam + Tauri checks; selection-duplication audit; history/retired-entry walkthrough; bundle verification; W19 boundary audit; accessibility spot-check. Francisco performs the §16 real-Android check. Promotion only after the written verdict names the approved SHA. Codex never touches `web-production`.
