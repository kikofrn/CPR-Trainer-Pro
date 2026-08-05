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

- **Completed most recently**: Phase 2, Phase 2.2, and Phase 2.2b are signed off after their audit and reference-Mac hardware checks. Phase 3 implements the release scrub in the seven-commit order required by `docs/plans/CPR_Trainer_Pro_macOS_Phase3_Prompt.md`: `.DS_Store` ignores; LICENSE and full-history gitleaks scanning; dead dialog-plugin removal; unreferenced root-scratch deletion; a literal-`false` collapsed sidebar default; the narrow manual-title clipping fix; and the manual-close source invariant.
- **In progress**: Phase 3 final automated acceptance, push, Claude's commit-by-commit audit, and Francisco's short hardware confirmation pass. Phase 4 has not started.
- **Immediate next task**: Finish the Phase 3 acceptance matrix and push `mac-build`, then complete Claude's audit and the collapsed-cold-start, Settings-reachability, narrow-header, USB auto-detection, and Presenter spot checks before Phase 4 opens.
- **Known-broken or untested areas**: Removing the manual USB picker leaves no in-app import fallback if polling cannot recognize the conference drive; this remains an explicit product tradeoff, not a hidden recovery path. The Phase 3 manual-close guard is source-level because this branch has no DOM harness and must be replaced by a component-level test post-conference. `tmutil` exclusion, complete corrupt-snapshot recovery, signing, notarization, universal packaging, App Store Connect, and App Review remain unverified. The five npm audit findings affect build/development tooling only and are not included as Node packages in the Tauri runtime; upgrades remain deferred for controlled compatibility testing.
