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
## Gate-1 E2E Proof
<details><summary>Playwright Output</summary>

`	ext
Running 2 test files using 1 worker

  ?  1 [app] > tests/e2e/app.spec.ts:5:7 > App Integration > boot with poisoned storage (3.1s)
  ?  2 [app] > tests/e2e/app.spec.ts:44:7 > App Integration > post-boot injected unhandled rejection (2.2s)
  ?  3 [fixtures] > tests/e2e/fatal.spec.ts:6:7 > Fatal Error Fallbacks > React error boundary fallback (1.1s)
  ?  4 [fixtures] > tests/e2e/fatal.spec.ts:16:7 > Fatal Error Fallbacks > Unhandled rejection handler (1.0s)
  ?  5 [fixtures] > tests/e2e/fatal.spec.ts:25:7 > Fatal Error Fallbacks > Raw fallback when container is missing (0.9s)
  ?  6 [fixtures] > tests/e2e/fatal.spec.ts:44:7 > Fatal Error Fallbacks > Raw fallback unhandled rejection when container is missing (0.8s)

  6 passed (9.1s)
`
</details>

## Gate-1 Screenshot Hashes
`json
{
  "candidateCodeSha": "e5fb89a3c80409080b85f4a2d21bc64880f4bf15",
  "environment": {
    "os": "win32",
    "playwrightVersion": "Version 1.62.1",
    "chromiumBuild": "bundled",
    "viewport": "1440x900",
    "dpr": 1,
    "locale": "en-US",
    "timezoneId": "America/New_York",
    "colorScheme": "light",
    "videoPolicy": "forced poster state (currentTime=0, paused)"
  },
  "hashes": {
    "passA": {
      "home-course-list": "fc1a6497421b6347f81270f896f96fd4f86bd36526032a17844be8ded7e2bd6b",
      "chapter-player": "ef84642e4a0493716fe54c3c03af6c9fcbccf53c155ae6bc93f059aa965b7f4a",
      "slideshow-slide": "c3e27b8e03128b01b9c2b424226c05463fc6054a881d263c4afc465a3200dc84",
      "manual-page": "c999d12f03b7f635f6cf257748d43248e30341f82e8a612086cd974abc0dd63b",
      "send-certs": "affaa6570cf3ebb14fd7d823e8fb79f38a0e10fa99b1a440d8fea12bb1a901df",
      "how-to": "a7cade0f4826a024b7c2de4c153ccb801eed584eac8210f89180b6d2e5568585",
      "offline-modal": "5f9f9aac91e44983c48e951a1da60e8ccda5bbe99aa6cfe4e3237a1053388ca7",
      "coming-soon": "b6da7976646408217a32b4d68ef0f4ca95348fd6251262494d7a79b81f110ad5"
    },
    "passB": {
      "home-course-list": "fc1a6497421b6347f81270f896f96fd4f86bd36526032a17844be8ded7e2bd6b",
      "chapter-player": "ef84642e4a0493716fe54c3c03af6c9fcbccf53c155ae6bc93f059aa965b7f4a",
      "slideshow-slide": "c3e27b8e03128b01b9c2b424226c05463fc6054a881d263c4afc465a3200dc84",
      "manual-page": "c999d12f03b7f635f6cf257748d43248e30341f82e8a612086cd974abc0dd63b",
      "send-certs": "affaa6570cf3ebb14fd7d823e8fb79f38a0e10fa99b1a440d8fea12bb1a901df",
      "how-to": "a7cade0f4826a024b7c2de4c153ccb801eed584eac8210f89180b6d2e5568585",
      "offline-modal": "5f9f9aac91e44983c48e951a1da60e8ccda5bbe99aa6cfe4e3237a1053388ca7",
      "coming-soon": "b6da7976646408217a32b4d68ef0f4ca95348fd6251262494d7a79b81f110ad5"
    }
  },
  "unexpectedErrors": 0
}
`

## Current state (session handoff)
- **Completed:** P6a (deterministic screenshot harness rewrite), P3 (cold E2E run stabilization), P5b/P6b (evidence collection).
- **In progress:** Gate 1 fix round 4 (v1.3 final).
- **Next steps:** Final verification and commit push (P8).
