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

- **Completed most recently**: Canonical macOS Plan v2.1 Phase 1 in this commit: moved media into Application Support, added backup exclusion, hardened the custom protocol and downloader, made snapshots atomic and self-healing, removed hosted fonts, narrowed CSP and external-link permissions, and passed live large-media, cancellation/resume, corruption-recovery, ARM/Intel, frontend, R2 URL, and catalog gates.
- **In progress**: Phases 0 and 1 are complete; Phase 2 has not started.
- **Immediate next task**: Implement Phase 2 Presenter on a second display, preserving the independent audience-window contract and validating display attach/detach behavior on physical hardware.
- **Known-broken or untested areas**: Presenter, USB import, signing, packaging, App Store Connect, and final physical hardware gates remain later phases. A complete course has not yet been downloaded and played fully offline; the Phase 1 gate used a 168 MB video, a 65 MB PDF, thumbnails, repeated seeking, and live recovery tests. The dependency audit reports five inherited findings (two low, three high); no automatic audit fix was applied.
