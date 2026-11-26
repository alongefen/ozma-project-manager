# UPLOAD-GALLERY: client could not upload photos from the phone gallery

## Evidence limits
Vercel Hobby keeps runtime logs for 1 hour only, so the client's failure is not in the logs. Causes below are from code reading; none was reproduced on a real phone.

## Causes (ranked)
1. **Declared type vs bytes mismatch (suspected, strong).** The browser declares a type from the file name/picker (`.HEIC` -> `image/heic`); `begin_upload` stores it and `finishUpload` rejects unless the detected type from the bytes is identical (`system_finish_upload` also requires `mime = declared_mime`). iOS/Android pickers can hand over a JPEG with a HEIC name/type (or a file with no extension/type). Result: the upload "succeeds", then `complete` returns VALIDATION, shown as the meaningless "יש לבדוק את הפרטים שהוזנו". Works on desktop/localhost test files, where name and bytes agree.
2. **Misleading error on platform failures (confirmed in code).** `post()` turned any non-JSON response (504/413/5xx page) into "אין חיבור. נסו שוב", and the retry reran the same heavy step. Silent/wrong errors hid the real cause.
3. **Slow server step for large HEIC (suspected).** `complete` downloads the whole file and converts HEIC in JS (`heic-convert`); no explicit `maxDuration` on that route (the diary PDF route sets 300, so fluid compute is likely on and the default is not 10s, unverified). Display-render failures are caught (original kept) so they do not fail the upload.
4. **Unreadable pick (suspected).** Google Photos / iCloud cloud-only items can fail to read in the browser; tus then failed with a generic message.
Not causes (checked in code): `accept` list and 20-file limit are fine; tus chunk size 6MB matches Supabase; CORS is identical to localhost since both talk to the same Supabase origin.

## Fix (no migration, service or cost; D31 untouched)
- `rules.ts`: `sniffMime` + `declaredMime` – the declared type now follows the real bytes (first 32 bytes) for images/PDF; Office files and PDF covers unchanged. Server validation unchanged and still authoritative.
- `FileUpload.tsx`: reads the head before upload; unreadable files get a clear Hebrew message; non-JSON responses map to Hebrew by status; VALIDATION on complete gets a file-specific message; tus failures log status/size/mime to the console.
- `complete/route.ts`: `maxDuration = 60`; server logs (`[upload] ...`: code, duration, declared vs detected type, sizes; no names) for refusals, rejected content and render failures. `service.ts` logging only.

## Checked
- vitest `tests/shell/upload-rules.test.ts` (new sniff/declared tests) and `tests/screens/files`: pass. tsc and eslint clean.
## Not checked
- Real phone, real Vercel run, 360-1280 layout (no UI layout change, only message text). Cloud tests not run.

## Ask the client
Phone model and OS version, browser (Safari/Chrome), whether the picked photo came from the gallery or Google Photos/iCloud, and the exact Hebrew message shown under the file. After deploy: ask them to retry and send the message; the Vercel logs (`[upload]`) must be read within 1 hour of the attempt.
