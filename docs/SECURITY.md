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
