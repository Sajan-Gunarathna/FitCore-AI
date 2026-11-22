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
│   └── tests/        # 83 unit/regression tests + PostgreSQL integration tests
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
- `supabase/migrations/20261122000004_walk_in_members_and_member_details.sql` (Walk-in members, member contact columns, composite branch FK, search indexes)

### 3. Backend (FastAPI)

```bash
cd backend

# Create & activate virtual environment
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# Linux / macOS:     source .venv/bin/activate

pip install -r requirements.txt

# Run unit and regression test suite (63 passing tests)
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

# Install dependencies
npm install

# Run ESLint validation
npm run lint

# Run automated frontend unit & race-condition tests
npm test

# Build production bundle
npm run build

# Run frontend development server
npm run dev
```

- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **Onboarding Wizard:** [http://localhost:3000/onboarding](http://localhost:3000/onboarding)
- **Tenant Dashboard:** [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

---

## Implemented Milestones

### Phase 1: Core Multi-Tenant Backend (Completed)
- 10 core tables with UUID primary keys and composite foreign keys
- Row Level Security (RLS) with `FORCE ROW LEVEL SECURITY`
- Supabase Auth JWKS signature & claim verification
- Authoritative tenant resolution preventing Header/Path desynchronization (P0 fix)
- 36 passing unit, regression, and PostgreSQL integration tests

### Phase 2: Gym Management Web Application
- **Milestone 2.1 — Authentication & Foundation (Completed):**
  - Supabase SSR cookie session handling (`@supabase/ssr`)
  - Protected routes via Next.js proxy middleware (`/dashboard`, `/onboarding`)
  - Open redirect mitigation and secure sign-out cache eviction
  - Dark UI design system tokens (#090D12, #121922, #1A232D, #B8FF3B)
- **Milestone 2.2 — Multi-Gym & Onboarding (Completed):**
  - Tenant-Aware API Client (`FitCoreApiClient`) with automatic JWT and `X-Gym-ID` injection
  - Header/path synchronization protection at the client layer
  - Active Gym Context & Provider (`GymProvider`, `useGym`)
  - Multi-Gym Selector dropdown component (`GymSelector`)
  - 4-Step Gym Onboarding Wizard (`/onboarding`) with partial failure recovery
  - Real branch listing & "Add Branch" modal on `/dashboard`
- **Milestone 2.3 — Premium Gym Owner Dashboard & Real Analytics (Completed):**
  - Fast, secure aggregation endpoint `GET /api/v1/gyms/{gym_id}/dashboard/summary` (Requires Owner/Admin)
  - Real database analytics: total/active members, active subscriptions, 7-day expirations, trainers, and branch counts
  - Visual charts: 6-month member registration trend and status breakdown
  - Recent members table & upcoming expirations list with days-remaining countdown
  - Race condition & out-of-order response prevention via `AbortController` and request generation tracking
- **Milestone 2.4 — Member Management & Registration (Completed):**
  - Full member data model supporting walk-in members (nullable `user_id`) and user-linked accounts
  - Automatic collision-safe member code generation (`MEM-XXXXXX`)
  - Paginated member directory with multi-field search and branch/status filtering
  - Role-based scoping: Owners/Admins see all members; Trainers see assigned members; Members see own profile
  - Member registration and profile update forms with optimistic UI updates and audit logging
  - Forward migration `20261122000004` and PostgreSQL composite branch integrity (`fk_member_branch_composite`)
- **Milestone 2.5 — Membership Plans & Subscription Management (Completed):**
  - Forward migration `20261122000005`: PostgreSQL 15+ composite action `ON DELETE SET NULL (branch_id)` on `fk_member_branch_composite`, `currency` column on plans and subscriptions, and performance indexes
  - Full Membership Plans API (`/membership-plans`) with Decimal pricing, duration, billing frequency, and active toggle
  - Full Subscriptions API (`/subscriptions`) with assign, renew, and cancel endpoints
  - Contracted pricing and term immutability: plan price updates never affect existing active subscriptions
  - Renewal semantics: active subscriptions extend after current end date; expired subscriptions start today
  - Prevention of overlapping active subscriptions for the same member
  - Frontend `/dashboard/membership-plans` and `/dashboard/subscriptions` pages with dark theme & `#B8FF3B` accents
  - Integrated active subscription details, days remaining countdown, and quick actions on `/dashboard/members/[id]`
  - 83 passing backend unit/integration tests and 8 passing frontend tests

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
