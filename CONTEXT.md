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

- **Completed most recently**: Phase 2 implementation is complete in the working tree: external Presenter, fullscreen and display-sleep coordination, picker-only verified USB import, channel-specific DMG/MAS entitlements, and the mandatory C2-C4 download corrections. Static, unit, production-build, dual-architecture, R2 URL, and Tauri MAS-overlay compile gates pass.
- **In progress**: Phase 2 is not signed off or committed. Its physical hardware gates run at the next reference-Mac session and must pass before the phase is named complete.
- **Immediate next task**: Run the carried full-course offline playback and cold offline launch gates first, then the complete external-display, sleep/wake, fullscreen, and USB import/cancel/resume/low-space/offline drills in `docs/reports/macOS_Phase_2_Report.md`.
- **Known-broken or untested areas**: No code failure is presently known. Physical Presenter behavior, display assertions, MAS security-scoped USB access, `tmutil` exclusion, complete corrupt-snapshot recovery, signing, packaging, App Store Connect, and App Review remain unverified. The five npm audit findings affect build/development tooling only and are not included as Node packages in the Tauri runtime; upgrades remain deferred for controlled compatibility testing.
