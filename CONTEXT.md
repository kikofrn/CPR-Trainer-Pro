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

- **Completed most recently**: Implemented v2.3.4 Windows release round: Azure Trusted Signing during bundling, F1 foreground gating for update prompt, F2 atomic/self-healing snapshot, constant-name release asset, and version bump.
- **In progress**: Round 2.3.4 implementation complete, awaiting local verification and release.
- **Immediate next task**: Report SHA commits and test/build outcomes to Francisco, and wait for his explicit authorization to tag and release v2.3.4.
- **Known-broken or untested areas**: F8 edge-case cluster, S1-S4 security cherry-picks, and other deferred tasks are out of scope for this round and scheduled for 2.3.5.
