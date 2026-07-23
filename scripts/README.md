# `scripts/` — one-off tools (not the live website)

Run from repo root unless noted. Prefer reviewing `git diff` after writers that touch `i18n.ts`.

---

### `gen-i18n.mjs`
- **Why:** Generate / dump English (and related) i18n key material for bulk translation work.
- **Run:** `node scripts/gen-i18n.mjs`
- **If broken:** Path/encoding errors; may write large output — check console.
- **Change:** Key lists inside the script when UI strings change.

### `write-i18n.mjs`
- **Why:** Write locale strings into the i18n pipeline (can overwrite translation data).
- **Run:** `node scripts/write-i18n.mjs`
- **If broken:** Overwrote `src/lib/i18n` unexpectedly → restore from git; review diff before commit.
- **Change:** Locale objects in the script.

### `fix-ka-i18n.mjs`
- **Why:** Replace broken Kannada (`ka`) block in `src/lib/i18n.ts` using ASCII code-point builders.
- **Run:** `node scripts/fix-ka-i18n.mjs`
- **If broken:** Path to `i18n.ts`; backup/diff before run.
- **Change:** `ka` object entries.

### `add-events-i18n.mjs`
- **Why:** Patch Events + chrome keys for en/de/ta/ka into `i18n.ts`.
- **Run:** `node scripts/add-events-i18n.mjs`
- **If broken:** Duplicate keys; file path; review diff.
- **Change:** `extras` map in the script.

### `prepare-mobile-assets.mjs`
- **Why:** Build Capacitor icon/splash sources from `public/nasta-logo.png`.
- **Run:** `node scripts/prepare-mobile-assets.mjs` (needs `sharp`); then `npm run cap:assets` (see MOBILE.md).
- **If broken:** Missing logo; `sharp` not installed; output under `assets/`.
- **Change:** Brand colors / sizes in script.

### `create-android-keystore.mjs`
- **Why:** Create Play Store release keystore (run once; keep offline).
- **Run:** `node scripts/create-android-keystore.mjs`
- **If broken:** `keytool` missing (JDK); never commit `.keystore` / passwords.
- **Change:** Output paths under `android/`.

### `ensure-guest-user.mjs`
- **Why:** Ensure Guest Supabase auth user can sign in (create if missing).
- **Run:** `node scripts/ensure-guest-user.mjs`
- **If broken:** Project URL/anon key inside file outdated; Guest password mismatch with app; Auth settings.
- **Change:** Update URL/key/password carefully; do not paste service role into git.

### `finish-supabase-setup.ps1`
- **Why:** Windows helper to wire Supabase URL/anon + allowed emails into local/Vercel env after project create.
- **Run:** PowerShell — see header comments in the file for `-Url`, `-AnonKey`, `-AllowedEmails`.
- **If broken:** Wrong project URL shape; Vercel CLI not logged in; env not applied.
- **Change:** Parameter defaults / env names.

### `regen-seed.ts`
- **Why:** Rebuild `public/seed-data.json` from local Excel path for offline/demo first load.
- **Run:** Via project TS runner (e.g. `npx tsx scripts/regen-seed.ts`) after Excel path in file is correct.
- **If broken:** Excel path missing; `parseWorkbook` errors; huge seed file.
- **Change:** Input `xlsxPath` / output path.

### `test-merge-orders.mjs`
- **Why:** Smoke test — deleted/voided/event-scoped merge must not resurrect tickets.
- **Run:** `node scripts/test-merge-orders.mjs`
- **If broken:** Assertion → fix `stallOps` merge; keep script mirror in sync with TS rules.
- **Change:** Add cases when merge rules change.

### `test-pending-resync.mjs`
- **Why:** Reproduce Pending bug — delete locally must not come back after cloud refresh; other-event tickets stay filterable.
- **Run:** `node scripts/test-pending-resync.mjs`
- **If broken:** Assertion → `deletedOrderIds` / merge in `stallOps`.
- **Change:** Cases for new sync bugs.

### `test-reopen-merge.mjs`
- **Why:** “Back to pending” must beat a stale completed cloud copy (`updatedAt` wins).
- **Run:** `node scripts/test-reopen-merge.mjs`
- **If broken:** Assertion → `preferOrder` / revision timestamps in `stallOps`.
- **Change:** Cases when reopen rules change.

## Safety
- Never commit keystores, `.env`, or service role keys.
- i18n writers: always `git diff` before commit.
