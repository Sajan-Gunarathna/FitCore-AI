# FitCore AI — Architecture Overview

## Multi-Tenant Design

Each gym is a **tenant**. Every resource (members, plans, attendance, …) is
tagged with `gym_id`. The backend enforces isolation at three layers:

1. **Application layer** — every query filters by `gym_id` derived from the
   authenticated user's JWT claims, never from client input.
2. **PostgreSQL Row Level Security** — a fallback policy blocks cross-gym reads
   even if the application layer were bypassed.
3. **Database constraints** — foreign-key `gym_id` references and NOT NULL
   constraints prevent orphaned records.

## Request Lifecycle

```
Client → Supabase Auth (JWT) → FastAPI (JWT verify) → Business Logic → PostgreSQL
```

## Module Map

```
backend/app/
├── api/v1/           REST route handlers
├── core/             Config, security, deps
├── models/           SQLAlchemy ORM models
├── schemas/          Pydantic v2 request/response schemas
├── services/         Business logic (no ORM in routes)
├── repositories/     Data access layer
└── migrations/       Supabase CLI managed (supabase/migrations/)
```
