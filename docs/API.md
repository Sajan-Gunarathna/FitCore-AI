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

## Client-Side API Integration (`FitCoreApiClient`)

The frontend application provides a typed, tenant-aware HTTP client (`frontend/src/lib/api/client.ts`) that automatically handles:
- **Supabase JWT Attachment:** Resolves active bearer token via `supabase.auth.getSession()` and injects `Authorization: Bearer <token>`.
- **Tenant Context Injection:** Automatically injects `X-Gym-ID: <activeGymId>` for tenant operations.
- **Client-Side Desynchronization Guard:** Checks if the target path contains `/gyms/{gym_id}`. When present, it guarantees `X-Gym-ID` strictly matches the path's `gym_id`, eliminating P0 header/path desync before the request leaves the browser.
- **Typed Methods:**
  - `apiClient.auth.getProfile()` &rarr; `UserProfileResponse`
  - `apiClient.gyms.list()` &rarr; `GymRead[]`
  - `apiClient.gyms.create(data)` &rarr; `GymDetailRead`
  - `apiClient.gyms.get(gymId)` &rarr; `GymDetailRead`
  - `apiClient.branches.list(gymId)` &rarr; `BranchRead[]`
  - `apiClient.branches.create(gymId, data)` &rarr; `BranchRead`
  - `apiClient.roles.list(gymId)` &rarr; `GymUserRoleRead[]`
  - `apiClient.roles.assign(gymId, data)` &rarr; `GymUserRoleRead`

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

### `GET /gyms/{gym_id}/dashboard/summary`
Retrieve real aggregated KPI metrics, member acquisition trend, status distribution, recent members, upcoming expirations, and branch distribution for the executive dashboard.

**Authorization & Permissions:**
- Requires authenticated user.
- **Role Enforcement:** Strictly requires **Gym Owner** or **Gym Admin** role (or platform super-admin). Rejects `trainer` and `member` roles with **HTTP 403 Forbidden**.
- **Tenant Isolation:** Enforces authoritative tenant resolution. If `X-Gym-ID` header is passed, it must match `{gym_id}` or request is rejected with **HTTP 400 Bad Request**.

**Headers:**
- `Authorization: Bearer <token>`
- Optional `X-Gym-ID: <gym_id>` (must match URL parameter)

**Response (200 OK):**
```json
{
  "gym_id": "c3b87910-1498-4c32-b7b8-a6d10db90cf5",
  "gym_name": "Olympus Athletics",
  "kpis": {
    "total_members": 128,
    "active_members": 114,
    "active_subscriptions": 110,
    "expiring_subscriptions": 8,
    "total_trainers": 6,
    "total_branches": 2
  },
  "recent_members": [
    {
      "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "member_code": "MEM-00128",
      "full_name": "Elena Rostova",
      "email": "elena@example.com",
      "status": "active",
      "joined_at": "2026-11-22T10:15:00Z"
    }
  ],
  "upcoming_expirations": [
    {
      "id": "b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e",
      "member_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "member_code": "MEM-00128",
      "full_name": "Elena Rostova",
      "email": "elena@example.com",
      "plan_name": "Gold All-Access",
      "end_date": "2026-11-26",
      "status": "active"
    }
  ],
  "registration_trend": [
    { "period": "Jun 2026", "count": 18 },
    { "period": "Jul 2026", "count": 22 },
    { "period": "Aug 2026", "count": 19 },
    { "period": "Sep 2026", "count": 25 },
    { "period": "Oct 2026", "count": 20 },
    { "period": "Nov 2026", "count": 24 }
  ],
  "status_distribution": [
    { "status": "active", "count": 114 },
    { "status": "inactive", "count": 8 },
    { "status": "pending", "count": 4 },
    { "status": "suspended", "count": 2 }
  ],
  "branches": [
    {
      "id": "456e789a-b012-34cd-ef56-789012345678",
      "name": "Olympus Main HQ",
      "slug": "main",
      "is_main": true,
      "is_active": true,
      "member_count": 86
    },
    {
      "id": "567f890b-c123-45de-fa67-890123456789",
      "name": "Olympus Uptown",
      "slug": "uptown",
      "is_main": false,
      "is_active": true,
      "member_count": 42
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


---

## 6. Member Management

### `GET /gyms/{gym_id}/members`
List members in a gym with pagination, search, and status/branch filtering.
- **RBAC:**
  - Gym Owners & Admins: see all members enrolled in the gym.
  - Trainers: see only active members assigned to them.
  - Members: see only their own membership record.

**Query Parameters:**
- `page` (integer, default: 1): Page number (1-indexed).
- `page_size` (integer, default: 20, max: 100): Results per page.
- `search` (string, optional): Search string matching member name, email, phone, or member code (case-insensitive substring).
- `status` (string, optional): Filter by `active`, `inactive`, `suspended`, or `pending`.
- `branch_id` (UUID, optional): Filter by assigned branch UUID.

**Headers:**
- `Authorization: Bearer <token>`
- Optional `X-Gym-ID` must match `{gym_id}` if provided.

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "e0b82da8-6888-466a-b286-578b8e05f63d",
      "gym_id": "c3b87910-1498-4c32-b7b8-a6d10db90cf5",
      "user_id": null,
      "branch_id": "11111111-2222-3333-4444-555555555555",
      "branch_name": "Alpha Downtown",
      "member_code": "MEM-VIP001",
      "full_name": "Jane Member",
      "email": "jane.member@example.com",
      "phone": "+1-555-987-6543",
      "date_of_birth": "1994-06-15",
      "gender": "female",
      "emergency_contact": {
        "name": "John Member",
        "phone": "+1-555-999-1111",
        "relationship": "Spouse"
      },
      "status": "active",
      "notes": "Prefers morning workout sessions",
      "joined_at": "2026-11-22T08:00:00Z",
      "created_at": "2026-11-22T08:00:00Z",
      "updated_at": "2026-11-22T08:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

---

### `POST /gyms/{gym_id}/members`
Register a new gym member (walk-in or user-linked).
- **RBAC:** Requires Gym Owner or Admin role.
- **Walk-in Support:** `user_id` can be omitted (`null`) for front-desk walk-in registrations.
- **Member Code:** Generated automatically if omitted (`MEM-XXXXXX`) using database-backed collision-safe retry logic.
- **Branch Validation:** Validates `branch_id` belongs to `{gym_id}` (enforced by DB composite FK).
- **Audit Logging:** Writes immutable audit log (`action="member.create"`).

**Request Body:**
```json
{
  "full_name": "Alex Morgan",
  "email": "alex.morgan@example.com",
  "phone": "+1-555-234-5678",
  "member_code": "MEM-VIP02",
  "branch_id": "11111111-2222-3333-4444-555555555555",
  "date_of_birth": "1992-04-10",
  "gender": "other",
  "status": "active",
  "emergency_contact": {
    "name": "Sam Morgan",
    "phone": "+1-555-234-9999",
    "relationship": "Sibling"
  },
  "notes": "Walk-in registration via front desk"
}
```

**Response (201 Created):**
```json
{
  "id": "7b827e69-094c-4735-8666-3bce7bfba309",
  "gym_id": "c3b87910-1498-4c32-b7b8-a6d10db90cf5",
  "user_id": null,
  "branch_id": "11111111-2222-3333-4444-555555555555",
  "branch_name": "Alpha Downtown",
  "member_code": "MEM-VIP02",
  "full_name": "Alex Morgan",
  "email": "alex.morgan@example.com",
  "phone": "+1-555-234-5678",
  "date_of_birth": "1992-04-10",
  "gender": "other",
  "emergency_contact": {
    "name": "Sam Morgan",
    "phone": "+1-555-234-9999",
    "relationship": "Sibling"
  },
  "status": "active",
  "notes": "Walk-in registration via front desk",
  "joined_at": "2026-11-22T08:30:00Z",
  "created_at": "2026-11-22T08:30:00Z",
  "updated_at": "2026-11-22T08:30:00Z"
}
```

---

### `GET /gyms/{gym_id}/members/{member_id}`
Retrieve complete member profile, active/past subscriptions, and assigned trainers.
- **RBAC:**
  - Gym Owners & Admins: access any member in this gym.
  - Trainers: access only assigned members (403 if unassigned).
  - Members: access only their own profile (403 for other members).

**Response (200 OK):**
```json
{
  "id": "7b827e69-094c-4735-8666-3bce7bfba309",
  "gym_id": "c3b87910-1498-4c32-b7b8-a6d10db90cf5",
  "user_id": null,
  "branch_id": "11111111-2222-3333-4444-555555555555",
  "branch_name": "Alpha Downtown",
  "member_code": "MEM-VIP02",
  "full_name": "Alex Morgan",
  "email": "alex.morgan@example.com",
  "phone": "+1-555-234-5678",
  "date_of_birth": "1992-04-10",
  "gender": "other",
  "emergency_contact": {
    "name": "Sam Morgan",
    "phone": "+1-555-234-9999",
    "relationship": "Sibling"
  },
  "status": "active",
  "notes": "Walk-in registration via front desk",
  "joined_at": "2026-11-22T08:30:00Z",
  "created_at": "2026-11-22T08:30:00Z",
  "updated_at": "2026-11-22T08:30:00Z",
  "subscriptions": [
    {
      "id": "d3c87e12-3456-7890-abcd-ef0123456789",
      "plan_name": "Gold All-Access",
      "start_date": "2026-11-22",
      "end_date": "2027-11-22",
      "status": "active"
    }
  ],
  "assigned_trainers": [
    {
      "trainer_id": "99887766-5544-3322-1100-aabbccddeeff",
      "trainer_name": "Coach Marcus",
      "assigned_at": "2026-11-22T08:35:00Z",
      "status": "active"
    }
  ]
}
```

---

### `PATCH /gyms/{gym_id}/members/{member_id}`
Update member profile, branch assignment, or contact info.
- **RBAC:** Requires Gym Owner or Admin role.
- **Audit Logging:** Records delta between old and new values (`action="member.update"`).

**Request Body:**
```json
{
  "full_name": "Alex Morgan-Jones",
  "phone": "+1-555-999-8888",
  "notes": "Updated contact details upon contract extension"
}
```

**Response (200 OK):**
Returns updated `MemberRead` object.

---

### `PATCH /gyms/{gym_id}/members/{member_id}/status`
Update member enrollment status with an optional audit reason.
- **RBAC:** Requires Gym Owner or Admin role.
- **Audit Logging:** Records status transition and reason (`action="member.status_change"`).

**Request Body:**
```json
{
  "status": "suspended",
  "reason": "Temporary suspension due to payment delinquency"
}
```

**Response (200 OK):**
Returns updated `MemberRead` object.

---

## 6. Membership Plans Management

### `GET /gyms/{gym_id}/membership-plans`
List membership plans in the current gym.
- **RBAC:** Accessible to all authenticated tenant roles (Owner, Admin, Trainer, Member).
- **Query Parameters:**
  - `page` (default 1, ge=1)
  - `page_size` (default 50, ge=1, le=100)
  - `search` (optional str): filter by plan name or description
  - `is_active` (optional bool): filter by active status

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "e2a3b4c5-6789-01bc-def0-123456789abc",
      "gym_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Gold Annual Membership",
      "description": "Full access to all facilities and group fitness classes",
      "duration_days": 365,
      "price": 499.99,
      "currency": "USD",
      "billing_frequency": "yearly",
      "is_active": true,
      "created_at": "2026-11-22T09:00:00Z",
      "updated_at": "2026-11-22T09:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 50,
  "total_pages": 1
}
```

---

### `POST /gyms/{gym_id}/membership-plans`
Create a new membership plan with custom pricing and duration terms.
- **RBAC:** Requires Gym Owner or Admin role.
- **Validation:**
  - Unique plan name within gym (`uq_gym_plan_name`)
  - `duration_days >= 1`
  - `price >= 0`
  - Currency 2-10 characters uppercase
- **Audit Logging:** Records `action="plan.create"`.

**Request Body:**
```json
{
  "name": "Silver Monthly",
  "description": "Standard monthly gym access",
  "duration_days": 30,
  "price": 49.00,
  "currency": "USD",
  "billing_frequency": "monthly",
  "is_active": true
}
```

**Response (201 Created):**
Returns `MembershipPlanRead` object.

---

### `GET /gyms/{gym_id}/membership-plans/{plan_id}`
Retrieve a specific membership plan by ID.
- **RBAC:** Accessible to all authenticated tenant roles.

**Response (200 OK):**
Returns `MembershipPlanRead` object.

---

### `PATCH /gyms/{gym_id}/membership-plans/{plan_id}`
Update plan pricing, duration, or description.
- **RBAC:** Requires Gym Owner or Admin role.
- **Historical Integrity:** Updates only affect new assignments; existing member subscriptions preserve their contracted pricing and dates.
- **Audit Logging:** Records `action="plan.update"`.

**Request Body:**
```json
{
  "price": 54.99,
  "description": "Updated standard monthly gym access with extended locker privileges"
}
```

**Response (200 OK):**
Returns updated `MembershipPlanRead` object.

---

### `PATCH /gyms/{gym_id}/membership-plans/{plan_id}/status`
Toggle plan active availability.
- **RBAC:** Requires Gym Owner or Admin role.
- **Audit Logging:** Records `action="plan.status_change"`.

**Request Body:**
```json
{
  "is_active": false
}
```

**Response (200 OK):**
Returns updated `MembershipPlanRead` object.

---

## 7. Member Subscription Management

### `GET /gyms/{gym_id}/subscriptions`
List member subscriptions in this gym.
- **RBAC:**
  - Gym Owner & Admin: view all gym subscriptions.
  - Trainers: view subscriptions for assigned members only.
  - Members: view only their own subscriptions.
- **Query Parameters:**
  - `page` (default 1, ge=1)
  - `page_size` (default 20, ge=1, le=100)
  - `member_id` (optional UUID)
  - `plan_id` (optional UUID)
  - `status` (optional: active, expired, cancelled, trial)
  - `expiring_within_days` (optional int)
  - `search` (optional str: member name, member code, email, or plan name)

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "c1d2e3f4-5678-90ab-cdef-123456789abc",
      "gym_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "member_id": "f1e2d3c4-b5a6-7890-1234-567890abcdef",
      "plan_id": "e2a3b4c5-6789-01bc-def0-123456789abc",
      "start_date": "2026-11-22",
      "end_date": "2027-11-22",
      "price_paid": 499.99,
      "currency": "USD",
      "status": "active",
      "auto_renew": true,
      "notes": "First year promo",
      "created_at": "2026-11-22T09:15:00Z",
      "updated_at": "2026-11-22T09:15:00Z",
      "member_name": "Alex Morgan",
      "member_code": "MEM-AB12CD",
      "member_email": "alex@example.com",
      "plan_name": "Gold Annual Membership",
      "days_remaining": 365
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

---

### `POST /gyms/{gym_id}/subscriptions`
Assign a membership plan to a gym member.
- **RBAC:** Requires Gym Owner or Admin role.
- **Business Logic & Protections:**
  - Verifies member and plan both belong to `tenant.gym_id`.
  - Verifies plan is active (`plan.is_active is True`).
  - Auto-calculates `start_date` = today (if omitted) and `end_date` = `start_date + plan.duration_days` (if omitted).
  - Defaults `price_paid` to `plan.price` and `currency` to `plan.currency`.
  - Overlap Prevention: rejects with **HTTP 400 Bad Request** if member already has an active subscription during the requested period.
- **Audit Logging:** Records `action="subscription.create"`.

**Request Body:**
```json
{
  "member_id": "f1e2d3c4-b5a6-7890-1234-567890abcdef",
  "plan_id": "e2a3b4c5-6789-01bc-def0-123456789abc",
  "start_date": "2026-11-22",
  "auto_renew": true,
  "notes": "Front desk walk-in assignment"
}
```

**Response (201 Created):**
Returns `MemberSubscriptionRead` object.

---

### `GET /gyms/{gym_id}/subscriptions/{subscription_id}`
Retrieve a subscription by ID with joined member and plan details.
- **RBAC:** Enforces tenant boundary and role scoping.

**Response (200 OK):**
Returns `MemberSubscriptionRead` object.

---

### `PATCH /gyms/{gym_id}/subscriptions/{subscription_id}`
Update subscription terms (end date, auto-renew, notes).
- **RBAC:** Requires Gym Owner or Admin role.
- **Audit Logging:** Records `action="subscription.update"`.

**Request Body:**
```json
{
  "end_date": "2027-12-07",
  "notes": "Granted 15 days complimentary holiday extension"
}
```

**Response (200 OK):**
Returns updated `MemberSubscriptionRead` object.

---

### `POST /gyms/{gym_id}/subscriptions/{subscription_id}/renew`
Renew a subscription for a new billing cycle.
- **RBAC:** Requires Gym Owner or Admin role.
- **Renewal Semantics:**
  - If current subscription is active (`end_date >= today`): new cycle starts `current.end_date + 1 day`.
  - If current subscription has expired (`end_date < today`): new cycle starts `today`.
  - New end date is computed from target plan duration.
  - Disables auto-renew on the previous subscription record and creates a new active cycle record preserving historical audit trails.
- **Audit Logging:** Records `action="subscription.renew"`.

**Request Body:**
```json
{
  "notes": "Early renewal for upcoming year"
}
```

**Response (200 OK):**
Returns new `MemberSubscriptionRead` object for the renewed cycle.

---

### `PATCH /gyms/{gym_id}/subscriptions/{subscription_id}/cancel`
Cancel an active subscription.
- **RBAC:** Requires Gym Owner or Admin role.
- **Semantics:** Sets `status = "cancelled"`, disables `auto_renew`, and appends cancellation reason to notes.
- **Audit Logging:** Records `action="subscription.cancel"`.

**Request Body:**
```json
{
  "reason": "Member relocation to another city"
}
```

**Response (200 OK):**
Returns updated `MemberSubscriptionRead` object.
