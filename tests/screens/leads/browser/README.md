# Local leads UI fixture

Run `node tests/screens/leads/browser/server.mjs` and open `http://127.0.0.1:4180`.
The Vite configuration aliases the lead actions to in-memory fake rows in this test directory.
It uses the real feature, shared UI, styles and shells. No Next route, auth bypass, environment
flag or database access is added to the app. Stop the server when finished.

`window.leadsFixture` exposes the fake rows, recorded calls, `failNext` error code and response
`delay` (milliseconds). These controls exist only in the fixture bundle. This verifies local
interaction/layout; it does not verify RLS, RPCs, a production build or deployed Preview.

Run `node tests/screens/leads/browser/check.mjs` for the persisted local browser checks.
Set `LEADS_INTERACTIONS_ONLY=1` for interaction-only follow-up. The browser defaults to local
Google Chrome; `LEADS_BROWSER_PATH` may specify another installed browser executable.
Screenshots are written only to `/tmp` by the reviewer, never into the repository.
