# `src/context/` — global React state

Providers wrap the app so every page can share auth, Excel data, and stall POS state.

**Most POS bugs live in `StallOpsContext` + `lib/stallOps.ts` merge rules.** See [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md).

---

### `AuthContext.tsx`
- **Why:** Session (Supabase or local), sign-in/out, password change/recovery, `AuthUser`.
- **If broken:** `VITE_SUPABASE_*`; allowlist rejects email; `needsNewPassword` after recovery; local session in `sessionStorage`.
- **Change:** Flows here; users in `authAllowlist`.

### `DataContext.tsx`
- **Why:** Excel snapshot load (cloud/local/seed), metrics, upload/publish, Drive auto-pull, history, quick-add, offline flush.
- **If broken:** `dataOrigin` seed vs cloud; publish password / RLS / `publish-snapshot`; Drive CORS → edge `pull-excel`; demo uses separate keys.
- **Change:** Pipeline in `supabase`, `parseWorkbook`, `merge`; expose methods here.

### `StallOpsContext.tsx`
- **Why:** Stock, menu, orders, payments, event prices, chat, announcements, todos, goals, prep; persist local + cloud (`team_extras.stall_ops`).
- **If broken:** Sync lag; resurrected deletes → `deletedOrderIds` / merge; huge menu photos break payload; refresh overwriting local → merge `updatedAt`; device `activeEventId` should stay local on refresh.
- **Change:** Domain types/helpers in `stallOps`; keep this file as the React API.

### `ExtrasContext.tsx`
- **Why:** Weather tags, inventory defs/lines, mission; sync team extras (non-order).
- **If broken:** Offline `pendingOps`; flush also pushes menu photos; demo keys.
- **Change:** `extrasStore` + `cloudExtras`.

### `StallModeContext.tsx`
- **Why:** Stall/kiosk — hide finance, idle auto-enter on Orders, PIN unlock; Guest always locked.
- **If broken:** PIN (`siteConfig` / default `9987`); idle ms; Guest cannot unlock; money paths in `stallMode`.
- **Change:** Allowed paths / PIN defaults in `stallMode` + Studio settings.

### `DemoModeContext.tsx`
- **Why:** Playground sandbox — remounts data providers with isolated storage.
- **If broken:** Live vs demo mix → check `isDemoMode()` / `nasta-demo:` keys.
- **Change:** Isolation in `demoMode`.

### `ThemeContext.tsx`
- **Why:** Light / dark / system → `data-theme` on `<html>`.
- **If broken:** CSS tokens; local `nasta-theme`; cloud via `ThemeCloudSync`.
- **Change:** Tokens in `index.css`.

### `LocaleContext.tsx`
- **Why:** EN/DE/TA/KA + `tr()` with optional Studio copy overrides.
- **If broken:** Missing key falls back to `i18n.t`; overrides in `siteConfig.copy`.
- **Change:** Strings in `i18n` or Studio copy tab.

### `SiteConfigContext.tsx`
- **Why:** Load/publish brand, nav, widgets, features, inline edits (local + `/api/site-config`).
- **If broken:** Fetch on mount; Developer POST; falls back local.
- **Change:** Schema in `siteConfig`; edit in Studio.

### `EditUiContext.tsx`
- **Why:** Toggle Developer “Edit UI” pens (`EditableText`).
- **If broken:** Not developer; `sessionStorage` `nasta-edit-ui-v1`.
- **Change:** Permission via `canDevelop`; toggle in Layout.
