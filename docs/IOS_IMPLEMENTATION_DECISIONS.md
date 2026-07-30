# CPR Trainer Pro iOS Implementation Decisions

This log records durable, public-safe implementation decisions for the native
iOS 3.0 release. It intentionally contains no device identifiers, signing
material, private runtime state, or credentials.

## Content identity and migration

- Cloud object keys, sizes, and versions are authoritative for transferred
  media. The bundled catalog remains authoritative for course order, titles,
  and declared availability.
- Startup migration uses corrected bundled metadata synchronously and never
  waits for the network. A later live-manifest comparison may advance a
  version.
- Schema-v1 version records are preserved and canonicalized into schema v2.
  Synthetic fixtures are used in source control instead of real device state.
- A renamed file is moved only when its stored version and its actual on-disk
  byte count both match the corrected bundled metadata. An unvalidated old copy
  is retained until a corrected replacement is proven usable.

## Update checks and transfers

- Update discovery uses one bounded `/api/manifest` request rather than
  per-file `HEAD` or one-byte range probes.
- ETags are compared in canonical form without weak markers or surrounding
  quotes. Positive size differences are authoritative; upload time is only a
  fallback when an installed ETag is unavailable.
- Known versions are pinned in transfer URLs. The previous playable file is
  retained until its replacement passes validation.
- Subtitle updates are user-visible. Thumbnail refreshes are silent and never
  contribute to Download All totals.
- The legacy per-file detection ladder was removed from the app target. A
  source audit after conversion found zero runtime `HEAD` or
  `Range: bytes=0-0` probe requests.
- Course, update, subtitle, and artwork requests share one cellular policy.
  Blocked work remains queued as “Waiting for Wi-Fi” and resumes when the path
  becomes eligible.
- Tapping “Update Now” on a non-Wi-Fi path requires an exact-size confirmation.
  Approval applies only to that persisted update batch and does not silently
  change the user’s global cellular-download preference.
- The update-specific confirmation is required for every known cellular path,
  regardless of batch size or the general cellular-download setting. This
  preserves the explicit product requirement. An unknown initial path never
  presents a cellular prompt; update requests disallow expensive access until
  the path is identified or that exact batch is approved.
- If an eligible path becomes ineligible, in-flight course and update tasks are
  cancelled back to their validated queue state and restart from byte zero.
  Partial bytes from different object versions are never combined.
- Large transfers use a live disk preflight that includes remaining bytes, the
  largest staging file, and a safety margin.

## Prompt and foreground coordination

- Immersive teaching surfaces acquire app-level foreground-experience tokens.
  Update candidates may be retained while a token is active, but prompts wait
  until all tokens and the initial Download All experience have cleared.
- Deferring an update suppresses only that exact filename/version fingerprint
  for the current process; a genuinely newer version remains eligible.

## Artwork and rendering

- Eight explicit course artwork states map one-to-one to exact cloud keys.
  Artwork refresh is silent, version-pinned, downsampled, and cached; the last
  validated download or bundled image remains visible on every failure path.
- Slideshow image work is bounded to the current slide and its immediate
  neighbors. Video slides do not install the deck-swipe recognizer.

## Course modes

- Virtual Assistant and Pediatric are independent choices for each course
  family. Pediatric + Virtual Assistant is an explicit unavailable
  “Coming Soon” state and is never inferred from bucket contents.

## External presentation

- The external-display window keeps `makeKeyAndVisible()` in accordance with
  current Apple guidance and the reproduce-first stability policy. Release gate
  13 physically tests keyboard and first-responder behavior with a projector
  attached. If that regression reproduces, the pre-approved fallback is
  `isHidden = false`.
- A connected external scene owns the shared video surface even while that
  scene temporarily resigns active. Becoming active republishes presentation
  state so the external layer can verify attachment.
- Build 13's automatic conversion from the mirrored external window to native
  AVPlayer external playback failed on the classroom receiver while the player
  was using locally stored video. The exact AVFoundation error domain and code
  were not captured, so the failure must not be documented as a proven
  file-URL platform limitation. A URL scheme is not a capability test.
- Build 14 explicitly applies `allowsExternalPlayback = false` and
  `usesExternalPlaybackWhileExternalScreenIsActive = false` to every local
  video-course and slideshow-video player before installing each item. The
  video-course coordinator also reapplies that policy when routes or
  external-scene state change. This prevents a route selection from exposing a
  local item to native handoff and keeps Screen Mirroring and HDMI on the
  app-rendered external window.
- In build 14, the in-app AirPlay picker is intentionally an audio-output
  control. Selecting an AirPlay route without Screen Mirroring keeps video on
  the iPhone while audio uses the selected route. A non-blocking message shown
  once per AirPlay route session directs instructors to Control Center's
  Screen Mirroring control when they want video on the TV.
- Local player-item failures retain the existing user-facing fatal path and
  now emit structured diagnostics containing the real error domain/code, route
  types, external-scene state, external-playback flags, and item identity.
- Captions remain app-rendered overlays on the local path. No subtitle work is
  attached to a native remote item.
- Build 14 hardware testing on Sheep (iPhone 16 Pro, iOS 27 beta) verified that
  a Virtual Assistant video keeps playing through Screen Mirroring connect,
  disconnect, and reconnect transitions. Video returned to the phone on
  disconnect and moved back to the classroom TV on reconnect without the prior
  external-player failure. TV audio remained lip-synced, and the app caption,
  playback-speed, and native Enhance Dialogue controls did not interrupt
  playback.
- iOS 27 can generate subtitles on-device for downloaded file-based media and
  AVKit can show them automatically when playback is muted. The smaller
  subtitles observed during the hardware test were independent of the app's
  larger authored WebVTT overlay: inspection of the downloaded test clip found
  only H.264 video and AAC audio tracks, with no embedded subtitle track. The
  native player subtitle menu controls the generated subtitles; the app caption
  button continues to control only the authored course captions. This iOS 27
  beta behavior is not an AirPlay failure and does not justify suppressing a
  system accessibility feature.
- The Build 14 hardware gate remains open for the audio-only in-app AirPlay
  picker, a slideshow video slide under Screen Mirroring, HDMI, and the
  projector/keyboard/first-responder regression check.
- Native AirPlay video is deferred to a separately authorized build 15
  split-path implementation using a version-matched HTTPS media item; build 14
  remains a complete release candidate if that later round does not pass.
- Build 15 planning deliberately reverses the earlier “do not consolidate
  stable URL builders” decision because even small drift between update and
  streaming URL construction could select different bytes. That later
  consolidation requires byte-for-byte equivalence tests and the complete
  existing download/update suite to pass.
- Known build 15 test considerations are recorded before implementation:
  chapter changes may pause the TV for up to the bounded preflight duration;
  a receiver that remains externally active while stalled has no automatic
  recovery in that round; position is captured at the moment playback pauses;
  and hardware testing must verify that the controller phone remains awake.
  Next-chapter preverification and stalled-active recovery are explicitly
  future work.

## App Store packaging

- Both the iPhone and Watch Info.plists declare
  `ITSAppUsesNonExemptEncryption = false` because the app uses only standard
  HTTPS/ATS encryption, and the declaration is required for unattended App
  Store archiving.
- The Watch app is a dependent companion with
  `WKRunsIndependentlyOfCompanionApp = false` so instructors can install once
  at the conference without a second manual Watch installation step. Automatic
  Watch installation still depends on the user's Automatic App Install setting.

## Deferred Watch work

- Evaluate the `physical-therapy` background mode in a dedicated Watch change.
- Evaluate an additional “Start CPR” shortcut phrase in a dedicated Watch
  change.

## Accepted verification deltas

- The one-second ETA refresh is intentionally retained because it is bounded
  and makes slow transfers feel responsive without reintroducing filesystem
  scans.
- Pager controller stress and remote-manifest timeout/single-flight behavior
  remain physical-device and integration release gates. Pure state-machine,
  decoding, size-cap, and content-contract coverage stays in the unit suite.
- Foreground-experience reason strings are retained as lightweight diagnostic
  context even though release behavior depends only on token ownership.
