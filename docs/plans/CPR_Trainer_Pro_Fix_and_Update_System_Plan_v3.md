# CPR Trainer Pro: Audit Fixes and Content Update System, Implementation Plan v3

Prepared July 26, 2026 for branch experiment-3.1 (branched from experiment-3.0, commit f447292). Supersedes v1 and v2.
Status: PLANNING ONLY. Implementation is governed by CPR_Trainer_Pro_Execution_Playbook.md (v2) and begins only on Francisco's approval.
Changes from v2: A2 now contains the verified canonical pediatric CPR deck (all 36 filenames confirmed against the live bucket); new A7 establishes the bucket as build time source of truth for every course; desktop.ini contamination flagged with an exclusion rule; scope narrowed to the Windows release with macOS and iOS as separate follow up plans.

## Scope for this release

Windows only. The macOS build lives on separate mac-version branches and will get its own port plan after this release ships; iOS likewise. CI continues to build all targets from this branch as a compilation check, but install, upgrade, and live drill testing in Phase 6 is Windows only. Any statement in earlier document versions (including the thumbnails plan section 6) that macOS ships automatically with this release is superseded by this paragraph.

---

## Part A: Required fixes from the July 26 audit

### A1. mediaReady toggle bug (App.tsx, splashscreen hang risk)

Location: src/App.tsx, manifest subscription effect near line 64. Current code toggles the semantic flag `setMediaReady(prev => !prev)` inside `subscribeToManifest`. mediaReady gates the splashscreen close effect near line 106. If a manifest listener fires during the roughly 3.2 second splash window, the effect cleanup cancels the pending close timers and the app hangs on the splashscreen. Dormant today only because manifest.json 404s.

Fix: A5 removes the subscription entirely, resolving this by deletion. If any re-render-on-manifest mechanism is ever reintroduced, it must use a dedicated counter state and never touch mediaReady.

### A2. Pediatric CPR AED deck: replace the 14 guessed entries with the verified bucket names

Root cause confirmed July 26 with Francisco's dashboard listing: the deck in `Pedi CPR Presentation Slides/` is complete and contiguous at 36 files. The 14 chapter entries that 404ed in the audit were invented titles that never matched the real filenames. The course is live and stays live; this is a data correction, not a gating change.

Canonical deck, verified against the live bucket (every name below returned 200 or 206, including slide 16, confirmed by Francisco on July 26 and probe verified). Filenames are verbatim; titles derive by stripping the fixed prefix `NN_EHAcademy - Pedi CPR AED Course Pres-`.

| N | Filename (within Pedi CPR Presentation Slides/) | Type | Status |
|---|---|---|---|
| 01 | 01_EHAcademy - Pedi CPR AED Course Pres-Introduction.png | image | verified, unchanged |
| 02 | 02_EHAcademy - Pedi CPR AED Course Pres-Why should I learn CPR.png | image | verified, unchanged |
| 03 | 03_EHAcademy - Pedi CPR AED Course Pres-Heart Attack vs Cardiac Arrest.png | image | verified, unchanged |
| 04 | 04_EHAcademy - Pedi CPR AED Course Pres-What is CPR.png | image | verified, unchanged |
| 05 | 05_EHAcademy - Pedi CPR AED Course Pres-When will I use CPR.png | image | verified, unchanged |
| 06 | 06_EHAcademy - Pedi CPR AED Course Pres-What if something goes wrong.png | image | verified, unchanged |
| 07 | 07_EHAcademy - Pedi CPR AED Course Pres-Good Samaritan Law.png | image | verified, unchanged |
| 08 | 08_EHAcademy - Pedi CPR AED Course Pres-Course Overview.png | image | verified, unchanged |
| 09 | 09_EHAcademy - Pedi CPR AED Course Pres-Recognizing the Emergency.png | image | verified, unchanged |
| 10 | 10_EHAcademy - Pedi CPR AED Course Pres-First Actions.png | image | verified, unchanged |
| 11 | 11_EHAcademy - Pedi CPR AED Course Pres-Assessment Example.mp4 | video | verified, unchanged |
| 12 | 12_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Check Responsiveness.png | image | verified, CORRECTED (was Check Responsiveness) |
| 13 | 13_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Getting Help.png | image | verified, CORRECTED (was Getting Help) |
| 14 | 14_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Check Breathing.png | image | verified, CORRECTED (was Check Breathing) |
| 15 | 15_EHAcademy - Pedi CPR AED Course Pres-Assessment and Activation - Begin Chest Compressions.png | image | verified, CORRECTED (was Begin Chest Compressions) |
| 16 | 16_EHAcademy - Pedi CPR AED Course Pres-Chest Compression Effect Video.mp4 | video | verified, CORRECTED (was Chest Compressions Video.mp4) |
| 17 | 17_EHAcademy - Pedi CPR AED Course Pres-Hand Placement.png | image | verified, unchanged |
| 18 | 18_EHAcademy - Pedi CPR AED Course Pres-Compression Depth.png | image | verified, unchanged |
| 19 | 19_EHAcademy - Pedi CPR AED Course Pres-Rate and Rhythm.png | image | verified, unchanged |
| 20 | 20_EHAcademy - Pedi CPR AED Course Pres-CPR Song.mp4 | video | verified, CORRECTED (was CPR Songs.mp4) |
| 21 | 21_EHAcademy - Pedi CPR AED Course Pres-Practice Compressions.mp4 | video | verified, unchanged |
| 22 | 22_EHAcademy - Pedi CPR AED Course Pres-Giving Breaths.png | image | verified, unchanged |
| 23 | 23_EHAcademy - Pedi CPR AED Course Pres-Practice Giving Breaths.png | image | verified, unchanged |
| 24 | 24_EHAcademy - Pedi CPR AED Course Pres-Using an AED.png | image | verified, unchanged |
| 25 | 25_EHAcademy - Pedi CPR AED Course Pres-Put it all together.png | image | verified, CORRECTED (was Adult Scenario) |
| 26 | 26_EHAcademy - Pedi CPR AED Course Pres-Infant Assessment.png | image | verified, CORRECTED (was Infant CPR) |
| 27 | 27_EHAcademy - Pedi CPR AED Course Pres-Infant Chest Compressions.png | image | verified, unchanged |
| 28 | 28_EHAcademy - Pedi CPR AED Course Pres-Infant Breaths.png | image | verified, unchanged |
| 29 | 29_EHAcademy - Pedi CPR AED Course Pres-Infant AED Use.png | image | verified, CORRECTED (was Infant Scenario) |
| 30 | 30_EHAcademy - Pedi CPR AED Course Pres-Infant Scenario.png | image | verified, CORRECTED (was Mild Choking) |
| 31 | 31_EHAcademy - Pedi CPR AED Course Pres-Mild Choking.png | image | verified, CORRECTED (was Severe Choking) |
| 32 | 32_EHAcademy - Pedi CPR AED Course Pres-Severe Choking.png | image | verified, CORRECTED (was Choking Adult) |
| 33 | 33_EHAcademy - Pedi CPR AED Course Pres-Choking Relief Child.png | image | verified, CORRECTED (was Choking Child) |
| 34 | 34_EHAcademy - Pedi CPR AED Course Pres-Choking Relief Infant.png | image | verified, CORRECTED (was Choking Infant) |
| 35 | 35_EHAcademy - Pedi CPR AED Course Pres-Practice Infant Choking.png | image | verified, unchanged |
| 36 | 36_EHAcademy - Pedi CPR AED Course Pres-Conclusion.png | image | verified, unchanged |

Implementation requirements:

1. Regenerate the pediatric-cpr-aed-course slides array in src/chapters.ts from this table verbatim. Slide ids remain slide-1 through slide-36; titles derive from the stripped prefix; the compound Assessment titles keep their full text (for example "Assessment and Activation - Check Responsiveness").
2. Instructor tips are keyed by slide id, so structural alignment (36 entries, no orphans) is preserved. Content spot check required for the 14 corrected ids (12 to 16, 20, 25, 26, 29 to 34): confirm each tip's content matches the actual slide topic. The tips were generated from the pediatric instructor notes docx, which should reflect the real deck, so mismatches are unlikely but must be reported to Francisco rather than edited if found.
3. The pediatric First Aid deck needs no changes: the bucket holds 45 files matching chapters.ts one for one (the stray desktop.ini has since been deleted), and all 45 verified live in the audit and against the July 27 manifest.

### A3. Download manager course id mismatch (src/download-manager.ts near line 330)

Unchanged from v2. Rename placeholder course id `pediatric` to `pediatric-first-aid`, add placeholder `pediatric-cpr-aed` (both `isComingSoon: true`, empty chapters, pediatric_student_manual.pdf), convert the CPR and FA activity checks and click routing in src/App.tsx from hardcoded indexes to id based lookups, and confirm the download manager filters match real ids on both loops.

### A4. scripts/verify-media-urls.mjs rewrite

Unchanged from v2: import structure from src/chapters.ts, target https://media.ehacademy.com/ with per segment encoding matching src/media-resolver.ts, browser User-Agent, Range bytes 0-0, accept 200 and 206, exit nonzero on failure. The manifest cross check mode is now specified in A7 rather than here.

### A5. Remove the dormant structure replacing manifest fetch

Unchanged from v2. Remove `fetchRemoteManifest`, `subscribeToManifest`, the listeners array, and the App.tsx subscription effect. Never name the Part B endpoint `manifest.json` and never place a file with that name at the bucket root. Course structure stays in chapters.ts.

### A6. No action items

Spanish decks intentionally parked; unchanged from v2.

### A7. The bucket is the build time source of truth for every course (new in v3)

Francisco's directive: every course's chapter list should use the Cloudflare files as its source. Two ways to honor that were considered:

Runtime dynamic structure (the app builds chapter lists from the manifest on launch) is declined for this release, deliberately. The chapter arrays carry metadata that filenames cannot express: stable slide ids that key instructor tips, durations, section headers with expand and collapse hierarchy in the VA courses (isSectionHeader and parentSectionId), and coming soon flags. Deriving structure at runtime would either destroy that metadata or force it into filename conventions, which the bucket's own history shows drifting (a doubled dash in the all ages deck, compound titles in the pediatric deck, a desktop.ini in two folders). Runtime generation remains Phase 7 material, scoped only to the two future Pedi VA courses where the naming convention is being designed for it from the start.

Build time reconciliation (adopted): the bucket remains truth, enforced by tooling rather than runtime magic.

1. New script `scripts/sync-chapters-from-bucket.mjs`. Input: the /api/manifest JSON (preferred) or a pasted listing file. For every course folder it reconciles chapters.ts in both directions: every referenced filename must exist in the bucket (failure), and every bucket media file in a course folder must be referenced by chapters.ts (failure, listed by name). Non media files are excluded by rule: only .png and .mp4 participate for slides, .pdf for manuals; anything else (desktop.ini and friends) is reported as bucket contamination but does not fail the run.
2. The script can emit a regenerated slides array for any folder on request (order from number prefix, title from stripped prefix, type from extension), preserving existing per slide metadata by matching on the number prefix, so ids, durations, and section flags survive regeneration.
3. This script becomes a Phase 6 release gate alongside verify-media-urls.mjs once the Worker is live. Until then it runs against pasted listings where available (both pediatric folders are reconciled as of this document; the English and VA folders passed the one way check in the audit and get the reverse direction check at first Worker availability).
4. Bucket hygiene: completed July 26. Francisco deleted `desktop.ini` from `Pedi CPR Presentation Slides/` and `Pedi First Aid Presentation Slides/` (Windows Explorer artifacts from a synced folder upload); both deletions probe verified as 404. The exclusion rule above stays as permanent defense, since the bucket should hold only content meant to ship, per the security section.

---

## Part B: Content update system ("new files just dropped")

Sections B0 through B7 are unchanged from v2 in substance and are restated here in full so this document stands alone.

### B0. Goal

When a media file in R2 is replaced under the same name, every installed app detects it on next launch while online and prompts the user to re-download exactly the changed files. The check is silent when nothing changed, never blocks launch, and is skipped entirely offline.

A live example already exists in the bucket: slide 18 of the pediatric First Aid deck (Major External Bleeding) was re-uploaded on July 24, one day after the rest of the deck. Under this system, any user holding the July 23 file would be prompted once, download one file, and be current.

### B1. Mandatory regardless of option: defeat CDN cache staleness

media.ehacademy.com serves R2 through Cloudflare's CDN. Replacing a file under the same key can leave edge caches serving old bytes and old headers until TTL expiry. Consequences: date checks through the CDN can miss updates for hours, and a plain re-download can fetch the stale old file.

Mitigation: version pinned download URLs. Update triggered downloads append `?v=<etag>`. Different query strings are different cache keys by default, guaranteeing an edge miss and fresh bytes from R2, with no manual purging ever. Implementation point: `download_media_file` in src-tauri/src/lib.rs builds the URL near line 268; add an optional version argument appended as a query parameter after the encoded path. Playback is unaffected because playback reads local files.

### B2. Option 1: per file HEAD checks at startup

Roughly 330 HEAD requests per launch comparing Last-Modified and ETag against a stored snapshot. Pros: zero new infrastructure; matches the mental model; filenames already known. Cons: HEAD responses come from the CDN cache and can be stale for hours, making detection unreliable in exactly the scenario the system exists for; a 10 to 15 second request sweep on every launch forever; cannot discover new files, so future auto activation is impossible without hardcoding names; scales worst. Verdict: not recommended.

### B3. Option 2: static version manifest generated at upload time

A local script with R2 S3 credentials lists the bucket after each upload session and writes `content-versions.json` to the bucket; the app fetches that one file (with a timestamp query parameter), diffs, prompts. Pros: one request per launch; sizes included; new files appear; no deployed infrastructure. Cons: a manual step after every upload, and the day it is forgotten, detection silently dies with no error anywhere. Verdict: choose only if a deployed component is unacceptable.

### B4. Option 3 (recommended): Cloudflare Worker live manifest endpoint

A small Worker with an R2 binding lists the bucket live and returns JSON. One fetch per launch, metadata read directly from R2 (never stale beyond the Worker's 60 second response cache), etags that ignore byte identical re-uploads (single part), every key included so thumbnails and future folders ride along, one endpoint for all platforms, cost rounding to zero.

Worker specification (Gemini writes it into infrastructure/manifest-worker/; Francisco deploys; Cloudflare credentials never enter the repo or any AI context):

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/manifest') {
      return new Response('Not found', { status: 404 });
    }
    const files = [];
    let cursor;
    do {
      const list = await env.MEDIA_BUCKET.list({ cursor, limit: 1000 });
      for (const o of list.objects) {
        files.push({ key: o.key, etag: o.etag, uploaded: o.uploaded, size: o.size });
      }
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);
    return new Response(
      JSON.stringify({ generated: new Date().toISOString(), files }),
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=60',
          'access-control-allow-origin': '*'
        }
      }
    );
  }
};
```

Notes that matter: the CORS header is required (the Tauri webview fetches from an app origin, so without it the in-app fetch fails even though curl works). Binding MEDIA_BUCKET points at eha-cpr-media in wrangler.toml. Routing: preferred is a Workers route `media.ehacademy.com/api/*` on the zone, verified with `curl -i https://media.ehacademy.com/api/manifest` (expect JSON) and `curl -i -r 0-0 https://media.ehacademy.com/instructor_manual.pdf` (expect 206, proving media untouched); fallback if the route does not intercept is a Worker custom domain `api.ehacademy.com`, with the app reading the manifest URL from a single constant. Any Worker failure is treated by the app exactly like being offline.

### B5. Client design

Snapshot store: `<media_dir>/.content-versions.json` via two small Rust commands (`read_version_snapshot`, `write_version_snapshot`). Schema:

```json
{ "schema": 1, "lastCheck": "ISO", "avgSpeedBps": 0, "files": { "<key>": { "etag": "", "uploaded": "ISO", "size": 0 } } }
```

Check flow, every launch:

1. If offline, or the manifest fetch fails or exceeds a 4 second timeout, skip silently. Never block launch.
2. Relevant keys: every filename referenced by SLIDESHOWS, COURSES, MANUALS, plus the thumbnails registry. Unreferenced manifest keys are ignored this phase.
3. For each relevant key with a local file: changed means snapshot etag differs from manifest etag; with no snapshot entry, fall back to manifest uploaded later than local file mtime plus a 10 minute skew margin, then write snapshot entries for all relevant keys so future checks are exact. No local file means not an update (existing download flows own never downloaded content).
4. Changed set empty: refresh lastCheck and missing etags, show nothing. Etag equality means silence.
5. Changed set nonempty: thumbnails apply silently in the background; course content and manuals go to the prompt.

Update prompt UX: headline "New course files just dropped.", subline "Update now to make sure you're using the latest materials.", total size from manifest sizes, estimated time from persisted rolling `avgSpeedBps` (exponential decay, updated after each completed download) with a 25 Mbps fallback phrased approximately, an "Update Details" collapsed disclosure grouping changed files by course with chapter titles plus a Manuals group (thumbnails never listed), primary "Update Now", secondary "I'll do it later" dismissing for the session only with nothing written so the next launch re-prompts.

Applying an update: new `queueSpecificFiles(files: {filename, version}[])` in DownloadManager deletes the existing local file and any stale `.tmp` sibling per file, enqueues with the version pinned URL, reuses the existing progress and notify flow, runs checkAllStatuses on completion, and updates each file's snapshot entry individually on success so a partial update self heals.

Testing scope: minimal vitest setup covering src/update-checker.ts as a pure module: identical etags produce no changes; a changed etag produces a change; first run fallback with and without the skew margin; never downloaded exclusion; thumbnail silence flag.

### B6. Phasing

Execution order, prompts, gates, and audit stops live in CPR_Trainer_Pro_Execution_Playbook.md v2. Summary: Phase 1 fixes (A1, A3, A4, A5), Phase 2 Worker, Phase 3 pediatric deck correction (A2) plus reconciliation script (A7), Phase 4 update system in five sub phases, Phase 5 thumbnails, Phase 6 Windows release gates. macOS and iOS are separate follow up plans after this release.

### B7. Acceptance tests

1. Launch offline: no prompt, no visible errors, content plays.
2. Launch online, nothing changed: no prompt. Repeat 10 times: still silent.
3. Re-upload one slide with modified content: within about 60 seconds, next launch prompts; Details lists exactly that course and chapter; size matches; Update Now replaces the file and the new content renders; the following launch is silent.
4. Re-upload a byte identical file (single part upload): no prompt.
5. Kill the app after 1 of 3 files completes: next launch prompts for the remaining 2 only.
6. Delete the snapshot file: next launch runs the date fallback with the skew margin, does not false prompt for files downloaded after their upload, and rebuilds the snapshot.
7. Point the manifest URL at an unreachable host: launch proceeds normally, no visible error.
8. Confirm a version pinned URL fetches fresh bytes when the unpinned URL is known to be edge cached with old content.

---

## Non goals for this release

1. No runtime replacement of course structure; chapters.ts remains structural source, the manifest carries versions and sizes only, and A7's reconciliation keeps them honest at build time.
2. No dynamic course activation yet (Phase 7 appendix material).
3. Spanish content untouched.
4. No macOS or iOS changes in this release; each gets its own follow up plan.
5. No authentication, accounts, analytics, or telemetry.
6. No refactors beyond the id based course identity change in A3.

## Rollback strategy

1. All work on experiment-3.1; experiment-3.0 tagged pre-3.1-baseline. Reverting the release is checking out the tag and rebuilding.
2. The Worker is additive and reversible: removing the route restores the prior state, and the app treats a missing endpoint as offline, so versions coexist safely.
3. The snapshot file is schema versioned; future changes read old schemas or rebuild via the first run fallback.
4. Version pinned URLs are additive; unpinned URLs keep working everywhere.

## Security implications

1. The manifest endpoint publicly lists every key in the bucket. Per object access is already public; the new exposure is enumerability, meaning unreleased content names become visible before launch. Accepted consciously: nothing sensitive lives in this bucket, and nothing should be uploaded to it that is not meant to ship. The desktop.ini findings reinforce the habit this implies.
2. The Worker is read only and holds no secrets; Cloudflare credentials never enter the repo, prompts, or any AI context.
3. The media protocol's path traversal guard remains and must not be weakened; the snapshot commands operate on a fixed filename inside media_dir and take no path input.
4. The update mechanism introduces no code execution path: only media files and JSON are fetched, and structure is never remote controlled this phase.

---

## Appendix: future Pedi VA auto activation (Phase 7 material, not in this release)

Unchanged from v2, with one addition informed by today's findings. Readiness requires an 01 Introduction, a Conclusion at the highest number, and contiguous numbering with no gaps; titles parse by stripping the fixed prefix, never by splitting on dashes (today's deck proves compound titles containing dashes are real); files not matching the pattern, and all non mp4 files, are logged and excluded (desktop.ini proves stray files reach these folders); durations omitted initially; activation sticky per downloaded version; first activation flagged for Francisco's spot check. Groundwork landing in this release: permanent course ids (A3), the data driven Coming Soon gate (thumbnails plan 2.3), the manifest listing the folders (B4), and the pattern parser and exclusion rules (A7).
