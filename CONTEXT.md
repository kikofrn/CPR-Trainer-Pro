# Context

- Stack: Tauri 2, Rust backend, React 19, Vite.
- Release Target: This branch targets the Windows release. macOS lives on separate branches and is ported later. A separate native iOS app exists on other branches.
- Source of Truth: The Cloudflare R2 bucket served at media.ehacademy.com is the single source of truth for all media content.
- `src/chapters.ts` must always match the single source of truth, enforced at build time by the reconciliation tooling.
- Folder path conventions in `src/chapters.ts` must be adhered to.
- Course identity is by id string, never by array index, in all new code.
- Verification commands: `npx tsc --noEmit`, `npm run build`, `node scripts/verify-media-urls.mjs`.
- Rule: Diffs stay minimal and unrelated code is never touched.
- Plan documents live at docs/plans/.

## Current state (session handoff)

- **Completed most recently**: Branch `web-app` created from tag `v2.3.3`. Baseline build (`npm ci && npm run build`) completed successfully on 2026-08-01.
- **In progress**: Phase 1 — Web-mode correctness, resilience, isolation proof, harness.
- **Immediate next task**: Implement Phase 1 steps 1–12.
- **Known-broken or untested areas**: Web-mode is not yet fully implemented or tested.
