# FitCore AI

> **Commercial SaaS** · Multi-tenant Gym Management & AI-Powered Fitness Platform

---

## Repository Structure

```
FitCore-AI/
├── backend/          # FastAPI + SQLAlchemy 2.0 async REST API
├── frontend/         # Next.js 15 + TypeScript + Tailwind CSS
├── mobile/           # React Native + Expo
├── supabase/         # Supabase CLI project (migrations, seed)
├── docs/             # Architecture & API documentation
└── README.md
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 20+ |
| pnpm | 9+ |
| Supabase CLI | latest |
| PostgreSQL | 15+ (via Supabase) |

---

## Quick Start

### 1. Clone & configure secrets

```bash
git clone <repo-url>
cd FitCore-AI

# Backend secrets
cp backend/.env.example backend/.env
# → Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, DATABASE_URL

# Frontend secrets
cp frontend/.env.example frontend/.env.local
# → Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL
```

### 2. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
# Windows:   .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs → http://localhost:8000/docs  
Health check → http://localhost:8000/api/v1/health

### 3. Frontend (Next.js)

```bash
cd frontend
pnpm install
pnpm dev
```

App → http://localhost:3000

### 4. Mobile (Expo)

```bash
cd mobile
pnpm install
pnpm start
```

### 5. Database Migrations (Supabase CLI)

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

---

## Development Phases

| Phase | Scope | Status |
|-------|-------|--------|
| **0** | Project foundation, monorepo, health-check API | ✅ Complete |
| **1** | Auth, multi-tenant core, roles, members, plans | 🔜 |
| **2** | Web application UI | 🔜 |
| **3** | AI fitness features | 🔜 |

---

## Architecture

- **Multi-tenant modular monolith** — tenant isolation via `gym_id`
- **REST API** versioned at `/api/v1`
- **Supabase Auth** — JWT verification on every request
- **PostgreSQL Row Level Security** for hard tenant isolation
- **Supabase CLI migrations** as the canonical DB migration tool

---

## Security Notes

- Never commit `.env` files
- Never expose the Supabase service-role key to the frontend
- All gym-scoped records are isolated by `gym_id`
- JWT signature, expiry, issuer and audience are validated server-side

---

## License

Proprietary — All rights reserved.
