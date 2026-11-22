"""FastAPI dependency injection helpers."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import verify_supabase_jwt, extract_user_id

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> str:
    """
    Dependency that returns the authenticated Supabase user ID (UUID string).
    Raises 401 if the token is missing, invalid or expired.
    """
    payload = verify_supabase_jwt(credentials.credentials)
    return extract_user_id(payload)


CurrentUserID = Annotated[str, Depends(get_current_user_id)]
