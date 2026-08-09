# CPR Trainer Pro — macOS Phase 4 — Full Implementation Plan — Rev 8 (SELF-AUDITED)

Status: implementation-ready only after independent human approval. This document is a complete replacement for Revisions 1–7; do not combine their instructions. Rev 8 retains every accepted Rev 6 requirement, incorporates the Rev 6 counter-review in Appendix E, and corrects the successor self-audit finding in Appendix F. It creates the universal Developer-ID-signed, notarized, stapled macOS DMG pipeline, but it does not authorize creating tags, publishing a release, or making Mac App Store changes.

Target repository: `github.com/kikofrn/CPR-Trainer-Pro`

Target branch and baseline: `mac-build` at `fc4825cbecc4e0ca6a0844fc2231a66adc44fb37`

Verified remote state on 2026-08-08:

- `refs/heads/mac-build` is `fc4825cbecc4e0ca6a0844fc2231a66adc44fb37`.
- `refs/heads/main` is `78ff12ae626467550145a21b2d0d3515eac96a51`.
- No remote tag matching `mac-v*` exists.
- The correct existing worktree is `/Users/ehcprllc/Documents/CPR Trainer Pro macOS App`; do not switch the unrelated iOS worktree to `mac-build`.
- The macOS worktree has two pre-existing untracked plan files: `docs/plans/CPR_Trainer_Pro_macOS_Phase4_Prompt.md` and `docs/plans/CPR_Trainer_Pro_macOS_Phase4_Prompt_Rev2.md`. Treat both as user-owned until the implementation authorization explicitly identifies which one becomes the canonical committed plan. Do not delete or stage the other one.

Pinned implementation sources:

- `@tauri-apps/cli` / `tauri-cli` 2.11.1.
- `tauri-bundler` 2.9.1.
- `tauri-macos-sign` 2.3.4.
- `tauri-utils` 2.9.1.
- `package-lock.json` pins the CLI and its platform packages to 2.11.1; the `tauri-cli` 2.11.1 crate lock pins the three Rust crates above.
- Node.js 20.20.2 with bundled npm 10.8.2, as listed in Node's immutable distribution index.
- Rust 1.97.1, the release in Rust's stable-channel manifest dated 2026-07-16. The workflow supplies the version as an explicit action input; an immutable action commit alone would otherwise retain its moving `stable` default.

## 1. Goal and acceptance contract

Phase 4 is complete only when all of the following are true:

1. `mac-build` contains a release-only Tauri configuration and a separate tag-triggered GitHub Actions workflow.
2. A strict `mac-vX.Y.Z-rcN` candidate tag builds one universal DMG containing both `arm64` and `x86_64`.
3. The app and DMG are signed by a `Developer ID Application` certificate belonging to team `8ZGSY5NJPJ`.
4. Tauri's app notarization succeeds, the app ticket is actually stapled, the finished DMG is separately notarized and stapled, and Gatekeeper accepts both layers.
5. The app inside the DMG has bundle ID `com.ehacademy.cpr-trainer-pro`, the tag/config version, the configured minimum macOS version, and no App Sandbox entitlement.
6. The candidate artifact contains the DMG, a verified SHA-256 manifest, signing evidence, notarization evidence, entitlement evidence, and runner/toolchain evidence.
7. Francisco downloads the candidate through a browser so quarantine is applied and completes the hardware acceptance battery.
8. Only after candidate approval, a final `mac-vX.Y.Z` tag is placed on the exact same commit. CI proves a strictly named candidate tag at that commit has a completed successful run, performs a fresh release build, and creates a draft GitHub Release.
9. The final DMG receives the abbreviated hardware smoke before anyone publishes the draft.

CI cannot prove user-facing runtime behavior, which successful candidate run Francisco tested, or that a tag push was human-authorized. The release record must therefore retain the candidate tag, workflow run URL, artifact SHA-256, tester, date, and result. The final build is new signed/notarized bytes even when source commit and tool versions match; its abbreviated hardware smoke is mandatory. Repository tag governance must separately restrict `mac-v*` creation to authorized release managers.

## 2. Scope

Implementation changes exactly these paths:

- `docs/plans/CPR_Trainer_Pro_macOS_Phase4_Prompt.md` — replace with this approved plan only if Francisco authorizes that canonicalization.
- `src-tauri/tauri.release.conf.json` — new.
- `.github/workflows/release-macos.yml` — new.
- `CONTEXT.md` — update only the current-state handoff block.
- `DECISIONS.md` — append one dated decision section.

Do not change application source, dependencies, base Tauri configuration, either existing entitlement plist, or existing workflows.

## 3. Implementation preflight

Run every command from `/Users/ehcprllc/Documents/CPR Trainer Pro macOS App`.

### 3.1 Repository identity, branch, and baseline

```bash
pwd
git remote get-url origin
git branch --show-current
git rev-parse HEAD
git status --porcelain
```

Required results:

- `pwd` is `/Users/ehcprllc/Documents/CPR Trainer Pro macOS App`.
- The remote identifies `github.com/kikofrn/CPR-Trainer-Pro`.
- The branch is exactly `mac-build`.
- `HEAD` is exactly `fc4825cbecc4e0ca6a0844fc2231a66adc44fb37`.
- The only untracked entries are the two known plan documents listed at the top of this plan. Ignored `.DS_Store` files may exist but must never be staged.
- Any tracked modification, staged change, or additional untracked path is a stop condition. Report it; do not clean, stash, overwrite, or absorb it.

Confirm the remote has not moved without modifying local refs:

```bash
git ls-remote origin refs/heads/mac-build refs/heads/main 'refs/tags/mac-v*'
```

Required results before implementation:

- `mac-build` still resolves to `fc4825cbecc4e0ca6a0844fc2231a66adc44fb37`.
- There is still no `mac-v*` tag. If either statement is false, stop and re-audit the changed state.

### 3.2 Confirm target files do not already exist at the baseline

Both commands must print nothing:

```bash
git ls-tree fc4825cbecc4e0ca6a0844fc2231a66adc44fb37 -- .github/workflows/release-macos.yml
git ls-tree fc4825cbecc4e0ca6a0844fc2231a66adc44fb37 -- src-tauri/tauri.release.conf.json
```

### 3.3 Baseline tests

Run before editing:

```bash
if [ ! -x node_modules/.bin/tsc ] || [ ! -x node_modules/.bin/vitest ]; then npm ci; fi
npx --no-install tsc --noEmit
npx --no-install vitest run
(cd src-tauri && cargo test)
```

Expected baseline: TypeScript succeeds; Vitest reports 14 passing tests across two files; Cargo reports 12 passing tests. If a command stalls twice because this worktree is in `~/Documents`, export `fc4825c` with `git archive` to a temporary directory outside `~/Documents` and repeat there. A red baseline is a stop condition.

Do not run a local Tauri release build. It would be single-architecture, slow, and incapable of proving the CI signing/notarization path.

### 3.4 Secrets

The workflow expects repository secrets named exactly:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

Do not print secret values. Presence was previously confirmed, while certificate contents and Apple credentials remain deliberately untrusted until the workflow preflights them.

### 3.5 Tag authorization and repository governance

Before the workflow commit is pushed to `mac-build` or the first candidate is authorized, Francisco must review the repository's current write access, branch protection/rulesets, and tag rules. A `mac-v*` tag push executes trusted release code with long-lived Apple credentials; the workflow cannot infer whether the human push was approved.

Required result: a GitHub tag ruleset or an equivalently controlled operating procedure restricts `mac-v*` creation, update, and deletion to Francisco and explicitly designated release managers. `mac-build` must also remain protected from unreviewed writes. Record who can bypass each rule. If the repository plan does not support the desired ruleset, document the exact compensating control and have Francisco approve it before enabling tags. Concrete minimal path for this repository (public, personal, single owner): either create a tag ruleset (Settings → Rules → Rulesets → New tag ruleset → target pattern `mac-v*` → restrict creation, update, and deletion → bypass list = repository admin only), or record in the candidate record the explicit compensating control that Francisco is the sole account with write access and that no other collaborator or app installation can push tags, and have Francisco approve that sentence. Either satisfies this requirement in minutes; neither requires a paid plan. Do not add a hard-coded `github.actor` test: account renames, delegated release managers, and GitHub service identities make that a brittle CI substitute for repository governance.

## 4. New file: `src-tauri/tauri.release.conf.json`

Create the file with exactly this content, LF endings, and a trailing newline:

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "bundle": {
    "createUpdaterArtifacts": false,
    "macOS": {
      "entitlements": "entitlements.dmg.plist",
      "hardenedRuntime": true,
      "signingIdentity": "Developer ID Application"
    }
  }
}
```

Required verification:

```bash
python3 -c "import json; json.load(open('src-tauri/tauri.release.conf.json')); print('JSON OK')"
git hash-object src-tauri/tauri.release.conf.json
wc -c -l src-tauri/tauri.release.conf.json
```

Expected Git blob ID: `eee290a16fc2a97809fee4b326bdd2f2f6932ad0`.

Expected size: 278 bytes and 11 lines.

Why the keys are required:

- Tauri reads the `--config` path while parsing CLI arguments, before changing its working directory to `src-tauri`; therefore `--config src-tauri/tauri.release.conf.json` is correct when invoked at repository root.
- Tauri loads the base config, any automatic platform config, and then applies the explicit merge. `json_patch::merge` performs an object-deep RFC 7386 merge; this overlay changes only its stated leaves and preserves `bundle.macOS.minimumSystemVersion` and other siblings.
- `tauri.appstore.conf.json` is not automatic. Tauri's only automatic macOS JSON filename is `tauri.macos.conf.json`, which this repository does not have.
- `createUpdaterArtifacts: false` prevents a future base-config change from creating updater payloads in this direct-download channel.
- `entitlements: entitlements.dmg.plist` pins the unsandboxed distribution file. The current file is an empty plist dictionary.
- `hardenedRuntime: true` pins the executable-signing mode required by the notarized direct-download contract instead of relying only on Tauri's current default.
- `signingIdentity: Developer ID Application` is only a certificate-name substring assertion in `tauri-bundler` 2.9.1. It does not select by purpose or verify a team. It is still load-bearing because it prevents the missing-certificate path from silently returning an unsigned bundle on a clean CI keychain. Team and actual-authority checks are separate hard gates.

## 5. New file: `.github/workflows/release-macos.yml`

Create the file with exactly the following content, LF endings, and a trailing newline:

```yaml
name: Release macOS DMG

on:
  push:
    tags:
      - 'mac-v*'

concurrency:
  group: release-macos-${{ github.ref }}
  cancel-in-progress: false

jobs:
  dmg:
    name: Universal signed + notarized DMG
    runs-on: macos-15
    timeout-minutes: 240
    permissions:
      contents: write
      actions: read
    defaults:
      run:
        shell: bash
    env:
      EXPECTED_TEAM_ID: 8ZGSY5NJPJ
      UNIVERSAL_OUT_DIR: src-tauri/target/universal-apple-darwin/release
      REF_NAME: ${{ github.ref_name }}

    steps:
      - name: Checkout
        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with:
          fetch-depth: 0
          persist-credentials: false

      - name: Setup Node.js
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 20.20.2

      - name: Gate - pinned Node.js and npm
        run: |
          set -euo pipefail
          actual_node="$(node --version)"
          actual_npm="$(npm --version)"
          if [ "$actual_node" != "v20.20.2" ] || [ "$actual_npm" != "10.8.2" ]; then
            echo "::error::Expected Node v20.20.2 with npm 10.8.2; got Node $actual_node with npm $actual_npm."
            exit 1
          fi
          echo "Node $actual_node with npm $actual_npm"

      - name: Guard - tag grammar, version parity, release contract
        id: ref_guard
        run: |
          set -euo pipefail

          package_version="$(node -p "require('./package.json').version")"
          tauri_version="$(node -p "require('./src-tauri/tauri.conf.json').version")"
          bundle_id="$(node -p "require('./src-tauri/tauri.conf.json').identifier")"
          min_macos="$(node -p "require('./src-tauri/tauri.conf.json').bundle.macOS.minimumSystemVersion")"

          if [ "$package_version" != "$tauri_version" ]; then
            echo "::error::package.json version ($package_version) does not match tauri.conf.json version ($tauri_version)."
            exit 1
          fi

          if [ "$GITHUB_REF_TYPE" != "tag" ]; then
            echo "::error::This workflow only accepts release tags; got $GITHUB_REF_TYPE '$REF_NAME'."
            exit 1
          fi
          if [[ ! "$REF_NAME" =~ ^mac-v([0-9]+\.[0-9]+\.[0-9]+)(-rc[0-9]+)?$ ]]; then
            echo "::error::Tag must be exactly mac-vX.Y.Z or mac-vX.Y.Z-rcN; got '$REF_NAME'."
            exit 1
          fi

          release_version="${BASH_REMATCH[1]}"
          if [ "$release_version" != "$tauri_version" ]; then
            echo "::error::Tag version $release_version does not match the app version $tauri_version. Bump the app or fix the tag."
            exit 1
          fi
          if [ -n "${BASH_REMATCH[2]:-}" ]; then
            channel=candidate
          else
            channel=final
          fi

          echo "channel=$channel" >> "$GITHUB_OUTPUT"
          {
            echo "RELEASE_VERSION=$release_version"
            echo "EXPECTED_BUNDLE_ID=$bundle_id"
            echo "EXPECTED_MIN_MACOS=$min_macos"
          } >> "$GITHUB_ENV"

          echo "channel=$channel version=$release_version bundle_id=$bundle_id min_macos=$min_macos"

      - name: Gate - final-tag GitHub CLI capabilities
        if: ${{ steps.ref_guard.outputs.channel == 'final' }}
        run: |
          set -euo pipefail
          if ! command -v gh >/dev/null 2>&1; then
            echo "::error::GitHub CLI (gh) is not installed on this runner."
            exit 1
          fi

          gh_version_output="$(gh --version)"
          gh_version_line="$(printf '%s\n' "$gh_version_output" | sed -n '1p')"
          api_help="$(gh api --help)"
          missing=0
          for flag in --paginate --slurp; do
            if ! grep -Fq -- "$flag" <<< "$api_help"; then
              echo "::error::Installed GitHub CLI is missing required 'gh api $flag' support."
              missing=$((missing + 1))
            fi
          done
          if [ "$missing" -ne 0 ]; then
            echo "::error::The installed GitHub CLI cannot satisfy the paginated release guards. Both flags are required; --slurp first shipped in gh 2.48.0."
            exit 1
          fi

          printf 'GH_VERSION_LINE=%s\n' "$gh_version_line" >> "$GITHUB_ENV"
          echo "$gh_version_line; gh api supports --paginate and --slurp"

      - name: Guard - commit must be contained in mac-build
        run: |
          set -euo pipefail
          if ! git show-ref --verify --quiet refs/remotes/origin/mac-build; then
            echo "::error::Checkout did not provide refs/remotes/origin/mac-build even though fetch-depth is 0."
            exit 1
          fi
          if ! git merge-base --is-ancestor HEAD origin/mac-build; then
            echo "::error::HEAD $(git rev-parse HEAD) is not contained in origin/mac-build. Releases are only built from mac-build."
            exit 1
          fi
          echo "HEAD $(git rev-parse HEAD) is contained in origin/mac-build"

      - name: Guard - final tag requires a successful same-commit candidate
        if: ${{ steps.ref_guard.outputs.channel == 'final' }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          head_sha="$(git rev-parse HEAD)"
          version_re="${RELEASE_VERSION//./\\.}"
          candidates="$(git tag -l "mac-v${RELEASE_VERSION}-rc*")"
          matched=""
          matched_run_id=""

          while IFS= read -r candidate; do
            [ -n "$candidate" ] || continue
            if [[ ! "$candidate" =~ ^mac-v${version_re}-rc[0-9]+$ ]]; then
              echo "skipping '$candidate': not a valid candidate tag"
              continue
            fi
            if [ "$(git rev-list -n 1 "$candidate")" != "$head_sha" ]; then
              echo "skipping '$candidate': points at a different commit"
              continue
            fi

            runs_json="$(gh api \
              --method GET \
              --paginate \
              --slurp \
              -f branch="$candidate" \
              -f event=push \
              -F per_page=100 \
              "repos/$GITHUB_REPOSITORY/actions/workflows/release-macos.yml/runs")"
            run_id="$(printf '%s' "$runs_json" | jq -r --arg s "$head_sha" --arg b "$candidate" \
              '[.[] | .workflow_runs[] | select(.head_sha == $s and .head_branch == $b and .event == "push" and .status == "completed" and .conclusion == "success") | .id] | first // empty')"
            if [ -n "$run_id" ]; then
              matched="$candidate"
              matched_run_id="$run_id"
              break
            fi
            echo "skipping '$candidate': no successful release-macos run recorded at $head_sha"
          done <<< "$candidates"

          if [ -z "$matched" ]; then
            echo "::error::Final tag $REF_NAME points at $head_sha, but no mac-v${RELEASE_VERSION}-rcN tag at that commit has a completed successful release-macos run. Tag the exact commit as a candidate, wait for it to pass, complete hardware QA, and only then create the final tag."
            echo "candidate tags seen for this version:"
            printf '%s\n' "$candidates"
            exit 1
          fi
          echo "final tag matches candidate $matched at $head_sha; successful candidate run id $matched_run_id"

      - name: Guard - no release already exists for this tag
        if: ${{ steps.ref_guard.outputs.channel == 'final' }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          releases_json="$(gh api \
            --method GET \
            --paginate \
            --slurp \
            -F per_page=100 \
            "repos/$GITHUB_REPOSITORY/releases")"
          existing="$(printf '%s' "$releases_json" | jq -r --arg t "$REF_NAME" \
            '[flatten[] | select(.tag_name == $t)] | length')"
          if [ "$existing" -ne 0 ]; then
            echo "::error::A GitHub Release, including a possible draft, already exists for $REF_NAME. Delete it deliberately or use a new tag; refusing to spend another signed build."
            exit 1
          fi
          echo "no existing release for $REF_NAME"

      - name: Guard - all five APPLE secrets are present
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: |
          set -euo pipefail
          missing=0
          for name in APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID; do
            value="${!name:-}"
            if [ -z "$value" ]; then
              echo "::error::Required repository secret $name is missing or empty."
              missing=1
            else
              echo "$name is present"
            fi
          done
          if [ "$missing" -ne 0 ]; then
            exit 1
          fi
          if [ "$APPLE_TEAM_ID" != "$EXPECTED_TEAM_ID" ]; then
            echo "::error::APPLE_TEAM_ID does not match the expected team. Check for a wrong value or stray whitespace."
            exit 1
          fi
          echo "APPLE_TEAM_ID matches the expected team"

      - name: Guard - p12 contains a usable Developer ID identity for this team
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        run: |
          set -euo pipefail

          CERT_PATH="$(mktemp "${RUNNER_TEMP:-/tmp}/phase4-cert.XXXXXX")"
          keychain_path="${RUNNER_TEMP:-/tmp}/phase4-preflight-$(uuidgen).keychain-db"
          keychain_password="$(uuidgen)"
          export CERT_PATH

          cleanup() {
            security delete-keychain "$keychain_path" >/dev/null 2>&1 || true
            rm -f "$CERT_PATH"
          }
          trap cleanup EXIT

          node <<'NODE'
          const fs = require("fs");
          const raw = process.env.APPLE_CERTIFICATE || "";
          // Match tauri-macos-sign 2.3.4: remove ASCII whitespace, then require
          // canonical padded standard base64. Buffer.from alone is permissive.
          const cleaned = raw.replace(/[ \t\n\v\f\r]/g, "");
          const canonical = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
          if (!canonical.test(cleaned)) {
            throw new Error("APPLE_CERTIFICATE is not canonical standard base64 after removing ASCII whitespace");
          }
          const decoded = Buffer.from(cleaned, "base64");
          if (decoded.length === 0 || decoded.toString("base64") !== cleaned) {
            throw new Error("APPLE_CERTIFICATE failed strict standard-base64 validation");
          }
          fs.writeFileSync(process.env.CERT_PATH, decoded, { mode: 0o600 });
          NODE

          security create-keychain -p "$keychain_password" "$keychain_path"
          security unlock-keychain -p "$keychain_password" "$keychain_path"
          security import "$CERT_PATH" -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign -k "$keychain_path"

          identities="$(security find-identity -v "$keychain_path")"
          echo "valid identities in the p12:"
          printf '%s\n' "$identities"

          if ! awk -v team="($EXPECTED_TEAM_ID)" '
            index($0, "Developer ID Application:") && index($0, team) { found=1 }
            END { exit !found }
          ' <<< "$identities"; then
            echo "::error::APPLE_CERTIFICATE contains no valid Developer ID Application identity for team $EXPECTED_TEAM_ID with an accessible private key. Re-export that identity and private key, encode the p12, and update the secret."
            exit 1
          fi
          echo "a Developer ID Application identity for $EXPECTED_TEAM_ID is present"

          for prefix in "iOS Distribution" "Apple Distribution" "Mac App Distribution" "Apple Development" "iOS App Development" "Mac Development"; do
            count="$(security find-certificate -p -a -c "$prefix:" "$keychain_path" 2>/dev/null | grep -c 'BEGIN CERTIFICATE' || true)"
            if [ "$count" -gt 0 ]; then
              echo "::warning::The p12 also contains $count certificate(s) matching '$prefix:'. Tauri recognises this class and sorts all recognised certificates before selecting the first. If a later Authority gate reports the wrong certificate, re-export the p12 with only the intended Developer ID Application identity."
            fi
          done

      - name: Guard - notarization credentials authenticate
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: |
          set -euo pipefail
          xcrun notarytool history \
            --apple-id "$APPLE_ID" \
            --password "$APPLE_PASSWORD" \
            --team-id "$APPLE_TEAM_ID" \
            --output-format json >/dev/null
          echo "Apple notarization credentials authenticate successfully"

      - name: Install pinned Rust with both Apple targets
        uses: dtolnay/rust-toolchain@4360b52568e2003a75bf9bc1d59f33a8e3fc893c # stable on 2026-08-08
        with:
          toolchain: 1.97.1
          targets: aarch64-apple-darwin,x86_64-apple-darwin

      - name: Gate - pinned Rust
        run: |
          set -euo pipefail
          actual="$(rustc --version)"
          case "$actual" in
            "rustc 1.97.1 "*)
              ;;
            *)
              echo "::error::Expected rustc 1.97.1, got '$actual'."
              exit 1
              ;;
          esac
          installed_targets="$(rustup target list --installed)"
          for target in aarch64-apple-darwin x86_64-apple-darwin; do
            if ! grep -Fxq "$target" <<< "$installed_targets"; then
              echo "::error::Pinned Rust toolchain is missing target $target."
              exit 1
            fi
          done
          echo "$actual"

      - name: Record runner and toolchain
        run: |
          set -euo pipefail
          if [ -n "${GH_VERSION_LINE:-}" ]; then
            gh_version_line="$GH_VERSION_LINE"
          elif command -v gh >/dev/null 2>&1; then
            if gh_version_output="$(gh --version 2>&1)"; then
              gh_version_line="$(printf '%s\n' "$gh_version_output" | sed -n '1p')"
            else
              gh_version_line="installed but version command failed (not required for candidate tags)"
            fi
          else
            gh_version_line="not installed (not required for candidate tags)"
          fi
          {
            echo "runner  ${ImageOS:-unknown} image ${ImageVersion:-unknown}"
            echo "host    $(uname -m)"
            echo "os      $(sw_vers -productName) $(sw_vers -productVersion) ($(sw_vers -buildVersion))"
            echo "node    $(node --version)"
            echo "npm     $(npm --version)"
            echo "rustc   $(rustc --version)"
            echo "cargo   $(cargo --version)"
            echo "jq      $(jq --version)"
            echo "gh      $gh_version_line"
            echo "xcode   $(xcodebuild -version | tr '\n' ' ')"
            rustup target list --installed
          } | tee toolchain.txt

      - name: Install Node dependencies
        run: npm ci

      - name: Gate - pinned Tauri CLI
        run: |
          set -euo pipefail
          actual="$(./node_modules/.bin/tauri --version)"
          if [ "$actual" != "tauri-cli 2.11.1" ]; then
            echo "::error::Expected 'tauri-cli 2.11.1', got '$actual'. This workflow is verified against that exact implementation."
            exit 1
          fi
          echo "$actual"

      - name: Build frontend and universal binary - no Apple secrets
        run: |
          set -euo pipefail
          ./node_modules/.bin/tauri build \
            --ci \
            --verbose \
            --no-bundle \
            --target universal-apple-darwin \
            --config src-tauri/tauri.release.conf.json

      - name: Bundle universal DMG - sign and notarize the app
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: |
          set -euo pipefail
          ./node_modules/.bin/tauri bundle \
            --ci \
            --target universal-apple-darwin \
            --config src-tauri/tauri.release.conf.json

      - name: Locate the one universal DMG
        run: |
          set -euo pipefail
          shopt -s nullglob
          dmgs=("$UNIVERSAL_OUT_DIR"/bundle/dmg/*.dmg)
          if [ "${#dmgs[@]}" -ne 1 ]; then
            echo "::error::Expected exactly one DMG in $UNIVERSAL_OUT_DIR/bundle/dmg, found ${#dmgs[@]}."
            ls -la "$UNIVERSAL_OUT_DIR/bundle/dmg" || true
            exit 1
          fi
          dmg="${dmgs[0]}"
          base="$(basename "$dmg")"
          expected="_${RELEASE_VERSION}_universal.dmg"
          case "$base" in
            *"$expected")
              ;;
            *)
              echo "::error::DMG is named '$base'; a universal build of $RELEASE_VERSION must end with '$expected'. Refusing to start another notarization cycle."
              exit 1
              ;;
          esac
          echo "DMG_PATH=$dmg" >> "$GITHUB_ENV"
          echo "Found DMG: $dmg"

      - name: Gate - DMG signature before notarization
        run: |
          set -euo pipefail
          echo "== codesign verify: DMG before stapling =="
          codesign --verify --strict --verbose=2 "$DMG_PATH"
          echo "== codesign display: DMG =="
          codesign -dvvv "$DMG_PATH" > codesign-dmg.txt 2>&1
          cat codesign-dmg.txt
          if ! grep -Fq 'Authority=Developer ID Application:' codesign-dmg.txt; then
            echo "::error::The DMG is not signed by a Developer ID Application certificate."
            exit 1
          fi
          if ! grep -Fq "TeamIdentifier=$EXPECTED_TEAM_ID" codesign-dmg.txt; then
            echo "::error::The DMG TeamIdentifier is not $EXPECTED_TEAM_ID."
            exit 1
          fi

      - name: Notarize, inspect, and staple the DMG
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: |
          set -euo pipefail
          echo "Submitting $DMG_PATH to Apple's notary service"

          set +e
          xcrun notarytool submit "$DMG_PATH" \
            --apple-id "$APPLE_ID" \
            --password "$APPLE_PASSWORD" \
            --team-id "$APPLE_TEAM_ID" \
            --output-format json \
            --wait \
            --timeout 90m > notarytool-submit.json
          submit_rc=$?
          set -e

          cat notarytool-submit.json || true
          submission_id="$(jq -r '.id // empty' notarytool-submit.json 2>/dev/null || true)"
          status="$(jq -r '.status // empty' notarytool-submit.json 2>/dev/null || true)"
          echo "notarization submission '$submission_id' finished with status '$status' (exit $submit_rc)"

          fetch_log() {
            xcrun notarytool log "$1" \
              --apple-id "$APPLE_ID" \
              --password "$APPLE_PASSWORD" \
              --team-id "$APPLE_TEAM_ID" \
              notarytool-dmg-log.json
          }

          if [ "$submit_rc" -ne 0 ] || [ "$status" != "Accepted" ] || [ -z "$submission_id" ]; then
            echo "::error::DMG notarization was not accepted (exit $submit_rc, status '$status')."
            if [ -n "$submission_id" ]; then
              fetch_log "$submission_id" || true
              cat notarytool-dmg-log.json 2>/dev/null || true
            fi
            exit 1
          fi

          fetch_log "$submission_id"
          cat notarytool-dmg-log.json
          if ! jq -e . notarytool-dmg-log.json >/dev/null 2>&1; then
            echo "::error::The notary log for $submission_id is not valid JSON."
            exit 1
          fi

          error_issues="$(jq '[(.issues // [])[] | select(((.severity // "") | ascii_downcase) == "error")] | length' notarytool-dmg-log.json)"
          other_issues="$(jq '[(.issues // [])[] | select(((.severity // "") | ascii_downcase) != "error")] | length' notarytool-dmg-log.json)"
          if [ "$error_issues" -ne 0 ]; then
            echo "::error::Notarization was accepted but its log contains $error_issues error-severity issue(s). Adjudicate before release."
            exit 1
          fi
          if [ "$other_issues" -ne 0 ]; then
            echo "::warning::Notarization was accepted with $other_issues non-error issue(s); inspect notarytool-dmg-log.json in the artifact."
          fi

          xcrun stapler staple -v "$DMG_PATH"

      - name: Gate - notarized DMG is valid and Gatekeeper-accepted
        run: |
          set -euo pipefail
          echo "== hdiutil verify =="
          hdiutil verify "$DMG_PATH"
          echo "== stapler validate: DMG =="
          xcrun stapler validate "$DMG_PATH"
          echo "== spctl assess: DMG =="
          spctl -a -t open --context context:primary-signature -vv "$DMG_PATH"

      - name: Gate - app inside the DMG
        run: |
          set -euo pipefail
          shopt -s nullglob
          mount_point="$(mktemp -d)"
          cleanup() {
            hdiutil detach "$mount_point" -quiet || true
            rmdir "$mount_point" 2>/dev/null || true
          }
          trap cleanup EXIT

          hdiutil attach "$DMG_PATH" -nobrowse -readonly -mountpoint "$mount_point"
          apps=("$mount_point"/*.app)
          if [ "${#apps[@]}" -ne 1 ]; then
            echo "::error::Expected exactly one top-level .app on the DMG, found ${#apps[@]}."
            ls -la "$mount_point"
            exit 1
          fi
          app="${apps[0]}"
          echo "Verifying $app"

          echo "== codesign verify: app =="
          codesign --verify --deep --strict --verbose=2 "$app"

          echo "== codesign display: app =="
          codesign -dvvv "$app" > codesign-app.txt 2>&1
          cat codesign-app.txt
          if ! grep -Fq 'Authority=Developer ID Application:' codesign-app.txt; then
            echo "::error::The app is not signed by a Developer ID Application certificate."
            exit 1
          fi
          if ! grep -Fq "TeamIdentifier=$EXPECTED_TEAM_ID" codesign-app.txt; then
            echo "::error::The app TeamIdentifier is not $EXPECTED_TEAM_ID."
            exit 1
          fi
          if ! grep -Eq 'flags=.*[(,]runtime([,)]|$)' codesign-app.txt; then
            echo "::error::The app CodeDirectory does not carry the hardened-runtime flag."
            exit 1
          fi

          echo "== release contract from Info.plist =="
          plist="$app/Contents/Info.plist"
          bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$plist")"
          short_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$plist")"
          bundle_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$plist")"
          min_macos="$(/usr/libexec/PlistBuddy -c 'Print :LSMinimumSystemVersion' "$plist")"
          echo "bundle_id=$bundle_id short_version=$short_version bundle_version=$bundle_version min_macos=$min_macos"

          if [ "$bundle_id" != "$EXPECTED_BUNDLE_ID" ]; then
            echo "::error::Bundle identifier is '$bundle_id'; expected '$EXPECTED_BUNDLE_ID'."
            exit 1
          fi
          if [ "$short_version" != "$RELEASE_VERSION" ]; then
            echo "::error::CFBundleShortVersionString is '$short_version'; expected '$RELEASE_VERSION'."
            exit 1
          fi
          if [ "$bundle_version" != "$RELEASE_VERSION" ]; then
            echo "::error::CFBundleVersion is '$bundle_version'; expected '$RELEASE_VERSION'."
            exit 1
          fi
          if [ "$min_macos" != "$EXPECTED_MIN_MACOS" ]; then
            echo "::error::LSMinimumSystemVersion is '$min_macos'; expected '$EXPECTED_MIN_MACOS'. The explicit config merge may have changed bundle.macOS unexpectedly."
            exit 1
          fi

          echo "== entitlements: output must be readable and App Sandbox must be absent =="
          if ! codesign --display --entitlements - "$app" > entitlements-app.txt 2> entitlements-app-stderr.txt; then
            echo "::error::codesign could not read the app's entitlements."
            cat entitlements-app-stderr.txt || true
            exit 1
          fi
          cat entitlements-app-stderr.txt || true
          cat entitlements-app.txt
          if [ ! -s entitlements-app.txt ]; then
            echo "::error::codesign returned success but no entitlement representation. The expected empty plist is still represented as [Dict]; empty output cannot prove the app is unsandboxed."
            exit 1
          fi
          if grep -Fiq 'invalid entitlements blob' entitlements-app-stderr.txt; then
            echo "::error::codesign reported an invalid entitlement blob; the OS may ignore it and the release contract cannot be proven."
            exit 1
          fi
          if grep -Fq 'com.apple.security.app-sandbox' entitlements-app.txt; then
            echo "::error::The direct-download app carries the App Sandbox entitlement. It must use entitlements.dmg.plist, not the App Store overlay."
            exit 1
          fi

          if [ -e "$app/Contents/embedded.provisionprofile" ]; then
            echo "::error::This Phase 4 app unexpectedly embeds a provisioning profile. The approved configuration has an empty entitlement plist and no restricted entitlement requiring a Developer ID profile; stop and determine what changed."
            exit 1
          fi
          echo "no embedded provisioning profile, as required by this app's current release contract"

          echo "== spctl assess: app =="
          spctl -a -t exec -vvv "$app"

          echo "== stapler validate: app =="
          xcrun stapler validate "$app"

          echo "== lipo architectures =="
          executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$plist")"
          archs="$(lipo -archs "$app/Contents/MacOS/$executable")"
          echo "archs: $archs"
          case " $archs " in
            *" x86_64 "*) ;;
            *) echo "::error::Universal binary is missing x86_64."; exit 1 ;;
          esac
          case " $archs " in
            *" arm64 "*) ;;
            *) echo "::error::Universal binary is missing arm64."; exit 1 ;;
          esac
          echo "Universal binary contains arm64 and x86_64"

      - name: Stage DMG and evidence
        run: |
          set -euo pipefail
          mkdir -p artifacts/evidence
          cp "$DMG_PATH" artifacts/
          cp toolchain.txt codesign-dmg.txt codesign-app.txt entitlements-app.txt entitlements-app-stderr.txt notarytool-submit.json notarytool-dmg-log.json artifacts/evidence/
          cd artifacts
          shasum -a 256 ./*.dmg | tee SHA256SUMS.txt
          shasum -a 256 -c SHA256SUMS.txt

      - name: Upload DMG artifact
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: cpr-trainer-pro-macos-universal-dmg
          path: artifacts/
          if-no-files-found: error
          retention-days: 30

      - name: Create draft GitHub Release - final tags only
        if: ${{ steps.ref_guard.outputs.channel == 'final' }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          gh release create "$REF_NAME" \
            artifacts/*.dmg \
            artifacts/SHA256SUMS.txt \
            --repo "$GITHUB_REPOSITORY" \
            --verify-tag \
            --draft \
            --title "CPR Trainer Pro $REF_NAME (macOS)" \
            --notes "Universal (arm64 + x86_64) Developer ID signed, notarized and stapled DMG. DRAFT - do not publish until final-DMG hardware smoke has passed and publication is separately authorized."
```

After creating the file, compute and record its actual byte count, line count, and Git blob ID:

```bash
wc -c -l .github/workflows/release-macos.yml
git hash-object .github/workflows/release-macos.yml
```

Expected Git blob ID: `c77c70c0c7224eff4c199c76b25afebec5bcc580`.

Expected size: 26,614 bytes and 614 lines.

Compare them with the immutable values stated in the approved copy of this plan. Any mismatch means transcription or line endings changed; do not compensate by changing the stated hash.

## 6. Workflow behavior and rationale

### 6.1 Trigger and tag grammar

The only trigger is a push of `mac-v*`. GitHub filters are globs, so the first shell step provides the real validation. Accepted names are exactly:

- Candidate: `mac-vX.Y.Z-rcN`, where each version component and `N` contain one or more decimal digits.
- Final: `mac-vX.Y.Z`.

The candidate ordinal is a literal digit string, not a numeric ordering operation: `rc0`, `rc01`, and `rc1` are syntactically valid distinct tag names. This preserves the accepted `[0-9]+` contract. Operationally use ordinary positive ordinals beginning with `rc1`; do not create a leading-zero or zero candidate unless separately adjudicated.

Rejected examples include `mac-vgarbage`, `mac-v3.0`, `mac-v3.0.0-rc`, `mac-v3.0.0-rcX`, `mac-v3.0.0-beta1`, and any valid-looking tag whose version differs from either application config.

`workflow_dispatch` is intentionally absent. GitHub only delivers that event when the workflow file is on the default branch, while this workflow must remain isolated on `mac-build`. Candidate tags replace the canonical plan's manual-candidate intent without changing `main`.

### 6.2 Final-tag candidate proof

Ancestry alone is insufficient. Checkout's `fetch-depth: 0` supplies the complete branch history and tag set without leaving a token in Git configuration. For a final tag, the workflow:

1. Confirms the fetched `origin/mac-build` tracking ref exists and proves the tagged commit is contained in it.
2. Lists the same-version `-rc*` tags from checkout's complete tag set.
3. Re-validates each name against the strict grammar because `git tag -l` uses a glob.
4. Requires the candidate tag to resolve to the exact final-tag commit.
5. Queries every page of the `release-macos.yml` workflow-run API for that tag.
6. Independently requires the returned run to identify the candidate tag as `head_branch`, to have event `push`, to have the exact `head_sha`, and to be completed successfully.

`actions: read` is necessary for the run query. `contents: write` is necessary for the draft release; declaring either permission sets every unspecified permission to `none`.

This proves source identity and candidate-CI success. It does not prove which successful run's DMG passed hardware QA; Francisco's candidate record closes that human part.

### 6.3 Duplicate-release protection

The final path enumerates all release pages, including drafts, before any dependency installation or build. A GitHub API, authentication, rate-limit, or JSON failure terminates the step under `set -euo pipefail`. There is no fixed 200-release window and no conversion of API failure into “not found.”

### 6.4 Certificate behavior

The p12 preflight first mirrors `tauri-macos-sign` 2.3.4's base64 rules: remove only ASCII whitespace and require canonical padded standard base64. This avoids Node's otherwise-permissive decoder accepting a value that pinned Tauri would reject after compilation. It then proves only a necessary signing condition: at least one currently valid `Developer ID Application` identity for team `8ZGSY5NJPJ` has an accessible private key. It deliberately does not claim to mirror Tauri's selected certificate.

`tauri-macos-sign` 2.3.4 searches certificates—not identities—using `security find-certificate -p -a -c` for seven name prefixes, converts them into `Team` values, sorts/deduplicates through a `BTreeSet`, and chooses `.first()`. `security find-identity -v` answers a different question. Other recognised certificate classes are therefore warnings, not hard preflight failures. The actual DMG and app `Authority` plus `TeamIdentifier` gates are authoritative.

`security find-identity` must not use `-p codesigning`, per the repository's established certificate-preflight behavior.

### 6.5 Tauri signing and notarization boundary

The workflow first runs verbose `tauri build --no-bundle` without any Apple secret in that step. Tauri therefore executes the repository's configured `beforeBuildCommand` and all frontend/Rust compilation without placing the certificate or notarization credentials in that step's environment. The pinned CLI then runs `tauri bundle` against the already-built universal binary with the five Apple values. Both invocations pass `--ci`, making noninteractive behavior explicit. `tauri bundle` runs only `beforeBundleCommand` (unset in this repository), imports the p12 into its own temporary keychain, signs nested executable targets inside-out, signs the app with hardened runtime, zips and submits the app to `notarytool`, waits for `Accepted`, and calls stapler on the app. It then constructs and signs the DMG. This is the same build-plus-bundle pipeline exposed by one `tauri build`, split at the exact CLI boundary that prevents routine environment inheritance of signing credentials.

The credential-bearing `tauri bundle` call deliberately omits `--verbose`. In `tauri-macos-sign` 2.3.4, debug logging of the `security import` command includes the `-P` argument and its password. GitHub normally masks exact secret values, but release safety must not depend on redaction; normal Tauri output and the post-build gates retain the necessary diagnostics without asking the dependency to print that command line.

This split is exposure reduction, not a hostile-code sandbox: both steps share one runner, so deliberately malicious build code could attempt to persist state for a later step. The lockfiles and reviewed source remain part of the release trust boundary. Full isolation would require a separate clean signing job plus a carefully authenticated handoff of the complete built tree, which is a materially different release architecture and is not introduced during conference freeze.

Tauri does not submit or staple that finished DMG in `tauri-bundler` 2.9.1. The workflow must do so explicitly.

`tauri-macos-sign` 2.3.4's app-stapling helper checks whether `xcrun` could be spawned but discards the process exit status. The mounted-app `stapler validate` gate is therefore the proof that the app ticket actually attached.

The workflow allows up to 240 minutes because compilation, Tauri's app notarization, and the separate DMG notarization are sequential. The explicit DMG submission waits up to 90 minutes; routine completion should be much faster, but a legitimate slow Apple response must not be converted into an avoidable rebuild by a 120-minute whole-job cap.

### 6.6 Entitlement proof

The approved source entitlement file is an empty dictionary. `codesign --display --entitlements -` without `--xml` asks `codesign` for the documented human-readable representation of DER entitlements. On current macOS, a correctly embedded empty plist produces `[Dict]`, while a sandboxed fixture includes `[Key] com.apple.security.app-sandbox`.

The gate requires all of the following:

- The command exits successfully.
- Standard output is nonempty; success plus empty output is not accepted.
- Stderr does not report an invalid entitlement blob.
- The abstract representation does not contain the App Sandbox key.

This avoids the observed current-macOS case where `--xml` exits zero with empty stdout for DER-only entitlements. Stderr remains separate and is archived because normal `codesign` output includes the executable path there.

The provisioning-profile check is an app-specific configuration invariant, not proof of Developer ID status and not a fallback for entitlement parsing. macOS App Sandbox entitlements can exist without a profile, and Developer ID apps can legitimately embed profiles when they use restricted entitlements. This app's approved Phase 4 configuration has an empty entitlement plist and no restricted entitlement, so a profile would be unexplained configuration drift and is rejected.

### 6.7 Artifact gates

Before DMG notarization:

- Exactly one DMG must exist.
- Its name must end in `_<version>_universal.dmg`.
- `codesign --verify --strict` must pass.
- `Authority` must be Developer ID Application and `TeamIdentifier` must match.

After DMG notarization and stapling:

- The notary submission must exit zero, return an ID, and report `Accepted`.
- The accepted submission's log must be valid JSON.
- Error-severity log issues fail; warning/informational issues generate a workflow warning and stay in evidence.
- `hdiutil verify`, DMG `stapler validate`, and the disk-image Gatekeeper assessment must pass.

Inside the mounted DMG:

- Exactly one top-level app must exist.
- Deep strict code-signature verification must pass.
- Developer ID authority and team must match, and the app's CodeDirectory must carry the hardened-runtime flag.
- `Info.plist` identifier, short version, bundle version, and minimum OS must match config/tag expectations.
- Entitlements must be readable, nonempty as a representation, valid, and unsandboxed.
- This app must not embed a provisioning profile.
- App Gatekeeper assessment and app `stapler validate` must pass.
- The executable named by `CFBundleExecutable` must contain both architectures according to `lipo -archs`.

### 6.8 Evidence and release behavior

Every successful run uploads:

- The DMG.
- `SHA256SUMS.txt`, generated and verified from inside the artifact directory.
- `toolchain.txt`, including runner image metadata, host architecture, OS, Xcode, Node, npm, Rust, Cargo, jq, gh, and installed Rust targets. On final tags, before either release API guard can run, the workflow verifies that `gh` exists and that `gh api --help` advertises both `--paginate` and `--slurp`; it captures the first version line in `GH_VERSION_LINE`, which the later evidence step records without an early-closing `head` pipeline. An unsupported final runner fails before dependency installation, signing, or notarization with an explicit console error. Candidate tags skip this final-only capability gate because they perform no GitHub API or release operation; their evidence records the available gh version best-effort, or a clear not-installed/version-unavailable marker, without failing the candidate. The capability check is authoritative for finals; the historical minimum is gh 2.48.0 because the official v2.47.0 source has no `Slurp` option and v2.48.0 does.
- DMG and app code-signing dumps.
- Entitlement stdout and stderr.
- Notary submission JSON and complete accepted-submission log.

Candidate tags stop after artifact upload. Final tags additionally create a draft release and attach only the DMG and checksum file. Nothing automatically publishes a release.

All four external actions are pinned to the exact commits resolved from their official `v4` or `stable` refs on 2026-08-08. Node.js/npm and Rust are separately pinned to exact versions because immutable action code does not make a moving runtime input immutable. This workflow handles long-lived Apple credentials, so mutable action references are not acceptable even though the existing non-release workflows still use them. Checkout also sets `persist-credentials: false`; dependency and build scripts therefore cannot recover the write-capable `GITHUB_TOKEN` from Git configuration. No later Git fetch is attempted: checkout's `fetch-depth: 0` snapshot supplies all branch history and tags needed by the guards. The two API/release steps receive the token explicitly only where needed.

## 7. Exact records changes

### 7.1 `DECISIONS.md`

Append this section after the existing final section. Use the actual implementation date if authorization occurs after 2026-08-08; otherwise use this exact heading and content:

```markdown
## 2026-08-08
- The macOS direct-download release pipeline is isolated on `mac-build` in `.github/workflows/release-macos.yml`, runs only for strict `mac-v*` candidate/final tags, uses the `macos-15` arm64 hosted-runner label with explicit Bash, and leaves the existing compile-check and gitleaks workflows unchanged.
- All external actions in the credential-bearing release workflow are pinned to full commit SHAs, Node.js/npm and Rust are pinned to exact versions, checkout does not persist the write-capable GitHub token, and universal compilation runs without Apple credentials before a separate `tauri bundle` step receives them for signing and notarization.
- `src-tauri/tauri.release.conf.json` pins updater artifacts off, hardened runtime on, the empty direct-download entitlement plist, and the `Developer ID Application` certificate-name assertion; the explicit config deep-merges over the base config and does not load the App Store overlay.
- Tauri 2.11.1 / tauri-bundler 2.9.1 notarizes the app and signs but does not notarize the completed DMG, so CI separately notarizes and staples the DMG and validates tickets on both layers.
- tauri-macos-sign 2.3.4 does not inspect the app stapler process exit status, making the mounted-app `stapler validate` check the authoritative proof that the app ticket attached.
- Certificate preflight requires a valid Developer ID Application identity for team `8ZGSY5NJPJ` but does not attempt to reproduce Tauri's certificate ordering; other Tauri-recognised classes are warnings, while post-build Authority and TeamIdentifier checks prove the certificate actually used. Multiple valid same-team Developer ID identities are allowed.
- Candidate tags are exactly `mac-vX.Y.Z-rcN` and never create a release. A final `mac-vX.Y.Z` tag must use the same application version and exact commit as a strictly named candidate tag with a completed successful release workflow run.
- `workflow_dispatch` is intentionally absent because GitHub only delivers it for workflows present on the default branch; explicitly pushed candidate tags preserve the manual-candidate intent without changing `main`. The workflow does not require a cryptographically signed or annotated tag; release authorization and tag-protection policy remain repository-governance concerns.
- `mac-v*` tag creation, update, and deletion must be restricted to authorized release managers through repository rules or an explicitly approved compensating control. CI validates tag syntax and source state but cannot prove human authorization or completed hardware QA.
- The direct-download artifact's DER entitlement representation must be readable and nonempty and must not contain App Sandbox. An embedded provisioning profile is rejected for this app's current empty-entitlement release contract, while recognizing that Developer ID profiles are legitimate for other apps using restricted entitlements.
- Native dSYMs are not produced for macOS 3.0.0 because the existing release profile strips binaries and emits no debug information; Francisco accepted the resulting inability to fully symbolize native crashes for the conference release, and `Cargo.toml` remains unchanged.
- CI creates final GitHub Releases as drafts only. Publication requires separate authorization after the final DMG's abbreviated hardware smoke.
```

### 7.2 `CONTEXT.md`

Replace only the four bullets under `## Current state (session handoff)` with this block. Do not rewrite the rest of the file:

```markdown
- **Completed most recently**: Phase 3 is signed off at `fc4825c`. Phase 4's release-only config and tag-triggered universal Developer ID workflow are now implemented on `mac-build`, but no signed candidate has run yet, so signing, app/DMG notarization, stapling, and universal packaging remain implemented-but-unproven.
- **In progress**: Independent review of the Phase 4 implementation, followed by Francisco creating the first strict `mac-v3.0.0-rcN` candidate tag, downloading the resulting quarantined DMG, recording its workflow run and SHA-256, and completing the full reference-Mac hardware battery.
- **Immediate next task**: If candidate CI and hardware QA pass, place `mac-v3.0.0` on exactly the approved candidate commit, let CI create a new signed/notarized final DMG and draft release, run the abbreviated smoke on that final DMG, and obtain separate publication authorization. Phase 4b conference-drive staging follows Phase 4 sign-off.
- **Known-broken or untested areas**: The actual p12 contents, notarization credentials, Apple service turnaround, universal build, signatures, tickets, Gatekeeper results, and downloaded-DMG behavior remain unverified until the first candidate run and hardware battery. The workflow proves source identity and candidate CI success but cannot prove which successful candidate artifact Francisco tested; the run URL and SHA-256 must be retained. The final build is different signed bytes and requires its own abbreviated smoke. Native dSYMs remain deliberately deferred for macOS 3.0.0, so native crashes cannot be fully symbolized later. Mac App Store work remains on hold.
```

## 8. Local verification after editing

Run in this order before staging anything:

```bash
git diff --check
python3 -c "import json; json.load(open('src-tauri/tauri.release.conf.json')); print('JSON OK')"
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release-macos.yml')); print('YAML OK')"
git hash-object src-tauri/tauri.release.conf.json
git hash-object .github/workflows/release-macos.yml
wc -c -l src-tauri/tauri.release.conf.json .github/workflows/release-macos.yml
npx --no-install tsc --noEmit
npx --no-install vitest run
(cd src-tauri && cargo test)
git status --porcelain
```

Run actionlint 1.7.7 with ShellCheck 0.11.0 integration over the new file:

```bash
test "$(actionlint -version | head -1)" = "1.7.7"
test "$(shellcheck --version | awk '/^version:/{print $2}')" = "0.11.0"
actionlint -shellcheck="$(command -v shellcheck)" .github/workflows/release-macos.yml
```

The new workflow must produce zero findings. If either exact tool is unavailable, stop and install or otherwise provide that version rather than reporting the check as passed. A repository-wide actionlint run may still report the pre-existing `macos-15-intel` runner-label warning in `build.yml`; do not modify that workflow in this phase.

Before commit, manually compare the workflow file with this exact fenced block and confirm:

- No `workflow_dispatch` trigger exists.
- Every `uses:` reference is an immutable full commit SHA.
- Node.js/npm and Rust are pinned to 20.20.2/10.8.2 and 1.97.1, and each has an explicit post-install version gate.
- Checkout has `persist-credentials: false`.
- Universal compilation uses explicit noninteractive mode and verbose `tauri build --no-bundle` without Apple secrets, followed by an explicit noninteractive, non-verbose `tauri bundle` with them.
- `runs-on` is `macos-15`, not `macos-latest`.
- Job timeout is 240 minutes and the explicit DMG notary timeout is 90 minutes.
- `permissions` contains both `contents: write` and `actions: read`.
- The final-candidate and release-existence API calls use `--paginate --slurp`.
- Entitlement extraction omits `--xml`, requires nonempty stdout, checks the invalid-blob warning, and rejects the sandbox key.
- The provisioning-profile error is scoped to this app's current release contract.
- Candidate runs never call `gh release create`; final runs create a draft only.

Allowed final status entries are the five intended paths plus the pre-existing untracked older plan file that Francisco did not authorize for staging. No `.DS_Store`, generated build output, temporary certificate, p12, secret, or unrelated file may be staged.

## 9. Commit and push plan

Do not create commits or push until Francisco explicitly authorizes implementation after review.

Once authorized, use three commits:

1. Canonical approved plan only: `docs/plans/CPR_Trainer_Pro_macOS_Phase4_Prompt.md`.
2. One atomic pipeline commit: `src-tauri/tauri.release.conf.json` and `.github/workflows/release-macos.yml`.
3. Records only: `CONTEXT.md` and `DECISIONS.md`.

Suggested subjects:

1. `phase 4 0: commit audited macOS release plan rev 8`
2. `phase 4 1: add signed notarized universal macOS workflow`
3. `phase 4 2: record macOS release pipeline decisions`

Stage named paths only:

```bash
git add docs/plans/CPR_Trainer_Pro_macOS_Phase4_Prompt.md
git commit -m "phase 4 0: commit audited macOS release plan rev 8"

git add src-tauri/tauri.release.conf.json .github/workflows/release-macos.yml
git commit -m "phase 4 1: add signed notarized universal macOS workflow"

git add CONTEXT.md DECISIONS.md
git commit -m "phase 4 2: record macOS release pipeline decisions"
```

Let pre-commit hooks run. Never use `--no-verify`. Confirm the branch contains only the intended commits and changes:

```bash
git log --oneline --decorate fc4825c..HEAD
git diff --stat fc4825c..HEAD
git diff --name-status fc4825c..HEAD
git status --porcelain
```

Push only the explicit branch:

```bash
git push origin mac-build
```

Do not push `--all`, do not force-push, and do not push any tag.

After push, wait for the existing `Build CPR Trainer Pro` and `gitleaks` workflows on `mac-build`. Both must be green before the candidate tag is authorized. A failure is investigated; it is not bypassed.

## 10. Candidate runbook

Tag creation remains Francisco's action. The implementer must not execute these commands unless separately authorized. The safe sequence is:

1. Confirm the independent code review is accepted and branch CI is green.
2. Confirm the desired candidate commit is the `mac-build` tip and no changes will be added during QA.
3. Choose the next unused candidate tag, initially `mac-v3.0.0-rc1`.
4. With separate tag authorization, create an annotated tag at the recorded commit and push only its fully qualified ref; substitute the chosen tag and exact 40-character commit:

   ```bash
   git tag -a mac-v3.0.0-rc1 0123456789abcdef0123456789abcdef01234567 -m "CPR Trainer Pro macOS 3.0.0 release candidate 1"
   git push origin refs/tags/mac-v3.0.0-rc1
   ```

   Immediately confirm GitHub resolves the tag to the intended commit. Stop if it does not:

   ```bash
   git ls-remote origin refs/tags/mac-v3.0.0-rc1 'refs/tags/mac-v3.0.0-rc1^{}'
   ```

5. Wait for `Release macOS DMG` to complete. If any preflight or gate fails, stop, preserve the logs, and adjudicate the cause. Do not weaken a gate merely to get a green run.
6. Download `cpr-trainer-pro-macos-universal-dmg` through the GitHub web interface.
7. Verify `SHA256SUMS.txt` after extraction from inside the extracted artifact directory:

   ```bash
   shasum -a 256 -c SHA256SUMS.txt
   ```

8. Record candidate tag, commit, workflow run ID/URL, runner image, DMG filename, SHA-256, tester, date, and result.
9. Ensure the browser download carries quarantine:

   ```bash
   xattr -p com.apple.quarantine "/path/to/CPR Trainer Pro_3.0.0_universal.dmg"
   ```

10. Run the full reference-Mac battery: Gatekeeper assessment, open/mount, drag to `/Applications`, first launch, first play with sound without changing volume, full-course offline playback, cold offline launch timing, Presenter behavior, USB auto-detection/import, and all previously binding Phase 0–3 hardware checks.

The candidate is rejected if its checksum does not match, quarantine is absent because it was not downloaded through a normal browser path, Gatekeeper rejects it, or any required hardware behavior fails.

## 11. Final tag and draft-release runbook

Only after candidate acceptance:

1. Confirm the candidate record identifies a successful run and the exact commit.
2. Confirm the repository has not added a release or final tag for the version.
3. With separate tag authorization, place an annotated `mac-v3.0.0` tag on the exact 40-character accepted candidate commit and push only `refs/tags/mac-v3.0.0`, using the same explicit form as the candidate commands. Confirm the remote peeled tag commit with `git ls-remote` before proceeding.
4. The workflow must prove the same-commit successful candidate before building.
5. Wait for the final workflow. It performs a fresh build, app notarization, DMG notarization, complete gates, artifact upload, and draft release creation.
6. Download the final draft DMG through the browser and separately download the final workflow artifact so its evidence and `toolchain.txt` are available. Do not reuse the candidate DMG for this smoke.
7. Verify the final SHA-256 against the attached manifest and record it.
8. Confirm quarantine exists.
9. Run the abbreviated final smoke:

   ```bash
   spctl -a -t open --context context:primary-signature -vv "/path/to/final.dmg"
   xcrun stapler validate "/path/to/final.dmg"
   ```

10. Mount, drag the app to `/Applications`, launch it, and confirm first play has sound without touching volume.
11. Compare candidate and final `toolchain.txt`; investigate material image, Xcode, Node, or Rust drift before publication.
12. Obtain explicit publication authorization. The workflow never publishes automatically.

## 12. Failure handling and rollback

- Preflight failure before compilation: correct the external secret/tag/release condition only after adjudication. Do not edit workflow logic reflexively.
- Certificate import or identity failure: re-export the intended Developer ID Application certificate and private key, update the secret, and rerun the same tag only after approval.
- Wrong post-build Authority or team: treat the p12's extra recognised certificate as the likely cause; re-export a minimal p12. Never weaken the Authority or team gates.
- App notarization failure inside Tauri: preserve the complete credential-bearing bundle-step log. Tauri reports the app submission failure without verbose command tracing; no DMG submission should occur.
- DMG notarization rejection: preserve `notarytool-submit.json` and any fetched log. Fix the reported signing/content issue before another build.
- Stapler failure or validation failure: do not upload or release the DMG. The ticket is not proven attached.
- Duplicate draft left by a partial final run: inspect it, then delete it only with explicit authorization before rerunning. Do not silently overwrite it.
- Artifact gate failure: retain logs; do not publish or manually upload the failed DMG.
- Branch rollback before any tag: revert the three Phase 4 commits with ordinary revert commits only if authorized. Do not reset or rewrite shared history.
- After a candidate or final tag exists: do not move or delete it without explicit release-management authorization. Use a new `-rcN` for a corrected candidate and a new version if a published final release must be superseded.

## 13. Forbidden actions

- Do not modify `build.yml`, `gitleaks.yml`, `tauri.conf.json`, `tauri.appstore.conf.json`, `entitlements.dmg.plist`, `entitlements.mas.plist`, `Cargo.toml`, `Cargo.lock`, `package.json`, or `package-lock.json`.
- Do not touch any file under `src/` or `src-tauri/src/`.
- Do not add the workflow to `main`, merge `mac-build` toward a shared branch, or merge a shared branch into `mac-build` as part of this phase.
- Do not add a provisioning profile, `productbuild`, Transporter, `altool`, or any other Mac App Store operation.
- Do not print, archive, upload, stage, or commit secrets, certificates, passwords, API keys, p12 data, or temporary keychains.
- Do not run `git add -A` or stage `.DS_Store` or old unapproved plan drafts.
- Do not create, push, move, or delete tags without separate authorization.
- Do not enable the release tags until `mac-v*` creation/update/deletion controls and `mac-build` write protection have been reviewed and recorded.
- Do not publish the draft release without separate authorization after final hardware smoke.
- Do not bypass hooks, checks, signature gates, notary-log checks, or hardware gates.
- Do not create dSYMs or change the Rust release profile in this conference phase.

## 14. Required implementation report

Report all of the following:

- The three commit SHAs and final `mac-build` tip.
- Exact `git hash-object`, byte count, and line count for both new files.
- `git diff --stat fc4825c..HEAD` and `git diff --name-status fc4825c..HEAD`.
- Results and counts for TypeScript, Vitest, and Cargo tests before and after editing.
- Results of JSON parsing, YAML parsing, `git diff --check`, actionlint, and ShellCheck.
- Existing branch CI run URLs and conclusions after push.
- Confirmation that no tag or release was created by the implementer.
- The approved `mac-v*` tag-governance control, authorized release managers, and any ruleset bypass actors.
- Every discrepancy from this plan, even if it seemed harmless.

After candidate execution, append the candidate run URL, tag, commit, image version, DMG name, checksum, CI conclusion, and complete hardware result. After final execution, append the final run and draft-release URLs, final checksum, final smoke result, and publication decision.

## Appendix A — Primary-source verification record

The following claims were rechecked against the exact packaged crate sources, not a moving development branch:

- `tauri-cli-2.11.1.crate`: SHA-256 `428e5b9247e54494e72627e1bb21338969749ae2d672bebb36d69b8e5310cbf2`.
- `tauri-bundler-2.9.1.crate`: SHA-256 `1ab3b74b151e702edba8d2ea59dbdc98de5eedd7f613a04dc40c0657bf398980`.
- `tauri-macos-sign-2.3.4.crate`: SHA-256 `6b840687598c778dfb4a83f175a8885573d04c336266b8a2c2df5deabade92ea`.
- `tauri-utils-2.9.1.crate`: SHA-256 `d57200389a2f82b4b0a40ae29ca19b6978116e8f4d4e974c3234ce40c0ffbdec`.

- `tauri-cli` 2.11.1 `src/lib.rs`: a path-valued `--config` argument is read during argument parsing relative to the invoking process's current directory.
- `tauri-cli` 2.11.1 `src/helpers/config.rs`: explicit config values are merged after the base/platform config using `json_patch::merge`.
- `tauri-utils` 2.9.1 `src/config/parse.rs`: the automatic macOS JSON override is `tauri.macos.conf.json`, not `tauri.appstore.conf.json`.
- `tauri-bundler` 2.9.1 `src/bundle/macos/sign.rs`: p12 presence creates a temporary keychain; configured signing identity is checked with `contains`; absence of both certificate and identity returns no keychain; entitlements are passed to `codesign`; app notarization credentials come from the Apple environment variables.
- `tauri-macos-sign` 2.3.4 `src/keychain/identity.rs` and `src/keychain.rs`: seven certificate prefixes are enumerated with `security find-certificate`, `Team` ordering is used through a `BTreeSet`, and the first certificate is selected.
- `tauri-macos-sign` 2.3.4 `src/lib.rs`: certificate base64 decoding strips ASCII whitespace and uses the base64 0.22 `STANDARD` engine, whose default requires canonical padding and rejects noncanonical trailing bits.
- `tauri-macos-sign` 2.3.4 `src/lib.rs`: the app is zipped and submitted with `notarytool`; accepted app submissions call stapler; the stapler helper ignores its process status.
- `tauri-bundler` 2.9.1 `src/bundle/macos/app.rs`: the app is signed and notarized before bundling; `CFBundleExecutable`, identifier, short version, bundle version, and minimum OS are written from bundler settings.
- `tauri-bundler` 2.9.1 `src/bundle/macos/dmg/mod.rs`: universal naming uses `universal`; the completed DMG is signed but not submitted to the notary service.

Apple's current notarization documentation requires Developer ID signing and hardened runtime, recommends reviewing accepted-submission warnings, and describes separate notarization/stapling of distributable containers. Apple TN3125 documents that default `codesign --entitlements` output is the human-readable DER representation, that `--xml` forces XML, that App Sandbox entitlements can be unrestricted on macOS, and that both Developer ID and App Store apps may legitimately use provisioning profiles when restricted entitlements require them.

GitHub's workflow documentation confirms that tag filters are globs, explicit Bash runs as `bash --noprofile --norc -eo pipefail`, `workflow_dispatch` only receives events from a workflow on the default branch, and unspecified permissions become `none` when any permissions are declared. The exact pinned checkout README confirms that `fetch-depth: 0` fetches all history for all branches and tags and that `persist-credentials: false` opts out of leaving the token in Git configuration. GitHub's hosted-runner documentation identifies `macos-15` as the arm64 standard runner label; the label pins an OS family, not an immutable image build.

Runtime and action provenance was also checked on 2026-08-08:

- Node's official distribution index lists `v20.20.2` with npm `10.8.2` and both macOS arm64 and x64 assets.
- Rust's official stable manifest is dated 2026-07-16 and identifies Rust `1.97.1`; the relevant Apple host and standard-library targets are available.
- The pinned `dtolnay/rust-toolchain` action defines a moving `stable` default when `toolchain` is omitted, which is why the workflow explicitly supplies `1.97.1`.
- The four immutable action commits are checkout `11d5960a326750d5838078e36cf38b85af677262`, setup-node `49933ea5288caeca8642d1e84afbd3f7d6820020`, rust-toolchain `4360b52568e2003a75bf9bc1d59f33a8e3fc893c`, and upload-artifact `ea165f8d65b6e75b540449e92b4886f43607fa02`.

## Appendix B — Audit requirements for this plan

Before this plan may be called clean, the reviewer must independently perform all of these passes:

1. Parse the JSON and YAML and run actionlint with ShellCheck integration over the exact embedded workflow.
2. Syntax-check every `run:` block under Bash 3.2 semantics and inspect every pipeline under `set -euo pipefail` for the intended failure condition.
3. Test tag classification for final, valid candidates, malformed rc forms, wrong versions, branch refs, and candidate tags with dots treated literally.
4. Test the final-tag guard with no candidate, malformed candidate, different commit, API failure, in-progress/failed candidate, and successful same-commit candidate across paginated API responses.
5. Test duplicate-release detection with no release, draft release, published release, more than 200 releases, malformed JSON, and API failure.
6. Test secret and certificate gates with missing/empty values, wrong team, malformed base64, wrong p12 password, no identities, correct Developer ID identity, multiple same-team Developer ID identities, ignored Developer ID Installer identity, and extra Tauri-recognised certificate classes.
7. Test notary handling for command failure, missing ID, non-Accepted status, malformed log, `issues: null`, warning-only issues, mixed warning/error issues, and stapler failure.
8. Test DMG/app discovery for zero, one, and multiple artifacts; wrong architecture filename; wrong metadata; wrong Authority/team; code-signature failure; and absent architecture.
9. Test entitlement extraction with a properly signed empty entitlement plist, a sandboxed entitlement, command failure, success with empty stdout, invalid-blob warning, and an unexpected embedded provisioning profile.
10. Re-read the complete plan after corrections for stale revision counts, absolute claims, contradictions between prose and code, unbounded external assumptions, and any step that could create a release, tag, or repository mutation earlier than authorized.

Only a pass with zero remaining findings may be delivered as implementation-ready.

## Appendix C — Completed iterative self-audit

This final document is the survivor of repeated clean-room reviews. Each superseded internal draft was discarded after its finding was corrected; none is an implementation instruction. The cycles found and fixed the following issues:

1. The candidate-run API response was initially trusted too heavily. The workflow now independently checks `head_sha`, `head_branch`, `event`, `status`, and `conclusion` on every accepted run.
2. External actions initially used mutable refs. All four are now pinned to verified full commit SHAs.
3. Checkout initially left the write-capable token in Git configuration. `persist-credentials: false` now removes that exposure.
4. A combined Tauri build/bundle step initially put Apple credentials in the environment of frontend and Rust build hooks. Compilation and bundling are now split at the pinned CLI's supported boundary.
5. The first token-removal correction still attempted later authenticated Git fetches. Those were removed; the exact checkout source confirms that `fetch-depth: 0` supplies all branch history and tags, and the workflow checks that `origin/mac-build` exists locally.
6. The certificate preflight initially used Node's permissive base64 decoder. It now mirrors pinned `tauri-macos-sign` by removing only ASCII whitespace and requiring canonical padded standard base64 before attempting the p12 import.
7. Hardened runtime was initially inherited from Tauri's default but not pinned or verified. The release overlay now sets it explicitly, and the finished app's CodeDirectory runtime flag is a hard gate.
8. The credential-bearing bundle command initially enabled verbose dependency logging. Pinned `tauri-macos-sign` debug-logs `security import` arguments, including `-P`; verbose mode was removed from that step so safety does not depend on GitHub's masking.
9. Action code was immutable but Node and Rust runtime inputs were still moving. Node.js/npm are now pinned to 20.20.2/10.8.2, Rust is pinned to 1.97.1, both are gated after installation, and both Apple Rust targets are checked before compilation.
10. The certificate identity predicate initially used `grep | grep -q` under `pipefail`, which can false-fail on upstream `SIGPIPE`. One `awk` predicate now handles single and multiple valid same-team identities without that pipeline.
11. The workflow's machine proof could be mistaken for human release authorization. The plan now makes `mac-v*` tag governance and `mac-build` write protection explicit prerequisites and states that CI cannot prove hardware QA or authorization.
12. Tauri's noninteractive behavior was initially ambient. Both Tauri invocations now pass the pinned CLI's explicit `--ci` option.

Final mechanical audit, performed on the exact fenced files on 2026-08-08:

- JSON parsed successfully and matched the intended release overlay. Its Git blob ID is `eee290a16fc2a97809fee4b326bdd2f2f6932ad0`; it is 278 bytes and 11 lines.
- YAML parsed successfully as a 26-step job. The Rev 8 file's Git blob ID is `2f7bdef99a1c40699827d51704d7d6a2075988de`; it is 28,295 bytes and 652 lines.
- actionlint 1.7.7 with ShellCheck 0.11.0 integration produced zero findings on the Rev 8 file.
- All 22 `run:` blocks passed `/bin/bash -n` with Apple's Bash 3.2.57.
- Every `uses:` entry is a 40-character immutable commit; no `workflow_dispatch`, later `git fetch`, moving Node runtime, moving Rust channel, or verbose credential-bearing Tauri command remains.
- RFC 7386 merge simulation preserved version `3.0.0`, bundle ID `com.ehacademy.cpr-trainer-pro`, `beforeBuildCommand`, targets, and minimum macOS `12.0`, while applying updater-off, hardened-runtime-on, the direct-download entitlements file, and the signing-identity assertion.
- The pinned CLI itself reported `tauri-cli 2.11.1`; its help confirmed `build --no-bundle`, `bundle` for an already-built binary, universal targets, `--config` merges, and explicit `--ci`.
- Tag/version fixtures covered final, ordinary candidate, leading-zero candidate number as intentionally allowed, malformed rc, beta, wrong version, version-file mismatch, dotted-literal, and branch-ref cases.
- Candidate-run fixtures covered success on the first and a later page, absent run, wrong SHA, wrong head branch, wrong event, in-progress, failed, malformed JSON, and API failure. Release fixtures covered none, unrelated, draft, published, a match after more than 200 releases, malformed JSON, and API failure.
- Secret/base64/certificate fixtures covered each missing secret, wrong team, canonical and whitespace-wrapped base64, missing padding, invalid characters, noncanonical trailing bits, empty data, no identity, installer-only identity, wrong-team identity, one valid identity, and multiple valid same-team identities. Actual Apple secret values remain correctly unobserved and are live-run preflight inputs.
- Notary fixtures covered command failure, missing ID, non-Accepted status, malformed log, missing/null/empty issues, warning-only issues, case-insensitive error severity, mixed issues, and stapler failure. Only error-severity issues fail after `Accepted`; all other reported issues warn and remain evidence.
- Entitlement fixtures used locally signed empty and sandboxed binaries. The empty DER representation produced `[Dict]` and passed; sandbox, command failure, empty-success output, and invalid-blob warning paths failed. Provision-profile presence is a separate app-specific drift failure, not an entitlement fallback.
- Code-signing, metadata, artifact-count, filename, architecture, Gatekeeper, stapler, duplicate-release, and release-channel failure branches were inspected or fixture-tested for both the passing and rejecting condition. The hardened-runtime predicate accepted both `(runtime)` and multi-flag forms and rejected non-runtime forms.
- The macOS repository remained unchanged: `mac-build` stayed at `fc4825cbecc4e0ca6a0844fc2231a66adc44fb37`, with only the two pre-existing untracked plan files. No repository file, commit, branch, tag, release, or remote state was changed by this planning/audit work.

Rev 5/6 self-audit result at the end of those cycles: zero then-known plan findings. Appendices E and F record the fresh Rev 6 counter-review, the first successor's adversarial result, and the correction incorporated into this Rev 8 survivor.

## Appendix D — Cycle-4 adjudication (Claude, 2026-08-08): three amendments producing Rev 6

Claude audited the complete Rev 5 document against primary sources and against the adjudicated Rev 4, including a full omission diff of the workflow (nothing was silently dropped; every Rev 5 change was declared and was independently re-verified). All of Rev 5's substantive changes were verified and accepted: the four action-commit pins resolve to exactly the claimed official refs (checkout `11d5960a…` = v4/v4.4.0, setup-node `49933ea5…` = v4.4.0, rust-toolchain `4360b525…` = current `stable` head, upload-artifact `ea165f8d…` = v4.6.2); Node 20.20.2 is the latest v20 in the official distribution index and bundles npm 10.8.2 with both macOS assets; the current Rust stable channel manifest is dated 2026-07-16 and identifies 1.97.1; all four crate SHA-256 values in Appendix A reproduce exactly; `tauri-macos-sign` 2.3.4 strips ASCII whitespace and decodes with the base64 0.22 `STANDARD` engine, whose `GeneralPurposeConfig::new()` sets `decode_allow_trailing_bits: false` and `decode_padding_mode: RequireCanonical` (read from the packaged crate source); its `piped()` helper debug-logs the complete `security import` argument list including `-P` and its password, which is what justifies the non-verbose credential-bearing bundle step; its `staple_app` discards the process exit status; the seven certificate prefixes in the p12-preflight warning loop match `keychain/identity.rs:90-98` exactly; `security import` in `keychain.rs:105-121` uses no `-f` flag, so the preflight import faithfully mirrors it; the pinned CLI's `tauri --version` prints exactly `tauri-cli 2.11.1`, `build` accepts `--ci --no-bundle --target --config`, `bundle` accepts `--ci --target --config`, universal lipo runs during the build phase (`interface/rust/desktop.rs:172-196`), and `bundle` runs only `beforeBundleCommand` (`bundle.rs:189-194`); the RFC 7386 merge of the Rev 5/6 config over the live `mac-build` `tauri.conf.json` preserves `minimumSystemVersion: 12.0`, `version: 3.0.0`, the identifier, and `beforeBuildCommand`, and validates against the CLI's own `config.schema.json` with zero errors; `hardened_runtime` defaults to `true` in `tauri-utils` 2.9.1 (`config.rs:655,682`), so the overlay key is a pin, not a behavior change; and shellcheck 0.11.0 exists (tag `v0.11.0`).

The three amendments:

1. **K-1 (defect, fixed): the job-level `OUT_DIR` environment variable is a reserved Cargo build-time variable and leaks into `rustc`'s environment.** Proven by execution: in a crate without a build script, `option_env!("OUT_DIR")` observed the ambient job value during compilation. Cargo overrides `OUT_DIR` only for crates with build scripts; every other crate in the dependency graph compiles with the ambient value visible, which can silently change the behavior — or the compilability — of any dependency that reads it. The variable carried this name through every prior revision and was never caught because all prior scenario harnesses stubbed the toolchain instead of running a real `cargo`. Renamed to `UNIVERSAL_OUT_DIR` at its definition and all three use sites. After the rename, the same executable probe confirms `OUT_DIR` is no longer visible to `rustc`, and the amended locate-DMG step was re-fixture-tested for the zero, one-universal, two-DMG, and wrong-architecture cases — all behave identically to Rev 5.

2. **K-2 (evidence, added, then corrected in Revs 7–8): `toolchain.txt` records the `gh` version.** Rev 6 correctly identified the dependency on `gh api --paginate --slurp`, but incorrectly stated the minimum as gh 2.47.0 and recorded the version only after both final-only API guards. Appendices E and F replace that rationale with a final-only pre-use capability gate, candidate-safe evidence behavior, and the source-verified historical minimum, gh 2.48.0.

3. **K-3 (process, clarified): §3.5 now states the concrete minimal governance path for this specific repository** so the tag-governance prerequisite cannot stall the conference timeline: a free tag ruleset or one approved compensating-control sentence, either achievable in minutes.

Considered and not adopted in this cycle: uploading the evidence directory on failed runs (`if: always()`). Failures already dump every log to the console, the artifact step's `if-no-files-found: error` semantics would need restructuring, and adding conditional-upload complexity two days before freeze is the wrong trade. A future round may revisit.

Claude's independent re-validation of the Rev 6 fenced files: JSON parses, blob `eee290a16fc2a97809fee4b326bdd2f2f6932ad0` (unchanged from Rev 5), 278 bytes, 11 lines; YAML parses as a 25-step job with 21 run blocks, blob `c77c70c0c7224eff4c199c76b25afebec5bcc580`, 26,614 bytes, 614 lines; actionlint 1.7.7 with ShellCheck 0.11.0 integration: zero findings; `bash -n` passes on all 21 run blocks; no bash-4-only construct (`mapfile`, `readarray`, `declare -A`, `${var^}`, `&>>`, `|&`) appears in any run block. Two Rev 5 claims rest on Codex's direct macOS observation and could not be reproduced in Claude's Linux sandbox: the `[Dict]` human-readable DER representation for an empty entitlement plist, and `--xml` exiting zero with empty stdout for DER-only entitlements. Both are accepted because the gate built on them fails closed in every direction — a nonempty-output requirement plus an explicit invalid-blob check — so if the observation is wrong on the live runner the candidate run fails visibly and is adjudicated, rather than passing while proving nothing.

Running Phase-4 plan-loop ledger through Rev 6: cycles 1–3 produced 18 findings (all accepted into Rev 4); cycle 4 = Codex's Rev 5 rewrite (twelve self-audit corrections plus the pinning, credential-scoping, and API-pagination hardenings — all independently verified and accepted) plus Claude's three findings above. Appendix E continues the ledger with the fresh Rev 6 counter-review.

## Appendix E — Cycle-5 counter-review and Rev 7 correction ledger (Codex, 2026-08-08)

Codex treated Rev 6 as a new plan, diffed it against the exact Rev 5 predecessor, re-read the live worktree baseline, rechecked the three Rev 6 amendments against primary sources, extracted and mechanically validated both fenced files, and inspected every changed shell path for fail-open and false-fail behavior.

Findings incorporated into Rev 7:

1. **L-1 (medium, fixed): Rev 6 named the wrong minimum GitHub CLI version and had no pre-use capability gate.** Official `cli/cli` v2.47.0 source has `Paginate` but no `Slurp` option or `--slurp` flag; v2.48.0 adds them. A runner with gh 2.47.0 would therefore reject a legitimate final tag even though Rev 6 said that version was supported. Rev 7 adds `Gate - GitHub CLI capabilities` immediately after the pinned Node gate, before either API guard. It fails explicitly if `gh` is absent or if `gh api --help` lacks either required flag, captures the first version line with a fully consuming `sed` pipeline rather than early-closing `head`, and exports it for later evidence. This is a capability gate rather than a numeric version gate, so newer or vendor-patched legitimate clients do not false-fail.

2. **L-2 (low, fixed): Rev 6's K-2 evidence rationale was temporally impossible on the failure it claimed to diagnose.** Both final-only `gh api` guards preceded `Record runner and toolchain`; artifact upload also occurred much later and was not `always()`. If gh lacked `--slurp`, no `toolchain.txt` artifact could exist. Rev 7 states the correct contract: unsupported gh fails before dependency installation with an explicit console annotation, while successful runs record the already-gated version in `toolchain.txt`.

3. **L-3 (low, fixed): the exact commit handoff still labeled the canonical plan as Rev 5.** Both the suggested subject and executable command now say Rev 7, preventing a misleading permanent history entry.

4. **L-4 (low, fixed): the supplied Rev 6 Markdown had no final newline.** This Rev 7 artifact ends with one.

Accepted without correction:

- **K-1 is correct.** `UNIVERSAL_OUT_DIR` avoids leaking Cargo's reserved `OUT_DIR` input to crates and all definition/use sites are consistent.
- **K-3 is correct with its stated manual precondition.** The read-only GitHub API identifies `kikofrn/CPR-Trainer-Pro` as a public repository owned by the personal account `kikofrn`, and returned no active repository rulesets on 2026-08-08. GitHub's official documentation says repository tag rulesets are available for public repositories on GitHub Free, supports `fnmatch` tag targeting, and defines restrict-creation/update/deletion as allowing only bypass actors. A personal repository has one owner plus collaborators, so “repository admin only” selects the owner; Francisco must still perform and record the required collaborator, app-installation, branch-protection, and bypass review before enabling tags. The compensating-control alternative is approval evidence, not an automated assertion.

Rev 7 self-audit cycle:

- **Pass 1:** Re-ran YAML parse, exact step/run counts, `actionlint` 1.7.7 with ShellCheck 0.11.0, `/bin/bash -n` on every run block, immutable-action inspection, Bash-3.2 construct scan, exact blob/byte/line calculations, and a stale-revision/text-consistency scan. Result: zero mechanical findings.
- **Pass 2:** Re-read Rev 7 adversarially as a new document, concentrating on legitimate candidate/final matrices, the new gh gate, tag governance, credential scope, build/bundle separation, notary/stapler fail-closed behavior, artifact/release boundaries, and implementation handoff. Result: one medium finding—the unconditional gh capability gate could false-fail a legitimate candidate that never uses the final-only API path.

Final Rev 7 self-audit result: one remaining finding, so Rev 7 was rejected and superseded; it is not an implementation instruction.

## Appendix F — Cycle-6 successor correction and Rev 8 self-audit (Codex, 2026-08-08)

1. **M-1 (medium, fixed): Rev 7's unconditional GitHub CLI capability gate over-constrained candidate runs.** Only final tags execute the successful-candidate lookup, duplicate-release lookup, or draft-release creation. Rev 8 moves the capability gate after the tag/channel guard and conditions it on `channel == 'final'`. Final tags still fail before any dependency installation or signing if gh is absent or lacks either API flag. Candidate tags skip the gate and the common evidence step treats gh as best-effort: it records the version when available, otherwise a nonfatal marker. Fixtures cover supported final, missing gh final, missing `--slurp` final, candidate with current gh, candidate with broken `gh --version`, and candidate with no gh.

Rev 8 final audit cycle:

- **Pass 1:** Extract the exact JSON and YAML; require JSON/YAML parse success, 26 steps, 22 run blocks, four immutable action pins, actionlint 1.7.7 plus ShellCheck 0.11.0 success, `/bin/bash -n` success for every run block, and exact blob/byte/line values. Result: zero findings; JSON remains blob `eee290a16fc2a97809fee4b326bdd2f2f6932ad0`, 278 bytes, 11 lines, and YAML is blob `2f7bdef99a1c40699827d51704d7d6a2075988de`, 28,295 bytes, 652 lines.
- **Pass 2:** Execute the final/candidate gh fixture matrix and re-run the tag, API, signing, notarization, stapling, metadata, artifact, and release-channel failure analysis against the complete successor. Result: zero findings. Supported finals pass; finals with missing gh or missing `--slurp` fail before build; candidates with current gh, failing `gh --version`, or no gh all pass the evidence preamble. A complete fenced-workflow diff against Rev 6 contains only the final-only capability gate and candidate-safe gh evidence changes; the release overlay is byte-identical.
- **Pass 3:** Scan the complete Markdown for placeholders, malformed fences, stale executable revision labels, missing final newline, contradictions, and any repository/external mutation performed during review. Result: zero findings. All 30 Markdown fence markers are balanced, the file ends in LF, executable handoff labels say Rev 8, and the repository remains at the unchanged baseline with only its two pre-existing untracked plan files.

Final Rev 8 self-audit result: zero remaining findings. This is an implementation-ready specification only after independent human approval; it is not proof of live Apple credentials, current Apple/GitHub service availability, or hardware behavior, which deliberately remain candidate gates.
