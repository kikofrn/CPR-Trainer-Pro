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

## Deferred Watch work

- Evaluate the `physical-therapy` background mode in a dedicated Watch change.
- Evaluate an additional “Start CPR” shortcut phrase in a dedicated Watch
  change.
