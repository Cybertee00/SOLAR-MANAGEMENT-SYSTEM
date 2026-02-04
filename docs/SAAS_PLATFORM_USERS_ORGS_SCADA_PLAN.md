# SaaS Platform: Platform Users, Organization Limits, SCADA, Subscription & Feature Gating

**Status:** Research & plan only — no code changes yet.  
**Purpose:** Document current behavior, your requirements, and a step-by-step implementation approach for the “system within a system” (SaaS) features.

---

## 1. What You Asked For (Summary)

| Area | Requirement |
|------|-------------|
| **Platform Users** | Do **not** show all users. Show only **Operations Administrator(s)** per organization. |
| **Organization Management** | Set a **user limit** per organization. |
| **Organization Management** | **SCADA**: Insert APIs per company; new **SCADA page** that fetches data via those APIs and displays it — **strict data isolation** (each company sees only its own data). |
| **Subscription / onboarding** | When a new company **subscribes**, you want to **create the first user** (admin) for that company so they can then add others on their side. |
| **Feature / page access** | **Limit access to pages** based on what each company is paying for (tier/plan). |

You also asked for:  
- No coding yet; full research and a clear plan.  
- Implementation step-by-step with checks for errors/bugs after each step.  
- User-friendly design.

---

## 2. How the System Works Today (Relevant Parts)

### 2.1 Platform vs tenant

- **Platform routes** (`/platform/*`): System Owner only.  
  - Dashboard, Organizations, **Platform Users**, Analytics.  
- **Tenant routes** (`/tenant/*`): All authenticated users, scoped by organization (and RBAC).

### 2.2 Platform Users page (current)

- **Frontend:** `client/src/components/PlatformUsers.js`  
- **API:** `GET /api/platform/users` and `GET /api/platform/users/stats` (in `server/routes/platform.js`).
- **Behavior:**  
  - Lists **all** users across all organizations (with filters: role, organization, status, last login).  
  - Stats: total users, active, system owners, new today, inactive.  
  - No filter that restricts the list to “only Operations Administrators per org”.

So today you see every user (technicians, supervisors, etc.), not just the “admin per company” view you want.

### 2.3 Organization Management (current)

- **Frontend:**  
  - `OrganizationManagement.js` — list/create/edit/delete organizations.  
  - `OrganizationSettings.js` — org settings (key/value).  
  - `OrganizationFeatures.js` — org features (feature_code, is_enabled, config).  
  - `OrganizationBranding.js` — branding.
- **API:** `server/routes/organizations.js`  
  - CRUD for organizations; settings and features are key/value and feature_code-based.
- **Database:**  
  - `organizations`: id, name, slug, is_active, created_at, updated_at (no `user_limit`, no subscription/plan).  
  - `organization_settings`: key/value per org.  
  - `organization_features`: feature_code, is_enabled, config per org.

There is **no** user limit per org, **no** subscription/plan field, and **no** SCADA config or SCADA page.

### 2.4 User creation (current)

- **Tenant:** `UserManagement.js` (tenant) calls `POST /api/users`; users are created with `organization_id` from context (or chosen by system owner).  
- **Platform:** No dedicated “create first user for new org” flow; system owner would use tenant User Management after “Enter Company” or (if we add it) a platform action.

So “create a user when a company subscribes” is a new flow to design (likely under Platform).

### 2.5 Feature / page access (current)

- **organization_features** exists and is editable per org (Organization Features page), but:  
  - **No** mapping from feature_code to “which tenant pages are allowed”.  
  - **No** frontend check (nav or route guard) that hides or blocks pages based on org features.  
  - **No** plan/tier concept that drives which features are on.

So “limit access to pages based on what each company is paying for” is not implemented; the building block (organization_features) is there.

### 2.6 Data isolation (current)

- Tenant APIs use `organization_id` from session/context; Plant, Dashboard, etc. load data by org (and company-scoped files by slug).  
- Platform APIs for system owner bypass org filter (by design).  
- No SCADA yet, so no SCADA-specific isolation.

---

## 3. Understanding of Your Requirements

### 3.1 Platform Users: “Only Operations Administrator per organization”

- **Goal:** On Platform Users, you don’t want to see every user; you want a **per-organization view of who is the Operations Admin(s)** for that org.  
- **Implied:** Either:  
  - **Option A:** Change the default view to list one row per organization with “Operations Administrator(s)” for that org (names/contacts), or  
  - **Option B:** Keep a user list but **default filter** to role = Operations Administrator only (and still by org).  
- **Clarification useful:** Do you want “only ever show Operations Administrators” (no other roles on this page), or “show all users but grouped by org with emphasis on who is the admin”?  
- **Assumption for plan:** Default to **only Operations Administrators**, one row per org or one section per org with their admin(s), so the page is “Admins per company” rather than “All users”.

### 3.2 User limit per organization

- **Goal:** Cap how many users each organization can have (e.g. plan “Starter” = 5 users).  
- **Needs:**  
  - Store limit per org (e.g. `organizations.user_limit` or `organization_settings` / plan).  
  - Enforce on user create (and optionally on invite/activate): reject if current user count >= limit.  
  - UX: show “X / Y users” in org settings and when creating users; clear message when at limit.

### 3.3 SCADA: APIs per company + SCADA page, no data leaking

- **Goal:**  
  - Each company has its own SCADA API(s) (URLs/credentials).  
  - A **SCADA page** in the app calls those APIs and shows data.  
  - **Strict isolation:** Company A never sees Company B’s SCADA data.  
- **Needs:**  
  - **Storage:** Per-organization SCADA config (e.g. API base URL, auth method, keys). Prefer **server-side only** (no client-side API keys).  
  - **Backend proxy:** App server calls each company’s SCADA API (server-to-server), then returns only the data for the current tenant’s org.  
  - **Tenant SCADA page:** One route (e.g. `/tenant/scada`) that:  
    - For tenant user: shows only that org’s SCADA data (from backend).  
    - For system owner: either no access or show data only for “selected” org (same rule: one org at a time).  
  - **Security:** Validate org on every SCADA request; no cross-org mixing; secrets in env or DB per org, not in frontend.

### 3.4 Create first user when a company subscribes

- **Goal:** When a new company subscribes (new tenant), you create their **first user** (admin) so they can log in and add others.  
- **Needs:**  
  - A clear “subscription” or “onboarding” flow (could be manual for now: System Owner creates org then creates first user, or a single “Create organization + first admin” action).  
  - That first user: e.g. role Operations Administrator, `organization_id` = new org, so they can manage users inside their org.  
  - Optional: invite-by-email (set password on first login) vs setting a temporary password.

### 3.5 Limit page access by what each company is paying for

- **Goal:** Certain pages (e.g. SCADA, Reports, Plant, etc.) are only available if the org’s plan/features allow it.  
- **Needs:**  
  - **Model:** Either a **plan/tier** (e.g. Starter / Professional / Enterprise) that implies a set of features, or **only** feature flags per org (current `organization_features`).  
  - **List of “gated” features:** e.g. `scada`, `advanced_reports`, `plant`, `inventory`, etc., and a mapping “route/page X requires feature Y”.  
  - **Backend:** For sensitive APIs, check org feature (or plan) before returning data.  
  - **Frontend:**  
    - Hide nav links for disabled features.  
    - Guard routes: if user hits URL for a disabled feature, redirect or show “Not in your plan” (user-friendly).  
  - **Where to set:** Organization Management (e.g. “Plan” dropdown or “Features” checkboxes). Plan can drive default feature set; overrides possible via Organization Features.

---

## 4. Other Important SaaS Considerations (Beyond Your List)

- **Audit:** Log who created/updated org limits, SCADA config, and first user (for compliance).  
- **Billing/usage:** Optional: store “subscription_plan” or “tier” and usage (e.g. user count, API calls) for future billing.  
- **Onboarding:** Optional: “Welcome” step after first login for new org admin (set company profile, invite team).  
- **SCADA:** Rate limiting and timeouts when calling external APIs; don’t block your app if SCADA is slow/down.  
- **Security:** SCADA credentials encrypted at rest; minimal permissions; no SCADA secrets in frontend.

---

## 5. Proposed Implementation Steps (Ordered, Step-by-Step)

Each step ends with “verify and fix bugs before moving on”.

### Phase A: Platform Users & organization limits (no SCADA yet)

**Step A1 – Platform Users: show only Operations Administrators per organization**  
- **Backend:** Add optional (or default) filter to `GET /api/platform/users`: e.g. `role=operations_admin`. Optionally add a dedicated endpoint `GET /api/platform/users/admins` that returns one row per org with org name + list of operations_admin users.  
- **Frontend:** Change Platform Users page to either:  
  - Call the list with `role=operations_admin` only and display “Admins per organization” (e.g. grouped by org), or  
  - Use the new “admins only” endpoint and adjust table/UX (e.g. “Organization | Admin name(s) | Email | …”).  
- **Stats:** Adjust `GET /api/platform/users/stats` if needed (e.g. “total orgs”, “orgs with at least one admin”) so the cards still make sense.  
- **Verify:** Log in as system owner; only Operations Administrators (per org) appear; no leaking of other users’ data; export if any still works as expected.

**Step A2 – User limit per organization (data model + enforcement)**  
- **DB:** Add `user_limit` to `organizations` (nullable integer; NULL = unlimited) **or** store under `organization_settings` (e.g. key `user_limit`). Prefer column for simplicity and reporting.  
- **Backend:**  
  - On `POST /api/users` (and any invite flow): before insert, check `COUNT(users WHERE organization_id = X) < org.user_limit`; if at or over limit, return 403 with a clear message.  
  - Expose `user_limit` and current user count in `GET /api/organizations/:id` (and in org list for platform).  
- **Frontend – Organization Management:** In Settings (or a new “Limits” section), add “Max users” (number input). Show “Current: X / Limit: Y” when editing org.  
- **Frontend – User Management (tenant):** When creating a user, if at limit, show message “User limit reached (X/Y). Contact your administrator.” and disable or hide “Add user”.  
- **Verify:** Set limit 2; create 2 users; 3rd creation fails with clear message; UI shows X/Y; raising limit allows creation again.

**Step A3 – Subscription / onboarding: “Create first user for new company”**  
- **Flow:** When system owner creates a new organization (or in a dedicated “Onboard company” flow), add an optional step: “Create first admin user for this organization” (name, email, temporary password or “send invite”).  
- **Backend:** Either:  
  - Extend `POST /api/organizations` to accept optional `first_user: { username, email, full_name, password }` and create org + user in one transaction, or  
  - New endpoint `POST /api/platform/organizations/:id/first-user` that creates one user with role Operations Administrator for that org (and respects user_limit).  
- **Frontend:** After “Create organization” success, show “Create first admin user” form (or include it in a wizard).  
- **Verify:** Create new org with first user; log in as that user; they see only their org; they can add more users (within limit).

### Phase B: Feature / page access (plan or feature-based gating)

**Step B1 – Define plan/features and which pages they gate**  
- **Define:** List tenant routes that are gated, e.g.:  
  - `/tenant/plant` → feature `plant`  
  - `/tenant/scada` → feature `scada`  
  - `/tenant/inventory` → feature `inventory`  
  - etc.  
- **Data:** Use `organization_features` (feature_code, is_enabled). Optionally add `organizations.subscription_plan` (e.g. starter / professional / enterprise) and a mapping “plan X enables features [a,b,c]” so creating an org sets default features from plan.

**Step B2 – Backend: enforce feature for gated APIs**  
- For each gated API (e.g. plant, scada, reports): at start of handler, get current org from session; load `organization_features` for that org; if required feature is disabled, return 403 with a clear code/message (e.g. “Feature not available for your plan”).  
- **Verify:** Disable “plant” for one org; call plant API as that org → 403.

**Step B3 – Frontend: hide nav and guard routes**  
- **Nav:** When building tenant nav, for each gated page, call an endpoint like `GET /api/organizations/current/features` (or include features in existing “current org” response). Hide link if feature is disabled.  
- **Route guard:** For routes that require a feature (e.g. `/tenant/scada`), add a check: if feature disabled, redirect to dashboard or show a “Not available in your plan” page (user-friendly, with contact support if needed).  
- **Verify:** Disable “plant” for one org; nav no “Plant”; direct URL to `/tenant/plant` shows upgrade/contact message, not plant data.

### Phase C: SCADA (APIs per company + SCADA page, no data leaking)

**Step C1 – Store SCADA config per organization (server-side only)**  
- **DB:** Either new table `organization_scada_config` (organization_id, base_url, auth_type, credentials_encrypted, created_at, updated_at) or `organization_settings` with key `scada` and value { base_url, auth_type, … }. Credentials must be server-side only, never sent to client.  
- **Backend:** Endpoints (system owner or org admin, depending on who you want to edit):  
  - `GET /api/organizations/:id/scada-config` (mask credentials in response).  
  - `PUT /api/organizations/:id/scada-config` (validate URL; store credentials securely).  
- **Verify:** Save config for org A; never returned to client in plain text; only org A’s config returned when editing org A.

**Step C2 – Backend proxy for SCADA data (strict isolation)**  
- **Endpoint:** e.g. `GET /api/tenant/scada/data` (or `/api/scada/data`).  
  - Resolve current user’s `organization_id` from session (tenant context).  
  - Load SCADA config for that org only.  
  - Server-side: call external SCADA API (with org’s credentials); if error, return 502/503 with message, do not leak other org’s config.  
  - Return only the fetched data (no other org’s data ever).  
- **Security:** Validate org on every request; no cross-org; timeouts and rate limits.  
- **Verify:** Org A and B have different configs; as user A you only get A’s data; as user B only B’s; system owner with “selected org” gets only that org’s data if we support that.

**Step C3 – SCADA page (tenant) and feature gating**  
- **Frontend:** New page `Scada.js` under `/tenant/scada`.  
  - Fetches from `GET /api/tenant/scada/data` (or equivalent).  
  - Displays the data (layout depends on what your SCADA API returns: tables, charts, status, etc.).  
- **Feature:** Add feature `scada`; gate this route and the SCADA API behind it (Steps B2–B3).  
- **Verify:** Only orgs with `scada` enabled see the nav and page; page shows only their data; no other org’s data in network or UI.

**Step C4 – SCADA config UI in Organization Management**  
- **Frontend:** Under Organization Settings (or a new “Integrations” / “SCADA” tab), form to set SCADA API URL and auth (e.g. API key field, never echoed).  
- **Access:** System owner only, or org admin if you want companies to set their own SCADA (your choice).  
- **Verify:** System owner can set SCADA for an org; tenant SCADA page then shows data from that config.

### Phase D: Polish and safety

**Step D1 – Audit and UX**  
- Log org creation, first user creation, user_limit changes, SCADA config changes (who, when, org).  
- Clear copy: “User limit reached”, “This page is not included in your plan”, “SCADA not configured”.

**Step D2 – Documentation and README**  
- Update README: Platform Users (admins per org), user limits, SCADA (per-org, proxy, isolation), feature gating, subscription/first-user flow.

---

## 6. Suggested Order of Work and Checks

| Step | What | Check before next |
|------|------|--------------------|
| A1 | Platform Users → only Operations Admins per org | Only admins listed; stats correct; no leak |
| A2 | User limit per org (DB + API + UI) | Limit enforced on create; UI shows X/Y |
| A3 | First user for new company (onboarding) | New org + first admin; can log in and add users |
| B1 | Define gated features and plans | List and mapping agreed |
| B2 | Backend feature check for gated APIs | 403 when feature off |
| B3 | Frontend nav + route guard by feature | Nav and URL access match plan |
| C1 | SCADA config per org (storage + API) | Config stored and editable; credentials safe |
| C2 | SCADA proxy (tenant-only data) | Only current org’s data returned |
| C3 | SCADA page + feature gate | Page shows only own data; gated by feature |
| C4 | SCADA config UI in org management | System owner can set SCADA for each org |
| D1–D2 | Audit, UX, docs | Logs and messages clear; README updated |

---

## 7. Open Decisions for You

1. **Platform Users:** Strict “only Operations Administrators” list (Option A) vs “all users but default filter to admins” (Option B)?  
2. **User limit:** Stored on `organizations.user_limit` (column) vs `organization_settings` (key `user_limit`)?  
3. **Plans:** Do you want an explicit `subscription_plan` (Starter/Professional/Enterprise) that auto-sets features, or only manual feature toggles per org?  
4. **SCADA:** Who edits SCADA config — System Owner only, or also Operations Admin for their own org?  
5. **First user:** Create first user in same “Create organization” flow, or separate “Create first admin” step after org exists?

Once you confirm these and that the steps match what you want, implementation can proceed step-by-step with verification after each step.
