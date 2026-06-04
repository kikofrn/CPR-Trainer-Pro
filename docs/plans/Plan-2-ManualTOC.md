# Plan 2: ManualTOC

## Goal

Upgrade the Manuals experience so each PDF manual behaves like a native book/manual reader while preserving app reliability:

- Swipe left/right to turn pages.
- Stop vertical continuous scrolling.
- Add searchable manual text.
- Add a clickable popout table of contents.
- Add a fallback page list.
- Preserve last-page memory.
- Avoid touching downloads, course launch, video playback, slideshow playback, external display, or casting.

## Architecture

Keep PDFKit as the rendering engine. Do not create a custom PDF renderer in this version.

Likely new/refactored files:

- `ManualViewerView.swift`
- `ManualViewerViewModel.swift`
- `ManualNavigationPanel.swift`
- `ManualTOCService.swift`
- `ManualSearchService.swift`
- `ManualNavigationModels.swift`
- Optional: `manual-toc.json`

## Page Mode

Change PDFKit from vertical continuous scrolling to horizontal page mode:

```swift
pdfView.displayMode = .singlePage
pdfView.displayDirection = .horizontal
pdfView.usePageViewController(true, withViewOptions: nil)
pdfView.autoScales = true
```

Lifecycle rule:

- Load the document first.
- Assign `pdfView.document`.
- Let PDFKit create its internal page controller.
- Restore last page after the view is ready, likely by dispatching to the next main runloop inside the representable coordinator.
- Do not assume `go(to:)` during initial setup always sticks.

## State Ownership

Add `ManualViewerViewModel`.

It owns:

- current manual
- current page index
- page count
- selected navigation panel tab
- search query
- search state
- TOC entries
- whether navigation panel is showing
- last-page persistence key

This keeps state from being scattered through `ManualViewerView`.

## Page Index Convention

Use one convention everywhere:

- Internally: `pageIndex` is zero-based.
- UI: `pageNumber` is one-based.
- JSON: `page` is one-based, because humans will edit it.

Conversion happens only in `ManualTOCService`.

Every page jump must be clamped:

```swift
max(0, min(targetPageIndex, pageCount - 1))
```

No force unwraps. No out-of-bounds jumps.

## Table Of Contents

TOC fallback chain:

1. Embedded PDF outline/bookmarks.
2. Bundled `manual-toc.json`.
3. Generic Pages list.
4. If page count is unavailable, show “Contents unavailable.”

Embedded outline traversal:

- Traverse `PDFDocument.outlineRoot` recursively.
- Flatten the tree into `ManualTOCEntry`.
- Keep a `level` integer for indentation.
- Do not build expand/collapse in v1; render nested entries as indented rows.
- Only include outline items with a valid destination page.
- If an outline item uses action-based navigation instead of destination, skip it safely.
- Never crash on unknown outline types.

TOC row:

- title
- optional page number
- indentation based on level
- tap jumps to page and closes/collapses panel

## Bundled TOC JSON

Use only if needed.

Example:

```json
{
  "instructor_manual": [
    { "title": "Course Overview", "page": 1 },
    { "title": "CPR/AED", "page": 8 }
  ]
}
```

Validation:

- missing manual key: ignore
- malformed JSON: ignore and log
- page less than 1: drop
- page greater than page count: drop
- empty result: fall back to Pages tab

## Search

Build a lightweight search index per manual.

Search index contains:

- page index
- page number
- extracted page text

Behavior:

- Start indexing after PDF loads.
- Show “Preparing search…” in the Search tab while indexing.
- Do not block the main UI.
- Use a separate `PDFDocument(url:)` for indexing so the visible `PDFView` is not disrupted.
- If PDFKit text extraction proves unstable off-main in testing, fall back to incremental one-page-at-a-time indexing on the main actor with yielding between pages.
- Cancel indexing when manual closes.

Search rules:

- case-insensitive
- diacritic-insensitive
- partial matches allowed
- debounce typing around 150 milliseconds
- empty search shows a friendly empty state
- no results shows `No results for “query”`

Results:

- show page number
- show snippet around first match
- if multiple matches on a page, show match count
- tap jumps to that page
- no highlight in v1 unless it is simple and stable

Image-only PDF behavior:

- If most pages have no extractable text, show “Searchable text is limited for this manual.”
- Do not treat this as an app error.

## Popout Panel UX

Use a sheet/drawer style panel.

Panel tabs:

- Contents
- Search
- Pages

Close behavior:

- close button
- swipe down
- tapping a TOC/search/page result jumps and dismisses the panel

iPhone:

- bottom sheet presentation

iPad:

- larger centered or side-style sheet
- avoid full-screen takeover unless necessary

Accessibility:

- toolbar buttons get labels:
  - “Open contents”
  - “Search manual”
  - “Previous page”
  - “Next page”
- rows expose page number and title
- support Dynamic Type in panel rows
- keep tap targets large

## Bottom Page Controls

Add a subtle bottom overlay:

- previous page button
- `Page X of Y`
- next page button

Disable previous on page 1.
Disable next on final page.

The user can also swipe left/right directly on the PDF.

## Last-Page Memory

Preserve existing behavior but make it more robust.

Rules:

- Write last page only after page change notification.
- Read saved page during view model init.
- Clamp saved page to current page count after document loads.
- Restore after PDFView is ready.
- Test force-quit and reopen.

## Error Handling

Keep current unavailable manual screen.

Add states:

- PDF file missing
- PDFDocument fails to open
- PDF has zero pages
- TOC unavailable
- Search unavailable
- Search indexing cancelled on close

None of these should crash.

## Testing Checklist

Before commit:

- Open each downloaded manual.
- Swipe left/right.
- Previous/next buttons work.
- Page count correct.
- Last page restores after closing manual.
- Last page restores after force-quit.
- Search works on text PDF.
- Search unavailable message appears gracefully if text extraction fails.
- TOC works from embedded outline if present.
- JSON fallback works if no outline.
- Pages fallback works always.
- Rotate iPhone during manual view.
- Test on iPad or iPad simulator if available.
- VoiceOver labels exist.
- Confirm no course playback, downloads, or casting files changed.

## Implementation Checkpoints

1. Create model/service scaffolding.
2. Refactor `ManualViewerView` around `ManualViewerViewModel`.
3. Switch PDFKit to horizontal single-page mode.
4. Add page count, page indicator, previous/next buttons.
5. Add robust last-page restore timing.
6. Add navigation panel shell.
7. Add embedded outline parsing.
8. Add optional JSON fallback.
9. Add Pages fallback.
10. Add async/cancellable search index.
11. Add search UI and result jumping.
12. Type-check.
13. Physical-device test.
14. Commit and push.
