# FitCore AI — Security & Multi-Tenant Model

## 1. Threat Model & Tenancy Guarantees

In FitCore AI, all gym-owned resources are segmented by `gym_id`. The application enforces strict tenant boundaries through a layered defense-in-depth model:

```
┌────────────────────────────────────────────────────────┐
│ 1. Token Verification: Supabase JWKS / HMAC            │
│    - Signature verification (RS256 / HS256)            │
│    - Expiration & Audience verification (authenticated)│
│    - Issuer validation                                 │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 2. Authoritative Tenant Resolution & Membership Auth   │
│    - Path parameter authoritative on /gyms/{gym_id}/*  │
│    - Header vs Path mismatch rejected (HTTP 400)       │
│    - Active role membership check in gym_user_roles    │
│    - Role hierarchy validation (Owner > Admin > Staff) │
│    - Rejection of unauthorized tenant access (HTTP 403)│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 3. Transaction-Scoped Isolation (SET LOCAL)            │
│    - SET LOCAL app.current_user_id = :user_id          │
│    - SET LOCAL app.current_gym_id = :gym_id            │
│    - Independent context setting without clobbering    │
│    - Automatic reset on transaction commit/rollback    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 4. Composite Foreign Keys & Engine RLS                 │
│    - Engine-level cross-tenant FK blocking             │
│    - (gym_id, id) composite foreign keys on children   │
│    - FORCE ROW LEVEL SECURITY on all 10 tables         │
│    - Fail-closed if tenant context is missing          │
└────────────────────────────────────────────────────────┘
```

---

## 2. Authoritative Tenant Resolution Strategy (P0 Prevention)

To eliminate Header/Path Tenant Desynchronization vulnerabilities:

1. **Path-Authoritative Routes:** When an endpoint contains a `{gym_id}` URL path parameter, that parameter is the single source of truth for tenancy.
2. **Desynchronization Detection:** If both the `{gym_id}` path parameter and the `X-Gym-ID` header are present in the request:
   - The dependency checks case-insensitive equality.
   - If they differ, the request is immediately aborted with **HTTP 400 Bad Request**.
3. **Header Fallback:** For tenant-scoped routes lacking a `{gym_id}` path parameter (e.g. general listing endpoints), the `X-Gym-ID` header is used.
4. **Consistent Endpoint Consumption:** All downstream endpoint handlers receive the validated `TenantContext` containing `tenant.gym_id` and `tenant.user` rather than re-reading raw header or path parameters.

### Example: Header / Path Desynchronization Attempt

If an administrator of Gym A attempts to perform operations against Gym B's path while providing Gym A in `X-Gym-ID`:

```bash
curl -X POST "http://localhost:8000/api/v1/gyms/22222222-2222-2222-2222-222222222222/branches" \
  -H "Authorization: Bearer <gym_a_admin_token>" \
  -H "X-Gym-ID: 11111111-1111-1111-1111-111111111111" \
  -H "Content-Type: application/json" \
  -d '{"name": "Malicious Branch", "slug": "malicious-branch"}'
```

**Response (HTTP 400 Bad Request):**
```json
{
  "detail": "Tenant desynchronization detected: 'X-Gym-ID' header does not match 'gym_id' URL path parameter."
}
```

If the attacker omits the header and attempts to target Gym B directly:
```bash
curl -X POST "http://localhost:8000/api/v1/gyms/22222222-2222-2222-2222-222222222222/branches" \
  -H "Authorization: Bearer <gym_a_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Malicious Branch", "slug": "malicious-branch"}'
```

**Response (HTTP 403 Forbidden):**
```json
{
  "detail": "Access forbidden: you do not have active membership in this gym."
}
```

---

## 3. Transaction-Scoped Context Management

`backend/app/core/database.py` manages PostgreSQL session context via `SET LOCAL`:

- **User Context:** `get_current_user` executes `SET LOCAL app.current_user_id = :user_id` as soon as the JWT is validated.
- **Tenant Context:** `get_tenant_context` executes `SET LOCAL app.current_gym_id = :gym_id` once gym membership is verified.
- **Independent Setting:** Setting `user_id` does not overwrite or clear `gym_id`, and setting `gym_id` does not overwrite or clear `user_id`.
- **Pool Safety:** `SET LOCAL` is bound to the lifespan of the current transaction. When the connection returns to the connection pool (on commit or rollback), all `app.*` session variables are automatically erased by PostgreSQL, preventing cross-tenant leakage.

---

## 4. Composite Foreign Keys for Tenant-Owned Relationships

To prevent relational cross-tenant contamination (e.g., assigning a trainer from Gym A to a member from Gym B):

1. **Unique Constraints on Parents:**
   - `members`: `UNIQUE(gym_id, id)`
   - `trainer_profiles`: `UNIQUE(gym_id, id)`
   - `membership_plans`: `UNIQUE(gym_id, id)`
2. **Composite Foreign Keys on Children:**
   - `trainer_member_assignments`:
     - `FOREIGN KEY (gym_id, trainer_id) REFERENCES trainer_profiles(gym_id, id) ON DELETE CASCADE`
     - `FOREIGN KEY (gym_id, member_id) REFERENCES members(gym_id, id) ON DELETE CASCADE`
   - `member_subscriptions`:
     - `FOREIGN KEY (gym_id, member_id) REFERENCES members(gym_id, id) ON DELETE CASCADE`
     - `FOREIGN KEY (gym_id, plan_id) REFERENCES membership_plans(gym_id, id) ON DELETE RESTRICT`

Any attempt to associate records belonging to different gyms fails at the PostgreSQL engine level with a foreign key constraint violation (`IntegrityError`).

---

## 5. Row Level Security & Privilege Boundaries

### Hardened RLS Policies (Migration 000003)
- **Role Escalation Protection:** Non-owner administrators cannot create or update any record in `gym_user_roles` with `role = 'owner'`.
- **Owner Role Invariant:** An owner role can only be granted by an existing owner of that gym or a platform super-admin (`public.is_gym_owner(gym_id)`).
- **FORCE ROW LEVEL SECURITY:** Configured on all 10 core tables:
  `ALTER TABLE <table_name> FORCE ROW LEVEL SECURITY;`

### Database Privileges: `postgres` Superuser vs Application Roles
- **Default Supabase Connection:** Connecting via the default Supabase `postgres` user connects as a PostgreSQL superuser which possesses `BYPASSRLS` privileges by default.
- **Primary Defense:** Because superusers bypass RLS, **FastAPI application-level authorization in `deps.py` (`get_tenant_context`) serves as the primary and mandatory security boundary**.
- **Defense in Depth:** RLS provides secondary defense-in-depth for direct PostgREST or Supabase client connections (using `anon` or `authenticated` roles) and when connecting via unprivileged backend application roles.
- **Production Recommendation:** For production deployments, create a dedicated unprivileged role (e.g. `fitcore_app`) without `SUPERUSER` or `BYPASSRLS`:
  ```sql
  CREATE ROLE fitcore_app WITH LOGIN PASSWORD 'strong_password';
  GRANT CONNECT ON DATABASE postgres TO fitcore_app;
  GRANT USAGE ON SCHEMA public TO fitcore_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fitcore_app;
  ```

---

## 6. Supabase JWT Authentication

### Asymmetric JWKS (Primary)
- Public keys fetched from `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`.
- Cached in-memory with TTL (`JWKS_CACHE_TTL_SECONDS=3600`).
- Unrecognized Key ID (`kid`) triggers an immediate cache refresh before rejection.

### Symmetric Verification (Fallback)
- Supported when `SUPABASE_JWT_SECRET` is configured for local or legacy installations.
- Algorithm restricted strictly to `HS256`.

---

## 7. Frontend Security Controls (Phase 2)

### Open-Redirect Mitigation (`getSafeRedirectUrl`)
- All redirect query parameters (e.g. `?next=/dashboard`) in authentication callbacks (`/auth/callback`, `/login`) are sanitized via `frontend/src/lib/utils/redirect.ts`.
- Relative internal paths only: must begin with `/` and reject protocol-relative `//` or scheme-prefixed destinations.
- Defaults safely to `/dashboard`.

### Client-Side Tenant Storage & Tamper Resistance
- The active tenant is stored in browser `localStorage` under `fitcore_active_gym_id`.
- On load, `GymProvider` validates the stored ID against the server-verified `accessibleGyms` list.
- If a user tampers with the stored ID or attempts to inject another tenant's UUID, `GymProvider` automatically ignores the tampered value and safely falls back to the user's first legitimate gym or `null`.
- On sign-out, `localStorage.removeItem("fitcore_active_gym_id")` and local session states are completely purged.

### Client-Side P0 Desynchronization Guard
- `FitCoreApiClient` intercepts requests targeting path-scoped gym endpoints (e.g. `/gyms/{gym_id}/*`).
- It automatically verifies and synchronizes the outgoing `X-Gym-ID` header with `{gym_id}`.
- Prevents accidental or malformed client calls from triggering backend 400 Bad Request desync rejections.

---

## 8. Dashboard RBAC & Tenancy Verification (Milestone 2.3)

### Executive Dashboard Role Enforcement
- The executive analytics dashboard endpoint (`/gyms/{gym_id}/dashboard/summary`) is protected by `RequireGymAdmin`.
- **Allowed Roles:** Gym Owner, Gym Administrator, Platform Super-Admin.
- **Denied Roles:** Trainer, Member, Unassigned Users. Denied with **HTTP 403 Forbidden**.
- **Frontend Role Presentation:** The frontend conditionally renders the executive analytics view only for Owners and Administrators. Members and Trainers are presented with an explanatory role notice stating their current membership level without exposing tenant financial or executive metrics.

### Stale Tenant Data Elimination
- Switching gyms aborts the active HTTP fetch request via `AbortController`.
- Local generation tokens discard delayed responses from previously selected gyms.
- State is cleared to `null` on tenant change, preventing Gym A's cached metrics from rendering under Gym B.

### Known Environmental Limitations
- **Live Supabase Auth Cloud Testing:** In offline or local development environments lacking external internet connectivity or production Supabase project credentials, authentication testing relies on the asymmetric/symmetric test token fixture (`make_jwt()`) and mocked Supabase client tokens. Full live OAuth/PKCE roundtrips to remote Supabase instances require valid remote credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).


---

## 7. Member Data Security & Role-Based Access Control (Milestone 2.4)

### Walk-in Member Security & RLS Defense
In real-world gym operations, front-desk staff register walk-in members who do not yet have an online Supabase Auth account. FitCore AI accommodates this securely without weakening tenant boundaries:

1. **Nullable `user_id` on `members`:** The `members.user_id` foreign key is nullable, allowing enrollment before account creation.
2. **PostgreSQL RLS Safety:**
   - The RLS policy `members_select` verifies `user_id = current_app_user_id()`. When `user_id IS NULL`, this evaluates to false/null, meaning walk-in members can never be queried or impersonated by unprivileged authenticated users.
   - Gym staff (owners, admins, assigned trainers) access member records through the security definer function `user_has_gym_role(gym_id, 'owner', 'admin')`.
3. **Composite Branch Integrity (`fk_member_branch_composite`):**
   - Enforces `(gym_id, branch_id) REFERENCES gym_branches(gym_id, id) ON DELETE SET NULL`.
   - Rejects any attempt to assign a member in Gym A to a branch belonging to Gym B at the relational engine level.
4. **Trainer Data Scoping:**
   - Trainers query the member directory via `MemberService.list_members`, which looks up `trainer_member_assignments` for `trainer_id == trainer_profile.id` and restricts the query to assigned member IDs only.
   - Direct member profile requests (`GET /api/v1/gyms/{gym_id}/members/{member_id}`) by a trainer verify assignment and fail closed with **HTTP 403 Forbidden** if the member is not assigned to that trainer.
5. **Member Self-Access Scoping:**
   - A caller with only the `member` role is restricted to viewing only their own record (`member.user_id == current_user.id`). Any attempt to query another member's profile returns **HTTP 403 Forbidden**.

---

## 8. Membership Plans & Subscription Security (Milestone 2.5)

### Composite Foreign Key Constraints on Subscriptions
Member subscriptions reference both the member and the plan with composite foreign keys:
1. `(gym_id, member_id) REFERENCES members(gym_id, id) ON DELETE CASCADE` (`fk_subscription_member_composite`)
2. `(gym_id, plan_id) REFERENCES membership_plans(gym_id, id) ON DELETE RESTRICT` (`fk_subscription_plan_composite`)

This guarantees that:
- A subscription cannot link a member from Gym A to a membership plan from Gym B at the PostgreSQL relational engine level.
- Deleting a plan that has active subscriptions is rejected by relational constraint (`RESTRICT`), protecting audit trails and billing histories.

### Column-Specific Composite `ON DELETE SET NULL (branch_id)`
In PostgreSQL 15+, the composite foreign key on `members` uses column-specific actions:
```sql
CONSTRAINT fk_member_branch_composite
FOREIGN KEY (gym_id, branch_id)
REFERENCES public.gym_branches(gym_id, id)
ON DELETE SET NULL (branch_id);
```
When a branch location is deleted or closed:
- `branch_id` is automatically set to `NULL`.
- `gym_id` remains unchanged and non-null, preventing foreign key cascade violations and preserving member tenancy and records.

### Separation of Billing, Pricing, and Subscriptions
In accordance with commercial SaaS boundary requirements:
1. **Plan Pricing vs Subscription Billing:** Contracted subscription terms (`price_paid`, `currency`, `start_date`, `end_date`) are snapshotted in `member_subscriptions`. Subsequent edits to `membership_plans` (such as price increases) never retroactively alter existing active subscriptions.
2. **Payment Gateway Boundary:** FitCore AI enforces subscription access state and period validity independently of payment gateways. External payment processors (Stripe, PayHere) are kept outside subscription state transitions to prevent fake verification vulnerabilities.
3. **Overlapping Active Subscriptions Guard:** The subscription service prevents multiple overlapping active subscriptions for the same member, eliminating duplicate billing or ambiguous entitlement periods.
4. **Audit Logging:** Every plan creation, plan update, plan status change, subscription assignment, renewal, and cancellation is captured in `audit_logs` with before/after deltas, actor user ID, client IP, and user agent.
