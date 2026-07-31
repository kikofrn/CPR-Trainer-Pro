# CPR Trainer Pro iOS - Standing Rules

## Memory discipline (most important)

You have no memory between chat sessions. The repo is your memory. Keep it
current as you work and never batch this to the end of a session, because
sessions end abruptly.

After completing each meaningful step, phase, or fix, and before moving to the
next one:

1. Commit the work, staging explicit paths only.
2. If the step involved a non-obvious choice, append it to
   `docs/IOS_IMPLEMENTATION_DECISIONS.md` under today's date or the appropriate
   existing section. Record both the decision and its reason.
3. Refresh the `## Current state (session handoff)` section at the end of
   `ios-native/CONTEXT.md` so it reflects reality right now: what was just
   completed with commit SHAs, what is in progress and how far, the immediate
   next task, what is untested or known-broken, and any gotcha a fresh session
   would trip over.
4. If working from a plan in `docs/plans/`, check off completed checklist items
   in that plan file and commit the update.

Treat `ios-native/CONTEXT.md` and
`docs/IOS_IMPLEMENTATION_DECISIONS.md` as refreshable working memory, not
archives. If asked to close out or hand off, perform the steps above, push, and
report the diff summary.

## Git rules

- Never run `git add -A`. This is a public repository, so always stage explicit
  paths.
- Never commit secrets, tokens, `.env` files, downloaded course media, build
  products, or device diagnostics.
- Keep iOS work on the explicitly authorized `iOS-final-build` or
  `codex/ios-*` branch. Do not merge, tag, or begin another implementation round
  without Francisco's authorization.
- Push at the end of every working session even if work is unfinished. An
  automated daily watch reads the repository, and unpushed work is invisible
  to it. Build 14 already sat unpushed long enough to produce a false status
  report that nothing had moved since July 28; do not repeat that failure.

## Track and code rules

- Stack: SwiftUI and AVFoundation, minimum iOS 17 and watchOS 10.
- The iOS target is universal for iPhone and iPad. Preserve
  `TARGETED_DEVICE_FAMILY = "1,2"`.
- Diffs stay minimal. Never touch unrelated code or restore a superseded
  constraint without reading `docs/IOS_IMPLEMENTATION_DECISIONS.md`.
- Plan documents live in `docs/plans/`. Implement an authorized plan exactly,
  without scope additions. If the plan appears wrong, stop and report the
  conflict instead of improvising.

## Verification and hardware gates

- Before declaring implementation work done, run a Release build that includes
  embedded Watch binary validation and run the `CPRTrainerProTests` suite.
- Simulator and static checks do not certify physical-device behavior.
  Anything requiring an iPhone or iPad, an external display or receiver, HDMI,
  an Apple Watch, or a TestFlight/App Store install remains an open hardware
  gate for Francisco. Report the gate clearly and never mark it passed from code
  inspection.

## Working relationship

Francisco authorizes each implementation round explicitly. Claude architects
and audits; Codex implements. Do not begin a new round without authorization.
When a round ends, summarize what changed, what was verified, and what still
needs Francisco's hardware verification instead of proceeding automatically.
