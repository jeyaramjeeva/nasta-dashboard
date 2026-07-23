# Project map — Nasta Zentrum Tracker

Use this page to find **where something lives** and **what breaks when**.

Live site: https://nastazentrum.vercel.app  
Repo root: `nasta-dashboard/`

More folder guides: see [docs/README.md](README.md) (links every `README.md` in the repo).

## Big picture

```
Browser (React app in src/)
    │
    ├─ Team app routes  → /orders, /cash, /upload, …
    ├─ Public guest     → /order  (customer menu + claim code)
    └─ Public reviews   → /review
    │
    ▼
Vercel serverless API (api/*.ts)     ← needs env vars on Vercel
    │
    ▼
Supabase (auth + Postgres tables)    ← schema in supabase/
```

| Layer | Folder | Role |
|-------|--------|------|
| UI pages | `src/pages/` | Screens you click |
| Shared UI | `src/components/` | Buttons, layout, FABs |
| App state | `src/context/` | Auth, Excel data, stall orders |
| Helpers | `src/lib/` | Parse Excel, merge, money, i18n |
| Server | `api/` | Guest order, reviews, AI, publish |
| DB | `supabase/` | SQL schema + Edge Functions |
| One-off tools | `scripts/` | i18n, tests, mobile assets |
| Static | `public/` | Logo, PWA icons, seed JSON |

## Where to look when something fails

| Symptom | Check first | Then |
|---------|-------------|------|
| Site won’t build / Vercel red | Vercel → Deployments → Build Logs | `npm run build` locally; TypeScript errors |
| Guest `/order` empty or wrong menu | Orders → Event menu selected? | `api/customer-order.ts`, cloud `team_extras.stall_ops` |
| Claim code “not found / expired” | Correct Event menu on Orders? | Sync (top Sync); code age &lt; 30 min; `stallOps` merge |
| Price / menu edit not sticking | Signed in as team (not Guest)? | Vercel env; RLS on `team_extras` / `customer_reviews` |
| Excel upload fails | Upload validation messages | `src/lib/validate.ts`, `parseWorkbook.ts`, Supabase `snapshots` |
| Login fails | Supabase Auth users | `.env` / Vercel `VITE_SUPABASE_*` |
| Mobile app blank | `MOBILE.md` | Capacitor loads live URL — deploy web first |
| Two stalls mix orders | Per-event guest link `?event=` | Sold/Pending event filter; see Orders README |

## Env vars (Vercel + local `.env`)

| Variable | Used for |
|----------|----------|
| `VITE_SUPABASE_URL` | Cloud DB + auth |
| `VITE_SUPABASE_ANON_KEY` | Client + many API routes |
| `VITE_UPLOAD_PASSWORD` | Publish Excel / restore |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional; stronger API writes (often missing on Hobby) |

If anon-only: guest menu edits append rows in `customer_reviews` (see `api/customer-order.ts`).

## Deploy

```bash
cd nasta-dashboard
npx vercel --prod --yes
npx vercel alias set <deployment-url> nastazentrum.vercel.app
```

CLI deploys upload **local files** (including uncommitted work). GitHub deploys only what’s **pushed** to `main`.
