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

- **Completed most recently**: Claude accepted Phase 2.1 at `fd84685`, and the Aug 3 reference-Mac session passed the carried offline-launch/playback, Presenter, external-display, sleep/wake, fullscreen, and USB import drills. That session found the presenter-subtitle toggle and return-home desynchronization defects and authorized Phase 2.2; the same round removes the public folder-picker icon in favor of conference-drive auto-detection.
- **In progress**: Phase 2.2 is implemented as three scoped commits (F1, EXIT-GUARD, USB-REDESIGN) for Claude's commit-by-commit audit. Phase 2 sign-off remains pending that audit and the targeted hardware re-verification below.
- **Immediate next task**: Claude audits the three Phase 2.2 commits. After approval, re-run Drill 3-A step 6 for the presenter subtitle toggle, Drill 3-C for blocked return-home actions, and the staged-drive auto-detection flow (banner within about four seconds, dismiss, unplug/reinsert, import).
- **Known-broken or untested areas**: Removing the manual USB picker leaves no in-app import fallback if polling cannot recognize the conference drive; this is an explicit product tradeoff, not a hidden recovery path. The new auto-detection behavior and the three targeted hardware re-checks remain physically unverified. MAS security-scoped USB access is no longer a target because the future MAS build will omit conference USB import. `tmutil` exclusion, complete corrupt-snapshot recovery, signing, packaging, App Store Connect, and App Review remain unverified. The five npm audit findings affect build/development tooling only and are not included as Node packages in the Tauri runtime; upgrades remain deferred for controlled compatibility testing.
