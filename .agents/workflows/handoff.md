---
description: Capture full session state into the repo before starting a new chat
---

# /handoff — session close-out

Run every step. Do not skip any, and do not ask for confirmation between steps.

1. Show `git status`. Commit and push anything uncommitted on the current branch, staging explicit paths only. Never `git add -A` — this is a public repo.

2. Append to `DECISIONS.md`, under today's date in the existing format, every decision made this session that is not already recorded. One line per decision: what was decided and why.

3. Rewrite the `## Current state (session handoff)` section at the end of `CONTEXT.md` so it reflects reality as of right now. Cover:
   - what was completed most recently (with commit SHAs)
   - what is in progress and how far along it is
   - the immediate next task
   - anything untested, known-broken, or deliberately deferred
   - gotchas a fresh session would trip over (build quirks, flaky steps, environment setup)

4. If work this session followed a plan in `docs/plans/`, check off completed checklist items in that plan file.

5. Commit and push all of the above.

6. Report back: the diff summary of what you wrote, the final pushed commit SHA, and a 3-line summary of where the build stands.
