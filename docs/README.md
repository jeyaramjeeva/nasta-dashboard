# Docs index — Nasta Zentrum Tracker

Use these when you are new to the repo or something fails on market day.

## Start here

| Doc | Use it for |
|-----|------------|
| [PROJECT_MAP.md](PROJECT_MAP.md) | Architecture, env, deploy, “where to look” |
| [../TROUBLESHOOTING.md](../TROUBLESHOOTING.md) | Symptom → check list |
| [../MOBILE.md](../MOBILE.md) | Capacitor / Android / iOS |
| [../README.md](../README.md) | Setup + weekly Excel workflow |

## Every folder / every file

Open the folder on GitHub — each `README.md` explains **why each file exists**, **what to check if it fails**, and **what to change**.

| Folder | Guide |
|--------|--------|
| [../api/README.md](../api/README.md) | Every Vercel API route |
| [../src/README.md](../src/README.md) | App entry (`App`, `main`, CSS, types) |
| [../src/pages/README.md](../src/pages/README.md) | Every screen |
| [../src/components/README.md](../src/components/README.md) | Every shared component |
| [../src/context/README.md](../src/context/README.md) | Every context provider |
| [../src/lib/README.md](../src/lib/README.md) | Every helper module |
| [../scripts/README.md](../scripts/README.md) | Every script |
| [../supabase/README.md](../supabase/README.md) | Every SQL + Edge Function |
| [../public/README.md](../public/README.md) | Every static asset |
| [../.github/README.md](../.github/README.md) | CI vs CLI deploy note |

## Quick failures

| Problem | Open |
|---------|------|
| Guest menu / claim | TROUBLESHOOTING + `api/customer-order` + `PublicOrder` |
| Pending/sold mix or resurrect | TROUBLESHOOTING + `StallOpsContext` + `stallOps.ts` |
| Vercel build red | Build logs; `npm run build` locally |
| Excel publish | Upload page + `validate` / `publish-snapshot` / RLS |
| Mobile blank | MOBILE.md — deploy web first |
