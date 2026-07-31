# Context

- Stack: SwiftUI and AVFoundation, with a native watchOS companion.
- Release target: iOS 17 or later and watchOS 10 or later. The iOS app is
  universal for iPhone and iPad (`TARGETED_DEVICE_FAMILY = "1,2"`).
- Xcode project:
  `ios-native/CPRTrainerPro/CPRTrainerPro.xcodeproj`.
- Decisions log: `docs/IOS_IMPLEMENTATION_DECISIONS.md`.
- Source of truth: The Cloudflare R2 bucket served at
  `media.ehacademy.com` is the single source of truth for downloadable media.
- Verification before declaring implementation work done includes a Release
  build with embedded Watch binary validation and the `CPRTrainerProTests`
  suite.
- Hardware-dependent behavior is always left open for Francisco to verify on
  the physical device, external display, or TestFlight install.
- Plan documents live at `docs/plans/`.
- Rule: Diffs stay minimal and unrelated code is never touched.

## Current state (session handoff)

- **Completed most recently**: Commit `26b8d17` implemented the build 14
  AirPlay hotfix. `LocalVideoExternalPlaybackPolicy` blocks local video from
  native external playback on every path, the in-app picker was repurposed as
  an audio-output control with a once-per-route guidance banner, and four unit
  tests cover the new policy and guidance tracking. Commit `4acee8c` declared
  `ITSAppUsesNonExemptEncryption = false` in both Info.plists and made the Watch
  app a dependent companion with
  `WKRunsIndependentlyOfCompanionApp = false`.
- **In progress**: Build 14 hardware gates are partially complete. Passed:
  Virtual Assistant video survived Screen Mirroring connect, disconnect, and
  reconnect on an iPhone 16 Pro running an iOS 27 beta, and a slideshow video
  slide worked under Screen Mirroring. Failed: Francisco could not identify or
  use the in-app AirPlay picker. Remaining: HDMI video and audio plus a
  text-field interaction check, and automatic Watch installation through
  TestFlight.
- **Immediate next task**: Francisco must review the AirPlay picker diagnosis
  and explicitly authorize any implementation. The minimal candidate is to
  restore the video-centric picker presentation while keeping local video
  external playback disabled, then repeat the in-app audio-route hardware gate.
- **Known-broken, untested, or deferred areas**: The in-app AirPlay picker is a
  failed hardware gate. Build 15, a split-path native AirPlay implementation
  using a version-matched HTTPS media item, is deferred and requires separate
  authorization; build 14 stands as a complete release candidate on its own.
  Six of nine binding build 15 amendments have not been recovered from their
  source conversation and must be restated before that round begins.
- **Gotchas**: Build 14 deliberately overturned two previously locked
  constraints: `allowsExternalPlayback` is no longer left at its default
  `true`, and the slideshow coordinator is no longer out of scope. Do not
  restore either constraint without first reading the App Store packaging and
  external-playback sections of `docs/IOS_IMPLEMENTATION_DECISIONS.md`. Branch
  `codex/ios-3.0-native-airplay-mirroring` (build 13) is a superseded dead end;
  its commit is already contained in the current branch. Build 13's root cause
  was never proven because the AVFoundation error domain and code were not
  captured. Do not treat local file URLs as a demonstrated platform
  limitation.
