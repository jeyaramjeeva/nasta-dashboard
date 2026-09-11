# `public/` — static files (copied to site root on build)

---

### `nasta-logo.png`
- **Why:** Brand logo (web + source for mobile icons).
- **If broken:** Missing logo on UI / mobile assets fail → restore file; re-run `scripts/prepare-mobile-assets.mjs` + `npm run cap:assets` (MOBILE.md).
- **Change:** Replace PNG; regenerate mobile assets.

### `favicon.svg` / `icons.svg`
- **Why:** Browser tab / generic SVG icons.
- **If broken:** Old favicon cached — hard refresh.
- **Change:** SVG artwork.

### `icons/` (PWA icons)
- **Why:** Installable web-app icons referenced by the manifest.
- **If broken:** Add-to-home icon wrong → regenerate icons; update `manifest.webmanifest` paths.
- **Change:** Icon set + manifest.

### `manifest.webmanifest`
- **Why:** PWA name, icons, display mode for “install app”.
- **If broken:** Install prompt/name wrong → edit name/icons/start_url; redeploy.
- **Change:** Branding fields.

### `seed-data.json`
- **Why:** Offline / first-load demo Excel-like snapshot when cloud empty.
- **If broken:** Dashboard shows stale demo → Upload publish real data; regenerate via `scripts/regen-seed.ts`.
- **Change:** Regenerate from master Excel; don’t hand-edit huge JSON unless needed.

### `_redirects`
- **Why:** Hosting redirects (e.g. Cloudflare Pages SPA fallback).
- **If broken:** Deep links 404 on some hosts → ensure SPA rewrite to `index.html`.
- **Change:** Host-specific rules; Vercel uses `vercel.json` too.

### `.well-known/assetlinks.json`
- **Why:** Android App Links verification for the native wrapper.
- **If broken:** App link open-in-browser instead of app → package name / SHA256 fingerprint must match Play signing cert.
- **Change:** Fingerprints after keystore change (MOBILE.md).
