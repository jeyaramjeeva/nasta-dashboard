# `src/` — React frontend (Vite + TypeScript)

## Entry files

### `main.tsx`
- **Why we need it:** Boots React, loads `index.css`, starts Capacitor shell (`initNativeShell`), mounts `<App />`.
- **If something fails:** Blank screen → `#root` in `index.html`, console import errors, `initNativeShell`.
- **What to change:** Rarely; prefer providers in `App.tsx`.

### `App.tsx`
- **Why we need it:** Routes + provider tree (theme, auth, site config, locale, data, stall ops).
- **If something fails:** Wrong page → check routes/guards below; context errors → missing provider.
- **What to change:** Add routes here + nav in Developer Studio / `siteConfig`.

| Path | Page | Notes |
|------|------|--------|
| `/review` | PublicReview | Public |
| `/order` | PublicOrder | Public guest menu |
| `/display` | CustomerDisplay | Auth, no sidebar |
| `/` | Dashboard | Finance guard |
| `/events` | Events | Finance |
| `/calendar` | Calendar | Stall OK |
| `/partners` | Partners | Finance |
| `/cash` | Cash | Finance |
| `/insights` | Insights | Finance |
| `/stock` | Stock | Stall OK |
| `/orders` | Orders | POS |
| `/todos` | Todos | |
| `/reviews` | Reviews | |
| `/feature/:id` | FeaturePage | Config features |
| `/studio` | DeveloperStudio | Developer |
| `/goals` | Goals | Finance |
| `/plates` | Plates | Finance |
| `/playground` | Playground | Guest only |
| `/upload` | Upload | Developer upload |
| `/quick-add` | QuickAdd | Upload access |
| `/ai-helper` | AiHelper | Redirects; use FAB |
| `/ai-code` | AiCode | Developer |
| `/account` | Account | Password |

### `types.ts`
- **Why we need it:** Shared Excel snapshot / metrics TypeScript types.
- **If something fails:** Type errors after Excel changes → align with `parseWorkbook` + `metrics`.
- **What to change:** Add fields with parser + metrics in the same PR.

### `index.css`
- **Why we need it:** Global design tokens, layout, Orders/public-order/display styles (~thousands of lines).
- **If something fails:** Broken theme → `data-theme` on `<html>`; wrong class names; fonts need network.
- **What to change:** Prefer CSS variables; keep page sections near existing comments.

## Subfolders (detailed READMEs)

| Folder | Guide |
|--------|--------|
| [pages/](pages/README.md) | Every screen |
| [components/](components/README.md) | Every shared UI piece |
| [context/](context/README.md) | Every global state provider |
| [lib/](lib/README.md) | Every helper module |

Also see root [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) and [docs/PROJECT_MAP.md](../docs/PROJECT_MAP.md).
