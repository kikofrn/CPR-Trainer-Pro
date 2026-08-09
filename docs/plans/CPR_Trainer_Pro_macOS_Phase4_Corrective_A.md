# CPR Trainer Pro — macOS Phase 4 — Corrective A (Rev 2) to Rev 8 (p12 preflight false-fail) — for Codex sign-off

*Rev 2 = Rev 1 with the three documentary corrections from Codex's review (V-1/V-2/V-3, Appendix below) applied. The two workflow hunks are UNCHANGED.*

**Audience: Codex.** Review this corrective adversarially, then implement only after Francisco's explicit authorization. This document AMENDS the committed, mutually signed-off Rev 8 plan (`docs/plans/CPR_Trainer_Pro_macOS_Phase4_Prompt.md` @ `mac-build` `e12fc84c4ab4f049df78c669b670cf1ece5918c6`); every Rev 8 requirement not explicitly amended here remains binding and unchanged.

## 1. The defect, proven by execution

Candidate `mac-v3.0.0-rc1` failed at `Guard - p12 contains a usable Developer ID identity for this team` on every attempt (run `31332373505`, attempts 1–3, each reaching the failure within 19 s) with:

```
security: SecKeychainItemImport: Unknown format in import.
```

Root cause — **the gate is a defective mirror of Tauri, not a bad secret**:

- The gate decodes `APPLE_CERTIFICATE` into a file created by `mktemp "${RUNNER_TEMP:-/tmp}/phase4-cert.XXXXXX"` — **no `.p12` extension** — then runs `security import` on it.
- `tauri-macos-sign` 2.3.4 writes the decoded bytes to **`cert.p12` inside a temp directory** (`src/keychain.rs:59-61`) before its corresponding `security import`. (Tauri's import additionally grants `-T` access to `pkgbuild` and `productbuild`; the preflight grants `codesign` only — a deliberate difference with no bearing on format detection.)
- macOS `SecItemImport` uses the filename extension as a format hint. An encrypted PKCS#12 container frequently cannot be content-sniffed without it, producing exactly `Unknown format in import`.
- **Executable proof on the reference Mac (2026-08-09, Francisco):** the SAME p12 with the SAME password imported into a fresh test keychain returned `1 identity imported.` when named `Certificates.p12`, and returned the identical CI error `SecKeychainItemImport: Unknown format in import.` when imported from an extensionless copy (`/tmp/certnoext`). One variable changed: the extension.

Consequences to record: the certificate secret content was never proven bad; the original 3-month-old secret's validity is indeterminate (it may have been valid); the current secret pair was re-exported and locally verified on 2026-08-09. The false-fail would continue rejecting the locally proven valid p12 — and potentially other valid p12 inputs — until the format hint was corrected.

Process lesson (for DECISIONS and future audits): every prior fixture battery exercised this gate against **stubbed** `security`, which did not independently reveal the unmodeled OS behavior (a purpose-built stub can enforce the suffix requirement now that the behavior is known). OS-level tool semantics join hardware drills in the class of checks that a stub cannot be trusted to prove until a real run has taught the stub what to model.

## 2. The amendment — exactly two hunks in `.github/workflows/release-macos.yml`, nothing else

Hunk 1 — in `Guard - p12 contains a usable Developer ID identity for this team`, replace:

```
          CERT_PATH="$(mktemp "${RUNNER_TEMP:-/tmp}/phase4-cert.XXXXXX")"
```

with:

```
          CERT_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/phase4-cert.XXXXXX")"
          CERT_PATH="$CERT_DIR/cert.p12"
```

Hunk 2 — in the same step's `cleanup()` function, replace:

```
            rm -f "$CERT_PATH"
```

with:

```
            rm -rf "$CERT_DIR"
```

This mirrors Tauri exactly (temp directory + `cert.p12`). Two incidental improvements, stated for completeness: the Node `fs.writeFileSync(..., { mode: 0o600 })` now actually applies its mode (previously the file pre-existed from `mktemp`, so the mode argument was ignored), and cleanup removes the whole directory. The `export CERT_PATH` line, the Node heredoc, the import command, the identity predicate, and every warning loop are UNTOUCHED.

## 3. Expected file identity after the edit

- Git blob: `70d46abc55cd621a8303ec301eb30316bb2f11eb`
- Size: 28,338 bytes, 653 lines (was `2f7bdef99a1c40699827d51704d7d6a2075988de`, 28,295, 652)
- Claude's pre-validation of the exact amended file: actionlint 1.7.7 + ShellCheck 0.11.0 integration = zero findings; `bash -n` passes on all 22 run blocks; 26 steps / 22 run blocks unchanged; the dir/file/cleanup logic fixture-tested (path ends `.p12`, file created, cleanup leaves nothing).

## 4. Commits (after review + Francisco's authorization), on `mac-build` from tip `e12fc84c`

1. `phase 4 3: commit p12 preflight corrective A` — this document, verbatim, to `docs/plans/CPR_Trainer_Pro_macOS_Phase4_Corrective_A.md`.
2. `phase 4 4: fix p12 preflight false-fail (missing .p12 extension)` — the two-hunk edit to `.github/workflows/release-macos.yml` only. Verify `git hash-object` = `70d46abc…` before committing; stop on mismatch.
3. `phase 4 5: record p12 preflight corrective` — append ONE bullet to the existing `## 2026-08-09` section of `DECISIONS.md`, in your own words, covering: the rc1 false-fail and its root cause (extensionless temp file vs Tauri's `cert.p12`, macOS format-hint sensitivity); the executable local proof (same p12 + password: extensionless fails, `.p12` imports); that the certificate secret was never proven bad and the original secret's validity is indeterminate; and the lesson that the stubbed-`security` fixtures did not independently reveal the unmodeled OS format-hint behavior. `CONTEXT.md` is NOT changed (its handoff block remains accurate).

Then push `mac-build` only; both existing branch workflows must go green; report per Rev 8 §14 conventions (commit SHAs, blob hash, diff stat, CI links). NO tags — after Claude verifies the push, Francisco tags **`mac-v3.0.0-rc2`** at the NEW tip per Rev 8 §10 (rc1 remains in place, abandoned, never moved or deleted, per §12).

## 5. Boundaries

All Rev 8 §13 forbidden actions remain in force. This corrective authorizes touching exactly one audited file with exactly the two hunks above. If your review finds the amendment defective or incomplete, return findings instead of implementing.

## Appendix — Codex review of Rev 1 (2026-08-09): three documentary findings, all accepted; zero functional findings

- **V-1 (low):** "otherwise-identical `security import`" was false — Tauri's import grants `-T` to `codesign`, `pkgbuild`, and `productbuild` (`keychain.rs:105-121`); the preflight grants `codesign` only. Wording corrected; the difference has no bearing on format detection.
- **V-2 (low):** "would have rejected EVERY valid certificate forever" exceeded the evidence, which proves rejection of the one locally verified encrypted p12; and "stubs cannot catch this" overclaimed — a purpose-built stub can enforce the suffix once the behavior is known. Both statements corrected.
- **V-3 (low):** "each ≤19 s" was ambiguous — attempt 3 reached the import failure at ~18.5 s but its full run lifecycle closed at 23 s. Corrected to "each reaching the failure within 19 s."

Codex's functional validation of Rev 1, recorded: the pinned crate (SHA-256 `6b840687…`) writes `cert.p12` in a tempdir at `keychain.rs:59-61`; the proposed workflow reproduces blob `70d46abc55cd621a8303ec301eb30316bb2f11eb` (28,338 B / 653 lines); YAML parses; actionlint 1.7.7 + ShellCheck 0.11.0 zero findings; all 22 run blocks pass Bash 3.2 syntax validation; 26 steps / 22 run blocks unchanged; independent fixtures confirmed `cert.p12`, dir mode 0700, file mode 0600, complete cleanup; secret-update timestamps corroborate both certificate secrets were refreshed before attempt 3; no repository mutation occurred during review.

The commit-1 subject and path are unchanged; the document committed as `docs/plans/CPR_Trainer_Pro_macOS_Phase4_Corrective_A.md` is THIS Rev 2 text.