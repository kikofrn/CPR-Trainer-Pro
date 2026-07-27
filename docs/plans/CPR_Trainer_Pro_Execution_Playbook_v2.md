# CPR Trainer Pro: Execution Playbook v2 (Fable + Gemini Workflow)

Prepared July 26, 2026. Supersedes v1. Governs the execution of:
1. CPR_Trainer_Pro_Fix_and_Update_System_Plan_v3.md
2. CPR_Trainer_Pro_App_Thumbnails_Plan_v2.md

Changes from v1: scope narrowed to the Windows release (see Scope below), Phase 3 now consumes the verified pediatric deck table inside plan v3 instead of requiring an external listing, a bucket hygiene task added for Francisco, and Phase 6 gates adjusted to Windows.

## Scope

This release targets the Windows app on the experiment-3.1 branch. The macOS build lives on separate mac-version branches and receives its own port plan after this release; iOS likewise. CI still builds all configured targets from this branch as a compilation check. Anything in the plan documents describing macOS or iOS shipping with this release is superseded by this paragraph. External advice items that do not apply to this app (Apple Watch hardware testing, database migration gates) are intentionally excluded; their applicable analogs (snapshot schema versioning, upgrade in place testing) are in Phase 6.

Roles: Fable (Claude) is architect and auditor. Gemini (Antigravity) is the implementer. Francisco is the gatekeeper: no phase begins until he starts it, and no phase is done until its gate passes. Do not place the approval word in any repository file or in any prompt to Gemini; it is a chat protocol only.

---

## Standing rules for every Gemini session

Open every Gemini working session with this preamble, then the phase prompt:

> You are implementing a planned change to the CPR-Trainer-Pro repository. Before doing anything, read CONTEXT.md, DECISIONS.md, and the plan document referenced in this prompt. Rules for this session: work only within the scope of the phase described below; produce minimal diffs; do not reformat, restructure, or rewrite any code outside the named files; do not upgrade dependencies unless the phase says so; do not mix refactoring with the feature work. When you finish, produce a verification report containing: every command you ran, the actual output or output tail of each, every failure encountered and how it was resolved, a list of every file changed, each acceptance criterion for the phase with an explicit pass or fail, and any unresolved concerns. Do not claim the phase is complete unless every acceptance criterion shows pass with evidence.

Never accept "tests passed" without the output shown.

---

## Phase 0: Setup and plan critique (no code changes)

**Gemini prompt 0.1 (setup):**

> Create a new branch named experiment-3.1 from the tip of experiment-3.0. Tag the experiment-3.0 tip as pre-3.1-baseline. Then create two files at the repository root. CONTEXT.md must contain: the stack summary (Tauri 2, Rust backend, React 19, Vite; this branch targets the Windows release; macOS lives on separate branches and is ported later; a separate native iOS app exists on other branches); the statement that the Cloudflare R2 bucket served at media.ehacademy.com is the single source of truth for all media content and that chapters.ts must always match it, enforced at build time by the reconciliation tooling; the folder path conventions in src/chapters.ts; the rule that course identity is by id string, never by array index, in all new code; the verification commands (npx tsc --noEmit, npm run build, node scripts/verify-media-urls.mjs); and the rule that diffs stay minimal and unrelated code is never touched. DECISIONS.md must contain dated entries for: bucket is source of truth enforced at build time, not runtime; update detection is etag based via a Cloudflare Worker manifest endpoint at /api/manifest; update triggered downloads use version pinned URLs to defeat CDN cache staleness; course structure remains hardcoded in chapters.ts and is never replaced at runtime; thumbnails refresh silently without a user prompt; the pediatric slideshow courses are live and only the two pediatric Virtual Assistant courses are coming soon; this release is Windows only with macOS and iOS ported afterward. Commit these two files. Change no other files.

**Gemini prompt 0.2 (plan critique, still no code):**

> Read CPR_Trainer_Pro_Fix_and_Update_System_Plan_v3.md and CPR_Trainer_Pro_App_Thumbnails_Plan_v2.md in full, then review both against the actual repository on branch experiment-3.1. Identify: incorrect assumptions about the code, missing dependencies, conflicts with the existing architecture, unnecessary complexity, risks the plans do not address, and any steps you believe should change, with file and line references for every claim. Do not edit any code. Do not begin implementing. Output only the critique.

**STOP: Fable Audit 1.** Francisco pastes Gemini's critique to Fable. Fable adjudicates every point (accept, reject, or amend) and issues plan amendments if warranted. Implementation begins only after adjudication.

Gate: branch and tag exist, both spec files committed, critique delivered, adjudication complete.

Bucket side prerequisites: completed July 26. The desktop.ini files were deleted from both pediatric folders (probe verified) and the slide 16 filename was confirmed and probe verified, so the plan v3 deck table is final. The update system decision is locked: Option 3, the Cloudflare Worker manifest endpoint.

---

## Phase 1: Core audit fixes (Plan v3, Part A items A1, A3, A4, A5)

**Gemini prompt 1:**

> Implement Part A of CPR_Trainer_Pro_Fix_and_Update_System_Plan_v3.md, items A1, A3, A4, and A5 only, on branch experiment-3.1, honoring any amendments from the adjudication. Do not touch the pediatric CPR chapter list yet; that is Phase 3. Specifics: remove fetchRemoteManifest, subscribeToManifest, the listeners array, and the App.tsx subscription effect per A5, which also resolves A1; any future re-render-on-manifest mechanism must use a dedicated counter state and never touch mediaReady. For A3, rename the placeholder course id pediatric to pediatric-first-aid, add the pediatric-cpr-aed placeholder, and convert the CPR and FA active checks and handleItemClick routing in src/App.tsx from hardcoded indexes to id based lookups; update the download manager filters to the real ids. For A4, rewrite scripts/verify-media-urls.mjs per the plan: import structure from src/chapters.ts, target https://media.ehacademy.com/ with per segment encoding matching src/media-resolver.ts, send a browser User-Agent and Range bytes 0-0, accept 200 and 206, exit nonzero on failure. Acceptance criteria: npx tsc --noEmit clean; npm run build succeeds; node scripts/verify-media-urls.mjs passes for all content except the 14 pediatric CPR entries awaiting Phase 3, which must appear by name in its output; manual smoke steps performed and described: launch, open both dropdowns, launch each live course, confirm downloads status display.

Gate: verification report with all criteria passing.

---

## Phase 2: Worker manifest endpoint (infrastructure)

Gemini writes the code into the repo; Francisco deploys, because Cloudflare credentials must never be given to Gemini.

**Gemini prompt 2:**

> Create infrastructure/manifest-worker/ containing worker.js exactly as specified in section B4 of CPR_Trainer_Pro_Fix_and_Update_System_Plan_v3.md, plus a wrangler.toml for a Worker named eha-manifest with an R2 bucket binding named MEDIA_BUCKET pointing at bucket eha-cpr-media, and a README.md describing both deployment paths (dashboard quick deploy, wrangler deploy) and the two routing options with the curl tests that decide between them. Change no application code. Acceptance criteria: files exist, wrangler.toml is syntactically valid, README covers both routing options and the verification commands.

Then Francisco deploys and runs the curl checks. Gate: the endpoint returns the full bucket listing as JSON including the App Thumbnails and Pedi VA folders, with cache-control max-age=60 and the CORS header, and a changed file's new etag appears within about 60 seconds of upload. Phases 1 and 2 may run in parallel.

---

## Phase 3: Pediatric deck correction and reconciliation tooling (Plan v3, A2 and A7)

The canonical deck table in plan v3 is final and self contained; this phase needs no external input.

**Gemini prompt 3:**

> Implement A2 and A7 of CPR_Trainer_Pro_Fix_and_Update_System_Plan_v3.md. For A2: replace the pediatric-cpr-aed-course slides array in src/chapters.ts with entries generated verbatim from the canonical deck table in the plan, exactly as printed; slide ids remain slide-1 through slide-36; titles derive by stripping the fixed prefix; extension decides slide type. Then verify instructor tips: structural alignment (an entry for every slide id, no orphans) and a content spot check of the 14 corrected ids listed in the plan, reporting any tip whose content does not match its slide topic without editing tips. For A7: create scripts/sync-chapters-from-bucket.mjs per the plan: two way reconciliation between chapters.ts and a manifest JSON or pasted listing, media extension filter with contamination reporting, and an optional regeneration mode that preserves per slide metadata by number prefix. Acceptance criteria: node scripts/verify-media-urls.mjs passes 100 percent including the pediatric CPR deck; the reconciliation script run against the /api/manifest endpoint (or the pasted pediatric listings if the Worker is not yet live) reports both pediatric folders fully reconciled and lists desktop.ini as contamination if still present; tips verification output included; npx tsc --noEmit and npm run build clean.

**STOP: Fable Audit 2 (milestone).** Francisco sends Fable: git diff pre-3.1-baseline..experiment-3.1, the verification reports from Phases 1 through 3, the verify and reconciliation script outputs, and any deviations. Fable audits implementation against plan, error handling, dead code, and regressions. Gemini repairs findings, re-verifies, milestone closes.

---

## Phase 4: Content update system (Plan v3, Part B), five sub phases in order

**Prompt 4a (Rust groundwork):**

> Implement the Rust side of Part B: add read_version_snapshot and write_version_snapshot commands operating on <media_dir>/.content-versions.json, and add an optional version string parameter to download_media_file that, when present, is appended to the download URL as a v query parameter after the encoded path. Register the new commands. No frontend changes. Acceptance criteria: cargo check clean if the toolchain is available locally, otherwise push and confirm the GitHub Actions build passes; tsc unaffected.

**Prompt 4b (checker module with tests):**

> Create src/update-checker.ts as a pure module implementing the check flow of section B5: build the relevant key set from SLIDESHOWS, COURSES, MANUALS, and the thumbnails registry; diff manifest entries against the snapshot; etag inequality means changed; a missing snapshot entry falls back to the uploaded versus local file mtime rule with the 10 minute skew margin; files never downloaded are excluded; thumbnails are flagged silent. Add a minimal vitest setup (devDependency, config, one test file) covering: identical etags produce no changes; a changed etag produces a change; the first run fallback with and without the skew margin; never downloaded exclusion; the thumbnail silence flag. Acceptance criteria: npx vitest run passes with output shown; tsc and build clean.

**Prompt 4c (targeted download queue):**

> Add queueSpecificFiles to src/download-manager.ts per B5: accepts filename and version pairs, deletes the existing local file and any stale .tmp sibling before enqueueing, downloads with the version parameter, updates the snapshot entry per file on success, reuses the existing progress state and notify flow, and runs checkAllStatuses on completion. Acceptance criteria: tsc and build clean; a described manual test where one file is deliberately re-uploaded and re-downloaded fresh via a version pinned URL.

**Prompt 4d (update prompt UI):**

> Build the update prompt component per the UX spec in B5: headline New course files just dropped, subline as written, total size, estimated time from the persisted rolling speed average with the 25 Mbps fallback phrased as approximate, an Update Details collapsed disclosure grouping changed files by course and chapter with a Manuals group, and Update Now plus I'll do it later buttons with the exact dismiss semantics in the plan. Thumbnails never appear in the prompt. Match the app's existing visual language in HeaderNav and the download UI. No wiring to startup yet. Acceptance criteria: tsc and build clean; screenshots or a described render of collapsed and expanded states.

**Prompt 4e (startup wiring and offline behavior):**

> Wire the startup check per B5: online check, manifest fetch from the endpoint constant with a 4 second timeout, silent skip on any failure, checker invocation, prompt only when the changed set is nonempty, silent thumbnail refresh path, snapshot write rules exactly as specified. Then execute acceptance tests B7 items 1, 2, 3, 5, 6, and 7 and report each with evidence. Items 4 and 8 require Francisco's participation and are listed for the Phase 6 session.

**STOP: Fable Audit 3 (milestone).** Same package as Audit 2: diff since Audit 2, all five sub phase reports, vitest output, B7 evidence. Fable audits with emphasis on the no false prompt guarantee, failure paths, and partial update recovery. Gemini repairs findings and re-verifies.

---

## Phase 5: App thumbnails (Thumbnails Plan v2, as scoped by this playbook)

**Prompt 5a (UI states):**

> Implement sections 2.1 through 2.3 of CPR_Trainer_Pro_App_Thumbnails_Plan_v2.md: reorder the toggles so Pediatric Focused sits above Enable Virtual Assistant in both menus, remove the mutual disabling so both toggles can be on together, implement the four state thumbnail mapping per menu, and implement the both on Coming Soon state gated on the isComingSoon flag of the pediatric VA course ids, with the italic helper text. The pediatric slideshow launches must keep working exactly as today when only the pediatric toggle is on. Acceptance criteria: tsc and build clean; all eight visual states described or captured; both live pediatric slideshow courses verified launchable.

**Prompt 5b (remote pipeline):**

> Implement sections 3 and 5 of the thumbnails plan: the thumbnails registry, background download into the media directory App Thumbnails subfolder, local first resolution with bundled fallback, silent etag based refresh through the Phase 4 machinery, exclusion from the update prompt, and the two new bundled fallback webp files for the with VA pediatric states. Acceptance criteria: thumbnails acceptance tests 1, 2, 4, 5, and 6 executed with evidence; test 3 staged for the Phase 6 session with Francisco.

---

## Phase 6: Windows release gates and final audit

Run in one session with Francisco participating for the live bucket tests.

1. npx tsc --noEmit clean.
2. npm run build production clean.
3. GitHub Actions build green on all configured targets (compilation check; only the Windows artifacts release).
4. node scripts/verify-media-urls.mjs passes 100 percent.
5. node scripts/sync-chapters-from-bucket.mjs against /api/manifest reports full reconciliation, no contamination.
6. npx vitest run passes.
7. Clean install on Windows: first launch offline shows bundled thumbnails and behaves per B7 item 1; first launch online downloads thumbnails and behaves per B7 item 2.
8. Upgrade in place over the previous installed Windows version: media directory preserved, first run snapshot fallback exercised without a false prompt (B7 item 6).
9. Live update drill with Francisco: re-upload one slide, confirm B7 items 3, 4, and 8, and thumbnails test 3.
10. Kill mid update drill: B7 item 5.
11. Network loss during a bulk download recovers per existing behavior.
12. Installer signing and update path verification as configured in the workflow.

**STOP: Fable Audit 4 (final).** Package: full diff pre-3.1-baseline..experiment-3.1, all phase reports, all gate evidence. Fable performs the release audit: plan conformance, security pass, dead code, backward compatibility, release risks. Findings repaired, affected gates re-run, then tag and release. The macOS port plan is drafted after this audit closes.

---

## Departures from the external advice, and why

1. Added an adjudication step after Gemini's critique; without Fable adjudicating, the plan mutates without oversight.
2. Two spec files instead of six; CONTEXT.md and DECISIONS.md carry everything this project needs.
3. Honest testing gates; the repo has no test suite, so gates are the compiler, the builds, the two verification scripts, and one small vitest suite where it enforces a stated product requirement.
4. Dropped Apple Watch hardware testing (iOS scope, and out of this release entirely) and database migration gates (no database; the analogs are included).
5. Confidence percentages omitted.
6. Kept in full: small phases, acceptance criteria per phase, output backed verification, milestone level Fable audits, no mixing refactors with features, and never letting either model rewrite working architecture because it prefers another pattern.
