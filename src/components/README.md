# `src/components/` — reusable UI

---

### `Layout.tsx`
- **Why:** Sidebar, top bar, banners (demo/stall/offline/seed), outlet, stall unlock modal; mounts CommandPalette, FloatingDock, TodoReminderRunner, AmbientBackground.
- **If broken:** Nav filtered by role/stall (`canSeeNav`); stall forces `/orders`; Sync flushes extras + data queues.
- **Change:** Global chrome here; nav items in Studio `siteConfig.nav`.

### `AuthGate.tsx`
- **Why:** Wait for auth → skeleton or Login → team app.
- **If broken:** Infinite skeleton → `AuthContext.loading` stuck.
- **Change:** Auth logic belongs in `AuthContext`.

### `RequireFinanceAccess.tsx`
- **Why:** Redirect money pages to `/orders` in stall mode.
- **If broken:** New money route not listed in `stallMode.isMoneyPath`.
- **Change:** Update `isMoneyPath` when adding finance routes.

### `RequireGuestAccess.tsx`
- **Why:** Playground only for Guest.
- **If broken:** Non-guest → `/orders`; check `guestAuth`.
- **Change:** Guest rules in `guestAuth` / allowlist.

### `RequireDeveloper.tsx`
- **Why:** Guards `/studio`.
- **If broken:** `canDevelop(user)` false.
- **Change:** Developer email in `authAllowlist`.

### `RequireAiHelper.tsx`
- **Why:** Guards `/ai-helper`.
- **If broken:** `canUseAiHelper`.
- **Change:** Allowlist.

### `RequireUploadAccess.tsx`
- **Why:** Upload / Quick Add / AI Code — upload managers only.
- **If broken:** `canManageUploads`.
- **Change:** Allowlist.

### `FloatingDock.tsx`
- **Why:** Container for team chat + AI FABs.
- **If broken:** Hidden for Guest; hidden on `/order` or `data-hide-fab=1` (Orders New/Pending).
- **Change:** Hide rules via `documentElement.dataset.hideFab`.

### `AiHelperFab.tsx`
- **Why:** Floating how-to chat (`askAiHelper`).
- **If broken:** API/FAQ fallback; allowlist; Vercel AI env.
- **Change:** UI here; backend `aiClient` / `api/ai-helper`.

### `TeamCommsFab.tsx`
- **Why:** Team chat + announcements (~12s poll).
- **If broken:** `StallOpsContext` chat; hidden for guests.
- **Change:** Posting in StallOpsContext; UI here.

### `CommandPalette.tsx`
- **Why:** ⌘K / Ctrl+K jump to pages.
- **If broken:** `ACTIONS` out of date vs routes; disabled in stall mode.
- **Change:** Add entries when routes change.

### `HomeWidgets.tsx`
- **Why:** Dashboard widgets (countdown, weather advice, streak, plates, mission, PDF).
- **If broken:** Widget flags in `siteConfig.widgets`.
- **Change:** New widget types here + Studio.

### `BusinessIntelSection.tsx`
- **Why:** Item profit, heatmap, demand, combos, health score on Insights.
- **If broken:** Need completed orders + menu (+ reviews for text intel).
- **Change:** Algorithms in `businessIntel`.

### `ReviewFormEditor.tsx`
- **Why:** Edit public review chips/questions; publish.
- **If broken:** `publishReviewFormConfig` / API `review-form`.
- **Change:** Sections here; defaults in `customerReviews`.

### `TodoReminderRunner.tsx`
- **Why:** Headless — send 24h/2h todo emails once per session.
- **If broken:** Offline skip; `notifyEmails`; session key `nasta-todo-remind-ran`.
- **Change:** Timing/copy in `todoReminders`.

### `ThemeCloudSync.tsx`
- **Why:** Sync theme to Supabase `user_prefs` (skip demo).
- **If broken:** Needs cloud auth; table `user_prefs`.
- **Change:** `cloudExtras` prefs helpers.

### `EditableText.tsx`
- **Why:** Developer pen-mode inline edit of labels.
- **If broken:** Edit UI off or not developer; unique `id` required.
- **Change:** Pass stable ids; save via site config.

### `EuroInput.tsx`
- **Why:** Decimal-safe € typing (`3.` / `3.5`).
- **If broken:** Snapping → use this instead of raw number input; `euroAmount` parse.
- **Change:** Min/step; parse rules in `euroAmount`.

### `Money.tsx`
- **Why:** Format/display EUR (de-DE).
- **If broken:** NaN upstream.
- **Change:** Keep API stable — used widely.

### `ChartChrome.tsx`
- **Why:** Shared chart card + euro tick formatters for Recharts.
- **If broken:** Overflow → `.chart-box` CSS; dark tooltip contrast.
- **Change:** Shared chart styles here + `index.css`.

### `KpiCard.tsx`
- **Why:** KPI tile with sparkline/trend/link.
- **If broken:** CountUp + reduced motion.
- **Change:** Tones/props; used on Dashboard/Cash.

### `MotionCard.tsx` / `Stagger`
- **Why:** Animated glass cards.
- **If broken:** `prefers-reduced-motion`; set `interactive={false}` if clicks fight animation.
- **Change:** Presets in `lib/motion`.

### `Skeleton.tsx`
- **Why:** Loading page skeleton + empty state.
- **If broken:** Stuck = parent never leaves `loading`.
- **Change:** `.skel-*` CSS.

### `AmbientBackground.tsx`
- **Why:** Decorative background on Layout/Login.
- **If broken:** Perf on old phones — respects reduced motion.
- **Change:** Visual only (`.ambient`).

### `CountUp.tsx`
- **Why:** Animated numbers for KPIs.
- **If broken:** Pass custom `format` for non-money.
- **Change:** Duration; reduced motion.

### `Sparkline.tsx`
- **Why:** Mini SVG trend in KPI cards.
- **If broken:** Empty `values` → null.
- **Change:** Size/color props.

### `WeatherIcon.tsx`
- **Why:** Map weather kind → Lucide icon.
- **If broken:** Kind must match `liveWeather` tags.
- **Change:** Add kinds in both places.
