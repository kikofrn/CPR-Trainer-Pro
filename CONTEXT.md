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

- **Completed most recently**: Canonical macOS Plan v2.1 Phase 0 in this commit: created the isolated `mac-build` worktree from pinned source `3ced294`, removed Windows/updater surfaces, synchronized version 3.0.0, and passed frontend, Rust ARM/Intel, R2 URL, and catalog gates.
- **In progress**: Phase 0 is complete; Phase 1 has not started.
- **Immediate next task**: Implement Phase 1 Mac storage, protocol/download hardening, local fonts, CSP, scoped opener, and atomic snapshots.
- **Known-broken or untested areas**: The current inherited media path and URL scheme are still Windows-oriented and are intentionally addressed in Phase 1. Presenter, USB import, signing, packaging, and physical hardware gates remain later phases. The dependency audit reports five inherited findings (two low, three high); no automatic audit fix was applied.
