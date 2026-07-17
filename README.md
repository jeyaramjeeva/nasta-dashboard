# Nasta Zentrum Tracker (web)

Interactive dashboard for your stall Excel. Edit in Excel → validate → publish (merge or replace) → partners open the same cloud URL.

## Weekly data workflow

1. Update `Nasta Zentrum Tracker.xlsx` as usual.
2. Open **Upload** (Data workflow).
3. Choose **Merge new only** (recommended) or **Replace all**.
4. Drop the file → **Validate** (checks unknown event IDs, unpaid rows, cash mismatch).
5. **Publish** with the shared password. A version is saved so you can **Restore** later.

### Merge vs replace

| Mode | What happens |
|------|----------------|
| **Merge new only** | Keeps existing history; adds only new transactions / events / cash rows |
| **Replace all** | Dashboard becomes exactly the Excel contents |

### Drive / OneDrive auto-pull

1. Share the `.xlsx` as **Anyone with the link**.
2. Paste the URL on the Upload page → **Save link**.
3. Click **Pull from link** → review validation → **Publish**.

Browser CORS often blocks Drive. Deploy the helper function:

```bash
supabase functions deploy pull-excel
```

Source: [`supabase/functions/pull-excel`](supabase/functions/pull-excel).

### Quick add (phone)

Use **Quick add** at the market to log grocery/expense without Excel. Still use weekly Excel as the master and **Merge** when you upload.

### Upload history

Every publish archives the previous snapshot. On **Upload → History**, click **Restore** (password required).

## Run locally

```bash
cd nasta-dashboard
npm install
npm run dev
```

Without Supabase, data + history stay in this browser (`localStorage`). Seed data loads from `public/seed-data.json`.

## Free cloud setup (once)

### 1) Supabase (free)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql) (includes `snapshot_versions`).
3. Copy **Project URL** and **anon public** key from **Settings → API**.
4. Optional: `supabase functions deploy pull-excel` for Drive pulls.

### 2) Env file

```bash
cp .env.example .env
```

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_UPLOAD_PASSWORD`

### 3) Deploy (free)

**Vercel:** `vercel` — set the same env vars.  
**Cloudflare Pages:** build `npm run build`, output `dist`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run preview` | Preview production |
