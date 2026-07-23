# `supabase/` — database SQL + Edge Functions

Run SQL in Supabase → **SQL Editor**. Deploy functions with Supabase CLI.

---

### `schema.sql`
- **Why:** Main tables — snapshots, snapshot_versions, team_extras, user_prefs, plate_counts, RLS baseline.
- **When:** Once on a new project (or when adding missing tables).
- **If broken:** Upload empty / stall ops not syncing → check tables exist + RLS allows your role; compare with this file.
- **Change:** Add columns carefully; update client (`cloudExtras`, `supabase.ts`) in the same change.

### `customer_reviews.sql`
- **Why:** Guest reviews table (+ often used for append-only config/menu override rows when `team_extras` writes are RLS-blocked).
- **When:** Reviews fail, or public menu patches / site config cloud sync fail.
- **If broken:** Reviews page “needs table setup”; API 401/RLS errors in Vercel logs.
- **Change:** Policies for anon insert + team read; keep special ids (`__site_config__`, `__rform_*`, `__pmenu_ov_*`) readable as designed.

### `fix_publish_rls.sql`
- **Why:** Fix/tighten publish RLS so Excel publish isn’t blocked (or incorrectly open).
- **When:** Upload validate OK but Publish fails with permission errors.
- **If broken:** Still failing → prefer `/api/publish-snapshot` + `SUPABASE_SERVICE_ROLE_KEY` on Vercel.
- **Change:** Policies only with care; test as each team role.

### `functions/pull-excel/index.ts`
- **Why:** Edge Function fetches Drive/OneDrive Excel server-side (avoids browser CORS).
- **Deploy:** `supabase functions deploy pull-excel`
- **If broken:** Upload “Pull from link” fails in browser → deploy function; link must be public; check function logs.
- **Change:** Supported URL hosts / fetch headers when Drive share formats change.

## Mental model

| Storage | Used for |
|---------|----------|
| `snapshots` / `snapshot_versions` | Excel publish + history |
| `team_extras.stall_ops` | Orders, menu, stock, chat, todos… |
| `customer_reviews` | Reviews + some config/menu overrides |
| `user_prefs` | Theme etc. |
| `plate_counts` | Plates page cloud |

**If cloud data looks wrong:** Table Editor → `team_extras` `id=latest` → inspect JSON size (huge base64 photos) → Sync on device → compare localStorage.
