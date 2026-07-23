# Nasta Zentrum — Capacitor (Android & iOS)

Native shells for the team tracker. Default mode loads the live site
`https://nastazentrum.vercel.app` so `/api`, auth, and Vercel deploys stay in sync.

**App ID:** `de.nastazentrum.tracker`  
**Name:** Nasta Zentrum

## Quick start (Android on this PC)

```powershell
cd H:\Jeeva\nasta-dashboard

# 1) Brand icons + splash (already generated once; re-run after logo change)
npm run cap:assets

# 2) Build web + sync into android/ios
npm run cap:sync

# 3) Open Android Studio
npm run cap:android
```

In Android Studio:

1. First launch: finish the SDK setup wizard (API 34+, build-tools, emulator).
2. Wait for Gradle sync.
3. Pick a device / emulator → **Run**.
4. Release: **Build → Generate Signed Bundle / APK** (or use keystore below).

## Icons & splash

```powershell
npm run cap:assets
```

Uses `public/nasta-logo.png` → `assets/` → Android / iOS / PWA icons.

## Release keystore (Android Play Store)

```powershell
npm run cap:keystore
```

Creates (gitignored):

- `android/nasta-release.keystore`
- `android/keystore.properties`

Back these up offline. Never commit them.

After creating the keystore, print the SHA-256 fingerprint and paste it into
`public/.well-known/assetlinks.json` for App Links:

```powershell
keytool -list -v -keystore android\nasta-release.keystore
```

Then redeploy the website so `https://nastazentrum.vercel.app/.well-known/assetlinks.json` updates.

## iOS (Mac only)

```bash
npm run cap:sync
npm run cap:ios
```

Xcode → signing team → **Product → Archive** → App Store Connect.

## Security

| Layer | Setting |
| --- | --- |
| Transport | HTTPS only, cleartext blocked |
| WebView | Navigation limited to Nasta + Supabase |
| Android backup | Disabled |
| Signing | Release keystore (your secret) |
| Auth | Same allowlist / passwords as web |

No app is unhackable — keep strong passwords and private keystores.

## Useful scripts

| Script | What it does |
| --- | --- |
| `npm run cap:assets` | Regenerate icons/splash |
| `npm run cap:sync` | Vite build + `cap sync` |
| `npm run cap:android` | Sync + open Android Studio |
| `npm run cap:ios` | Sync + open Xcode |
| `npm run cap:keystore` | Create Play signing keystore |

## Bundled mode (optional)

Ship `dist/` inside the app instead of the live URL (APIs still need network):

```powershell
$env:CAP_BUNDLE="1"
npm run build
npx cap sync
```
