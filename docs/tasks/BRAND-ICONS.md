# BRAND-ICONS

Alon (24.11.2026): favicon and phone home-screen icon = the business logo.

## Changes
- `public/icons/icon-192.png`, `icon-512.png`: logo on white, 86% width (regenerated from `public/brand/logo.webp`, 690px wide, so 512 downscales the logo, no upscale beyond ~1.0x of the 440px used).
- `public/icons/icon-maskable-512.png`: logo at 58% width inside the maskable safe zone, white background.
- `public/icons/apple-touch-icon.png` 180x180, opaque white.
- `src/app/favicon.ico` (16/32/48 PNG entries) and `public/icons/favicon-16.png`, `favicon-32.png`: crop of the blue roof and building only (the full wide logo with text is unreadable at 16-32px).
- `src/app/layout.tsx`: `metadata.icons` (icon + apple). Inherited by the sign-in and app layouts. The icons live under `/icons/`, already excluded in the proxy matcher, so they load without sign-in.
- Manifest unchanged (already Hebrew name, `#33abe3`, standalone, he/rtl, 192/512/maskable).
- `tests/brand/icons.test.ts`: files exist at the right sizes, ico header, manifest icons exist.

## Checked
- Unit test passes. `npm run build` OK; production `next start`: 200 + correct content type for `/favicon.ico`, the five PNGs and `/manifest.webmanifest`.
- `/sign-in` head has `rel=icon` (ico, 32, 16), `apple-touch-icon` and `rel=manifest`.
- Looked at the 512 and maskable PNGs and the 32px favicon enlarged.

## Not checked
- Real phone home-screen result (iOS/Android). Check: iPhone Safari, Share, Add to Home Screen; Android Chrome, Add to Home screen. Remove an old shortcut first; phones cache the icon.
- Desktop browser tab rendering in real browsers (browsers also cache favicons; hard refresh).
- A vector/higher-resolution logo would give a crisper 512 icon; not required.
