# FitCore AI — Architecture Overview

## 1. Multi-Tenant Architectural Pattern

FitCore AI is architected as a commercial **multi-tenant modular monolith**. Every tenant represents a distinct Gym organization, with support for multiple branches/locations per gym.

```
                    ┌─────────────────────────┐
                    │      Next.js Web /      │
                    │   React Native Mobile   │
                    └────────────┬────────────┘
                                 │ Bearer <Supabase JWT>
                                 │ X-Gym-ID: <UUID> (optional / checked vs path)
                                 ▼
                    ┌─────────────────────────┐
                    │     FastAPI Gateway     │
                    │       (/api/v1)         │
                    └────────────┬────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│    Auth Service    │ │    Gym Service     │ │    Role Service    │
│  - Supabase JWKS   │ │  - Atomic creation │ │  - Hierarchy check │
│  - User Profile    │ │  - Main branch     │ │  - Audit logging   │
└──────────┬─────────┘ └─────────┬──────────┘ └─────────┬──────────┘
           │                     │                     │
           └─────────────────────┼─────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    Repository Layer     │
                    │   (SQLAlchemy 2.0)      │
                    └────────────┬────────────┘
                                 │ SET LOCAL app.current_user_id = :user_id
                                 │ SET LOCAL app.current_gym_id = :gym_id
                                 ▼
                    ┌─────────────────────────┐
                    │   PostgreSQL Database   │
                    │ - Composite FK Enforce  │
                    │ - FORCE ROW LEVEL SEC   │
                    └─────────────────────────┘
```

---

## 2. Layered Responsibilities

| Layer | Technology | Primary Responsibilities |
|---|---|---|
| **API Endpoints** | FastAPI, APIRouter | HTTP protocol handling, serialization, schema validation, status codes |
| **Dependencies** | FastAPI Depends | Authentication, token verification, authoritative tenant extraction, role enforcement |
| **Services** | Python Async Classes | Business rules, transactions, atomic operations, audit dispatch |
| **Repositories** | SQLAlchemy 2.0 Core | Database queries, eager-loading (`selectinload`), entity persistence |
| **Models** | SQLAlchemy Mapped | Declarative table definitions, composite foreign keys, cascades |
| **Database** | PostgreSQL / Supabase | Tables, composite FKs, indexes, triggers, Row Level Security (RLS) |

---

## 3. Database Schema Entities & Canonical Migrations

Database migrations are managed canonically via the Supabase CLI:

- `20261122000001_initial_core_schema.sql`: Core 10 tables, indexes, checks, and foreign keys.
- `20261122000002_row_level_security.sql`: Initial RLS policies and helper functions.
- `20261122000003_composite_foreign_keys_and_rls_hardening.sql`: Composite foreign keys, hardened role policies, and FORCE RLS.
- `20261122000004_walk_in_members_and_member_details.sql`: Walk-in member support (`user_id` made nullable), direct member contact columns (`full_name`, `email`, `phone`, `notes`), composite branch foreign key (`fk_member_branch_composite`), and directory search indexes.
- `20261122000005_fix_branch_set_null_and_plan_currency.sql`: Column-specific composite action `ON DELETE SET NULL (branch_id)` on `fk_member_branch_composite` (PostgreSQL 15+), `currency` column on `membership_plans` and `member_subscriptions`, and performance indexes on `(gym_id, end_date)` and `(gym_id, status)`.

### Core Entities:

1. **`users`**: Application user identity mapped 1:1 to Supabase `auth.users(id)`.
2. **`gyms`**: Tenant root entity with unique slug and active status.
3. **`gym_branches`**: Physical/virtual gym locations belonging to a gym (`UNIQUE(gym_id, slug)`).
4. **`gym_user_roles`**: Multi-gym role assignment table (`UNIQUE(gym_id, user_id, role)`).
5. **`members`**: Detailed gym membership profiles (`UNIQUE(gym_id, user_id)`, `UNIQUE(gym_id, id)`).
6. **`trainer_profiles`**: Trainer bio, rates, and specialization tags per gym (`UNIQUE(gym_id, id)`).
7. **`trainer_member_assignments`**: Active coaching relationships between trainers and members with composite FKs `(gym_id, trainer_id)` and `(gym_id, member_id)`.
8. **`membership_plans`**: Subscription packages (`duration_days`, `price`, `billing_frequency`, `UNIQUE(gym_id, id)`).
9. **`member_subscriptions`**: Subscription records with composite FKs `(gym_id, member_id)` and `(gym_id, plan_id)`.
10. **`audit_logs`**: Immutable security event trail (`action`, `entity_type`, `old_values`, `new_values`).

---

## 4. Multi-Tenant Isolation Strategy

Tenant isolation operates with defense-in-depth across 4 layers:

1. **Authoritative Tenant Resolution (FastAPI Dependencies):**
   - For `/gyms/{gym_id}/*` routes, `{gym_id}` path parameter is authoritative.
   - If `X-Gym-ID` header is also provided and differs from path parameter, request is rejected with HTTP 400.
   - `get_tenant_context` checks active role membership in `gym_user_roles` for that gym (HTTP 403 on failure).
2. **Transaction-Scoped Database Context (`SET LOCAL`):**
   - Authenticated user initializes `SET LOCAL app.current_user_id = :user_id`.
   - Verified tenant initializes `SET LOCAL app.current_gym_id = :gym_id`.
   - Context is transaction-scoped and resets automatically on commit/rollback, eliminating pool leakage.
3. **Composite Foreign Keys:**
   - Multi-tenant relationships enforce tenant consistency at the relational engine level.
   - Prevents inserting child records linking trainers, members, or plans from different gyms.
4. **PostgreSQL Row Level Security (RLS) & FORCE RLS:**
   - RLS enabled and forced on all tables.
   - Fail-closed behavior when session tenant context is omitted.

---

## 5. Web Frontend Architecture (Next.js 16)

```
frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/             # Auth route group (login, register, forgot-password, reset-password)
│   │   ├── auth/callback/      # PKCE exchange route with open-redirect guard
│   │   ├── dashboard/          # Protected dashboard with real branch listing & switcher
│   │   ├── onboarding/         # 4-step gym onboarding wizard with partial failure recovery
│   │   ├── globals.css         # Dark design tokens & Tailwind v4
│   │   └── layout.tsx          # Root layout wrapping AuthProvider & GymProvider
│   ├── components/
│   │   ├── gym/                # GymSelector, AddBranchModal
│   │   └── ui/                 # Reusable buttons, inputs, cards, logos
│   ├── context/
│   │   ├── auth-context.tsx    # Supabase session & user profile state
│   │   └── gym-context.tsx     # Multi-gym tenant state & switcher
│   ├── hooks/
│   │   ├── use-auth.ts         # Authentication & profile hook
│   │   └── use-gym.ts          # Active gym context hook
│   ├── lib/
│   │   ├── api/                # FitCoreApiClient & Pydantic v2 TypeScript contracts
│   │   ├── supabase/           # Server, client, and middleware SSR helpers
│   │   └── utils/              # Open-redirect validator (getSafeRedirectUrl)
│   └── middleware.ts           # Next.js route protection proxy
```

### Context & State Boundaries

1. **`AuthProvider`:**
   - Initializes Supabase client and listens to `onAuthStateChange`.
   - On authentication, synchronizes user profile via FastAPI `/api/v1/auth/me`.
   - On sign-out, clears session and evicts `fitcore_active_gym_id` from client storage.
2. **`GymProvider`:**
   - Tracks `accessibleGyms`, `activeGym`, `activeGymId`, and `currentRole`.
   - Reads preference from `localStorage.getItem("fitcore_active_gym_id")`.
   - Validates stored ID against `accessibleGyms`; falls back to first gym if invalid or not found.
   - `switchGym(gymId)`: updates tenant state, persists preference, and clears tenant-specific component caches.
3. **`FitCoreApiClient`:**
   - Single point of communication with backend REST API (`/api/v1`).
   - Automatically attaches Supabase Bearer token and `X-Gym-ID` tenant header.
   - Enforces client-side header/path tenant alignment.

---

## 6. Dashboard Analytics Subsystem & Race-Condition Guard

### Aggregation Architecture
The dashboard summary is calculated in `DashboardService` via server-side SQL aggregations without loading entire table datasets into application memory:
- **`total_members`**: `COUNT(members.id) WHERE gym_id = :gym_id`
- **`active_members`**: `COUNT(members.id) WHERE gym_id = :gym_id AND status = 'active'`
- **`active_subscriptions`**: `COUNT(member_subscriptions.id) WHERE gym_id = :gym_id AND status = 'active' AND end_date >= CURRENT_DATE`
- **`expiring_subscriptions`**: Subscriptions with `status = 'active'` and `end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7 days`
- **`total_trainers`**: Active coaches (`TrainerProfile.is_active = TRUE`)
- **`total_branches`**: Active physical facilities (`GymBranch.is_active = TRUE`)
- **`recent_members`**: Top 5 newest members ordered by `joined_at DESC`
- **`upcoming_expirations`**: Top 5 nearest expirations in the next 14 days ordered by `end_date ASC`
- **`registration_trend`**: 6-month monthly acquisition trend
- **`status_distribution`**: Members grouped by `status`
- **`branches`**: Facilities with aggregated member counts via `LEFT JOIN members`

### Client-Side Out-of-Order & Stale Data Prevention
To prevent race conditions during rapid tenant switching (e.g. user selects Gym A, then immediately switches to Gym B while Gym A's HTTP request is still in flight):
1. **`AbortController`:** Each new gym switch aborts the inflight `fetch` request via `AbortController.abort()`.
2. **Request Generation Counter (`requestIdRef`):** Every outgoing request increments a local sequence counter (`currentRequestId = ++requestIdRef.current`).
3. **Active Gym Guard (`activeGymIdRef`):** Before setting component state, the callback asserts:
   ```typescript
   if (currentRequestId !== requestIdRef.current || gymId !== activeGymIdRef.current) return;
   ```
4. **Immediate State Reset:** When `switchGym(id)` is triggered, `summary` state is immediately cleared to `null` so Gym A metrics are never shown while Gym B is loading.
