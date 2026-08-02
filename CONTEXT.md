# Context

- Stack: React 19, Vite, Tauri 2, TypeScript.
- Web integration branch: `web-app`; `web-production` remains prohibited until Gate 1 passes and Francisco promotes an approved SHA.
- Governing plan: `docs/plans/CPR_Trainer_Pro_Web_App_Plan_v5.1_canonical.md` plus the authorized Gate-1 recovery corrections.
- Cloudflare R2 at `media.ehacademy.com` is the media source of truth; `src/chapters.ts` remains frozen and must reconcile with it.
- Course identity is by string ID, never array position, in new code.
- Public-repository rules: no secrets, machine paths, evidence binaries, or blanket staging.

## Gate-1 recovery controls

- Recovery start SHA: `3d0e99a7ea2cd56642265210ab95d9706d4fdebf`.
- Round anchors retained for audit: `b550d6c`, `51c8cca`, `f188af9`, and HeaderNav parity anchor `898e28d`.
- Gate 1 is not passed. Claude is the sole independent auditor for this recovery; Francisco owns P9/R8 desktop smoke.
- Gate 1 creates the first approved visual reference. Historical unapproved SHAs are not visual baselines.
- Spanish editions remain data-dormant and have no interactive route; accepted static guide prose may mention future Spanish modules.

## Build and bundle evidence

PENDING at the immutable recovery candidate SHA.

## Browser, Chromium, and codec evidence

- Harness toolchain: Playwright `1.62.1`; bundled Chromium `151.0.7922.34` on the implementation machine.
- CI installs bundled Chromium with `npx playwright install --with-deps chromium`, runs only the four-test default config, keeps output under `${{ runner.temp }}`, and uploads the HTML report with 14-day retention. The 16-row Gate-1 matrix remains an explicit, separate audit command.
- Official browser and codec evidence remains PENDING at the immutable recovery candidate SHA.

## Gate-1 content matrix

Implementation complete and pre-candidate verification passed 16/16 in one serial worker. Official evidence remains PENDING until it is regenerated from the immutable final candidate SHA.

## Screenshot reference determinism

Harness implementation complete. A seven-surface pre-candidate run produced two byte-identical passes with zero console errors, page errors, or unhandled rejections. Official first-reference evidence remains PENDING regeneration at the immutable final candidate SHA. The old Round-4 hashes remain invalid.

## Tauri isolation inventory

PENDING regeneration from the final candidate.

## R9 full verification

PENDING final clean-install verification.

## Smoke Test Verification (R8)

R8 desktop smoke: PENDING — requires human observation (Francisco).

## Current state (session handoff)

- Completed: C1 `c2991ae` restored boot parity and passed 17/17 focused unit tests; C2 `8081611` stabilized the default Playwright suite and passed 4/4.
- Completed: C3 `4d0ba41` added the isolated matrix; discovery is exactly 16 tests in one file and the complete serial pre-candidate run passed 16/16 in 1.9 minutes.
- Completed: C4 `b870683` made the seven-surface screenshot harness deterministic; both pre-candidate passes were byte-identical with all strict runtime-error channels empty.
- Completed: C5 `44bcbd2` added the four-test default E2E suite to web CI and marked only the now-complete Phase 1 harness checkbox; lint, 34/34 unit tests, production build, and 4/4 default E2E tests passed.
- Completed: C6 `7c7c51d` added the accepted F4 CI artifact-upload requirement so the redirected HTML report remains retrievable without touching the worktree.
- Completed most recently: C7 reconciled canonical-plan §3.6-C with Francisco's approved fast-default-E2E CI governance while retaining the isolated matrix as an audit-only command.
- In progress: verify and commit C7, then freeze the immutable candidate and regenerate all official evidence from that exact SHA.
- Untested or known-broken: official candidate evidence, clean verification, archives, push, independent audit, and R8 are pending.
- Gotcha: no evidence from the prior Round-4 `CONTEXT.md` is trustworthy; only newly captured raw logs and checksums may be recorded.
