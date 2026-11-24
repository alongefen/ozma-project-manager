# Data import

Scope for go-live: **projects only**, taken from the client's public website. No transactions, documents, reports or contacts. (The earlier P3.3 idea of importing transactions from Excel stays unbuilt; the Excel file remains a source for calculations only.)

## Source

`https://hy-ozma-ltd.com`, public listing pages `/private-projects/`, `/restorants/`, `/shops-offices/`. `scripts/import/extract-website-projects.mjs` reads them and writes `scripts/import/out/projects.local.json` (git-ignored): `category`, `place`, `title`, `status` (`completed` or `coming_soon`), `sourceUrl`. No finance, no contact data, no files. The site's cover images are not downloaded in this step.

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
