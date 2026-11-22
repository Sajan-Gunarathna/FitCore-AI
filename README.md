# FitCore AI

> **Commercial SaaS** · Multi-tenant Gym Management & AI-Powered Fitness Platform

---

## Repository Structure

```
FitCore-AI/
├── backend/          # FastAPI + SQLAlchemy 2.0 async REST API
│   ├── app/
│   │   ├── api/v1/   # REST route handlers (auth, gyms, health)
│   │   ├── core/     # Config, async DB, Supabase JWKS security, deps
│   │   ├── models/   # SQLAlchemy 2.0 ORM models (10 core entities)
│   │   ├── schemas/  # Pydantic v2 validation & response schemas
│   │   ├── services/ # Business logic & transactional operations
│   │   └── repositories/ # Data access layer with eager-loading
│   └── tests/        # 27 unit/regression tests + PostgreSQL integration tests
├── frontend/         # Next.js 16 + TypeScript + Tailwind CSS v4
├── mobile/           # React Native + Expo 52
├── supabase/         # Supabase CLI project (canonical migrations & RLS)
│   └── migrations/   # SQL DDL, composite FKs, & Row Level Security policies
├── docs/             # Architecture, API, & Security documentation
└── README.md
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ (tested on Python 3.14.2) |
| Node.js | 20+ |
| pnpm / npm | latest |
| Supabase CLI | latest |
| PostgreSQL | 15+ (via Supabase) |

---

## Quick Start

### 1. Configure Secrets

```bash
# Backend secrets
cp backend/.env.example backend/.env
# Fill in: DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET

# Frontend secrets
cp frontend/.env.example frontend/.env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL
```

### 2. Database Migrations (Supabase CLI)

Supabase CLI is the **canonical migration system**:

```bash
# Push migrations to Supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Migration files:
- `supabase/migrations/20261122000001_initial_core_schema.sql` (10 core tables, indexes, checks)
- `supabase/migrations/20261122000002_row_level_security.sql` (RLS policies & security functions)
- `supabase/migrations/20261122000003_composite_foreign_keys_and_rls_hardening.sql` (Composite FKs, role policies, and FORCE RLS)

### 3. Backend (FastAPI)

```bash
cd backend

# Create & activate virtual environment
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# Linux / macOS:     source .venv/bin/activate

pip install -r requirements.txt

# Run unit and regression test suite (27 passing tests)
python -m pytest tests/ -v

# Run live PostgreSQL integration tests (requires TEST_DATABASE_URL)
TEST_DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/postgres" python -m pytest -m integration

# Run backend development server
python -m uvicorn app.main:app --reload --port 8000
```

- **Interactive API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### 4. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

---

## Multi-Tenant Security Highlights

1. **Authoritative Tenant Resolution:** For routes with `/gyms/{gym_id}/*`, the URL parameter is authoritative. A mismatched `X-Gym-ID` header triggers an automatic **HTTP 400 Bad Request**.
2. **Transaction-Scoped Isolation:** Session context (`SET LOCAL app.current_user_id` and `SET LOCAL app.current_gym_id`) is set independently without clobbering, automatically reverting on transaction end.
3. **Composite Foreign Keys:** Relationships between multi-tenant child tables (`trainer_member_assignments`, `member_subscriptions`) enforce tenant integrity at the relational engine level.
4. **Hardened RLS Policies:** Non-owner administrators cannot assign or promote users to the `owner` role.
5. **Superuser Awareness:** The default Supabase `postgres` user bypasses RLS; FastAPI application authorization is the primary defense, while RLS protects direct client roles (`anon`, `authenticated`) and unprivileged DB connections.
