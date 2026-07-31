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

- **Completed most recently**: Build 14 was fast-forwarded into
  `iOS-final-build` through commit `8f0d100` and finalized under the annotated
  tag `ios-3.0.0-final-build-14`. Commit `26b8d17` implemented the AirPlay
  hotfix, and commit `4acee8c` finalized export-compliance and dependent Watch
  companion metadata. All hardware gates passed: Virtual Assistant and
  slideshow video under Screen Mirroring, Screen Mirroring transitions,
  lip-sync and playback controls, normal HDMI operation including repeated
  hot-plug recovery, the in-app audio-output picker and its guidance banner,
  text-field and onscreen-keyboard interaction with an external display, and
  automatic installation of the dependent Watch companion from the TestFlight
  install.
- **In progress**: Build 14 was archived as version `3.0.0 (14)`, uploaded to
  App Store Connect, processed successfully, and installed through TestFlight.
  All release hardware gates are complete, and the App Store listing and review
  submission remain. One deliberate
  rapid-toggle stress run between two playing slideshow video slides over HDMI
  caused audio to stop while video continued; reconnecting HDMI restored audio.
  Francisco accepted this as a build 14 known limitation because ordinary HDMI
  use and repeated hot-plug testing passed.
- **Immediate next task**: Francisco completes the iOS 3.0.0 product-page,
  privacy, pricing, rights, rating, review, and screenshot metadata in App Store
  Connect, selects build 14, and submits it for App Store review targeting
  August 3-4.
- **Known-broken, untested, or deferred areas**: A post-conference round will
  instrument route-change reasons, audio-session state, media-services resets,
  and player audio state before designing any fix for the accepted rapid-switch
  HDMI limitation. The decision must be revisited immediately if the failure
  appears during ordinary slide navigation. Slideshow video slides have never
  included a scrubber; adding one is a separately authorized post-conference
  enhancement. Build 15, a split-path native AirPlay implementation using a
  version-matched HTTPS media item, is deferred and requires separate
  authorization. Build 15 should restore the video-centric picker presentation
  when the picker can genuinely deliver video. Six of nine binding build 15
  amendments have not been recovered from their source conversation and must
  be restated before that round begins.
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
