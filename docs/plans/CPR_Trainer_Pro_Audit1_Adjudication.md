# CPR Trainer Pro: Audit 1 Adjudication (Fable review of Gemini's Phase 0.2 critique)

July 26, 2026. This document is the binding output of Fable Audit 1 defined in CPR_Trainer_Pro_Execution_Playbook_v2.md. Gemini must read it alongside the plan documents. Where an amendment below conflicts with plan v3 or the playbook prompts, the amendment wins. Amendments apply at their named phases; nothing here pulls later phase work forward.

---

## Verdicts by critique point

### 1. HeaderNav thumbnail fallback via onError causes a broken image flash. ACCEPTED, with amendment AM6.

Correct in substance. The media protocol returns 404 for missing files, so an onError driven fallback pays one failed request and a possible flash per render before the thumbnail is downloaded. Note the thumbnails plan section 3.1 already offered the status map as the alternative ("via an onError handler or an existence check through the already loaded status map"); the adjudication makes the status map the required primary mechanism and keeps onError only as a last resort guard. See AM6.

### 2a. Missing delete_media_file Rust command. ACCEPTED as a gap, Gemini's proposed fix REJECTED, replaced by AM2.

The gap is real: the plan told queueSpecificFiles to delete files and no delete command exists, so as written the plan was unimplementable. However, adding a delete command is the wrong fix. Deleting before downloading creates a window in which the old file is gone and nothing is playable, and it is unnecessary: the existing download flow writes to a .tmp and renames over the destination, and Rust's rename on Windows maps to MoveFileEx with replace-existing semantics, so overwrite is already atomic and the old file stays playable until the swap instant. No delete command will be added. The already-downloaded skip is a frontend queue filter, not a disk constraint, and queueSpecificFiles simply does not apply that filter.

Adjudication bonus finding, mandatory: the downloader resumes partial .tmp files via byte ranges. A version pinned download that resumes a stale .tmp left by a previous version would splice bytes from two different file versions into one corrupt file. Therefore, whenever a version parameter is present, the Rust command must ignore any existing .tmp and start from byte zero. See AM2.

### 2b. avgSpeedBps persistence is missing from the code. REJECTED as a plan gap, ACCEPTED as a prompt clarification, amendment AM4.

Plan v3 section B5 already specifies avgSpeedBps in the snapshot schema and says DownloadManager updates it with exponential decay after each completed download; this is scheduled Phase 4 work, not a missing dependency. The fair kernel: playbook prompt 4c did not name the write location. AM4 pins it and adds a serialization detail the plan lacked (two writers, one JSON file).

### 3a. Version parameter passed via the filename would break encoding and the destination path. REJECTED as a conflict; the plan already forecloses it.

Plan v3 B1 and playbook prompt 4a specify an optional version argument on download_media_file, appended to the URL as a query parameter after the encoded path, with the destination path unchanged. Gemini's "step that should change" number 1 restates this design verbatim. No amendment needed; AM2 simply reaffirms the signature.

### 3b. DownloadState.queue is string[] and cannot carry a version. ACCEPTED, amendment AM3.

Genuine catch. The queue type must change for the version to reach the Rust invoke.

### 4. checkAllStatuses after an update batch is redundant overhead. ACCEPTED, with a stricter fix than proposed, amendment AM5.

Dropping the call entirely, as Gemini suggested, would leave first time thumbnail downloads with stale statuses, which matters once AM6 drives the thumbnail src from the status map. The right fix is per file, in memory: on each successful completion, set that file's status true and notify. No disk sweep, no staleness.

### 5a. Windows file locking during rename will likely crash background downloads. ACCEPTED as a risk, severity downgraded with corrected mechanics, amendments AM2 and AM7.

The stated mechanism is not how this app holds files. The webview never opens media files; only the Rust protocol handler touches disk, and it reads and closes per range request. Rust opens files with read, write, and delete sharing on Windows, so a rename-replace during playback is generally permitted even mid-read. The realistic residual risk is third party handle holders (antivirus, indexers) without sharing flags. Mitigation: bounded retry with backoff on the final rename, and the snapshot-on-success design already self heals any persistent failure on the next launch. Gemini's proposed pause-playback and unload-source step is rejected as machinery the failure mode does not justify, particularly since update application is initiated from the startup prompt.

### 5b. mediaReady now depends solely on waitForMediaResolver with no timeout. ACCEPTED, amendment AM1.

Pre-existing exposure rather than one introduced by A5, but real and cheap to close, and it serves the exact stability goal of A1. A failsafe lands in Phase 1.

---

## Binding amendments

### AM1 (Phase 1, extends A1/A5)
In src/App.tsx, the splashscreen close path gets two guards: waitForMediaResolver's failure path must still set mediaReady true (attach a catch; a broken resolver should surface as missing media in the UI, never as a permanent splashscreen), and an absolute failsafe timer (10 seconds) closes the splashscreen regardless of resolver state. Minimal diff; no other splash behavior changes.

### AM2 (Phase 4a, extends B1 and prompt 4a)
download_media_file signature gains `version: Option<String>`. Destination path is built from the clean filename exactly as today and never contains the version. The version is appended to the request URL as `?v=<value>` only after path encoding. When version is Some, any existing .tmp for the file is ignored and the download restarts from byte zero (prevents cross version resume corruption). The final rename gains a bounded retry: up to 5 attempts with doubling backoff starting at 200 ms; on persistent failure, remove the .tmp, report the file as failed, and leave the old file intact. No delete_media_file command is added; if any future work genuinely requires a delete command, it must carry the same path traversal guard as the media protocol, but nothing in this release requires it.

### AM3 (Phase 4c, extends B5 and prompt 4c)
Refactor DownloadState.queue from string[] to `{ filename: string; version?: string }[]`. downloadNext reads the object, passes filename everywhere a string is used today (progress bookkeeping, currentFile, statuses) and passes version into the download_media_file invoke. queueSpecificFiles performs no deletion and does not apply the already-downloaded skip filter. Keep the refactor mechanical; no behavior changes to the existing bulk flow beyond the type.

### AM4 (Phase 4c, extends B5)
Create a small snapshot store module (src/snapshot-store.ts) that owns all reads and writes of .content-versions.json through the Rust commands and serializes writes through a promise queue, so the startup checker and the download manager cannot interleave read-modify-write cycles and clobber each other. DownloadManager updates avgSpeedBps through this module after each completed download (exponential decay of the measured speed). The checker's per file etag writes on update success go through the same module.

### AM5 (Phase 4c and 4e, amends B5)
Remove the checkAllStatuses call from the queueSpecificFiles completion path. On each individual successful download, set fileStatuses for that filename to downloaded in memory and notify subscribers. First time downloads (thumbnails included) and replacements are both covered with zero disk sweeps.

### AM6 (Phase 5, amends Thumbnails plan 3.1)
Thumbnail rendering resolves its src from the status map: if the registry file's status is downloaded, use mediaUrl for the local copy; otherwise use the bundled fallback path. The thumbnail registry keys are added to the startup status check set so the map covers them. onError remains on the img elements as a secondary guard only (covers a file deleted from disk between checks), never as the primary fallback mechanism.

### AM7 (risk register note, no code)
The Windows locking risk is recorded as: transient third party handle contention on rename, mitigated by AM2's retry and the snapshot self heal; the webview holds no media file handles by architecture. No pause-playback machinery is added. If Phase 6 gate 9 (live update drill) or gate 10 ever surfaces a reproducible rename failure during active playback, this verdict reopens with evidence.

---

## Instructions to Gemini

Proceed to Phase 1 using playbook prompt 1 with AM1 added to its scope and acceptance criteria (the failsafe is part of the Phase 1 verification report). Amendments AM2 through AM5 activate at their Phase 4 sub phases; AM6 activates at Phase 5; carry them forward without implementing early. Everything else in plan v3 and the playbook stands as written.
