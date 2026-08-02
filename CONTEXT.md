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

- **Completed most recently**: Phase 2 was pushed at `2fca895`, then Phase 2.1 fixed its audited slideshow-ref regression, presentation-time switching gap, manifest single-flight race, completed-partial HTTP 416 retry trap, and accepted record/UX follow-ups. Phase 2.1 static, unit, production-build, formatting, and dual-architecture compile gates pass.
- **In progress**: Phase 2.1 is committed on `mac-build` for Claude spot-verification before the physical hardware session. Phase 2 remains unsigned.
- **Immediate next task**: Claude spot-verifies the Phase 2.1 diff. On approval, run the carried full-course offline playback and cold offline launch gates first, followed by the complete external-display, sleep/wake, fullscreen, course-switch blocking, and USB import/cancel/resume/low-space/offline drills in `docs/reports/macOS_Phase_2_Report.md`.
- **Known-broken or untested areas**: No automated Phase 2.1 gate is failing. The development app launched, but the automation interface returned no inspectable UI state, so video-to-video control continuity and local slide-video muting were not claimed as manually observed. Physical Presenter behavior, display assertions, MAS security-scoped USB access, `tmutil` exclusion, complete corrupt-snapshot recovery, signing, packaging, App Store Connect, and App Review remain unverified. The five npm audit findings affect build/development tooling only and are not included as Node packages in the Tauri runtime; upgrades remain deferred for controlled compatibility testing.
