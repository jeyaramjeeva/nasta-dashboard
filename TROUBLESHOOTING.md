# Troubleshooting

Quick checks when the stall tracker misbehaves.

## 1) Build / deploy failed (Vercel)

1. Open **Vercel → nastazentrum → Deployments → failed row → Build Logs**.
2. Search for `error TS` or `Error:`.
3. Reproduce locally:

```bash
cd nasta-dashboard
npm run build
```

4. Fix the file named in the log, redeploy:

```bash
npx vercel --prod --yes
npx vercel alias set <url> nastazentrum.vercel.app
```

**Note:** A red “Error Stale” row can be an old GitHub build. Prefer the latest **Ready** production deployment.

## 2) Guest order page (`/order`)

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| Wrong / empty menu | No Event menu selected on Orders, or wrong `?event=` | Orders → pick stall → Copy guest link |
| Prices show whole euros only | Old cache | Hard refresh; edit with EuroInput (decimals OK) |
| Edit modal closes at once | Fixed (backdrop race) — update deploy | Hard refresh preview `?preview=1` |
| Edits don’t save | Not signed in / Guest account | Team login, reopen preview |
| Claim code not found | Wrong stall selected, or sync lag | Select correct Event; wait 2s; Sync |

Codes expire after **30 minutes** if never claimed (`CLAIM_TTL_MS` in `stallOps` / API).

## 3) Orders POS (team `/orders`)

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| Deleted ticket comes back | Sync merge | Fixed via `deletedOrderIds` — delete once more after update |
| Back to pending jumps to Sold | Stale completed cloud copy | Fixed via `updatedAt` — hard refresh |
| Sold shows other events | View Totals vs Sold filter | Sold = one event; Totals = all |
| 62 paid but Customer 63 | Ticket **label** ≠ count | Sold stats show “missing from paid” |

## 4) Excel / Upload

1. **Upload → Validate** — read the error list.
2. Unknown event IDs → add event in Excel or use Merge carefully.
3. Cash mismatch → `src/lib/mismatch.ts` / Cash box sheet.
4. Publish password → `VITE_UPLOAD_PASSWORD`.
5. Cloud empty → Supabase SQL: run `supabase/schema.sql`.

## 5) Auth / roles

- Guest = stall-locked, no money pages (`guestAuth`, `stallMode`).
- Upload / finance = allowlists in `src/lib/authAllowlist.ts`.
- Developer Edit UI = pens on labels (`EditUiContext`).

## 6) Where logs live

| System | Where |
|--------|--------|
| Frontend | Browser DevTools → Console / Network |
| API | Vercel → Deployments → Functions / Logs |
| Database | Supabase → Table Editor / Logs |

## 7) Safe “reset this browser” (local only)

Does **not** wipe cloud:

1. DevTools → Application → Local Storage → clear site keys.
2. Reload. Cloud data reloads when signed in.
