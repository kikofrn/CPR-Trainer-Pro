# CPR Trainer Pro: App Thumbnails Implementation Plan v2

Prepared July 26, 2026 for branch experiment-3.1. Supersedes v1.
Status: PLANNING ONLY. Implementation is governed by CPR_Trainer_Pro_Execution_Playbook.md (Phase 5) and begins only on Francisco's approval.
Changes from v1: section 4 updated (compression is done; current sizes accepted), clarification that both pediatric slideshow courses are live, and dependency references updated to the v2 fix plan.

---

## 1. Current state (verified in code)

Thumbnails are bundled into the binary under `public/` and referenced with absolute paths in src/components/HeaderNav.tsx:

1. CPR menu, line 190: `Pediatric CPR AED Cover.webp` when pediatric, `CPR AED for All Ages with VA.webp` when VA, else `CPR AED for All Ages Cover.webp`.
2. FA menu, line 306: `Pediatric First Aid Cover.webp` when pediatric, `First Aid for All Ages with VA.webp` when VA, else `First Aid for All Ages Cover.webp`.
3. No bundled assets exist for the two both-toggles-on states (pediatric with VA), consistent with those states not existing yet.

The bucket folder `App Thumbnails/` contains 8 PNGs (re-uploaded compressed by Francisco on July 26): CPR AED for All Ages Cover.png, CPR AED for All Ages with VA.png, First Aid for All Ages Cover.png, First Aid for All Ages with VA.png, Pedi CPR AED Cover.png, Pedi CPR AED with VA Cover.png, Pedi First Aid Cover.png, Pedi First Aid with VA Cover.png.

Course status clarification (Francisco, July 26): the pediatric CPR AED and pediatric First Aid slideshow courses are live. Only the two pediatric Virtual Assistant courses are coming soon. Nothing in this plan gates or alters the live slideshow courses; the Coming Soon state below applies exclusively to the both-toggles-on combination.

## 2. UI changes (independent of the remote pipeline)

### 2.1 Toggle order swap

In HeaderNav.tsx, in both the CPR dropdown and the FA dropdown, move the "Pediatric Focused?" toggle row above the "Enable Virtual Assistant?" toggle row. Pure JSX reorder.

### 2.2 Thumbnail state mapping

Selection becomes a four state lookup per menu. Exact mapping:

CPR menu:
1. Both toggles off: CPR AED for All Ages Cover.png
2. VA on, pediatric off: CPR AED for All Ages with VA.png
3. Pediatric on, VA off: Pedi CPR AED Cover.png
4. Both on: Pedi CPR AED with VA Cover.png

FA menu:
1. Both toggles off: First Aid for All Ages Cover.png
2. VA on, pediatric off: First Aid for All Ages with VA.png
3. Pediatric on, VA off: Pedi First Aid Cover.png
4. Both on: Pedi First Aid with VA Cover.png

This removes the current mutual disabling: today each toggle disables the other, but the both-on state is now meaningful (it selects the pediatric with VA thumbnail and the Coming Soon button), so both toggles must be enableable simultaneously. Remove the `disabled` attributes and the cursor-not-allowed styling tied to the opposite toggle. Launch routing when only the pediatric toggle is on must continue to launch the live pediatric slideshow courses exactly as today (slideshow index 5 for CPR, index 4 for FA, or their id based equivalents after fix A3).

### 2.3 Both-on Coming Soon state

When cprPediatric and cprVaEnabled are both true (and the mirrored pair on the FA side):

1. The START COURSE button renders disabled and grayed out with the label "COMING SOON".
2. Directly below the Enable Virtual Assistant toggle and above the button, show italic helper text: "To launch the Pediatric course, disable the Virtual Assistant."
3. Gate on data, not hardcoded UI truth: look up the matching pediatric VA course by id (`pediatric-cpr-aed` or `pediatric-first-aid`, created in fix A3) and disable only while its `isComingSoon` is true. When future activation flips that flag, the button goes live with zero UI edits and routes to that VA course.
4. Today both placeholder VA courses are `isComingSoon: true`, so the both-on state always shows Coming Soon in this release.

## 3. Remote thumbnail pipeline

### 3.1 Design: local first, bundled fallback, silent refresh

1. Add a THUMBNAILS registry (a small exported array in src/chapters.ts or a new src/thumbnails.ts) mapping each of the 8 UI slots to its bucket key under `App Thumbnails/` and its bundled fallback path.
2. On startup, after the version manifest check, download any registry thumbnails that are missing locally or whose etag changed, through the existing download pipeline into `<media_dir>/App Thumbnails/`. The Rust downloader and media protocol already handle subfolders (verified in the audit); the only Rust dependency is the version pinned URL parameter from the main plan (fix 4a).
3. The `<img>` sources resolve local first through the existing media protocol (`mediaUrl('App Thumbnails/<name>.png')`), falling back to the bundled `public/` asset via an onError handler or the loaded status map. First launch offline shows correct art.
4. Refresh silently. Thumbnails are excluded from the update prompt and its size totals. A changed etag for a thumbnail key triggers a background re-download; the UI picks it up on next render. No user decision is warranted for cosmetics, and this keeps the update prompt honest about course content.
5. Bundle fallbacks for the two new both-on states: export compressed webp versions of Pedi CPR AED with VA Cover and Pedi First Aid with VA Cover into `public/` so the fallback chain covers all 8 slots.

### 3.2 Where thumbnails live after this change

Three layers: authoritative copies in the bucket's App Thumbnails folder (swap art there anytime by overwriting the same filename), cached copies in the app's media directory (auto refreshed by etag), and bundled fallbacks inside the binary (used only before first download or on offline first runs). Swapping art becomes: overwrite in Cloudflare, done.

## 4. File sizes: resolved

Francisco re-exported all 8 thumbnails on July 26. All are at or under roughly 300 KB, with one at 327 KB. This is fully acceptable: the earlier concern was 6 to 14 MB files (77 MB total) causing decode stutter and a heavy cosmetic download; the set now totals roughly 2 MB. The 300 KB figure was a target, not a ceiling, and nothing in the pipeline treats it as a limit. No further re-export is needed. Filenames were kept identical, so no registry or key changes follow from the re-upload.

## 5. Performance answer for the per file check concern

Under the Worker manifest design, the entire thumbnail system adds zero additional network requests: thumbnail versions are rows in the same single manifest fetch the update system already performs (one request, roughly 40 to 60 KB of JSON, a few milliseconds of diffing). The per file HEAD sweep is the design to avoid, for the reasons in the main plan's Option 1.

## 6. Cross platform

1. Windows and macOS: covered automatically, shared codebase.
2. iOS: separate native work item, bundled with the iOS half of the update system (later phase) so both land in one App Store submission. ContentManifestService fetches the same manifest endpoint, mirrors the registry, caches under the app's documents directory, same local first fallback with bundled assets.
3. Android (future): same design transfers directly.

## 7. Acceptance tests

1. Fresh install, offline first launch: all four CPR states and all four FA states show correct bundled art, no errors.
2. Fresh install, online: bucket thumbnails download in the background; kill and relaunch; local copies render (verify by temporarily renaming a bundled fallback).
3. Overwrite one thumbnail in the bucket with visibly different art: next launch silently refreshes it, no prompt appears, the dropdown shows the new art.
4. Toggle order verified: Pediatric Focused sits above Enable Virtual Assistant in both menus.
5. Both toggles on, both menus: pediatric with VA thumbnail shows, button reads COMING SOON and is disabled, italic helper text renders, and turning either toggle off restores a launchable state instantly, including confirming both live pediatric slideshow courses still launch when only the pediatric toggle is on.
6. The update prompt from the main plan never lists thumbnail files.
