# DOCS-ROWS: document rows with a ⋯ menu; bigger project cards

## What changed
- Documents list is now table rows (phone and desktop): preview tile, name (the whole row opens the file), category, type and size, uploader and date, access summary (owner, desktop), and one "⋯" button. The menu (native popover; bottom sheet on the phone) holds: פתיחה, הורדה, and for the owner גישה and לארכיון / החזרה. Behaviour of the actions, access rules and archive confirm are unchanged (same `FilesProvider` handlers). Desktop has a column header row; phone has two-line meta.
- Project cards (overview): bigger, cover image as a banner (150px phone, 200px desktop) above the name and badges, name 18/20px. Desktop two cards per row (was three), phone one per row. The whole card still opens the project and the tasks badge still opens the tasks.

## Checked
- tsc, eslint, `vitest --project unit tests/screens tests/shell`: pass (render tests now check the row link and the menu items per role through `DocActions`).
- Real browser (temporary harness): documents rows at 1280 (header, columns, menu open) and 390 (rows, no horizontal scroll).

## Not checked
- Project cards in a browser (no signed-in session, needs data): CSS-only change, reasoned, not viewed. A real image thumbnail. 1024/768/360, keyboard walk through the menu (menu uses plain links and buttons, no menu role; the close-then-reopen race is guarded).
