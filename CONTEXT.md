# Context

- Stack: Tauri 2, Rust backend, React 19, Vite.
- Release Target: This branch targets the Windows release. macOS lives on separate branches and is ported later. A separate native iOS app exists on other branches.
- Source of Truth: The Cloudflare R2 bucket served at media.ehacademy.com is the single source of truth for all media content.
- `src/chapters.ts` must always match the single source of truth, enforced at build time by the reconciliation tooling.
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

- **Completed most recently**: Finished Phase 1 — Web-mode correctness, resilience, isolation proof, harness. Fixed Playwright E2E test locator timeouts and refined TS typing of the Tauri seam injection for `download-manager.ts` and `snapshot-store.ts`. Passed all Gate 1 tests (`tsc`, `build`, Playwright, and `verify-media-urls`). Performance baseline established: entry chunk is 175.00 kB.
- **In progress**: Ready for Phase 2 - Pages, production branch, rollback readiness (Francisco, guided).
- **Immediate next task**: Handoff to Francisco for Gate 1 audit and branch promotion.
- **Known-broken or untested areas**: None. Phase 1 is complete.

## Download Surfaces Gated by isTauri
- src/components/Sidebar.tsx:276 (Manual items)
- src/components/Sidebar.tsx:376 (Slideshow slides)
- src/components/Sidebar.tsx:474 (Video chapters)
- src/components/Sidebar.tsx:639 (Settings Download All)
- src/App.tsx:73 (Content update sync)
- src/App.tsx:458 (First launch prompt)

## Tauri Isolation Inventory
All Tauri API calls have been gated behind isTauri and converted to dynamic imports to prevent breaking web environments.

Inventory of dynamic @tauri-apps imports:
src\download-manager.ts:138:      const { listen } = await import('@tauri-apps/api/event');
src\download-manager.ts:288:      const { invoke } = await import('@tauri-apps/api/core');
src\download-manager.ts:416:      const { invoke } = await import('@tauri-apps/api/core');
src\download-manager.ts:507:      const { invoke } = await import('@tauri-apps/api/core');
src\download-manager.ts:635:      const { invoke } = await import('@tauri-apps/api/core');
src\snapshot-store.ts:24:        const { invoke } = await import('@tauri-apps/api/core');
src\snapshot-store.ts:41:        const { invoke } = await import('@tauri-apps/api/core');
src\snapshot-store.ts:55:        const { invoke } = await import('@tauri-apps/api/core');
src\snapshot-store.ts:82:        const { invoke } = await import('@tauri-apps/api/core');
src\snapshot-store.ts:105:        const { invoke } = await import('@tauri-apps/api/core');
src\App.tsx:91:        const { invoke } = await import('@tauri-apps/api/core');
src\App.tsx:176:        const { check } = await import('@tauri-apps/plugin-updater');
src\App.tsx:225:          import('@tauri-apps/api/core').then(({ invoke }) => {
src\App.tsx:566:          const { invoke } = await import('@tauri-apps/api/core');
src\App.tsx:989:          import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
src\App.tsx:996:          import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
src\App.tsx:1146:                    const { relaunch } = await import('@tauri-apps/plugin-process');
src\utils\browser.ts:6:      const { invoke } = await import('@tauri-apps/api/core');
src\components\ManualFlipbook.tsx:233:      const { getCurrentWindow } = await import('@tauri-apps/api/window');
src\components\ManualFlipbook.tsx:259:          const { getCurrentWindow } = await import('@tauri-apps/api/window');
src\utils\boot.tsx:19:    import('@tauri-apps/api/core').then(({ invoke }) => {

Per-hit gating mechanism: Every single occurrence listed above is either strictly inside an if (isTauri) block or uses a isTauri ? import(...) : fallback() pattern to prevent execution on web clients. The step-6 tests in tests/e2e/fatal.spec.ts act as the executable proof that rendering doesn't crash on web mode due to Tauri imports.
