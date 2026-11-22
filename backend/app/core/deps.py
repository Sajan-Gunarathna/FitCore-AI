"""FastAPI dependency injection helpers for Authentication and Multi-Tenant Context."""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, set_tenant_session_context
from app.core.security import extract_user_id, verify_supabase_jwt
from app.models.role import UserRole
from app.models.user import User
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Authenticate request via Supabase JWT.
    Strictly verifies signature, exp, aud, and iss.
    Ensures an application user profile exists in PostgreSQL.
    Initializes PostgreSQL transaction context app.current_user_id for RLS policies.
    """
    payload = await verify_supabase_jwt(credentials.credentials)
    user_id_str = extract_user_id(payload)

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token claims.",
        ) from None

    user_repo = UserRepository(session)
    user = await user_repo.get_by_id(user_uuid)

    if not user:
        # Auto-provision user record on first authenticated call
        email = payload.get("email") or f"{user_uuid}@fitcore.internal"
        user_metadata = payload.get("user_metadata", {})
        full_name = user_metadata.get("full_name") or user_metadata.get("name")
        user = await user_repo.get_or_create_from_jwt(
            user_id=user_uuid, email=email, full_name=full_name
        )
        await session.flush()

    # Priority 2: Set transaction-scoped PostgreSQL session context for RLS
    await set_tenant_session_context(session, user_id=user.id)

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


@dataclass
class TenantContext:
    gym_id: uuid.UUID
    user: User
    roles: list[str]

    @property
    def is_owner(self) -> bool:
        return UserRole.OWNER.value in self.roles or self.user.is_super_admin

    @property
    def is_admin(self) -> bool:
        return (
            self.is_owner
            or UserRole.ADMIN.value in self.roles
            or self.user.is_super_admin
        )

    @property
    def is_trainer(self) -> bool:
        return UserRole.TRAINER.value in self.roles or self.is_admin

    @property
    def is_member(self) -> bool:
        return UserRole.MEMBER.value in self.roles or self.is_admin


async def get_tenant_context(
    request: Request,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_db)],
    x_gym_id: Annotated[str | None, Header()] = None,
) -> TenantContext:
    """
    Authoritative Multi-Tenant Isolation Dependency.

    Resolution Strategy:
    1. If route has 'gym_id' path parameter, path parameter is authoritative.
    2. If 'X-Gym-ID' header is also supplied, compare header and path parameter.
       Reject with HTTP 400 if they differ (P0 prevention).
    3. If route has no path parameter, 'X-Gym-ID' header is used.
    4. Validates membership in the authorized gym (403 Forbidden on mismatch).
    5. Sets transaction-scoped PostgreSQL session context (app.current_gym_id).
    """
    path_gym_id = request.path_params.get("gym_id")

    # Authoritative check: Prevent Header/Path Tenant Desynchronization
    if (
        path_gym_id is not None
        and x_gym_id is not None
        and str(path_gym_id).strip().lower() != str(x_gym_id).strip().lower()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Tenant desynchronization detected: 'X-Gym-ID' header "
                "does not match 'gym_id' URL path parameter."
            ),
        )

    gym_id_raw = path_gym_id or x_gym_id

    if not gym_id_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Tenant identifier missing. "
                "Please provide the 'X-Gym-ID' header or path parameter."
            ),
        )

    try:
        gym_uuid = uuid.UUID(str(gym_id_raw))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid gym_id format. Must be a valid UUID.",
        ) from None

    role_repo = RoleRepository(session)
    user_roles_records = await role_repo.list_user_roles_in_gym(gym_uuid, user.id)
    roles = [r.role for r in user_roles_records]

    # Super admin has global tenant access
    if not user.is_super_admin and not roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not belong to this gym or your membership is inactive.",
        )

    # Set transaction-scoped PostgreSQL session context for RLS policies
    await set_tenant_session_context(session, gym_id=gym_uuid, user_id=user.id)

    return TenantContext(gym_id=gym_uuid, user=user, roles=roles)


CurrentTenant = Annotated[TenantContext, Depends(get_tenant_context)]


def require_roles(allowed_roles: Sequence[str]):
    """
    Factory creating a dependency that enforces required gym roles.
    Fails closed with 403 Forbidden if user lacks necessary permissions.
    """

    async def role_checker(tenant: CurrentTenant) -> TenantContext:
        if tenant.user.is_super_admin:
            return tenant

        has_permission = any(r in allowed_roles for r in tenant.roles)
        if not has_permission:
            required_str = ", ".join(allowed_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {required_str}",
            )
        return tenant

    return role_checker


RequireGymOwner = Annotated[
    TenantContext, Depends(require_roles([UserRole.OWNER.value]))
]
RequireGymAdmin = Annotated[
    TenantContext,
    Depends(require_roles([UserRole.OWNER.value, UserRole.ADMIN.value])),
]
RequireGymStaff = Annotated[
    TenantContext,
    Depends(
        require_roles(
            [
                UserRole.OWNER.value,
                UserRole.ADMIN.value,
                UserRole.TRAINER.value,
            ]
        )
    ),
]
