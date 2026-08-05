# CPR Trainer Pro — macOS Phase 3 (Release Scrub) — Implementer Prompt

**Audience: Codex only.** Self-contained implementation prompt, not an audit record. Branch `mac-build`, from tip `ba3291fdb5c50df61aa0ef7588410501944ebc72`. **Do not touch any other branch. Never merge `mac-build` toward `experiment-3.1`, `main`, or any shared trunk** — `mac-build` deliberately deleted Windows CI/packaging and merging it anywhere would destroy that.

**Context.** Phase 2 is signed off: every hardware drill passed on Francisco's Mac on Aug 5, including the F1 subtitle toggle, both exit-guard logo sites, and the manual-close regression checks. Phase 3 is the release-preparation round that makes this branch safe to ship publicly. **Phase 4 — the signed, notarized, universal DMG — is the actual August 10 conference deliverable and follows immediately, so Phase 3 is deliberately scoped tight. Do not expand it.**

**Sequencing note.** The Mac App Store round is ON HOLD by Francisco's decision (implementer credits are limited and he wants rounds serialized). Item §2.1 was previously earmarked for MAS prep and has been moved into this round because it is genuinely release scrub. Do no other MAS work here — no entitlements, no `tauri.appstore.conf.json`, no packaging, no provisioning profile.

**Commit granularity: SEVEN commits, in this order — §2.3 FIRST, then §1, §2.1, §2.2, §3, §4, §5.** §2.3 (the two-line `.gitignore` addition) is deliberately promoted to the first commit: it silences the stray `.DS_Store` files that otherwise clutter `git status` for the rest of the round, so every later commit's scope is easy to read at a glance. It is the smallest and lowest-risk change in the round, so it costs nothing to land first. §2's three subsections get their own commits because they are genuinely different concerns at very different risk levels (a 146-line Rust/Cargo.lock change, a set of file deletions, and a two-line `.gitignore` addition); bundling them would make the diff harder to audit and would force an all-or-nothing revert. Each commit must build and test clean on its own, so Claude can audit commit-by-commit and Francisco can revert any single one without unpicking the others. §6's record updates ride along in the commit they describe, or in the final commit if they span several.

**Every executable command and every file:line reference below was dry-run against `ba3291f` before delivery.** Where a check has a known expected value, it is given. If something does not match, that is a real signal — stop and report rather than adapting around it.

---

## §0 — Preflight (do this first, report before editing)

1. Confirm your working tree is a real clone of `github.com/kikofrn/cpr-trainer-pro`, checked out on `mac-build`, with **no tracked modifications** (`git status --porcelain` shows nothing outside the `??` untracked column), and `git rev-parse HEAD` exactly `ba3291fdb5c50df61aa0ef7588410501944ebc72`.

   **Untracked files are expected and pre-authorized — do not stop for them.** Specifically: any number of `.DS_Store` files anywhere in the tree (macOS Finder creates one in every folder a human browses, including `docs/` when this plan was saved there), and this plan document itself under `docs/plans/`. An earlier revision of this prompt named exactly two `.DS_Store` files and told you to stop on any mismatch; that was too strict — the handoff itself creates more. **Authorized by Francisco, Aug 5.**

   The only untracked file that should make you stop is one that is neither a `.DS_Store` nor this plan doc. Report anything else and wait.

2. **Make `main` available locally.** §1 copies files out of commit `78ff12a`, which lives on `main`. A single-branch or `--branch mac-build` clone does **not** contain it — this was verified: `git show 78ff12a:LICENSE` fails with `fatal: invalid object name` in such a clone. Run:

   ```
   git fetch --filter=blob:none origin main
   git cat-file -e 78ff12a && echo "78ff12a reachable"
   ```

   Do not proceed to §1 until that prints `78ff12a reachable`.

3. Confirm Node is available (`source ~/.nvm/nvm.sh` first in a fresh shell) and that the baseline is green **before** you change anything: `npx tsc --noEmit`, `npx vitest run` (expect **13 passing**), and `cargo test` in `src-tauri` (expect **12 passing**). If any is red at the untouched tip, stop and report — that is pre-existing and not yours to absorb silently.

---

## §1 — LICENSE and gitleaks secret scanning

The repo is public and permanently stays public. `main` and `experiment-3.1` both carry a LICENSE and an automated secret scanner; `mac-build` carries neither (verified: no `LICENSE`, no `.github/workflows/gitleaks.yml`, no `.pre-commit-config.yaml` at this tip). Close that gap before this branch produces a public release.

**Do not `git cherry-pick`.** The source commit `78ff12a` (`chore: add LICENSE and gitleaks scanning (CI + pre-commit)`) also edits `DECISIONS.md`, which has diverged substantially on `mac-build`, so a cherry-pick guarantees a conflict in a file that matters. Copy the three additive files byte-identically and write the record entry natively:

```
git show 78ff12a:LICENSE                        > LICENSE
git show 78ff12a:.github/workflows/gitleaks.yml > .github/workflows/gitleaks.yml
git show 78ff12a:.pre-commit-config.yaml        > .pre-commit-config.yaml
```

`.github/workflows/` already exists on this branch (it holds `build.yml`), so no directory creation is needed.

**Verify byte-identity using git's own object hashes** — this is exact, and shell-independent:

```
git hash-object LICENSE
git hash-object .github/workflows/gitleaks.yml
git hash-object .pre-commit-config.yaml
```

Expected values, confirmed against `78ff12a`:

| File | Expected blob SHA |
|---|---|
| `LICENSE` | `120edb44ad1fb6da127f28f69d29a57aa3e136a1` |
| `.github/workflows/gitleaks.yml` | `6eafe57f3d173e2cbb0d812fdcabf867ea6f5ccb` |
| `.pre-commit-config.yaml` | `3b2f918fa50bed910e2921ef847ab6af6650de55` |

All three must match exactly. Report the three hashes you observe.

Notes you need:

- The workflow triggers on `push: branches: ['**']` with `fetch-depth: 0`, so pushing this commit runs a **full-history** gitleaks scan against `mac-build` for the first time. `main` and `experiment-3.1` already pass and share ancestry, so a failure would most likely originate in one of the 67 commits unique to this branch.
  **Pre-screening result (Claude, before delivery):** the full `main...mac-build` diff was pattern-screened for credential-shaped additions. No plaintext secrets were found — the only hits were documentation lines *about* not committing secrets, a `secret.mp4` path-traversal **test fixture** in the Rust protocol tests, and `lifecycleToken`/`activeStartToken` presenter variables (not credentials). **Caveat, stated plainly: this was a heuristic screen, not gitleaks itself — the gitleaks binary was not installable in the audit sandbox.** Treat a passing scan as expected, not guaranteed.
  **If the scan fails, STOP, report exactly what it flagged, and do not rewrite, rebase, or force-push history.** That is Francisco's decision, not an implementation detail.
- `.pre-commit-config.yaml` is inert unless someone runs `pre-commit install` locally. **Do not run `pre-commit install`** — not authorized this round. Standing rules still apply: `PRE_COMMIT_ALLOW_NO_CONFIG=1` where needed, never `--no-verify`.
- Stage by explicit filename. Never `git add -A` on this repo.

---

## §2 — Release scrub

### 2.1 Remove the now-dead dialog plugin

Phase 2.2 removed the manual USB folder picker and replaced it with auto-detection, so nothing in the frontend opens a dialog. Verified at this tip: `grep -rn "plugin-dialog\|plugin_dialog" src/` returns nothing. Three registrations survive and should not ship:

- `src-tauri/src/lib.rs:1649` — `.plugin(tauri_plugin_dialog::init())`
- `src-tauri/Cargo.toml:33` — `tauri-plugin-dialog = "2"`
- `src-tauri/capabilities/default.json:21` — the `"dialog:allow-open",` entry

Remove all three **in this one commit**. Order matters only in that they must land together: a capability naming a plugin that is no longer registered will fail the build, and a registered plugin with no capability is dead weight.

`"dialog:allow-open",` sits mid-array — line 20 is `"core:event:default",` and line 22 opens an object — so deleting the whole line leaves valid JSON with no trailing-comma problem. Confirm anyway: the file must still parse (`python3 -m json.tool src-tauri/capabilities/default.json` or equivalent).

`src-tauri/Cargo.lock` is tracked and **will** change as a consequence. That is expected; commit it.

**This removal has already been performed and verified end-to-end before delivery** — you are confirming, not discovering. Observed on `ba3291f` with all three edits applied: the JSON still parses, `cargo check` compiles clean, `cargo test` stays at **12 passed / 0 failed**, and the diff is `Cargo.lock −144 lines`, `Cargo.toml −1`, `capabilities/default.json −1`, `lib.rs −1` (146 deletions, 1 insertion total). If your numbers differ materially, something else changed — stop and report.

Afterwards, re-run the grep to confirm the tree is clean, and confirm `cargo build` still succeeds.

### 2.2 Remove unreferenced root-level scratch

Four files sit at the repo root, are not imported by the app, and are referenced nowhere in `src/`, `src-tauri/src/`, `index.html`, `vite.config.ts`, or `package.json`:

| File | Size |
|---|---|
| `lite_app.tsx` | 296,576 B |
| `square-icon.js` | 687 B |
| `generate_tips_json.py` | 3,184 B |
| `metadata.json` | 321 B |

**This deletion has already been proven inert** — deleting all four and rebuilding produced a byte-identical `dist/assets` set (20 assets, identical content-hashed filenames). Your job is to confirm that independently, not to rediscover it.

1. Run a full-tree reference check excluding `node_modules`, `.git`, and `dist`, for each filename **and** each module basename (`lite_app`, `square-icon`). If anything references any of them, **leave that file in place and say so in your report** rather than deleting it and hoping.
2. Capture `ls dist/assets | sort` after `npm run build`, delete the files, `npm run build` again, and diff the two listings. **Use `npm run build` (vite, ~3 min) — not `npm run tauri:build`.** These are frontend-only files, so the Rust build is irrelevant here and would cost ~25 minutes for nothing. Expect an empty diff; if a chunk appears or disappears, something was live — restore it and report.

These files also exist on other branches. **You are scrubbing `mac-build` only.** Do not touch other branches to "make them consistent."

### 2.3 Stop `.DS_Store` from ever being committable

`.gitignore` on this branch does not list `.DS_Store` — verified — which is why two sit permanently untracked in Francisco's worktree and why one could be committed by accident on a public repo. Add `.DS_Store` and `**/.DS_Store` to `.gitignore`.

**Do not delete the existing untracked `.DS_Store` files** and do not `git rm` them. They are untracked; ignoring them is sufficient, and removing files from Francisco's working tree is not your call.

---

## §3 — Sidebar collapsed by default

Francisco's cross-platform decision (Aug 3): the app opens with the sidebar/course menu collapsed. Web shipped it in its Phase 3; Windows has it queued for 2.3.5; this is the Mac half.

**Site:** `src/App.tsx:313` — `const [showSidebar, setShowSidebar] = useState(true);` → `useState(false)`.

⚠️ **Use the literal `false`. Do not use `useState(isTauri)`.** The web branch uses `useState(isTauri)` because `isTauri` is false in a browser, which yields collapsed *there*. On `mac-build`, `isTauri` is always **true**, so copying the web expression would leave the sidebar **expanded** — the exact opposite of the decision. This is the single easiest mistake to make in this round.

Then confirm nothing becomes unreachable. The sidebar is conditionally rendered at `src/App.tsx:1798` (`{showSidebar && !isFullScreen && (`), and the Settings section — which holds Continuous Play and the other toggles — lives *inside* it at `src/components/Sidebar.tsx:561`. Verify by inspection and by running the app that:

- The header's expand button (`src/components/HeaderNav.tsx:113`, `onClick={() => setShowSidebar(true)}`) is visible and works from a collapsed cold start, so Settings is reachable.
- The existing auto-expand paths still fire — selecting a manual (`src/App.tsx:560`) and the other `setShowSidebar(true)` call sites already in `App.tsx` — so choosing content brings the sidebar back on its own.
- The header's collapsed-state logo/menu block (the `motion.div` animating `width: showSidebar ? 0 : 215` at `src/components/HeaderNav.tsx:104-110`) renders correctly on first paint rather than animating in from a wrong initial state.

Do not add new auto-expand logic and do not persist sidebar state across launches. Collapsed on every cold start is the decision.

---

## §4 — O2: header label clipping at narrow window widths

Recorded during the Phase-2 hardware drills as cosmetic and deferred to this round.

**Reproduce first — do not fix from a guess.** Launch the app and narrow the window progressively, in both sidebar states (collapsed is now the default, which changes available header width: the header alternates `pl-8`/`pl-4` and the collapsed logo block occupies 215 px — `src/components/HeaderNav.tsx:99-110`). Record the pixel width at which clipping first appears and exactly which element clips.

Likely candidates, in the order I would check them:

1. **`src/components/HeaderNav.tsx:423`** — `<h2 className="font-serif text-xl font-bold leading-tight text-eh-peach tracking-tight">{selectedManual.title}</h2>`. The only header text with **dynamic, unbounded content**, carrying no `truncate`, no `max-w-*`, and no `min-w-0` on its container. A long manual title is the most probable cause.
2. **`src/components/HeaderNav.tsx:136`** — the nav row, `className="flex items-end h-full gap-2 lg:gap-8 z-50 pt-4"`. Below `lg` the gap already tightens to `gap-2`; if the four nav items still overflow, the row is the constraint.
3. The fixed `h-20` header height, if the clipping is vertical rather than horizontal.

**Fix minimally and locally.** Prefer `truncate` plus `min-w-0` on the offending element and its flex parent over changing breakpoints, font sizes, or header height — a layout-wide change risks regressions on the projector resolutions Francisco actually presents at, days before the conference. If you conclude the correct fix is structural rather than local, **stop and report your reasoning instead of doing it.**

Acceptance: at the reproduction width the label no longer clips; at a normal maximised window the header is visually unchanged. State the reproduction width and the post-fix behaviour in your report.

---

## §5 — D1: guard against the manual-close regression returning

Claude's Phase-2.2b audit found the two tests added alongside that fix are tautological — they assert against `const`s and a spy never passed into the function under test, so they cannot fail. Proven by mutation: reverting both call sites to `handleReturnHome` reintroduced defects A1 and A2 exactly, and all 13 tests still passed. The fix is correct but unprotected.

**The proper fix is a component-level test, and it is explicitly NOT in this round.** This branch has no `jsdom`, no `@testing-library/react`, and no `vitest.config.ts` — tests run pure functions in the default Node environment. A DOM harness means three new dev dependencies plus config, days before the conference freeze, on the branch that produces the release DMG. That trade is not worth it now. **Do not add any test dependency in this round.**

Add instead one cheap, dependency-free invariant test to `src/App.test.ts`. **This exact test was dry-run against `ba3291f` before delivery, injected into the existing describe block exactly as specified below: the suite went 13 → 14 passing; flipping both call sites back to `handleReturnHome` then produced `1 failed | 13 passed`; restoring returned it to 13 passing.** The relative path resolves correctly under vitest's default root — also verified. You should observe the same numbers.

```ts
// STOPGAP source-level guard, not a real component test.
// The A1/A2 regression lived in JSX wiring, which no pure-function test can observe,
// and this branch has no DOM harness (no jsdom / @testing-library/react) to render with.
// Adding one days before the conference freeze was judged the riskier trade.
// Replace this with a component-level test post-conference.
it('wires the manual surface to the narrow close handler, not the full home reset', () => {
  const src = readFileSync('src/App.tsx', 'utf8');
  expect(src).toContain('onClose={handleCloseManual}');
  expect(src).toContain('onReset={handleCloseManual}');
  expect(src).not.toContain('onClose={handleReturnHome}');
  expect(src).not.toContain('onReset={handleReturnHome}');
});
```

Add `import { readFileSync } from 'node:fs';` at the top of the file. Place the test inside the existing `describe('manual close and recovery', ...)` block so it reads alongside what it protects.

**Leave the two existing tautological tests in place.** They are weak, not wrong, and deleting them is churn this round does not need.

**Then mutation-test your own work before reporting:** in a scratch copy, flip `onClose={handleCloseManual}` back to `onClose={handleReturnHome}`, run the suite, confirm it now **fails**, and restore. State the observed result — "the suite failed as expected" or exactly what happened. A regression test nobody has watched fail is not yet a regression test.

---

## §6 — Records

Update `DECISIONS.md` and `CONTEXT.md` in this same round (not a follow-up), citing this prompt. Cover:

- LICENSE and gitleaks now present on `mac-build`; the workflow scans full history on every push to any branch.
- The dialog plugin, dependency, and capability removed as dead following the Phase-2.2 picker removal.
- Which root scratch files were deleted, and any left in place because a reference turned up.
- Sidebar collapsed by default on cold start — **and record explicitly that the mac value is the literal `false`, not `useState(isTauri)`, because `isTauri` is always true here.** A future session copying the web expression across would silently revert the decision.
- The O2 fix: reproduction width, element, and the minimal change made.
- The D1 stopgap: what it guards, that it is source-level by necessity, and that a component test replaces it post-conference.

---

## §7 — Acceptance criteria

- `npx tsc --noEmit`, `npx vitest run` (**expect 14 passing** at the final tip — 13 baseline plus the §5 guard), `cargo fmt --check`, `cargo test` (**expect 12 passing**), and one full `npm run tauri:build` all pass at your final tip. (The local DMG step now succeeds on the reference Mac and yields an aarch64 DMG; universal builds remain CI's job in Phase 4.)
- Seven commits — §2.3, §1, §2.1, §2.2, §3, §4, §5 — in that order, each independently green.
- Files touched, and nothing else: `LICENSE`, `.github/workflows/gitleaks.yml`, `.pre-commit-config.yaml`, `.gitignore`, `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/capabilities/default.json`, `src/App.tsx`, `src/App.test.ts`, `src/components/HeaderNav.tsx`, `DECISIONS.md`, `CONTEXT.md`, plus the deleted scratch files. **If you must touch anything else, stop and report rather than expanding scope.**
- No entitlements, no `tauri.appstore.conf.json`, no `tauri.conf.json`, no signing config, no tags, no other branches.
- Report file:line for every change, plus: the three §1 blob hashes, the §2.2 reference-check output and `dist/` listing diff, the §4 reproduction width, and the §5 mutation-test result.

**Explicitly out of scope — do not do these even though they sit on the backlog:** anything Mac App Store (on hold); the "Presenting on external display" overlay for the frozen local video (N2 — the freeze is deliberate, `silenceLocalMedia` at `src/App.tsx:958-972`, and changing it risks the doubled-audio behaviour Drill 3 verified); USB snapshot batching; suppressed-request deferral; ManualFlipbook fullscreen unification; the B7 verification battery (Francisco's hardware gate, run separately after this round); Phase-4 packaging of any kind.

After you push, Claude audits commit-by-commit against this prompt, and Francisco runs a short confirmation pass — collapsed cold start, Settings still reachable, the narrow-window header, and a spot check that USB auto-detection and the presenter still behave — before Phase 4 opens.
