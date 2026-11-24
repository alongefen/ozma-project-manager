# SECURITY-FIXES: P3.1 findings F1-F3

## Changed
- `next.config.ts`: `poweredByHeader: false` (F2) and `headers()` for all routes (F1): nosniff, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`, CSP baseline `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. No `script-src`/`default-src`: Next.js inlines hydration scripts and a safe one needs nonces and a visual pass.
- `src/features/files/shared/pdfThumb.ts` (F3): explicit `enableScripting: false` plus a comment. The advisory's path (viewer scripting) is not used by the canvas-only thumbnail; `isEvalSupported` does not exist in pdfjs 5.7; no patched 5.x exists (fix is 6.2.108+), so F3 stays open as a separate upgrade proposal.
- `tests/security/http.cloud.test.ts`: removed `it.fails` from F-HDR-1..6.
- `docs/qa/SECURITY.md`: findings table updated.
- No migration, service, cost, deployment or dependency change (D31).

## Checked
- Production build (`next build`) passes; `next start` locally: `/sign-in` and a 404 carry all four headers, no `X-Powered-By`.
- `tsc`, eslint clean; `npm test` unit: 989 passed, 5 skipped.
- No `<iframe>`/`<embed>`/`<object>` in `src`, so `frame-ancestors 'none'` and `object-src 'none'` break nothing; the report form camera is a `capture` file input (OS picker, `camera=(self)` kept anyway).

## Not checked
- Signed-in browser pass (report form camera, PDF thumbnails, print routes, signed links): no session available here.
- `tests/security/http.cloud.test.ts` against the production build: cloud suite, see Open.
- Deployed Vercel headers and HSTS.

## Open
- F3 upgrade to pdfjs-dist 6.x (separate dependency proposal).
- Full `script-src` CSP with nonces.
