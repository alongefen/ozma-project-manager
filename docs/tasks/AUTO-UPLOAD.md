# AUTO-UPLOAD: upload starts when a file is picked

Alon, 23.11.2026: no separate upload button after choosing a file, anywhere.

## Changed
- `src/components/upload/FileUpload.tsx`: upload starts on selection (multiple files in one begin call). Per-file progress, error with retry/remove. Retry reuses the item key as `clientId`, so no duplicate. New `onBusyChange`; `onUploaded` always calls the latest callback. Removed the "העלאה" button and the "ready" state.
- `EntryForm` (diary): submit and label blocked while uploading ("מעלה קבצים…").
- `UploadForm` (documents): flow unchanged in order: category and access are chosen first (mandatory, no default, picker locked until valid); picking a file now uploads and saves it at once through the existing create-document call. Category, access and close are locked while a file is in flight.
- `CoverControl`: no code change; one image uploads on selection and is bound to the project as before.
- `docs/UI_CONVENTIONS.md`: new "Uploads" section.
- No server, migration or service change (D31).

## Checked
- Affected vitest suites (files, diary, projects, shell upload-rules, new `tests/screens/files/auto-upload.test.ts`): pass. `tsc` and eslint on touched dirs: clean.
- Server refusals (no access choice, finished project, forbidden role) are unchanged code paths and covered by the existing storage/db tests; not re-run (cloud, needs a window and Alon's yes).

## Not checked
- Real browser upload at 360-1280 (no signed-in session): not done.
- Cloud tests: not run.

## Open
- Closing the diary sheet after files uploaded but before saving leaves them as unattached uploads (unchanged behavior, server-side pending cleanup).
