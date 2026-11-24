# Data import

Scope for go-live: **projects only**, taken from the client's public website. No transactions, documents, reports or contacts. (The earlier P3.3 idea of importing transactions from Excel stays unbuilt; the Excel file remains a source for calculations only.)

## Source

`https://hy-ozma-ltd.com`, public listing pages `/private-projects/`, `/restorants/`, `/shops-offices/`. `scripts/import/extract-website-projects.mjs` reads them and writes `scripts/import/out/projects.local.json` (git-ignored): `category`, `place`, `title`, `status` (`completed` or `coming_soon`), `sourceUrl`. No finance, no contact data, no files. `imageUrl` is the banner shown on the listing card.

## Mapping to `create_project`

| Field | Value |
|---|---|
| `name` | title, plus ` - place` when the place is not already in the title |
| `businessName` | title (the website does not name the client) |
| `siteAddress` | the place shown on the site (city or site name, not a street address) |
| `contact` | placeholder "יש להשלים" for name and phone; email and role empty |
| dates, access notes | empty |
| status | `completed` -> set to completed after creation; `coming_soon` stays active |

Request id: stable uuid derived from the source URL (or category and name when there is none). A retry reuses the same project.

## Checks done by the script

Duplicate source rows fail the run. Titles that contain "משפחת" (a family name) are flagged in the dry run so Alon can confirm they may be shown to the client.

## Owner approval

The list is shown to Alon before any load. Edit the local JSON to remove or rename rows; the committed sample is `scripts/import/sample/projects.sample.json` (fake).

## Covers

`scripts/import/load-covers.mjs` downloads each project's public banner from the website (38 distinct images, about 5 MB; two projects share one) and sets it as the project cover through the app's own path: `begin_upload`, signed upload, display copy, `system_finish_upload`, `set_project_cover`, as the owner. Projects that already have a cover are skipped. Dry run by default; a real run needs `--confirm`, the project ref and the owner password in `GO_LIVE_OWNER_PASSWORD`. Run on 24.11.2026 after Alon's request: 39 covers, 39 originals and 39 display copies verified in the database.
A run that fails between the upload and `set_project_cover` leaves an unattached file row and its storage objects for that project; a retry creates a fresh upload, so it is safe, but the orphan stays until the next purge. Only images from `hy-ozma-ltd.com` are fetched (30 s timeout, 25 MB cap).
