# `api/` — Vercel serverless functions

These run on **Vercel**, not in the browser. The React app calls them as `/api/<name>`.

**If any API fails:** Vercel → Project → Deployments → function logs → search the file name. Also check env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `SUPABASE_SERVICE_ROLE_KEY`, AI keys below.

---

### `customer-order.ts`
- **Why we need it:** Public ordering API — GET menu/queue, POST place order (4-digit claim code), staff claim, and patch public menu (override bag in `customer_reviews` when RLS blocks `team_extras`).
- **Used by:** `PublicOrder.tsx`, `patchPublicMenu.ts`, guest `/order`.
- **If something fails / what to check:** Empty menu → Event menu on Orders + `?event=` on link; Supabase `team_extras.stall_ops`; override rows `__pmenu_ov_*`; claim TTL **30 min**; Vercel function logs; service role vs anon.
- **What to change:** Menu resolution, claim TTL, default catalog, place/claim lifecycle.

### `customer-review.ts`
- **Why we need it:** POST public reviews; GET list for team; mirrors into `stall_ops.customerReviews` when service role is available.
- **Used by:** `PublicReview.tsx`, `Reviews.tsx` / `customerReviews.ts`.
- **If something fails / what to check:** Table `customer_reviews` + RLS (`supabase/customer_reviews.sql`); filters out config rows (`__review_form__`, `__site_config__`, menu overrides); GET needs team caller headers.
- **What to change:** Normalization, storage fallback, mirror logic.

### `review-form.ts`
- **Why we need it:** GET/POST shared review form config (chips, question order) stored as append-only rows in `customer_reviews`.
- **Used by:** `customerReviews.ts`, `ReviewFormEditor.tsx`.
- **If something fails / what to check:** Team login for POST; config ids `__rform_*`; empty config rejected.
- **What to change:** Schema / field types when form editor gains options.

### `site-config.ts`
- **Why we need it:** GET/POST global site config (`__site_config__` in `customer_reviews`) for Developer Studio branding/nav/theme.
- **Used by:** `siteConfig.ts`, `SiteConfigContext.tsx`.
- **If something fails / what to check:** Developer role for POST; upsert failures fall back to local-only.
- **What to change:** Auth rules or storage row format.

### `publish-snapshot.ts`
- **Why we need it:** Developer-only service-role publish of Excel `snapshots` + `snapshot_versions` (bypasses client RLS).
- **Used by:** `supabase.ts` → Upload publish.
- **If something fails / what to check:** `SUPABASE_SERVICE_ROLE_KEY` on Vercel; `VITE_UPLOAD_PASSWORD` / `UPLOAD_PASSWORD` (default `Nasta998#`); caller must be Developer.
- **What to change:** Payload shape or version archive insert.

### `ai-helper.ts`
- **Why we need it:** Team AI helper chat (OpenAI) with FAQ fallback when key missing or LLM fails.
- **Used by:** `aiClient.ts` → `AiHelperFab`.
- **If something fails / what to check:** `OPENAI_API_KEY` or `AI_HELPER_OPENAI_KEY`, `AI_HELPER_MODEL`; 403 if role not allowed; falls back to FAQ.
- **What to change:** System prompt, FAQ list, allowed roles.

### `ai-agent.ts`
- **Why we need it:** Jeeva-only: launch/follow-up Cursor Cloud Agents against this repo (auto-PR).
- **Used by:** `aiClient.ts` → `AiCode.tsx`.
- **If something fails / what to check:** `CURSOR_API_KEY`; optional `CURSOR_REPO_URL`, `CURSOR_REPO_REF`, `CURSOR_MODEL_ID`; 403 if not Jeeva.
- **What to change:** Repo URL, model, prompt wrapper.

### `ai-agent-status.ts`
- **Why we need it:** Jeeva-only poll of Cursor agent status by `agentId` (`bc-…`).
- **Used by:** `aiClient.ts` (`fetchAiAgentStatus`).
- **If something fails / what to check:** Same `CURSOR_API_KEY`; valid `agentId`.
- **What to change:** Status API URL/mapping if Cursor API changes.

### `_lib/nastaAuth.ts`
- **Why we need it:** Shared API auth — reads `x-nasta-name` / body, maps to team role; rejects Guest/Other for protected actions.
- **Used by:** All `api/*.ts` handlers.
- **If something fails / what to check:** Client must send `userName` header/body; role is **name-based**, not JWT claims.
- **What to change:** `TeamRole` or `readCaller` when access rules change.
