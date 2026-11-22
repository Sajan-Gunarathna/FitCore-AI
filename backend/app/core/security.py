"""JWT verification and security utilities."""

import logging
from typing import Optional, Dict, Any

from jose import JWTError, jwt
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"


def verify_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Verify a Supabase-issued JWT.

    Raises HTTPException 401 on any failure so the caller never receives
    unverified claims.
    """
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service not configured.",
        )

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[ALGORITHM],
            # Supabase sets audience to "authenticated" for logged-in users
            options={"verify_aud": False},
        )
    except JWTError as exc:
        logger.warning("JWT verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate issuer when configured
    if settings.supabase_jwt_issuer:
        issuer = payload.get("iss", "")
        if issuer != settings.supabase_jwt_issuer:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token issuer mismatch.",
            )

    return payload


def extract_user_id(payload: Dict[str, Any]) -> str:
    """Extract the Supabase user UUID from a verified JWT payload."""
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim.",
        )
    return sub
