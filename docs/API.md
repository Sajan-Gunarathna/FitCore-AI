# FitCore AI — API Reference

Base URL: `http://localhost:8000/api/v1`

## Authentication

All protected endpoints require a Bearer JWT from Supabase Auth:

```
Authorization: Bearer <supabase-jwt>
```

## Endpoints

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Service health check |

---

_Phase 1 endpoints (auth, gyms, members, …) will be documented here._
