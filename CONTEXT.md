# Context

- Stack: Tauri 2, Rust backend, React 19, Vite.
- Release Target: This branch is the macOS 3.0 release line. Windows remains on `experiment-3.1`; the native iOS release remains isolated on its own branches.
- Source of Truth: The Cloudflare R2 bucket served at media.ehacademy.com is the single source of truth for all media content.
- `src/chapters.ts` must always match the single source of truth, enforced at build time by the reconciliation tooling.
- Folder path conventions in `src/chapters.ts` must be adhered to.
- Course identity is by id string, never by array index, in all new code.
- Verification commands: `npx tsc --noEmit`, `npm run build`, `node scripts/verify-media-urls.mjs`.
- Rule: Diffs stay minimal and unrelated code is never touched.
- Plan documents live at docs/plans/.

## Current state (session handoff)

- **Completed most recently**: Phase 3 is signed off at `fc4825c`. Phase 4's release-only config and tag-triggered universal Developer ID workflow are now implemented on `mac-build`, but no signed candidate has run yet, so signing, app/DMG notarization, stapling, and universal packaging remain implemented-but-unproven.
- **In progress**: Independent review of the Phase 4 implementation, followed by Francisco creating the first strict `mac-v3.0.0-rcN` candidate tag, downloading the resulting quarantined DMG, recording its workflow run and SHA-256, and completing the full reference-Mac hardware battery.
- **Immediate next task**: If candidate CI and hardware QA pass, place `mac-v3.0.0` on exactly the approved candidate commit, let CI create a new signed/notarized final DMG and draft release, run the abbreviated smoke on that final DMG, and obtain separate publication authorization. Phase 4b conference-drive staging follows Phase 4 sign-off.
- **Known-broken or untested areas**: The actual p12 contents, notarization credentials, Apple service turnaround, universal build, signatures, tickets, Gatekeeper results, and downloaded-DMG behavior remain unverified until the first candidate run and hardware battery. The workflow proves source identity and candidate CI success but cannot prove which successful candidate artifact Francisco tested; the run URL and SHA-256 must be retained. The final build is different signed bytes and requires its own abbreviated smoke. Native dSYMs remain deliberately deferred for macOS 3.0.0, so native crashes cannot be fully symbolized later. Mac App Store work remains on hold.
