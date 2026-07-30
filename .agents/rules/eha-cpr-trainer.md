---
trigger: always_on
description: Standing rules and memory discipline for CPR Trainer Pro (Everyday Hero Academy)
---

# CPR Trainer Pro — Standing Rules

## Memory discipline (most important)
You have no memory between chat sessions. The repo IS your memory. Keep it current as you work — never batch this to the end of a session, because sessions end abruptly.

**After completing each meaningful step, phase, or fix — before moving to the next one:**
1. Commit the work (stage explicit paths only).
2. If the step involved a non-obvious choice, append it to `DECISIONS.md` under today's date, in the existing format. Record the decision and the reason, one line each.
3. Update the `## Current state (session handoff)` section at the end of `CONTEXT.md` so it always reflects reality right now: what was just completed, what is in progress and how far, what the immediate next task is, what is untested or known-broken, and any gotcha a fresh session would trip over.
4. If working from a plan in `docs/plans/`, check off the completed checklist items in that plan file and commit it.

Treat `CONTEXT.md` and `DECISIONS.md` as append-and-refresh working documents, not archives. If asked to "close out" or "hand off," do the above plus push, then report the diff summary.

## Source of truth
- The Cloudflare R2 bucket served at `media.ehacademy.com` is the single source of truth for all media content. Never hardcode or cache bucket totals; re-pull `https://media.ehacademy.com/api/manifest` when counts or sizes matter.
- `src/chapters.ts` must always match that source of truth; build-time reconciliation tooling enforces it.
- Folder path conventions in `src/chapters.ts` must be adhered to.
- Course identity is by id string, never by array index, in all new code.

## Git rules
- **Never `git add -A`.** This is a public repository — stage explicit paths only, always.
- Never commit secrets, tokens, `.env` files, or media binaries.
- Branch `experiment-3.1` targets the Windows release. macOS lives on separate branches (same Tauri codebase, ported by merge — never re-implemented). A separate native iOS app lives on `iOS-final-build` and `codex/ios-*` branches.
- Push at the end of every working session even if the work is unfinished — an automated daily watch reads the repo to track progress, and unpushed work is invisible to it.

## Code rules
- Diffs stay minimal. Never touch unrelated code.
- Verification commands before declaring anything done: `npx tsc --noEmit`, `npm run build`, `node scripts/verify-media-urls.mjs`.
- Stack: Tauri 2, Rust backend, React 19, Vite.
- Plan documents live in `docs/plans/`. When handed a plan, implement it exactly — no deviations, no scope additions. If the plan appears wrong, stop and say so rather than improvising.

## Working relationship
Francisco authorizes each implementation round explicitly. Claude architects and audits; you implement. Do not begin a new phase of work without authorization. When you finish a round, summarize what changed and what needs verification rather than proceeding onward.
