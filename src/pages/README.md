# `src/pages/` — one screen ≈ one route

For each file: **why**, **route**, **if broken check**, **what to change**.

---

### `Login.tsx`
- **Why:** Sign-in UI (cloud email or local name); forgot-password help email.
- **Route:** Shown by `AuthGate` when logged out (not its own path).
- **If broken:** Allowlist (`authAllowlist`); Supabase env; Guest vs team password (`guestAuth` / `VITE_GUEST_PASSWORD`).
- **Change:** Users in allowlist; copy in `siteConfig`.

### `Dashboard.tsx`
- **Why:** Home KPIs, filters, charts, saved views, export, smart alerts, `HomeWidgets`.
- **Route:** `/` (+ finance guard).
- **If broken:** Empty → upload Excel; `useData()` error/seed banner; export needs DOM mounted.
- **Change:** KPIs in `metrics`/`types`; widgets in `HomeWidgets` / Studio.

### `Events.tsx`
- **Why:** Event scorecards + participant toggles (who worked the stall).
- **Route:** `/events`.
- **If broken:** `metrics.byEvent` empty; `?q=` search; participants via `StallOpsContext`.
- **Change:** Columns here; participant type in `stallOps`.

### `Calendar.tsx`
- **Why:** Month grid, prep checklist, weather, inventory, ICS/PDF briefing, seasonal specials.
- **Route:** `/calendar`.
- **If broken:** `buildCalendarCards` inputs; Open-Meteo network; prep in stall ops; CSS calendar section.
- **Change:** Prep tasks in `stallOps`; weather tags in `ExtrasContext`.

### `Partners.tsx`
- **Why:** Partner balances, split rules, settlement charts, export.
- **Route:** `/partners`.
- **If broken:** `splitRules` / `extrasStore`; names exclude Box/PayPal; `settlementPlan`.
- **Change:** `lib/splitRules`, `extrasStore`.

### `Cash.tsx`
- **Why:** Cash box ledger vs physical count, PayPal, POS cash today, mismatch explain.
- **Route:** `/cash`.
- **If broken:** Snapshot cash rows / denominations; `explainCashMismatch`; POS from stall orders.
- **Change:** `lib/cash`, `mismatch`, Excel parser.

### `Insights.tsx`
- **Why:** Forecasts, location/weather/season analysis, fee what-if, business intel.
- **Route:** `/insights`.
- **If broken:** Need completed events; `BusinessIntelSection` needs orders+menu.
- **Change:** `insights`, `seasons`, `businessIntel`.

### `Stock.tsx`
- **Why:** Ingredient stock (buy/use), low-stock, packing per event.
- **Route:** `/stock`.
- **If broken:** `StallOpsContext` sync/offline; event list from snapshot.
- **Change:** Stock model in `stallOps`.

### `Orders.tsx`
- **Why:** Core POS — New / Pending / Sold / Totals / Menu prices; claim codes; guest links; payments; display sync.
- **Route:** `/orders`.
- **If broken:** Event filter mixing stalls; Sync button; merge/`deletedOrderIds` in `stallOps`; FAB via `data-hide-fab`; claim TTL 30m; see TROUBLESHOOTING.
- **Change:** Domain in `stallOps` + `StallOpsContext`; PayPal in `paypalMe`; display in `displaySync`.

### `Todos.tsx`
- **Why:** Team tasks with assignee + due; ties to reminder emails.
- **Route:** `/todos`.
- **If broken:** `teamTodos` sync; `TodoReminderRunner` + `notifyEmails`.
- **Change:** `TeamTodo` in `stallOps`; copy in `todoReminders`.

### `Reviews.tsx`
- **Why:** Staff inbox for customer reviews; QR links; table-setup help.
- **Route:** `/reviews`.
- **If broken:** `customer_reviews` SQL/RLS; local vs cloud load; setup banner.
- **Change:** `customerReviews`; form in Studio / `ReviewFormEditor`.

### `FeaturePage.tsx`
- **Why:** Renders Studio-configured feature tabs by `:id`.
- **Route:** `/feature/:id`.
- **If broken:** Unknown/hidden → redirect `/`.
- **Change:** Add features in Developer Studio, not hard-code.

### `DeveloperStudio.tsx`
- **Why:** CMS — brand, theme, nav, widgets, copy pens, PayPal QR, emails, review form, features.
- **Route:** `/studio` (Developer).
- **If broken:** `publishSiteConfig`; menu photo size vs cloud; role `canDevelop`.
- **Change:** Schema in `siteConfig`; new admin tabs here.

### `Goals.tsx`
- **Why:** Team goals + milestones amounts.
- **Route:** `/goals`.
- **If broken:** `teamGoals` syncing flag.
- **Change:** `TeamGoal` in `stallOps`.

### `Plates.tsx`
- **Why:** Live plate counter + break-even hint.
- **Route:** `/plates`.
- **If broken:** Local `plate_counts` vs cloud; offline queue; `platePriceHint` in site config.
- **Change:** `cloudExtras` plate helpers; `homeWidgets` break-even.

### `Playground.tsx`
- **Why:** Guest demo sandbox tour (isolated storage).
- **Route:** `/playground` (Guest only).
- **If broken:** Non-guest redirected; `demoMode` keys.
- **Change:** `TOURS` here; isolation in `demoMode`.

### `Upload.tsx`
- **Why:** Excel validate → merge/replace publish; history restore; Drive pull settings.
- **Route:** `/upload` (Developer upload access).
- **If broken:** Validation report; publish password; RLS / `publish-snapshot`; Drive CORS → `pull-excel` function; demo blocks live publish.
- **Change:** `parseWorkbook`, `validate`, `merge`.

### `QuickAdd.tsx`
- **Why:** Fast expense/income at market without full Excel.
- **Route:** `/quick-add`.
- **If broken:** Needs upload password + cloud; offline queue.
- **Change:** Categories here; `Transaction` in `types`.

### `Account.tsx`
- **Why:** Password change / recovery (`needsNewPassword`); Studio link for developer.
- **Route:** `/account`.
- **If broken:** `AuthContext.changePassword` / recovery session.
- **Change:** Auth flows in `AuthContext`.

### `AiHelper.tsx`
- **Why:** Legacy route; redirects to `/` — real UI is `AiHelperFab`.
- **Route:** `/ai-helper`.
- **If broken:** Allowlist message if unauthorized.
- **Change:** Prefer FAB; keep route for bookmarks.

### `AiCode.tsx`
- **Why:** Launch/poll Cursor code agents (Jeeva).
- **Route:** `/ai-code`.
- **If broken:** `CURSOR_API_KEY` on Vercel; `canUseAiCodeAgent`.
- **Change:** `aiClient` + `api/ai-agent*`.

### `PublicOrder.tsx`
- **Why:** Customer menu/cart/claim at `/order`; staff preview edit (`?preview=1`).
- **Route:** `/order` (public).
- **If broken:** Menu/API `customer-order`; `?event=` link; claim sync; EuroInput decimals; edit modal backdrop; see TROUBLESHOOTING.
- **Change:** Menu in stall ops; copy in `publicOrderI18n`; API in `customer-order.ts`.

### `PublicReview.tsx`
- **Why:** Public feedback form at `/review`.
- **Route:** `/review` (public).
- **If broken:** Form config API; submit to `customer_reviews`.
- **Change:** `customerReviews` + Studio form editor.

### `CustomerDisplay.tsx`
- **Why:** Second-screen ticket/total phases for customers.
- **Route:** `/display`.
- **If broken:** Pop-up blocked; `displaySync` must be published from Orders; same origin.
- **Change:** Phases in `displaySync`; CSS `.cust-display`.

### `TeamHub.tsx`
- **Why:** Legacy stub (redirect). Team chat is `TeamCommsFab`.
- **Route:** Not mounted (`/team` → `/`).
- **If broken:** N/A unless re-routed.
- **Change:** Delete or restore route intentionally.
