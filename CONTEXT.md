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

- **Completed most recently**: Hardened build.yml with least-privilege permissions and explicit releaseDraft false. Dropped scratch python scripts with personal paths. Removed legacy release.yml that raced the new release job on v* tags. Updated `.github/workflows/build.yml` so the matrix job is a compile check on all triggers and added a dedicated Windows-only release job for tags. Enabled `createUpdaterArtifacts` in `tauri.conf.json`, changed the updater endpoint to `latest.json`, and rotated the pubkey. Appended the decision to `DECISIONS.md`.
- **In progress**: We are at the final stages of Phase 6 (Windows release gates and final audit).
- **Immediate next task**: Run the manual CI workflow dispatch with Francisco.
- **Known-broken or untested areas**: Manual verification/drills (gates 7-12) will be done with Francisco. The macOS and iOS ports are pending future phases.
