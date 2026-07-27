# CPR Trainer Pro: Execution Playbook v3 (Fable + Gemini Workflow)

Prepared July 27, 2026. Supersedes v2. Governs the execution of:
1. CPR_Trainer_Pro_Fix_and_Update_System_Plan_v3.md
2. CPR_Trainer_Pro_App_Thumbnails_Plan_v2.md

Changes from v2:
- Standing preamble expanded with rules learned in Phases 1 through 3: read plans from docs/plans/ and stop rather than search the filesystem if a file is missing; do not add code or state in anticipation of future phases; do not run probes or verification beyond the current phase scope; list and delete temporary files; commit at phase end with a message naming the phase, before writing the report.
- New standing rule: every phase that settles a new architectural or process decision appends it to DECISIONS.md as part of that phase's acceptance criteria, so the decision log never drifts. CONTEXT.md is updated only when something structural changes.
- Phases 0 through 3 marked as completed with their gate status recorded, rather than rewritten.
- Remaining phase prompts (4, 5) carry the DECISIONS.md append line in their acceptance criteria.

## Scope

This release targets the Windows app on the experiment-3.1 branch. The macOS build lives on separate mac-version branches and receives its own port plan after this release; iOS likewise. CI still builds all configured targets from this branch as a compilation check. Anything in the plan documents describing macOS or iOS shipping with this release is superseded by this paragraph. External advice items that do not apply to this app (Apple Watch hardware testing, database migration gates) are intentionally excluded; their applicable analogs (snapshot schema versioning, upgrade in place testing) are in Phase 6.

Roles: Fable (Claude) is architect and auditor. Gemini (Antigravity) is the implementer. Francisco is the gatekeeper: no phase begins until he starts it, and no phase is done until its gate passes. Do not place the approval word in any repository file or in any prompt to Gemini; it is a chat protocol only.

---

## Standing rules for every Gemini session

Open every Gemini working session with this preamble, then the phase prompt:

> You are implementing a planned change to the CPR-Trainer-Pro repository. The plan documents are in docs/plans/ inside the repository; begin by reading CONTEXT.md, DECISIONS.md, and the plan document referenced in this prompt from there. If a referenced file is not found in the repository, stop and ask rather than searching outside the repository. Rules for this session: work only within the scope of the phase described below; produce minimal diffs; do not reformat, restructure, or rewrite any code outside the named files; do not upgrade dependencies unless the phase says so; do not mix refactoring with the feature work; do not add code, state, stubs, or scaffolding in anticipation of future phases. Do not run additional verification tasks or probes beyond the phase scope without being asked; the Spanish content is intentionally absent from the bucket and needs no probing. Any temporary or scratch files you create must be listed in your report and deleted before the phase ends. Commit the phase's changes with a descriptive message naming the phase before writing the verification report. When you finish, produce a verification report containing: every command you ran, the actual output or output tail of each, every failure encountered and how it was resolved, a list of every file changed or created (including temporary files), each acceptance criterion for the phase with an explicit pass or fail, and any unresolved concerns. Do not claim the phase is complete unless every acceptance criterion shows pass with evidence.

Never accept "tests passed" without the output shown.

Decision logging: whenever a phase settles a new architectural or process decision (a choice that a future session would need to know), append it to DECISIONS.md as a dated entry within that phase, and treat doing so as one of the phase's acceptance criteria. Update CONTEXT.md only when something structural changes (stack, folder conventions, source-of-truth rules, verification commands).

---

## Phase 0: Setup and plan critique (COMPLETED)

Status: complete. Branch experiment-3.1 created, pre-3.1-baseline tag set, CONTEXT.md and DECISIONS.md committed, Gemini critique delivered, Fable Audit 1 adjudicated (see CPR_Trainer_Pro_Audit1_Adjudication.md). Amendments AM1 through AM7 issued; AM1 folded into Phase 1, AM2 through AM5 into Phase 4, AM6 into Phase 5, AM7 recorded as a risk note.

Bucket side prerequisites: complete. desktop.ini removed from both pediatric folders (probe verified 404). Slide 16 filename confirmed and probe verified. Update system decision locked: Option 3, the Cloudflare Worker manifest endpoint.

Post-Phase-0 governance sync (run once before Phase 4 if not already done): update CONTEXT.md and DECISIONS.md to record decisions settled since they were written, namely: plan documents live in docs/plans/; no anticipatory code or scaffolding; no out-of-scope probes; the Worker is deployed and live at https://media.ehacademy.com/api/manifest on the preferred Workers route; the pediatric presentation folders no longer contain desktop.ini.

## Phase 1: Core audit fixes (COMPLETED)

Status: complete, gate closed. Implemented A1, A3, A4, A5 plus AM1. Verified: tsc clean, build clean, verify-media-urls.mjs at 244 URLs with exactly the 14 expected pediatric CPR failures (later corrected in Phase 3), AM1 dual guard present, manifestRev anticipatory state removed, no manuals excluded. Human smoke test performed by Francisco.

Prompt of record (Gemini prompt 1): implemented Part A items A1, A3, A4, A5 only; removed fetchRemoteManifest, subscribeToManifest, listeners, and the App.tsx subscription; converted CPR and FA active checks and handleItemClick to id based lookups; confirmed download manager filters use real ids; rewrote verify-media-urls.mjs against media.ehacademy.com with browser UA and Range bytes 0-0.

## Phase 2: Worker manifest endpoint (COMPLETED)

Status: complete, gate closed. Gemini created infrastructure/manifest-worker/ (worker.js, wrangler.toml, README.md); wrangler.toml validated. Francisco deployed to Cloudflare and ran the two curl checks: /api/manifest returned 200 with content-type application/json, cache-control max-age=60, and the CORS header, listing all folders including App Thumbnails and both Pedi VA folders; the media 206 range check confirmed media serving is untouched. Live on the preferred Workers route; no fallback domain needed.

## Phase 3: Pediatric deck correction and reconciliation tooling (IN AUDIT)

Status: implementation reported by Gemini; Fable Audit 2 pending. Prompt of record (Gemini prompt 3): implemented A2 (regenerate the pediatric-cpr-aed-course slides array verbatim from the plan v3 canonical table, verify instructor tips alignment and spot check the 14 corrected ids) and A7 (create scripts/sync-chapters-from-bucket.mjs with two way reconciliation, media extension filtering with contamination reporting, and a metadata preserving regeneration mode).

**STOP: Fable Audit 2 (milestone).** Francisco sends Fable: git diff pre-3.1-baseline..experiment-3.1, the verification reports from Phases 1 through 3, the verify and reconciliation script outputs, and any deviations. Fable audits implementation against plan, error handling, dead code, and regressions. Gemini repairs findings, re-verifies, milestone closes. Any decisions or corrections arising from this audit are appended to DECISIONS.md before Phase 4 begins.

---

## Phase 4: Content update system (Plan v3, Part B), five sub phases in order

Carries adjudication amendments AM2 through AM5. Each sub phase appends any new settled decision to DECISIONS.md as part of its acceptance criteria.

**Prompt 4a (Rust groundwork, AM2):**

> Implement the Rust side of Part B with adjudication amendment AM2: add read_version_snapshot and write_version_snapshot commands operating on <media_dir>/.content-versions.json, and add an optional version: Option<String> parameter to download_media_file. The destination path is built from the clean filename only and never contains the version; the version is appended to the request URL as ?v=<value> only after path encoding. When version is Some, ignore any existing .tmp for that file and restart the download from byte zero (prevents cross version resume corruption). Add a bounded retry to the final rename: up to 5 attempts with doubling backoff from 200 ms; on persistent failure, remove the .tmp, report the file as failed, leave the old file intact. Do not add a delete_media_file command. Register the new commands. No frontend changes. Acceptance criteria: cargo check clean if the toolchain is available locally, otherwise push and confirm the GitHub Actions build passes; tsc unaffected; append any new decision to DECISIONS.md.

**Prompt 4b (checker module with tests):**

> Create src/update-checker.ts as a pure module implementing the check flow of section B5: build the relevant key set from SLIDESHOWS, COURSES, MANUALS, and the thumbnails registry; diff manifest entries against the snapshot; etag inequality means changed; a missing snapshot entry falls back to the uploaded versus local file mtime rule with the 10 minute skew margin; files never downloaded are excluded; thumbnails are flagged silent. Add a minimal vitest setup (devDependency, config, one test file) covering: identical etags produce no changes; a changed etag produces a change; the first run fallback with and without the skew margin; never downloaded exclusion; the thumbnail silence flag. Acceptance criteria: npx vitest run passes with output shown; tsc and build clean; append any new decision to DECISIONS.md.

**Prompt 4c (targeted download queue, AM3 AM4 AM5):**

> Add queueSpecificFiles to src/download-manager.ts per B5 with amendments AM3, AM4, AM5. AM3: refactor DownloadState.queue from string[] to { filename: string; version?: string }[]; downloadNext reads the object and passes version into the download_media_file invoke; queueSpecificFiles performs no deletion and does not apply the already-downloaded skip filter (the atomic overwrite via .tmp-then-rename plus AM2's byte-zero restart handles replacement safely). AM4: create src/snapshot-store.ts owning all reads and writes of .content-versions.json through the Rust commands, serializing writes through a promise queue so the checker and download manager cannot clobber each other; DownloadManager updates a decayed avgSpeedBps through this module after each completed download. AM5: on each successful download set that file's fileStatuses entry true in memory and notify; do not call checkAllStatuses on the completion path. Acceptance criteria: tsc and build clean; a described manual test where one file is deliberately re-uploaded and re-downloaded fresh via a version pinned URL; append any new decision to DECISIONS.md.

**Prompt 4d (update prompt UI):**

> Build the update prompt component per the UX spec in B5: headline New course files just dropped, subline as written, total size, estimated time from the persisted rolling speed average with the 25 Mbps fallback phrased as approximate, an Update Details collapsed disclosure grouping changed files by course and chapter with a Manuals group, and Update Now plus I'll do it later buttons with the exact dismiss semantics in the plan. Thumbnails never appear in the prompt. Match the app's existing visual language in HeaderNav and the download UI. No wiring to startup yet. Acceptance criteria: tsc and build clean; screenshots or a described render of collapsed and expanded states; append any new decision to DECISIONS.md.

**Prompt 4e (startup wiring and offline behavior):**

> Wire the startup check per B5: online check, manifest fetch from the endpoint constant (https://media.ehacademy.com/api/manifest) with a 4 second timeout, silent skip on any failure, checker invocation, prompt only when the changed set is nonempty, silent thumbnail refresh path, snapshot write rules exactly as specified through the snapshot-store module. Then execute acceptance tests B7 items 1, 2, 3, 5, 6, and 7 and report each with evidence. Items 4 and 8 require Francisco's participation and are listed for the Phase 6 session. Acceptance criteria: the listed B7 items pass with evidence; tsc and build clean; append any new decision to DECISIONS.md.

**STOP: Fable Audit 3 (milestone).** Same package as Audit 2: diff since Audit 2, all five sub phase reports, vitest output, B7 evidence. Fable audits with emphasis on the no false prompt guarantee, failure paths, and partial update recovery. Gemini repairs findings and re-verifies. New decisions appended to DECISIONS.md.

---

## Phase 5: App thumbnails (Thumbnails Plan v2, carries AM6)

**Prompt 5a (UI states):**

> Implement sections 2.1 through 2.3 of CPR_Trainer_Pro_App_Thumbnails_Plan_v2.md: reorder the toggles so Pediatric Focused sits above Enable Virtual Assistant in both menus, remove the mutual disabling so both toggles can be on together, implement the four state thumbnail mapping per menu, and implement the both on Coming Soon state gated on the isComingSoon flag of the pediatric VA course ids, with the italic helper text. The pediatric slideshow launches must keep working exactly as today when only the pediatric toggle is on. Acceptance criteria: tsc and build clean; all eight visual states described or captured; both live pediatric slideshow courses verified launchable; append any new decision to DECISIONS.md.

**Prompt 5b (remote pipeline, AM6):**

> Implement sections 3 and 5 of the thumbnails plan with amendment AM6: the thumbnails registry; background download into the media directory App Thumbnails subfolder; local first resolution that drives the img src from the status map (if the registry file's status is downloaded use mediaUrl, otherwise the bundled fallback), with onError retained only as a secondary guard, never the primary fallback; the thumbnail registry keys added to the startup status check set; silent etag based refresh through the Phase 4 machinery; exclusion from the update prompt; and the two new bundled fallback webp files for the with VA pediatric states. Acceptance criteria: thumbnails acceptance tests 1, 2, 4, 5, and 6 executed with evidence; test 3 staged for the Phase 6 session with Francisco; append any new decision to DECISIONS.md.

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
2. Two spec files instead of six; CONTEXT.md and DECISIONS.md carry everything this project needs, and are kept current by the decision logging rule above.
3. Honest testing gates; the repo has no test suite, so gates are the compiler, the builds, the two verification scripts, and one small vitest suite where it enforces a stated product requirement.
4. Dropped Apple Watch hardware testing (iOS scope, and out of this release entirely) and database migration gates (no database; the analogs are included).
5. Confidence percentages omitted.
6. Kept in full: small phases, acceptance criteria per phase, output backed verification, milestone level Fable audits, no mixing refactors with features, and never letting either model rewrite working architecture because it prefers another pattern.
