# UPLOAD-DNG: convert DNG input into a smaller supported image

## Decision and scope — 26.11.2026
Alon clarified that DNG is an input for conversion, not a format to upload/store. Only the converted supported image enters storage. This supersedes the previous DNG-original-retention proposal; other formats retain their existing behavior. Discovery owns this file only. Implementation paths below are proposed, not allocated. No implementation, release or cloud mutation is approved by this note.

## Reproduced boundaries
Base: refreshed `origin/main` at `189d65d`; isolated branch `codex/upload-dng-discovery`, worktree `/private/tmp/ozma-upload-dng-discovery`. Main/leads checkout untouched. Carried only this task from the PM preparation branch; incorporated its clarified scope.

- Authorized private sample: 64,804,552 bytes (61.80 MiB). It was read locally, never uploaded, copied into the repository or committed. Original SHA-256 equality before/after the initial decoder experiments was verified without printing the digest. No private path, photo, EXIF values or contact information is recorded here.
- Executed actual `rules.ts` exports through the installed TypeScript transpiler: `.DNG` with empty, generic, `image/dng`, `image/x-adobe-dng` or `image/tiff` MIME is rejected even at 1 KiB. Current client sniffing and server detection both return null for the sample. No browser UI reproduction of the application is claimed.
- Independently exercised size checks with a synthetic supported JPEG descriptor of the same size: diary/cover reject above 26,214,400 bytes; documents reject above 52,428,800 bytes. Current type rejection precedes size rejection. These remain OUTPUT upload limits, not the proposed local DNG input limit.
- Source inspection: picker accept/type rules, UploadRequest/FileRef MIME enums, server detection and current SQL allowlists exclude DNG. These are correct to remain unchanged for stored MIME under the clarified scope. The picker and local preparation path need a separate DNG-input concept.

## Decoder comparison: embedded JPEG versus RAW
Installed sharp 0.35.5 / libvips 8.18.7 on macOS, Node 25.2.1 (not the project's target Node 24). No dependency installed.

- Bounded read-only TIFF IFD inspection found a full-resolution embedded JPEG and a separate RAW SubIFD. Only format/layout fields were inspected; camera identity and private EXIF were not requested or printed.
- Existing `validateContent(sample, 'image/dng')` returned true through its generic Sharp branch, and `renderDisplay` produced a 148,485-byte JPEG at 1200×1600 in about 150 ms. This is NOT supported upload: detection/contracts reject it first.
- Important negative control: zeroing the RAW payload in a separate in-memory copy still passed the generic Sharp validation and produced an identical display. Pointing the TIFF header at the RAW IFD instead failed with `samples_per_pixel not a whole number of bytes`. Thus the installed decoder only demonstrated the embedded rendered image, not RAW integrity/development.
- The initial full-buffer/multiple-copy Node experiment peaked near 784 MiB RSS. It is not a phone implementation or an appropriate phone resource budget.
- Under the clarified scope, full RAW decoding/integrity is unnecessary for preview extraction: accept only a bounded, structurally recognized DNG with an independently decodable useful JPEG preview. The stored result must be a fully decoded/re-encoded JPEG; do not claim the unretained RAW was validated or recovered. A valid preview with unusable RAW must never be advertised as RAW recovery.

## Browser conversion evidence
Used the installed Node Playwright because Python Playwright is absent. Chrome 158.0.8127.37 on desktop macOS, fresh headless profile, browser context offline and all network routes aborted. No running application/server/cloud endpoint was used. Private media remained File/Blob/in-memory data; no screenshot or image output was saved.

The local experiment read the TIFF header/first IFD with `File.slice` (398 parser bytes), then sliced a 6,963,244-byte embedded JPEG without reading the full 64.8 MB source into JS. This was a narrow feasibility probe, not a production parser: it does not yet implement all DNG recognition, bounds and variant cases below.

| Output | Measured bytes | Dimensions after orientation | Local conversion time |
|---|---:|---|---|
| JPEG, quality 0.8, long edge 1600 | 145,956 | 1200×1600 | 172 ms in Worker; 182 ms on page in final run |
| JPEG, quality 0.8, long edge 2400 | 278,478 | 1800×2400 | 211 ms on page in final run |

- `createImageBitmap` plus `OffscreenCanvas.convertToBlob` worked in a Worker for the sample. Final run including probes: 567 ms. These are desktop observations, not an SLA, phone benchmark or broad compatibility result.
- Orientation pitfall reproduced: using unrotated resize dimensions with the browser's default EXIF orientation produced a landscape result. Supplying oriented target dimensions produced portrait output. Production must reconcile embedded-JPEG and outer-TIFF orientation and apply it exactly once, including mirrored orientations; those variants remain untested.
- Actual browser 1600 output was returned in memory to Sharp and fully decoded successfully as JPEG, 1200×1600. It had no EXIF; it contained an ICC profile. Never claim that browser canvas removes every metadata/profile field. ICC retention is not evidence of color fidelity. Existing server processing still applies to this JPEG.
- Savings versus DNG: about 99.77% for 1600, 99.57% for 2400. Recommend 1600/0.8 initially because the existing server display and PDF pipeline already cap images at 1600; 2400 would preserve more detail only in the stored converted original, while reports still use a 1600 display.
- One private sample/one embedded-preview layout tested. Camera model was deliberately not inspected. No iPhone/Safari/Android physical device tested; Playwright WebKit is not installed. No general DNG support is claimed.
- Dimensions/encoding/orientation were checked mechanically. Photograph identity, visual color fidelity, fine text/readability and actual PDF/cover appearance were NOT visually accepted. Those remain implementation acceptance gates.

## Proposed bounded local path
No new package is needed for the demonstrated embedded-JPEG path. Do not add a RAW decoder or a server fallback to this first slice.

1. Offer `.dng` as an INPUT only, including uppercase and empty/generic MIME. Recognize classic little/big-endian TIFF and the DNGVersion tag using a bounded parser; extension/MIME alone never suffice. Reject unsupported BigTIFF, malformed/out-of-range/overflowing offsets, cycles and unsupported layouts with a useful Hebrew message. Distinguish these from invalid JPEG output.
2. Proposed starting local resource limits, requiring implementation verification: source <=100 MiB; <=32 IFDs, <=512 entries/IFD, depth <=6, <=1 MiB total directory/metadata reads; single contiguous complete JPEG preview <=16 MiB and <=50 million pixels, with a useful minimum long edge (1600 proposed). Reject unsupported tiled/multi-strip/non-JPEG preview variants. Check actual JPEG dimensions before decode, not only TIFF declarations. These are local-conversion limits, not increased upload limits.
3. Pick a useful preview, prefer adequate resolution without decoding several candidates. Parse only required tags; do not copy private EXIF into the new file. Handle JPEG orientation/profile and TIFF orientation deliberately; re-encode supported sRGB output, test color and avoid double rotation.
4. One conversion at a time in a dedicated Worker; queue multiple selections, show Hebrew preparation progress, support cancellation by terminating the Worker, release ImageBitmaps/object URLs and discard intermediate buffers. A 10-second conversion timeout is proposed, with a clear retry/export-to-JPEG message. No DNG network request before successful conversion.
5. Important phone risk: the sample's full decoded RGBA alone can occupy about 186 MiB, before decoder/canvas overhead. `resizeWidth` does not guarantee a bound on native decoder allocations; Worker timeout is not a hard memory cap. Source slicing avoids a 64.8 MB JS copy but does not prove low decoder memory. Require physical low-memory iPhone and Android tests before release; tune/restrict pixel bounds or fail visibly if needed. Do not silently fall back to an unbounded main-thread decode.
6. Create a new `.jpg` File with actual JPEG bytes/MIME, then run existing `checkFile`, begin/TUS/finish flow. Keep 25 MiB diary/cover and 50 MiB document output limits. Use the prepared JPEG's name/size/MIME consistently for retries; never retry RAW or relabel its bytes. DNG source may exceed output limits and still be prepared. Other formats follow their existing path.
7. If no supported useful preview exists, say that this RAW variant cannot be converted and ask the user to export JPEG on the device. A full RAW WASM/library or temporary server conversion is separate future work with package/license/resource/cost review; no external service or temporary RAW cloud ingestion is authorized.

## Exact proposed implementation ownership
PM must allocate serially before edits. LEADS-DATA currently owns standalone `src/types/contracts/leads.ts`, leads logic/tests and its own additive migration/rollback; this proposal avoids those and global contracts/migrations altogether.

| Proposed paths | Purpose |
|---|---|
| `src/components/upload/FileUpload.tsx` | Snapshot FileList before clearing as existing fix does; preparation state/queue/cancel, send only prepared File; preserve existing callback/busy/retry semantics. |
| `src/components/upload/rules.ts` | Separate picker INPUT acceptance from stored-format/output validation; DNG source bounds/error text without adding it to stored MIME acceptance. |
| New `src/components/upload/dng/{prepare.ts,parser.ts,worker.ts}` | Bounded File.slice parsing/preview selection, Worker conversion/orientation and typed preparation errors. No server imports; confirm Next Worker bundling. |
| `tests/shell/upload-rules.test.ts`, new `tests/shell/dng/**`, new `tests/screens/files/dng-conversion.spec.ts` and synthetic fixtures | Input/output distinction, parser attacks, conversion/cancellation/retry and supported consumer flow using fake media. Follow the existing isolated upload-selection browser harness; no shared Playwright configuration edit is proposed. |
| `docs/tasks/UPLOAD-DNG.md` | Implementation notes and evidence. PM owns shared WORK_PLAN/NEXT_SESSION updates. |

Read-only regression surfaces: `src/lib/storage/{content.ts,service.ts}`, `src/types/contracts/schemas.ts`, report `adapter.ts`, diary/files preview models and project cover views. Existing JPEG already belongs to the PDF allowlist; no DNG addition there is needed. Current server size/type/full-JPEG validation and private original/display flow remain authoritative. For this path “original” in storage means the converted JPEG, not the local DNG.

No changes proposed to UploadRequest/FileRef enums, database types, SQL functions, bucket MIME settings, bucket size limits, grants or RLS. No migration or bucket mutation is needed for this JPEG-only route. Live bucket/functions were NOT inspected; no hosted security verification is claimed. The earlier contemplated cloud MIME expansion is withdrawn.

## Implementation tests and release gate
- Legal synthetic TIFF/DNG containers carrying generated JPEGs: little/big endian, uppercase/empty/generic MIME, DNGVersion absence/spoof, cyclic/deep IFDs, overflow/OOB offsets, excessive counts, truncated JPEG, deceptive dimensions, unsupported preview compression, tiny/no preview and source >100 MiB. No customer sample in tests/repository.
- 64.8 MB source descriptor/file above upload limits with valid small output; every output size/type failure visible, no begin call before conversion; no network RAW bytes; prepared JPEG reused on retry, cancellation before/during decode, sequential multi-select, form busy state and component unmount cleanup.
- Synthetic asymmetric corner images for all eight orientations, nested/outer orientation conflicts; color fixtures and readable fake report text. Browser output fully passes existing server detection/validation. Existing JPEG/PNG/WebP/HEIC/Office handling and FileList regression stay intact.
- New JPEG follows document, diary and cover paths; original download is JPEG; previews and generated report PDF include it using current JPEG allowlist. Physical phone memory/time/cancellation and visual report/cover/readability acceptance remain required. Check UI at required RTL sizes when implementation changes layout.
- Existing storage service/retry/route unit tests cover mocked boundaries, not live permission refusal. After separately approved deployment/testing, coordinate any hosted synthetic-data verification window and ensure forbidden actions still fail. Do not run broad existing cloud fixtures, which create projects/users and mutate access, under this discovery authorization.

## D31 and completion
Discovery complete; implementation and phone/visual acceptance remain open. No code changes, dependency installation, cloud query/write, migration, service, deployment, PR or merge performed. Only local bounded experiments and this documentation changed; no repository code test suite rerun for a documentation-only change. No reviewer subagent needed under A-36.

For the proposed local-only conversion: no database migration/new service/cost is proposed. Later release needs a concrete D31 approval naming the reviewed commit/Preview or production deployment, existing hosting usage (not assumed zero charge), and rollback to the prior deployment/disable DNG preparation. Existing converted JPEGs remain readable after rollback. If phone tests force a new dependency, paid service or server RAW transfer, stop and prepare a separate exact what/why/cost/data-path/rollback request before using it.

References consulted: [Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/), [Adobe DNG overview](https://helpx.adobe.com/camera-raw/desktop/dng-and-file-formats/digital-negative.html), [createImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap), [OffscreenCanvas export](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob). Browser API documentation supports the available mechanisms; only the local experiments above establish compatibility with this sample.
