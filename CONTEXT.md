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

PENDING at the immutable recovery candidate SHA.

## Gate-1 content matrix

Implementation complete and pre-candidate verification passed 16/16 in one serial worker. Official evidence remains PENDING until it is regenerated from the immutable final candidate SHA.

## Screenshot reference determinism

PENDING. The old Round-4 hashes are invalid because they were produced by an unproven harness and wrong candidate record.

## Tauri isolation inventory

PENDING regeneration from the final candidate.

## R9 full verification

PENDING final clean-install verification.

## Smoke Test Verification (R8)

R8 desktop smoke: PENDING — requires human observation (Francisco).

## Current state (session handoff)

- Completed: C1 `c2991ae` restored boot parity and passed 17/17 focused unit tests; C2 `8081611` stabilized the default Playwright suite and passed 4/4.
- Completed most recently: C3 isolated matrix implementation; discovery is exactly 16 tests in one file and the complete serial pre-candidate run passed 16/16 in 1.9 minutes.
- In progress: commit C3, then implement the deterministic seven-surface screenshot harness.
- Untested or known-broken: official candidate evidence, screenshot reference, CI/governance, clean verification, archives, push, independent audit, and R8 are pending.
- Gotcha: no evidence from the prior Round-4 `CONTEXT.md` is trustworthy; only newly captured raw logs and checksums may be recorded.
