# SaaS implementation verification

**Date:** Verification pass  
**Scope:** User limit, subscription plan (manual), Platform Users default filter, first user in create-org flow, feature gating.

---

## 1. User limit (organization_settings)

| Check | Status |
|-------|--------|
| Stored in `organization_settings` with key `user_limit` (number or null) | OK |
| Backend: POST `/api/users` reads limit, compares to current count, returns 403 with clear message when at limit | OK |
| Backend: `user_limit` parsed correctly (number from JSONB; `parseInt` fallback for string) | OK |
| GET `/api/organizations` and GET `/api/organizations/:id` include `user_limit` | OK |
| GET `/api/organizations/current/limits` returns `user_count` and `user_limit` for tenant | OK |
| Organization Settings UI: Subscription plan + User limit fields, saved via settings PUT | OK |
| Organization list: shows Plan and "Users X / Y" | OK |
| Tenant User Management: loads `/organizations/current/limits`, shows "Users X / Y", disables Add User when at limit | OK |

**Edge case:** If `user_limit` is set to 0, it is treated as “no limit” (condition is `userLimit > 0`). To enforce “zero users” you’d need an explicit rule; current behaviour is “no limit” when 0 or null.

---

## 2. Subscription plan (manual)

| Check | Status |
|-------|--------|
| Stored in `organization_settings` with key `subscription_plan` (string, manual) | OK |
| No automatic tier logic; plan label is for display/agreement only | OK |
| Organization list and org detail show subscription_plan | OK |
| Organization Settings: "Subscription plan" text field, saved with other settings | OK |

---

## 3. Platform Users default filter

| Check | Status |
|-------|--------|
| Default filter is `role: 'operations_admin'` | OK |
| User can change to "All roles" or other filters | OK |
| API supports `role` query param; list and stats work with filter | OK |

---

## 4. Create first user in Create organization flow

| Check | Status |
|-------|--------|
| Backend: POST `/api/organizations` accepts optional `first_user: { username, email, full_name, password? }` | OK |
| Backend: Creates org, then creates user with role `operations_admin`, `organization_id` = new org | OK |
| Backend: Validates first_user (username, email, full_name required; password min 6 if provided) | OK |
| Backend: RBAC: inserts into `user_roles` when roles table exists | OK |
| Frontend: Create-org form has "First admin user (optional)" section (username, email, full name, password) | OK |
| Frontend: On submit (create only), sends `first_user` in body when all of username, email, full name are filled | OK |
| Frontend: Edit org does not send `first_user`; cancel resets firstUser state | OK |
| First user is not blocked by user_limit (org is new; limit is typically set later in Settings) | OK |

---

## 5. Feature gating

| Check | Status |
|-------|--------|
| Backend: GET `/api/organizations/current/features` returns `{ features: { plant, inventory, calendar, cm_letters, templates, users } }` | OK |
| Backend: No org context → returns `{ features: {} }`; frontend treats missing as “enabled” | OK |
| Backend: Features default to `true` when no row in `organization_features` (backward compatible) | OK |
| Backend: `requireFeature(pool, code)` middleware on plant, inventory, calendar, cm_letters, templates, users routes | OK |
| Backend: When feature disabled, API returns 403 with code `FEATURE_DISABLED` | OK |
| Backend: `isFeatureEnabled` / `getOrganizationFeature`: no row → enabled; error → enabled (safe default) | OK |
| Frontend: `OrganizationFeaturesProvider` fetches `/organizations/current/features`, exposes `hasFeature(code)` | OK |
| Frontend: `hasFeature` returns `true` when loading (no nav flash); `false` only when `features[code] === false` | OK |
| Frontend: Routes wrapped with `<FeatureGate feature="…">`: plant, inventory, calendar, cm_letters, templates, users | OK |
| Frontend: FeatureGate shows "Feature not available" and link to dashboard when feature disabled | OK |
| Frontend: Nav links for Templates, CM Letters, Inventory, Calendar, Plant, Users only shown when `hasFeature(code)` | OK |
| Route order: GET `/current/features` is a two-segment route; GET `/:id` is one segment; no conflict | OK |

**Optional hardening:** If `organization_features.is_enabled` is ever NULL, it is currently treated as disabled. To treat “no row” and NULL as enabled, you could use `row.is_enabled !== false` in `getOrganizationFeature`. Current behaviour is acceptable.

---

## 6. Summary

- **User limit:** Enforced on user create; UI shows limits and disables add when at limit; subscription plan is manual and used for display/agreement.
- **Platform Users:** Default filter is Operations Administrator; behaviour and API are consistent.
- **First user in create org:** Backend and frontend create org + optional first admin in one flow; first user is not blocked by user_limit.
- **Feature gating:** Backend middleware and frontend nav/route guards are aligned; defaults are “enabled” when no feature row.

No bugs found in the verified paths. One optional improvement: treat NULL `is_enabled` as enabled in `getOrganizationFeature` if you want that semantics.
