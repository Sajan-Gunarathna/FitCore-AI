# FitCore AI — REST API Reference (/api/v1)

Base URL: `http://localhost:8000/api/v1`

---

## Authentication & Multi-Tenancy

### Authorization Header
All protected endpoints require an `Authorization` header containing a valid Supabase JWT:

```http
Authorization: Bearer <supabase-jwt-token>
```

### Tenant Identification & Authoritative Resolution
FitCore AI uses an **authoritative tenant resolution strategy**:

1. **Path-Authoritative Routes (`/gyms/{gym_id}/*`):**
   The `{gym_id}` URL path parameter is the single source of truth for the target gym.
2. **Desynchronization Check:**
   If the client also passes an `X-Gym-ID` header and its value does not match `{gym_id}`, the server rejects the request with **HTTP 400 Bad Request**:
   ```json
   {
     "detail": "Tenant desynchronization detected: 'X-Gym-ID' header does not match 'gym_id' URL path parameter."
   }
   ```
3. **Header-Authoritative Routes:**
   For tenant-scoped routes that do not contain a `{gym_id}` URL parameter, provide:
   ```http
   X-Gym-ID: <gym-uuid>
   ```
4. **Membership Verification:**
   The user must possess an active role in `public.gym_user_roles` for the resolved gym. If not, the request fails with **HTTP 403 Forbidden**.

---

## 1. System Health

### `GET /health`
Returns service status, version, and uptime.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "FitCore AI API",
  "version": "0.1.0",
  "uptime_seconds": 12.45
}
```

---

## 2. Authentication & User Profile

### `GET /auth/me`
Retrieve the authenticated user's profile and active gym affiliations.

**Headers:**
`Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "owner@fitcore.ai",
  "full_name": "Alex Mercer",
  "avatar_url": null,
  "is_super_admin": false,
  "created_at": "2026-11-22T08:00:00Z",
  "updated_at": "2026-11-22T08:00:00Z",
  "gyms": [
    {
      "gym_id": "987fcdeb-51a2-43f7-9abc-def012345678",
      "gym_name": "Iron Pulse Downtown",
      "gym_slug": "iron-pulse-downtown",
      "role": "owner",
      "is_active": true
    }
  ]
}
```

---

## 3. Gym Management

### `POST /gyms`
Atomically register a new gym, assign the creator as `owner`, and generate a default `Main` branch.

**Headers:**
`Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Olympus Athletics",
  "slug": "olympus-athletics",
  "description": "High performance strength gym",
  "logo_url": null
}
```

**Response (201 Created):**
```json
{
  "id": "c3b87910-1498-4c32-b7b8-a6d10db90cf5",
  "name": "Olympus Athletics",
  "slug": "olympus-athletics",
  "description": "High performance strength gym",
  "logo_url": null,
  "is_active": true,
  "created_by": "123e4567-e89b-12d3-a456-426614174000",
  "created_at": "2026-11-22T08:05:00Z",
  "updated_at": "2026-11-22T08:05:00Z"
}
```

---

### `GET /gyms`
List all active gyms accessible by the authenticated user.

**Headers:**
`Authorization: Bearer <token>`

**Response (200 OK):**
```json
[
  {
    "id": "c3b87910-1498-4c32-b7b8-a6d10db90cf5",
    "name": "Olympus Athletics",
    "slug": "olympus-athletics",
    "description": "High performance strength gym",
    "logo_url": null,
    "is_active": true,
    "created_by": "123e4567-e89b-12d3-a456-426614174000",
    "created_at": "2026-11-22T08:05:00Z",
    "updated_at": "2026-11-22T08:05:00Z"
  }
]
```

---

### `GET /gyms/{gym_id}`
Retrieve gym details. Requires active membership in the gym.

**Headers:**
- `Authorization: Bearer <token>`
- Optional `X-Gym-ID` must match `{gym_id}` if provided.

**Response (200 OK):**
```json
{
  "id": "c3b87910-1498-4c32-b7b8-a6d10db90cf5",
  "name": "Olympus Athletics",
  "slug": "olympus-athletics",
  "description": "High performance strength gym",
  "logo_url": null,
  "is_active": true,
  "created_by": "123e4567-e89b-12d3-a456-426614174000",
  "created_at": "2026-11-22T08:05:00Z",
  "updated_at": "2026-11-22T08:05:00Z",
  "branches": [
    {
      "id": "456e789a-b012-34cd-ef56-789012345678",
      "gym_id": "c3b87910-1498-4c32-b7b8-a6d10db90cf5",
      "name": "Main",
      "slug": "main",
      "is_main": true,
      "is_active": true,
      "address": null,
      "phone": null,
      "email": null,
      "created_at": "2026-11-22T08:05:00Z",
      "updated_at": "2026-11-22T08:05:00Z"
    }
  ]
}
```

---

## 4. Branch Management

### `POST /gyms/{gym_id}/branches`
Create a additional branch location within a gym. Requires `owner` or `admin` role.

**Headers:**
- `Authorization: Bearer <token>`
- Optional `X-Gym-ID` must match `{gym_id}` if provided.

**Request Body:**
```json
{
  "name": "Northside Studio",
  "slug": "northside-studio",
  "is_main": false,
  "address": "400 Pine Street, Suite 2",
  "phone": "+1-555-0199",
  "email": "northside@olympusathletics.com"
}
```

**Response (201 Created):**
```json
{
  "id": "789a012b-c345-67de-fa89-012345678901",
  "gym_id": "c3b87910-1498-4c32-b7b8-a6d10db90cf5",
  "name": "Northside Studio",
  "slug": "northside-studio",
  "is_main": false,
  "is_active": true,
  "address": "400 Pine Street, Suite 2",
  "phone": "+1-555-0199",
  "email": "northside@olympusathletics.com",
  "created_at": "2026-11-22T08:15:00Z",
  "updated_at": "2026-11-22T08:15:00Z"
}
```

---

### `GET /gyms/{gym_id}/branches`
List all branches belonging to a gym. Requires active membership.

**Headers:**
- `Authorization: Bearer <token>`
- Optional `X-Gym-ID` must match `{gym_id}` if provided.

**Response (200 OK):**
```json
[
  {
    "id": "456e789a-b012-34cd-ef56-789012345678",
    "gym_id": "c3b87910-1498-4c32-b7b8-a6d10db90cf5",
    "name": "Main",
    "slug": "main",
    "is_main": true,
    "is_active": true,
    "address": null,
    "phone": null,
    "email": null,
    "created_at": "2026-11-22T08:05:00Z",
    "updated_at": "2026-11-22T08:05:00Z"
  }
]
```

---

## 5. Role & Staff Management

### `POST /gyms/{gym_id}/roles`
Assign or modify a user's role within a gym.
- `owner`: Only existing gym owners or platform super-admins can assign.
- `admin`: Can assign `trainer` and `member` roles. Cannot promote to `owner` or demote owners.

**Headers:**
- `Authorization: Bearer <token>`
- Optional `X-Gym-ID` must match `{gym_id}` if provided.

**Request Body:**
```json
{
  "user_id": "89012345-6789-01ab-cdef-234567890123",
  "role": "trainer"
}
```

**Response (201 Created):**
```json
{
  "id": "01234567-89ab-cdef-0123-456789abcdef",
  "gym_id": "c3b87910-1498-4c32-b7b8-a6d10db90cf5",
  "user_id": "89012345-6789-01ab-cdef-234567890123",
  "role": "trainer",
  "is_active": true,
  "created_at": "2026-11-22T08:20:00Z",
  "updated_at": "2026-11-22T08:20:00Z"
}
```

---

### `GET /gyms/{gym_id}/users`
List all users and their granted roles in a gym. Requires `owner` or `admin` role.

**Headers:**
- `Authorization: Bearer <token>`
- Optional `X-Gym-ID` must match `{gym_id}` if provided.

**Response (200 OK):**
```json
[
  {
    "id": "01234567-89ab-cdef-0123-456789abcdef",
    "gym_id": "c3b87910-1498-4c32-b7b8-a6d10db90cf5",
    "user_id": "89012345-6789-01ab-cdef-234567890123",
    "role": "trainer",
    "is_active": true,
    "created_at": "2026-11-22T08:20:00Z",
    "updated_at": "2026-11-22T08:20:00Z"
  }
]
```
