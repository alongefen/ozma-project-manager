# DOCS-PREVIEW: document thumbnails and filter-row width

## What changed
- `DocThumb` (src/features/files/shared): a fixed 72x72 preview at the start of every document card, phone and desktop, so nothing shifts while loading.
  - **Images** (JPEG/PNG/WebP/HEIC with a ready display image): the display image from `/api/storage/files/<id>?variant=display`, the same permission-checked route as "open" (same rule as the diary), `loading="lazy"`, shimmer until loaded, fades in. If it fails, the file-type tile is shown.
  - **PDF**: a red tile with a file icon and "PDF". **Everything else** (e.g. an image whose display copy failed): a grey tile with the extension (e.g. HEIC). A real first-page PDF view would need a PDF library or service (dependency/cost), so it is not done.
  - Access unchanged: the list only has files the viewer may see, and the route re-checks access per request. No preview is requested for archived rows unless the owner opens the archive view.
- Filter row: search is capped (360px), category 180px, and the "לארכיון" button sits at the physical left end of the same row (`margin-inline-start: auto` in RTL), so the row no longer stretches across the whole width.

## Checked
- tsc, eslint (src/features/files, tests/screens), `vitest --project unit tests/screens tests/shell`: 178 passed (new: thumbUrl/extension model tests; render test for tiles and lazy image).
- Real browser, temporary harness with the real components and app CSS (not committed): 1280 (row capped, archive at the left end, tiles), 390 (one row, no horizontal scroll, tiles next to the text).

## Review
- One reviewer pass. Fixed: an image that loads before hydration no longer stays hidden (ref check on mount). Left: shimmer radius vs tile radius (cosmetic).

## Not checked
- A real image thumbnail: the harness has no storage, so only the fallback tile and layout were seen; the image path (route redirect to a signed URL inside an `<img>`) is the same one the diary previews use but was not run here.
- 1024/768/360 not opened separately; no signed-in session.
