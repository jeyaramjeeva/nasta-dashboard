# `src/lib/` — business logic (no React UI)

Helpers used by pages, context, and sometimes mirrored in `api/`.  
For each file: **why** · **used by** · **if broken** · **what to change**.

---

### Critical on market day

### `stallOps.ts`
- **Why:** Core stall domain — stock, menu, POS orders, event menus/prices, todos, goals, chat, prep, claim codes, merge (`mergeStallOrderBags`, `deletedOrderIds`, `updatedAt`).
- **Used by:** Orders, Stock, StallOpsContext, Goals, Todos, Events, many libs.
- **If broken:** localStorage `nasta-stall-ops-v3`; cloud `team_extras.stall_ops`; resurrected tickets → tombstones/merge; claim TTL 30m; huge photos.
- **Change:** Types, defaults, order lifecycle, merge rules (re-run `scripts/test-*.mjs`).

### `cloudExtras.ts`
- **Why:** Supabase sync for team extras, stall_ops, theme prefs, plate counts.
- **Used by:** ExtrasContext, StallOpsContext, Plates, ThemeCloudSync, patchPublicMenu.
- **If broken:** `VITE_SUPABASE_*`; tables `team_extras`, `user_prefs`, `plate_counts`; RLS; merge-before-save on stall_ops.
- **Change:** Payload fields / fetch-save / merge.

### `euroAmount.ts`
- **Why:** Parse/format € decimals safely while typing.
- **Used by:** EuroInput, Orders, PublicOrder.
- **If broken:** Comma/dot locale; don’t use raw `Number` on price fields.
- **Change:** Rounding/display rules.

### `flushOffline.ts` / `offlineQueue.ts`
- **Why:** Queue writes offline; flush stall_ops first then extras/plates/quick_add.
- **Used by:** DataContext, ExtrasContext, StallOpsContext, Plates.
- **If broken:** Key `nasta-offline-queue-v1`; max ~80 ops; connectivity.
- **Change:** New op kinds / priority.

### `patchPublicMenu.ts`
- **Why:** Client calls `/api/customer-order` to patch guest menu + mirror local.
- **Used by:** PublicOrder.
- **If broken:** Team headers; API + override rows; sync stall ops.
- **Change:** New patch actions.

### `publicOrderI18n.ts`
- **Why:** DE/EN copy for `/order`.
- **Used by:** PublicOrder.
- **If broken:** Key `nasta-order-lang` (default `de`).
- **Change:** Add strings/languages.

### `guestAuth.ts`
- **Why:** Guest email/password helpers + `isGuestUser`.
- **Used by:** Auth, Login, StallMode, public pages, FABs.
- **If broken:** `VITE_GUEST_PASSWORD`; Guest in allowlist.
- **Change:** Credentials/detection.

### `stallMode.ts`
- **Why:** Stall focus paths, PIN, idle timers, money-path list.
- **Used by:** StallModeContext, Layout, RequireFinanceAccess.
- **If broken:** session `nasta-stall-mode`; PIN from site config (default `9987`).
- **Change:** `MONEY_PATHS` / allowed paths / defaults.

### `displaySync.ts`
- **Why:** POS → `/display` via localStorage + BroadcastChannel.
- **Used by:** Orders, CustomerDisplay.
- **If broken:** Pop-ups; same origin; key `nasta-pos-display-v1`.
- **Change:** `PosDisplayState` fields.

### `ticketPrint.ts`
- **Why:** Print 80mm kitchen ticket window.
- **Used by:** Orders.
- **If broken:** Pop-up blocker; order lines/label.
- **Change:** Ticket HTML/CSS.

### `posCash.ts`
- **Why:** Net cash-in per order + today’s POS cash summary.
- **Used by:** Orders, Cash, salesStats.
- **If broken:** Completed non-void; Berlin “today”.
- **Change:** Cash formula when payment fields change.

### `paypalMe.ts`
- **Why:** PayPal.me URL + QR image (upload or generated).
- **Used by:** Orders, DeveloperStudio.
- **If broken:** `VITE_PAYPAL_ME_URL`; data URL QR; `api.qrserver.com`.
- **Change:** Default URL / QR resolution.

---

### Auth / cloud / site

### `supabase.ts`
- **Why:** Supabase client; snapshot CRUD; versions; upload password; publish via API.
- **Used by:** Auth, Data, Extras, StallOps, Reviews, Plates, ThemeCloudSync, drive.
- **If broken:** `VITE_SUPABASE_*`; tables `snapshots`, `snapshot_versions`; `VITE_UPLOAD_PASSWORD`; service role for publish API.
- **Change:** New table accessors / publish payload.

### `authAllowlist.ts`
- **Why:** Who can login + roles (Developer, upload, AI helper, AI code).
- **Used by:** Auth, Login, Layout, Require*, CommandPalette, Account, Dashboard, etc.
- **If broken:** `VITE_ALLOWED_EMAILS` format `email:Name,...`; demo grants broad access.
- **Change:** Defaults / role gates.

### `siteConfig.ts`
- **Why:** Studio config model — nav, theme, widgets, copy, PIN/idle; local + API.
- **Used by:** SiteConfigContext, Studio, Login, Layout, HomeWidgets, EditableText, stallMode.
- **If broken:** local `nasta-site-config-v2`; cloud `__site_config__` row; Developer POST.
- **Change:** Extend `SiteConfig` schema.

### `customerReviews.ts`
- **Why:** Review form config, chips, local/cloud, QR helpers, i18n for reviews.
- **Used by:** Reviews, PublicReview, ReviewFormEditor, BusinessIntel; APIs mirror shape.
- **If broken:** `/api/review-form`, `/api/customer-review`; table RLS; local keys `nasta-customer-reviews-v1`, `nasta-review-form-config-v1`.
- **Change:** Defaults / publish helpers.

### `demoMode.ts`
- **Why:** Isolate playground storage (`nasta-demo:` prefix).
- **Used by:** App, DemoModeContext, Data/Extras/StallOps, history, offlineQueue, etc.
- **If broken:** session `nasta-demo-mode`.
- **Change:** Enter/exit/reset flows.

### `passwordHelp.ts`
- **Why:** Forgot-password email via FormSubmit.co.
- **Used by:** Auth, Login, DeveloperStudio, todoReminders fallback.
- **If broken:** FormSubmit confirmation email; network; recipient constant.
- **Change:** Provider/template.

---

### Excel / dashboard numbers

### `parseWorkbook.ts`
- **Why:** Excel → typed `Snapshot`.
- **Used by:** DataContext, Upload, `scripts/regen-seed.ts`.
- **If broken:** Sheet/column layout; Berlin dates (not UTC slice); `xlsx` package.
- **Change:** Keep in sync with `exportWorkbook`.

### `exportWorkbook.ts`
- **Why:** Snapshot → downloadable `.xlsx` from history.
- **Used by:** Upload.
- **If broken:** Sheet structure must match parser.
- **Change:** Sheets/columns with `parseWorkbook`.

### `validate.ts`
- **Why:** Pre-publish report (unknown events, unpaid, cash mismatch, duplicates).
- **Used by:** DataContext, Upload.
- **If broken:** Delegates to duplicateCheck + metrics.
- **Change:** Issue codes / thresholds.

### `merge.ts`
- **Why:** Merge vs replace snapshots; dedupe; recompute partners.
- **Used by:** DataContext, validate, Upload.
- **If broken:** `transactionKey` / `cashKey` semantics.
- **Change:** Merge strategy / keys.

### `history.ts`
- **Why:** Last ~20 local snapshot versions for restore.
- **Used by:** DataContext.
- **If broken:** `nasta-history-v1` quota on large files.
- **Change:** MAX_LOCAL / shape.

### `partners.ts`
- **Why:** Recompute partner paid/returned/balance from txs.
- **Used by:** merge, DataContext.
- **If broken:** Person names; excludes Box/PayPal.
- **Change:** Balance rules.

### `metrics.ts`
- **Why:** Central KPIs, filters, P&L, settlement, cash recon, smart alerts.
- **Used by:** DataContext, Dashboard, validate.
- **If broken:** Incomplete snapshot; Setup vs event filters.
- **Change:** Thresholds / alert rules.

### `mismatch.ts`
- **Why:** Human explanations for cash box mismatch.
- **Used by:** Cash.
- **If broken:** denominations + PayPal + cashBox; ~€5 tolerance OK.
- **Change:** Causes / tolerance.

### `cash.ts`
- **Why:** Denomination parse + ledger balance math.
- **Used by:** Cash, DataContext, metrics, mismatch, parseWorkbook.
- **If broken:** Denom labels; ledger event IDs `Setup` / `E###`.
- **Change:** Parse rules when Excel cash format changes.

### `duplicateCheck.ts` / `duplicateExpenses.ts`
- **Why:** Flag duplicate txs / soft expense doubles for upload warnings.
- **Used by:** validate, metrics alerts.
- **If broken:** Key matching too strict/loose.
- **Change:** Thresholds / grouping.

### `snapshotDiff.ts`
- **Why:** Human diff for upload preview.
- **Used by:** Upload.
- **If broken:** Keys differ slightly from merge keys.
- **Change:** Diff scopes when snapshot grows.

### `uploadNaming.ts`
- **Why:** Standard Excel filenames `Nasta Zentrum Tracker {day}{Month}.xlsx`.
- **Used by:** DataContext.
- **If broken:** Regex for parsing existing names.
- **Change:** Naming convention.

### `drive.ts`
- **Why:** Parse Drive/OneDrive links; fetch via browser or `pull-excel` edge fn; auto-pull settings.
- **Used by:** DataContext, Upload, Extras settings.
- **If broken:** Public link; CORS → edge function; `nasta-drive-settings-v1`.
- **Change:** Providers / schedule.

### `exportReport.ts`
- **Why:** DOM → PNG/PDF (html-to-image + jsPDF).
- **Used by:** Dashboard, Insights, Partners.
- **If broken:** Element visible; large charts timeout.
- **Change:** Scale/margins.

---

### Insights / calendar / widgets

### `insights.ts`
- **Why:** Event forecasts + category spend helpers.
- **Used by:** Insights, calendar, metrics.
- **If broken:** Need history; `GROCERY_PER_DAY` fallbacks.
- **Change:** Benchmarks / formula.

### `calendar.ts`
- **Why:** Rich calendar cards (prep, P&L, inventory, spans).
- **Used by:** Calendar, Layout, Dashboard, Plates, HomeWidgets.
- **If broken:** Event dates; inventory cost; weather tags.
- **Change:** Prep/spend rules.

### `homeWidgets.ts`
- **Why:** Countdown, prep %, break-even plates, streak, mood.
- **Used by:** HomeWidgets, Calendar, Plates.
- **If broken:** Cards from `calendar.ts`; stall open 09:00 Berlin.
- **Change:** Thresholds / copy logic.

### `briefingPdf.ts`
- **Why:** One-page stall briefing PDF.
- **Used by:** Calendar, HomeWidgets.
- **If broken:** jsPDF; weather+card inputs.
- **Change:** Layout/sections.

### `ics.ts`
- **Why:** Download `.ics` for stall days (09:00–18:00 Berlin).
- **Used by:** Calendar.
- **If broken:** Need `startDate`.
- **Change:** Duration/summary.

### `seasonalSpecials.ts`
- **Why:** Festival markers (Diwali, Holi, Karneval, Easter…).
- **Used by:** Calendar.
- **If broken:** Year tables must be extended for new years.
- **Change:** Dates/tips.

### `seasons.ts`
- **Why:** YoY season pairs + weather performance.
- **Used by:** Insights.
- **If broken:** Consistent location+name; weather tags.
- **Change:** Pairing / buckets.

### `weatherAdvice.ts`
- **Why:** Go/Caution/Skip from weather + history.
- **Used by:** Calendar, HomeWidgets, briefingPdf.
- **If broken:** Manual tags + completed events with weather.
- **Change:** Rules/copy.

### `liveWeather.ts`
- **Why:** Open-Meteo fetch (no key) + geocode cache.
- **Used by:** Calendar, WeatherIcon.
- **If broken:** Network to open-meteo; caches `nasta-geo-cache-v1`, `nasta-wx-cache-v1`.
- **Change:** City fallbacks / WMO maps.

### `channelSplit.ts`
- **Why:** Estimate cash vs PayPal income by event type.
- **Used by:** Insights.
- **If broken:** `eventCashCounts` before/after PayPal.
- **Change:** Allocation rules.

### `whatIf.ts`
- **Why:** Fee what-if break-even / profit.
- **Used by:** Insights.
- **If broken:** EventMetrics must have fee/grocery/income.
- **Change:** Extra scenario dimensions.

### `businessIntel.ts`
- **Why:** Profitability, heatmap, forecast, combos, review intel, health score.
- **Used by:** BusinessIntelSection.
- **If broken:** Completed orders + food costs; Berlin hours.
- **Change:** Weights / scoring.

### `salesStats.ts`
- **Why:** POS sales by item/day/event.
- **Used by:** Orders, businessIntel.
- **If broken:** Completed non-void; Berlin dates.
- **Change:** New breakdowns.

### `textIntel.ts`
- **Why:** Lightweight lang + sentiment for reviews (no API).
- **Used by:** Reviews, PublicReview, BusinessIntel.
- **If broken:** Short text → other/neutral.
- **Change:** Word lists.

### `splitRules.ts`
- **Why:** Partner settlement modes (`owed`, `custom_pct`, `expenses_first`).
- **Used by:** Partners.
- **If broken:** Rules from extrasStore.
- **Change:** New modes.

### `extrasStore.ts`
- **Why:** Local weather tags, split rules, inventory defs/lines.
- **Used by:** ExtrasContext, Calendar, Insights, Partners, calendar/weather libs.
- **If broken:** Keys `nasta-weather-v2`, `nasta-split-rules-v1`, inventory keys (demo-prefixed).
- **Change:** Defaults / schema.

### `savedViews.ts`
- **Why:** Named Dashboard filter presets.
- **Used by:** Dashboard.
- **If broken:** `nasta-saved-views-v1` max 30.
- **Change:** Filter fields.

---

### AI / media / misc

### `aiClient.ts`
- **Why:** Frontend to `/api/ai-helper`, `/api/ai-agent`, status; FAQ fallback.
- **Used by:** AiHelperFab, AiCode.
- **If broken:** Headers; `CURSOR_API_KEY` / OpenAI env; allowlist.
- **Change:** Endpoints / bodies.

### `aiHelperKb.ts`
- **Why:** Offline keyword FAQ for helper.
- **Used by:** aiClient fallback.
- **If broken:** No match → expand FAQS.
- **Change:** FAQ entries.

### `imageDataUrl.ts`
- **Why:** Compress images to JPEG data URLs (PayPal QR, menu photos).
- **Used by:** DeveloperStudio, PublicOrder.
- **If broken:** Size caps (8MB file; ~120k menu chars for sync).
- **Change:** Quality/dimensions for cloud limits.

### `i18n.ts`
- **Why:** Team UI string catalog `en/de/ta/ka` + `t()`.
- **Used by:** LocaleContext.
- **If broken:** Missing key → English; Studio copy can override.
- **Change:** Add keys to all four locales (+ type).

### `germanyTime.ts`
- **Why:** Europe/Berlin dates/times — avoid UTC day shifts.
- **Used by:** Almost everywhere date-related.
- **If broken:** Never use `toISOString().slice(0,10)` for German calendar days.
- **Change:** Formatters / wall-clock helpers.

### `achievements.ts`
- **Why:** Daily POS badges in localStorage.
- **Used by:** Orders.
- **If broken:** Key `nasta-achievements-v1` (+ demo prefix).
- **Change:** Badge rules.

### `changeDrawer.ts`
- **Why:** Greedy EUR change suggestion for cash pay.
- **Used by:** Orders.
- **If broken:** Bad `amountEuro` input.
- **Change:** Denom list.

### `todoReminders.ts`
- **Why:** Funny 24h/2h todo emails + event-day inspiration.
- **Used by:** Todos, TodoReminderRunner, Layout.
- **If broken:** `notifyEmails`; FormSubmit; due via Berlin time.
- **Change:** Windows / copy.

### `nativeShell.ts`
- **Why:** Capacitor status bar / splash / Android back (no-op on web).
- **Used by:** main.tsx.
- **If broken:** Only on native; see MOBILE.md.
- **Change:** Plugin setup.

### `motion.ts`
- **Why:** Framer Motion springs + reduced-motion helper.
- **Used by:** MotionCard, CommandPalette.
- **If broken:** framer-motion dep.
- **Change:** Animation constants.
