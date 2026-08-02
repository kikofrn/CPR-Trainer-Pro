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

PENDING. Required evidence is 15 content rows plus one interactive Spanish-route guard.

## Screenshot reference determinism

PENDING. The old Round-4 hashes are invalid because they were produced by an unproven harness and wrong candidate record.

## Tauri isolation inventory

PENDING regeneration from the final candidate.

## R9 full verification

PENDING final clean-install verification.

## Smoke Test Verification (R8)

R8 desktop smoke: PENDING — requires human observation (Francisco).

## Current state (session handoff)

- Completed most recently: C1 source repair in progress—zero-byte Playwright files restored, fatal E2E expectation returned to historical behavior, and boot logging parity pinned in unit tests.
- In progress: Gate-1 recovery implementation on top of `3d0e99a`.
- Immediate next task: verify and commit C1, then stabilize the default Playwright suite in C2.
- Untested or known-broken: C1 changes have not yet passed verification; deep matrix, screenshot reference, clean verification, archives, push, CI, audit, and R8 are pending.
- Gotcha: no evidence from the prior Round-4 `CONTEXT.md` is trustworthy; only newly captured raw logs and checksums may be recorded.
