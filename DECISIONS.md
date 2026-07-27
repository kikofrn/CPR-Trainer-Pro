# Decisions

## 2026-07-26
- Bucket is source of truth enforced at build time, not runtime.
- Update detection is etag based via a Cloudflare Worker manifest endpoint at `/api/manifest`.
- Update triggered downloads use version pinned URLs to defeat CDN cache staleness.
- Course structure remains hardcoded in `chapters.ts` and is never replaced at runtime.
- Thumbnails refresh silently without a user prompt.
- The pediatric slideshow courses are live and only the two pediatric Virtual Assistant courses are coming soon.
- This release is Windows only with macOS and iOS ported afterward.
