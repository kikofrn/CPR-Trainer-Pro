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
  app a dependent companion with `WKRunsIndependentlyOfCompanionApp = false`.
  Commit `eba03d8` added this handoff file and the standing iOS agent rules.
- **In progress**: Build 14 hardware gates are nearly complete. Passed:
  Virtual Assistant video survived Screen Mirroring connect, disconnect, and
  reconnect on an iPhone 16 Pro running an iOS 27 beta; a slideshow video slide
  worked under Screen Mirroring; the in-app audio-output picker was visible,
  tappable, and listed the classroom TV; and repeated HDMI hot-plug and unplug
  transitions during active playback recovered correctly. The picker report
  was a recognizability mismatch caused by its truthful audio-centric glyph,
  not a rendering or routing failure. A deliberate rapid-switch stress run
  between two slideshow video slides caused HDMI audio to stop once while
  video continued; reconnecting the HDMI cable restored audio. This anomaly is
  an open diagnosis, not a failure of the normal-operation HDMI gate.
- **Immediate next task**: Francisco reviews the rapid-switch HDMI audio-loss
  diagnosis and decides whether build 14 should change or record the behavior
  as a known limitation.
- **Known-broken, untested, or deferred areas**: The picker's guidance banner
  still requires a hardware micro-test by selecting the classroom TV from the
  in-app route sheet and confirming that audio moves and the banner appears.
  The text-field and onscreen-keyboard check with an external display is
  unconfirmed, and automatic Watch installation requires a TestFlight or App
  Store install. Slideshow video slides have never included a scrubber; adding
  one is a separately authorized post-conference enhancement. Build 15, a
  split-path native AirPlay implementation using a version-matched HTTPS media
  item, is deferred and requires separate authorization; build 14 stands as a
  complete release candidate on its own. Build 15 should restore the
  video-centric picker presentation when the picker can genuinely deliver
  video. Six of nine binding build 15 amendments have not been recovered from
  their source conversation and must be restated before that round begins.
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
