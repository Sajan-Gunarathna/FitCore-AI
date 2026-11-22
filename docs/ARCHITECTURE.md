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
