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

- **Completed most recently**: Phase 1.1 in this commit: initialized and canonicalized the Application Support media root once, cached it for protocol and command access, and made backup-exclusion metadata best-effort rather than playback-fatal. The Phase 1 verification record was also corrected to distinguish JavaScript manifest validation from Rust's hardcoded path allowlist and to remove unverified recovery and memory claims.
- **In progress**: Phases 0, 1, and 1.1 are complete; Phase 2 has not started.
- **Immediate next task**: Implement Phase 2 Presenter on a second display, preserving the independent audience-window contract and validating display attach/detach behavior on physical hardware.
- **Known-broken or untested areas**: Presenter, USB import, signing, packaging, App Store Connect, and final physical hardware gates remain later phases. A complete course has not yet been downloaded and played fully offline, cold offline launch has not been measured, and corrupt-snapshot recovery has not been exercised end to end. Phase 2 must add If-Range resume validation, cancellation/retry coordination, and manifest cache expiry. The five npm audit findings affect build/development tooling only and are not included as Node packages in the Tauri runtime; upgrades remain deferred for controlled compatibility testing.
