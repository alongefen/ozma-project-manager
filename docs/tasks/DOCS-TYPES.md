# DOCS-TYPES: more document types, PDF first-page preview, multi-pick hint

Approved by Alon on 24.11.2026 (D31): the migration and the new dependency below. Both cost nothing.

## What changed
- **More types, project documents only:** Word (doc, docx), Excel (xls, xlsx), PowerPoint (ppt, pptx). Diary attachments and covers stay PDF/images. Macro-enabled formats (docm, xlsm...) are not accepted.
  - Migration `20261124095924_more_document_types.sql` (applied to `izjmvyguzbampoasvnru` via the Supabase tool, version recorded as the file name): `create or replace` of `begin_upload` and `system_finish_upload` with the wider mime list and "Office only when purpose = document". Grants verified unchanged. Rollback: re-run the two earlier definitions named in the file header; Office rows already stored would then fail to complete, nothing else depends on them.
  - Server (`src/lib/storage/content.ts`, `service.ts`): content is verified, not trusted from the name. OOXML = real ZIP central directory with `[Content_Types].xml` and `word/`, `xl/` or `ppt/` parts, refused if it carries `vbaProject.bin`; binary doc/xls/ppt = OLE signature plus a declared Office type. Office files are never sent to the image converter (display state `none`).
  - Client (`rules.ts`, `FileUpload.tsx`, contracts `schemas.ts`): the picker lists Office types only for documents; `checkFile` refuses them for diary and cover.
- **PDF first page:** `pdfjs-dist@5.7.284` (new dependency, loaded only when a PDF row scrolls into view). Page 1 is drawn in the browser through the same permission-checked route as "open", two at a time, cached. PDFs over 12MB keep the tile so a phone never downloads a huge file for a thumbnail. If anything fails the tile shows.
- **Tiles:** Word blue, Excel green, PowerPoint orange, PDF red, with the extension. Kind labels Word / Excel / PowerPoint.
- **Many files at once:** this already worked (pick up to 20 together, each uploads on its own). The button now says so ("אפשר לבחור כמה") and a hint lists the types and the 50MB limit.

## Checked
- tsc, eslint, `vitest --project unit` (whole unit project): pass. New: `tests/logic/storage/office.test.ts` (in the unit project; `tests/storage` is the cloud project) (ZIP parsing, docx/xlsx detection by parts, macro refusal, OLE rules, client rules per purpose) and screen tests (tiles per kind, PDF size cutoff).
- DB: after applying, both functions contain the Office list and keep their grants (checked with SQL, no data touched).
- Browser: `pdfThumb` on a 3-page test PDF under `next dev`: worker loads, page 1 rendered (160x227, content present).

## Review
- One reviewer pass. Fixed: Office test moved into the unit project; binary Office files with a VBA project refused; failed previews are remembered; fewer buffer copies. Accepted limits: OOXML embeddings/ActiveX/external links are not scanned (only `vbaProject.bin`); the OLE check is a name scan, not a full directory parse; pdf.js 5.7 has the eval-font fix and no `isEvalSupported` option.

## Not checked
- A real upload of a Word/Excel/PowerPoint file end to end (needs a signed-in session on the cloud database; cloud tests need a window and Alon's yes). Check with one real .docx and one .xlsx.
- A real PDF from storage: whether the storage server answers byte-range requests across the redirect (if not, pdf.js downloads the whole file, up to 12MB) and whether CORS allows the thumbnail fetch. On failure the tile shows, so nothing breaks.
- `next build` output with the pdf.js worker; 1024/768/360 layouts.
