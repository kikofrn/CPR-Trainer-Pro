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

## Deferred Watch work

- Evaluate the `physical-therapy` background mode in a dedicated Watch change.
- Evaluate an additional “Start CPR” shortcut phrase in a dedicated Watch
  change.
