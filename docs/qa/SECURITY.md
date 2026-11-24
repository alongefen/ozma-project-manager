# Security and permissions report (P3.1)

24.11.2026. Branch `claude/gallant-herschel-cc13b1`. Fake data only (@example.invalid). No migration, service, cost or deployment. The cloud window was approved by Alon in this session's chat and used once.

## How to run

```bash
npm run build                                   # needed once for the bundle and HTTP checks
npx vitest run --project unit tests/security    # static: no cloud
npx vitest run --project cloud tests/security   # cloud: needs an approved window
```

## Results

| Suite | Tests | Result |
|---|---|---|
| `tests/security/static.test.ts` (unit; the 4 bundle tests need `npm run build`, they ran) | 17 | pass |
| `tests/security/data-api.cloud.test.ts` | 56 | pass |
| `tests/security/http.cloud.test.ts` (production build, port 3199) | 26 (20 pass, 6 `it.fails` = open findings) | pass |
| Re-run as evidence: `tests/db/permissions.test.ts`, `tests/depth/role-matrix.cloud.test.ts`, `tests/e2e/core/core-roles.cloud.test.ts` | 56 | pass |
| `npm test` (all unit) | 966 | pass |

## Coverage of the permissions matrix (PERMISSIONS §5–§6)

"DB" = `tests/db/permissions.test.ts` (direct Data API, real JWTs, every role). "Depth" = `tests/depth/role-matrix.cloud.test.ts` (role x function sweep over every function). "Core" = `tests/e2e/core/core-roles.cloud.test.ts`. "Sec-DA" = `tests/security/data-api.cloud.test.ts`. "Sec-HTTP" = `tests/security/http.cloud.test.ts`.

| Row | Covered by | Result |
|---|---|---|
| P01 sign-in, bad/disabled/revoked session | DB P01, Sec-DA (lifecycle, forged JWT), Sec-HTTP (forged/expired cookie) | pass |
| P02 project visibility, other project invisible | DB P02, Core, Sec-DA (cross-project reads on 10 tables x 4 roles) | pass |
| P03/P04 access and role changes | DB P03/P04, Core, Sec-DA (self-promotion, set_finance_access, owner deactivation) | pass |
| P05/P06 account creation, reset, deactivation | DB P05/P06, Sec-DA (deactivate, revoke, global sign-out on a live JWT) | pass |
| P07-P11 project create/edit/cover/status/archive | DB, Depth, Core | pass |
| P12-P16 documents: view, upload, access, change, replace | DB, Core, Sec-DA (authorize_file), Sec-HTTP (files route per role) | pass |
| P13 upload limits and types incl. Office/PDF | Sec-DA (types, sizes at both limits, 0/21 files, extra keys, cover/diary refuse Office), Sec-HTTP (route 400/413) | pass |
| P17-P19 tasks | DB, Core | pass |
| P20-P24 diary view/create/correct/move/cancel | DB, Core | pass |
| P25 report PDF | Sec-HTTP (outsider and wrong project refused before rendering, query shape, cross-site). Positive render not run here (see Not checked) | pass |
| P26-P29 finance | DB, Core, Sec-DA (table reads per role), Sec-HTTP (export per role and project) | pass |
| P30/P31 audit log and immutability | DB, Sec-DA (reads), X15 below | pass |
| X01-X03, X18 removal, re-add, demotion, several managers | DB, Core, Sec-DA (removal keeps other project) | pass |
| X04/X05 sign-out, deactivation, re-activation | DB, Sec-DA (old session stays dead after re-activation) | pass |
| X06-X09 finished/archived project | Core, DB | pass |
| X11 signed link 60 seconds | `tests/storage/storage.cloud.test.ts` (61 s wait, not re-run), Sec-DA (2 s link expires, tamper, other-object token) | pass |
| X12 upload token after removal | DB | pass |
| X13/X14 revision and retry | DB, Core | pass |
| X15 no writes outside functions | Sec-DA: INSERT, UPDATE, DELETE on all 17 tables for anon, service_role, outsider, worker, manager, finance manager, owner (code 42501) | pass |
| X16 catalog check | Depth (every function classified), `tests/db/contracts.test.ts` | pass |
| X17 login rate limit | not run (see Not checked) | open |

Other requested areas: direct storage access by every role and anonymous (list, download, public URL, sign, upload, overwrite, move, copy, remove) refused; upload token single use, own path only (Sec-DA); unauthenticated calls to all 5 API routes and 10 pages (Sec-HTTP); CSRF on POST routes and Server Actions, no CORS (Sec-HTTP); error bodies and logs hold no stack, key, project ref or cookie (Sec-HTTP); session cookies HttpOnly, SameSite=Lax, Secure (Sec-HTTP, via a real refresh by the proxy); secrets: tracked tree, all commits on all branches, client chunks, server chunks, source maps (static).

## Findings

| # | Severity | Finding | Fix / status |
|---|---|---|---|
| F1 | Medium | **Fixed** (SECURITY-FIXES). Pages carried no security headers. `next.config.ts` `headers()` now sends on every route: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`, `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. Verified on a production build with curl. Open follow-up: a full `script-src` CSP needs nonces and a visual pass (not done on purpose). Vercel HSTS at the edge is not verified. | Tests F-HDR-1..5 no longer `it.fails`. |
| F2 | Low | **Fixed** (SECURITY-FIXES). `poweredByHeader: false`; no `X-Powered-By` on the production build. | Test F-HDR-6 no longer `it.fails`. |
| F3 | Medium (dependency) | **Open, mitigated** (SECURITY-FIXES). `pdfjs-dist` 5.7.284, GHSA-hq66-cqwq-w95j (affected 5.6.83 to <6.2.108): the script runs only through the viewer's scripting (`enableScripting`). `pdfThumb.ts` does a canvas-only render, creates no annotation layer or scripting manager, and the API default is off; it now also passes `enableScripting: false` explicitly. So the advisory's path is not reachable in this code. `isEvalSupported` does not exist in 5.7, so it was not used. No 5.x release is patched; the only fix is 6.2.108+. | Proposal, separate dependency change: upgrade to 6.x (latest 6.5.438). Breaking changes not assessed yet (worker path, `getDocument`/`render` signatures); needs a build and a preview check. `npm audit` keeps listing it until then. |
| F4 | Info | A signed file link is a bearer: anyone holding it can fetch the file for 60 seconds, including after the owner revokes access (X11 states this). | Accepted by design. No change. |
| F5 | Info | `revoke_user_sessions` (the RPC) only sets `sessions_valid_after`; the refresh token still mints a JWT, which the database keeps refusing. The app's reset also signs the user out at Auth. | None. The test asserts the database refuses the refreshed token. |

Open dependency alerts (`npm audit`, 6): `pdfjs-dist` high (F3); `zod <4.6.6` high via `puppeteer-core` > `chromium-bidi` nested copy (memory exhaustion on oversized collections; the app's own `zod` 4.6.7 is not affected; reachable only inside the PDF renderer, not from user input); `puppeteer-core`, `chromium-bidi` high (same chain); `exceljs` and `uuid` moderate (uuid v3/v5/v6 bounds check with a caller-supplied buffer; exceljs does not use that path with user input). None is changed here.

## Not checked

- Login brute-force limit (X17): the probe in `tests/auth/rate-limits.cloud.test.ts` needs `P13_VERIFIED_FORWARDED_IP` and would throttle the production-bound project. Not run.
- The deployed Vercel site: nothing is deployed (D31). Headers were checked on `next start` locally; HSTS and edge behaviour are unchecked.
- A positive PDF render of the diary report (needs headless Chromium; covered by the logic tests, not re-run over HTTP).
- Sign-in, sign-out and password-reset Server Actions through a browser (action ids are opaque); cross-origin refusal was checked on a real action id only. The sign-in error text (does it reveal that an email exists) was not checked.
- The Supabase dashboard (Auth settings beyond `tests/auth/settings.cloud.test.ts`, SMTP, backups, network restrictions), and the TUS endpoint with hostile chunks.
- GitHub Dependabot alerts (no access); `npm audit` was used.
- Real devices and RTL layout (P3.2).

## Test data left in the cloud

About 30 deactivated @example.invalid accounts, about 8 archived projects, fake tasks, reports and transactions, and pending (never completed) upload rows. The storage objects this work created were removed. The final data purge removes the rest.
