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
- Branch Rule: `web-app` is the integration branch; `web-production` is the only PRODUCTION branch.

## Current state (session handoff)

- **Completed most recently**: Gate 1 Fix Round 4 - P4 completed. Fixed Playwright E2E test locator timeouts, removed forced clicks, added visibility assertions.
- **In progress**: Gate 1 Fix Round 4 - Currently completing P5a evidence groundwork.
- **Immediate next task**: P6a (deterministic screenshot harness) and P5b (record Gate-1 evidence).
- **Known-broken or untested areas**: Gate 1 verification baseline and screenshot evidence is pending collection.

## Build/Bundle Measurements
PENDING

## Browser/Chromium/Codec Evidence
PENDING

## Layer-1 Content Matrix
PENDING

## 390 px Smoke
PENDING

## Tauri Isolation Inventory
PENDING

## Screenshot Determinism
PENDING

## R9/Full Verification
PENDING

## Smoke Test Verification (R8)
R8 desktop smoke: PENDING — requires human observation (Francisco).
