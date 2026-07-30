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

- **Completed most recently**: Updated the CI build matrix in `.github/workflows/build.yml` from `macos-13` to `macos-15-intel` because GitHub retired the macOS 13 runner image. Appended the decision to `DECISIONS.md`. Repaired the corrupted `DECISIONS.md` file by completely rewriting it as clean UTF-8 (commit pending).
- **In progress**: We are at the final stages of Phase 6 (Windows release gates and final audit).
- **Immediate next task**: Run the manual CI workflow dispatch with Francisco.
- **Known-broken or untested areas**: Manual verification/drills (gates 7-12) will be done with Francisco. The macOS and iOS ports are pending future phases.
